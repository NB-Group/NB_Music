const { ipcRenderer, shell } = require("electron");

class SettingManager {
    // 默认值常量
    static DEFAULT_PRIMARY_COLOR = "#ad6eca";
    static DEFAULT_SECONDARY_COLOR = "#3b91d8";
    static DEFAULT_FONT_FAMILY_CUSTOM = "HarmonyOS_Sans";
    static DEFAULT_FONT_FAMILY_FALLBACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell";

    static DEFAULT_VALUES = {
        theme: "dark",
        hideSidebar: false,
        hideTitbar: false,
        primaryColor: SettingManager.DEFAULT_PRIMARY_COLOR, // 默认主色
        secondaryColor: SettingManager.DEFAULT_SECONDARY_COLOR, // 默认次色
        micaOpacity: 0.5, // 默认Mica透明度
        bgBlurAmount: 20, // 默认背景模糊强度
        background: "video",
        autoMaximize: false,

        fontFamilyCustom: SettingManager.DEFAULT_FONT_FAMILY_CUSTOM,
        lyricLineFontSize: 24,

        lyricsEnabled: true,
        lyricSource: "netease", // 歌词来源 可选值: netease(网易云), bilibili(B站字幕), smart(智能获取)
        autoPlayOnStartup: false, // 自动播放
        loopLyricsEnabled: true, // 循环歌单歌词同步功能 默认开启
        desktopLyricsEnabled: false,
        fadeEnabled: true, // 音频淡入淡出效果

        lyricSearchType: "custom",
        extractTitle: "auto",
        videoQuality: 64, // 背景视频清晰度 默认720P
        cacheEnabled: false,

        fontFamilyFallback: SettingManager.DEFAULT_FONT_FAMILY_FALLBACK,
        devToolsEnabled: false, // 开发者工具设置

        volume: 50, // 音量设置
        restoreWindowState: true, // 记忆窗口状态，默认启用
        sidebarWidth: 260, // 侧栏宽度设置
        echo: false, // 回声效果设置
        convolver: false // 混响效果设置
    };

    constructor() {
        this.settings = { ...SettingManager.DEFAULT_VALUES };
        this.listeners = new Map();
        this.STORAGE_KEY = "app_settings";
        this.loadSettings();
        this.setupSettingListeners();
        this.setupWindowStateSettings(); // 设置窗口状态记忆
        this.setupAboutLinks();
        this.setAppVersion();
        this.setupCustomThemeControls();
        this.applyFontFamily();
        this.applyFontSize();
        this.fetchContributors(); // 获取项目贡献者信息
        this.uiManager = null; // 初始化为null，后续设置
    }

