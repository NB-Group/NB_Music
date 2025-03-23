const UIModule = require('./UIModule');

/**
 * 迷你播放器模块
 * 处理侧边栏底部的迷你播放器组件
 */
class MiniPlayerModule extends UIModule {
    /**
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
        this.miniPlayer = null;
        this.vinylRecord = null;  // 唱片元素
        this.tonearm = null;      // 唱臂元素
        this.titleElement = null;
        this.artistElement = null;
        
        // 动画状态
        this.isAnimating = false;
        
        // 滑动相关属性
        this.dragStartX = 0;
        this.isDragging = false;
        this.dragDistance = 0;
        this.swipeThreshold = 50; // 滑动阈值，超过这个距离视为有效滑动
    }

    /**
     * 初始化迷你播放器
     */
    initialize() {
        // 获取DOM元素
        this.miniPlayer = document.getElementById('mini-player');
        if (!this.miniPlayer) return;

        this.vinylRecord = document.getElementById('mini-player-disc');   // 唱片元素
        this.tonearm = document.getElementById('mini-player-tonearm');    // 唱臂元素
        this.titleElement = document.getElementById('mini-player-title');
        this.artistElement = document.getElementById('mini-player-artist');

        // 设置初始状态
        if (this.tonearm) {
            // 默认唱臂抬起（暂停状态）
            this.tonearm.classList.add('paused');
        }

        // 绑定事件处理程序
        this.bindEvents();
        
        // 初始化播放器状态
        this.updatePlayerState();
        
        // 监听歌曲变化
        this.audioPlayer.addEventListener('songchange', () => {
            this.animateDiscChange();
        });
        
        // 监听播放状态变化
        this.audioPlayer.audio.addEventListener('play', () => {
            this.updatePlayState(true);
        });
        
        this.audioPlayer.audio.addEventListener('pause', () => {
            this.updatePlayState(false);
        });
    }

    /**
     * 绑定事件处理程序
     */
    bindEvents() {
        // 播放/暂停点击事件（只有唱臂可以控制播放暂停）
        this.tonearm.addEventListener('click', () => {
            // 如果正在动画中，不响应点击
            if (this.isAnimating) return;
            this.audioPlayer.play();
        });

        // 滑动切换歌曲事件（唱片支持滑动切换）
        this.vinylRecord.addEventListener('mousedown', this.handleDragStart.bind(this));
        this.vinylRecord.addEventListener('touchstart', this.handleDragStart.bind(this), { passive: false });
        
        document.addEventListener('mousemove', this.handleDragMove.bind(this));
        document.addEventListener('touchmove', this.handleDragMove.bind(this), { passive: false });
        
        document.addEventListener('mouseup', this.handleDragEnd.bind(this));
        document.addEventListener('touchend', this.handleDragEnd.bind(this));
        
        // 唱片点击播放/暂停
        this.vinylRecord.addEventListener('click', (e) => {
            // 如果是拖动结束，不触发点击
            if (this.isDragging || this.isAnimating || Math.abs(this.dragDistance) > 5) {
                e.preventDefault();
                return;
            }
            this.audioPlayer.play();
        });
    }

    /**
     * 处理拖动开始
     * @param {Event} e - 鼠标或触摸事件
     */
    handleDragStart(e) {
        if (this.isAnimating) return;
        
        e.preventDefault();
        this.isDragging = true;
        
        // 记录起始位置
        this.dragStartX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        this.dragDistance = 0;
        
        // 添加拖动中的样式
        this.vinylRecord.classList.add('dragging');
    }

    /**
     * 处理拖动过程
     * @param {Event} e - 鼠标或触摸事件
     */
    handleDragMove(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        
        const currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        this.dragDistance = currentX - this.dragStartX;
        
        // 跟随手指移动唱片
        this.vinylRecord.style.transform = `translateX(${this.dragDistance}px) rotate(${this.dragDistance/2}deg)`;
    }

