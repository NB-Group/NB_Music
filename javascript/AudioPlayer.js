// 音频播放器类
class AudioPlayer {
    constructor(playlistManager) {
        this.playlistManager = playlistManager;
        this.audio = new Audio();
        this.audio.autoplay = false;
        this.audio.loop = false;
        this.audio.volume = 0; // 将由setSettingManager覆盖
        this.volumeInterval = null;
        this.settingManager = null; // 将在初始化时设置
        this.lastProgressSaveTime = 0;
        this.isPlayRequestPending = false; // 跟踪播放请求状态
        this.uimanager = null; // 将由UIManager设置
        // 添加事件系统支持
        this.eventListeners = {};
        
        this.audio.addEventListener("timeupdate", () => {
            // 增加保存频率：每1秒保存一次进度
            const now = Date.now();
            if ((now - this.lastProgressSaveTime) > 1000 && 
                this.settingManager && this.settingManager.getSetting('savePlaybackProgress')) {
                this.playlistManager.savePlaylists();
                this.lastProgressSaveTime = now;
            }
        });

        // 在暂停时保存进度
        this.audio.addEventListener("pause", () => {
            if (this.settingManager && this.settingManager.getSetting('savePlaybackProgress')) {
                this.playlistManager.savePlaylists();
                this.lastProgressSaveTime = Date.now();
            }
            this.isPlayRequestPending = false; // 重置请求状态
        });
        
        // 在播放结束时保存进度
        this.audio.addEventListener('ended', () => {
            if (this.settingManager && this.settingManager.getSetting('savePlaybackProgress')) {
                this.playlistManager.savePlaylists();
                this.lastProgressSaveTime = Date.now();
            }
            this.isPlayRequestPending = false; // 重置请求状态
            
            if (this.playlistManager) {
                this.playlistManager.next();
            }
        });
        
        // 监听错误事件
        this.audio.addEventListener('error', (e) => {
            console.error('音频播放错误:', e);
            this.isPlayRequestPending = false;
            if (this.uimanager) {
                this.uimanager.showNotification('播放出错，正在尝试恢复...', 'warning');
                // 尝试重新加载当前歌曲
                setTimeout(() => {
                    if (this.playlistManager && this.playlistManager.playlist.length > 0) {
                        this.playlistManager.tryPlayWithRetry(
                            this.playlistManager.playlist[this.playlistManager.playingNow]
                        );
                    }
                }, 1000);
            }
        });
        
        // 在离开页面前保存进度
        window.addEventListener('beforeunload', () => {
            if (this.settingManager && this.settingManager.getSetting('savePlaybackProgress')) {
                this.playlistManager.savePlaylists();
            }
        });

        if ("mediaSession" in navigator) {
            navigator.mediaSession.setActionHandler("play", () => {
                this.play();
            });
            navigator.mediaSession.setActionHandler("pause", () => {
                this.play();
            });
            navigator.mediaSession.setActionHandler("previoustrack", () => {
                this.prev();
            });
            navigator.mediaSession.setActionHandler("nexttrack", () => {
                this.next();
            });
        }

        this.audio.addEventListener("play", () => {
            if ("mediaSession" in navigator) {
                navigator.mediaSession.playbackState = "playing";
            }
            // 新增音量同步逻辑
            if (this.settingManager) {
                const currentVolume = Math.max(0, this.settingManager.getSetting('volume') / 100);
                this.audio.volume = currentVolume;
            }
            this.isPlayRequestPending = false;
        });

        this.audio.addEventListener("pause", () => {
            if ("mediaSession" in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
            // 新增音量同步逻辑
            if (this.settingManager) {
                const currentVolume = Math.max(0, this.settingManager.getSetting('volume') / 100);
                this.audio.volume = currentVolume;
            }
        });
    }

    async audioPlay() {
        // 防止重复请求
        if (this.isPlayRequestPending) return;
        this.isPlayRequestPending = true;
        
        try {
            // 检查是否启用了淡入淡出效果
            const fadeEnabled = this.settingManager && 
                this.settingManager.getSetting('fadeEnabled') === 'true';

            // 清除现有间隔
            if (this.volumeInterval) {
                clearInterval(this.volumeInterval);
                this.volumeInterval = null;
            }

            // 获取当前音量设置
            const currentVolume = this.settingManager ? 
                Math.max(0, this.settingManager.getSetting('volume') / 100) : 1;

            // 如果音量为0或禁用了淡入淡出效果，直接设置音量为当前音量并播放
            if (!fadeEnabled || currentVolume === 0) {
                this.audio.volume = currentVolume;
                await this.audio.play();
                this.isPlayRequestPending = false;
                return;
            }

            // 启用淡入淡出时的逻辑
            this.audio.volume = 0.01; // 从最低可听音量开始
            await this.audio.play();
            
            this.volumeInterval = window.setInterval(() => {
                this.audio.volume = Math.min(currentVolume, this.audio.volume + 0.01);
                if (this.audio.volume >= currentVolume) {
                    clearInterval(this.volumeInterval);
                    this.volumeInterval = null;
                    this.isPlayRequestPending = false;
                }
            }, 6);
        } catch (error) {
            console.error('播放失败:', error);
            this.isPlayRequestPending = false;
            if (this.uimanager) {
                this.uimanager.showNotification('播放失败，正在重试...', 'error');
            }
            this.playlistManager.tryPlayWithRetry(this.playlistManager.playlist[this.playlistManager.playingNow]);
        }
    }

    audioPause() {
        // 防止在暂停过程中触发新的暂停
        if (!this.audio.paused && !this.isPlayRequestPending) {
            this.isPlayRequestPending = true;
            
            // 检查是否启用了淡入淡出效果
            const fadeEnabled = this.settingManager && 
                this.settingManager.getSetting('fadeEnabled') === 'true';

            // 清除现有间隔
            if (this.volumeInterval) {
                clearInterval(this.volumeInterval);
                this.volumeInterval = null;
            }

            // 获取当前音量设置
            const currentVolume = this.settingManager ? 
                Math.max(0, this.settingManager.getSetting('volume') / 100) : 1;

            // 如果音量为0或禁用了淡入淡出效果，直接暂停
            if (!fadeEnabled || currentVolume === 0) {
                this.audio.pause();
                this.isPlayRequestPending = false;
                return;
            }

            // 保存当前音量，用于淡出后重置
            const originalVolume = this.audio.volume;

            // 启用淡入淡出时的逻辑
            this.volumeInterval = window.setInterval(() => {
                this.audio.volume = Math.max(0, this.audio.volume - 0.01);
                if (this.audio.volume <= 0.02) {
                    this.audio.volume = 0;
                    this.audio.pause();
                    // 重置音量为原始值，以便下次播放
                    this.audio.volume = originalVolume;
                    clearInterval(this.volumeInterval);
                    this.volumeInterval = null;
                    this.isPlayRequestPending = false;
                }
            }, 6);
        }
    }

    async play() {
        try {
            if (!this.audio.getAttribute('src')) {
                if (this.uimanager) {
                    this.uimanager.showNotification("无音频链接", "warning");
                }
                return;
            }
            
            // 防止快速连续点击
            if (this.isPlayRequestPending) return;
            
            const playButton = document.querySelector(".control>.buttons>.play");
            
            if (this.audio.paused) {
                // 立即更新UI，提供即时反馈
                playButton.classList = "play playing";
                await this.audioPlay();
                playButton.classList = "play played";
            } else {
                // 立即更新UI，提供即时反馈
                playButton.classList = "play pausing";
                this.audioPause();
                playButton.classList = "play paused";
            }
        } catch (e) {
            console.error("播放控制错误:", e);
            document.querySelector(".control>.buttons>.play").classList = "play paused";
            this.isPlayRequestPending = false;
            if (this.uimanager) {
                this.uimanager.showNotification("播放失败，正在重试...", "error");
            }
            // 添加短暂延迟再重试，避免立即重试可能导致的同样错误
            setTimeout(() => {
                this.playlistManager.tryPlayWithRetry(this.playlistManager.playlist[this.playlistManager.playingNow]);
            }, 1000);
        }
    }

    prev() {
        // 检查是否有请求正在处理中
        if (this.isPlayRequestPending || this.playlistManager.isLoading) {
            return;
        }
        
        // 重置音量和清除间隔
        if (this.volumeInterval) {
            clearInterval(this.volumeInterval);
            this.volumeInterval = null;
        }
        // 使用当前音量设置而不是强制设为1
        const currentVolume = this.settingManager ? 
            Math.max(0, this.settingManager.getSetting('volume') / 100) : 1;
        this.audio.volume = currentVolume;
    
        let prevIndex;
        if (this.playlistManager.playMode === 'shuffle') {
            // 随机播放
            prevIndex = Math.floor(Math.random() * this.playlistManager.playlist.length);
            while(prevIndex === this.playlistManager.playingNow && this.playlistManager.playlist.length > 1) {
                prevIndex = Math.floor(Math.random() * this.playlistManager.playlist.length);
            }
        } else {
            // 列表循环和单曲循环模式下都使用相同的上一首逻辑
            prevIndex = this.playlistManager.playingNow > 0 ? 
                this.playlistManager.playingNow - 1 : 
                this.playlistManager.playlist.length - 1;
        }
        
        this.playlistManager.setPlayingNow(prevIndex);
    }
    
    next() {
        // 检查是否有请求正在处理中
        if (this.isPlayRequestPending || this.playlistManager.isLoading) {
            return;
        }
        
        // 重置音量和清除间隔
        if (this.volumeInterval) {
            clearInterval(this.volumeInterval);
            this.volumeInterval = null;
        }
        // 使用当前音量设置而不是强制设为1
        const currentVolume = this.settingManager ? 
            Math.max(0, this.settingManager.getSetting('volume') / 100) : 1;
        this.audio.volume = currentVolume;
    
        let nextIndex;
        if (this.playlistManager.playMode === 'shuffle') {
            // 随机播放
            nextIndex = Math.floor(Math.random() * this.playlistManager.playlist.length);
            while(nextIndex === this.playlistManager.playingNow && this.playlistManager.playlist.length > 1) {
                nextIndex = Math.floor(Math.random() * this.playlistManager.playlist.length);
            }
        } else {
            // 列表循环和单曲循环模式下都使用相同的下一首逻辑
            nextIndex = this.playlistManager.playingNow < this.playlistManager.playlist.length - 1 ? 
                this.playlistManager.playingNow + 1 : 
                0;
        }
        
        this.playlistManager.setPlayingNow(nextIndex);
    }

    // 设置 settingManager 的方法

    setSettingManager(settingManager) {
        this.settingManager = settingManager;
        // 当settingManager被设置时，立即更新音量
        if (this.settingManager) {
            const currentVolume = Math.max(0, this.settingManager.getSetting('volume') / 100);
            this.audio.volume = currentVolume === 0 ? 0 : currentVolume;
        }
    }
    
    // 设置 uiManager 引用
    setUiManager(uiManager) {
        this.uimanager = uiManager;
    }
    
    // 添加事件监听器
    addEventListener(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    // 移除事件监听器
    removeEventListener(event, callback) {
        if (!this.eventListeners[event]) return;
        this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }

    // 触发事件
    dispatchEvent(event, data) {
        if (!this.eventListeners[event]) return;
        this.eventListeners[event].forEach(callback => {
            callback(data);
        });
    }

    // 重置播放状态
    resetPlayState() {
        this.isPlayRequestPending = false;
        if (this.volumeInterval) {
            clearInterval(this.volumeInterval);
            this.volumeInterval = null;
        }
        // 使用当前音量设置
        const currentVolume = this.settingManager ? 
            Math.max(0, this.settingManager.getSetting('volume') / 100) : 1;
        this.audio.volume = currentVolume;
    }
}

module.exports = AudioPlayer;
