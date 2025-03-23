/**
 * NB Music 移动端适配脚本
 * 处理移动端特定的交互和UI调整
 */

// 立即执行函数，避免污染全局作用域
(function() {
    // 检测是否是移动设备
    function isMobileDevice() {
        return window.innerWidth <= 767 || 
               /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // 页面加载后初始化
    document.addEventListener('DOMContentLoaded', function() {
        if (isMobileDevice()) {
            initMobileUI();
        }

        // 监听窗口大小改变，以便在设备旋转或桌面端调整窗口大小时响应
        window.addEventListener('resize', function() {
            if (isMobileDevice()) {
                initMobileUI();
            } else {
                disableMobileUI();
            }
        });
    });

    // 初始化移动端UI
    function initMobileUI() {
        document.body.classList.add('mobile-view');
        
        // 启用底部导航栏
        const mobileNavbar = document.querySelector('.mobile-navbar');
        if (mobileNavbar) {
            mobileNavbar.style.display = 'flex';
        }
        
        // 启用页面指示器
        const pageIndicator = document.querySelector('.page-indicator');
        if (pageIndicator) {
            pageIndicator.style.display = 'flex';
        }
        
        // 初始化页面滑动切换
        initSwipeNavigation();
        
        // 初始化搜索框
        initMobileSearch();
        
        // 初始化底部导航栏事件
        initMobileNavbar();
        
        // 初始化播放列表弹窗
        initMobilePlaylist();
        
        // 更新当前播放列表数量badge
        updatePlaylistCount();
    }

    // 禁用移动端UI，恢复桌面端布局
    function disableMobileUI() {
        document.body.classList.remove('mobile-view');
        
        // 隐藏底部导航栏
        const mobileNavbar = document.querySelector('.mobile-navbar');
        if (mobileNavbar) {
            mobileNavbar.style.display = 'none';
        }
        
        // 隐藏页面指示器
        const pageIndicator = document.querySelector('.page-indicator');
        if (pageIndicator) {
            pageIndicator.style.display = 'none';
        }
        
        // 禁用移动端搜索框
        const searchInput = document.querySelector('.search-music');
        if (searchInput) {
            searchInput.parentElement.classList.remove('collapsed', 'expanded');
        }
        
        // 关闭可能打开的播放列表弹窗
        const mobilePlaylist = document.querySelector('.mobile-playlist');
        if (mobilePlaylist) {
            mobilePlaylist.classList.remove('open');
        }
        
        // 重置播放器视图
        const player = document.querySelector('.content .player');
        if (player) {
            player.classList.remove('show-player', 'show-lyrics');
        }
    }

    // 初始化页面滑动导航
    function initSwipeNavigation() {
        const player = document.querySelector('.content .player');
        if (!player) return;
        
        let startX, startY, distX, distY;
        let isScrolling = false;
        let threshold = 50; // 触发滑动的阈值
        
        // 设置初始页面状态
        player.classList.add('show-player');
        
        // 更新页面指示器
        function updatePageIndicator(isLyricsView) {
            const dots = document.querySelectorAll('.page-indicator .dot');
            dots.forEach((dot, index) => {
                if ((index === 0 && !isLyricsView) || (index === 1 && isLyricsView)) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        }
        
        // 点击指示器切换页面
        document.querySelectorAll('.page-indicator .dot').forEach((dot, index) => {
            dot.addEventListener('click', () => {
                if (index === 0) {
                    showPlayerView();
                } else {
                    showLyricsView();
                }
            });
        });
        
        function showPlayerView() {
            player.classList.add('show-player');
            player.classList.remove('show-lyrics');
            updatePageIndicator(false);
        }
        
        function showLyricsView() {
            player.classList.add('show-lyrics');
            player.classList.remove('show-player');
            updatePageIndicator(true);
        }
        
        // 处理触摸开始
        player.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isScrolling = undefined;
        }, false);
        
        // 处理触摸移动
        player.addEventListener('touchmove', function(e) {
            if (!startX || !startY) return;
            
            distX = e.touches[0].clientX - startX;
            distY = e.touches[0].clientY - startY;
            
            // 确定是水平滑动还是垂直滚动
            if (typeof isScrolling === 'undefined') {
                isScrolling = Math.abs(distX) < Math.abs(distY);
            }
            
            // 如果是垂直滚动，不阻止默认行为
            if (isScrolling) return;
            
            // 阻止页面滚动
            e.preventDefault();
        }, false);
        
        // 处理触摸结束
        player.addEventListener('touchend', function(e) {
            if (!startX || !startY || isScrolling) return;
            
            // 计算滑动的距离
            distX = e.changedTouches[0].clientX - startX;
            
            // 重置开始坐标
            startX = null;
            startY = null;
            
            // 判断是否需要切换视图
            if (Math.abs(distX) >= threshold) {
                if (distX > 0) {
                    // 向右滑动，显示播放器视图
                    showPlayerView();
                } else {
                    // 向左滑动，显示歌词视图
                    showLyricsView();
                }
                
                // 显示滑动提示动画
                showSwipeHint(distX < 0 ? 'right' : 'left');
            }
        }, false);
        
        // 初始页面加载时显示播放视图
        showPlayerView();
    }
    
    // 显示滑动提示动画
    function showSwipeHint(direction) {
        const player = document.querySelector('.content .player');
        if (!player) return;
        
        // 创建提示元素
        const hint = document.createElement('div');
        hint.className = 'swipe-hint';
        hint.innerHTML = `<i class="bi bi-arrow-${direction}"></i>`;
        
        // 添加到播放器
        player.appendChild(hint);
        
        // 动画结束后移除
        setTimeout(() => {
            hint.remove();
        }, 500);
    }

    // 初始化移动端搜索框
    function initMobileSearch() {
        const searchElement = document.querySelector('.titbar > .search');
        const searchInput = document.querySelector('.search-music');
        if (!searchElement || !searchInput) return;
        
        // 将搜索框设置为折叠状态
        searchElement.classList.add('collapsed');
        
        // 点击搜索框展开
        searchElement.addEventListener('click', function(e) {
            if (searchElement.classList.contains('collapsed')) {
                searchElement.classList.remove('collapsed');
                searchElement.classList.add('expanded');
                searchInput.focus();
                e.stopPropagation(); // 阻止事件冒泡
            }
        });
        
        // 点击输入框阻止折叠
        searchInput.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        // 点击其他地方折叠搜索框
        document.addEventListener('click', function() {
            if (searchElement.classList.contains('expanded')) {
                if (searchInput.value.trim() === '') {
                    searchElement.classList.remove('expanded');
                    searchElement.classList.add('collapsed');
                }
            }
        });
        
        // 输入内容后按下回车搜索
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                // 如果有全局搜索函数，调用它
                if (typeof handleSearch === 'function') {
                    handleSearch();
                }
                // 隐藏键盘
                searchInput.blur();
            }
        });
    }

    // 初始化底部导航栏
    function initMobileNavbar() {
        const navbar = document.querySelector('.mobile-navbar');
        if (!navbar) return;
        
        // 导航项点击事件
        navbar.querySelectorAll('[data-page]').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                
                // 移除所有导航项的高亮
                navbar.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                
                // 高亮当前点击的导航项
                this.classList.add('active');
                
                // 显示对应页面
                const pageName = this.getAttribute('data-page');
                document.querySelectorAll('.content > div').forEach(page => {
                    page.classList.add('hide');
                });
                
                const targetPage = document.querySelector(`.content ${pageName}`);
                if (targetPage) {
                    targetPage.classList.remove('hide');
                    
                    // 如果是播放器页面，确保显示播放控制视图
                    if (pageName === '.content .player') {
                        const player = document.querySelector('.content .player');
                        if (player) {
                            player.classList.add('show-player');
                            player.classList.remove('show-lyrics');
                            
                            // 更新页面指示器
                            updatePageIndicator(false);
                        }
                    }
                }
            });
        });
        
        // 播放列表切换按钮
        const playlistToggle = navbar.querySelector('.playlist-toggle');
        if (playlistToggle) {
            playlistToggle.addEventListener('click', function(e) {
                e.preventDefault();
                toggleMobilePlaylist();
            });
        }
    }
    
    // 更新页面指示器状态
    function updatePageIndicator(isLyricsView) {
        const dots = document.querySelectorAll('.page-indicator .dot');
        dots.forEach((dot, index) => {
            if ((index === 0 && !isLyricsView) || (index === 1 && isLyricsView)) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    // 切换移动端播放列表浮窗
    function toggleMobilePlaylist() {
        const mobilePlaylist = document.querySelector('.mobile-playlist');
        if (!mobilePlaylist) return;
        
        // 切换播放列表显示状态
        mobilePlaylist.classList.toggle('open');
        
        // 如果打开了播放列表，从侧边栏复制内容到移动播放列表
        if (mobilePlaylist.classList.contains('open')) {
            updateMobilePlaylistContent();
        }
    }
    
    // 更新移动端播放列表内容
    function updateMobilePlaylistContent() {
        const sidebarPlaylist = document.querySelector('#playing-list');
        const mobilePlaylistContent = document.querySelector('.mobile-playlist-content');
        
        if (!sidebarPlaylist || !mobilePlaylistContent) return;
        
        // 复制播放列表内容
        mobilePlaylistContent.innerHTML = sidebarPlaylist.innerHTML;
        
        // 为复制的播放列表项添加事件监听
        mobilePlaylistContent.querySelectorAll('.song').forEach(song => {
            song.addEventListener('click', function(e) {
                // 模拟点击原播放列表中的相同项目
                const bvid = this.getAttribute('data-bvid');
                if (bvid) {
                    const originalSong = sidebarPlaylist.querySelector(`.song[data-bvid="${bvid}"]`);
                    if (originalSong) {
                        // 阻止事件冒泡，避免多次处理
                        e.stopPropagation();
                        
                        // 检查是否点击了控制按钮
                        const isControlClick = e.target.closest('.controls');
                        
                        if (!isControlClick) {
                            // 点击歌曲主体区域，模拟点击原列表中的相应歌曲
                            originalSong.click();
                            
                            // 关闭播放列表浮窗
                            document.querySelector('.mobile-playlist').classList.remove('open');
                            
                            // 切换到播放器页面
                            document.querySelector('.mobile-navbar [data-page=".player"]').click();
                        } else {
                            // 对于控制按钮的点击，查找并模拟点击原来的按钮
                            const controlType = e.target.closest('.love, .delete');
                            if (controlType) {
                                const originalControl = originalSong.querySelector(`.${controlType.className}`);
                                if (originalControl) {
                                    originalControl.click();
                                }
                                
                                // 更新移动播放列表中的按钮状态
                                if (controlType.classList.contains('love')) {
                                    const icon = controlType.querySelector('i');
                                    if (icon) {
                                        icon.classList.toggle('bi-heart');
                                        icon.classList.toggle('bi-heart-fill');
                                        icon.classList.toggle('loved');
                                    }
                                }
                            }
                        }
                    }
                }
            });
        });
    }
    
    // 初始化移动端播放列表
    function initMobilePlaylist() {
        const mobilePlaylist = document.querySelector('.mobile-playlist');
        const dragHandle = document.querySelector('.playlist-drag-handle');
        
        if (!mobilePlaylist || !dragHandle) return;
        
        // 实现播放列表拖拽功能
        let startY, startHeight, minHeight = 150, maxHeight = window.innerHeight * 0.7;
        let isDragging = false;
        
        dragHandle.addEventListener('touchstart', function(e) {
            isDragging = true;
            startY = e.touches[0].clientY;
            startHeight = mobilePlaylist.offsetHeight;
            mobilePlaylist.style.transition = 'none';
        });
        
        document.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            
            const deltaY = startY - e.touches[0].clientY;
            let newHeight = startHeight + deltaY;
            
            // 限制高度范围
            newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
            
            mobilePlaylist.style.height = `${newHeight}px`;
        });
        
        document.addEventListener('touchend', function() {
            if (!isDragging) return;
            
            isDragging = false;
            mobilePlaylist.style.transition = 'all 0.3s ease';
        });
        
        // 播放模式和重命名按钮事件
        const playmode = mobilePlaylist.querySelector('.playmode');
        const rename = mobilePlaylist.querySelector('.rename');
        
        if (playmode) {
            playmode.addEventListener('click', function() {
                // 触发侧边栏中的相同按钮
                const originalPlaymode = document.querySelector('.sidebar .playmode');
                if (originalPlaymode) {
                    originalPlaymode.click();
                    
                    // 同步图标
                    playmode.innerHTML = originalPlaymode.innerHTML;
                }
            });
        }
        
        if (rename) {
            rename.addEventListener('click', function() {
                // 触发侧边栏中的相同按钮
                const originalRename = document.querySelector('.sidebar .rename');
                if (originalRename) {
                    originalRename.click();
                }
            });
        }
    }
    
    // 更新播放列表数量显示
    function updatePlaylistCount() {
        const playlistCount = document.querySelector('.mobile-navbar .playlist-toggle .count');
        const playingList = document.querySelector('#playing-list');
        
        if (!playlistCount || !playingList) return;
        
        // 获取播放列表中的歌曲数量
        const songCount = playingList.querySelectorAll('.song').length;
        playlistCount.textContent = songCount;
        
        // 如果没有歌曲，隐藏数量显示
        if (songCount === 0) {
            playlistCount.style.display = 'none';
        } else {
            playlistCount.style.display = 'block';
        }
    }
    
    // 监听播放列表变化并更新移动端UI
    function listenToPlaylistChanges() {
        // 使用MutationObserver监听播放列表变化
        const playingList = document.querySelector('#playing-list');
        if (!playingList) return;
        
        const observer = new MutationObserver(function(mutations) {
            updatePlaylistCount();
            
            // 如果移动播放列表是打开的，更新其内容
            const mobilePlaylist = document.querySelector('.mobile-playlist');
            if (mobilePlaylist && mobilePlaylist.classList.contains('open')) {
                updateMobilePlaylistContent();
            }
        });
        
        observer.observe(playingList, { childList: true, subtree: true });
    }
    
    // 监听窗口加载完成，执行一些需要DOM完全加载的操作
    window.addEventListener('load', function() {
        listenToPlaylistChanges();
        
        // 如果是移动设备，初始化UI
        if (isMobileDevice()) {
            updatePlaylistCount();
        }
    });

})();
