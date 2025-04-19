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

// 窗口状态存储键名
const WINDOW_STATE_KEY = "windowState";

// 保存窗口状态的函数
function saveWindowState(win) {
    if (!win.isMaximized() && !win.isMinimized()) {
        // 只有在非最大化和非最小化状态下才保存大小和位置
        const bounds = win.getBounds();
        const state = {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            isMaximized: false
        };
        storage.set(WINDOW_STATE_KEY, state);
    } else if (win.isMaximized()) {
        // 如果窗口是最大化状态，只保存最大化标志
        storage.set(WINDOW_STATE_KEY, { isMaximized: true });
    }
}

// 获取保存的窗口状态
function getWindowState() {
    const defaultState = {
        width: 1280,
        height: 800,
        isMaximized: false
    };

    try {
        const state = storage.get(WINDOW_STATE_KEY, defaultState);
        return state;
    } catch (error) {
        console.error("获取窗口状态失败:", error);
        return defaultState;
    }
}

// 应用窗口状态
function applyWindowState(win) {
    const state = getWindowState();
    const restoreWindowState = storage.get("restoreWindowState", true); // 默认开启窗口状态恢复

    if (restoreWindowState) {
        if (state.x !== undefined && state.y !== undefined) {
            // 确保窗口位于可见区域
            const { screen } = require("electron");
            const displays = screen.getAllDisplays();
            let isVisible = false;

            for (const display of displays) {
                const bounds = display.bounds;
                if (state.x >= bounds.x && state.y >= bounds.y && state.x < bounds.x + bounds.width && state.y < bounds.y + bounds.height) {
                    isVisible = true;
                    break;
                }
            }

            if (isVisible) {
                win.setBounds({
                    x: state.x,
                    y: state.y,
                    width: state.width || 1280,
                    height: state.height || 800
                });
            }
        }

        if (state.isMaximized) {
            win.maximize();
        }
    }
}

axios.defaults.withCredentials = true;

function parseCommandLineArgs() {
    const args = process.argv.slice(1);
    const showWelcomeArg = args.includes("--show-welcome");
    const noCookiesArg = args.includes("--no-cookies");
    return {
        showWelcome: showWelcomeArg,
        noCookies: noCookiesArg
    };
}

/* 初始化自动更新 */
function setupAutoUpdater(win) {
    if (!app.isPackaged) return;

    /*
    autoUpdater.setFeedURL({
        provider: "github",
        owner: "NB-Group",
        repo: "NB_Music"
    }); // 已被弃用
    */

    // 更新出错
    autoUpdater.on("error", (err) => {
        win.webContents.send("update-error", err.message);
    });

    // 有更新
    autoUpdater.on("update-available", (info) => {
        win.webContents.send("update-available", info);
    });

    // 无法更新/已是最新版本
    autoUpdater.on("update-not-available", () => {
        win.webContents.send("update-not-available");
    });

    autoUpdater.on("download-progress", (progress) => {
        win.webContents.send("download-progress", progress);
    });

    // 更新下载完成
    autoUpdater.on("update-downloaded", () => {
        win.webContents.send("update-downloaded");

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

    setInterval(() => {
        autoUpdater.checkForUpdates();
    }, 60 * 60 * 1000);

    autoUpdater.checkForUpdates();
}
/* 古希腊掌管 Bilibili Cookie 的神 */
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
        const context = browser.defaultBrowserContext();
        const cookies = await context.cookies("https://www.bilibili.com");
        const cookieString = formatCookieString(cookies);
        saveCookies(cookieString);
        await browser.close();
        return cookieString;
    } catch (error) {
        console.error("获取B站cookies失败:", error);
        return "";
    }
}

/* 根据不同的系统返回不同的图标格式 */
function getIconPath() {
    switch (process.platform) {
        case "win32":
            return path.join(__dirname, "../icons/icon.ico");
        default:
            return path.join(__dirname, "../icons/icon.png");
    }
}

