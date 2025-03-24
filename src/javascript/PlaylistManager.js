const axios = require('axios');

class PlaylistManager {
    constructor(audioPlayer, lyricsPlayer, uiManager) {
        this.playlist = [];
        this.playingNow = 0;
        this.playlistName = "默认歌单";
        this.audioPlayer = audioPlayer;
        this.lyricsPlayer = lyricsPlayer;
        this.uiManager = uiManager;
        this.urlExpiryTimes = new Map();
        this.URL_VALIDITY_DURATION = 120 * 60 * 1000; // 120分钟
        this.isLoading = false;
        this.currentTime = 0;
        this.currentLoadingController = null;
        this.currentPlayingBvid = null;
        // 用于随机播放
        this.shuffledlist = [];
        // 'repeat', 'shuffle', 'repeat-one'
        this.playMode = localStorage.getItem('nbmusic_play_mode') || 'repeat';

        // 初始化时更新UI显示
        const playModeIcon = document.querySelector('.playmode i');
        if (playModeIcon) {
            switch (this.playMode) {
                case 'shuffle':
                    playModeIcon.className = 'bi bi-shuffle';
                    break;
                case 'repeat':
                    playModeIcon.className = 'bi bi-repeat';
                    break;
                case 'repeat-one':
                    playModeIcon.className = 'bi bi-repeat-1';
                    break;
            }
        }
        this.loadPlaylists();
    }
    next() {
        if (this.playlist.length === 0) return;
        
        let nextIndex;
        switch (this.playMode) {
            case 'shuffle':
                // 随机播放
                if (!this.shuffledlist.length) {
                    this.shuffledlist = Array.from({length:this.playlist.length},(_, i)=>i);
                    // Fisher-Yates算法，打乱顺序
                    for (let i = 1; i < this.shuffledlist.length; i++) {
                        const random = Math.floor(Math.random() * (i + 1));
                        [this.shuffledlist[i], this.shuffledlist[random]] = [this.shuffledlist[random], this.shuffledlist[i]];
                    }
                 }
                nextIndex = this.shuffledlist.shift();
                // 检测是否已经循环完一轮
                if (!nextIndex) {
                    // 在重新打乱前临时放第一首
                    nextIndex = 0;
                }
                break;
            case 'repeat-one':
                // 单曲循环
                nextIndex = this.playingNow;
                break;
            case 'repeat':
            default:
                // 列表循环
                nextIndex = (this.playingNow + 1) % this.playlist.length;
                break;
        }

        this.setPlayingNow(nextIndex);
    }
    togglePlayMode() {
        const modes = ['repeat', 'shuffle', 'repeat-one'];
        const currentIndex = modes.indexOf(this.playMode);
        this.playMode = modes[(currentIndex + 1) % modes.length];

        // 更新UI
        const playModeIcon = document.querySelector('.playmode i');
        switch (this.playMode) {
            case 'shuffle':
                playModeIcon.className = 'bi bi-shuffle';
                break;
            case 'repeat':
                playModeIcon.className = 'bi bi-repeat';
                break;
            case 'repeat-one':
                playModeIcon.className = 'bi bi-repeat-1';
                break;
        }
        // 保存设置
        localStorage.setItem('nbmusic_play_mode', this.playMode);
    }
    bulkDeleteSongs(songIds) {
        try {
            songIds.forEach(bvid => {
                const index = this.playlist.findIndex(item => item.bvid === bvid);
                if (index !== -1) {
                    this.playlist.splice(index, 1);
                }
            });
            this.savePlaylists();
            this.uiManager.renderPlaylist();
        } catch (error) {
            console.error("批量删除歌曲失败:", error);
        }
    }