    /**
     * 处理拖动结束
     */
    handleDragEnd() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.vinylRecord.classList.remove('dragging');
        
        // 移除临时样式
        this.vinylRecord.style.transform = '';
        
        // 根据滑动距离和方向确定操作
        if (Math.abs(this.dragDistance) >= this.swipeThreshold) {
            this.isAnimating = true; // 先设置为动画状态，防止多次触发
            
            if (this.dragDistance > 0) {
                // 向右滑动，上一首
                console.log('向右滑动，切换到上一首'); // 添加调试日志
                
                // 先添加向右滑出动画类
                this.vinylRecord.classList.add('disc-out-right');
                
                // 等待动画播放一部分时间后切换歌曲
                setTimeout(() => {
                    this.audioPlayer.prev();
                    
                    // 等待一小段时间确保歌曲已切换
                    setTimeout(() => {
                        // 更新唱片信息
                        this.updatePlayerState();
                        
                        // 移除旧动画类，添加从左侧进入的新动画类
                        this.vinylRecord.classList.remove('disc-out-right');
                        this.vinylRecord.classList.add('disc-in-left');
                        
                        // 动画结束后清理类名
                        setTimeout(() => {
                            this.vinylRecord.classList.remove('disc-in-left');
                            this.isAnimating = false;
                        }, 600);
                    }, 150);
                }, 300);
            } else {
                // 向左滑动，下一首
                console.log('向左滑动，切换到下一首'); // 添加调试日志
                
                // 先添加向左滑出动画类
                this.vinylRecord.classList.add('disc-out-left');
                
                // 等待动画播放一部分时间后切换歌曲
                setTimeout(() => {
                    this.audioPlayer.next();
                    
                    // 等待一小段时间确保歌曲已切换
                    setTimeout(() => {
                        // 更新唱片信息
                        this.updatePlayerState();
                        
                        // 移除旧动画类，添加从右侧进入的新动画类
                        this.vinylRecord.classList.remove('disc-out-left');
                        this.vinylRecord.classList.add('disc-in-right');
                        
                        // 动画结束后清理类名
                        setTimeout(() => {
                            this.vinylRecord.classList.remove('disc-in-right');
                            this.isAnimating = false;
                        }, 600);
                    }, 150);
                }, 300);
            }
        } else {
            // 滑动距离不够，恢复原位
            this.vinylRecord.style.transform = '';
        }
    }

    /**
     * 滑动动画
     * @param {string} direction - 滑动方向：'left' 或 'right'
     * @param {Function} callback - 动画结束后的回调函数
     */
    animateSwipe(direction, callback) {
        if (this.isAnimating) return;
        this.isAnimating = true;
        
        // 添加相应的CSS类来触发动画
        this.vinylRecord.classList.add('disc-out');
        
        // 设置动画完成后的操作
        setTimeout(() => {
            // 执行回调（切换歌曲）
            if (typeof callback === 'function') {
                callback();
            }
            
            // 等待一小段时间确保歌曲已切换
            setTimeout(() => {
                // 更新唱片信息
                this.updatePlayerState();
                
                // 移除动画类
                this.vinylRecord.classList.remove('disc-out');
                
                // 添加飞入动画
                this.vinylRecord.classList.add('disc-in');
                
                setTimeout(() => {
                    this.vinylRecord.classList.remove('disc-in');
                    this.isAnimating = false;
                }, 600);
            }, 100);
        }, 600);
    }

    /**
     * 唱片切换动画
     */
    animateDiscChange() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        
        console.log('执行唱片切换动画'); // 添加调试日志
        
        // 第1步：旧唱片飞出（默认向左飞出）
        this.vinylRecord.classList.add('disc-out-left');
        
        // 第2步：600ms后更新歌曲信息（与CSS动画时间匹配）
        setTimeout(() => {
            // 更新唱片信息和样式
            this.updatePlayerState();
            
            // 移除旧动画类，添加新动画类（默认从右侧进入）
            this.vinylRecord.classList.remove('disc-out-left');
            this.vinylRecord.classList.add('disc-in-right');
            
            // 第3步：600ms后结束动画（与CSS动画时间匹配）
            setTimeout(() => {
                this.vinylRecord.classList.remove('disc-in-right');
                this.isAnimating = false;
            }, 600);
        }, 600);
    }

    /**
     * 更新播放器状态（歌曲信息、封面等）
     */
    updatePlayerState() {
        const currentSong = this.getCurrentSong();
        if (!currentSong) return;

        // 更新歌曲信息
        this.titleElement.textContent = currentSong.title || '未知歌曲';
        this.artistElement.textContent = currentSong.artist || '未知艺术家';
        
        // 更新唱片封面样式（使用背景图片）
        if (currentSong.coverUrl) {
            // 将背景设为黑色，确保不透明
            this.vinylRecord.style.backgroundColor = '#000';
            // 设置封面图为背景
            this.vinylRecord.style.backgroundImage = `url(${currentSong.coverUrl}), radial-gradient(circle at center, 
                #151515 0%, 
                #232323 20%, 
                #151515 21%, 
                #232323 30%, 
                #151515 31%, 
                #232323 40%, 
                #151515 41%, 
                #232323 50%, 
                #151515 51%, 
                #232323 60%, 
                #151515 61%, 
                #232323 70%, 
                #151515 71%, 
                #232323 80%, 
                #151515 81%)`;
            this.vinylRecord.style.backgroundSize = '70% 70%, 100% 100%'; // 封面占70%中心区域
            this.vinylRecord.style.backgroundPosition = 'center, center';
            this.vinylRecord.style.backgroundRepeat = 'no-repeat, no-repeat';
            // 使用multiply混合模式，确保黑色唱片纹理可见
            this.vinylRecord.style.backgroundBlendMode = 'soft-light, normal';
            // 强制设置不透明
            this.vinylRecord.style.opacity = '1';
        } else {
            // 如果没有封面，使用默认的唱片纹理
            this.vinylRecord.style.backgroundColor = '#000';
            this.vinylRecord.style.backgroundImage = 'radial-gradient(circle at center, #151515 0%, #232323 20%, #151515 21%, #232323 30%, #151515 31%, #232323 40%, #151515 41%, #232323 50%, #151515 51%, #232323 60%, #151515 61%, #232323 70%, #151515 71%, #232323 80%, #151515 81%)';
            this.vinylRecord.style.backgroundSize = '100% 100%';
            this.vinylRecord.style.backgroundPosition = 'center';
            this.vinylRecord.style.backgroundBlendMode = 'normal';
            this.vinylRecord.style.opacity = '1';
        }
        
        // 更新播放状态
        this.updatePlayState(!this.audioPlayer.audio.paused);
    }

    /**
     * 获取当前播放的歌曲信息
     * @returns {Object|null} 当前歌曲对象或null
     */
    getCurrentSong() {
        if (!this.playlistManager || !this.playlistManager.playlist || this.playlistManager.playlist.length === 0) {
            return null;
        }

        const currentIndex = this.playlistManager.playingNow;
        if (currentIndex < 0 || currentIndex >= this.playlistManager.playlist.length) {
            return null;
        }

        return this.playlistManager.playlist[currentIndex];
    }

    /**
     * 更新播放/暂停状态
     * @param {boolean} isPlaying - 是否正在播放
     */
    updatePlayState(isPlaying) {
        if (isPlaying) {
            // 播放状态：唱臂放下，唱片旋转
            this.vinylRecord.classList.add('playing');
            this.tonearm.classList.remove('paused');
        } else {
            // 暂停状态：唱臂抬起，唱片停止
            this.vinylRecord.classList.remove('playing');
            this.tonearm.classList.add('paused');
        }
    }
}

module.exports = MiniPlayerModule;