function createTrayMenu(win) {
    const iconPath = getIconPath();
    const tray = new Tray(iconPath);

    if (process.platform === "darwin") {
        const trayIcon = nativeImage.createFromPath(iconPath);
        const resizedTrayIcon = trayIcon.resize({
            width: 16,
            height: 16
        });
        tray.setImage(resizedTrayIcon);
    }

    let isPlaying = false;
    let currentSong = { title: "未在播放", artist: "" };

    function updateTrayMenu() {
        let songInfo = currentSong.artist ? `${currentSong.title} - ${currentSong.artist}` : currentSong.title;

        if (songInfo.length > 23) {
            songInfo = songInfo.slice(0, 23) + "...";
        }

        /* 托盘选项 */
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

        tray.setToolTip(`NB Music - ${isPlaying ? "正在播放: " : "已暂停: "}${songInfo}`);
    }

    tray.on("click", () => {
        showWindow(win);
    });

    ipcMain.on("update-tray", (_, data) => {
        if (data.isPlaying !== undefined) isPlaying = data.isPlaying;
        if (data.song) currentSong = data.song;
        updateTrayMenu();
    });

    updateTrayMenu();

    return tray;
}

function showWindow(win) {
    if (!win.isVisible()) {
        win.show();
    }
    if (win.isMinimized()) {
        win.restore();
    }
    win.focus();
}

let desktopLyricsWindow = null;

