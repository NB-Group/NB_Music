const { ipcRenderer } = require("electron");
const { extractMusicTitle } = require("../utils.js");

class UIManager {
    /**
     * 用户界面管理组件
     * @param {import("./SettingManager.js")} settingManager
     * @param {import("./AudioPlayer.js")} audioPlayer
     * @param {import("./PlaylistManager.js")} playlistManager
     * @param {import("./FavoriteManager.js")} favoriteManager
     * @param {import("./MusicSearcher.js")} musicSearcher
     */
    constructor(settingManager, audioPlayer, playlistManager, favoriteManager, musicSearcher) {
        this.audioPlayer = audioPlayer;
        this.playlistManager = playlistManager;
        this.favoriteManager = favoriteManager;
        this.musicSearcher = musicSearcher;
        this.selectedSuggestionIndex = -1;
        this.isMaximized = false;
        this.settingManager = settingManager;
        this.minimizeBtn = document.getElementById("maximize");

        // 确保设置管理器先初始化
        if (this.audioPlayer) {
            this.audioPlayer.setSettingManager(settingManager);
            // 添加延迟确保设置生效
            setTimeout(() => {
                const volume = settingManager.getSetting("volume") / 100;
                this.audioPlayer.audio.volume = volume;
            }, 100);
        }

        this.initializeEvents();
        this.initializePlayerControls();
        this.initializePageEvents();
        this.initializeSettings();
        this.initializeAdvancedControls();
        this.initializeSearchSuggestions();
        this.initializeCustomSelects();
        this.initializeWelcomeDialog();
        this.initializeTrayControls();
        this.initializeAnimations(); // 新增动画初始化
        this.autoMaximize();
    }
    initializeSearchSuggestions() {
        const searchInput = document.querySelector(".search input");
        if (!searchInput) return;

        const suggestionContainer = document.createElement("div");
        suggestionContainer.classList.add("suggestions");
        document.querySelector(".loading").parentNode.appendChild(suggestionContainer);

        let selectedIndex = -1;
        let suggestions = [];
        let debounceTimer;

        // 辅助方法：清除搜索建议
        const clearSuggestions = () => {
            suggestionContainer.innerHTML = "";
            suggestionContainer.classList.remove("active");
            suggestions = [];
            selectedIndex = -1;
        };

        searchInput.addEventListener("input", async (e) => {
            clearTimeout(debounceTimer);
            selectedIndex = -1;
            const term = e.target.value.trim();

            if (!term) {
                clearSuggestions();
                return;
            }

            debounceTimer = setTimeout(async () => {
                suggestions = await this.musicSearcher.getSearchSuggestions(term);
                if (!suggestions.length) {
                    clearSuggestions();
                } else {
                    suggestionContainer.innerHTML = suggestions
                        .map(
                            (s) => `
                            <div class="suggestion-item" data-term="${s.value}">
                                ${s.name}
                            </div>
                        `
                        )
                        .join("");
                    suggestionContainer.classList.add("active");
                }
            }, 20);
        });

        // 键盘事件处理
        searchInput.addEventListener("keydown", (e) => {
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    selectedIndex = (selectedIndex + 1) % suggestions.length;
                    updateSelection();
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    selectedIndex = selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1;
                    updateSelection();
                    break;
                case "Enter":
                    e.preventDefault();
                    if (selectedIndex >= 0) {
                        // 选中建议项
                        searchInput.value = suggestions[selectedIndex].value;
                        // 触发搜索
                        this.handleSearch();
                    } else {
                        // 直接搜索输入内容
                        this.handleSearch();
                    }
                    // 无论是哪种情况，都清除搜索建议
                    clearSuggestions();
                    break;
                case "Escape":
                    clearSuggestions();
                    break;
            }
        });

        // 更新选中状态
        const updateSelection = () => {
            const items = suggestionContainer.querySelectorAll(".suggestion-item");
            items.forEach((item, index) => {
                if (index === selectedIndex) {
                    item.classList.add("selected");
                } else {
                    item.classList.remove("selected");
                }
            });
        };

        // 点击建议项
        suggestionContainer.addEventListener("click", (e) => {
            const item = e.target.closest(".suggestion-item");
            if (item) {
                searchInput.value = item.dataset.term;
                clearSuggestions();
                this.handleSearch();
            }
        });

