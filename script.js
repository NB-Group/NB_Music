"use strict";
const { ipcRenderer, shell } = require("electron");
const AudioPlayer = require("./javascript/AudioPlayer.js");
const LyricsPlayer = require("./javascript/LyricsPlayer.js");
const UIManager = require("./javascript/UIManager.js");
const PlaylistManager = require("./javascript/PlaylistManager.js");
const FavoriteManager = require("./javascript/FavoriteManager.js");
const MusicSearcher = require("./javascript/MusicSearcher.js");
const SettingManager = require("./javascript/SettingManager.js");
const MusiclistManager = require("./javascript/MusiclistManager.js");
const CacheManager = require("./javascript/CacheManager.js");
const LoginManager = require("./javascript/LoginManager.js");
const UpdateManager = require("./javascript/UpdateManager.js");
const LocalImportManager = require("./javascript/LocalImportManager");
const VideoPlayerManager = require("./javascript/VideoPlayerManager");
const EffectManager = require("./javascript/EffectManager.js");
const VolumeControlManager = require("./javascript/VolumeControlManager.js");

class App {
    constructor() {
        try {
            this.initializecomponents();
            this.loadSavedData();
            this.setupInitialUI();
            this.setupEventListeners();
            this.setupCommandLineHandlers();
        } catch (error) {
            console.error("应用初始化失败:", error);
            // 显示友好的错误消息给用户
            this.showErrorMessage("应用初始化失败，请尝试重启应用。");
        }
    }

    initializecomponents() {
        try {
            // 1. 创建基础组件
            this.settingManager = new SettingManager();
            this.audioPlayer = new AudioPlayer(null); // 暂时传入null
            this.lyricsPlayer = new LyricsPlayer("暂无歌词，尽情欣赏音乐", this.audioPlayer.audio, this.settingManager);
            this.volumeControl = new VolumeControlManager(this.settingManager, this.audioPlayer);

            // 2. 创建其他必要组件
            this.playlistManager = new PlaylistManager(this.audioPlayer, this.lyricsPlayer, null); // uiManager临时为null

            // 3. 创建UI管理器（需要播放列表管理器）
            this.uiManager = new UIManager(
                this.settingManager,
                this.audioPlayer,
                this.playlistManager, // 已初始化
                null, // favoriteManager临时为null
                null // musicSearcher临时为null
            );

            // 4. 创建其他依赖UI管理器的组件
            this.favoriteManager = new FavoriteManager(this.playlistManager, this.uiManager);
            this.musicSearcher = new MusicSearcher();
            this.musiclistManager = new MusiclistManager(this.playlistManager);
            this.cacheManager = new CacheManager();
            this.loginManager = new LoginManager(this.uiManager);
            this.updateManager = new UpdateManager();
            this.localImportManager = new LocalImportManager(this.playlistManager, this.uiManager);
            this.videoPlayerManager = new VideoPlayerManager(this.playlistManager, this.uiManager);
            this.effectManager = new EffectManager(this.audioPlayer, this.settingManager);

            // 5. 更新所有组件间的引用关系
            this.audioPlayer.playlistManager = this.playlistManager;
            this.audioPlayer.uimanager = this.uiManager;
            this.playlistManager.uiManager = this.uiManager;
            this.uiManager.playlistManager = this.playlistManager;
            this.uiManager.favoriteManager = this.favoriteManager;
            this.uiManager.musicSearcher = this.musicSearcher;
            this.uiManager.lyricsPlayer = this.lyricsPlayer;
            this.musicSearcher.uiManager = this.uiManager;
            this.musicSearcher.playlistManager = this.playlistManager;
            this.musicSearcher.favoriteManager = this.favoriteManager;
            this.playlistManager.settingManager = this.settingManager;
            this.playlistManager.musicSearcher = this.musicSearcher;
            this.playlistManager.musiclistManager = this.musiclistManager;
            this.musicSearcher.settingManager = this.settingManager;
            this.playlistManager.cacheManager = this.cacheManager;
            this.musiclistManager.uiManager = this.uiManager;
            this.musiclistManager.musicSearcher = this.musicSearcher;
            this.musiclistManager.audioPlayer = this.audioPlayer;

            // 6. 暴露全局引用
            window.app = this;

            // 7. 初始化完成后建立组件间依赖关系
            this.setupDependencies();
        } catch (error) {
            console.error("组件初始化失败:", error);
            throw error; // 向上传递错误
        }
    }

    // 显示错误消息的方法
    showErrorMessage(message) {
        // 创建错误消息元素
        const errorDiv = document.createElement("div");
        errorDiv.style.position = "fixed";
        errorDiv.style.top = "50%";
        errorDiv.style.left = "50%";
        errorDiv.style.transform = "translate(-50%, -50%)";
        errorDiv.style.background = "rgba(220, 53, 69, 0.9)";
        errorDiv.style.color = "white";
        errorDiv.style.padding = "20px";
        errorDiv.style.borderRadius = "8px";
        errorDiv.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
        errorDiv.style.zIndex = "9999";
        errorDiv.innerHTML = `<h3>错误</h3><p>${message}</p><button id="reload-btn">重新加载</button>`;

        // 添加到文档
        document.body.appendChild(errorDiv);

        // 添加重新加载按钮事件
        document.getElementById("reload-btn").addEventListener("click", () => {
            window.location.reload();
        });
    }

    setupDependencies() {
        // 确保SettingManager能访问PlaylistManager
        if (this.settingManager && this.playlistManager) {
            this.settingManager.playlistManager = this.playlistManager;
        }

        // 确保MusicSearcher能获取设置信息
        if (this.musicSearcher && this.settingManager) {
            this.musicSearcher.setDependencies(this.settingManager);
        }

        // 可能需要添加其他组件间的依赖
        // ...
    }

