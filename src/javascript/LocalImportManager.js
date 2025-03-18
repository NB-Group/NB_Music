/**
 * 本地文件导入管理器
 * 处理本地音频、视频和图片的导入
 */
class LocalImportManager {
    constructor(playlistManager, uiManager) {
        this.playlistManager = playlistManager;
        this.uiManager = uiManager;
        this.audioFile = null;
        this.coverFile = null;
        this.videoFile = null;
        this.audioFileName = '';
        this.audioUrl = '';
        this.coverUrl = '';
        this.videoUrl = '';
        
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeEvents());
        } else {
            this.initializeEvents();
        }
    }
    
    initializeEvents() {
        // 本地导入按钮事件
        const localImportBtn = document.getElementById('localImportBtn');
        const localImportDialog = document.getElementById('localImportDialog');
        const cancelLocalImport = document.getElementById('cancelLocalImport');
        const confirmLocalImport = document.getElementById('confirmLocalImport');
        
        if (localImportBtn) {
            localImportBtn.addEventListener('click', () => {
                this.resetForm();
                localImportDialog.classList.remove('hide');
            });
        }
        
        if (cancelLocalImport) {
            cancelLocalImport.addEventListener('click', () => {
                localImportDialog.classList.add('hide');
                this.resetForm();
            });
        }
        
        if (confirmLocalImport) {
            confirmLocalImport.addEventListener('click', () => {
                this.importLocalSong();
            });
        }
        
        // 拖放区域事件
        const fileDropzone = document.getElementById('fileDropzone');
        if (fileDropzone) {
            this.setupFileDropzone(fileDropzone);
        }
        
        // 封面图片选择
        const selectCoverBtn = document.getElementById('selectCoverBtn');
        const localCoverInput = document.getElementById('localCoverInput');
        
        if (selectCoverBtn && localCoverInput) {
            selectCoverBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localCoverInput.click();
            });
            
            localCoverInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleCoverSelect(e.target.files[0]);
                }
            });
        }
        
        // 背景视频选择
        const selectVideoBtn = document.getElementById('selectVideoBtn');
        const localVideoInput = document.getElementById('localVideoInput');
        
        if (selectVideoBtn && localVideoInput) {
            selectVideoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localVideoInput.click();
            });
            
            localVideoInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleVideoSelect(e.target.files[0]);
                }
            });
        }
        
        // 点击空白处关闭对话框
        localImportDialog?.addEventListener('click', (e) => {
            if (e.target === localImportDialog) {
                localImportDialog.classList.add('hide');
                this.resetForm();
            }
        });
        
        // ESC键关闭对话框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const dialog = document.getElementById('localImportDialog');
                if (dialog && !dialog.classList.contains('hide')) {
                    dialog.classList.add('hide');
                    this.resetForm();
                }
            }
        });
        
        // 监听表单输入，实时更新导入按钮状态
        const titleInput = document.getElementById('localSongTitle');
        const artistInput = document.getElementById('localArtist');
        const confirmBtn = document.getElementById('confirmLocalImport');
        
        const updateButtonState = () => {
            if (confirmBtn) {
                // 只有当音频文件存在且标题不为空时才启用按钮
                const hasAudio = this.audioFile !== null;
                const hasTitle = titleInput && titleInput.value.trim() !== '';
                
                confirmBtn.disabled = !(hasAudio && hasTitle);
                if (hasAudio && hasTitle) {
                    confirmBtn.classList.add('active');
                } else {
                    confirmBtn.classList.remove('active');
                }
            }
        };
        
        if (titleInput) {
            titleInput.addEventListener('input', updateButtonState);
        }
        
        if (artistInput) {
            artistInput.addEventListener('input', updateButtonState);
        }
        
        // 初始更新按钮状态
        updateButtonState();
    }
    
    /**
     * 设置文件拖放区域
     */
    setupFileDropzone(dropzone) {
        // 重新初始化音频输入
        const localAudioInput = document.getElementById('localAudioInput');
        if (!localAudioInput) {
            // 如果找不到输入元素，创建新的
            const newInput = document.createElement('input');
            newInput.type = 'file';
            newInput.id = 'localAudioInput';
            newInput.accept = 'audio/*';
            newInput.className = 'file-input';
            dropzone.appendChild(newInput);
        }
        
        // 获取正确的引用
        const audioInput = document.getElementById('localAudioInput');
        
        // 点击拖放区域触发文件选择
        dropzone.addEventListener('click', (e) => {
            // 防止重复触发
            if (e.target === dropzone || !e.target.closest('input[type="file"]')) {
                audioInput.click();
            }
        });
        
        // 文件拖放相关事件
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (eventName === 'dragenter' || eventName === 'dragover') {
                    dropzone.classList.add('dragover');
                } else {
                    dropzone.classList.remove('dragover');
                }
                
                if (eventName === 'drop') {
                    this.handleFileDrop(e.dataTransfer.files);
                }
            });
        });
        
        // 文件选择事件
        audioInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleAudioSelect(e.target.files[0]);
            }
        });
        
        // 防止拖放到整个页面
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    }
    
    /**
     * 处理文件拖放
     */
    handleFileDrop(files) {
        if (files.length === 0) return;
        
        // 处理拖放的文件
        const audioFiles = Array.from(files).filter(file => file.type.startsWith('audio/'));
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        const videoFiles = Array.from(files).filter(file => file.type.startsWith('video/'));
        
        // 优先处理音频文件
        if (audioFiles.length > 0) {
            this.handleAudioSelect(audioFiles[0]);
            
            // 如果同时拖放了封面和视频，也处理它们
            if (imageFiles.length > 0) {
                this.handleCoverSelect(imageFiles[0]);
            }
            
            if (videoFiles.length > 0) {
                this.handleVideoSelect(videoFiles[0]);
            }
            
            // 如果一次拖入了多个音频，显示提示
            if (audioFiles.length > 1) {
                this.uiManager.showNotification(`已选择第一个音频文件，忽略其他 ${audioFiles.length - 1} 个音频文件`, 'info');
            }
        } else if (imageFiles.length > 0) {
            // 如果没有音频，但有图片，作为封面处理
            this.handleCoverSelect(imageFiles[0]);
            this.uiManager.showNotification('请选择音频文件', 'info');
        } else if (videoFiles.length > 0) {
            // 如果没有音频和图片，但有视频，作为视频处理
            this.handleVideoSelect(videoFiles[0]);
            this.uiManager.showNotification('请选择音频文件', 'info');
        } else {
            this.uiManager.showNotification('请选择音频、图片或视频文件', 'warning');
        }
    }
    
    /**
     * 处理音频文件选择
     * @param {File} file - 选择的音频文件
     */
    handleAudioSelect(file) {
        if (!file.type.startsWith('audio/')) {
            this.uiManager.showNotification('请选择有效的音频文件', 'error');
            return;
        }
        
        this.audioFile = file;
        this.audioFileName = file.name;
        
        // 尝试从文件名提取歌曲信息
        const songInfo = this.extractSongInfoFromFileName(file.name);
        
        // 填充表单
        const titleInput = document.getElementById('localSongTitle');
        const artistInput = document.getElementById('localArtist');
        
        if (titleInput && songInfo.title) {
            titleInput.value = songInfo.title;
        }
        
        if (artistInput && songInfo.artist) {
            artistInput.value = songInfo.artist;
        }
        
        // 释放之前的URL
        if (this.audioUrl) {
            URL.revokeObjectURL(this.audioUrl);
        }
        
        // 创建音频URL
        this.audioUrl = URL.createObjectURL(file);
        
        // 更新拖放区域外观
        const fileDropzone = document.getElementById('fileDropzone');
        if (fileDropzone) {
            fileDropzone.classList.add('has-file');
            fileDropzone.innerHTML = `
                <i class="bi bi-music-note-beamed"></i>
                <p>已选择音频文件</p>
                <div class="file-name">${file.name}</div>
                <div class="file-type-label">${file.type.split('/')[1].toUpperCase()}</div>
                <div class="file-hint">点击更改</div>
                <input type="file" id="localAudioInput" accept="audio/*" class="file-input" />
            `;
            
            // 添加脉冲动画效果
            fileDropzone.classList.add('pulse');
            setTimeout(() => {
                fileDropzone.classList.remove('pulse');
            }, 2000);
            
            // 重新添加事件监听
            this.setupFileDropzone(fileDropzone);
        }
        
        // 更新导入按钮状态
        const confirmBtn = document.getElementById('confirmLocalImport');
        if (confirmBtn) {
            const titleInput = document.getElementById('localSongTitle');
            const hasTitle = titleInput && titleInput.value.trim() !== '';
            confirmBtn.disabled = !hasTitle;
            if (hasTitle) {
                confirmBtn.classList.add('active');
            }
        }
        
        this.uiManager.showNotification('音频文件已选择', 'success');
    }
    
    /**
     * 处理封面图片选择
     * @param {File} file - 选择的图片文件
     */
    handleCoverSelect(file) {
        if (!file.type.startsWith('image/')) {
            this.uiManager.showNotification('请选择有效的图片文件', 'error');
            return;
        }
        
        this.coverFile = file;
        
        // 释放之前的URL
        if (this.coverUrl) {
            URL.revokeObjectURL(this.coverUrl);
        }
        
        // 创建图片URL并显示预览
        this.coverUrl = URL.createObjectURL(file);
        
        const coverPreview = document.getElementById('coverPreview');
        if (coverPreview) {
            // 清空之前的内容
            coverPreview.innerHTML = '';
            
            // 创建新的图片元素
            const img = document.createElement('img');
            img.src = this.coverUrl;
            img.alt = 'Cover Preview';
            img.onload = () => {
                // 图片加载完成后添加类名触发动画
                coverPreview.classList.add('added');
                setTimeout(() => {
                    coverPreview.classList.remove('added');
                }, 1000);
            };
            
            coverPreview.appendChild(img);
            
            // 添加文件类型标签
            const fileTypeLabel = document.createElement('div');
            fileTypeLabel.className = 'file-type-label';
            fileTypeLabel.textContent = file.type.split('/')[1].toUpperCase();
            coverPreview.appendChild(fileTypeLabel);
            
            // 添加文件名提示
            const fileNameLabel = document.createElement('div');
            fileNameLabel.className = 'file-name';
            fileNameLabel.textContent = file.name;
            coverPreview.appendChild(fileNameLabel);
        }
        
        this.uiManager.showNotification('封面图片已选择', 'success');
    }
    
    /**
     * 处理视频文件选择
     * @param {File} file - 选择的视频文件
     */
    handleVideoSelect(file) {
        if (!file.type.startsWith('video/')) {
            this.uiManager.showNotification('请选择有效的视频文件', 'error');
            return;
        }
        
        this.videoFile = file;
        
        // 释放之前的URL
        if (this.videoUrl) {
            URL.revokeObjectURL(this.videoUrl);
        }
        
        // 创建视频URL
        this.videoUrl = URL.createObjectURL(file);
        
        const videoPreview = document.getElementById('videoPreview');
        if (videoPreview) {
            // 清空之前的内容
            videoPreview.innerHTML = '';
            
            // 创建视频预览元素
            const video = document.createElement('video');
            video.src = this.videoUrl;
            video.preload = 'metadata';
            video.muted = true;
            
            // 视频元数据加载后创建预览缩略图
            video.addEventListener('loadedmetadata', () => {
                // 设置到视频中点位置以获取更有代表性的缩略图
                video.currentTime = Math.min(video.duration / 2, 5); // 最多取5秒位置
            });
            
            // 添加加载指示器
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-spinner';
            videoPreview.appendChild(loadingIndicator);
            
            // 当视频当前帧可用时截取缩略图
            video.addEventListener('seeked', () => {
                // 移除加载指示器
                videoPreview.querySelector('.loading-spinner')?.remove();
                
                // 将视频帧捕获到Canvas
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // 将Canvas转换为图像数据URL
                const thumbnailUrl = canvas.toDataURL('image/jpeg');
                
                // 创建图像元素显示缩略图
                const img = document.createElement('img');
                img.src = thumbnailUrl;
                img.alt = 'Video Thumbnail';
                videoPreview.appendChild(img);
                
                // 添加视频信息标签
                const infoLabel = document.createElement('div');
                infoLabel.className = 'file-type-label';
                const duration = Math.round(video.duration);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                infoLabel.textContent = `${file.type.split('/')[1].toUpperCase()} - ${minutes}:${seconds.toString().padStart(2, '0')}`;
                videoPreview.appendChild(infoLabel);
                
                // 添加文件名
                const fileNameLabel = document.createElement('div');
                fileNameLabel.className = 'file-name';
                fileNameLabel.textContent = file.name;
                videoPreview.appendChild(fileNameLabel);
                
                // 添加类名触发动画
                videoPreview.classList.add('added');
                setTimeout(() => {
                    videoPreview.classList.remove('added');
                }, 1000);
                
                // 从预览中移除视频元素
                video.remove();
            });
            
            // 处理视频加载错误
            video.addEventListener('error', () => {
                // 移除加载指示器
                videoPreview.querySelector('.loading-spinner')?.remove();
                
                // 显示错误消息
                videoPreview.innerHTML = `
                    <div class="error-message">
                        <i class="bi bi-exclamation-triangle"></i>
                        <span>视频预览失败</span>
                    </div>
                    <div class="file-name">${file.name}</div>
                `;
            });
            
            // 添加到预览容器
            videoPreview.appendChild(video);
            
            // 加载视频但不播放
            video.load();
        }
        
        this.uiManager.showNotification('背景视频已选择', 'success');
    }
    
    /**
     * 从文件名提取歌曲信息
     * @param {string} fileName - 文件名
     * @returns {Object} 包含title和artist的对象
     */
    extractSongInfoFromFileName(fileName) {
        // 移除文件扩展名
        let name = fileName.replace(/\.[^/.]+$/, '');
        
        // 常见的分隔符: " - ", "-", "_", "–", "—"
        const separators = [' - ', ' – ', ' — ', '-', '–', '—', '_'];
        let title = name;
        let artist = '';
        
        // 尝试用不同的分隔符分割
        for (const separator of separators) {
            if (name.includes(separator)) {
                const parts = name.split(separator);
                if (parts.length >= 2) {
                    // 智能判断格式
                    // 如果第一部分长度明显大于第二部分，可能是"标题 - 艺术家"格式
                    // 否则默认为"艺术家 - 标题"格式
                    if (parts[0].length > parts[1].length * 2) {
                        title = parts[0].trim();
                        artist = parts.slice(1).join(separator).trim();
                    } else {
                        artist = parts[0].trim();
                        title = parts.slice(1).join(separator).trim();
                    }
                    break;
                }
            }
        }
        
        // 如果分隔符判断失败，尝试按括号分析
        if (!artist && (title.includes('(') || title.includes('（'))) {
            // 可能是"标题 (艺术家)"或"标题（艺术家）"格式
            const matches = title.match(/^(.+?)[\(（](.+?)[\)）]/);
            if (matches && matches.length === 3) {
                title = matches[1].trim();
                artist = matches[2].trim();
            }
        }
        
        return { title, artist };
    }
    
    /**
     * 导入本地歌曲
     */
    async importLocalSong() {
        try {
            // 检查是否有选择音频文件
            if (!this.audioFile) {
                this.uiManager.showNotification('请选择音频文件', 'warning');
                return;
            }
            
            // 获取表单数据
            const titleInput = document.getElementById('localSongTitle');
            const artistInput = document.getElementById('localArtist');
            
            const title = titleInput.value.trim() || this.extractSongInfoFromFileName(this.audioFileName).title || '未命名歌曲';
            const artist = artistInput.value.trim() || this.extractSongInfoFromFileName(this.audioFileName).artist || '未知艺术家';
            
            // 显示导入中状态
            this.uiManager.showNotification('正在导入本地音乐...', 'info');
            const confirmBtn = document.getElementById('confirmLocalImport');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="bi bi-arrow-repeat rotating"></i> 导入中...';
            }
            
            // 准备元数据
            const metadata = {
                title,
                artist,
                audioUrl: this.audioUrl,
                coverUrl: this.coverUrl || '../img/NB_Music.png',
                videoUrl: this.videoUrl || '',
                audioFile: this.audioFile,
                coverFile: this.coverFile,
                videoFile: this.videoFile,
                autoPlay: true  // 导入后自动播放
            };
            
            // 添加到播放列表
            const result = await this.playlistManager.addLocalSong(this.audioFile, metadata);
            
            if (result) {
                // 关闭对话框
                document.getElementById('localImportDialog').classList.add('hide');
                this.uiManager.showNotification('本地音乐导入成功', 'success');
                this.resetForm();
            } else {
                throw new Error('导入失败');
            }
        } catch (error) {
            console.error('导入本地歌曲失败:', error);
            this.uiManager.showNotification('导入失败: ' + error.message, 'error');
            
            // 重置按钮状态
            const confirmBtn = document.getElementById('confirmLocalImport');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '导入';
            }
        }
    }
    
    /**
     * 重置表单
     */
    resetForm() {
        // 重置文件
        this.audioFile = null;
        this.coverFile = null;
        this.videoFile = null;
        this.audioFileName = '';
        
        // 释放对象URL
        if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
        if (this.coverUrl) URL.revokeObjectURL(this.coverUrl);
        if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
        
        this.audioUrl = '';
        this.coverUrl = '';
        this.videoUrl = '';
        
        // 重置按钮状态
        const confirmBtn = document.getElementById('confirmLocalImport');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '导入';
            confirmBtn.classList.remove('active');
        }
        
        // 重置UI
        const fileDropzone = document.getElementById('fileDropzone');
        if (fileDropzone) {
            fileDropzone.classList.remove('has-file', 'pulse');
            fileDropzone.innerHTML = `
                <i class="bi bi-cloud-arrow-up"></i>
                <p>拖放音乐文件到这里<br>或点击选择文件</p>
                <div class="file-hint">支持 MP3, WAV, FLAC 等格式</div>
                <input type="file" id="localAudioInput" accept="audio/*" class="file-input" />
            `;
            
            // 重新添加事件监听
            this.setupFileDropzone(fileDropzone);
        }
        
        const coverPreview = document.getElementById('coverPreview');
        if (coverPreview) {
            coverPreview.innerHTML = `<i class="bi bi-image"></i>`;
        }
        
        const videoPreview = document.getElementById('videoPreview');
        if (videoPreview) {
            videoPreview.innerHTML = `<i class="bi bi-film"></i>`;
        }
        
        // 重置表单输入
        const titleInput = document.getElementById('localSongTitle');
        const artistInput = document.getElementById('localArtist');
        
        if (titleInput) titleInput.value = '';
        if (artistInput) artistInput.value = '';
    }
}

module.exports = LocalImportManager;
