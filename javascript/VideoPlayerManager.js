/**
 * 视频播放器管理器
 * 负责处理视频播放对话框和播放控制
 */
class VideoPlayerManager {
    constructor(playlistManager, uiManager) {
        this.playlistManager = playlistManager;
        this.uiManager = uiManager;
        this.videoPlayer = null;
        this.videoDialog = null;
        this.videoOverlay = null;
        this.videoTitle = null;
        this.currentVideoUrl = null;
        this.isLoading = false;
        this.loadingTimeout = null;
        this.isInitialized = false;
        
        // 使用DOMContentLoaded事件确保DOM已完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeElements();
                this.initializeEvents();
            });
        } else {
            // 如果DOM已加载，立即初始化
            this.initializeElements();
            this.initializeEvents();
        }
    }
    
    /**
     * 初始化DOM元素引用
     */
    initializeElements() {
        try {
            // 获取视频播放器相关元素
            this.videoPlayer = document.getElementById('videoPlayer');
            this.videoDialog = document.getElementById('videoPlayerDialog');
            this.videoOverlay = document.querySelector('.video-overlay');
            this.videoTitle = document.getElementById('videoTitle');
            
            // 检查元素是否存在
            if (!this.videoPlayer) {
                console.warn('找不到视频播放器元素 (#videoPlayer)，尝试创建');
                this.createVideoPlayerElements();
            }
            
            if (!this.videoDialog) {
                console.warn('找不到视频对话框元素 (#videoPlayerDialog)');
            }
            
            this.isInitialized = true;
            console.log('视频播放器组件初始化完成');
        } catch (error) {
            console.error('视频播放器元素初始化失败:', error);
        }
    }
    
    /**
     * 如果视频播放器元素不存在，创建必要的HTML结构
     */
    createVideoPlayerElements() {
        try {
            // 只有在元素不存在时才创建
            if (!document.getElementById('videoPlayer')) {
                // 检查容器是否存在
                let videoContainer = document.querySelector('.video-container');
                if (!videoContainer) {
                    // 如果没有容器，也要检查对话框是否存在
                    const videoDialog = document.getElementById('videoPlayerDialog');
                    if (!videoDialog) {
                        // 需要创建整个对话框
                        this.createVideoDialogStructure();
                        return;
                    }
                    
                    // 创建视频容器
                    videoContainer = document.createElement('div');
                    videoContainer.className = 'video-container';
                    const dialogContent = videoDialog.querySelector('.video-dialog') || videoDialog;
                    dialogContent.appendChild(videoContainer);
                }
                
                // 创建视频元素
                const videoPlayer = document.createElement('video');
                videoPlayer.id = 'videoPlayer';
                videoPlayer.controls = true;
                videoContainer.appendChild(videoPlayer);
                this.videoPlayer = videoPlayer;
                
                // 检查并创建覆盖层
                if (!document.querySelector('.video-overlay')) {
                    const overlay = document.createElement('div');
                    overlay.className = 'video-overlay hide';
                    overlay.innerHTML = `
                        <div class="video-message">
                            <i class="bi bi-exclamation-triangle"></i>
                            <span>无可用视频</span>
                        </div>
                    `;
                    videoContainer.appendChild(overlay);
                    this.videoOverlay = overlay;
                }
                
                console.log('已创建视频播放器元素');
            }
        } catch (error) {
            console.error('创建视频播放器元素失败:', error);
        }
    }
    
    /**
     * 创建完整的视频对话框结构
     */
    createVideoDialogStructure() {
        try {
            const dialogStructure = `
                <div class="dialog-bg hide" id="videoPlayerDialog">
                    <div class="dialog video-dialog">
                        <div class="dialog-header">
                            <h2>视频播放</h2>
                            <button class="close-btn" id="closeVideoDialog"><i class="bi bi-x"></i></button>
                        </div>
                        <div class="video-container">
                            <video id="videoPlayer" controls></video>
                            <div class="video-overlay hide">
                                <div class="video-message">
                                    <i class="bi bi-exclamation-triangle"></i>
                                    <span>无可用视频</span>
                                </div>
                            </div>
                        </div>
                        <div class="video-info">
                            <div class="video-title" id="videoTitle"></div>
                            <div class="video-controls">
                                <button id="fullscreenVideo"><i class="bi bi-fullscreen"></i></button>
                                <button id="pipVideo"><i class="bi bi-picture-in-picture"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // 添加到页面
            document.body.insertAdjacentHTML('beforeend', dialogStructure);
            
            // 更新引用
            this.videoDialog = document.getElementById('videoPlayerDialog');
            this.videoPlayer = document.getElementById('videoPlayer');
            this.videoOverlay = document.querySelector('.video-overlay');
            this.videoTitle = document.getElementById('videoTitle');
            
            console.log('已创建完整视频对话框结构');
            
            // 由于新创建了元素，需要重新绑定事件
            this.initializeEvents();
        } catch (error) {
            console.error('创建视频对话框结构失败:', error);
        }
    }
    
    initializeEvents() {
        // 播放视频按钮事件
        const playVideoBtn = document.getElementById('playVideoBtn');
        if (playVideoBtn) {
            // 防止重复绑定
            playVideoBtn.removeEventListener('click', this.handlePlayButtonClick);
            playVideoBtn.addEventListener('click', this.handlePlayButtonClick.bind(this));
        }
        
        // 关闭视频对话框事件
        const closeVideoDialog = document.getElementById('closeVideoDialog');
        if (closeVideoDialog) {
            closeVideoDialog.removeEventListener('click', this.handleCloseDialog);
            closeVideoDialog.addEventListener('click', this.handleCloseDialog.bind(this));
        }
        
        // 全屏按钮事件
        const fullscreenVideo = document.getElementById('fullscreenVideo');
        if (fullscreenVideo) {
            fullscreenVideo.removeEventListener('click', this.handleFullscreen);
            fullscreenVideo.addEventListener('click', this.handleFullscreen.bind(this));
        }
        
        // 画中画按钮事件
        const pipVideo = document.getElementById('pipVideo');
        if (pipVideo) {
            pipVideo.removeEventListener('click', this.handlePictureInPicture);
            pipVideo.addEventListener('click', this.handlePictureInPicture.bind(this));
        }
        
        // 视频对话框也可以按ESC关闭
        document.removeEventListener('keydown', this.handleKeydown);
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // 视频对话框点击背景关闭
        const videoDialog = document.getElementById('videoPlayerDialog');
        if (videoDialog) {
            videoDialog.removeEventListener('click', this.handleDialogBackgroundClick);
            videoDialog.addEventListener('click', this.handleDialogBackgroundClick.bind(this));
        }
        
        // 在可能的情况下添加视频播放完毕后自动循环
        if (this.videoPlayer) {
            this.videoPlayer.removeEventListener('ended', this.handleVideoEnded);
            this.videoPlayer.addEventListener('ended', this.handleVideoEnded.bind(this));
        }
        
        console.log('视频播放器事件初始化完成');
    }
    
    // 事件处理方法，方便移除监听器
    handlePlayButtonClick() {
        const playVideoBtn = document.getElementById('playVideoBtn');
        if (playVideoBtn && playVideoBtn.classList.contains('disabled')) {
            this.uiManager.showNotification('当前歌曲没有可用视频', 'warning');
            return;
        }
        this.openVideoPlayer();
    }
    
    handleCloseDialog() {
        this.closeVideoPlayer();
    }
    
    handleFullscreen() {
        this.toggleFullscreen();
    }
    
    handlePictureInPicture() {
        this.togglePictureInPicture();
    }
    
    handleKeydown(e) {
        if (e.key === 'Escape') {
            const videoDialog = document.getElementById('videoPlayerDialog');
            if (videoDialog && !videoDialog.classList.contains('hide')) {
                this.closeVideoPlayer();
            }
        }
    }
    
    handleDialogBackgroundClick(e) {
        if (e.target.id === 'videoPlayerDialog') {
            this.closeVideoPlayer();
        }
    }
    
    handleVideoEnded() {
        // 重置视频并重新播放
        if (this.videoPlayer) {
            this.videoPlayer.currentTime = 0;
            this.videoPlayer.play().catch(err => console.warn('视频重播失败:', err));
        }
    }
    
    /**
     * 打开视频播放器
     */
    async openVideoPlayer() {
        try {
            if (this.isLoading) return;
            
            // 如果未初始化，重新初始化
            if (!this.isInitialized) {
                this.initializeElements();
            }
            
            // 再次验证视频播放器元素是否存在
            const videoPlayer = document.getElementById('videoPlayer');
            const videoDialog = document.getElementById('videoPlayerDialog');
            
            if (!videoPlayer || !videoDialog) {
                // 如果仍然找不到，尝试创建
                this.createVideoPlayerElements();
                
                // 再次检查
                if (!document.getElementById('videoPlayer')) {
                    throw new Error('无法创建视频播放器元素');
                }
            }
            
            // 更新引用以确保使用最新的元素
            this.videoPlayer = document.getElementById('videoPlayer');
            this.videoDialog = document.getElementById('videoPlayerDialog');
            this.videoOverlay = document.querySelector('.video-overlay');
            this.videoTitle = document.getElementById('videoTitle');
            
            this.isLoading = true;
            
            // 显示对话框，先重置视频源
            this.videoPlayer.src = '';
            this.videoPlayer.load();
            this.videoDialog.classList.remove('hide');
            
            // 显示加载中状态
            if (this.videoOverlay) {
                this.videoOverlay.classList.remove('hide');
                this.videoOverlay.innerHTML = `
                    <div class="video-message">
                        <div class="loading-spinner"></div>
                        <span>正在加载视频...</span>
                    </div>
                `;
            }
            
            // 添加加载超时
            if (this.loadingTimeout) {
                clearTimeout(this.loadingTimeout);
            }
            
            this.loadingTimeout = setTimeout(() => {
                if (this.isLoading) {
                    if (this.videoOverlay) {
                        this.videoOverlay.classList.remove('hide');
                        this.videoOverlay.innerHTML = `
                            <div class="video-message">
                                <i class="bi bi-exclamation-triangle"></i>
                                <span>视频加载超时，请重试</span>
                            </div>
                        `;
                    }
                    this.isLoading = false;
                }
            }, 15000); // 15秒超时
            
            // 获取当前播放歌曲的视频URL
            const videoUrl = await this.playlistManager.getCurrentVideoUrl();
            
            // 清除超时定时器
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
            
            // 如果没有视频URL，显示提示
            if (!videoUrl) {
                if (this.videoOverlay) {
                    this.videoOverlay.classList.remove('hide');
                    this.videoOverlay.innerHTML = `
                        <div class="video-message">
                            <i class="bi bi-exclamation-triangle"></i>
                            <span>当前歌曲没有可用视频</span>
                        </div>
                    `;
                }
                if (this.videoTitle) {
                    this.videoTitle.textContent = '无可用视频';
                }
                this.isLoading = false;
                return;
            }
            
            // 更新视频标题
            if (this.videoTitle) {
                const currentSong = this.playlistManager.playlist[this.playlistManager.playingNow];
                this.videoTitle.textContent = currentSong ? currentSong.title : '正在播放';
            }
            
            // 清理旧的事件监听器
            this.removeVideoEventListeners();
            
            // 添加视频事件监听器
            this.videoPlayer.addEventListener('loadeddata', this.handleVideoLoaded.bind(this));
            this.videoPlayer.addEventListener('error', this.handleVideoError.bind(this));
            this.videoPlayer.addEventListener('playing', () => {
                if (this.videoOverlay) this.videoOverlay.classList.add('hide');
            });
            
            // 设置视频源并加载
            console.log('设置视频源:', videoUrl);
            this.videoPlayer.src = videoUrl;
            this.currentVideoUrl = videoUrl;
            this.videoPlayer.load();
            
            // 添加音频事件监听，确保视频与音频同步
            this.setupAudioSyncEvents();
            
        } catch (error) {
            console.error('打开视频播放器失败:', error);
            this.uiManager.showNotification('视频播放失败: ' + error.message, 'error');
            this.isLoading = false;
            
            // 显示错误信息在对话框中
            try {
                const videoDialog = document.getElementById('videoPlayerDialog');
                const videoOverlay = document.querySelector('.video-overlay');
                
                if (videoDialog && !videoDialog.classList.contains('hide')) {
                    if (videoOverlay) {
                        videoOverlay.classList.remove('hide');
                        videoOverlay.innerHTML = `
                            <div class="video-message">
                                <i class="bi bi-exclamation-triangle"></i>
                                <span>视频加载失败: ${error.message}</span>
                            </div>
                        `;
                    }
                }
            } catch (e) {
                console.error('无法显示错误信息:', e);
            }
        }
    }
    
    /**
     * 设置音频同步事件
     * 确保视频状态与音频保持一致
     */
    setupAudioSyncEvents() {
        // 获取音频播放器引用
        const audioPlayer = this.playlistManager.audioPlayer;
        if (!audioPlayer || !audioPlayer.audio || !this.videoPlayer) return;
        
        // 移除之前可能存在的事件监听器
        this.removeAudioSyncEvents();
        
        // 显示同步指示器
        const syncIndicator = document.querySelector('.sync-indicator');
        if (syncIndicator) {
            syncIndicator.classList.add('active');
            // 5秒后隐藏指示器
            setTimeout(() => {
                syncIndicator.classList.remove('active');
            }, 5000);
        }
        
        // 存储事件处理函数的引用，以便后续移除
        this.audioEventHandlers = {
            // 音频事件 -> 视频响应
            play: () => {
                if (this.videoPlayer.paused) {
                    this.videoPlayer.play().catch(err => console.warn('视频同步播放失败:', err));
                }
            },
            pause: () => {
                if (!this.videoPlayer.paused) {
                    this.videoPlayer.pause();
                }
            },
            seeking: () => {
                if (Math.abs(audioPlayer.audio.currentTime - this.videoPlayer.currentTime) > 0.3) {
                    this.videoPlayer.currentTime = audioPlayer.audio.currentTime;
                }
            },
            ratechange: () => {
                if (audioPlayer.audio.playbackRate !== this.videoPlayer.playbackRate) {
                    this.videoPlayer.playbackRate = audioPlayer.audio.playbackRate;
                }
            },
            volumechange: () => {
                // 同步音量变化
                this.videoPlayer.volume = audioPlayer.audio.volume;
                this.videoPlayer.muted = audioPlayer.audio.muted;
            }
        };
        
        // 视频事件 -> 音频响应
        this.videoEventHandlers = {
            play: () => {
                if (audioPlayer.audio.paused) {
                    audioPlayer.audioPlay().catch(err => console.warn('音频同步播放失败:', err));
                }
            },
            pause: () => {
                if (!audioPlayer.audio.paused) {
                    audioPlayer.audioPause();
                }
            },
            seeking: () => {
                if (Math.abs(this.videoPlayer.currentTime - audioPlayer.audio.currentTime) > 0.3) {
                    audioPlayer.audio.currentTime = this.videoPlayer.currentTime;
                }
            },
            ratechange: () => {
                if (this.videoPlayer.playbackRate !== audioPlayer.audio.playbackRate) {
                    audioPlayer.audio.playbackRate = this.videoPlayer.playbackRate;
                }
            },
            volumechange: () => {
                // 只有在用户直接操作视频控件时同步音量
                if (this.isUserVolumeChange) {
                    audioPlayer.audio.volume = this.videoPlayer.volume;
                    audioPlayer.audio.muted = this.videoPlayer.muted;
                    this.isUserVolumeChange = false;
                }
            }
        };
        
        // 监听视频播放器上的用户交互，用于识别用户直接操作视频控件
        this.videoPlayer.addEventListener('mousedown', () => {
            this.isUserVolumeChange = true;
        });
        
        // 添加音频事件监听器
        audioPlayer.audio.addEventListener('play', this.audioEventHandlers.play);
        audioPlayer.audio.addEventListener('pause', this.audioEventHandlers.pause);
        audioPlayer.audio.addEventListener('seeking', this.audioEventHandlers.seeking);
        audioPlayer.audio.addEventListener('ratechange', this.audioEventHandlers.ratechange);
        audioPlayer.audio.addEventListener('volumechange', this.audioEventHandlers.volumechange);
        
        // 添加视频事件监听器
        this.videoPlayer.addEventListener('play', this.videoEventHandlers.play);
        this.videoPlayer.addEventListener('pause', this.videoEventHandlers.pause);
        this.videoPlayer.addEventListener('seeking', this.videoEventHandlers.seeking);
        this.videoPlayer.addEventListener('ratechange', this.videoEventHandlers.ratechange);
        this.videoPlayer.addEventListener('volumechange', this.videoEventHandlers.volumechange);
        
        // 添加定期同步机制，以防音频视频在长时间播放后出现偏差
        this.syncInterval = setInterval(() => {
            if (!audioPlayer.audio.paused && !this.videoPlayer.paused) {
                // 如果时间差超过0.3秒，才进行同步
                if (Math.abs(this.videoPlayer.currentTime - audioPlayer.audio.currentTime) > 0.3) {
                    // 使用更平滑的方式同步（不是立即跳转）
                    const currentDiff = this.videoPlayer.currentTime - audioPlayer.audio.currentTime;
                    const adjustment = currentDiff > 0 ? 
                        Math.min(0.05, currentDiff / 10) : 
                        Math.max(-0.05, currentDiff / 10);
                        
                    this.videoPlayer.playbackRate = audioPlayer.audio.playbackRate * (1 - adjustment);
                    
                    // 如果差异太大，直接同步
                    if (Math.abs(currentDiff) > 1) {
                        this.videoPlayer.currentTime = audioPlayer.audio.currentTime;
                    }
                    
                    // 闪烁同步指示器提示用户正在同步
                    if (syncIndicator) {
                        syncIndicator.classList.add('active');
                        setTimeout(() => {
                            syncIndicator.classList.remove('active');
                        }, 2000);
                    }
                } else {
                    // 恢复正常播放速率
                    this.videoPlayer.playbackRate = audioPlayer.audio.playbackRate;
                }
            }
        }, 5000); // 每5秒检查一次
        
        // 初始同步
        this.videoPlayer.currentTime = audioPlayer.audio.currentTime;
        this.videoPlayer.volume = audioPlayer.audio.volume;
        this.videoPlayer.muted = audioPlayer.audio.muted;
        
        if (!audioPlayer.audio.paused) {
            this.videoPlayer.play().catch(err => console.warn('视频初始播放失败:', err));
        }
        
        // 同步播放速率
        this.videoPlayer.playbackRate = audioPlayer.audio.playbackRate;
        
        console.log('已设置音频-视频双向同步事件');
    }
    
    /**
     * 移除音频同步事件
     */
    removeAudioSyncEvents() {
        // 清除同步定时器
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        // 如果有存储的事件处理函数，移除它们
        if (this.audioEventHandlers && this.playlistManager.audioPlayer && this.playlistManager.audioPlayer.audio) {
            const audioPlayer = this.playlistManager.audioPlayer;
            
            audioPlayer.audio.removeEventListener('play', this.audioEventHandlers.play);
            audioPlayer.audio.removeEventListener('pause', this.audioEventHandlers.pause);
            audioPlayer.audio.removeEventListener('seeking', this.audioEventHandlers.seeking);
            audioPlayer.audio.removeEventListener('ratechange', this.audioEventHandlers.ratechange);
            audioPlayer.audio.removeEventListener('volumechange', this.audioEventHandlers.volumechange);
            
            this.audioEventHandlers = null;
        }
        
        // 移除视频事件监听器
        if (this.videoEventHandlers && this.videoPlayer) {
            this.videoPlayer.removeEventListener('play', this.videoEventHandlers.play);
            this.videoPlayer.removeEventListener('pause', this.videoEventHandlers.pause);
            this.videoPlayer.removeEventListener('seeking', this.videoEventHandlers.seeking);
            this.videoPlayer.removeEventListener('ratechange', this.videoEventHandlers.ratechange);
            this.videoPlayer.removeEventListener('volumechange', this.videoEventHandlers.volumechange);
            
            this.videoEventHandlers = null;
        }
        
        // 隐藏同步指示器
        const syncIndicator = document.querySelector('.sync-indicator');
        if (syncIndicator) {
            syncIndicator.classList.remove('active');
        }
    }
    
    /**
     * 移除视频事件监听器
     */
    removeVideoEventListeners() {
        if (!this.videoPlayer) return;
        
        // 创建一个新的视频元素替换旧的，以清除所有事件监听器
        const parent = this.videoPlayer.parentNode;
        if (parent) {
            const oldPlayer = this.videoPlayer;
            const newPlayer = document.createElement('video');
            
            // 复制属性
            newPlayer.id = oldPlayer.id;
            newPlayer.controls = oldPlayer.controls;
            newPlayer.className = oldPlayer.className;
            
            // 替换元素
            parent.replaceChild(newPlayer, oldPlayer);
            this.videoPlayer = newPlayer;
        }
    }
    
    /**
     * 处理视频加载完成事件
     */
    handleVideoLoaded() {
        console.log('视频加载完成');
        const videoOverlay = document.querySelector('.video-overlay');
        
        // 隐藏加载覆盖层
        if (videoOverlay) {
            videoOverlay.classList.add('hide');
        }
        
        // 同步到当前音频播放位置
        if (this.playlistManager.audioPlayer && this.playlistManager.audioPlayer.audio) {
            this.videoPlayer.currentTime = this.playlistManager.audioPlayer.audio.currentTime;
        }
        
        // 自动播放，但仅当音频正在播放时
        if (this.playlistManager.audioPlayer && 
            this.playlistManager.audioPlayer.audio && 
            !this.playlistManager.audioPlayer.audio.paused) {
            
            this.videoPlayer.play().catch(error => {
                console.warn('自动播放视频失败:', error);
                this.uiManager.showNotification('请点击视频开始播放', 'info');
            });
        }
        
        this.isLoading = false;
    }
    
    /**
     * 处理视频加载错误事件
     */
    handleVideoError(event) {
        console.error('视频加载失败:', event);
        const videoOverlay = document.querySelector('.video-overlay');
        
        if (videoOverlay) {
            videoOverlay.classList.remove('hide');
            videoOverlay.querySelector('.video-message').innerHTML = `
                <i class="bi bi-exclamation-triangle"></i>
                <span>视频加载失败，请重试</span>
            `;
        }
        
        this.isLoading = false;
    }
    
    /**
     * 关闭视频播放器
     */
    closeVideoPlayer() {
        const videoDialog = document.getElementById('videoPlayerDialog');
        if (!videoDialog) return;
        
        // 暂停视频并清除源
        if (this.videoPlayer) {
            this.videoPlayer.pause();
            this.videoPlayer.removeAttribute('src');
            this.videoPlayer.load();
        }
        
        // 隐藏对话框
        videoDialog.classList.add('hide');
        
        // 释放资源
        this.currentVideoUrl = null;
        this.isLoading = false;
        
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }
        
        // 移除音频同步事件
        this.removeAudioSyncEvents();
    }
    
    /**
     * 切换全屏模式
     */
    toggleFullscreen() {
        if (!this.videoPlayer) return;
        
        try {
            if (!document.fullscreenElement) {
                // 进入全屏
                if (this.videoPlayer.requestFullscreen) {
                    this.videoPlayer.requestFullscreen();
                } else if (this.videoPlayer.webkitRequestFullscreen) { /* Safari */
                    this.videoPlayer.webkitRequestFullscreen();
                } else if (this.videoPlayer.msRequestFullscreen) { /* IE11 */
                    this.videoPlayer.msRequestFullscreen();
                }
            } else {
                // 退出全屏
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) { /* Safari */
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) { /* IE11 */
                    document.msExitFullscreen();
                }
            }
        } catch (error) {
            console.error('切换全屏失败:', error);
            this.uiManager.showNotification('全屏模式切换失败', 'error');
        }
    }
    
    /**
     * 切换画中画模式
     */
    async togglePictureInPicture() {
        if (!this.videoPlayer) return;
        
        try {
            if (document.pictureInPictureElement) {
                // 已经在画中画模式，退出
                await document.exitPictureInPicture();
            } else if (document.pictureInPictureEnabled) {
                // 进入画中画模式
                await this.videoPlayer.requestPictureInPicture();
            } else {
                this.uiManager.showNotification('您的浏览器不支持画中画模式', 'warning');
            }
        } catch (error) {
            console.error('画中画模式切换失败:', error);
            this.uiManager.showNotification('画中画模式切换失败', 'error');
        }
    }
    
    /**
     * 检查当前播放歌曲是否有视频
     * @returns {Promise<boolean>} 有视频返回true，否则返回false
     */
    async checkCurrentSongHasVideo() {
        try {
            // 如果没有播放列表或当前没有播放歌曲，则返回false
            if (!this.playlistManager || 
                !this.playlistManager.playlist || 
                this.playlistManager.playlist.length === 0 ||
                this.playlistManager.playingNow < 0) {
                return false;
            }
            
            const currentSong = this.playlistManager.playlist[this.playlistManager.playingNow];
            
            // 检查是否本地歌曲且有视频
            if (currentSong.isLocal && currentSong.videoUrl) {
                return true;
            }
            
            // 如果已有视频URL且未过期，直接返回true
            if (currentSong.video && !this.playlistManager.isUrlExpired(currentSong.video)) {
                return true;
            }
            
            // 尝试获取视频URL
            try {
                const videoUrl = await this.playlistManager.getCurrentVideoUrl();
                return !!videoUrl; // 转换为布尔值
            } catch (error) {
                console.warn('视频URL获取失败:', error);
                return false;
            }
        } catch (error) {
            console.error('检查视频可用性失败:', error);
            return false;
        }
    }
    
    /**
     * 更新视频播放按钮状态
     */
    async updateVideoButtonState() {
        try {
            const playVideoBtn = document.getElementById('playVideoBtn');
            if (!playVideoBtn) return;
            
            // 显示加载状态
            playVideoBtn.innerHTML = '<i class="bi bi-arrow-repeat rotating"></i>';
            playVideoBtn.setAttribute('title', '正在检查视频...');
            playVideoBtn.classList.add('checking');
            
            const hasVideo = await this.checkCurrentSongHasVideo();
            
            if (hasVideo) {
                playVideoBtn.classList.remove('disabled');
                playVideoBtn.classList.remove('checking');
                playVideoBtn.setAttribute('title', '观看视频');
                playVideoBtn.innerHTML = '<i class="bi bi-film"></i>';
            } else {
                playVideoBtn.classList.add('disabled');
                playVideoBtn.classList.remove('checking');
                playVideoBtn.setAttribute('title', '无可用视频');
                playVideoBtn.innerHTML = '<i class="bi bi-film-slash"></i>';
            }
        } catch (error) {
            console.error('更新视频按钮状态失败:', error);
            const playVideoBtn = document.getElementById('playVideoBtn');
            if (playVideoBtn) {
                playVideoBtn.classList.remove('checking');
                playVideoBtn.classList.add('disabled');
                playVideoBtn.setAttribute('title', '视频检查失败');
                playVideoBtn.innerHTML = '<i class="bi bi-film-slash"></i>';
            }
        }
    }
}

module.exports = VideoPlayerManager;