    loadSavedData() {
        try {
            // 检查必要的组件是否存在
            if (this.playlistManager) {
                // 加载保存的播放列表
                this.playlistManager.loadPlaylists();
            }

            if (this.favoriteManager) {
                // 加载保存的收藏列表
                this.favoriteManager.loadFavorites();
            }

            // 检查并应用保存的主题设置
            const savedTheme = localStorage.getItem("theme");
            if (savedTheme === "dark") {
                this.uiManager?.toggleTheme();
            }

            // 检查是否首次使用
            if (this.uiManager) {
                this.uiManager.checkFirstUse();
            }
        } catch (error) {
            console.error("加载保存的数据失败:", error);
        }
    }

    setupInitialUI() {
        try {
            // 隐藏加载动画
            setTimeout(() => {
                document.querySelector(".loading").style.opacity = "0";
            }, 1000);
            setTimeout(() => {
                document.querySelector(".loading").style.display = "none";
            }, 2000);

            // 渲染播放列表
            this.uiManager.renderPlaylist();

            // 打开播放器界面
            document.querySelector("#function-list .player").click();

            // 设置默认播放
            if (this.playlistManager.playlist.length > 0) {
                // 使用保存的播放索引
                const index = this.playlistManager.playingNow || 0;
                // 不重置进度
                this.playlistManager.setPlayingNow(index, false);
                this.uiManager.renderPlaylist();
            }

            // 初始状态下视频按钮应显示为禁用
            const playVideoBtn = document.getElementById("playVideoBtn");
            if (playVideoBtn) {
                playVideoBtn.classList.add("disabled");
                playVideoBtn.setAttribute("title", "无可用视频");
                playVideoBtn.innerHTML = '<i class="bi bi-film-slash"></i>';
            }
        } catch (error) {
            console.error("初始UI设置失败:", error);
        }
    }

    setupEventListeners() {
        // 添加播放歌曲变更事件监听器，用于更新视频按钮状态
        this.audioPlayer.audio.addEventListener("play", async () => {
            // 当歌曲开始播放时，检查并更新视频按钮状态
            await this.videoPlayerManager.updateVideoButtonState();
        });

        // 添加清除缓存按钮事件监听
        document.getElementById("clearCache")?.addEventListener("click", () => {
            this.cacheManager.clearCache();
            this.uiManager.showNotification("缓存已清除", "success");
        });

        // 链接点击处理
        document.getElementById("github-link")?.addEventListener("click", (e) => {
            e.preventDefault();
            ipcRenderer.send("open-external-link", "https://github.com/NB-Group/nb-music");
        });

        document.getElementById("report-bug")?.addEventListener("click", (e) => {
            e.preventDefault();
            ipcRenderer.send("open-external-link", "https://github.com/NB-Group/nb-music/issues/new");
        });

        document.getElementById("open-welcome")?.addEventListener("click", (e) => {
            e.preventDefault();
            this.uiManager.showWelcomeDialog();
        });

        // 检查更新
        document.getElementById("check-update")?.addEventListener("click", async (e) => {
            e.preventDefault();
            const updateContainer = document.getElementById("update-container");
            if (updateContainer) {
                updateContainer.classList.remove("hide");
            }
            ipcRenderer.send("check-for-updates");
        });

        // 更新按钮事件
        document.getElementById("update-later")?.addEventListener("click", () => {
            document.getElementById("update-container").classList.add("hide");
        });

        document.getElementById("update-now")?.addEventListener("click", () => {
            ipcRenderer.send("install-update");
        });

        // 关闭更新窗口
        document.querySelector("#update-container")?.addEventListener("click", (e) => {
            if (e.target.id === "update-container") {
                document.getElementById("update-container").classList.add("hide");
            }
        });

        // 设置更新相关事件监听
        this.setupUpdateEvents();
    }

    setupUpdateEvents() {
        // 更新相关事件监听
        ipcRenderer.on("update-available", () => {
            document.getElementById("update-status").textContent = "有新版本可用";
            document.getElementById("update-actions").classList.remove("hide");
        });

        ipcRenderer.on("update-not-available", () => {
            document.getElementById("update-status").textContent = "当前已是最新版本";
            setTimeout(() => {
                document.getElementById("update-container").classList.add("hide");
            }, 2000);
        });

        ipcRenderer.on("update-error", (event, error) => {
            document.getElementById("update-status").textContent = `更新检查失败: ${error}`;
            setTimeout(() => {
                document.getElementById("update-container").classList.add("hide");
            }, 3000);
        });

        ipcRenderer.on("download-progress", (event, percent) => {
            document.getElementById("update-progress").classList.remove("hide");
            document.getElementById("progress-percent").textContent = `${Math.round(percent)}%`;
            document.getElementById("progress-inner").style.width = `${percent}%`;
        });

        ipcRenderer.on("update-downloaded", () => {
            document.getElementById("update-status").textContent = "更新已下载完成，准备安装";
            document.getElementById("update-now").textContent = "立即安装";
        });

        // 字体加载
        ipcRenderer.on("get-font-family", (event, fontFamily) => {
            document.documentElement.style.setProperty("--font-family", fontFamily);
        });

        // 获取版本信息
        ipcRenderer.invoke("get-app-version").then((version) => {
            document.getElementById("app-version").textContent = version;
        });
    }

    setupCommandLineHandlers() {
        // 监听主进程传来的命令行参数
        ipcRenderer.on("command-line-args", (_, args) => {
            if (args.showWelcome) {
                this.uiManager.showWelcomeDialog();
            }
        });
    }
}

// 当DOM加载完成后初始化应用
document.addEventListener("DOMContentLoaded", async () => {
    try {
        new App();
    } catch (error) {
        console.error("应用初始化失败:", error);
    }
});
