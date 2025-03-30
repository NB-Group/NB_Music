//歌词渲染类
class LyricsPlayer {
    constructor(lyricsString, audioElement, settingManager) {
        this.lyricsContainer = document.getElementById("lyrics-container");
        this.lyricsContainer.innerHTML = "";
        this.parsedData = this.parseLyrics(lyricsString);
        this.audio = audioElement;
        this.activeLines = new Set();
        this.completedLines = new Set();
        this.animationFrame = null;
        this.lastScrollTime = Date.now();
        this.settingManager = settingManager;
        this.activeLineIndex = -1;
        this.previousActiveIndex = -1;
        this.desktopLyricsEnabled = false;
        this.currentSongInfo = null;
        this.ipcRenderer = null;
        
        // 检查是否在Electron环境中
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                this.ipcRenderer = ipcRenderer;
                
                // 监听桌面歌词状态变化
                this.ipcRenderer.on('desktop-lyrics-closed', () => {
                    this.desktopLyricsEnabled = false;
                    this.updateDesktopLyricsButton();
                });
                
                this.ipcRenderer.on('desktop-lyrics-ready', () => {
                    this.desktopLyricsEnabled = true;
                    this.updateDesktopLyricsButton();
                    this.syncDesktopLyrics();
                });
                
                // 监听主窗口最小化事件
                this.ipcRenderer.on('window-minimized', () => {
                    this.isWindowMinimized = true;
                    // 立即同步一次，确保歌词是最新的
                    if (this.desktopLyricsEnabled) {
                        this.syncDesktopLyrics();
                        // 启动后台同步机制
                        this.startBackgroundSync();
                    }
                });
                
                this.ipcRenderer.on('window-restored', () => {
                    this.isWindowMinimized = false;
                    // 停止后台同步
                    this.stopBackgroundSync();
                });
                
                // 响应主进程请求同步歌词
                this.ipcRenderer.on('request-lyrics-sync', () => {
                    if (this.desktopLyricsEnabled) {
                        this.syncDesktopLyrics();
                    }
                });
                
                // 响应桌面歌词发送的控制命令
                this.ipcRenderer.on('desktop-lyrics-control', (_, command, data) => {
                    if (command === 'toggle-play') {
                        // 切换播放/暂停
                        if (this.audio.paused) {
                            this.audio.play();
                        } else {
                            this.audio.pause();
                        }
                    } else if (command === 'seek' && typeof data === 'number') {
                        // 跳转到指定时间
                        if (!isNaN(data) && this.audio.duration) {
                            this.audio.currentTime = Math.max(0, Math.min(data, this.audio.duration));
                        }
                    }
                });
                
                // 检查桌面歌词设置
                this.desktopLyricsEnabled = this.settingManager.getSetting('desktopLyricsEnabled') === 'true';
                if (this.desktopLyricsEnabled) {
                    this.ipcRenderer.send('toggle-desktop-lyrics', true);
                }
            } catch (error) {
                console.error('初始化IPC失败:', error);
            }
        }

        // 初始化后台同步定时器
        this.backgroundSyncInterval = null;
        this.isWindowMinimized = false;

        // 创建滚动容器
        this.scrollWrapper = document.createElement("div");
        this.scrollWrapper.className = "lyrics-scroll-wrapper";
        this.lyricsContainer.appendChild(this.scrollWrapper);

        // 添加桌面歌词切换按钮
        this.addDesktopLyricsToggle();

        // 绑定audio事件
        this.audio.addEventListener("play", () => this.start());
        this.audio.addEventListener("pause", () => this.stop());
        this.audio.addEventListener("seeking", () => this.onSeek());

        // 添加页面可见性状态检测
        this.isVisible = true;
        this.resizeObserver = null;
        
        // 初始化可见性监听
        this.initVisibilityObserver();
        
        this.setVisibility(this.settingManager.getSetting('lyricsEnabled')=="true");
        this.init();
    }

    init() {
        this.lyricsContainer.style.position = "relative";
        this.scrollWrapper.innerHTML = "";

        // 创建歌词行元素
        let lyricIndex = 0; // 跟踪实际歌词的索引
        let visibleLyricCount = 0; // 记录显示的歌词行数量
        const maxVisibleLyrics = 7; // 初始状态下最多显示的歌词行数
        
        this.parsedData.forEach((data) => {
            const element = data.type === "metadata" ? this.createMetadataElement(data) : this.createLyricElement(data);
            if (data.type === "lyric") {
                // 添加数据索引属性，便于调试和确保索引正确
                element.setAttribute("data-lyric-index", lyricIndex);
                
                // 添加初始过渡动画类
                element.classList.add("initial");
                
                // 只显示前maxVisibleLyrics行，其余隐藏
                if (visibleLyricCount < maxVisibleLyrics) {
                    // 根据位置分配样式类和位置
                    if (visibleLyricCount === 0) {
                        // 第一行放在中央
                        element.style.top = `50%`;
                        element.style.transform = `translateY(-50%)`;
                    } else if (visibleLyricCount < maxVisibleLyrics) {
                        // 后面的行依次向下排列
                        element.style.top = `${50 + visibleLyricCount * 60}px`;
                        element.classList.add(`after-${visibleLyricCount}`);
                    }
                    
                    visibleLyricCount++;
                } else {
                    // 超过最大显示数量的歌词行初始设为不可见
                    element.style.opacity = "0";
                    element.style.top = "200%";
                    element.classList.add("hidden");
                }
                
                // 延迟一小段时间后移除初始类，以确保过渡动画生效
                setTimeout(() => {
                    element.classList.remove("initial");
                }, 500);
                
                lyricIndex++;
            }
            this.scrollWrapper.appendChild(element);
        });
        
        // 如果存在歌词，初始显示第一屏
        if (this.parsedData.some(data => data.type === "lyric")) {
            setTimeout(() => {
                this.setupInitialView();
            }, 100);
        }
    }

    setupInitialView() {
        const lyricLines = Array.from(this.scrollWrapper.querySelectorAll(".lyric-line"));
        const containerHeight = this.lyricsContainer.clientHeight;
        
        // 计算中心点位置
        const centerY = containerHeight / 2;
        
        // 最多显示7行
        const maxVisible = 7;
        const visibleLines = lyricLines.slice(0, maxVisible);
        
        // 先隐藏所有行
        lyricLines.forEach(line => {
            line.classList.remove("active", "before-1", "before-2", "before-3", 
                               "after-1", "after-2", "after-3", "distant");
            line.classList.add("distant");
            line.style.opacity = "0";
        });
        
        // 设置可见行的位置
        visibleLines.forEach((line, index) => {
            line.classList.remove("distant");
            line.style.opacity = "";
            
            if (index === 0) {
                // 第一行放在中央
                line.style.top = `${centerY - line.offsetHeight / 2}px`;
            } else {
                // 后面的行依次往下
                line.classList.add(`after-${index}`);
                line.style.top = `${centerY - line.offsetHeight / 2 + (index * 60)}px`;
            }
        });
        
        // 标记我们已经显示了初始视图
        this.initialViewDisplayed = true;
    }

    setVisibility(visible) {
        if (this.lyricsContainer) {
            // this.lyricsContainer.style.opacity = visible ? '1' : '0';
            // this.lyricsContainer.style.width = visible ? '' : '0';
            this.lyricsContainer.style.display = visible ? "" : "none";
            
            // 如果正在显示并且容器可见，刷新布局
            if (visible && this.isVisible) {
                setTimeout(() => this.refreshLayout(), 50);
            }
        }
    }

    changeLyrics(newLyricsString) {
        this.stop();
        this.activeLines.clear();
        this.completedLines.clear();
        this.activeLineIndex = -1;
        this.previousActiveIndex = -1;
        this.scrollWrapper.innerHTML = "";
        this.parsedData = this.parseLyrics(newLyricsString);
        this.init();
        
        // 添加一个小延迟，等待DOM更新后刷新布局
        setTimeout(() => {
            if (this.isVisible) {
                this.refreshLayout();
            }
        }, 50);
        
        // 同步桌面歌词
        if (this.desktopLyricsEnabled) {
            this.syncDesktopLyrics();
        }
        
        if (!this.audio.paused) {
            this.start();
        }
    }

    parseLyrics(lyricsString) {
        if (!lyricsString) {
            return [
                {
                    type: "lyric",
                    lineStart: 0,
                    lineDuration: 5000,
                    chars: [{ text: "暂无歌词", startTime: 0, duration: 5000 }]
                }
            ];
        }

        const lines = lyricsString.split("\n");
        const parsedData = [];

        // 检查是否为传统时间戳格式
        const isTraditionalFormat = lines.some((line) => line.match(/^\[\d{2}:\d{2}\.\d{2,3}\]/));

        if (isTraditionalFormat) {
            lines.forEach((line) => {
                if (line.trim() === "") return;
                const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
                if (match) {
                    const [, mm, ss, ms, text] = match;
                    const startTime = (parseInt(mm) * 60 + parseInt(ss)) * 1000 + parseInt(ms);
                    parsedData.push({
                        type: "lyric",
                        lineStart: startTime,
                        lineDuration: 5000,
                        chars: [
                            {
                                text: text.trim(),
                                startTime: startTime,
                                duration: 5000
                            }
                        ]
                    });
                }
            });
        } else {
            lines.forEach((line) => {
                if (line.trim() === "") return;
                if (line.startsWith("{")) {
                    const metadata = JSON.parse(line);
                    parsedData.push({
                        type: "metadata",
                        time: metadata.t,
                        content: metadata.c
                    });
                    return;
                }
                if (line.startsWith("[")) {
                    const timeMatch = line.match(/\[(\d+),(\d+)\]/);
                    const charMatches = line.match(/\((\d+),(\d+),\d+\)([^(]+)/g);
                    if (timeMatch && charMatches) {
                        const lineStart = parseInt(timeMatch[1]);
                        const lineDuration = parseInt(timeMatch[2]);
                        const chars = charMatches.map((charMatch) => {
                            const [, startTime, duration, text] = charMatch.match(/\((\d+),(\d+),\d+\)(.+)/);
                            return {
                                text,
                                startTime: parseInt(startTime),
                                duration: parseInt(duration)
                            };
                        });
                        parsedData.push({
                            type: "lyric",
                            lineStart,
                            lineDuration,
                            chars
                        });
                    }
                }
            });
        }
        return parsedData;
    }

    createLyricElement(lyricData) {
        const lineDiv = document.createElement("div");
        lineDiv.className = "lyric-line";

        if (lyricData.chars.length === 1 && lyricData.chars[0].text === lyricData.chars[0].text.trim()) {
            const charSpan = document.createElement("span");
            charSpan.className = "char";
            charSpan.textContent = lyricData.chars[0].text;
            lineDiv.appendChild(charSpan);
        } else {
            lyricData.chars.forEach((char) => {
                const charSpan = document.createElement("span");
                charSpan.className = "char";
                charSpan.textContent = char.text;
                lineDiv.appendChild(charSpan);
            });
        }
        return lineDiv;
    }

    createMetadataElement(metadata) {
        const div = document.createElement("div");
        div.className = "metadata";
        metadata.content.forEach((item) => {
            const span = document.createElement("span");
            span.textContent = item.tx;
            div.appendChild(span);
        });
        return div;
    }


    start() {
        // 防止重复启动
        if (this.animationFrame) {
            return;
        }
        this.animate();
    }

    stop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    onSeek() {
        this.activeLines.clear();
        this.completedLines.clear();
        this.previousActiveIndex = -1;
        
        Array.from(this.scrollWrapper.querySelectorAll(".char")).forEach((char) => {
            char.classList.remove("active", "completed");
        });
        
        // 重置行位置类
        Array.from(this.scrollWrapper.querySelectorAll(".lyric-line")).forEach((line) => {
            line.classList.remove("active", "before-1", "before-2", "before-3", "after-1", "after-2", "after-3", "distant");
        });
    }

    animate() {
        // 只有当scrollWrapper不存在时才返回，即使页面不可见也继续计算
        // 这样在页面重新显示时动画状态是最新的
        if (!this.scrollWrapper) return;
        
        const currentTime = this.audio.currentTime * 1000;
        let activeLineFound = -1;
        let anyCharActive = false;

        // 获取所有歌词行元素，过滤掉metadata元素
        const lyricElements = Array.from(this.scrollWrapper.children).filter(
            el => !el.classList.contains("metadata")
        );
        
        // 循环所有歌词数据
        let lyricIndex = 0;
        this.parsedData.forEach((data) => {
            if (data.type === "lyric") {
                const line = lyricElements[lyricIndex]; // 使用歌词索引而不是数据索引
                if (!line) return;
                
                const chars = Array.from(line.children);
                let hasActiveChar = false;
                let allCompleted = true;

                data.chars.forEach((char, index) => {
                    const charElement = chars[index];
                    if (!charElement) return;
                    
                    const charStartTime = char.startTime;
                    const charEndTime = char.startTime + char.duration;

                    // 仅在页面可见时更新DOM，但始终计算状态
                    if (currentTime >= charStartTime && currentTime <= charEndTime) {
                        if (this.isVisible) {
                            charElement.classList.add("active");
                            charElement.classList.remove("completed");
                        }
                        hasActiveChar = true;
                        anyCharActive = true;
                        allCompleted = false;
                    } else if (currentTime > charEndTime) {
                        if (this.isVisible) {
                            charElement.classList.remove("active");
                            charElement.classList.add("completed");
                        }
                    } else {
                        if (this.isVisible) {
                            charElement.classList.remove("active", "completed");
                        }
                        allCompleted = false;
                    }
                });

                // 如果这一行有激活字符，将其标记为激活行，使用lyricIndex，确保行号正确
                if (hasActiveChar) {
                    activeLineFound = lyricIndex;
                }

                if (allCompleted) {
                    this.completedLines.add(lyricIndex);
                }
                
                // 只增加歌词索引计数器
                lyricIndex++;
            }
        });

        // 防止值为-1时的比较
        const effectiveActiveIndex = activeLineFound !== -1 ? activeLineFound : null;
        const effectivePreviousIndex = this.activeLineIndex !== -1 ? this.activeLineIndex : null;

        // 判断是否需要更新行位置，仅在页面可见时才更新DOM
        if (this.isVisible && 
            ((effectiveActiveIndex !== null && effectiveActiveIndex !== effectivePreviousIndex) || 
            (!anyCharActive && effectivePreviousIndex !== null))) {
            
            // 记录上一个激活行
            if (effectiveActiveIndex !== null) {
                this.previousActiveIndex = this.activeLineIndex;
                this.activeLineIndex = activeLineFound;
                
                // 标记至少有一行被激活过，从初始视图切换到动态视图
                this.hadActiveLines = true;
                
                // 同步桌面歌词显示
                if (this.desktopLyricsEnabled) {
                    this.syncDesktopLyrics();
                }
            }
            
            // 调用更新行位置方法
            this.updateLinePositions(activeLineFound, anyCharActive);
        }

        // 如果主窗口最小化且有桌面歌词，确保继续同步
        if (this.isWindowMinimized && this.desktopLyricsEnabled && 
            effectiveActiveIndex !== null && effectiveActiveIndex !== this.lastSyncedIndex) {
            this.syncDesktopLyrics();
            this.lastSyncedIndex = effectiveActiveIndex;
        }

        // 保存animationFrame引用以便能够取消它
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    updateLinePositions(activeIndex, hasActiveChar) {
        // 如果没有激活行也没有上一次激活行，直接返回
        if (activeIndex === -1 && this.previousActiveIndex === -1) {
            // 如果从未有激活行，并且初始视图还未显示，则显示初始视图
            if (!this.hadActiveLines && !this.initialViewDisplayed) {
                this.setupInitialView();
            }
            return;
        }
        
        // 标记我们已经有过激活行
        this.hadActiveLines = true;
        
        // 如果没有激活行但有上一次激活行，则使用上一次激活行的位置，但不应用激活样式
        const displayIndex = activeIndex !== -1 ? activeIndex : this.activeLineIndex;
        
        // 只获取歌词行元素，排除metadata元素
        const lyricLines = Array.from(this.scrollWrapper.querySelectorAll(".lyric-line"));
        
        // 重置所有行的样式
        lyricLines.forEach(line => {
            line.classList.remove("active", "before-1", "before-2", "before-3", 
                               "after-1", "after-2", "after-3", "distant", "hidden");
            
            // 保持所有行可见
            line.style.opacity = "";
        });
        
        // 获取容器的高度用于计算中心位置
        const containerHeight = this.lyricsContainer.clientHeight;
        
        // 确保displayIndex在有效范围内
        if (displayIndex >= 0 && displayIndex < lyricLines.length) {
            // 计算要显示的行索引范围
            const startIdx = Math.max(0, displayIndex - 3);
            const endIdx = Math.min(lyricLines.length - 1, displayIndex + 3);
            
            // 遍历所有行并更新位置
            lyricLines.forEach((line, index) => {
                // 确定行是否在可见范围内
                const isVisible = index >= startIdx && index <= endIdx;
                
                // 设置可见性
                line.style.opacity = isVisible ? "" : "0";
                
                // 只在有激活字符且索引匹配时才将该行标记为active
                if (index === activeIndex && hasActiveChar) {
                    line.classList.add("active");
                }
                
                // 计算行中心位置
                const centerPos = containerHeight / 2 - line.offsetHeight / 2;
                
                // 确保行元素已渲染，获取正确的高度
                if (!line.offsetHeight) {
                    line.style.visibility = 'hidden';
                    line.style.display = '';
                    line.style.position = 'absolute';
                }
                
                // 根据行与显示行的相对位置设置样式和位置
                if (index === displayIndex) {
                    line.style.top = `${centerPos}px`;
                    // 确保当前行始终在视图中部，添加平滑滚动效果
                    this.scrollWrapper.scrollTo({
                        top: line.offsetTop - containerHeight / 2 + line.offsetHeight / 2,
                        behavior: 'smooth'
                    });
                } 
                else if (index === displayIndex - 1) {
                    line.classList.add("before-1");
                    setTimeout(() => {
                        line.style.top = `${centerPos - 60}px`;
                    }, 50);
                }
                else if (index === displayIndex - 2) {
                    line.classList.add("before-2");
                    setTimeout(() => {
                        line.style.top = `${centerPos - 110}px`;
                    }, 100);
                }
                else if (index === displayIndex - 3) {
                    line.classList.add("before-3");
                    setTimeout(() => {
                        line.style.top = `${centerPos - 160}px`;
                    }, 150);
                }
                else if (index < displayIndex - 3) {
                    line.classList.add("distant");
                    setTimeout(() => {
                        line.style.top = `${centerPos - 200}px`;
                    }, 200);
                }
                else if (index === displayIndex + 1) {
                    line.classList.add("after-1");
                    // 下方行的动画延迟，创造瀑布落下效果
                    setTimeout(() => {
                        line.style.top = `${centerPos + 60}px`;
                    }, 50);
                }
                else if (index === displayIndex + 2) {
                    line.classList.add("after-2");
                    setTimeout(() => {
                        line.style.top = `${centerPos + 110}px`;
                    }, 100);
                }
                else if (index === displayIndex + 3) {
                    line.classList.add("after-3");
                    setTimeout(() => {
                        line.style.top = `${centerPos + 160}px`;
                    }, 150);
                }
                else if (index > displayIndex + 3) {
                    line.classList.add("distant");
                    setTimeout(() => {
                        line.style.top = `${centerPos + 200}px`;
                    }, 200);
                }
                
                // 恢复行元素的可见性
                if (!line.offsetHeight) {
                    line.style.visibility = '';
                    line.style.display = '';
                    line.style.position = '';
                }
            });
        }
        
        // 应用瀑布效果，确保索引有效
        if (this.previousActiveIndex !== -1 && 
            this.activeLineIndex !== -1 && 
            this.previousActiveIndex < this.activeLineIndex) {
            
            for (let i = this.previousActiveIndex; i < this.activeLineIndex; i++) {
                if (i >= 0 && i < lyricLines.length) {
                    const delay = (i - this.previousActiveIndex) * 120;
                    setTimeout(() => {
                        this.applyWaterfallEffect(lyricLines[i], i, this.activeLineIndex);
                    }, delay);
                }
            }
        }
    }

    // 对单个行应用瀑布效果
    applyWaterfallEffect(lineElement, lineIndex, activeIndex) {
        const containerHeight = this.lyricsContainer.clientHeight;
        const distance = activeIndex - lineIndex;
        
        // 根据到活跃行的距离计算位置
        let position;
        if (distance === 1) {
            position = containerHeight / 2 - lineElement.offsetHeight / 2 - 60;
            lineElement.classList.add("before-1");
        } else if (distance === 2) {
            position = containerHeight / 2 - lineElement.offsetHeight / 2 - 110;
            lineElement.classList.add("before-2");
        } else {
            position = containerHeight / 2 - lineElement.offsetHeight / 2 - 160;
            lineElement.classList.add("before-3");
        }
        
        // 应用位置
        lineElement.style.top = `${position}px`;
    }

    initVisibilityObserver() {
        // 监听容器尺寸变化
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    // 检测高度变化，如果从0变为非0，表示页面重新显示
                    if (entry.contentRect.height > 0 && !this.isVisible) {
                        this.isVisible = true;
                        // 延迟一点时间确保DOM已完全显示
                        setTimeout(() => {
                            this.refreshLayout();
                            // 如果音频正在播放，确保动画也在运行
                            if (!this.audio.paused && !this.animationFrame) {
                                this.start();
                            }
                        }, 100);
                    } else if (entry.contentRect.height === 0 && this.isVisible) {
                        this.isVisible = false;
                        // 页面隐藏时暂停动画但不取消
                        // 注意：我们不调用stop()，因为那会取消animationFrame
                    }
                }
            });
            
            // 观察歌词容器
            this.resizeObserver.observe(this.lyricsContainer);
            
            // 观察父容器（player页面）
            const playerPage = document.querySelector('.player');
            if (playerPage) {
                this.resizeObserver.observe(playerPage);
            }
        }
        
        // 当窗口尺寸改变时也刷新布局
        window.addEventListener('resize', () => {
            if (this.isVisible) {
                this.refreshLayout();
            }
        });
    }
    
    refreshLayout() {
        // 如果没有活跃行但有解析数据，刷新初始视图
        if (this.activeLineIndex === -1 && this.parsedData && this.parsedData.length > 0) {
            this.setupInitialView();
        } else if (this.activeLineIndex !== -1) {
            // 如果有活跃行，更新行位置
            this.updateLinePositions(this.activeLineIndex, true);
        }
        
        // 标记我们已经显示了初始视图
        this.initialViewDisplayed = true;
        
        // 如果音频正在播放但动画没有运行，则重新启动动画
        if (!this.audio.paused && !this.animationFrame) {
            this.start();
        }
    }

    // 添加桌面歌词切换按钮
    addDesktopLyricsToggle() {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'desktop-lyrics-toggle';
        toggleBtn.title = '桌面歌词';
        toggleBtn.innerHTML = '<i class="bi bi-display"></i>';
        
        if (this.desktopLyricsEnabled) {
            toggleBtn.classList.add('active');
        }
        
        toggleBtn.addEventListener('click', () => {
            this.toggleDesktopLyrics();
        });
        
        this.lyricsContainer.appendChild(toggleBtn);
        this.desktopLyricsToggle = toggleBtn;
        
        // 添加桌面歌词设置面板
        this.addDesktopLyricsSettings();
    }
    
    // 添加桌面歌词设置面板
    addDesktopLyricsSettings() {
        const settingsPanel = document.createElement('div');
        settingsPanel.className = 'desktop-lyrics-settings';
        
        const fontSizeItem = document.createElement('div');
        fontSizeItem.className = 'setting-item';
        
        const fontSizeTitle = document.createElement('div');
        fontSizeTitle.className = 'setting-title';
        fontSizeTitle.textContent = '字体大小';
        
        const fontSizeSliderContainer = document.createElement('div');
        fontSizeSliderContainer.className = 'slider-container';
        
        const fontSizeSlider = document.createElement('input');
        fontSizeSlider.type = 'range';
        fontSizeSlider.className = 'slider';
        fontSizeSlider.min = '16';
        fontSizeSlider.max = '48';
        fontSizeSlider.step = '1';
        fontSizeSlider.value = this.settingManager.getSetting('desktopLyricsFontSize') || '28';
        
        const fontSizeValue = document.createElement('div');
        fontSizeValue.className = 'slider-value';
        fontSizeValue.textContent = fontSizeSlider.value + 'px';
        
        fontSizeSlider.addEventListener('input', () => {
            fontSizeValue.textContent = fontSizeSlider.value + 'px';
            this.settingManager.setSetting('desktopLyricsFontSize', fontSizeSlider.value);
            this.updateDesktopLyricsStyle();
        });
        
        fontSizeSliderContainer.appendChild(fontSizeSlider);
        fontSizeSliderContainer.appendChild(fontSizeValue);
        
        fontSizeItem.appendChild(fontSizeTitle);
        fontSizeItem.appendChild(fontSizeSliderContainer);
        
        // 透明度设置
        const opacityItem = document.createElement('div');
        opacityItem.className = 'setting-item';
        
        const opacityTitle = document.createElement('div');
        opacityTitle.className = 'setting-title';
        opacityTitle.textContent = '背景透明度';
        
        const opacitySliderContainer = document.createElement('div');
        opacitySliderContainer.className = 'slider-container';
        
        const opacitySlider = document.createElement('input');
        opacitySlider.type = 'range';
        opacitySlider.className = 'slider';
        opacitySlider.min = '0';
        opacitySlider.max = '100';
        opacitySlider.step = '5';
        opacitySlider.value = this.settingManager.getSetting('desktopLyricsOpacity') || '50';
        
        const opacityValue = document.createElement('div');
        opacityValue.className = 'slider-value';
        opacityValue.textContent = opacitySlider.value + '%';
        
        opacitySlider.addEventListener('input', () => {
            opacityValue.textContent = opacitySlider.value + '%';
            this.settingManager.setSetting('desktopLyricsOpacity', opacitySlider.value);
            this.updateDesktopLyricsStyle();
        });
        
        opacitySliderContainer.appendChild(opacitySlider);
        opacitySliderContainer.appendChild(opacityValue);
        
        opacityItem.appendChild(opacityTitle);
        opacityItem.appendChild(opacitySliderContainer);
        
        settingsPanel.appendChild(fontSizeItem);
        settingsPanel.appendChild(opacityItem);
        
        this.lyricsContainer.appendChild(settingsPanel);
        this.desktopLyricsSettings = settingsPanel;
        
        // 显示/隐藏设置面板
        this.desktopLyricsToggle.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            settingsPanel.classList.toggle('visible');
        });
        
        // 点击其他地方关闭设置面板
        document.addEventListener('click', (e) => {
            if (!settingsPanel.contains(e.target) && e.target !== this.desktopLyricsToggle) {
                settingsPanel.classList.remove('visible');
            }
        });

        // 监听来自桌面歌词窗口的样式更新
        if (this.ipcRenderer) {
            this.ipcRenderer.on('desktop-lyrics-style-changed', (_, style) => {
                // 更新设置到SettingManager
                if (style.currentLineSize) {
                    this.settingManager.setSetting('desktopLyricsFontSize', style.currentLineSize.toString());
                    if (fontSizeSlider) fontSizeSlider.value = style.currentLineSize;
                    if (fontSizeValue) fontSizeValue.textContent = `${style.currentLineSize}px`;
                }
                
                if (style.backgroundColor) {
                    const opacity = parseInt(style.backgroundColor.match(/[^,]+(?=\))/)[0] * 100);
                    this.settingManager.setSetting('desktopLyricsOpacity', opacity.toString());
                    if (opacitySlider) opacitySlider.value = opacity;
                    if (opacityValue) opacityValue.textContent = `${opacity}%`;
                }
                
                // 更新桌面歌词样式
                this.updateDesktopLyricsStyle();
            });
            
            // 监听背景颜色选择器显示请求
            this.ipcRenderer.on('show-lyrics-bg-color-picker', () => {
                this.desktopLyricsSettings.classList.add('visible');
                // 聚焦不透明度滑块
                const opacitySlider = this.desktopLyricsSettings.querySelector('input[type="range"]');
                if (opacitySlider) {
                    opacitySlider.focus();
                }
            });
        }
    }
    
    // 更新桌面歌词按钮状态
    updateDesktopLyricsButton() {
        if (this.desktopLyricsToggle) {
            if (this.desktopLyricsEnabled) {
                this.desktopLyricsToggle.classList.add('active');
                this.desktopLyricsToggle.title = '关闭桌面歌词';
            } else {
                this.desktopLyricsToggle.classList.remove('active');
                this.desktopLyricsToggle.title = '打开桌面歌词';
            }
        }
    }
    
    // 切换桌面歌词
    toggleDesktopLyrics() {
        if (!this.ipcRenderer) return;
        
        this.desktopLyricsEnabled = !this.desktopLyricsEnabled;
        this.settingManager.setSetting('desktopLyricsEnabled', this.desktopLyricsEnabled.toString());
        this.updateDesktopLyricsButton();
        
        // 通知主进程切换桌面歌词
        this.ipcRenderer.send('toggle-desktop-lyrics', this.desktopLyricsEnabled);
        
        // 如果启用了桌面歌词，立即同步当前状态
        if (this.desktopLyricsEnabled) {
            this.updateDesktopLyricsStyle();
            this.syncDesktopLyrics();
        }
    }
    
    // 更新桌面歌词样式
    updateDesktopLyricsStyle() {
        if (!this.ipcRenderer || !this.desktopLyricsEnabled) return;
        
        const fontSize = this.settingManager.getSetting('desktopLyricsFontSize') || '28';
        const opacity = this.settingManager.getSetting('desktopLyricsOpacity') || '50';
        
        // 获取当前主题颜色
        const root = document.documentElement;
        const style = getComputedStyle(root);
        const theme1 = style.getPropertyValue('--theme-1').trim();
        const theme2 = style.getPropertyValue('--theme-2').trim();
        
        // 计算背景色
        const bgOpacity = parseInt(opacity) / 100;
        const backgroundColor = `rgba(0, 0, 0, ${bgOpacity})`;
        
        // 获取字体
        const fontFamily = this.settingManager.getSetting('fontFamilyCustom') || 
                           this.settingManager.getSetting('fontFamilyFallback') ||
                           '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        
        // 发送样式到桌面歌词窗口
        this.ipcRenderer.send('update-lyrics-style', {
            currentLineSize: parseInt(fontSize),
            nextLineSize: Math.max(parseInt(fontSize) - 4, 14),
            theme1: theme1,
            theme2: theme2,
            backgroundColor: backgroundColor,
            fontFamily: fontFamily
        });
    }
    
    // 同步桌面歌词显示
    syncDesktopLyrics() {
        if (!this.ipcRenderer || !this.desktopLyricsEnabled) return;
        
        // 获取当前激活的歌词行
        let currentLine = "等待播放...";
        let nextLine = "";
        
        // 找到当前激活的行
        if (this.activeLineIndex !== -1 && this.activeLineIndex < this.parsedData.length) {
            const lyricsData = this.parsedData.filter(data => data.type === "lyric");
            
            if (this.activeLineIndex < lyricsData.length) {
                const activeLineData = lyricsData[this.activeLineIndex];
                if (activeLineData) {
                    const lineText = activeLineData.chars.map(char => char.text).join('');
                    currentLine = lineText || "等待播放...";
                    
                    // 找下一行
                    if (this.activeLineIndex + 1 < lyricsData.length) {
                        const nextData = lyricsData[this.activeLineIndex + 1];
                        if (nextData) {
                            nextLine = nextData.chars.map(char => char.text).join('');
                        }
                    }
                }
            }
        }
        
        // 发送歌词数据到桌面歌词窗口 - 无论窗口状态
        this.ipcRenderer.send('update-desktop-lyrics', {
            currentLine: currentLine,
            nextLine: nextLine,
            songInfo: this.currentSongInfo,
            currentTime: this.audio.currentTime,
            duration: this.audio.duration,
            isPlaying: !this.audio.paused
        });
    }

    // 设置当前播放的歌曲信息
    setCurrentSongInfo(songInfo) {
        this.currentSongInfo = songInfo;
        // 如果桌面歌词已启用，同步信息
        if (this.desktopLyricsEnabled) {
            this.syncDesktopLyrics();
        }
    }

    // 添加启动后台同步的方法
    startBackgroundSync() {
        // 如果已经有同步定时器，先停止它
        this.stopBackgroundSync();
        
        // 创建新的定时器，每秒同步一次歌词
        this.backgroundSyncInterval = setInterval(() => {
            if (this.desktopLyricsEnabled) {
                this.syncDesktopLyrics();
            }
        }, 1000);
    }

    // 停止后台同步
    stopBackgroundSync() {
        if (this.backgroundSyncInterval) {
            clearInterval(this.backgroundSyncInterval);
            this.backgroundSyncInterval = null;
        }
    }

    // 当组件销毁时清理定时器
    destroy() {
        this.stop();
        this.stopBackgroundSync();
        
        // 清理其他资源...
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }
}

module.exports = LyricsPlayer;