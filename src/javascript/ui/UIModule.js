/**
 * UI模块基类
 * 所有UI模块都应该继承该类，以获取共享的UI管理功能
 */
class UIModule {
    /**
     * 创建UI模块基类
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        this.uiManager = uiManager;
    }

    /**
     * 初始化模块
     * 子类应该重写此方法以实现特定的初始化逻辑
     */
    initialize() {
        // 子类重写此方法
    }

    /**
     * 获取相关依赖组件的便捷方法
     */
    get audioPlayer() {
        return this.uiManager.audioPlayer;
    }

    get settingManager() {
        return this.uiManager.settingManager;
    }

    get playlistManager() {
        return this.uiManager.playlistManager;
    }

    get favoriteManager() {
        return this.uiManager.favoriteManager;
    }

    get musicSearcher() {
        return this.uiManager.musicSearcher;
    }

    get lyricsPlayer() {
        return this.uiManager.lyricsPlayer;
    }
}

module.exports = UIModule; 