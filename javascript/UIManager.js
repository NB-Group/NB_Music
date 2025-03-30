const { ipcRenderer } = require("electron");
const { extractMusicTitle } = require("../utils.js");

class UIManager {
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
                const volume = settingManager.getSetting('volume') / 100;
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
        this.initializeTrayControls(); // 新增托盘控制初始化
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

        const downloadBtn = document.querySelector(".import-btn");
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
                a.download = `${fileName}.mp3`; // 使用 .mp3 扩展名
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
            if (this.lyricsPlayer) {
                this.lyricsPlayer.setVisibility(newValue === "true");
            }
        });
        // 主题切换事件
        this.settingManager.addListener("theme", (newValue, oldValue) => {
            if (newValue == "auto") {
                newValue = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            }
            document.querySelector("html").classList.remove(oldValue);
            document.querySelector("html").classList.add(newValue);
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
        
        this.settingManager.addListener("desktopLyricsFontSize", (newValue) => {
            if (this.lyricsPlayer && this.lyricsPlayer.desktopLyricsEnabled) {
                this.lyricsPlayer.updateDesktopLyricsStyle();
            }
        });
        
        this.settingManager.addListener("desktopLyricsOpacity", (newValue) => {
            if (this.lyricsPlayer && this.lyricsPlayer.desktopLyricsEnabled) {
                this.lyricsPlayer.updateDesktopLyricsStyle();
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
                // 检查是否启用了开发者工具设置
                const devToolsEnabled = this.settingManager.getSetting("devToolsEnabled") === "true";
                if (devToolsEnabled || !app.isPackaged) { // 在开发环境中始终可用
                    ipcRenderer.send("open-dev-tools");
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
            if (!event.target.closest(".sidebar") && !event.target.closest(".dock.sidebar") && this.settingManager.getSetting("hideSidebar") == "true") {
                document.querySelector(".sidebar").style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.04, 0.92, 0.4, 0.97)";
                document.querySelector(".sidebar").parentElement.style.gridTemplateColumns = "0 auto";
                document.querySelector(".sidebar").style.opacity = "0";
                // document.querySelector(".sidebar").style.display = "none";
            }
            if (!event.target.closest(".titbar") && this.settingManager.getSetting("hideTitbar") == "true") {
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

            this.musicSearcher.searchMusic(keyword);
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
                notification.classList.add("fade-out");
                setTimeout(() => {
                    notification.remove();
                    // 如果容器为空则移除容器
                    if (!container.children.length) {
                        container.remove();
                    }
                }, 300);
            }, 3000);
        }

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
            item.addEventListener("click", (e) => {
                e.stopPropagation();

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
            if (this.audioPlayer && this.audioPlayer.lyricsPlayer && 
                this.audioPlayer.lyricsPlayer.desktopLyricsEnabled) {
                this.audioPlayer.lyricsPlayer.syncDesktopLyrics();
            }
        } catch (error) {
            console.error("更新托盘信息失败:", error);
        }
    }
}

module.exports = UIManager;
