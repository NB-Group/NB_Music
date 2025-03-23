const UIModule = require('./UIModule');
const { ipcRenderer } = require("electron");
const { extractMusicTitle } = require("../../utils.js");

/**
 * 托盘控制模块
 * 处理系统托盘相关的控制和通信
 */
class TrayControlsModule extends UIModule {
    /**
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
        this.songChangedHandler = null;
    }

    /**
     * 初始化托盘控制模块
     */
    initialize() {
        this.initializeTrayControls();
    }

    /**
     * 初始化托盘控制相关功能
     */
    initializeTrayControls() {
        // 监听来自托盘的控制命令
        ipcRenderer.on('tray-control', (_, command) => {
            switch(command) {
                case 'play-pause':
                    this.audioPlayer.play();
                    break;
                case 'next':
                    this.audioPlayer.next();
                    break;
                case 'prev':
                    this.audioPlayer.prev();
                    break;
                case 'show-settings':
                    this.uiManager.pageNavigationModule.show('.setting');
                    break;
                case 'about':
                    // 滚动到关于部分
                    this.uiManager.pageNavigationModule.show('.setting');
                    setTimeout(() => {
                        const aboutCard = document.querySelector('.about-card');
                        if (aboutCard) {
                            aboutCard.scrollIntoView({ behavior: 'smooth' });
                        }
                    }, 100);
                    break;
                case 'check-update':
                    document.getElementById('check-update')?.click();
                    break;
            }
        });
        
        // 监听音频播放状态变化，更新托盘信息
        this.audioPlayer.audio.addEventListener('play', () => this.updateTrayInfo());
        this.audioPlayer.audio.addEventListener('pause', () => this.updateTrayInfo());
        
        // 设置歌曲切换时更新托盘信息的处理函数
        this.songChangedHandler = () => this.updateTrayInfo();
        
        // 窗口显示/隐藏时也更新托盘
        ipcRenderer.on('window-show', () => this.updateTrayInfo());
        ipcRenderer.on('window-hide', () => this.updateTrayInfo());
        
        // 初始更新托盘
        this.updateTrayInfo();
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
                    const titleMode = this.settingManager.getSetting('extractTitle');
                    let displayTitle = currentSong.title;
                    
                    if (titleMode === 'on') {
                        displayTitle = extractMusicTitle(currentSong.title);
                    }
                    
                    song = {
                        title: displayTitle || "未知歌曲",
                        artist: currentSong.artist || "未知艺术家"
                    };
                }
            }
            
            // 发送更新到主进程
            ipcRenderer.send('update-tray', {
                isPlaying,
                song
            });
        } catch (error) {
            console.error('更新托盘信息失败:', error);
        }
    }
}

module.exports = TrayControlsModule; 