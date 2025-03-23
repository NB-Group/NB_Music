const UIModule = require('./UIModule');
const { ipcRenderer } = require('electron');

/**
 * 日推模块
 * 负责处理日推相关功能
 */
class DailyRecommendModule extends UIModule {
    /**
     * 创建日推模块
     * @param {Object} uiManager - UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
        this.recommendationList = [];
        this.isLoading = false;
        this.apiUrl = 'https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd';
        
        // 绑定方法到实例
        this.initialize = this.initialize.bind(this);
        this.fetchRecommendations = this.fetchRecommendations.bind(this);
        this.refreshRecommendations = this.refreshRecommendations.bind(this);
        this.createRecommendationElement = this.createRecommendationElement.bind(this);
        this.showEmptyState = this.showEmptyState.bind(this);
        this.formatDuration = this.formatDuration.bind(this);
        this.renderRecommendations = this.renderRecommendations.bind(this);
        this.addToPlaylist = this.addToPlaylist.bind(this);
        this.addToFavorite = this.addToFavorite.bind(this);
        this.updateFavoriteStates = this.updateFavoriteStates.bind(this);
        
        // 延迟初始化，确保DOM已加载
        setTimeout(() => {
            this.initialize();
        }, 0);
    }

    /**
     * 初始化日推模块
     */
    initialize() {
        console.log('初始化日推模块');
        
        // 获取推荐内容容器
        const container = document.querySelector('.daily-recommend-list');
        if (!container) {
            console.error('找不到日推列表容器');
            return;
        }
        
        // 获取刷新按钮
        const refreshButton = document.querySelector('.daily-recommend-header button');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                this.fetchRecommendations();
            });
        }
        
        // 获取日推导航项
        const navItem = document.querySelector('#function-list a.daily-recommend');
        if (navItem) {
            navItem.addEventListener('click', () => {
                // 检查是否已加载推荐，如果没有则加载
                if (this.recommendationList.length === 0 && !this.isLoading) {
                    this.fetchRecommendations();
                }
            });
        }
        
        // 从本地存储获取上次更新时间
        const lastUpdate = localStorage.getItem('lastRecommendationUpdate');
        const now = new Date();
        
        // 如果没有更新记录或者已经过了一天，则获取新推荐
        if (!lastUpdate || this.isDifferentDay(new Date(lastUpdate), now)) {
            // 强制获取最新的推荐
            this.fetchRecommendations();
        }
    }

    /**
     * 刷新推荐列表
     * 重新获取推荐内容
     */
    refreshRecommendations() {
        // 清除缓存数据
        this.clearCachedData();
        
        // 获取新的推荐内容
        this.fetchRecommendations();
        
        // 显示通知
        if (this.uiManager.notificationModule) {
            this.uiManager.notificationModule.show('正在刷新推荐内容...', 'info');
        }
    }

    /**
     * 清除缓存的推荐数据
     */
    clearCachedData() {
        try {
            localStorage.removeItem('cachedRecommendations');
            console.log('已清除日推缓存数据，将获取最新数据');
        } catch (error) {
            console.error('清除缓存数据失败:', error);
        }
    }

    /**
     * 检查是否需要定时更新
     */
    checkScheduledUpdate() {
        // 从本地存储获取上次更新时间
        const lastUpdate = localStorage.getItem('lastRecommendationUpdate');
        const now = new Date();
        
        // 如果没有更新记录或者已经过了一天，则获取新推荐
        if (!lastUpdate || this.isDifferentDay(new Date(lastUpdate), now)) {
            // 强制获取最新的推荐
            this.fetchRecommendations();
        }
    }

    /**
     * 判断两个日期是否是不同的天
     * @param {Date} date1 - 第一个日期
     * @param {Date} date2 - 第二个日期
     * @returns {boolean} - 如果是不同的天返回true，否则返回false
     */
    isDifferentDay(date1, date2) {
        return date1.getFullYear() !== date2.getFullYear() ||
               date1.getMonth() !== date2.getMonth() ||
               date1.getDate() !== date2.getDate();
    }

    /**
     * 获取推荐
     */
    async fetchRecommendations() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingState();
        
        try {
            // 从API获取新数据，不再使用缓存
            console.log('从B站API获取最新日推数据');
            await this.fetchFromApi();
        } catch (error) {
            console.error('获取日推失败:', error);
            this.showErrorState('获取推荐失败，请稍后再试');
        } finally {
            this.isLoading = false;
            // 更新最后更新时间但不使用它来判断是否使用缓存
            localStorage.setItem('lastRecommendationUpdate', new Date().toString());
        }
    }

    /**
     * 从API获取推荐
     */
    async fetchFromApi() {
        try {
            const axios = require('axios');
            const md5 = require('md5');
            
            // 显示加载状态
            this.showLoadingState();
            
            // WBI签名函数 - B站API需要
            const mixinKeyEncTab = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];
            
            function getMixinKey(orig) {
                return mixinKeyEncTab
                    .map((n) => orig[n])
                    .join("")
                    .slice(0, 32);
            }
            
            function encWbi(params, imgKey, subKey) {
                const mixinKey = getMixinKey(imgKey + subKey);
                const currTime = Math.round(Date.now() / 1000);
                const chrFilter = /[!'()*]/g;
                
                params.wts = currTime;
                
                const query = Object.keys(params)
                    .sort()
                    .map((key) => {
                        const value = params[key].toString().replace(chrFilter, "");
                        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
                    })
                    .join("&");
                
                const wbiSign = md5(query + mixinKey);
                return `${query}&w_rid=${wbiSign}`;
            }
            
            async function getWbiKeys() {
                try {
                    const response = await axios.get("https://api.bilibili.com/x/web-interface/nav", {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Referer': 'https://www.bilibili.com/',
                        }
                    });
                    
                    if (response.data && response.data.code === 0 && response.data.data && response.data.data.wbi_img) {
                        const {
                            wbi_img: { img_url, sub_url }
                        } = response.data.data;
                        
                        return {
                            img_key: img_url.slice(img_url.lastIndexOf("/") + 1, img_url.lastIndexOf(".")),
                            sub_key: sub_url.slice(sub_url.lastIndexOf("/") + 1, sub_url.lastIndexOf("."))
                        };
                    } else {
                        throw new Error("获取WBI密钥失败");
                    }
                } catch (error) {
                    console.error('获取WBI密钥失败:', error);
                    throw error;
                }
            }
            
            // 获取cookie（可能需要）
            const getCookieString = async () => {
                try {
                    if (window.getCookieString && typeof window.getCookieString === 'function') {
                        return await window.getCookieString();
                    }
                    return '';
                } catch (error) {
                    console.warn('获取Cookie失败，将使用无登录模式:', error);
                    return '';
                }
            };
            
            // 获取WBI签名密钥
            const { img_key, sub_key } = await getWbiKeys();
            
            // 获取首页推荐视频 - 确保使用正确的参数
            const params = {
                fresh_type: 4,
                ps: 20,        // 获取20条推荐
                fresh_idx: 1,
                fresh_idx_1h: 1,
                homepage_ver: 1
            };
            
            const query = encWbi(params, img_key, sub_key);
            
            // 获取Cookie
            const cookieString = await getCookieString();
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
                'Referer': 'https://www.bilibili.com/',
                'Accept': 'application/json',
                'Origin': 'https://www.bilibili.com'
            };
            
            // 如果有Cookie，添加到请求头
            if (cookieString) {
                headers['Cookie'] = cookieString;
                console.log('使用已登录状态获取日推');
            } else {
                console.log('使用未登录状态获取日推');
            }
            
            console.log(`请求B站日推API: ${this.apiUrl}?${query}`);
            
            // 尝试最多3次获取推荐
            let response;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    response = await axios.get(`${this.apiUrl}?${query}`, {
                        headers,
                        timeout: 10000 // 设置超时，避免请求永久挂起
                    });
                    
                    if (response.data.code === 0) {
                        break; // 成功获取数据，跳出重试循环
                    } else {
                        throw new Error(response.data.message || "获取推荐失败");
                    }
                } catch (error) {
                    retryCount++;
                    console.error(`获取日推失败，第${retryCount}次尝试:`, error);
                    
                    if (retryCount >= maxRetries) {
                        throw error; // 重试次数用完，抛出错误
                    }
                    
                    // 等待一段时间再重试
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            if (!response || !response.data) {
                throw new Error("获取推荐失败: 请求没有返回数据");
            }
            
            if (response.data.code !== 0) {
                throw new Error(response.data.message || "获取推荐失败");
            }
            
            // 验证数据结构
            if (!response.data.data || !response.data.data.item || !Array.isArray(response.data.data.item)) {
                throw new Error("返回的数据结构不正确");
            }
            
            // 处理返回的数据
            const items = response.data.data.item || [];
            
            // 只获取视频类型的推荐 (goto === "av")
            const videoItems = items.filter(item => item.goto === "av");
            
            if (videoItems.length === 0) {
                throw new Error("未找到视频推荐");
            }
            
            console.log(`找到 ${videoItems.length} 个视频推荐`);
            
            // 转换为我们应用需要的格式
            const recommendations = await Promise.all(videoItems.map(async (item) => {
                try {
                    // 获取视频的音频链接
                    const audioInfo = await this.getAudioInfo(item.bvid, item.cid);
                    
                    return {
                        id: item.id.toString(),
                        title: item.title,
                        artist: item.owner?.name || '未知UP主',
                        duration: this.formatDuration(item.duration),
                        cover: item.pic,
                        url: audioInfo.audioUrl,
                        bvid: item.bvid,
                        cid: item.cid,
                        videoUrl: audioInfo.videoUrl
                    };
                } catch (error) {
                    console.error(`处理视频 ${item.bvid} 时出错:`, error);
                    return null;
                }
            }));
            
            // 过滤掉获取失败的项
            const validRecommendations = recommendations.filter(item => item !== null);
            
            if (validRecommendations.length === 0) {
                throw new Error("处理推荐视频时出错，请稍后再试");
            }
            
            // 更新推荐列表，但不再缓存
            this.recommendationList = validRecommendations;
            this.renderRecommendations();
            
        } catch (error) {
            console.error('获取日推失败:', error);
            this.showErrorState(`获取推荐失败: ${error.message || '未知错误，请稍后再试'}`);
        }
    }
    
    /**
     * 获取视频的音频链接和视频链接
     * @param {string} bvid - 视频的BVID
     * @param {string} cid - 视频的CID
     * @returns {Promise<Object>} - 返回包含音频和视频链接的对象
     */
    async getAudioInfo(bvid, cid) {
        try {
            const axios = require('axios');
            const params = `bvid=${bvid}&cid=${cid}&fnval=16&fnver=0&fourk=1`;
            
            // 获取cookie（这是获取高质量音频的关键）
            const getCookieString = async () => {
                try {
                    if (window.getCookieString && typeof window.getCookieString === 'function') {
                        return await window.getCookieString();
                    }
                    return '';
                } catch (error) {
                    console.warn('获取Cookie失败，将使用无登录模式:', error);
                    return '';
                }
            };
            
            // 设置请求头，模拟浏览器请求
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
                'Referer': `https://www.bilibili.com/video/${bvid}`,
                'Accept': 'application/json',
                'Origin': 'https://www.bilibili.com'
            };
            
            // 如果有Cookie，添加到请求头（可能需要SESSDATA才能获取高质量音频）
            const cookieString = await getCookieString();
            if (cookieString) {
                headers['Cookie'] = cookieString;
            }
            
            console.log(`获取视频 ${bvid} 的音频信息，CID: ${cid}`);
            
            // 添加超时控制，避免请求永久挂起
            const response = await axios.get(`https://api.bilibili.com/x/player/playurl?${params}`, {
                headers,
                timeout: 10000
            });
            
            const data = response.data;
            
            if (data.code !== 0) {
                console.error(`获取音频链接失败，错误码: ${data.code}，消息: ${data.message}`);
                throw new Error(data.message || "获取音频链接失败");
            }
            
            let audioUrl = null;
            let videoUrl = null;
            
            // 获取音频链接
            if (data.data.dash && data.data.dash.audio && data.data.dash.audio.length > 0) {
                // 按质量排序，选择最高质量的音频
                const sortedAudio = [...data.data.dash.audio].sort((a, b) => b.bandwidth - a.bandwidth);
                const bestAudio = sortedAudio[0];
                audioUrl = bestAudio.baseUrl;
                
                console.log(`获取到音频: 码率 ${bestAudio.bandwidth}, ID ${bestAudio.id}`);
            } else {
                console.warn(`未找到视频 ${bvid} 的音频流`);
            }
            
            // 获取视频链接
            if (data.data.dash && data.data.dash.video && data.data.dash.video.length > 0) {
                // 按质量排序，选择合适质量的视频（不一定是最高质量，以优化性能）
                const sortedVideo = [...data.data.dash.video].sort((a, b) => a.bandwidth - b.bandwidth);
                // 选择中等质量的视频，如果数组长度足够的话
                const bestVideo = sortedVideo[Math.min(Math.floor(sortedVideo.length / 2), sortedVideo.length - 1)];
                videoUrl = bestVideo.baseUrl;
                
                console.log(`获取到视频: 码率 ${bestVideo.bandwidth}, 分辨率 ${bestVideo.width}x${bestVideo.height}`);
            } else {
                console.warn(`未找到视频 ${bvid} 的视频流`);
            }
            
            // 如果都没找到，抛出错误
            if (!audioUrl && !videoUrl) {
                throw new Error("未找到可用的音频或视频流");
            }
            
            return {
                audioUrl,
                videoUrl
            };
        } catch (error) {
            console.error('获取音频信息失败:', error);
            // 返回空值但不阻断流程，让UI能够显示错误状态
            return { audioUrl: null, videoUrl: null };
        }
    }
    
    /**
     * 格式化视频时长
     * @param {number} seconds - 视频时长（秒）
     * @returns {string} - 格式化后的时长字符串 (MM:SS)
     */
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * 渲染推荐列表
     */
    renderRecommendations() {
        const container = document.querySelector('.daily-recommend-list');
        if (!container) return;
        
        // 清空容器
        container.innerHTML = '';
        
        // 如果没有推荐数据，显示空状态
        if (this.recommendationList.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // 创建文档片段来提高性能
        const fragment = document.createDocumentFragment();
        
        // 添加每个推荐项到片段
        this.recommendationList.forEach((song, index) => {
            const songElement = this.createRecommendationElement(song);
            // 设置延迟以创建交错动画效果
            setTimeout(() => {
                songElement.classList.add('loaded');
            }, index * 50);
            fragment.appendChild(songElement);
        });
        
        // 将片段添加到容器
        container.appendChild(fragment);
        
        // 更新收藏状态
        this.updateFavoriteStates();
    }

    /**
     * 显示空状态
     */
    showEmptyState() {
        const container = document.querySelector('.daily-recommend-list');
        if (!container) return;
        
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="bi bi-music-note-list"></i>
                </div>
                <div class="empty-message">暂无推荐内容</div>
                <button class="retry-button">
                    <i class="bi bi-arrow-clockwise"></i> 刷新
                </button>
            </div>
        `;
        
        // 为刷新按钮添加事件
        const refreshButton = container.querySelector('.retry-button');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                this.fetchRecommendations();
            });
        }
    }

    /**
     * 创建推荐项元素
     * @param {Object} song - 歌曲信息
     * @returns {HTMLElement} - 歌曲元素
     */
    createRecommendationElement(song) {
        const songElement = document.createElement('div');
        songElement.className = 'recommendation-item';
        songElement.dataset.id = song.id;
        songElement.dataset.bvid = song.bvid;
        
        // 设置歌曲元素的HTML，改进UI设计
        songElement.innerHTML = `
            <div class="recommendation-item-cover">
                <div class="recommendation-item-cover-overlay"></div>
                <img src="${song.cover}" alt="${song.title}" loading="lazy">
                <div class="play-icon">
                    <i class="bi bi-play-fill"></i>
                </div>
            </div>
            <div class="recommendation-item-info">
                <div class="recommendation-item-title" title="${song.title}">${song.title}</div>
                <div class="recommendation-item-artist" title="${song.artist}">
                    <i class="bi bi-person-fill"></i> ${song.artist}
                </div>
                <div class="recommendation-item-duration">
                    <i class="bi bi-clock"></i> ${song.duration}
                </div>
            </div>
            <div class="recommendation-item-actions">
                <button class="add-to-playlist" title="添加到播放列表">
                    <i class="bi bi-plus"></i>
                </button>
                <button class="preview-video" title="预览视频">
                    <i class="bi bi-film"></i>
                </button>
                <button class="add-to-favorite" title="添加到收藏">
                    <i class="bi bi-heart"></i>
                </button>
            </div>
        `;
        
        // 为播放图标添加事件（立即播放）
        const playIcon = songElement.querySelector('.play-icon');
        if (playIcon) {
            playIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.playSong(song);
            });
        }
        
        // 为添加到播放列表按钮添加事件
        const addToPlaylistBtn = songElement.querySelector('.add-to-playlist');
        if (addToPlaylistBtn) {
            addToPlaylistBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addToPlaylist(song);
                
                // 添加点击动画效果
                addToPlaylistBtn.classList.add('clicked');
                setTimeout(() => {
                    addToPlaylistBtn.classList.remove('clicked');
                }, 300);
            });
        }
        
        // 为预览视频按钮添加事件
        const previewVideoBtn = songElement.querySelector('.preview-video');
        if (previewVideoBtn) {
            previewVideoBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                // 添加点击动画效果
                previewVideoBtn.classList.add('clicked');
                setTimeout(() => {
                    previewVideoBtn.classList.remove('clicked');
                }, 300);
                
                // 显示加载状态
                previewVideoBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
                previewVideoBtn.disabled = true;
                
                try {
                    // 如果没有URL和CID则尝试获取
                    if (!song.url || !song.videoUrl) {
                        // 获取音频和视频信息
                        const { audioUrl, videoUrl } = await this.getAudioInfo(song.bvid, song.cid);
                        if (audioUrl) song.url = audioUrl;
                        if (videoUrl) song.videoUrl = videoUrl;
                    }
                    
                    // 先更新播放列表让视频能够播放
                    const songInfo = {
                        title: song.title,
                        artist: song.artist,
                        poster: song.cover,
                        audio: song.url,
                        bvid: song.bvid,
                        cid: song.cid,
                        video: song.videoUrl,
                        lyric: "暂无歌词，尽情欣赏视频"
                    };
                    
                    // 添加到播放列表
                    if (this.uiManager.playlistManager) {
                        // 检查是否已经在播放列表中
                        const existingSongIndex = this.uiManager.playlistManager.playlist.findIndex(
                            item => item.bvid === song.bvid
                        );
                        
                        if (existingSongIndex !== -1) {
                            // 如果歌曲已存在于播放列表，更新它的URL
                            this.uiManager.playlistManager.playlist[existingSongIndex].audio = song.url;
                            this.uiManager.playlistManager.playlist[existingSongIndex].video = song.videoUrl;
                        } else {
                            // 添加到播放列表
                            this.uiManager.playlistManager.addSong(songInfo);
                        }
                    }
                    
                    // 获取视频播放器管理器
                    const videoPlayerManager = this.uiManager.videoPlayerManager;
                    if (!videoPlayerManager) {
                        throw new Error('视频播放器组件未初始化，请先在设置中启用视频功能');
                    }
                    
                    // 检查视频URL是否有效
                    if (!song.videoUrl) {
                        throw new Error('视频链接无效或未找到');
                    }
                    
                    // 打开视频播放器
                    await videoPlayerManager.openVideoPlayer(song.videoUrl, song.title);
                } catch (error) {
                    console.error('预览视频失败:', error);
                    this.uiManager.showNotification('视频预览失败: ' + error.message, 'error');
                } finally {
                    // 恢复按钮状态
                    previewVideoBtn.innerHTML = '<i class="bi bi-film"></i>';
                    previewVideoBtn.disabled = false;
                }
            });
        }
        
        // 为添加到收藏按钮添加事件
        const addToFavoriteBtn = songElement.querySelector('.add-to-favorite');
        if (addToFavoriteBtn) {
            addToFavoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addToFavorite(song);
                
                // 添加点击动画效果
                addToFavoriteBtn.classList.add('clicked');
                setTimeout(() => {
                    addToFavoriteBtn.classList.remove('clicked');
                }, 300);
                
                // 切换收藏状态的视觉效果
                if (addToFavoriteBtn.classList.contains('favorited')) {
                    addToFavoriteBtn.classList.remove('favorited');
                    addToFavoriteBtn.querySelector('i').classList.remove('bi-heart-fill');
                    addToFavoriteBtn.querySelector('i').classList.add('bi-heart');
                } else {
                    addToFavoriteBtn.classList.add('favorited');
                    addToFavoriteBtn.querySelector('i').classList.remove('bi-heart');
                    addToFavoriteBtn.querySelector('i').classList.add('bi-heart-fill');
                }
            });
        }
        
        // 为整个歌曲元素添加点击事件（也是播放）
        songElement.addEventListener('click', () => {
            this.playSong(song);
        });
        
        // 添加入场动画
        setTimeout(() => {
            songElement.classList.add('loaded');
        }, 50);
        
        return songElement;
    }

    /**
     * 播放歌曲
     * @param {Object} song - 歌曲信息
     */
    playSong(song) {
        if (!this.uiManager.audioPlayer) return;
        
        // 显示加载提示
        const progressBar = document.querySelector(".progress-bar-inner");
        if (progressBar) progressBar.classList.add('loading');
        
        // 使用已存在的URL还是重新获取
        if (song.url || song.videoUrl) {
            this.playWithExistingUrl(song);
        } else if (song.bvid) {
            // 没有URL但有bvid，尝试获取URL
            this.requestPlay(song.bvid, song.title);
        } else {
            // 没有URL也没有bvid，无法播放
            const notificationManager = this.uiManager.notificationModule;
            if (notificationManager) {
                notificationManager.show('无法播放: 缺少必要的信息', 'error');
            }
            if (progressBar) progressBar.classList.remove('loading');
        }
    }
    
    /**
     * 使用已存在的URL直接播放
     * @param {Object} song - 歌曲信息
     */
    async playWithExistingUrl(song) {
        try {
            // 显示加载提示
            const progressBar = document.querySelector(".progress-bar-inner");
            if (progressBar) progressBar.classList.add('loading');
            
            // 检查URL是否可用
            if (!song.url && !song.videoUrl) {
                throw new Error("无可用的音频或视频链接");
            }
            
            // 获取歌词
            let lyric = "暂无歌词，尽情欣赏音乐";
            if (this.uiManager.settingManager && this.uiManager.settingManager.getSetting('lyricSearchType') === 'custom') {
                lyric = await this.showLyricSearchDialog(song.title);
            } else {
                // 尝试使用searchMusic获取歌词，这需要引入对应的代码
                try {
                    if (this.uiManager.musicSearcher) {
                        lyric = await this.uiManager.musicSearcher.getLyrics(song.title);
                    }
                } catch (error) {
                    console.error('获取歌词失败:', error);
                }
            }
            
            // 准备完整的歌曲对象
            const songInfo = {
                title: song.title,
                artist: song.artist,
                poster: song.cover,
                audio: song.url,
                bvid: song.bvid,
                cid: song.cid,
                video: song.videoUrl,
                lyric: lyric
            };
            
            // 添加到播放列表
            if (this.uiManager.playlistManager) {
                // 检查是否已经在播放列表中
                const existingSongIndex = this.uiManager.playlistManager.playlist.findIndex(
                    item => item.bvid === song.bvid
                );
                
                if (existingSongIndex !== -1) {
                    // 如果歌曲已存在于播放列表，直接播放
                    this.uiManager.playlistManager.setPlayingNow(existingSongIndex);
                } else {
                    // 添加到播放列表末尾并播放
                    this.uiManager.playlistManager.addSong(songInfo);
                    this.uiManager.playlistManager.setPlayingNow(this.uiManager.playlistManager.playlist.length - 1);
                }
                
                // 渲染播放列表
                this.uiManager.renderPlaylist();
                
                // 通知用户已开始播放
                const notificationManager = this.uiManager.notificationModule;
                if (notificationManager) {
                    notificationManager.show('正在播放: ' + song.title);
                }
            }
            
        } catch (error) {
            console.error('播放歌曲失败:', error);
            
            // 显示错误通知
            const notificationManager = this.uiManager.notificationModule;
            if (notificationManager) {
                notificationManager.show('播放失败: ' + (error.message || '未知错误'), 'error');
            }
        } finally {
            // 恢复加载状态
            const progressBar = document.querySelector(".progress-bar-inner");
            if (progressBar) progressBar.classList.remove('loading');
        }
    }

    /**
     * 请求播放指定歌曲
     * @param {string} bvid - 视频ID
     * @param {string} title - 歌曲标题
     */
    requestPlay(bvid, title) {
        if (!bvid) return;
        
        // 通过ipcRenderer发送播放请求到主进程
        ipcRenderer.send('request-play', {
            bvid: bvid,
            title: title
        });
    }

    /**
     * 添加歌曲到播放列表
     * @param {Object} song - 歌曲信息
     */
    async addToPlaylist(song) {
        try {
            // 如果没有URL则尝试获取
            if (!song.url || !song.videoUrl) {
                // 获取音频和视频信息
                const { audioUrl, videoUrl } = await this.getAudioInfo(song.bvid, song.cid);
                if (audioUrl) song.url = audioUrl;
                if (videoUrl) song.videoUrl = videoUrl;
            }
            
            // 整理歌曲信息
            const songInfo = {
                title: song.title,
                artist: song.artist,
                poster: song.cover,
                audio: song.url,
                bvid: song.bvid,
                cid: song.cid,
                video: song.videoUrl,
                lyric: "暂无歌词"
            };
            
            // 添加到播放列表
            if (this.uiManager.playlistManager) {
                this.uiManager.playlistManager.addSong(songInfo);
                this.uiManager.showNotification(`已添加 ${song.title} 到播放列表`, 'success');
            } else {
                this.uiManager.showNotification('播放列表管理器未初始化', 'error');
            }
        } catch (error) {
            console.error('添加到播放列表失败:', error);
            this.uiManager.showNotification('添加到播放列表失败: ' + error.message, 'error');
        }
    }
    
    /**
     * 添加歌曲到收藏
     * @param {Object} song - 歌曲信息
     */
    addToFavorite(song) {
        try {
            // 检查收藏列表中是否已经存在该歌曲
            let favorites = localStorage.getItem('favorites');
            
            if (!favorites) {
                favorites = [];
            } else {
                try {
                    favorites = JSON.parse(favorites);
                } catch (e) {
                    console.error('解析收藏列表失败', e);
                    favorites = [];
                }
            }
            
            // 检查歌曲是否已经在收藏列表中
            const existingIndex = favorites.findIndex(item => item.bvid === song.bvid);
            
            if (existingIndex !== -1) {
                // 如果已经存在，就从收藏列表中移除
                favorites.splice(existingIndex, 1);
                this.uiManager.showNotification(`已从收藏中移除 ${song.title}`, 'info');
            } else {
                // 如果不存在，就添加到收藏列表
                favorites.push({
                    id: song.id,
                    bvid: song.bvid,
                    cid: song.cid,
                    title: song.title,
                    artist: song.artist,
                    cover: song.cover,
                    duration: song.duration
                });
                this.uiManager.showNotification(`已收藏 ${song.title}`, 'success');
            }
            
            // 保存到本地存储
            localStorage.setItem('favorites', JSON.stringify(favorites));
            
            // 更新UI状态
            this.updateFavoriteStates();
        } catch (error) {
            console.error('收藏操作失败:', error);
            this.uiManager.showNotification('收藏操作失败: ' + error.message, 'error');
        }
    }
    
    /**
     * 更新所有推荐项的收藏状态
     */
    updateFavoriteStates() {
        try {
            // 获取收藏列表
            let favorites = localStorage.getItem('favorites');
            
            if (!favorites) {
                return;
            }
            
            try {
                favorites = JSON.parse(favorites);
            } catch (e) {
                console.error('解析收藏列表失败', e);
                return;
            }
            
            // 获取所有推荐项
            const recommendationItems = document.querySelectorAll('.recommendation-item');
            
            // 更新每个推荐项的收藏状态
            recommendationItems.forEach(item => {
                const bvid = item.dataset.bvid;
                const favoriteBtn = item.querySelector('.add-to-favorite');
                
                if (favoriteBtn) {
                    // 检查是否在收藏列表中
                    const isInFavorites = favorites.some(favorite => favorite.bvid === bvid);
                    
                    if (isInFavorites) {
                        favoriteBtn.classList.add('favorited');
                        favoriteBtn.querySelector('i').classList.remove('bi-heart');
                        favoriteBtn.querySelector('i').classList.add('bi-heart-fill');
                    } else {
                        favoriteBtn.classList.remove('favorited');
                        favoriteBtn.querySelector('i').classList.remove('bi-heart-fill');
                        favoriteBtn.querySelector('i').classList.add('bi-heart');
                    }
                }
            });
        } catch (error) {
            console.error('更新收藏状态失败:', error);
        }
    }

    /**
     * 显示加载状态
     */
    showLoadingState() {
        const container = document.querySelector('.daily-recommend-list');
        if (!container) return;
        
        // 清空容器
        container.innerHTML = '';
        
        // 创建12个骨架屏加载元素
        for (let i = 0; i < 12; i++) {
            const skeletonItem = document.createElement('div');
            skeletonItem.className = 'recommendation-item skeleton-item';
            
            skeletonItem.innerHTML = `
                <div class="recommendation-item-cover skeleton-cover">
                    <div class="skeleton-pulse"></div>
                </div>
                <div class="recommendation-item-info">
                    <div class="recommendation-item-title skeleton-text-long">
                        <div class="skeleton-pulse"></div>
                    </div>
                    <div class="recommendation-item-artist skeleton-text-medium">
                        <div class="skeleton-pulse"></div>
                    </div>
                    <div class="recommendation-item-duration skeleton-text-short">
                        <div class="skeleton-pulse"></div>
                    </div>
                </div>
                <div class="recommendation-item-actions skeleton-actions">
                    <div class="skeleton-button"><div class="skeleton-pulse"></div></div>
                    <div class="skeleton-button"><div class="skeleton-pulse"></div></div>
                    <div class="skeleton-button"><div class="skeleton-pulse"></div></div>
                </div>
            `;
            
            container.appendChild(skeletonItem);
        }
    }

    /**
     * 显示错误状态
     * @param {string} message - 错误信息
     */
    showErrorState(message) {
        const container = document.querySelector('.daily-recommend-list');
        if (!container) return;
        
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">
                    <i class="bi bi-exclamation-triangle"></i>
                </div>
                <div class="error-message">${message}</div>
                <button class="retry-button">
                    <i class="bi bi-arrow-clockwise"></i> 重新加载
                </button>
            </div>
        `;
        
        // 为重试按钮添加事件
        const retryButton = container.querySelector('.retry-button');
        if (retryButton) {
            retryButton.addEventListener('click', () => {
                this.fetchRecommendations();
            });
        }
    }

    /**
     * 显示歌词搜索对话框
     * @param {string} songTitle - 歌曲标题
     * @returns {Promise<string>} - 返回歌词
     */
    async showLyricSearchDialog(songTitle) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('lyricSearchDialog');
            const titleDiv = document.getElementById('currentSongTitle');
            const keywordInput = document.getElementById('lyricKeyword');
            const skipBtn = document.getElementById('skipLyric');
            const confirmBtn = document.getElementById('confirmLyric');

            // 显示当前歌曲信息
            titleDiv.textContent = songTitle;
            keywordInput.value = songTitle;
            dialog.classList.remove('hide');

            const handleSkip = () => {
                cleanup();
                resolve("暂无歌词，尽情欣赏音乐");
            };

            const handleConfirm = async () => {
                const keyword = keywordInput.value.trim();
                cleanup();
                if (keyword) {
                    try {
                        // 使用MusicSearcher获取歌词
                        if (this.uiManager.musicSearcher) {
                            const lyric = await this.uiManager.musicSearcher.getLyrics(keyword);
                            resolve(lyric);
                        } else {
                            resolve("暂无歌词，尽情欣赏音乐");
                        }
                    } catch (error) {
                        console.error('获取歌词失败:', error);
                        resolve("暂无歌词，尽情欣赏音乐");
                    }
                } else {
                    resolve("暂无歌词，尽情欣赏音乐");
                }
            };

            const handleKeydown = (e) => {
                if (e.key === 'Enter') {
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    handleSkip();
                }
            };

            // 清理函数
            const cleanup = () => {
                dialog.classList.add('hide');
                skipBtn.removeEventListener('click', handleSkip);
                confirmBtn.removeEventListener('click', handleConfirm);
                keywordInput.removeEventListener('keydown', handleKeydown);
            };

            // 添加事件监听器
            skipBtn.addEventListener('click', handleSkip);
            confirmBtn.addEventListener('click', handleConfirm);
            keywordInput.addEventListener('keydown', handleKeydown);
            keywordInput.focus();
        });
    }
}

module.exports = DailyRecommendModule; 