    // 添加setter方法用于设置UIManager引用
    setUIManager(uiManager) {
        this.uiManager = uiManager;
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem(this.STORAGE_KEY);
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                for (const k in parsed)
                    if (Object.prototype.hasOwnProperty.call(parsed, k))
                        this.settings[k] = parsed[k];
            }
        } catch (error) {
            console.error("加载设置失败:", error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
        } catch (error) {
            console.error("保存设置失败:", error);
        }
    }

    getSetting(name) {
        return this.settings[name];
    }

    setSetting(name, value) {
        const oldValue = this.settings[name];
        this.settings[name] = value;

        this.notifyListeners(name, value, oldValue);
        this.saveSettings();
    }

    addListener(settingName, callback) {
        if (!this.listeners.has(settingName)) {
            this.listeners.set(settingName, new Set());
        }
        this.listeners.get(settingName).add(callback);
    }

    removeListener(settingName, callback) {
        if (this.listeners.has(settingName)) {
            this.listeners.get(settingName).delete(callback);
        }
    }

    notifyListeners(settingName, newValue, oldValue) {
        if (this.listeners.has(settingName)) {
            this.listeners.get(settingName).forEach((callback) => {
                callback(newValue, oldValue);
            });
        }
    }

    setupSettingListeners() {
        // 监听设置选项的点击事件
        document.querySelectorAll("nav a[data-key]").forEach((element) => {
            element.addEventListener("click", (e) => {
                const key = e.target.getAttribute("data-key");
                const value = e.target.getAttribute("data-value");

                const finalValue = this.processSettingValue(key, value);

                // 更新UI
                const navParent = e.target.parentElement;
                navParent.querySelectorAll("a").forEach((a) => a.classList.remove("active"));
                e.target.classList.add("active");

                // 保存设置
                this.setSetting(key, finalValue);

                // 应用设置
                this.applySettingChange(key, finalValue);
            });
        });

        // 监听设置文本输入完成
        document.querySelectorAll("nav input[data-key]").forEach((element) => {
            const key = element.getAttribute("data-key");
            element.value = this.settings[key];

            element.addEventListener("blur", (e) => {
                const key = e.target.getAttribute("data-key");
                const value = e.target.value;

                const finalValue = this.processSettingValue(key, value);

                // 保存设置
                this.setSetting(key, finalValue);

                // 应用设置
                this.applySettingChange(key, finalValue);
            });
        });

        // 清除缓存按钮事件
        const clearCacheBtn = document.getElementById("clearCache");
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener("click", () => {
                this.clearCache();
            });
        }
    }

    processSettingValue(key, value) {
        switch (key) {
            // 对于videoQuality，需要转换为数字
            case "videoQuality":
                return parseInt(value);
            // 字体
            case "fontFamilyCustom":
            case "fontFamilyFallback":
                return value.trim();
            // 其他不变
            default:
                return value;
        }
    }

    setupCustomThemeControls() {
        // 初始化颜色选择器的值
        const primaryColorPicker = document.getElementById("primaryColor");
        const secondaryColorPicker = document.getElementById("secondaryColor");

        if (primaryColorPicker) {
            primaryColorPicker.value = this.settings.primaryColor;
            primaryColorPicker.addEventListener("change", (e) => {
                this.setSetting("primaryColor", e.target.value);
                this.applyThemeColors();
            });
        }

        if (secondaryColorPicker) {
            secondaryColorPicker.value = this.settings.secondaryColor;
            secondaryColorPicker.addEventListener("change", (e) => {
                this.setSetting("secondaryColor", e.target.value);
                this.applyThemeColors();
            });
        }

        // 重置颜色按钮
        const resetThemeColorsBtn = document.getElementById("resetThemeColors");
        if (resetThemeColorsBtn) {
            resetThemeColorsBtn.addEventListener("click", () => {
                // 重置为默认值
                this.setSetting("primaryColor", SettingManager.DEFAULT_PRIMARY_COLOR);
                this.setSetting("secondaryColor", SettingManager.DEFAULT_SECONDARY_COLOR);

                // 更新UI
                if (primaryColorPicker) primaryColorPicker.value = SettingManager.DEFAULT_PRIMARY_COLOR;
                if (secondaryColorPicker) secondaryColorPicker.value = SettingManager.DEFAULT_SECONDARY_COLOR;

                // 应用更改
                this.applyThemeColors();

                // 显示通知
                if (this.uiManager) {
                    this.uiManager.showNotification("主题颜色已重置", "success");
                }
            });
        }
        // 初始应用主题色
        this.applyThemeColors();

        this.sliderSetting(
            "micaOpacity",
            "50%",
            "透明度已重置",
            (value) => `${Math.round(value * 100)}%`,
            () => this.applyMicaOpacity()
        );

        this.sliderSetting(
            "bgBlurAmount",
            20,
            "背景模糊强度已重置",
            (value) => `${value}px`,
            () => this.applyBgBlur()
        );

        this.sliderSetting(
            "lyricLineFontSize",
            "24",
            "歌词字体大小已重置",
            (value) => `${value}px`,
            () => this.applyFontSize()
        );
    }

    sliderSetting(id, defaultValue, resetText, value2display, afterValueApply) {
        const slider = document.getElementById(id);
        const value = document.getElementById(id + "Value");
        const reset = document.getElementById(id + "Reset");

        if (slider) {
            slider.value = this.settings[id];
            value.textContent = value2display(this.settings[id]);

            slider.addEventListener("input", (e) => {
                const v = parseFloat(e.target.value);
                value.textContent = value2display(v);
                this.setSetting(id, v);
                afterValueApply();
            });
        }
        if (reset) {
            reset.addEventListener("click", () => {
                this.setSetting(id, defaultValue);

                // 更新UI
                if (slider) slider.value = defaultValue;
                if (value) value.textContent = value2display(defaultValue);

                // 应用更改
                afterValueApply();

                // 显示通知
                if (this.uiManager) {
                    this.uiManager.showNotification(resetText, "success");
                }
            });
        }
        afterValueApply();
    }

    applyThemeColors() {
        const root = document.documentElement;
        root.style.setProperty("--primary-color", this.settings.primaryColor);
        root.style.setProperty("--secondary-color", this.settings.secondaryColor);
    }

    applyMicaOpacity() {
        const root = document.documentElement;
        root.style.setProperty("--mica-opacity", this.settings.micaOpacity);
    }

    applyBgBlur() {
        const root = document.documentElement;
        root.style.setProperty("--bg-blur-amount", `${this.settings.bgBlurAmount}px`);
    }

    applyFontFamily() {
        const root = document.documentElement;
        let c = this.settings.fontFamilyCustom;
        if (typeof c === "string" && c.trim().length > 0) c = `${c}, `;
        root.style.setProperty("--font-family-custom", c);
        root.style.setProperty("--font-family-fallback", this.settings.fontFamilyFallback);
    }

    applyFontSize() {
        const root = document.documentElement;
        root.style.setProperty("--lyric-line-font-size", `${this.settings.lyricLineFontSize}px`);
    }

    applySettingChange(key, value) {
        switch (key) {
            case "theme":
                this.applyTheme(value);
                break;
            case "background":
                // 应用背景设置
                this.applyBackground(value);
                break;
            case "primaryColor":
            case "secondaryColor":
                this.applyThemeColors();
                break;
            case "micaOpacity":
                this.applyMicaOpacity();
                break;
            case "bgBlurAmount":
                this.applyBgBlur();
                break;
            case "videoQuality":
                // 视频质量变更时无需即时应用，下次加载视频时会使用新设置
                if (this.uiManager) {
                    this.uiManager.showNotification(`背景视频质量已设置为 ${this.getQualityName(value)}`, "success");
                }
                break;
            case "fontFamilyCustom":
            case "fontFamilyFallback":
                this.applyFontFamily();
                break;
            case "restoreWindowState":
                // 将设置同步到主进程
                ipcRenderer.send("set-restore-window-state", value === "true");
                break;
            // 其他设置的处理...
        }
    }

    applyTheme(theme) {
        const root = document.documentElement;
        if (theme === "auto") {
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            root.className = prefersDark ? "dark" : "light";
        } else {
            root.className = theme;
        }
    }

    applyBackground(type) {
        // 获取当前播放的歌曲信息
        const getSongInfo = () => {
            try {
                const savedPlaylist = localStorage.getItem("nbmusic_playlist");
                if (!savedPlaylist) return null;

                const playlist = JSON.parse(savedPlaylist);
                const playingNowIndex = localStorage.getItem("nbmusic_playing_now") || 0;
                return playlist[playingNowIndex];
            } catch (error) {
                console.error("获取当前歌曲信息失败:", error);
                return null;
            }
        };

        // 获取当前音频播放进度
        const getCurrentAudioTime = () => {
            const audioPlayer = document.querySelector("audio");
            return audioPlayer ? audioPlayer.currentTime : 0;
        };

        // 切换背景类型
        switch (type) {
            case "none": {
                // 移除视频背景
                this.cleanupVideoBackgrounds();
                document.querySelector("html").style.removeProperty("--bgul");
                break;
            }
            case "cover": {
                // 移除视频背景，设置封面背景
                this.cleanupVideoBackgrounds();
                const coverSong = getSongInfo();
                if (coverSong && coverSong.poster) {
                    document.querySelector("html").style.setProperty("--bgul", `url(${coverSong.poster})`);
                }
                break;
            }
            case "video": {
                // 设置视频背景
                const currentSong = getSongInfo();
                const currentTime = getCurrentAudioTime();

                if (currentSong && currentSong.video) {
                    // 清除旧视频
                    this.cleanupVideoBackgrounds();

                    // 创建新视频元素
                    const video = document.createElement("video");
                    video.autoplay = false; // 不自动播放，等待时间同步后再播放
                    video.loop = true;
                    video.muted = true;
                    video.playsInline = true;
                    video.style.position = "absolute";
                    video.style.width = "100%";
                    video.style.height = "100%";
                    video.style.zIndex = "-1";
                    video.style.bottom = "0";
                    video.style.objectFit = "cover";
                    video.src = currentSong.video;

                    // 视频加载完成后设置时间和播放状态
                    video.addEventListener("loadedmetadata", () => {
                        // 同步当前音频进度
                        video.currentTime = currentTime;

                        // 根据音频播放状态决定是否播放视频
                        const audioPlayer = document.querySelector("audio");
                        if (audioPlayer && !audioPlayer.paused) {
                            video.play().catch((err) => console.warn("视频自动播放失败:", err));
                        }
                    });

                    // 添加同步事件
                    const audioPlayer = document.querySelector("audio");
                    if (audioPlayer) {
                        const syncVideo = () => {
                            // 确保视频跟随音频进度
                            if (Math.abs(video.currentTime - audioPlayer.currentTime) > 0.5) {
                                video.currentTime = audioPlayer.currentTime;
                            }
                        };

                        audioPlayer.addEventListener("play", () => video.play().catch(() => {}));
                        audioPlayer.addEventListener("pause", () => video.pause());
                        audioPlayer.addEventListener("seeking", syncVideo);

                        // 每5秒同步一次进度，防止长时间播放出现偏移
                        const syncInterval = setInterval(syncVideo, 5000);
                        video.addEventListener("remove", () => clearInterval(syncInterval), { once: true });
                    }

                    document.querySelector("body").appendChild(video);
                }
                break;
            }
        }
    }

    // 新增方法：清理所有视频背景
    cleanupVideoBackgrounds() {
        const oldVideos = document.querySelectorAll("body > video");
        oldVideos.forEach((video) => {
            video.pause();
            video.remove();
        });
    }

    clearCache() {
        try {
            // 清除应用缓存
            localStorage.removeItem("songCache");
            localStorage.removeItem("videoCache");

            // 显示通知
            if (this.uiManager) {
                this.uiManager.showNotification("缓存已清除", "success");
            }

            // 可以添加其他缓存清理逻辑
            if (window.app && window.app.cacheManager) {
                window.app.cacheManager.clearCache();
            }
        } catch (error) {
            console.error("清除缓存失败:", error);
            if (this.uiManager) {
                this.uiManager.showNotification("清除缓存失败", "error");
            }
        }
    }

    setupAboutLinks() {
        // GitHub仓库链接
        document.getElementById("github-link")?.addEventListener("click", (e) => {
            e.preventDefault();
            shell.openExternal("https://github.com/NB-Group/NB_Music");
        });

        // 报告问题链接
        document.getElementById("report-bug")?.addEventListener("click", (e) => {
            e.preventDefault();
            shell.openExternal("https://github.com/NB-Group/NB_Music/issues/new");
        });

        // 检查更新按钮
        document.getElementById("check-update")?.addEventListener("click", (e) => {
            e.preventDefault();

            // 发送检查更新事件
            ipcRenderer.send("check-for-updates");

            // 显示更新界面
            if (window.app && window.app.updateManager) {
                window.app.updateManager.show();
                window.app.updateManager.showStatus("正在检查更新...");
            } else {
                if (this.uiManager) {
                    this.uiManager.showNotification("更新管理器未初始化", "error");
                }
            }
        });

        // 打开欢迎指南
        document.getElementById("open-welcome")?.addEventListener("click", (e) => {
            e.preventDefault();
            if (window.app) {
                window.app.showWelcomeDialog();
            }
        });
        
        // 查看所有贡献者
        document.getElementById("view-all-contributors")?.addEventListener("click", (e) => {
            e.preventDefault();
            shell.openExternal("https://github.com/NB-Group/NB_Music/graphs/contributors");
        });
    }

    setAppVersion() {
        // 从package.json获取版本号
        const versionElement = document.getElementById("app-version");
        if (versionElement) {
            ipcRenderer.invoke("get-app-version").then((version) => {
                versionElement.textContent = version || "1.0.0";
            });
        }
    }

    // 新增：获取清晰度名称的辅助方法
    getQualityName(quality) {
        const qualityMap = {
            16: "360P",
            32: "480P",
            64: "720P",
            80: "1080P",
            112: "1080P+",
            116: "1080P60",
            120: "4K",
            125: "HDR",
            126: "杜比视界",
            127: "8K"
        };
        return qualityMap[quality] || "未知";
    }

    // 新增：获取项目贡献者信息的方法
    fetchContributors() {
        const contributorsContainer = document.getElementById("contributors-container");
        if (!contributorsContainer) return;
        
        contributorsContainer.innerHTML = '<div class="loading-contributors">加载中...</div>';
        
        // 从GitHub API获取贡献者信息
        fetch('https://api.github.com/repos/NB-Group/NB_Music/contributors')
            .then(response => {
                if (!response.ok) {
                    throw new Error('获取贡献者信息失败');
                }
                return response.json();
            })
            .then(contributors => {
                // 处理获取到的贡献者信息
                contributorsContainer.innerHTML = '';
                
                // 显示最多8个主要贡献者
                const mainContributors = contributors.slice(0, 8);
                
                mainContributors.forEach(contributor => {
                    const contributorEl = document.createElement('div');
                    contributorEl.className = 'contributor';
                    contributorEl.innerHTML = `
                        <a href="${contributor.html_url}" title="${contributor.login}" class="contributor-link">
                            <img src="${contributor.avatar_url}" alt="${contributor.login}" class="contributor-avatar" />
                            <div class="contributor-info">
                                <div class="contributor-name">${contributor.login}</div>
                                <div class="contributor-commits">${contributor.contributions} 次贡献</div>
                            </div>
                        </a>
                    `;
                    
                    contributorEl.querySelector('a').addEventListener('click', (e) => {
                        e.preventDefault();
                        shell.openExternal(contributor.html_url);
                    });
                    
                    contributorsContainer.appendChild(contributorEl);
                });
                
                // 如果贡献者超过8个，添加查看更多按钮
                if (contributors.length > 8) {
                    const viewMoreEl = document.createElement('div');
                    viewMoreEl.className = 'view-more-contributors';
                    viewMoreEl.innerHTML = `<a href="#" id="view-all-contributors">+${contributors.length - 8} 查看全部</a>`;
                    contributorsContainer.appendChild(viewMoreEl);
                    
                    // 添加事件监听
                    viewMoreEl.querySelector('a').addEventListener('click', (e) => {
                        e.preventDefault();
                        shell.openExternal("https://github.com/NB-Group/NB_Music/graphs/contributors");
                    });
                }
            })
            .catch(error => {
                console.error('获取贡献者失败:', error);
                contributorsContainer.innerHTML = `
                    <div class="contributors-error">
                        <i class="bi bi-exclamation-triangle"></i>
                        <div>加载贡献者信息失败</div>
                        <a href="#" id="retry-fetch-contributors">重试</a>
                    </div>
                `;
                
                document.getElementById('retry-fetch-contributors')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.fetchContributors();
                });
            });
    }

    // 新增方法：设置窗口状态记忆
    setupWindowStateSettings() {
        // 从主进程获取当前的窗口状态设置
        ipcRenderer.invoke("get-restore-window-state").then(value => {
            this.settings.restoreWindowState = value;
            
            // 更新UI
            const navElement = document.querySelector(`[data-key="restoreWindowState"][data-value="${value}"]`);
            if (navElement) {
                const navParent = navElement.parentElement;
                navParent.querySelectorAll("a").forEach(a => a.classList.remove("active"));
                navElement.classList.add("active");
            }
        }).catch(error => {
            console.error("获取窗口状态设置失败:", error);
        });
    }
}

module.exports = SettingManager;