function createDesktopLyricsWindow() {
    if (desktopLyricsWindow) {
        desktopLyricsWindow.show();
        return desktopLyricsWindow;
    }

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
            backgroundThrottling: false
        }
    });

    desktopLyricsWindow.loadFile("src/desktop-lyrics.html");

    desktopLyricsWindow.once("ready-to-show", () => {
        desktopLyricsWindow.show();
    });

    desktopLyricsWindow.on("closed", () => {
        desktopLyricsWindow = null;
        if (global.mainWindow) {
            global.mainWindow.webContents.send("desktop-lyrics-closed");
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

    const windowState = getWindowState();

    const win = new BrowserWindow({
        frame: false,
        icon: getIconPath(),
        backgroundColor: "#2f3241",
        width: windowState.width || 1280,
        height: windowState.height || 800,
        minWidth: 1280,
        minHeight: 800,
        x: windowState.x,
        y: windowState.y,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
            backgroundThrottling: false
        },
        show: false,
        skipTaskbar: false
    });

    createTrayMenu(win);

    win.once("ready-to-show", () => {
        win.show();
        win.focus();

        const restoreWindowState = storage.get("restoreWindowState", true);
        if (restoreWindowState && windowState.isMaximized) {
            win.maximize();
        }
    });

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

    app.on("second-instance", (event, commandLine) => {
        if (win) {
            if (!win.isVisible()) win.show();
            if (win.isMinimized()) win.restore();
            win.focus();

            const secondInstanceArgs = parseCommandLineArgs(commandLine);
            if (secondInstanceArgs.showWelcome) {
                win.webContents.send("show-welcome");
            }
        }
    });

    app.isQuitting = false;

    win.on("resize", () => {
        if (!win.isMinimized()) {
            saveWindowState(win);
        }
    });

    win.on("move", () => {
        if (!win.isMinimized()) {
            saveWindowState(win);
        }
    });

    win.on("close", (e) => {
        if (!app.isQuitting) {
            e.preventDefault();
            saveWindowState(win);
            win.hide();
            return false;
        }
    });

    ipcMain.on("window-minimize", () => {
        win.minimize();
    });

    ipcMain.on("window-maximize", (_, order) => {
        if (order === "maximize") {
            win.maximize();
        } else if (order === "unmaximize") {
            win.unmaximize();
        } else {
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
        }
    });

    ipcMain.on("window-close", () => {
        win.hide();
    });

    ipcMain.on("quit-app", () => {
        app.isQuitting = true;
        app.quit();
    });

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

    win.on("minimize", () => {
        win.webContents.send("window-minimized");
    });

    win.on("restore", () => {
        win.webContents.send("window-restored");
    });

    ipcMain.on("login-success", async (event, data) => {
        try {
            const { cookies } = data;
            if (!cookies || cookies.length === 0) {
                throw new Error("未能获取到cookie");
            }

            saveCookies(cookies.join(";") + ';nbmusic_loginmode=qrcode');

            setBilibiliRequestCookie(cookies.join(";") + ';nbmusic_loginmode=qrcode');

            win.webContents.send("cookies-set", true);
        } catch (error) {
            console.error("登录失败:", error);
            win.webContents.send("cookies-set-error", error.message);
        }
    });

    ipcMain.on("open-dev-tools", () => {
        if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools();
        } else {
            win.webContents.openDevTools();
        }
    });

    ipcMain.on("open-dev-tools-request", (_, { devToolsEnabled }) => {
        if (devToolsEnabled || !app.isPackaged) {
            if (win.webContents.isDevToolsOpened()) {
                win.webContents.closeDevTools();
            } else {
                win.webContents.openDevTools();
            }
        }
    });

    ipcMain.on("get-cookies", async () => {
        win.webContents.send("get-cookies-success", loadCookies());
    });

    ipcMain.on("logout", async () => {
        storage.delete("cookies");
        win.webContents.send("logout-success");

        setBilibiliRequestCookie("");
    });

    ipcMain.handle("get-download-path", async () => {
        return app.getPath("downloads");
    });

    ipcMain.on("start-browser-auth-server", async () => {
        if (browserAuthServer === null) {
            browserAuthServer = https
                .createServer(
                    {
                        key: fs.readFileSync(path.join(__dirname, "..", "ssl", "privkey.pem")),
                        cert: fs.readFileSync(path.join(__dirname, "..", "ssl", "fullchain.pem"))
                    },
                    function (request, response) {
                        if (request.url === "/callback") {
                            let cookieString = request.headers.cookie + ";nbmusic_loginmode=browser";

                            saveCookies(cookieString);

                            setBilibiliRequestCookie(cookieString);

                            response.writeHead(200, { "Content-Type": "application/json" });
                            response.end(
                                JSON.stringify({
                                    status: 0,
                                    data: {
                                        isLogin: true,
                                        message: "登录成功"
                                    }
                                })
                            );

                            win.webContents.send("cookies-set", true);

                            browserAuthServer.close();
                            browserAuthServer = null;
                        } else if (request.url === "/background.png") {
                            response.writeHead(200, { "Content-Type": "image/png" });
                            response.end(fs.readFileSync(path.join(__dirname, "..", "img", "NB_Music.png")));
                        } else if (request.url === "/getUserInfo") {
                            axios
                                .get("https://api.bilibili.com/x/web-interface/nav", {
                                    headers: {
                                        Cookie: request.headers.cookie,
                                        Referer: "https://www.bilibili.com/",
                                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
                                    }
                                })
                                .then((res) => {
                                    const data = res.data.data;

                                    response.writeHead(200, { "Content-Type": "application/json" });
                                    if (data.isLogin) {
                                        response.end(
                                            JSON.stringify({
                                                status: 0,
                                                data: {
                                                    isLogin: true,
                                                    avatar: data.face,
                                                    name: data.uname,
                                                    mid: data.mid
                                                }
                                            })
                                        );
                                    } else {
                                        response.end(
                                            JSON.stringify({
                                                status: 0,
                                                data: {
                                                    isLogin: false
                                                }
                                            })
                                        );
                                    }
                                })
                                .catch((error) => {
                                    console.error("获取用户信息失败:", error);

                                    response.writeHead(500, { "Content-Type": "application/json" });
                                    response.end(
                                        JSON.stringify({
                                            status: -1,
                                            data: {
                                                message: "服务内部错误"
                                            }
                                        })
                                    );
                                });
                        } else if (request.url === "/favicon.ico") {
                            response.writeHead(200, { "Content-Type": "image/x-icon" });
                            response.end(fs.readFileSync(path.join(__dirname, "..", "icons", "icon.ico")));
                        } else {
                            response.writeHead(200, { "Content-Type": "text/html" });
                            response.end(fs.readFileSync(path.join(__dirname, "login.html")));
                        }
                    }
                )
                .listen(62687);
        }
    });

    ipcMain.on("close-browser-auth-server", async () => {
        if (browserAuthServer !== null) {
            browserAuthServer.close();
            browserAuthServer = null;
        }
    });

    ipcMain.on("set-restore-window-state", (event, value) => {
        storage.set("restoreWindowState", value);
    });

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
        if (!app.isPackaged) {
            BrowserWindow.getFocusedWindow()?.webContents.send("update-not-available", {
                message: "开发环境中无法检查更新"
            });
            return;
        }

        autoUpdater.checkForUpdates().catch((err) => {
            console.error("更新检查失败:", err);
            BrowserWindow.getFocusedWindow()?.webContents.send("update-error", err.message);
        });
    });

    ipcMain.on("install-update", () => {
        autoUpdater.quitAndInstall(true, true);
    });

    ipcMain.on("open-external-link", (_, url) => {
        shell.openExternal(url);
    });

    ipcMain.on("quit-application", () => {
        app.isQuitting = true;
        app.quit();
    });

    ipcMain.on("toggle-desktop-lyrics", (event, enabled) => {
        if (enabled) {
            createDesktopLyricsWindow();
        } else if (desktopLyricsWindow) {
            desktopLyricsWindow.close();
            desktopLyricsWindow = null;
        }
    });

    ipcMain.on("update-desktop-lyrics", (event, lyricsData) => {
        if (desktopLyricsWindow) {
            desktopLyricsWindow.webContents.send("update-desktop-lyrics", lyricsData);
        }
    });

    ipcMain.on("update-lyrics-style", (event, style) => {
        if (desktopLyricsWindow) {
            desktopLyricsWindow.webContents.send("update-lyrics-style", style);
        }
    });

    ipcMain.on("desktop-lyrics-toggle-play", () => {
        if (global.mainWindow) {
            global.mainWindow.webContents.send("desktop-lyrics-control", "toggle-play");
        }
    });

    ipcMain.on("desktop-lyrics-seek", (event, time) => {
        if (global.mainWindow) {
            global.mainWindow.webContents.send("desktop-lyrics-control", "seek", time);
        }
    });

    ipcMain.on("desktop-lyrics-update-style", (event, style) => {
        if (global.mainWindow) {
            global.mainWindow.webContents.send("desktop-lyrics-style-changed", style);
        }
    });

    ipcMain.on("desktop-lyrics-resize", (event, size) => {
        if (desktopLyricsWindow) {
            desktopLyricsWindow.setSize(size.width, size.height);
        }
    });

    ipcMain.on("desktop-lyrics-bg-color", () => {
        if (global.mainWindow) {
            global.mainWindow.webContents.send("show-lyrics-bg-color-picker");
        }
    });

    ipcMain.on("desktop-lyrics-ready", () => {
        if (global.mainWindow) {
            global.mainWindow.webContents.send("desktop-lyrics-ready");
        }
    });

    ipcMain.on("desktop-lyrics-toggle-pin", () => {
        if (desktopLyricsWindow) {
            const isAlwaysOnTop = desktopLyricsWindow.isAlwaysOnTop();
            desktopLyricsWindow.setAlwaysOnTop(!isAlwaysOnTop);
            if (global.mainWindow) {
                global.mainWindow.webContents.send("desktop-lyrics-pin-changed", !isAlwaysOnTop);
            }
        }
    });

    ipcMain.on("desktop-lyrics-font-size", () => {
        if (global.mainWindow) {
            global.mainWindow.webContents.send("open-lyrics-font-settings");
        }
    });

    ipcMain.on("desktop-lyrics-settings", () => {
        if (global.mainWindow) {
            global.mainWindow.webContents.send("open-lyrics-settings");
            global.mainWindow.focus();
        }
    });

    ipcMain.on("desktop-lyrics-close", () => {
        if (desktopLyricsWindow) {
            desktopLyricsWindow.close();
            desktopLyricsWindow = null;
        }
    });

    ipcMain.on("force-sync-desktop-lyrics", () => {
        if (global.mainWindow && desktopLyricsWindow) {
            global.mainWindow.webContents.send("request-lyrics-sync");
        }
    });

    ipcMain.handle("get-restore-window-state", () => {
        return storage.get("restoreWindowState", true);
    });
}

app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");

function setBilibiliRequestCookie(cookieString) {
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        if (details.url.includes("bilibili.com") || details.url.includes("bilivideo.cn") || details.url.includes("bilivideo.com") || details.url.includes("akamaized.net")) {
            details.requestHeaders["Cookie"] = cookieString;
            details.requestHeaders["Referer"] = "https://www.bilibili.com/";
            details.requestHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
        }
        callback({ requestHeaders: details.requestHeaders });
    });
}