        // 点击外部关闭建议框
        document.addEventListener("click", (e) => {
            if (!suggestionContainer.contains(e.target) && e.target !== searchInput) {
                clearSuggestions();
            }
        });
    }
    initializeAdvancedControls() {
        // 替换原有的速度选择下拉框实现
        const speedControl = document.querySelector(".speed-control");
        if (speedControl) {
            this.createCustomSelect(
                speedControl,
                [
                    { value: "0.5", text: "0.5x" },
                    { value: "1", text: "1x", selected: true },
                    { value: "1.25", text: "1.25x" },
                    { value: "1.5", text: "1.5x" },
                    { value: "2", text: "2x" }
                ],
                (value) => {
                    this.audioPlayer.audio.playbackRate = parseFloat(value);
                }
            );
        }

        // 为自定义速度选择下拉框添加事件监听
        const speedControlWrapper = document.querySelector(".speed-control-wrapper");
        if (speedControlWrapper) {
            const selectItems = speedControlWrapper.querySelectorAll(".select-item");
            const selectSelected = speedControlWrapper.querySelector(".select-selected");

            // 点击选中区域时切换下拉框显示状态
            selectSelected.addEventListener("click", (e) => {
                e.stopPropagation();

                // 关闭其他所有已打开的下拉框
                document.querySelectorAll(".select-selected.open").forEach((el) => {
                    if (el !== selectSelected) {
                        el.classList.remove("open");
                        el.nextElementSibling.classList.remove("open");
                    }
                });

                // 切换当前下拉框状态
                selectSelected.classList.toggle("open");
                selectSelected.nextElementSibling.classList.toggle("open");
            });

            // 为每个选项添加点击事件
            selectItems.forEach((item) => {
                item.addEventListener("click", (e) => {
                    e.stopPropagation();

                    // 更新UI
                    selectItems.forEach((el) => el.classList.remove("selected"));
                    item.classList.add("selected");
                    selectSelected.textContent = item.textContent;

                    // 关闭下拉框
                    selectSelected.classList.remove("open");
                    selectSelected.nextElementSibling.classList.remove("open");

                    // 设置播放速度
                    const value = item.dataset.value;
                    if (value && this.audioPlayer) {
                        this.audioPlayer.audio.playbackRate = parseFloat(value);
                    }
                });
            });

            // 点击页面其他区域时关闭下拉框
            document.addEventListener("click", () => {
                selectSelected.classList.remove("open");
                selectSelected.nextElementSibling.classList.remove("open");
            });
        }

        const downloadBtn = document.querySelector(".download");
        downloadBtn?.addEventListener("click", async () => {
            try {
                const currentSong = this.playlistManager.playlist[this.playlistManager.playingNow];
                if (!currentSong) {
                    this.showNotification("没有可下载的音乐", "error");
                    return;
                }

                // 显示加载提示
                this.showNotification("正在准备下载...", "info");

                // 获取最新的音频URL
                const audioUrl = currentSong.audio;
                if (!audioUrl) {
                    throw new Error("无法获取音频链接");
                }

                // 使用 fetch 下载音频文件
                const response = await fetch(audioUrl);
                if (!response.ok) {
                    throw new Error("下载失败");
                }

                // 获取音频数据
                const blob = await response.blob();

                // 创建下载链接
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                // 清理文件名，移除非法字符
                const fileName = currentSong.title.replace(/[<>:"/\\|?*]+/g, "_");
                a.download = `${fileName}.m4a`; // 使用 .m4a 扩展名
                a.href = url;

                // 触发下载
                document.body.appendChild(a);
                a.click();

                // 清理
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                this.showNotification("开始下载音乐", "success");
            } catch (error) {
                console.error("下载失败:", error);
                this.showNotification("下载失败: " + error.message, "error");
            }
        });
    }
    initializeSettings() {
        // 监听歌词显示设置变更
        this.settingManager.addListener("lyricsEnabled", (newValue) => {
            if (this.audioPlayer && this.audioPlayer.lyricsPlayer) {
                this.audioPlayer.lyricsPlayer.setVisibility(newValue === "true");
            }

            const lyricsContainer = document.getElementById("lyrics-container");
            if (lyricsContainer) {
                if (newValue === "true") {
                    lyricsContainer.style.display = "block";

                    // 延迟一点时间，确保DOM更新后再刷新布局
                    setTimeout(() => {
                        if (this.audioPlayer && this.audioPlayer.lyricsPlayer) {
                            this.audioPlayer.lyricsPlayer.refreshLayout();
                        }
                    }, 100);
                } else {
                    lyricsContainer.style.display = "none";
                }
            }
        });

        // 监听循环歌词同步设置变更
        this.settingManager.addListener("loopLyricsEnabled", () => {
            // 如果有活跃的歌词播放器，尝试重新检测循环
            if (this.audioPlayer && this.audioPlayer.lyricsPlayer) {
                // 清除现有检测状态
                this.audioPlayer.lyricsPlayer.isLoopDetected = false;
                this.audioPlayer.lyricsPlayer.originalSongDuration = null;

                // 重新检测
                setTimeout(() => {
                    this.audioPlayer.lyricsPlayer.detectLoopSong();
                }, 500);
            }
        });

        // 应用默认设置
        const lyricsEnabled = this.settingManager.getSetting("lyricsEnabled");
        if (lyricsEnabled === "true" || lyricsEnabled === true) {
            if (document.getElementById("lyrics-container")) {
                document.getElementById("lyrics-container").style.display = "block";
            }
        } else {
            if (document.getElementById("lyrics-container")) {
                document.getElementById("lyrics-container").style.display = "none";
            }
        }

        // 主题切换事件
        this.settingManager.addListener("theme", (newValue) => {
            document.documentElement.setAttribute("data-theme", newValue);
        });

        // 背景切换事件
        this.settingManager.addListener("background", async (newValue, oldValue) => {
            if (newValue === "none") {
                const oldVideo = document.querySelector("video");
                if (oldVideo) oldVideo.remove();
                document.querySelector("html").style.removeProperty("--bgul");
            }
            if (newValue === "cover") {
                const oldVideo = document.querySelector("video");
                if (oldVideo) oldVideo.remove();
                const savedPlaylist = localStorage.getItem("nbmusic_playlist");
                const currentSong = JSON.parse(savedPlaylist)[localStorage.getItem("nbmusic_playing_now") || 0];
                document.querySelector("html").style.setProperty("--bgul", `url(${currentSong.poster})`);
            }
            if (newValue === "video" && oldValue !== "video") {
                // 移除旧视频
                const oldVideo = document.querySelector("video");
                if (oldVideo) oldVideo.remove();
                const savedPlaylist = localStorage.getItem("nbmusic_playlist");

                const currentSong = JSON.parse(savedPlaylist)[localStorage.getItem("nbmusic_playing_now") || 0];
                const videoUrl = currentSong.video;
                if (videoUrl) {
                    const video = document.createElement("video");
                    video.autoplay = true;
                    video.loop = true;
                    video.muted = true;
                    video.style.position = "absolute";
                    video.style.width = "100%";
                    video.style.height = "100%";
                    video.style.zIndex = "-1";
                    video.style.bottom = "0";
                    video.style.objectFit = "cover";
                    video.src = videoUrl;

                    document.querySelector("body").appendChild(video);
                }
            }
        });
        this.settingManager.addListener("extractTitle", () => {
            this.renderPlaylist();
        });

        // 桌面歌词相关设置监听
        this.settingManager.addListener("desktopLyricsEnabled", (newValue) => {
            if (this.lyricsPlayer) {
                if (newValue === "true") {
                    if (!this.lyricsPlayer.desktopLyricsEnabled) {
                        this.lyricsPlayer.toggleDesktopLyrics();
                    }
                } else {
                    if (this.lyricsPlayer.desktopLyricsEnabled) {
                        this.lyricsPlayer.toggleDesktopLyrics();
                    }
                }
            }
        });

        this.settingManager.addListener("desktopLyricsFontSize", () => {
            if (this.lyricsPlayer && this.lyricsPlayer.desktopLyricsEnabled) {
                this.lyricsPlayer.updateDesktopLyricsStyle();
            }
        });

        this.settingManager.addListener("desktopLyricsOpacity", () => {
            if (this.lyricsPlayer && this.lyricsPlayer.desktopLyricsEnabled) {
                this.lyricsPlayer.updateDesktopLyricsStyle();
            }
        });

        // 监听歌词来源设置变更
        this.settingManager.addListener("lyricSource", async (newValue) => {
            // 如果有当前播放的歌曲，则重新获取歌词并更新显示
            if (this.audioPlayer && this.audioPlayer.lyricsPlayer && this.playlistManager) {
                const currentSong = this.playlistManager.playlist[this.playlistManager.playingNow];
                if (currentSong) {
                    try {
                        // 显示加载状态
                        const progressBar = document.querySelector(".progress-bar-inner");
                        progressBar.classList.add("loading");

                        // 根据新的歌词来源重新获取歌词
                        const newLyrics = await this.musicSearcher.getLyrics(currentSong.title, currentSong.bvid, currentSong.cid, newValue);

                        // 更新歌词显示
                        if (this.audioPlayer.lyricsPlayer) {
                            this.audioPlayer.lyricsPlayer.changeLyrics(newLyrics);
                        }

                        // 隐藏加载状态
                        progressBar.classList.remove("loading");

                        // 显示通知
                        let sourceText = "未知来源";
                        if (newValue === "netease") sourceText = "网易云歌词";
                        else if (newValue === "bilibili") sourceText = "B站字幕";
                        else if (newValue === "smart") sourceText = "智能获取";
                        
                        this.showNotification(`歌词来源已切换为${sourceText}`, "success");
                    } catch (error) {
                        console.error("切换歌词来源失败:", error);
                        this.showNotification("切换歌词来源失败，请重试", "error");

                        // 隐藏加载状态
                        const progressBar = document.querySelector(".progress-bar-inner");
                        progressBar.classList.remove("loading");
                    }
                }
            }
        });

        const settingContainer = document.querySelector(".content>.setting");
        settingContainer.addEventListener("click", (e) => {
            const setting = e.target;
            if (setting.dataset.key) {
                this.settingManager.setSetting(setting.dataset.key, setting.dataset.value);
            }
        });
        const settings = this.settingManager.settings;
        Object.keys(settings).forEach((key) => {
            const value = settings[key];
            const element = settingContainer.querySelector(`[data-key="${key}"][data-value="${value}"]`);
            if (element) {
                element.click();
            }
        });
    }
    initializePlayerControls() {
        // 进度条控制
        const progressBar = document.querySelector(".progress-bar");
        progressBar?.addEventListener("click", (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            this.audioPlayer.audio.currentTime = percent * this.audioPlayer.audio.duration;
        });
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress = (this.audioPlayer.audio.currentTime / this.audioPlayer.audio.duration) * 100;
            document.querySelector(".progress-bar-inner").style.width = `${progress}%`;
        });

        // 播放时更新进度条
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress = (this.audioPlayer.audio.currentTime / this.audioPlayer.audio.duration) * 100;
            document.querySelector(".progress-bar-inner").style.width = `${progress}%`;
        });

        // 播放控制按钮（使用事件委托）
        const buttonsContainer = document.querySelector(".buttons");
        buttonsContainer?.addEventListener("click", (e) => {
            const button = e.target.closest("[data-action]");
            if (!button) return;

            const action = button.dataset.action;
            switch (action) {
                case "play":
                    this.audioPlayer.play();
                    break;
                case "prev":
                    this.audioPlayer.prev();
                    break;
                case "next":
                    this.audioPlayer.next();
                    break;
            }
        });

        // 播放状态图标更新
        this.audioPlayer.audio.addEventListener("play", () => {
            document.querySelector(".control>.buttons>.play").classList = "play played";
        });

        this.audioPlayer.audio.addEventListener("pause", () => {
            document.querySelector(".control>.buttons>.play").classList = "play paused";
        });
    }

    initializePageEvents() {
        // 获取所有可点击导航元素
        const navElements = document.querySelectorAll("[data-page]");

        navElements.forEach((element) => {
            element.addEventListener("click", (e) => {
                e.preventDefault();
                this.show(element.dataset.page);
            });
        });
    }

    // 页面切换方法
    show(pageName) {
        // 隐藏所有内容
        const contents = document.querySelectorAll(".content>div");
        contents.forEach((content) => content.classList.add("hide"));

        // 移除所有导航项的选中状态
        const navItems = document.querySelectorAll("#function-list>a");
        navItems.forEach((item) => item.classList.remove("check"));

        // 显示目标内容
        const targetContent = document.querySelector(`.content ${pageName}`);
        if (targetContent) {
            targetContent.classList.remove("hide");

            // 如果切换到播放器页面，刷新歌词布局
            if (pageName === ".player" && this.audioPlayer && this.audioPlayer.lyricsPlayer) {
                // 延迟一点时间确保DOM已完全显示
                setTimeout(() => {
                    // 刷新布局并确保如果音乐在播放，动画会自动启动
                    this.audioPlayer.lyricsPlayer.refreshLayout();

                    // 如果音频正在播放但动画没有运行，明确启动它
                    if (!this.audioPlayer.audio.paused && !this.audioPlayer.lyricsPlayer.animationFrame) {
                        this.audioPlayer.lyricsPlayer.start();
                    }
                }, 100);
            }
        }

        // 设置导航项选中状态
        const targetNav = document.querySelector(`#function-list ${pageName}`);
        if (targetNav) {
            targetNav.classList.add("check");
        }
    }

    initializeEvents() {
        document.querySelector(".listname .controls .playmode").addEventListener("click", (e) => {
            e.stopPropagation();
            this.playlistManager.togglePlayMode();
        });

        window.addEventListener("keydown", (e) => {
            // F12 打开开发者工具
            if (e.key === "F12") {
                // 检查是否启用了DevTools
                const devToolsEnabled = this.settingManager.getSetting("devToolsEnabled");
                if (devToolsEnabled === "true" || devToolsEnabled === true) {
                    ipcRenderer.send("open-dev-tools-request", { devToolsEnabled: true });
                }
            }

            // 空格键控制播放/暂停
            if (e.key === " " && e.target.tagName !== "INPUT") {
                // 避免在输入框中按空格触发
                e.preventDefault(); // 阻止页面滚动
                this.audioPlayer.play();
            }
        });

        // 窗口控制按钮
        document.getElementById("minimize").addEventListener("click", () => {
            ipcRenderer.send("window-minimize");
        });

        document.getElementById("maximize").addEventListener("click", () => {
            ipcRenderer.send("window-maximize");
        });

        document.getElementById("close").addEventListener("click", () => {
            ipcRenderer.send("window-close");
        });

        ipcRenderer.on("window-state-changed", (event, maximized) => {
            this.isMaximized = maximized;
            if (this.isMaximized) {
                this.minimizeBtn.innerHTML = `<svg version="1.1" width="12" height="12" viewBox="0,0,37.65105,35.84556" style="margin-top:1px;"><g transform="translate(-221.17804,-161.33903)"><g style="stroke:var(--text);" data-paper-data="{&quot;isPaintingLayer&quot;:true}" fill="none" fill-rule="nonzero" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0"><path d="M224.68734,195.6846c-2.07955,-2.10903 -2.00902,-6.3576 -2.00902,-6.3576l0,-13.72831c0,0 -0.23986,-1.64534 2.00902,-4.69202c1.97975,-2.68208 4.91067,-2.00902 4.91067,-2.00902h14.06315c0,0 3.77086,-0.23314 5.80411,1.67418c2.03325,1.90732 1.33935,5.02685 1.33935,5.02685v13.39347c0,0 0.74377,4.01543 -1.33935,6.3576c-2.08312,2.34217 -5.80411,1.67418 -5.80411,1.67418h-13.39347c0,0 -3.50079,0.76968 -5.58035,-1.33935z"></path><path d="M229.7952,162.85325h16.06111c0,0 5.96092,-0.36854 9.17505,2.64653c3.21412,3.01506 2.11723,7.94638 2.11723,7.94638v18.55642"></path></g></g></svg>`;
            } else {
                this.minimizeBtn.innerHTML = '<i class="bi bi-app"></i>';
            }
        });

        // 音频进度条
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress = (this.audioPlayer.audio.currentTime / this.audioPlayer.audio.duration) * 100;
            document.querySelector(".player .control .progress .progress-bar .progress-bar-inner").style.width = progress + "%";
        });

        // 进度条点击
        document.querySelector(".player .control .progress .progress-bar").addEventListener("click", (event) => {
            const progressBar = event.currentTarget;
            const clickPosition = event.offsetX;
            const progressBarWidth = progressBar.offsetWidth;
            const progress = (clickPosition / progressBarWidth) * this.audioPlayer.audio.duration;
            this.audioPlayer.audio.currentTime = progress;
        });

        // 侧边栏点击事件
        document.addEventListener("dblclick", (event) => {
            if (!event.target.closest(".sidebar") && !event.target.closest(".dock.sidebar") && this.settingManager.getSetting("hideSidebar") === "true") {
                document.querySelector(".sidebar").style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.04, 0.92, 0.4, 0.97)";
                document.querySelector(".sidebar").parentElement.style.gridTemplateColumns = "0 auto";
                document.querySelector(".sidebar").style.opacity = "0";
                // document.querySelector(".sidebar").style.display = "none";
            }
            if (!event.target.closest(".titbar") && this.settingManager.getSetting("hideTitbar") === "true") {
                document.querySelectorAll(".titbar .fadein").forEach((fadeItem) => {
                    fadeItem.classList.add("fadeout");
                });
            }
        });

        document.querySelectorAll(".fadein").forEach((fadeItem) => {
            fadeItem.addEventListener("mouseover", () => {
                fadeItem.classList.remove("fadeout");
            });
        });

        // 专为侧边栏设计

        window.addEventListener("mousemove", (e) => {
            if (this.settingManager.getSetting("hideSidebar") == "true") {
                if (e.clientX < 260 && document.querySelector(".sidebar").style.opacity == "0") {
                    document.querySelector(".sidebar").style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.88, 0.01, 0.95, 0.09)";
                    document.querySelector(".sidebar").parentElement.style.gridTemplateColumns = "260px auto";
                    document.querySelector(".sidebar").style.opacity = "1";
                }
            }
        });

        // 列表焦点效果
        document.querySelectorAll("#function-list").forEach((list) => {
            list.addEventListener("click", (e) => {
                const clickedItem = e.target.closest("a");
                if (!clickedItem) return;

                const spanFocs = list.querySelector("span.focs");
                if (!spanFocs) return;

                // 移除之前的所有选中状态
                list.querySelectorAll("a").forEach((a) => a.classList.remove("check"));
                // 添加新的选中状态
                clickedItem.classList.add("check");

                // 显示焦点指示器
                spanFocs.style.display = "block";
                spanFocs.classList.add("moving");

                // 设置位置 - 不再使用 transform，直接设置 top
                if (spanFocs.dataset.type === "abs") {
                    spanFocs.style.top = clickedItem.offsetTop + 9 + "px";
                } else {
                    spanFocs.style.top = clickedItem.offsetTop + 9 + "px";
                    spanFocs.style.left = clickedItem.offsetLeft + 5 + "px";
                }

                setTimeout(() => {
                    spanFocs.classList.remove("moving");
                }, 500);
            });
        });

        document.querySelectorAll("nav").forEach((nav) => {
            // 生成唯一标识
            const navId = nav.dataset.navId || `nav-${Math.random().toString(36).slice(2, 6)}`;
            nav.dataset.navId = navId;

            nav.querySelectorAll("a").forEach((link) => {
                // 添加波纹效果处理
                link.addEventListener("mousedown", function (e) {
                    // 创建波纹元素
                    const ripple = document.createElement("span");
                    ripple.classList.add("ripple-effect");

                    // 计算最大尺寸
                    const size = Math.max(this.offsetWidth, this.offsetHeight);
                    ripple.style.width = ripple.style.height = `${size * 2}px`;

                    // 定位波纹
                    const rect = this.getBoundingClientRect();
                    ripple.style.left = `${e.clientX - rect.left - size}px`;
                    ripple.style.top = `${e.clientY - rect.top - size}px`;

                    // 添加波纹元素
                    this.appendChild(ripple);

                    // 动画结束后移除
                    setTimeout(() => ripple.remove(), 600);
                });

                link.addEventListener("click", async (e) => {
                    e.preventDefault();

                    // 检查浏览器是否支持 View Transitions API
                    if (!document.startViewTransition) {
                        console.warn("Browser does not support View Transitions API");
                        // 降级处理
                        const activeLink = nav.querySelector(".active");
                        activeLink?.classList.remove("active");
                        link.classList.add("active");
                        return;
                    }

                    // 避免重复点击
                    if (link.classList.contains("active")) return;

                    const activeLink = nav.querySelector(".active");

                    try {
                        // 设置动态 view-transition-name
                        if (activeLink) {
                            activeLink.style.viewTransitionName = `${navId}-old`;
                        }
                        link.style.viewTransitionName = `${navId}-new`;

                        const transition = document.startViewTransition(() => {
                            activeLink?.classList.remove("active");
                            link.classList.add("active");

                            // 在导航变化时触发一个微妙的缩放动画
                            nav.style.transform = "scale(0.98)";
                            setTimeout(() => {
                                nav.style.transform = "scale(1)";
                            }, 150);
                        });

                        // 等待过渡完成
                        await transition.finished;
                    } catch (error) {
                        console.error("View transition failed:", error);
                    } finally {
                        // 清理 view-transition-name
                        if (activeLink) {
                            activeLink.style.viewTransitionName = "";
                        }
                        link.style.viewTransitionName = "";
                    }
                });
            });
        });
        document.querySelector(".listname .controls .rename").addEventListener("click", (e) => {
            e.stopPropagation();
            this.playlistManager.renamePlaylist();
        });

        // 监听窗口最小化/恢复事件
        ipcRenderer.on("window-minimized", () => {
            // 通知歌词播放器窗口已最小化
            if (this.audioPlayer && this.audioPlayer.lyricsPlayer) {
                // 确保最小化时同步一次当前歌词
                this.audioPlayer.lyricsPlayer.syncDesktopLyrics();
            }
        });

        ipcRenderer.on("window-restored", () => {
            // 通知歌词播放器窗口已恢复
            if (this.audioPlayer && this.audioPlayer.lyricsPlayer) {
                // 恢复时同步一次当前歌词
                this.audioPlayer.lyricsPlayer.syncDesktopLyrics();
            }
        });
    }

    async handleSearch() {
        try {
            const keyword = document.querySelector(".search input").value;
            if (!keyword) return;

            // 确保执行搜索时也移除搜索建议
            const suggestionContainer = document.querySelector(".suggestions");
            if (suggestionContainer) {
                suggestionContainer.innerHTML = "";
                suggestionContainer.classList.remove("active");
            }

            // 执行搜索
            await this.musicSearcher.searchMusic(keyword);
        } catch (error) {
            this.showNotification("搜索失败: " + error.message, "error");
        }
    }

    renderPlaylist() {
        if (!this.playlistManager) {
            return;
        }
        document.querySelector("#listname").textContent = this.playlistManager.playlistName;
        const playlistElement = document.querySelector("#playing-list");
        playlistElement.innerHTML = "";

        this.playlistManager.playlist.forEach((song) => {
            const div = this.createSongElement(song, song.bvid, {
                isExtract: true
            });
            // 修复: 确保当前播放歌曲存在，并且有有效的bvid值
            const currentlyPlaying = this.playlistManager.playlist[this.playlistManager.playingNow];
            if (currentlyPlaying && currentlyPlaying.bvid === song.bvid) {
                div.classList.add("playing");
            }
            div.addEventListener("click", (e) => {
                const loveBtn = e.target.closest(".love");
                const deleteBtn = e.target.closest(".delete");
                if (!loveBtn && !deleteBtn) {
                    const index = this.playlistManager.playlist.findIndex((item) => item.bvid === song.bvid);
                    this.playlistManager.setPlayingNow(index, e);
                    document.querySelector("#function-list .player").click();
                }
                let songIndex = this.playlistManager.playlist.findIndex((item) => item.bvid === song.bvid);
                if (loveBtn) {
                    const song = this.playlistManager.playlist[songIndex];

                    if (loveBtn.querySelector("i").classList.contains("loved")) {
                        this.favoriteManager.removeFromFavorites(song);
                    } else {
                        this.favoriteManager.addToFavorites(song);
                    }
                }
                if (deleteBtn) {
                    this.playlistManager.removeSong(song.bvid, e);
                }
            });

            playlistElement.appendChild(div);
        });
    }
    createSongElement(song, bvid, { isLove = true, isDelete = true } = {}) {
        const div = document.createElement("div");
        div.classList.add("song");
        div.setAttribute("data-bvid", bvid);

        const isLoved = this.favoriteManager.lovelist.some((item) => item.bvid === song.bvid);

        div.innerHTML = `
            <img class="poster" alt="Poster image">
            <div class="info">
                <div class="name"></div>
                <div class="artist"></div>
            </div>
            <div class="controls">
                ${
                    isLove
                        ? `<div class="love">
                    <i class="bi bi-heart${isLoved ? "-fill" : ""} ${isLoved ? "loved" : ""}"></i>
                </div>`
                        : ""
                }
                ${
                    isDelete
                        ? `<div class="delete">
                    <i class="bi bi-trash"></i>
                </div>`
                        : ""
                }
            </div>`;
        div.querySelector(".poster").src = song.poster;
        const titleMode = this.settingManager.getSetting("extractTitle");
        let displayTitle = song.title;

        switch (titleMode) {
            case "on":
                displayTitle = extractMusicTitle(song.title);
                break;
            case "auto":
                div.setAttribute("data-title-mode", "auto");
                break;
            case "off":
            default:
                break;
        }

        // 标题截断处理
        const titleElement = div.querySelector(".name");
        const maxLength = 25; // 最大显示字符数

        if (displayTitle && displayTitle.length > maxLength) {
            // 截断标题并添加省略号
            const truncatedTitle = displayTitle.substring(0, maxLength) + "...";
            titleElement.textContent = truncatedTitle;

            // 添加title属性，以便用户悬停时可以看到完整标题
            titleElement.title = displayTitle;
        } else {
            titleElement.textContent = displayTitle;
        }

        div.querySelector(".artist").textContent = song.artist;
        return div;
    }
    /**
     * 显示通知消息
     * @param {string} message - 通知消息内容
     * @param {string} type - 通知类型 ('info'|'success'|'warning'|'error')
     * @param {object} options - 配置选项
     * @param {boolean} options.showProgress - 是否显示进度条
     * @param {number} options.progress - 进度值(0-100)
     * @returns {HTMLElement} 通知元素
     */
    showNotification(message, type = "info", { showProgress = false, progress = 0 } = {}) {
        // 1. 确保有容器
        let container = document.querySelector(".notification-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "notification-container";
            document.body.appendChild(container);
        }

        // 2. 创建通知元素
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;

        // 3. 创建消息文本容器
        const messageDiv = document.createElement("div");
        messageDiv.className = "notification-message";
        messageDiv.textContent = message;
        notification.appendChild(messageDiv);

        // 4. 如果需要进度条则添加
        if (showProgress) {
            const progressBar = document.createElement("div");
            progressBar.className = "notification-progress";

            const progressInner = document.createElement("div");
            progressInner.className = "notification-progress-inner";
            progressInner.style.width = `${progress}%`;

            progressBar.appendChild(progressInner);
            notification.appendChild(progressBar);
        }

        // 5. 添加到容器
        container.appendChild(notification);

        // 6. 如果不是进度通知，3秒后自动移除
        if (!showProgress) {
            setTimeout(() => {
                notification.classList.add("notification-fadeout");
                notification.addEventListener(
                    "animationend",
                    () => {
                        notification.remove();
                        // 如果容器为空则移除容器
                        if (!container.children.length) {
                            container.remove();
                        }
                    },
                    { once: true }
                );
            }, 3000);
        }

        // 添加动画类
        notification.classList.add("animate-notification");

        return notification;
    }
    /**
     * 初始化页面上所有的自定义下拉框
     */
    initializeCustomSelects() {
        // 查找页面上所有需要转换的select元素 (跳过已有的自定义下拉框)
        const selects = document.querySelectorAll("select:not(.custom-select-initialized):not(.speed-control)");

        selects.forEach((select) => {
            // 跳过已经初始化的select或速度控制select（它有特殊处理）
            if (select.classList.contains("custom-select-initialized") || select.classList.contains("speed-control")) {
                return;
            }

            // 从原生select中获取选项
            const options = Array.from(select.options).map((option) => ({
                value: option.value,
                text: option.textContent,
                selected: option.selected
            }));

            // 如果原select有change事件处理器，需要保留该行为
            const onChangeCallback = (value) => {
                // 创建并触发一个合成的change事件
                const event = new Event("change", { bubbles: true });
                select.value = value;
                select.dispatchEvent(event);
            };

            // 标记为已初始化
            select.classList.add("custom-select-initialized");

            // 创建自定义下拉框
            this.createCustomSelect(select, options, onChangeCallback);
        });
    }

    /**
     * 创建自定义下拉框
     * @param {HTMLElement} selectElement - 原始select元素
     * @param {Array} options - 选项数组，每项包含value和text
     * @param {Function} onChangeCallback - 值变化时的回调函数
     */
    createCustomSelect(selectElement, options, onChangeCallback) {
        // 创建容器并保持原始select的属性
        const customSelect = document.createElement("div");
        customSelect.className = "custom-select";
        customSelect.id = selectElement.id || "";
        if (selectElement.disabled) {
            customSelect.classList.add("disabled");
        }

        // 获取当前选中项
        const selectedOption = options.find((opt) => opt.selected) || options[0];

        // 创建选中项显示区域
        const selectSelected = document.createElement("div");
        selectSelected.className = "select-selected";
        selectSelected.textContent = selectedOption ? selectedOption.text : "";
        customSelect.appendChild(selectSelected);

        // 创建下拉选项容器
        const selectItems = document.createElement("div");
        selectItems.className = "select-items";
        customSelect.appendChild(selectItems);

        // 添加所有选项
        options.forEach((option) => {
            const item = document.createElement("div");
            item.className = "select-item";
            if (option.selected) {
                item.classList.add("selected");
            }
            item.textContent = option.text;
            item.dataset.value = option.value;

            // 点击选项时更新选中状态
            item.addEventListener("click", () => {
                // e.stopPropagation();

                // 视觉上的选中效果
                selectItems.querySelectorAll(".select-item").forEach((el) => {
                    el.classList.remove("selected");
                });
                item.classList.add("selected");

                // 更新显示文本
                selectSelected.textContent = option.text;

                // 关闭下拉框
                selectSelected.classList.remove("open");
                selectItems.classList.remove("open");

                // 调用回调函数
                if (onChangeCallback) {
                    onChangeCallback(option.value);
                }
            });

            selectItems.appendChild(item);
        });

        // 点击选中区域时切换下拉框显示状态
        selectSelected.addEventListener("click", (e) => {
            e.stopPropagation();

            // 关闭其他所有已打开的下拉框
            document.querySelectorAll(".select-selected.open").forEach((el) => {
                if (el !== selectSelected) {
                    el.classList.remove("open");
                    el.nextElementSibling.classList.remove("open");
                }
            });

            // 切换当前下拉框状态
            selectSelected.classList.toggle("open");
            selectItems.classList.toggle("open");
        });

        // 点击页面其他区域时关闭下拉框
        document.addEventListener("click", () => {
            selectSelected.classList.remove("open");
            selectItems.classList.remove("open");
        });

        // 在原select位置插入自定义下拉框，并隐藏原select
        selectElement.parentNode.insertBefore(customSelect, selectElement);
        selectElement.style.display = "none";
    }

    showDefaultUi() {
        // 设置默认UI显示
        document.querySelector(".player-content .cover .cover-img").src = "../img/NB_Music.png";
        document.querySelector("html").style.setProperty("--bgul", "url(../../img/NB_Music.png)");
        document.querySelector("video")?.remove();
        document.querySelector(".player .info .title").textContent = "NB Music";
        document.querySelector(".player .info .artist").textContent = "欢迎使用";
        document.querySelector(".control>.buttons>.play").classList = "play paused";
        document.querySelector(".progress-bar-inner").style.width = "0%";
        this.audioPlayer.audio.src = "";
        this.lyricsPlayer.changeLyrics("");
    }

    initializeWelcomeDialog() {
        // 处理复选框状态变化
        const agreeCheckbox = document.getElementById("agreeCheckbox");
        const agreeButton = document.getElementById("agreeTerms");

        if (agreeCheckbox && agreeButton) {
            // 复选框状态变化时更新按钮状态
            agreeCheckbox.addEventListener("change", () => {
                agreeButton.disabled = !agreeCheckbox.checked;
            });
        }

        // 免责声明链接点击事件
        const disclaimerLink = document.getElementById("disclaimer-link");
        if (disclaimerLink) {
            disclaimerLink.addEventListener("click", (e) => {
                e.preventDefault();
                // 使用Electron的shell模块打开外部链接
                ipcRenderer.send("open-external-link", "https://nb-group.github.io/nb-music/disclaimer");
            });
        }

        // 同意按钮点击事件
        if (agreeButton) {
            agreeButton.addEventListener("click", () => {
                if (agreeCheckbox && agreeCheckbox.checked) {
                    // 标记已经看过首次使用对话框
                    localStorage.setItem("nbmusic_first_use_seen", "true");

                    // 隐藏对话框
                    const firstUseDialog = document.getElementById("firstUseDialog");
                    if (firstUseDialog) {
                        firstUseDialog.classList.add("hide");
                    }
                } else {
                    this.showNotification("请先同意免责声明", "warning");
                }
            });
        }
    }

    /**
     * 检查是否是首次使用应用，如果是则显示欢迎对话框
     */
    checkFirstUse() {
        // 检查是否是首次使用
        const hasUsedBefore = localStorage.getItem("nbmusic_first_use_seen");

        if (!hasUsedBefore) {
            this.showWelcomeDialog();
        }
    }

    /**
     * 显示欢迎对话框
     */
    showWelcomeDialog() {
        const firstUseDialog = document.getElementById("firstUseDialog");
        if (firstUseDialog) {
            firstUseDialog.classList.remove("hide");

            // 重置复选框和按钮状态
            const agreeCheckbox = document.getElementById("agreeCheckbox");
            const agreeButton = document.getElementById("agreeTerms");

            if (agreeCheckbox) agreeCheckbox.checked = false;
            if (agreeButton) agreeButton.disabled = true;
        }
    }

    /**
     * 初始化托盘控制相关功能
     */
    initializeTrayControls() {
        // 监听来自托盘的控制命令
        ipcRenderer.on("tray-control", (_, command) => {
            switch (command) {
                case "play-pause":
                    this.audioPlayer.play();
                    break;
                case "next":
                    this.audioPlayer.next();
                    break;
                case "prev":
                    this.audioPlayer.prev();
                    break;
                case "show-settings":
                    this.show(".setting");
                    document.querySelector("span.focs").style.top = "147px";
                    break;
                case "about":
                    // 滚动到关于部分
                    this.show(".setting");
                    document.querySelector("span.focs").style.top = "147px";
                    setTimeout(() => {
                        const aboutCard = document.querySelector(".about-card");
                        if (aboutCard) {
                            aboutCard.scrollIntoView({ behavior: "smooth" });
                        }
                    }, 100);
                    break;
                case "check-update":
                    document.getElementById("check-update")?.click();
                    break;
            }
        });

        // 监听音频播放状态变化，更新托盘信息
        this.audioPlayer.audio.addEventListener("play", () => this.updateTrayInfo());
        this.audioPlayer.audio.addEventListener("pause", () => this.updateTrayInfo());

        // 修复：不再使用不存在的事件监听方法
        // 监听歌曲切换时更新托盘信息 - 通过UIManager内部方法调用
        this.songChangedHandler = () => this.updateTrayInfo();

        // 窗口显示/隐藏时也更新托盘
        ipcRenderer.on("window-show", () => this.updateTrayInfo());
        ipcRenderer.on("window-hide", () => this.updateTrayInfo());

        // 初始更新托盘
        this.updateTrayInfo();

        // 监听来自主进程的显示欢迎页面的命令
        ipcRenderer.on("show-welcome", () => {
            this.showWelcomeDialog();
        });
    }

    /**
     * 更新托盘显示信息
     */
    updateTrayInfo() {
        try {
            const isPlaying = !this.audioPlayer.audio.paused;
            let song = { title: "未在播放", artist: "" };

            // 如果有正在播放的歌曲，获取其信息
            if (this.playlistManager && this.playlistManager.playlist.length > 0) {
                const currentSong = this.playlistManager.playlist[this.playlistManager.playingNow];
                if (currentSong) {
                    // 根据提取标题的设置决定显示方式
                    const titleMode = this.settingManager.getSetting("extractTitle");
                    let displayTitle = currentSong.title;

                    if (titleMode === "on") {
                        displayTitle = extractMusicTitle(currentSong.title);
                    }

                    song = {
                        title: displayTitle || "未知歌曲",
                        artist: currentSong.artist || "未知艺术家"
                    };
                }
            }

            // 发送更新到主进程
            ipcRenderer.send("update-tray", {
                isPlaying,
                song
            });

            // 同步更新到桌面歌词 - 确保托盘更新时也更新桌面歌词
            if (this.audioPlayer && this.audioPlayer.lyricsPlayer && this.audioPlayer.lyricsPlayer.desktopLyricsEnabled) {
                this.audioPlayer.lyricsPlayer.syncDesktopLyrics();
            }
        } catch (error) {
            console.error("更新托盘信息失败:", error);
        }
    }

    autoMaximize() {
        if (this.settingManager.getSetting("autoMaximize") === "true") {
            ipcRenderer.send("window-maximize", "maximize");
        } else {
            ipcRenderer.send("window-maximize", "unmaximize");
        }
    }

    // 添加全局动画初始化方法
    initializeAnimations() {
        // 为所有按钮添加点击波纹效果
        document.querySelectorAll("button:not(.mica), .btn, .import-btn, [data-action]").forEach((button) => {
            button.addEventListener("click", this.addClickRipple);
        });

        // 为所有卡片添加悬停动画
        document.querySelectorAll(".card").forEach((card) => {
            if (!card.classList.contains("mica")) {
                card.classList.add("animate-card");
            }
        });

        // 为列表项添加交互动画
        document.querySelectorAll(".song, #playlistList li, #songList li").forEach((item, index) => {
            // 添加错落有致的加载动画
            if (!item.classList.contains("mica")) {
                item.style.opacity = "0";
                item.style.transform = "translateY(20px)";

                setTimeout(
                    () => {
                        item.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
                        item.style.opacity = "1";
                        item.style.transform = "translateY(0)";
                    },
                    50 + index * 30
                ); // 错开加载时间
            }
        });

        // 为标题栏添加动画
        const titbar = document.querySelector(".titbar");
        if (titbar) {
            titbar.classList.add("animate-fadeIn");
        }

        // 为所有页面设置过渡动画
        document.querySelectorAll(".content > div").forEach((page) => {
            page.classList.add("page-transition");
        });

        // 监听音频状态变化添加动画
        if (this.audioPlayer && this.audioPlayer.audio) {
            this.audioPlayer.audio.addEventListener("play", () => {
                const playButton = document.querySelector(".play");
                if (playButton) {
                    playButton.classList.add("animate-play");
                    setTimeout(() => playButton.classList.remove("animate-play"), 500);
                }

                const cover = document.querySelector(".cover-img");
                if (cover) {
                    cover.classList.add("rotate-animation");
                }
            });

            this.audioPlayer.audio.addEventListener("pause", () => {
                const playButton = document.querySelector(".play");
                if (playButton) {
                    playButton.classList.add("animate-pause");
                    setTimeout(() => playButton.classList.remove("animate-pause"), 500);
                }

                const cover = document.querySelector(".cover-img");
                if (cover) {
                    cover.classList.remove("rotate-animation");
                }
            });
        }

        // 增强播放器交互控件
        this.enhancePlayerControls();
    }

    // 添加点击波纹效果函数
    addClickRipple(e) {
        // 避免为带有毛玻璃效果的元素添加动画
        if (this.classList.contains("mica")) return;

        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement("span");
        ripple.className = "ripple-effect";
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        this.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600); // 等待动画完成
    }

    // 为播放器添加增强交互动画
    enhancePlayerControls() {
        // 添加时间预览提示功能
        const progressBar = document.querySelector(".player .control .progress .progress-bar");

        if (progressBar) {
            // 创建时间预览元素
            const timePreview = document.createElement("div");
            timePreview.className = "progress-time-preview";
            progressBar.appendChild(timePreview);

            // 监听鼠标移动
            progressBar.addEventListener("mousemove", (e) => {
                const rect = progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                const duration = this.audioPlayer.audio.duration || 0;
                // eslint-disable-next-line no-unused-vars
                const time = duration * percent;

                // 更新时间预览位置和内容
                timePreview.style.left = `${e.clientX - rect.left}px`;
            });

            // 监听鼠标按下和移动
            let isDragging = false;

            progressBar.addEventListener("mousedown", () => {
                isDragging = true;
                document.body.classList.add("seeking");
            });

            document.addEventListener("mousemove", (e) => {
                if (!isDragging) return;

                const rect = progressBar.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const duration = this.audioPlayer.audio.duration || 0;

                // 更新进度条位置
                const progressBarInner = progressBar.querySelector(".progress-bar-inner");
                if (progressBarInner) {
                    progressBarInner.style.width = `${percent * 100}%`;
                }

                // 更新播放时间显示
                const currentTimeEl = document.querySelector(".player .control .time .currentTime");
                if (currentTimeEl) {
                    currentTimeEl.textContent = this.formatTime(duration * percent);
                }
            });

            document.addEventListener("mouseup", () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.classList.remove("seeking");
                }
            });

            // 点击进度条快速跳转
            progressBar.addEventListener("click", (e) => {
                const rect = progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;

                if (this.audioPlayer && this.audioPlayer.audio) {
                    // 触发跳转动画
                    progressBar.classList.add("clicked");
                    setTimeout(() => progressBar.classList.remove("clicked"), 300);

                    // 设置音频时间
                    this.audioPlayer.audio.currentTime = percent * this.audioPlayer.audio.duration;
                }
            });
        }

        // 增强音量控制功能
        const volumeControl = document.querySelector(".player .control .buttons .volume");

        if (volumeControl) {
            // 创建音量滑块
            const volumeSlider = document.createElement("div");
            volumeSlider.className = "volume-slider";

            const volumeBar = document.createElement("div");
            volumeBar.className = "volume-bar";

            const volumeLevel = document.createElement("div");
            volumeLevel.className = "volume-level";

            const volumeHandle = document.createElement("div");
            volumeHandle.className = "volume-handle";

            volumeBar.appendChild(volumeLevel);
            volumeLevel.appendChild(volumeHandle);
            volumeSlider.appendChild(volumeBar);
            volumeControl.appendChild(volumeSlider);

            // 更新初始音量显示
            if (this.audioPlayer && this.audioPlayer.audio) {
                const currentVolume = this.audioPlayer.audio.volume * 100;
                volumeLevel.style.height = `${currentVolume}%`;
                volumeHandle.style.bottom = `${currentVolume}%`;

                // 根据音量状态更新图标和静音标记
                const volumeIcon = volumeControl.querySelector("i");
                if (volumeIcon) {
                    if (this.audioPlayer.audio.volume === 0) {
                        volumeControl.classList.add("muted");
                        volumeIcon.className = "bi bi-volume-mute-fill";
                    } else {
                        volumeControl.classList.remove("muted");
                        if (this.audioPlayer.audio.volume < 0.3) {
                            volumeIcon.className = "bi bi-volume-off-fill";
                        } else if (this.audioPlayer.audio.volume < 0.7) {
                            volumeIcon.className = "bi bi-volume-down-fill";
                        } else {
                            volumeIcon.className = "bi bi-volume-up-fill";
                        }
                    }
                }
            }

            // 监听音量滑块点击和拖动
            let isDraggingVolume = false;

            volumeBar.addEventListener("mousedown", (e) => {
                isDraggingVolume = true;
                updateVolumeFromEvent(e);
            });

            document.addEventListener("mousemove", (e) => {
                if (!isDraggingVolume) return;
                updateVolumeFromEvent(e);
            });

            document.addEventListener("mouseup", () => {
                isDraggingVolume = false;
            });

            // 点击音量图标切换静音
            volumeControl.querySelector("i").addEventListener("click", (e) => {
                e.stopPropagation();

                if (this.audioPlayer && this.audioPlayer.audio) {
                    const wasMuted = this.audioPlayer.audio.volume === 0;

                    // 保存当前音量
                    const lastVolume = parseFloat(volumeControl.getAttribute("data-last-volume") || "100");

                    if (wasMuted) {
                        // 恢复上次的音量
                        this.audioPlayer.audio.volume = lastVolume / 100;
                        this.settingManager.setSetting("volume", lastVolume);
                    } else {
                        // 保存当前音量并静音
                        volumeControl.setAttribute("data-last-volume", Math.round(this.audioPlayer.audio.volume * 100).toString());
                        this.audioPlayer.audio.volume = 0;
                        this.settingManager.setSetting("volume", "0");
                    }

                    // 更新UI
                    updateVolumeUI();
                }
            });

            // 从事件更新音量
            const updateVolumeFromEvent = (e) => {
                const rect = volumeBar.getBoundingClientRect();
                let percent = 1 - (e.clientY - rect.top) / rect.height;
                percent = Math.max(0, Math.min(1, percent));

                if (this.audioPlayer && this.audioPlayer.audio) {
                    // 设置音频音量
                    this.audioPlayer.audio.volume = percent;

                    // 更新设置
                    this.settingManager.setSetting("volume", Math.round(percent * 100).toString());

                    // 更新UI
                    updateVolumeUI();
                }
            };

            // 更新音量UI
            const updateVolumeUI = () => {
                if (!this.audioPlayer || !this.audioPlayer.audio) return;

                const volume = this.audioPlayer.audio.volume;
                const percent = volume * 100;

                // 更新滑块位置
                volumeLevel.style.height = `${percent}%`;
                volumeHandle.style.bottom = `${percent}%`;

                // 更新图标
                const volumeIcon = volumeControl.querySelector("i");
                if (volumeIcon) {
                    if (volume === 0) {
                        volumeControl.classList.add("muted");
                        volumeIcon.className = "bi bi-volume-mute-fill";
                    } else {
                        volumeControl.classList.remove("muted");
                        if (volume < 0.3) {
                            volumeIcon.className = "bi bi-volume-off-fill";
                        } else if (volume < 0.7) {
                            volumeIcon.className = "bi bi-volume-down-fill";
                        } else {
                            volumeIcon.className = "bi bi-volume-up-fill";
                        }
                    }
                }
            };
        }

        // 增强专辑封面动画
        const coverImg = document.querySelector(".player-content .cover .cover-img");

        if (coverImg && this.audioPlayer) {
            // 当播放状态改变时，更新专辑旋转状态
            this.audioPlayer.audio.addEventListener("play", () => {
                coverImg.classList.add("playing");
                coverImg.classList.remove("paused");
            });

            this.audioPlayer.audio.addEventListener("pause", () => {
                coverImg.classList.add("paused");
            });
        }

        // 歌曲切换时的动画效果
        if (this.playlistManager) {
            const originalSetPlayingNow = this.playlistManager.setPlayingNow;

            this.playlistManager.setPlayingNow = async function (index, replay = true, autoPlay = true) {
                // 添加歌曲切换类
                document.body.classList.add("song-changing");

                // 调用原始方法
                const result = await originalSetPlayingNow.call(this, index, replay, autoPlay);

                // 延迟移除类名，以确保动画完成
                setTimeout(() => {
                    document.body.classList.remove("song-changing");
                }, 500);

                return result;
            };
        }
    }
}

module.exports = UIManager;
