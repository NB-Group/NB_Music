const { ipcRenderer } = require("electron");
const { extractMusicTitle } = require("../utils.js");
const ModularUIManager = require('./ui/UIManager');

/**
 * UI管理器
 * 在模块化重构后，此类现在作为入口点，导入新的模块化UI管理器
 */
class UIManager {
    /**
     * 创建UI管理器
     * @param {Object} settingManager - 设置管理器
     * @param {Object} audioPlayer - 音频播放器
     * @param {Object} playlistManager - 播放列表管理器
     * @param {Object} favoriteManager - 收藏管理器
     * @param {Object} musicSearcher - 音乐搜索器
     */
    constructor(settingManager, audioPlayer, playlistManager, favoriteManager, musicSearcher) {
        this.audioPlayer = audioPlayer;
        this.settingManager = settingManager;
        this.playlistManager = playlistManager;
        this.favoriteManager = favoriteManager;
        this.musicSearcher = musicSearcher;
        this.lyricsPlayer = null;
        this.videoPlayerManager = null; // 初始化为null，稍后由App类设置
        
        // 创建新的模块化UI管理器
        this.manager = new ModularUIManager(
            settingManager, 
            audioPlayer, 
            playlistManager, 
            favoriteManager, 
            musicSearcher,
            this.videoPlayerManager // 传递videoPlayerManager，虽然初始为null
        );

        // 导出所有必要的方法，以保持向后兼容
        this.showNotification = this.manager.showNotification.bind(this.manager);
        this.renderPlaylist = this.manager.renderPlaylist.bind(this.manager);
        this.handleSearch = this.manager.handleSearch.bind(this.manager);
        this.showDefaultUi = this.manager.showDefaultUi.bind(this.manager);
        this.checkFirstUse = this.manager.checkFirstUse.bind(this.manager);
        this.showWelcomeDialog = this.manager.showWelcomeDialog.bind(this.manager);
        
        // 为了向后兼容性，暴露出常用的模块
        this.pageNavigationModule = this.manager.pageNavigationModule;
        this.playlistUIModule = this.manager.playlistUIModule;
        this.notificationModule = this.manager.notificationModule;
        this.selectControlModule = this.manager.selectControlModule;
        this.trayControlsModule = this.manager.trayControlsModule;
        this.windowControlsModule = this.manager.windowControlsModule;
        this.settingsUIModule = this.manager.settingsUIModule;
        this.searchSuggestionsModule = this.manager.searchSuggestionsModule;
        this.playerControlsModule = this.manager.playerControlsModule;
        this.welcomeDialogModule = this.manager.welcomeDialogModule;
    }

    /**
     * 设置歌词播放器
     * @param {Object} lyricsPlayer - 歌词播放器实例
     */
    setLyricsPlayer(lyricsPlayer) {
        this.lyricsPlayer = lyricsPlayer;
        this.manager.setLyricsPlayer(lyricsPlayer);
    }

    /**
     * 向旧代码提供页面导航功能的兼容方法
     * @param {string} pageName - 页面名称
     */
    show(pageName) {
        this.manager.pageNavigationModule.show(pageName);
    }

    /**
     * 切换主题
     */
    toggleTheme() {
        const currentTheme = document.querySelector('html').classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.querySelector('html').classList.remove(currentTheme);
        document.querySelector('html').classList.add(newTheme);
        
        localStorage.setItem('theme', newTheme);
        this.settingManager.setSetting('theme', newTheme);
    }

    /**
     * 设置视频播放器管理器
     * @param {Object} videoPlayerManager - 视频播放器管理器实例
     */
    setVideoPlayerManager(videoPlayerManager) {
        this.videoPlayerManager = videoPlayerManager;
        if (this.manager) {
            this.manager.videoPlayerManager = videoPlayerManager;
        }
    }

    // 以下方法保留为空实现，仅为向后兼容
    initializeSearchSuggestions() {}
    initializeAdvancedControls() {}
    initializeSettings() {}
    initializePlayerControls() {}
    initializePageEvents() {}
    initializeEvents() {}
    initializeTrayControls() {}
    initializeCustomSelects() {}
    initializeWelcomeDialog() {}
    updateTrayInfo() {
        this.trayControlsModule.updateTrayInfo();
    }
}

module.exports = UIManager;
