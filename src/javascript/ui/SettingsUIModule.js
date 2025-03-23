const UIModule = require('./UIModule');
const { ipcRenderer } = require("electron");

/**
 * 设置UI模块
 * 处理应用设置界面的交互和功能
 */
class SettingsUIModule extends UIModule {
    /**
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
    }

    /**
     * 初始化设置模块
     */
    initialize() {
        this.initializeSettingsListeners();
        this.initializeSettingsUI();
    }

    /**
     * 初始化设置监听器
     */
    initializeSettingsListeners() {
        // 监听歌词显示设置变更
        this.settingManager.addListener('lyricsEnabled', (newValue) => {
            if (this.uiManager.lyricsPlayer) {
                this.uiManager.lyricsPlayer.setVisibility(newValue === 'true');
            }
        });
        
        // 主题切换事件
        this.settingManager.addListener('theme', (newValue, oldValue) => {
            if (newValue == 'auto') {
                newValue = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            document.querySelector('html').classList.remove(oldValue);
            document.querySelector('html').classList.add(newValue);
        });

        // 背景切换事件
        this.settingManager.addListener('background', async (newValue, oldValue) => {
            if (newValue === 'none') {
                const oldVideo = document.querySelector('video');
                if (oldVideo) oldVideo.remove();
                document.querySelector('html').style.removeProperty('--bgul');
            }
            if (newValue === 'cover') {
                const oldVideo = document.querySelector('video');
                if (oldVideo) oldVideo.remove();
                const savedPlaylist = localStorage.getItem("nbmusic_playlist");
                const currentSong = JSON.parse(savedPlaylist)[localStorage.getItem("nbmusic_playing_now") || 0];
                document.querySelector('html').style.setProperty('--bgul', `url(${currentSong.poster})`);
            }
            if (newValue === 'video' && oldValue !== 'video') {
                // 移除旧视频
                const oldVideo = document.querySelector('video');
                if (oldVideo) oldVideo.remove();
                const savedPlaylist = localStorage.getItem("nbmusic_playlist");

                const currentSong = JSON.parse(savedPlaylist)[localStorage.getItem("nbmusic_playing_now") || 0];                const videoUrl = currentSong.video;
                if (videoUrl) {
                    const video = document.createElement('video');
                    video.autoplay = true;
                    video.loop = true;
                    video.muted = true;
                    video.style.position = 'absolute';
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.zIndex = '-1';
                    video.style.bottom = '0';
                    video.style.objectFit = 'cover';
                    video.src = videoUrl;

                    document.querySelector('body').appendChild(video);
                }
            }
        });
        
        // 标题提取设置变更
        this.settingManager.addListener('extractTitle', (newValue, oldValue) => {
            this.uiManager.renderPlaylist();
        });
    }

    /**
     * 初始化设置UI
     */
    initializeSettingsUI() {
        const settingContainer = document.querySelector(".content>.setting");
        
        // 设置点击事件监听
        settingContainer.addEventListener("click", (e) => {
            const setting = e.target;
            if (setting.dataset.key) {
                this.settingManager.setSetting(setting.dataset.key, setting.dataset.value);
            }
        });
        
        // 初始化设置状态
        const settings = this.settingManager.settings;
        Object.keys(settings).forEach((key) => {
            const value = settings[key];
            
            // 特殊处理 playerLayout 选项，因为它的值是一个复杂的JSON对象
            if (key === 'playerLayout') {
                // 找到对应的元素并直接使用DOM API
                const elements = settingContainer.querySelectorAll(`[data-key="playerLayout"]`);
                for (const element of elements) {
                    try {
                        const elementValue = JSON.parse(element.dataset.value);
                        const settingValue = typeof value === 'string' ? JSON.parse(value) : value;
                        
                        // 比较两个对象是否结构相同
                        if (JSON.stringify(elementValue) === JSON.stringify(settingValue)) {
                            element.click();
                            break;
                        }
                    } catch (error) {
                        console.error('解析playerLayout值时出错:', error);
                    }
                }
            } else {
                // 其他普通设置项的处理
                try {
                    const element = settingContainer.querySelector(`[data-key="${key}"][data-value="${value}"]`);
                    if (element) {
                        element.click();
                    }
                } catch (error) {
                    console.warn(`无法找到设置项 ${key}=${value} 的元素:`, error);
                }
            }
        });

        // 初始化关于部分的链接
        this.initializeAboutLinks();
    }

    /**
     * 初始化关于部分的链接
     */
    initializeAboutLinks() {
        // GitHub 仓库链接
        document.getElementById('github-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            ipcRenderer.send('open-external-link', 'https://github.com/NB-Group/nb-music');
        });

        // 报告问题链接
        document.getElementById('report-bug')?.addEventListener('click', (e) => {
            e.preventDefault();
            ipcRenderer.send('open-external-link', 'https://github.com/NB-Group/nb-music/issues/new');
        });

        // 打开欢迎指南链接
        document.getElementById('open-welcome')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.uiManager.welcomeDialogModule.showWelcomeDialog();
        });
    }
}

module.exports = SettingsUIModule; 