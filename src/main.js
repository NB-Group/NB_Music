const { app, BrowserWindow, session, ipcMain, Menu, Tray, shell, nativeImage } = require("electron");
const path = require("path");
const puppeteer = require("puppeteer");
const Storage = require("electron-store");
const { autoUpdater } = require("electron-updater");
const storage = new Storage();
const axios = require("axios");
const fs = require("fs");
const https = require("https");

let browserAuthServer = null;


function parseCommandLineArgs() {
    const args = process.argv.slice(1);
    const showWelcomeArg = args.includes("--show-welcome");
    const noCookiesArg = args.includes("--no-cookies"); // 添加新参数检测
    return {
        showWelcome: showWelcomeArg,
        noCookies: noCookiesArg // 返回新参数状态
    };
}
function setupAutoUpdater(win) {
    // 开发环境跳过更新检查
    if (!app.isPackaged) return;

    // 配置更新服务器
    autoUpdater.setFeedURL({
        provider: "github",
        owner: "NB-Group",
        repo: "NB_Music"
    });

    // 检查更新出错
    autoUpdater.on("error", (err) => {
        win.webContents.send("update-error", err.message);
    });

    // 检查到新版本
    autoUpdater.on("update-available", (info) => {
        win.webContents.send("update-available", info);
    });

    // 没有新版本
    autoUpdater.on("update-not-available", () => {
        win.webContents.send("update-not-available");
    });

    // 下载进度
    autoUpdater.on("download-progress", (progress) => {
        win.webContents.send("download-progress", progress);
    });

    // 更新下载完成
    autoUpdater.on("update-downloaded", () => {
        // 通知渲染进程
        win.webContents.send("update-downloaded");

        // 提示重启应用
        const dialogOpts = {
            type: "info",
            buttons: ["重启", "稍后"],
            title: "应用更新",
            message: "有新版本已下载完成,是否重启应用?"
        };

        require("electron")
            .dialog.showMessageBox(dialogOpts)
            .then((returnValue) => {
                if (returnValue.response === 0) autoUpdater.quitAndInstall();
            });
    });

    // 每小时检查一次更新
    setInterval(() => {
        autoUpdater.checkForUpdates();
    }, 60 * 60 * 1000);

    // 启动时检查更新
    autoUpdater.checkForUpdates();
}
function loadCookies() {
    if (!storage.has("cookies")) return null;
    return storage.get("cookies");
}

function saveCookies(cookieString) {
    storage.set("cookies", cookieString);
}

async function getBilibiliCookies(skipLocalCookies = false) {
    if (!skipLocalCookies) {
        const cachedCookies = loadCookies();
        if (cachedCookies) {
            return cachedCookies;
        }
    }
    try {
        const browser = await puppeteer.launch({
            headless: true,
            defaultViewport: null
        });
        const page = await browser.newPage();
        await page.goto("https://www.bilibili.com");
        const cookies = await page.cookies();
        const cookieString = formatCookieString(cookies);
        saveCookies(cookieString);
        await browser.close();
        return cookieString;
    } catch (error) {
        console.error("获取B站cookies失败:", error);
        return "";
    }
}

function getIconPath() {
    switch (process.platform) {
        case "win32":
            return path.join(__dirname, "../icons/icon.ico");
        case "darwin":
            return path.join(__dirname, "../icons/icon.png");
        case "linux":
            return path.join(__dirname, "../icons/icon.png");
        default:
            return path.join(__dirname, "../icons/icon.png");
    }
}

