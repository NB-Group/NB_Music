const { ipcRenderer } = require("electron");

// 导入所有UI模块
const PlayerControlsModule = require('./PlayerControlsModule');
const PageNavigationModule = require('./PageNavigationModule');
const NotificationModule = require('./NotificationModule');
const SearchSuggestionsModule = require('./SearchSuggestionsModule');
const SelectControlModule = require('./SelectControlModule');
const PlaylistUIModule = require('./PlaylistUIModule');
const SettingsUIModule = require('./SettingsUIModule');
const WelcomeDialogModule = require('./WelcomeDialogModule');
const TrayControlsModule = require('./TrayControlsModule');
const WindowControlsModule = require('./WindowControlsModule');
const DailyRecommendModule = require('./DailyRecommendModule');
const MiniPlayerModule = require('./MiniPlayerModule');

/**
 * UI管理器
 * 应用程序的主UI管理类，负责协调所有UI模块
 */
class UIManager {
    /**
     * 创建UI管理器
     * @param {Object} settingManager - 设置管理器
     * @param {Object} audioPlayer - 音频播放器
     * @param {Object} playlistManager - 播放列表管理器
     * @param {Object} favoriteManager - 收藏管理器
     * @param {Object} musicSearcher - 音乐搜索器
     * @param {Object} videoPlayerManager - 视频播放器管理器
     */
    constructor(settingManager, audioPlayer, playlistManager, favoriteManager, musicSearcher, videoPlayerManager) {
        this.settingManager = settingManager;
        this.audioPlayer = audioPlayer;
        this.audioPlayer.setSettingManager(settingManager);
        this.playlistManager = playlistManager;
        this.favoriteManager = favoriteManager;
        this.musicSearcher = musicSearcher;
        this.lyricsPlayer = null;
        this.videoPlayerManager = videoPlayerManager;

        // 初始化所有UI模块
        this.initializeModules();
    }

    /**
     * 初始化所有UI模块
     */
    initializeModules() {
        // 创建所有UI模块
        this.windowControlsModule = new WindowControlsModule(this);
        this.playerControlsModule = new PlayerControlsModule(this);
        this.pageNavigationModule = new PageNavigationModule(this);
        this.notificationModule = new NotificationModule(this);
        this.searchSuggestionsModule = new SearchSuggestionsModule(this);
        this.selectControlModule = new SelectControlModule(this);
        this.playlistUIModule = new PlaylistUIModule(this);
        this.settingsUIModule = new SettingsUIModule(this);
        this.welcomeDialogModule = new WelcomeDialogModule(this);
        this.trayControlsModule = new TrayControlsModule(this);
        this.dailyRecommendModule = new DailyRecommendModule(this);
        this.miniPlayerModule = new MiniPlayerModule(this);

        // 初始化所有模块
        this.windowControlsModule.initialize();
        this.playerControlsModule.initialize();
        this.pageNavigationModule.initialize();
        this.notificationModule.initialize();
        this.searchSuggestionsModule.initialize();
        this.selectControlModule.initialize();
        this.playlistUIModule.initialize();
        this.settingsUIModule.initialize();
        this.welcomeDialogModule.initialize();
        this.trayControlsModule.initialize();
        this.dailyRecommendModule.initialize();
        this.miniPlayerModule.initialize();
    }

    /**
     * 显示通知消息（代理到通知模块）
     * @param {string} message - 通知消息内容
     * @param {string} type - 通知类型 ('info'|'success'|'warning'|'error')
     * @param {object} options - 配置选项
     * @returns {HTMLElement} 通知元素
     */
    showNotification(message, type = 'info', options = {}) {
        return this.notificationModule.showNotification(message, type, options);
    }

    /**
     * 设置歌词播放器
     * @param {Object} lyricsPlayer - 歌词播放器实例
     */
    setLyricsPlayer(lyricsPlayer) {
        this.lyricsPlayer = lyricsPlayer;
    }

    /**
     * 渲染播放列表（代理到播放列表UI模块）
     */
    renderPlaylist() {
        this.playlistUIModule.renderPlaylist();
    }

    /**
     * 处理搜索请求（代理到搜索建议模块）
     */
    handleSearch() {
        this.searchSuggestionsModule.handleSearch();
    }

    /**
     * 显示默认UI（代理到播放列表UI模块）
     */
    showDefaultUi() {
        this.playlistUIModule.showDefaultUi();
    }

    /**
     * 检查是否是首次使用应用（代理到欢迎对话框模块）
     */
    checkFirstUse() {
        this.welcomeDialogModule.checkFirstUse();
    }

    /**
     * 显示欢迎对话框（代理到欢迎对话框模块）
     */
    showWelcomeDialog() {
        this.welcomeDialogModule.showWelcomeDialog();
    }
}

module.exports = UIManager; 