    // 新增：根据新的顺序数组重新排序歌单（newOrder 为 bvid 数组）
    reorderPlaylist(newOrder) {
        try {
            const newPlaylist = [];
            newOrder.forEach(bvid => {
                const song = this.playlist.find(item => item.bvid === bvid);
                if (song) newPlaylist.push(song);
            });
            // 将未包含在 newOrder 中的歌曲追加到末尾
            this.playlist.forEach(song => {
                if (!newOrder.includes(song.bvid)) {
                    newPlaylist.push(song);
                }
            });
            this.playlist = newPlaylist;
            this.savePlaylists();
            this.uiManager.renderPlaylist();
        } catch (error) {
            console.error("调整歌单顺序失败:", error);
        }
    }
    async cropImageToSquare(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = Math.min(img.width, img.height);
                canvas.width = size;
                canvas.height = size;

                const ctx = canvas.getContext('2d');
                const offsetX = (img.width - size) / 2;
                const offsetY = (img.height - size) / 2;

                ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);

                resolve({
                    url: canvas.toDataURL('image/jpeg', 0.8),
                    size: `${size}x${size}`
                });
            };

            img.onerror = reject;
            img.src = imageUrl;
        });
    }

    async tryGetVideoUrl(bvid, cid, maxRetries = 2) {
        // 先检查cid是否有效，如果无效则尝试获取
        if (!cid) {
            try {
                const cidResponse = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
                if (cidResponse.data.code === 0) {
                    cid = cidResponse.data.data.cid;
                }
                
                if (!cid) {
                    throw new Error('无法获取视频CID');
                }
            } catch (error) {
                console.error('获取CID失败:', error);
                throw new Error('获取视频信息失败');
            }
        }
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                // 使用musicSearcher获取视频URL，现在会考虑质量设置
                const videoUrl = await this.musicSearcher.getBilibiliVideoUrl(bvid, cid);
                // 检查URL是否可以访问
                const response = await axios.get(videoUrl);
                if (response.status === 200) {
                    return videoUrl;
                }
            } catch (error) {
                console.error(`视频链接获取尝试 ${i + 1} 失败:`, error);
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        throw new Error('无法获取有效的视频链接');
    }

    isUrlExpired(url) {
        const expiryTime = this.urlExpiryTimes.get(url);
        return !expiryTime || Date.now() > expiryTime;
    }

    updateUrlExpiryTime(url) {
        this.urlExpiryTimes.set(url, Date.now() + this.URL_VALIDITY_DURATION);
    }

    async addSong(song, event) {
        try {
            if (event) {
                event.stopPropagation();
            }
            this.playlist.push(song);
            if (this.musiclistManager) {
                this.musiclistManager.handlePlaylistUpdate();
            }
            this.savePlaylists();

            const songElement = this.uiManager.createSongElement(song);
            songElement.classList.add('adding');

            const playingList = document.querySelector("#playing-list");
            playingList.appendChild(songElement);
            songElement.offsetHeight;

            requestAnimationFrame(() => {
                songElement.classList.remove('adding');
                songElement.classList.add('flash');
                setTimeout(() => {
                    songElement.classList.remove('flash');
                }, 800);
            });
        } catch (error) {
            console.error("添加歌曲失败:", error);
        }
    }

    removeSong(bvid, event) {
        try {
            if (event) {
                event.stopPropagation();
            }
            const songElement = document.querySelector(`#playing-list .song[data-bvid="${bvid}"]`);
            if (!songElement) return;

            songElement.classList.add('removing');

            songElement.addEventListener('transitionend', () => {
                const index = this.playlist.findIndex((item) => item.bvid === bvid);
                if (index !== -1) {
                    this.playlist.splice(index, 1);
                    this.savePlaylists();

                    if (index === this.playingNow) {
                        this.setPlayingNow(Math.min(this.playingNow, this.playlist.length - 1));
                    } else if (index < this.playingNow) {
                        this.playingNow--;
                    }
                    if (this.musiclistManager) {
                        this.musiclistManager.handlePlaylistUpdate();
                    }
                }
            }, { once: true });
        } catch (error) {
            console.error("删除歌曲失败:", error);
        }
    }

    async setPlayingNow(index, replay = true) {
        try {
            if (this.playlist.length === 0) {
                this.uiManager.showDefaultUi();
                return;
            }

            if (index < 0 || index >= this.playlist.length) {
                throw new Error("无效的播放索引");
            }

            const song = this.playlist[index];

            // 如果正在加载同一首歌，直接返回
            if (this.currentPlayingBvid === song.bvid && this.isLoading) {
                return;
            }

            // 尝试获取并保存当前音频进度
            try {
                // 如果切换到另一首歌，保存当前歌曲的播放进度到 localStorage
                if (this.playingNow !== index && this.audioPlayer && this.audioPlayer.audio) {
                    const currentSong = this.playlist[this.playingNow];
                    if (currentSong && currentSong.bvid) {
                        const progressKey = `nbmusic_song_progress_${currentSong.bvid}`;
                        localStorage.setItem(progressKey, this.audioPlayer.audio.currentTime);
                    }
                }
            } catch (e) {
                console.warn('保存进度失败:', e);
            }

            // 中断当前正在进行的加载
            if (this.currentLoadingController) {
                this.currentLoadingController.abort();
            }
            this.currentLoadingController = new AbortController();

            // 更新当前加载状态
            this.isLoading = true;
            this.currentPlayingBvid = song.bvid;
            this.playingNow = index;

            // 检查是否有保存的播放进度
            let savedProgress = 0;
            try {
                const progressKey = `nbmusic_song_progress_${song.bvid}`;
                const savedTime = localStorage.getItem(progressKey);
                if (savedTime) {
                    savedProgress = parseFloat(savedTime);
                }
            } catch (e) {
                console.warn('读取保存的进度失败:', e);
            }

            // 如果是恢复播放且有保存的进度，则使用保存的进度
            if (!replay && (savedProgress > 0 || this.currentTime > 0)) {
                // 优先使用歌曲特有的进度，其次使用通用进度
                this.currentTime = savedProgress || this.currentTime;
            }

            // 立即更新UI以提供视觉反馈
            await this.updatePlayingUI(song, replay);

            // 异步加载和播放音频
            this.loadAndPlayAudio(song, replay, this.currentLoadingController.signal)
                .catch(error => {
                    if (error.name === 'AbortError') {
                        console.log('加载被中断');
                    } else {
                        console.error("播放失败:", error);
                        document.querySelector(".control>.buttons>.play").classList = "play paused";
                    }
                })
                .finally(() => {
                    if (this.currentPlayingBvid === song.bvid) {
                        this.isLoading = false;
                        
                        // 更新歌单中的播放位置
                        this.savePlaylists();
                    }
                });

        } catch (error) {
            console.error("设置当前播放失败:", error);
            document.querySelector(".control>.buttons>.play").classList = "play paused";
        }
    }

    async updatePlayingUI(song, replay) {
        // 更新歌词
        this.lyricsPlayer.changeLyrics(song.lyric);

        // 更新播放列表UI
        const oldPlayingElement = document.querySelector("#playing-list .song.playing");
        const newPlayingElement = document.querySelector(`#playing-list .song[data-bvid="${song.bvid}"]`);

        if (oldPlayingElement) {
            oldPlayingElement.style.transition = 'all 0.3s ease';
            oldPlayingElement.classList.remove("playing");
            oldPlayingElement.classList.add("fade-out");
        }

        if (newPlayingElement) {
            newPlayingElement.classList.add("playing");
            newPlayingElement.classList.add("flash");
            newPlayingElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
            setTimeout(() => {
                newPlayingElement.classList.remove("flash");
            }, 800);
        }

        // 更新封面图片
        const coverImg = document.querySelector(".player-content .cover .cover-img");
        coverImg.style.opacity = '0';

        setTimeout(() => {
            this.updateUIForCurrentSong(song);
            coverImg.style.opacity = '1';
        }, 300);
    }
    async tryPlayWithRetry(song, maxRetries = 2) {
        let lastError;
        const playButton = document.querySelector(".control>.buttons>.play");
        playButton.disabled = true;
        const progressBar = document.querySelector(".player .control .progress .progress-bar .progress-bar-inner");
        progressBar.classList.add('loading');
        const cacheEnabled = this.settingManager.getSetting("cacheEnabled");

        // 清除之前的超时
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
        }

        // 设置新的超时
        this.loadingTimeout = setTimeout(() => {
            if (this.isLoading) {
                // 超时后取消加载
                console.warn('音频加载超时，正在取消请求');
                if (this.currentLoadingController) {
                    this.currentLoadingController.abort();
                }
                this.isLoading = false;
                playButton.disabled = false;
                progressBar.classList.remove('loading');
                this.uiManager.showNotification('加载超时，请重试', 'error');
            }
        }, this.requestTimeoutMs);
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                let currentUrl = song.audio;
                
                // 处理本地文件 - 本地文件使用blob URL或data URL
                if (song.isLocal && song.audioFile) {
                    this.audioPlayer.audio.src = song.audio;
                    await this.audioPlayer.audio.play();
                    document.querySelector(".control>.buttons>.play").classList = "play played";
                    
                    // 清除超时
                    clearTimeout(this.loadingTimeout);
                    this.loadingTimeout = null;
                    
                    return;
                }
                
                if (cacheEnabled) {
                    const cached = this.cacheManager.getCachedItem("audio_" + song.bvid);
                    if (cached) {
                        currentUrl = cached;
                        song.audio = currentUrl;
                    }
                }
                
                // 如果URL过期或之前尝试失败，获取新URL
                if (this.isUrlExpired(currentUrl) || lastError || !currentUrl) {
                    const urls = await this.musicSearcher.getAudioLink(song.bvid, true);
                    currentUrl = urls[0];
                    song.audio = currentUrl;
                    this.updateUrlExpiryTime(currentUrl);
                    this.savePlaylists();
                    if (cacheEnabled) {
                        this.cacheManager.cacheItem("audio_" + song.bvid, currentUrl);
                    }
                }
                
                // 为非本地文件检查URL可用性
                if (!song.isLocal) {
                    try {
                        const response = await axios.get(currentUrl, { 
                            timeout: 5000,
                            validateStatus: status => status !== 403 // 只将403视为错误
                        });
                        
                        if (response.status === 403) {
                            throw new Error('访问被拒绝');
                        }
                    } catch (error) {
                        console.warn('主音频URL不可用，尝试备用URL');
                        const urls = await this.musicSearcher.getAudioLink(song.bvid, true);
                        currentUrl = urls.length > 1 ? urls[1] : urls[0];
                        song.audio = currentUrl;
                        this.updateUrlExpiryTime(currentUrl);
                        this.savePlaylists();
                        if (cacheEnabled) {
                            this.cacheManager.cacheItem("audio_" + song.bvid, currentUrl);
                        }
                    }
                }
                
                this.audioPlayer.audio.src = currentUrl;
                await this.audioPlayer.audio.play();
                document.querySelector(".control>.buttons>.play").classList = "play played";
                
                // 清除超时
                clearTimeout(this.loadingTimeout);
                this.loadingTimeout = null;
                
                return;
            } catch (error) {
                lastError = error;
                console.error(`播放尝试 ${attempt + 1} 失败:`, error);
                
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                } else {
                    document.querySelector(".control>.buttons>.play").classList = "play paused";
                    this.uiManager.showNotification('播放出错: ' + error.message, 'error');
                }
            } finally {
                this.isLoading = false;
                playButton.disabled = false;
                progressBar.classList.remove('loading');
                
                // 清除超时
                clearTimeout(this.loadingTimeout);
                this.loadingTimeout = null;
            }
        }
    }
    async loadAndPlayAudio(song, replay, signal) {
        const playButton = document.querySelector(".control>.buttons>.play");
        const progressBar = document.querySelector(".player .control .progress .progress-bar .progress-bar-inner");

        try {
            playButton.disabled = true;
            progressBar.classList.add('loading');

            // 重置播放进度和音量
            this.resetPlaybackState(replay);

            // 获取并设置音频
            const audioUrl = await this.getAudioUrl(song, signal);
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

            this.audioPlayer.audio.src = audioUrl;

            // 处理播放进度恢复逻辑
            // 1. 如果不是重放且有保存的播放进度，则恢复进度
            if (!replay && this.currentTime > 0) {
                // 确保进度有效（不超过音频长度）
                this.audioPlayer.audio.addEventListener('loadedmetadata', () => {
                    if (this.currentTime < this.audioPlayer.audio.duration) {
                        this.audioPlayer.audio.currentTime = this.currentTime;
                    }
                    this.currentTime = 0; // 恢复后清除保存的进度
                }, { once: true });
            }

            // 2. 如果有特定歌曲的保存进度，使用该进度（优先级更高）
            if (!replay) {
                const progressKey = `nbmusic_song_progress_${song.bvid}`;
                const savedTime = localStorage.getItem(progressKey);
                if (savedTime) {
                    const savedProgress = parseFloat(savedTime);
                    // 确保音频元数据加载完成后再设置时间
                    this.audioPlayer.audio.addEventListener('loadedmetadata', () => {
                        if (savedProgress < this.audioPlayer.audio.duration) {
                            this.audioPlayer.audio.currentTime = savedProgress;
                        }
                    }, { once: true });
                }
            }

            // 更新媒体会话信息
            await this.updateMediaSession(song);
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

            // 播放音频
            await this.audioPlayer.audio.play();
            playButton.classList = "play played";

            // 保存播放状态
            this.savePlaylists();

        } finally {
            playButton.disabled = false;
            progressBar.classList.remove('loading');
        }
    }
    async getAudioUrl(song, signal) {
        const cacheEnabled = this.settingManager.getSetting("cacheEnabled");

        // 尝试从缓存获取
        if (cacheEnabled) {
            const cached = this.cacheManager.getCachedItem("audio_" + song.bvid);
            if (cached && !this.isUrlExpired(cached)) {
                return cached;
            }
        }

        // 获取新的音频URL
        const urls = await this.musicSearcher.getAudioLink(song.bvid, true);
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const url = urls[0];
        song.audio = url;
        this.updateUrlExpiryTime(url);

        // 缓存新的URL
        if (cacheEnabled) {
            this.cacheManager.cacheItem("audio_" + song.bvid, url);
        }

        return url;
    }
    resetPlaybackState(replay) {
        // 重置音量设置
        if (this.audioPlayer.volumeInterval) {
            clearInterval(this.audioPlayer.volumeInterval);
            this.audioPlayer.volumeInterval = null;
        }
        this.audioPlayer.audio.volume = 1;

        // 重置进度条
        const progressBar = document.querySelector(".player .control .progress .progress-bar .progress-bar-inner");
        if (replay) {
            progressBar.style.transition = "none";
            progressBar.style.width = "0%";
            setTimeout(() => {
                progressBar.style.transition = "width 0.1s linear";
            }, 50);
            this.audioPlayer.audio.currentTime = 0;
        }
    }
    async updateMediaSession(song) {
        if ('mediaSession' in navigator) {
            const { url, size } = await this.cropImageToSquare(song.poster);
            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.title,
                artist: song.artist,
                artwork: [{ src: url, sizes: size, type: 'image/jpeg' }]
            });
        }
    }
    async updateUIForCurrentSong(song) {
        // 基础 UI 更新保持不变
        document.documentElement.style.setProperty("--bgul", "url(" + song.poster + ")");
        document.querySelector(".player-content .cover .cover-img").src = song.poster;
        document.querySelector(".player .info .title").textContent = song.title;
        document.querySelector(".player .info .artist").textContent = song.artist;

        if (this.settingManager.getSetting("background") === "video") {
            // 更严格地清理所有现有视频元素
            this.cleanupVideoBackgrounds();

            try {
                const video = document.createElement('video');
                // 添加唯一ID，便于后续清理
                video.id = 'background-video-' + Date.now();
                video.style.position = 'absolute';
                video.style.width = '100%';
                video.style.height = '100%';
                video.style.zIndex = '-1';
                video.style.bottom = '0';
                video.style.objectFit = 'cover';
                video.style.opacity = '0'; // 初始透明度为0
                video.muted = true;
                video.playsInline = true;
                video.loop = true;

                // 启用流式加载
                video.preload = 'auto';

                // 添加视频源 - 使用设置的清晰度
                let videoUrl = song.video;
                if (!videoUrl || this.isUrlExpired(videoUrl)) {
                    videoUrl = await this.tryGetVideoUrl(song.bvid, song.cid);
                    song.video = videoUrl;
                    this.updateUrlExpiryTime(videoUrl);
                    this.savePlaylists();
                }

                // 使用 MediaSource 支持流式加载
                if ('MediaSource' in window) {
                    video.src = videoUrl;
                }

                // 添加到页面
                document.querySelector('body').appendChild(video);
                
                // 确保视频加载完成后立即同步进度并播放
                video.addEventListener('loadedmetadata', () => {
                    // 立即同步当前音频进度
                    if (this.audioPlayer && this.audioPlayer.audio) {
                        video.currentTime = this.audioPlayer.audio.currentTime;
                    }
                    
                    // 视频可以播放时才显示，避免闪烁
                    video.addEventListener('canplay', () => {
                        // 淡入显示视频
                        video.style.opacity = '1';
                        video.style.transition = 'opacity 0.5s ease-in-out';
                        
                        // 如果音频正在播放，则视频也播放
                        if (!this.audioPlayer.audio.paused) {
                            video.play().catch(err => console.warn('视频自动播放失败:', err));
                        }
                    }, { once: true });
                });

                // 绑定同步事件
                this.bindVideoEvents(video);
                
            } catch (error) {
                this.uiManager.showNotification('视频背景设置失败: ' + error.message, 'error');
                // 发生错误时回退到封面背景
                document.documentElement.style.setProperty("--bgul", "url(" + song.poster + ")");
            }
        }
    }

    bindVideoEvents(video) {
        // 音频播放/暂停时同步控制视频
        const handlePlay = () => {
            video.play().catch(err => console.warn('视频播放失败:', err));
        };
        
        const handlePause = () => {
            video.pause();
        };
        
        // 监听音频跳转事件,同步视频进度
        const handleSeeking = () => {
            if (this.audioPlayer && this.audioPlayer.audio) {
                video.currentTime = this.audioPlayer.audio.currentTime;
            }
        };
        
        // 定期同步进度，防止长时间播放时出现偏差
        const syncInterval = setInterval(() => {
            if (this.audioPlayer && this.audioPlayer.audio && !video.paused) {
                // 如果时间差超过0.5秒，才进行同步
                if (Math.abs(video.currentTime - this.audioPlayer.audio.currentTime) > 0.5) {
                    video.currentTime = this.audioPlayer.audio.currentTime;
                }
            }
        }, 5000);
        
        // 添加事件监听器
        this.audioPlayer.audio.addEventListener('play', handlePlay);
        this.audioPlayer.audio.addEventListener('pause', handlePause);
        this.audioPlayer.audio.addEventListener('seeking', handleSeeking);
        
        // 监听视频错误
        video.addEventListener('error', () => {
            console.warn('视频播放出错,切换到封面背景');
            this.cleanupVideoBackgrounds(); // 清理所有视频
            clearInterval(syncInterval);
            
            // 切换回封面背景
            const currentSong = this.playlist[this.playingNow];
            if (currentSong && currentSong.poster) {
                document.documentElement.style.setProperty('--bgul', `url(${currentSong.poster})`);
            }
        });
        
        // 当视频元素被移除时，清理事件和定时器
        video.addEventListener('remove', () => {
            clearInterval(syncInterval);
            this.audioPlayer.audio.removeEventListener('play', handlePlay);
            this.audioPlayer.audio.removeEventListener('pause', handlePause);
            this.audioPlayer.audio.removeEventListener('seeking', handleSeeking);
        }, { once: true });
        
        // 确保初始状态同步
        if (this.audioPlayer && this.audioPlayer.audio) {
            // 设置初始进度
            video.currentTime = this.audioPlayer.audio.currentTime;
            
            // 如果音频正在播放，视频也应该播放
            if (!this.audioPlayer.audio.paused) {
                video.play().catch(err => console.warn('视频初始播放失败:', err));
            }
        }
    }

    // 确保清理方法可用于其他模块
    cleanupVideoBackgrounds() {
        const oldVideos = document.querySelectorAll('body > video');
        oldVideos.forEach(video => {
            // 停止播放
            video.pause();
            
            // 移除所有事件监听器
            const videoClone = video.cloneNode(false);
            
            // 淡出效果
            video.style.opacity = '0';
            video.style.transition = 'opacity 0.2s ease-in-out';
            
            // 等待淡出完成后移除元素
            setTimeout(() => {
                if (video.parentNode) {
                    video.parentNode.removeChild(video);
                }
            }, 200);
            
            // 替换为无事件监听器的克隆版本
            if (video.parentNode) {
                video.parentNode.replaceChild(videoClone, video);
                
                // 立即移除克隆版本
                setTimeout(() => {
                    if (videoClone.parentNode) {
                        videoClone.parentNode.removeChild(videoClone);
                    }
                }, 10);
            }
        });
    }

    changePlaylistName(name) {
        try {
            this.playlistName = name;
            this.savePlaylists();
            this.uiManager.renderPlaylist();
            this.setPlayingNow(this.playingNow, false);
        } catch (error) {
            console.error("修改播放列表名称失败:", error);
        }
    }

    savePlaylists() {
        try {
            // 如果有 musiclistManager，则由它来保存歌单状态
            if (this.musiclistManager) {
                this.musiclistManager.savePlaylists();
            }
            
            // 保存基本播放列表信息
            localStorage.setItem("nbmusic_playlist", JSON.stringify(this.playlist));
            localStorage.setItem("nbmusic_playlistname", this.playlistName);
            localStorage.setItem("nbmusic_url_expiry", JSON.stringify(Array.from(this.urlExpiryTimes.entries())));
            
            // 保存当前歌单ID
            if (this.currentPlaylistId) {
                localStorage.setItem("nbmusic_current_playlist_id", this.currentPlaylistId);
            }
            
            // 保存当前播放进度信息
            if (this.audioPlayer && !isNaN(this.audioPlayer.audio.currentTime)) {
                localStorage.setItem("nbmusic_current_time", this.audioPlayer.audio.currentTime);
                
                // 同时保存当前歌曲的特定进度
                if (this.playlist[this.playingNow] && this.playlist[this.playingNow].bvid) {
                    const progressKey = `nbmusic_song_progress_${this.playlist[this.playingNow].bvid}`;
                    localStorage.setItem(progressKey, this.audioPlayer.audio.currentTime);
                }
            }
            localStorage.setItem("nbmusic_playing_now", this.playingNow);
            
            // 同步更新 musiclistManager 中的对应歌单
            if (this.musiclistManager && this.currentPlaylistId) {
                const playlistIndex = this.musiclistManager.playlists.findIndex(p => p.id === this.currentPlaylistId);
                if (playlistIndex !== -1) {
                    const playlist = this.musiclistManager.playlists[playlistIndex];
                    playlist.lastPlayedIndex = this.playingNow;
                    playlist.lastPlayedTime = this.audioPlayer?.audio?.currentTime || 0;
                }
            }
        } catch (error) {
            console.error("保存播放列表失败:", error);
        }
    }

    loadPlaylists() {
        try {
            // 加载 URL 过期时间
            const savedUrlExpiry = localStorage.getItem("nbmusic_url_expiry");
            if (savedUrlExpiry) {
                const parsedUrlExpiry = JSON.parse(savedUrlExpiry);
                if (Array.isArray(parsedUrlExpiry)) {
                    this.urlExpiryTimes = new Map(parsedUrlExpiry);
                    const now = Date.now();
                    for (const [url, expiry] of this.urlExpiryTimes) {
                        if (now > expiry) {
                            this.urlExpiryTimes.delete(url);
                        }
                    }
                }
            }

            // 加载上次播放的位置
            const savedCurrentTime = localStorage.getItem("nbmusic_current_time");
            if (savedCurrentTime) {
                this.currentTime = parseFloat(savedCurrentTime);
            }
        } catch (error) {
            console.error("加载播放状态失败:", error);
            this.urlExpiryTimes = new Map();
        }
    }
    async renamePlaylist() {
        try {
            // 创建输入框
            const listNameElement = document.querySelector("#listname");
            const oldName = listNameElement.textContent;
            const input = document.createElement("input");
            input.type = "text";
            input.value = oldName;
            input.classList.add("playlist-input");

            // 替换原有内容
            listNameElement.textContent = "";
            listNameElement.appendChild(input);
            input.focus();
            input.select();

            // 处理确认和取消
            const handleRename = (e) => {
                if (e.key === "Enter") {
                    const newName = input.value.trim();
                    if (newName && newName !== oldName) {
                        this.changePlaylistName(newName);
                    } else {
                        listNameElement.textContent = oldName;
                    }
                    input.removeEventListener("blur", handleBlur);
                } else if (e.key === "Escape") {
                    listNameElement.textContent = oldName;
                    input.removeEventListener("blur", handleBlur);
                }
            };

            const handleBlur = () => {
                listNameElement.textContent = oldName;
                input.removeEventListener("keydown", handleRename);
            };

            input.addEventListener("keydown", handleRename);
            input.addEventListener("blur", handleBlur);

        } catch (error) {
            console.error("重命名歌单失败:", error);
        }
    }

    // 添加本地音频文件
    async addLocalSong(audio, metadata = {}) {
        try {
            // 生成唯一ID
            const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // 创建本地歌曲对象
            const localSong = {
                bvid: localId,
                id: localId,
                isLocal: true,
                title: metadata.title || '本地音乐',
                artist: metadata.artist || '未知艺术家',
                audio: metadata.audioUrl || '',
                poster: metadata.coverUrl || '../img/NB_Music.png',
                video: metadata.videoUrl || '',
                audioFile: metadata.audioFile || null,
                coverFile: metadata.coverFile || null,
                videoFile: metadata.videoFile || null,
                cid: null,
                lyric: ''
            };
            
            // 添加到播放列表
            await this.addSong(localSong);
            
            // 如果添加成功后，自动播放这首歌
            if (metadata.autoPlay) {
                const newIndex = this.playlist.length - 1;
                this.setPlayingNow(newIndex);
            }
            
            return localSong;
        } catch (error) {
            console.error("添加本地歌曲失败:", error);
            if (this.uiManager) {
                this.uiManager.showNotification('添加本地歌曲失败: ' + error.message, 'error');
            }
            return null;
        }
    }

    // 获取当前播放歌曲的视频URL
    async getCurrentVideoUrl() {
        try {
            if (this.playlist.length === 0 || this.playingNow < 0) {
                return null;
            }
            
            const currentSong = this.playlist[this.playingNow];
            
            // 如果是本地歌曲且有本地视频
            if (currentSong.isLocal && currentSong.video) {
                return currentSong.video;
            }
            
            // 如果不是本地歌曲，则尝试获取视频链接
            if (!currentSong.video || this.isUrlExpired(currentSong.video)) {
                const videoUrl = await this.tryGetVideoUrl(currentSong.bvid, currentSong.cid);
                currentSong.video = videoUrl;
                this.updateUrlExpiryTime(videoUrl);
                this.savePlaylists();
                return videoUrl;
            }
            
            return currentSong.video;
        } catch (error) {
            console.error("获取视频链接失败:", error);
            if (this.uiManager) {
                this.uiManager.showNotification('获取视频链接失败: ' + error.message, 'warning');
            }
            return null;
        }
    }
}

module.exports = PlaylistManager;