// 创建托盘菜单
function createTrayMenu(win) {
    const iconPath = getIconPath();
    const tray = new Tray(iconPath);
    
    if (process.platform === 'darwin') {        
        // 设置托盘图标大小
        const trayIcon = nativeImage.createFromPath(iconPath);
        const resizedTrayIcon = trayIcon.resize({
            width: 16,
            height: 16
        });
        tray.setImage(resizedTrayIcon);
    }

    // 初始化托盘状态
    let isPlaying = false;
    let currentSong = { title: "未在播放", artist: "" };

    // 更新托盘菜单
    function updateTrayMenu() {
        let songInfo = currentSong.artist ? `${currentSong.title} - ${currentSong.artist}` : currentSong.title;

        if (songInfo.length > 23) {
            songInfo = songInfo.slice(0, 23) + "...";
        }

        const menuTemplate = [
            {
                label: "🎵 NB Music",
                enabled: false
            },
            { type: "separator" },
            {
                label: songInfo,
                enabled: false
            },
            { type: "separator" },
            {
                label: isPlaying ? "暂停" : "播放",
                click: () => {
                    win.webContents.send("tray-control", "play-pause");
                }
            },
            {
                label: "上一曲",
                click: () => {
                    win.webContents.send("tray-control", "prev");
                }
            },
            {
                label: "下一曲",
                click: () => {
                    win.webContents.send("tray-control", "next");
                }
            },
            { type: "separator" },
            {
                label: "显示主窗口",
                click: () => {
                    showWindow(win);
                }
            },
            {
                label: "设置",
                click: () => {
                    showWindow(win);
                    win.webContents.send("tray-control", "show-settings");
                }
            },
            { type: "separator" },
            {
                label: "检查更新",
                click: () => {
                    win.webContents.send("tray-control", "check-update");
                }
            },
            {
                label: "关于",
                click: () => {
                    win.webContents.send("tray-control", "about");
                }
            },
            { type: "separator" },
            {
                label: "退出",
                click: () => {
                    app.isQuitting = true;
                    app.quit();
                }
            }
        ];

        const contextMenu = Menu.buildFromTemplate(menuTemplate);
        tray.setContextMenu(contextMenu);

        // 设置工具提示显示当前播放信息
        tray.setToolTip(`NB Music - ${isPlaying ? "正在播放: " : "已暂停: "}${songInfo}`);
    }

    // 单击托盘图标显示窗口
    tray.on("click", () => {
        showWindow(win);
    });

    // 监听来自渲染进程的托盘更新事件
    ipcMain.on("update-tray", (_, data) => {
        if (data.isPlaying !== undefined) isPlaying = data.isPlaying;
        if (data.song) currentSong = data.song;
        updateTrayMenu();
    });

    // 初始化菜单
    updateTrayMenu();

    return tray;
}

// 显示主窗口的辅助函数
function showWindow(win) {
    if (!win.isVisible()) {
        win.show();
    }
    if (win.isMinimized()) {
        win.restore();
    }
    win.focus();
}

// 全局变量存储桌面歌词窗口
let desktopLyricsWindow = null;

function createDesktopLyricsWindow() {
    // 如果已存在桌面歌词窗口，则不重复创建
    if (desktopLyricsWindow) {
        desktopLyricsWindow.show();
        return desktopLyricsWindow;
    }

    // 创建桌面歌词窗口
    desktopLyricsWindow = new BrowserWindow({
        width: 800,
        height: 100,
        x: 200,
        y: 100,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            backgroundThrottling: false // 禁止后台节流，确保即使不可见也能继续工作
        }
    });

    // 加载桌面歌词页面
    desktopLyricsWindow.loadFile("src/desktop-lyrics.html");

    // 桌面歌词窗口准备好时显示
    desktopLyricsWindow.once('ready-to-show', () => {
        desktopLyricsWindow.show();
    });

    // 监听窗口关闭事件
    desktopLyricsWindow.on('closed', () => {
        desktopLyricsWindow = null;
        // 通知主窗口桌面歌词已关闭
        if (global.mainWindow) {
            global.mainWindow.webContents.send('desktop-lyrics-closed');
        }
    });

    return desktopLyricsWindow;
}

function createWindow() {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
        return;
    }

    // 创建主窗口
    const win = new BrowserWindow({
        frame: false,
        icon: getIconPath(),
        backgroundColor: "#2f3241",
        width: 1280,
        height: 800,
        minWidth: 1280,
        minHeight: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
            backgroundThrottling: false // 禁止后台节流，确保最小化时继续工作
        },
        // 添加这些属性以改善窗口行为
        show: false, // 先不显示，等内容加载完再显示
        skipTaskbar: false
    });

    // 创建托盘
    createTrayMenu(win);

    // 当窗口准备好显示时才显示
    win.once("ready-to-show", () => {
        win.show();
        win.focus();
    });
    
    // 保持窗口活跃 - 即使最小化也运行动画和计时器
    win.webContents.setBackgroundThrottling(false);

    setupAutoUpdater(win);
    win.loadFile("src/main.html");
    win.maximize();

    if (!app.isPackaged) {
        win.webContents.openDevTools();
    }
    const cmdArgs = parseCommandLineArgs();
    win.webContents.on("did-finish-load", () => {
        win.webContents.send("command-line-args", cmdArgs);
    });

    // 处理第二个实例启动的情况
    app.on("second-instance", (event, commandLine) => {
        // 如果主窗口存在，确保它被显示、恢复并获得焦点
        if (win) {
            if (!win.isVisible()) win.show();
            if (win.isMinimized()) win.restore();
            win.focus();

            // 可以解析第二个实例的命令行参数并处理
            const secondInstanceArgs = parseCommandLineArgs(commandLine);
            if (secondInstanceArgs.showWelcome) {
                win.webContents.send("show-welcome");
            }
        }
    });

    // 设置应用退出标志
    app.isQuitting = false;

    // 修改窗口关闭行为
    win.on("close", (e) => {
        if (!app.isQuitting) {
            e.preventDefault();
            win.hide(); // 隐藏窗口而不是关闭
            return false;
        }
    });

    ipcMain.on("window-minimize", () => {
        win.minimize();
    });

    ipcMain.on("window-maximize", () => {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    });

    ipcMain.on("window-close", () => {
        win.hide(); // 修改为隐藏窗口
    });

    ipcMain.on("quit-app", () => {
        app.isQuitting = true;
        app.quit();
    });

    // 窗口状态变化时通知渲染进程
    win.on("maximize", () => {
        win.webContents.send("window-state-changed", true);
    });

    win.on("unmaximize", () => {
        win.webContents.send("window-state-changed", false);
    });

    win.on("show", () => {
        win.webContents.send("window-show");
    });

    win.on("hide", () => {
        win.webContents.send("window-hide");
    });

    // 监听窗口最小化事件
    win.on('minimize', () => {
        win.webContents.send('window-minimized');
    });
    
    win.on('restore', () => {
        win.webContents.send('window-restored');
    });

    // 添加新的login-success处理
    ipcMain.on("login-success", async (event, data) => {
        try {
            const { cookies } = data;
            if (!cookies || cookies.length === 0) {
                throw new Error("未能获取到cookie");
            }

            // 直接保存cookie字符串
            saveCookies(cookies.join(";"));

            // 设置请求头
            setBilibiliRequestCookie(cookies.join(";"));

            win.webContents.send("cookies-set", true);
        } catch (error) {
            console.error("登录失败:", error);
            win.webContents.send("cookies-set-error", error.message);
        }
    });

    ipcMain.on("open-dev-tools", () => {
        // 修改为允许在打包后的应用中打开开发者工具
        // 原代码只在开发环境中启用
        if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools();
        } else {
            win.webContents.openDevTools();
        }
    });

    ipcMain.on('get-cookies', async (event) => {
        win.webContents.send('get-cookies-success', loadCookies());
    });

    ipcMain.on('logout', async (event) => {
        storage.delete("cookies");
        win.webContents.send('logout-success');

        setBilibiliRequestCookie("");
    });

    ipcMain.on('start-browser-auth-server', async (event) => {
        if (browserAuthServer === null) {
            browserAuthServer = https.createServer({
                key: fs.readFileSync(path.join(__dirname, '..', 'ssl', 'privkey.pem')), // 私钥
                cert: fs.readFileSync(path.join(__dirname, '..', 'ssl', 'fullchain.pem')) // 证书
            }, function (request, response) {
                if (request.url === '/callback') {
                    let cookieString = request.headers.cookie + ';nbmusic_loginmode=browser';

                    // 直接保存cookie字符串
                    saveCookies(cookieString);

                    // 设置请求头
                    setBilibiliRequestCookie(cookieString);

                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({
                        status: 0,
                        data: {
                            isLogin: true,
                            message: '登录成功'
                        }
                    }));

                    win.webContents.send('cookies-set', true);

                    browserAuthServer.close();
                    browserAuthServer = null;
                } else if (request.url === '/background.png') {
                    response.writeHead(200, { 'Content-Type': 'image/png' });
                    response.end(fs.readFileSync(path.join(__dirname, '..', 'img', 'NB_Music.png')));
                } else if (request.url === '/HarmonyOS_Sans.woff') {
                    response.writeHead(200, { 'Content-Type': 'font/woff' });
                    response.end(fs.readFileSync(path.join(__dirname, '..', 'fonts', 'HarmonyOS_Sans_Medium.woff')));
                } else if (request.url === '/getUserInfo') {
                    axios.get('https://api.bilibili.com/x/web-interface/nav', {
                        headers: {
                            "Cookie": request.headers.cookie,
                            "Referer": "https://www.bilibili.com/",
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
                        }
                    }).then(res => {
                        const data = res.data.data;

                        response.writeHead(200, { 'Content-Type': 'application/json' });
                        if (data.isLogin) {
                            response.end(JSON.stringify({
                                status: 0,
                                data: {
                                    isLogin: true,
                                    avatar: data.face,
                                    name: data.uname,
                                    mid: data.mid,
                                }
                            }));
                        } else {
                            response.end(JSON.stringify({
                                status: 0,
                                data: {
                                    isLogin: false
                                }
                            }));
                        }
                    }).catch(error => {
                        console.error('获取用户信息失败:', error);

                        response.writeHead(500, { 'Content-Type': 'application/json' });
                        response.end(JSON.stringify({
                            status: -1,
                            data: {
                                message: "服务内部错误"
                            }
                        }));
                    });
                } else if (request.url === '/favicon.ico') {
                    response.writeHead(200, { 'Content-Type': 'image/x-icon' });
                    response.end(fs.readFileSync(path.join(__dirname, '..', 'icons', 'icon.ico')));
                } else {
                    response.writeHead(200, { 'Content-Type': 'text/html' });
                    response.end(fs.readFileSync(path.join(__dirname, 'login.html')));
                }
            }).listen(62687);
        }
    });

    ipcMain.on('close-browser-auth-server', async (event) => {
        if (browserAuthServer !== null) {
            browserAuthServer.close();
            browserAuthServer = null;
        }
    });

    // 返回窗口实例以便其他地方使用
    return win;
}

function formatCookieString(cookies) {
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join(";");
}

app.whenReady().then(async () => {
    if (!app.isPackaged && process.argv[2] != "--no-reload") {
        require("electron-reload")(__dirname, {
            electron: path.join(process.cwd(), "node_modules", ".bin", "electron")
        });
    }

    // 存储主窗口的引用
    global.mainWindow = createWindow();

    setupIPC();
    const cmdArgs = parseCommandLineArgs();

    const cookieString = await getBilibiliCookies(cmdArgs.noCookies);
    if (cookieString) {
        setBilibiliRequestCookie(cookieString);
    }
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
app.on("before-quit", () => {
    // 标记应用正在退出，这样可以防止窗口的关闭事件被阻止
    app.isQuitting = true;
});

app.on("activate", () => {
    if (global.mainWindow) {
        if (!global.mainWindow.isVisible()) {
            global.mainWindow.show();
        }
        if (global.mainWindow.isMinimized()) {
            global.mainWindow.restore();
        }
        global.mainWindow.focus();
    }
});

function setupIPC() {
    ipcMain.handle("get-app-version", () => {
        return app.getVersion();
    });

    ipcMain.on("check-for-updates", () => {
        // 如果不是打包后的应用，显示开发环境提示
        if (!app.isPackaged) {
            BrowserWindow.getFocusedWindow()?.webContents.send("update-not-available", {
                message: "开发环境中无法检查更新"
            });
            return;
        }

        // 执行更新检查
        autoUpdater.checkForUpdates().catch((err) => {
            console.error("更新检查失败:", err);
            BrowserWindow.getFocusedWindow()?.webContents.send("update-error", err.message);
        });
    });

    ipcMain.on("install-update", () => {
        // 安装已下载的更新
        autoUpdater.quitAndInstall(true, true);
    });

    ipcMain.on("open-external-link", (_, url) => {
        shell.openExternal(url);
    });

    // 添加退出应用的IPC处理
    ipcMain.on("quit-application", () => {
        app.isQuitting = true;
        app.quit();
    });

    // 桌面歌词相关IPC通信
    ipcMain.on('toggle-desktop-lyrics', (event, enabled) => {
        if (enabled) {
            createDesktopLyricsWindow();
        } else if (desktopLyricsWindow) {
            desktopLyricsWindow.close();
            desktopLyricsWindow = null;
        }
    });

    ipcMain.on('update-desktop-lyrics', (event, lyricsData) => {
        if (desktopLyricsWindow) {
            desktopLyricsWindow.webContents.send('update-desktop-lyrics', lyricsData);
        }
    });

    ipcMain.on('update-lyrics-style', (event, style) => {
        if (desktopLyricsWindow) {
            desktopLyricsWindow.webContents.send('update-lyrics-style', style);
        }
    });

    // 处理播放控制
    ipcMain.on('desktop-lyrics-toggle-play', (event) => {
        if (global.mainWindow) {
            global.mainWindow.webContents.send('desktop-lyrics-control', 'toggle-play');
        }
    });
    
    // 处理进度条拖动
    ipcMain.on('desktop-lyrics-seek', (event, time) => {
        if (global.mainWindow) {
            global.mainWindow.webContents.send('desktop-lyrics-control', 'seek', time);
        }
    });

    // 新增桌面歌词样式更新事件
    ipcMain.on('desktop-lyrics-update-style', (event, style) => {
        if (global.mainWindow) {
            global.mainWindow.webContents.send('desktop-lyrics-style-changed', style);
        }
    });

    // 处理窗口大小调整
    ipcMain.on('desktop-lyrics-resize', (event, size) => {
        if (desktopLyricsWindow) {
            desktopLyricsWindow.setSize(size.width, size.height);
        }
    });

    // 处理背景颜色选择
    ipcMain.on('desktop-lyrics-bg-color', (event) => {
        if (global.mainWindow) {
            global.mainWindow.webContents.send('show-lyrics-bg-color-picker');
        }
    });

    ipcMain.on('desktop-lyrics-ready', () => {
        // 桌面歌词窗口准备好后，通知主窗口
        if (global.mainWindow) {
            global.mainWindow.webContents.send('desktop-lyrics-ready');
        }
    });

    ipcMain.on('desktop-lyrics-toggle-pin', () => {
        if (desktopLyricsWindow) {
            const isAlwaysOnTop = desktopLyricsWindow.isAlwaysOnTop();
            desktopLyricsWindow.setAlwaysOnTop(!isAlwaysOnTop);
            // 通知主窗口锁定状态已改变
            if (global.mainWindow) {
                global.mainWindow.webContents.send('desktop-lyrics-pin-changed', !isAlwaysOnTop);
            }
        }
    });

    ipcMain.on('desktop-lyrics-font-size', () => {
        // 通知主窗口打开字体大小设置
        if (global.mainWindow) {
            global.mainWindow.webContents.send('open-lyrics-font-settings');
        }
    });

    ipcMain.on('desktop-lyrics-settings', () => {
        // 通知主窗口打开桌面歌词设置
        if (global.mainWindow) {
            global.mainWindow.webContents.send('open-lyrics-settings');
            global.mainWindow.focus();
        }
    });

    ipcMain.on('desktop-lyrics-close', () => {
        if (desktopLyricsWindow) {
            desktopLyricsWindow.close();
            desktopLyricsWindow = null;
        }
    });

    // 强制同步歌词 - 这个新增的IPC处理器可以确保在主窗口状态变化时仍能同步歌词
    ipcMain.on('force-sync-desktop-lyrics', (event) => {
        if (global.mainWindow && desktopLyricsWindow) {
            global.mainWindow.webContents.send('request-lyrics-sync');
        }
    });
}

// 防止应用程序休眠
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

function setBilibiliRequestCookie(cookieString) {
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        if (details.url.includes("bilibili.com") ||
            details.url.includes("bilivideo.cn") ||
            details.url.includes("bilivideo.com")) {
            details.requestHeaders["Cookie"] = cookieString;
            details.requestHeaders["referer"] = "https://www.bilibili.com/";
            details.requestHeaders["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3";
        }
        callback({ requestHeaders: details.requestHeaders });
    });
}
