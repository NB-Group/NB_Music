const axios = require('axios');
class MusiclistManager {
    constructor(playlistManager) {
        this.playlistManager = playlistManager;
        this.playlists = [];
        this.activePlaylistIndex = 0;
        this.lyricSearchType = 'auto';
        this.uiManager = null;

        this.musicListContainer = document.querySelector(".content .music-list");
        this.playlistSection = this.musicListContainer.querySelector("#playlistList");
        this.songSection = this.musicListContainer.querySelector("#songList");
        this.newPlaylistBtn = this.musicListContainer.querySelector("#newPlaylist");

        setTimeout(() => {
            this.loadLastPlayedPlaylist();
        }, 0);

        if (this.playlists.length === 0) {
            // 创建默认歌单
            this.playlists.push({
                id: this.generateUUID(),
                name: "默认歌单",
                songs: []
            });
            this.savePlaylists();
        }

        this.init();
    }
    loadLastPlayedPlaylist() {
        if (this.uiManager && typeof this.uiManager.showDefaultUi === 'function') {
            this.uiManager.showDefaultUi();
        }
        // 1. 加载所有歌单数据 
        const savedPlaylists = localStorage.getItem("nbmusic_playlists");
        if (savedPlaylists) {
            this.playlists = JSON.parse(savedPlaylists);

            // 确保每个歌单有播放状态属性
            this.playlists.forEach(playlist => {
                if (playlist.lastPlayedIndex === undefined) {
                    playlist.lastPlayedIndex = 0;
                }
                if (playlist.lastPlayedTime === undefined) {
                    playlist.lastPlayedTime = 0;
                }
            });
        }

        // 如果没有歌单，创建默认空歌单
        if (!this.playlists || this.playlists.length === 0) {
            this.playlists = [{
                id: this.generateUUID(),
                name: "默认歌单",
                songs: [],
                lastPlayedIndex: 0,
                lastPlayedTime: 0
            }];
            this.savePlaylists();

            // 设置初始UI状态
            this.uiManager.showDefaultUi();
            return;
        }

        // 2. 加载上次播放状态
        const lastPlayed = localStorage.getItem("nbmusic_current_playlist");
        if (lastPlayed) {
            const { playlistId } = JSON.parse(lastPlayed);

            // 找到对应的歌单
            const playlistIndex = this.playlists.findIndex(p => p.id === playlistId);
            if (playlistIndex !== -1) {
                // 设置当前播放歌单
                this.activePlaylistIndex = playlistIndex;
                const playlist = this.playlists[playlistIndex];

                // 更新 PlaylistManager 状态
                if (this.playlistManager) {
                    this.playlistManager.playlist = [...playlist.songs];
                    this.playlistManager.playlistName = playlist.name;
                    this.playlistManager.currentPlaylistId = playlist.id;

                    // 设置播放进度
                    if (playlist.songs.length > 0) {
                        // 使用歌单自己保存的上次播放位置
                        this.playlistManager.playingNow = Math.min(
                            playlist.lastPlayedIndex || 0,
                            playlist.songs.length - 1
                        );
                        this.playlistManager.currentTime = playlist.lastPlayedTime || 0;
                    } else {
                        this.playlistManager.playingNow = 0;
                        this.playlistManager.currentTime = 0;
                    }
                }
            }
        }

        // 3. 更新 UI
        this.uiManager.renderPlaylist();

        // 设置播放但不自动播放
        if (this.playlistManager.playlist.length > 0) {
            this.playlistManager.setPlayingNow(this.playlistManager.playingNow, false);
            if (this.playlistManager.audioPlayer && this.playlistManager.currentTime > 0) {
                setTimeout(() => {
                    this.playlistManager.audioPlayer.audio.currentTime = this.playlistManager.currentTime;
                }, 500);
            }
        }

        this.renderPlaylistList();
        this.renderSongList();
    }
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    ensurePlaylistIds() {
        this.playlists.forEach(playlist => {
            if (!playlist.id) {
                playlist.id = this.generateUUID();
            }
        });
        this.savePlaylists();
    }

    init() {
        const lyricSearchTypeSelect = document.getElementById('lyricSearchType');
        lyricSearchTypeSelect.addEventListener('change', (e) => {
            this.lyricSearchType = e.target.value;
        });
        // 点击新建歌单按钮事件
        this.newPlaylistBtn.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "输入歌单名称";
            input.className = "playlist-input";
            input.maxLength = 30; // 限制歌单名称最大长度为30个字符

            input.addEventListener("click", (e) => {
                e.stopPropagation();
            });

            this.newPlaylistBtn.replaceWith(input);
            input.focus();

            const handleNewPlaylist = () => {
                const name = input.value.trim();
                if (name) {
                    // 检查歌单名是否已存在
                    if (this.playlists.some(p => p.name === name)) {
                        alert("歌单名称已存在！");
                        return;
                    }
                    this.playlists.push({
                        id: this.generateUUID(),
                        name: name,
                        songs: []
                    });
                    this.savePlaylists();
                    this.renderPlaylistList();
                }
                input.replaceWith(this.newPlaylistBtn);
            };

            input.addEventListener("blur", handleNewPlaylist);
            input.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    input.blur();
                }
            });
        });

        this.renderPlaylistList();
        this.renderSongList();
        const importBtn = document.getElementById('importPlaylist');
        const importDialog = document.getElementById('importDialog');
        const cancelBtn = document.getElementById('cancelImport');
        const confirmBtn = document.getElementById('confirmImport');
        const favLinkInput = document.getElementById('favLink');
        const linkLabel = document.getElementById('linkLabel');
        const formatExample = document.getElementById('formatExample');

        // 添加获取自定义下拉框值的辅助函数
        const getCustomSelectValue = (selectId) => {
            const customSelect = document.getElementById(selectId);
            if (!customSelect) return null;
            const selectedItem = customSelect.querySelector('.select-item.selected');
            return selectedItem ? selectedItem.getAttribute('data-value') : null;
        };

        // 监听自定义下拉框点击，在事件委托由其他代码处理，这里只处理显示相关内容的更新
        document.addEventListener('click', (e) => {
            // 如果是选择了importType的选项
            if (e.target.classList.contains('select-item') && 
                e.target.closest('#importType')) {
                
                // 更新提示文本基于选中的值
                const importType = e.target.getAttribute('data-value');
                updateImportTypeUI(importType);
            }
        });

        // 更新导入类型提示的函数
        const updateImportTypeUI = (importType) => {
            switch (importType) {
                case 'fav':
                    linkLabel.textContent = '收藏夹链接或ID:';
                    favLinkInput.placeholder = '输入收藏夹链接或ID';
                    formatExample.textContent = '收藏夹ID或链接(fid=xxx)';
                    break;
                case 'season':
                    linkLabel.textContent = '合集链接或ID:';
                    favLinkInput.placeholder = '输入合集链接或ID';
                    formatExample.textContent = '合集链接(space.bilibili.com/xxx/lists/数字)或ID';
                    break;
            }
        };

        // 初始化时设置默认导入类型UI
        setTimeout(() => {
            const initialImportType = getCustomSelectValue('importType') || 'fav';
            updateImportTypeUI(initialImportType);
        }, 100);

        importBtn.addEventListener('click', () => {
            importDialog.classList.remove('hide');
            favLinkInput.focus();
        });

        cancelBtn.addEventListener('click', () => {
            importDialog.classList.add('hide');
            favLinkInput.value = '';
        });

        confirmBtn.addEventListener('click', async () => {
            const input = favLinkInput.value.trim();
            const importType = getCustomSelectValue('importType') || 'fav';
            
            if (!input) {
                this.uiManager.showNotification('请输入链接或ID', 'error');
                return;
            }

            try {
                confirmBtn.disabled = true;
                confirmBtn.textContent = '导入中...';

                let result;
                switch (importType) {
                    case 'fav':
                        result = await this.importFromBiliFav(input);
                        break;
                    case 'season':
                        result = await this.importFromBiliSeason(input);
                        break;
                    default:
                        throw new Error('未知的导入类型');
                }

                if (result.success) {
                    this.uiManager.showNotification(result.message, 'success');
                    importDialog.classList.add('hide');
                    favLinkInput.value = '';
                    this.renderPlaylistList();
                } else {
                    this.uiManager.showNotification(result.message, 'error');
                }
            } catch (error) {
                this.uiManager.showNotification('导入失败: ' + error.message, 'error');
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = '导入';
            }
        });

        // 按ESC关闭对话框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !importDialog.classList.contains('hide')) {
                importDialog.classList.add('hide');
                favLinkInput.value = '';
            }
        });
    }

    savePlaylists() {
        try {
            if (this.playlists.length === 1 && this.playlists[0].name === "默认歌单" && this.playlists[0].songs.length === 0) {
                return;
            }
            
            // 触发UI更新
            if (this.uiManager) {
                this.uiManager.renderPlaylist();
            }

            // 在保存前更新当前活跃歌单的播放位置
            if (this.activePlaylistIndex >= 0 && this.activePlaylistIndex < this.playlists.length) {
                const activePlaylist = this.playlists[this.activePlaylistIndex];
                if (activePlaylist && this.playlistManager) {
                    activePlaylist.lastPlayedIndex = this.playlistManager.playingNow;
                    activePlaylist.lastPlayedTime = this.playlistManager.audioPlayer?.audio?.currentTime || 0;
                }
            }

            localStorage.setItem("nbmusic_playlists", JSON.stringify(this.playlists));

            // 保存当前播放的歌单ID和歌曲索引
            localStorage.setItem("nbmusic_current_playlist", JSON.stringify({
                playlistId: this.playlistManager.currentPlaylistId,
                songIndex: this.playlistManager.playingNow,
                currentTime: this.playlistManager.audioPlayer?.audio?.currentTime || 0
            }));
        } catch (error) {
            this.uiManager.showNotification("保存歌单失败: " + error.message, "error");
        }
    }
    renderPlaylistList() {
        if (!this.playlistSection) return;
        this.playlistSection.innerHTML = "";

        this.playlists.forEach((playlist, index) => {
            const li = document.createElement("li");
            li.dataset.id = playlist.id;

            // 创建歌单名称容器
            const nameSpan = document.createElement("span");
            nameSpan.textContent = playlist.name;
            nameSpan.classList.add("playlist-name");
            nameSpan.title = playlist.name; // 添加title属性，鼠标悬停时显示完整名称
            li.appendChild(nameSpan);

            if (index === this.activePlaylistIndex) {
                li.classList.add("active");
            }

            // 创建按钮容器
            const buttonContainer = document.createElement("div");
            buttonContainer.classList.add("playlist-buttons");
            buttonContainer.style.flexShrink = "0"; // 防止按钮被压缩

            // 重命名按钮
            const renameBtn = document.createElement("i");
            renameBtn.classList.add("bi", "bi-pencil-square");
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                this.renamePlaylist(playlist.id);
            };

            // 删除按钮
            const deleteBtn = document.createElement("i");
            deleteBtn.classList.add("bi", "bi-trash");
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deletePlaylist(playlist.id);
            };

            buttonContainer.appendChild(renameBtn);
            buttonContainer.appendChild(deleteBtn);
            li.appendChild(buttonContainer);

            li.addEventListener("click", () => {
                // 保存当前歌单播放状态
                if (this.activePlaylistIndex >= 0 && this.activePlaylistIndex < this.playlists.length) {
                    const currentPlaylist = this.playlists[this.activePlaylistIndex];
                    if (currentPlaylist && this.playlistManager) {
                        currentPlaylist.lastPlayedIndex = this.playlistManager.playingNow;
                        currentPlaylist.lastPlayedTime = this.playlistManager.audioPlayer?.audio?.currentTime || 0;
                    }
                }

                // 切换到新歌单
                this.activePlaylistIndex = index;
                const targetPlaylist = this.playlists[index];


                // 更新播放器状态
                this.playlistManager.playlistName = targetPlaylist.name;
                this.playlistManager.playlist = [...targetPlaylist.songs];
                this.playlistManager.currentPlaylistId = targetPlaylist.id;

                // 恢复目标歌单的播放位置
                const songIndex = Math.min(
                    targetPlaylist.lastPlayedIndex || 0,
                    targetPlaylist.songs.length - 1
                );

                // 先保存歌单状态
                this.playlistManager.savePlaylists();

                // 先更新UI
                this.playlistManager.uiManager.renderPlaylist();
                this.renderPlaylistList();
                this.renderSongList();

                // 空歌单
                if (targetPlaylist.songs.length === 0) {
                    this.uiManager.showDefaultUi();
                    return;
                }
                // 然后恢复播放状态
                if (targetPlaylist.songs.length > 0) {
                    const shouldPlay = !this.playlistManager.audioPlayer.audio.paused;
                    this.playlistManager.setPlayingNow(songIndex, false);

                    // 恢复播放进度
                    if (targetPlaylist.lastPlayedTime > 0) {
                        setTimeout(() => {
                            this.playlistManager.audioPlayer.audio.currentTime = targetPlaylist.lastPlayedTime;

                            // 如果当前正在播放，则自动播放新歌单
                            if (shouldPlay) {
                                this.playlistManager.audioPlayer.audio.play()
                                    .catch(err => console.warn('自动播放失败:', err));
                            }
                        }, 500);
                    } else if (shouldPlay) {
                        // 如果当前正在播放，且没有进度，直接播放
                        setTimeout(() => {
                            this.playlistManager.audioPlayer.audio.play()
                                .catch(err => console.warn('自动播放失败:', err));
                        }, 500);
                    }
                }
            });

            this.playlistSection.appendChild(li);
        });
    }

    renderSongList() {
        if (!this.songSection) return;
        this.songSection.innerHTML = "";

        const activePlaylist = this.playlists[this.activePlaylistIndex];
        if (!activePlaylist) return;

        activePlaylist.songs.forEach((song, idx) => {
            const li = document.createElement("li");

            // 创建歌曲信息容器
            const songInfo = document.createElement("div");
            songInfo.classList.add("song-info");

            // 添加封面
            const cover = document.createElement("img");
            cover.src = song.poster;
            cover.alt = "歌曲封面";
            cover.classList.add("song-cover");

            // 添加标题
            const title = document.createElement("span");
            title.textContent = song.title || "未知歌曲";
            title.classList.add("song-title");

            // 组装歌曲信息
            songInfo.appendChild(cover);
            songInfo.appendChild(title);
            li.appendChild(songInfo);

            li.addEventListener("click", () => {
                this.playlistManager.playlistName = activePlaylist.name;
                this.playlistManager.playlist = [...activePlaylist.songs];
                this.playlistManager.setPlayingNow(idx);
                document.querySelector(".player").click();
            });

            // 添加编辑按钮
            const editBtn = document.createElement("i");
            editBtn.classList.add("bi", "bi-pencil-square");
            editBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const originalTitle = title.textContent;
                
                // 创建输入框
                const input = document.createElement('input');
                input.type = 'text';
                input.value = originalTitle;
                input.className = 'song-input';
                input.style.width = '100%';
                input.maxLength = 100;
                input.addEventListener("click", (e) => e.stopPropagation());
                
                // 替换原来的标题
                title.replaceWith(input);
                input.focus();
                
                const handleRename = () => {
                    const newTitle = input.value.trim();
                    if (newTitle && newTitle !== originalTitle) {
                        song.title = newTitle;
                        this.savePlaylists();
                        this.renderSongList();
                    } else {
                        input.replaceWith(title);
                    }
                };
                
                input.addEventListener('blur', handleRename);
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    } else if (e.key === 'Escape') {
                        input.replaceWith(title);
                    }
                });
            });
            
            // 添加删除按钮
            const delBtn = document.createElement("i");
            delBtn.classList.add("bi", "bi-trash");
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                activePlaylist.songs.splice(idx, 1);

                if (this.playlistManager.playlistName === activePlaylist.name) {
                    this.playlistManager.playlist = [...activePlaylist.songs];
                }
                this.savePlaylists();
                this.renderSongList();
                this.playlistManager.uiManager.renderPlaylist();
            });

            // 创建按钮容器
            const btnContainer = document.createElement('div');
            btnContainer.classList.add('song-buttons');
            btnContainer.appendChild(editBtn);
            btnContainer.appendChild(delBtn);
            li.appendChild(btnContainer);
            this.songSection.appendChild(li);
        });
    }

    renamePlaylist(playlistId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) return;

        const playlistItem = document.querySelector(`li[data-id="${playlistId}"]`);
        const nameSpan = playlistItem.querySelector('.playlist-name');
        const originalName = nameSpan.textContent;

        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.className = 'playlist-input';
        input.style.width = 'calc(100% - 60px)';
        input.maxLength = 30; // 限制重命名时的最大长度
        input.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        // 替换原来的名称
        nameSpan.replaceWith(input);
        input.focus();

        const handleRename = () => {
            const newName = input.value.trim();
            if (newName && newName !== originalName) {
                if (this.playlists.some(p => p.id !== playlistId && p.name === newName)) {
                    alert("歌单名称已存在！");
                    input.replaceWith(nameSpan);
                    return;
                }
                playlist.name = newName;
                if (this.playlistManager.playlistName === originalName) {
                    this.playlistManager.playlistName = newName;
                }
                this.savePlaylists();
                this.renderPlaylistList();
                // 更新侧边栏显示
                if (this.uiManager) {
                    this.uiManager.updateSidebarPlaylistName(playlistId, newName);
                }
            } else {
                input.replaceWith(nameSpan);
            }
        };

        input.addEventListener('blur', handleRename);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.replaceWith(nameSpan);
            }
        });
    }
    
    editSongArtist(songId) {
        const activePlaylist = this.playlists[this.activePlaylistIndex];
        if (!activePlaylist) return;
        
        const song = activePlaylist.songs.find(s => s.id === songId);
        if (!song) return;
        
        const songItem = document.querySelector(`li[data-id="${songId}"]`);
        const artistSpan = songItem.querySelector('.song-artist');
        const originalArtist = artistSpan.textContent;
        
        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalArtist;
        input.className = 'song-input';
        input.maxLength = 50;
        input.addEventListener("click", (e) => {
            e.stopPropagation();
        });
        
        // 替换原来的作者
        artistSpan.replaceWith(input);
        input.focus();
        
        const handleEditArtist = () => {
            const newArtist = input.value.trim();
            if (newArtist && newArtist !== originalArtist) {
                song.artist = newArtist;
                this.savePlaylists();
                this.renderSongList();
                // 更新播放器显示
                if (this.playlistManager) {
                    this.playlistManager.updateCurrentSongInfo();
                }
                // 更新侧边栏显示
                if (this.uiManager) {
                    this.uiManager.updateSidebarSongInfo(songId, {artist: newArtist});
                }
            } else {
                input.replaceWith(artistSpan);
            }
        };
        
        input.addEventListener('blur', handleEditArtist);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.replaceWith(artistSpan);
            }
        });
    }

    deletePlaylist(playlistId) {
        const index = this.playlists.findIndex(p => p.id === playlistId);
        if (index === -1) return;

        const deleteBtn = document.querySelector(`li[data-id="${playlistId}"] .bi-trash`);

        // 如果已经是确认状态
        if (deleteBtn.classList.contains('confirm-delete')) {
            // 如果删除的是当前播放的歌单
            if (index === this.activePlaylistIndex) {
                // 保存当前播放状态到歌单
                const activePlaylist = this.playlists[index];
                if (this.playlistManager) {
                    activePlaylist.lastPlayedIndex = this.playlistManager.playingNow;
                    activePlaylist.lastPlayedTime = this.playlistManager.audioPlayer?.audio?.currentTime || 0;
                }

                // 获取前一个歌单或后一个歌单的索引
                let newIndex;
                if (index > 0) {
                    newIndex = index - 1;
                } else if (this.playlists.length > 1) {
                    newIndex = 1;
                }

                // 删除歌单
                this.playlists.splice(index, 1);

                // 如果没有其他歌单了
                if (this.playlists.length === 0) {
                    // 创建默认歌单
                    const defaultPlaylist = {
                        id: this.generateUUID(),
                        name: "默认歌单",
                        songs: []
                    };
                    this.playlists.push(defaultPlaylist);
                    this.activePlaylistIndex = 0;
                    this.playlistManager.playlistName = defaultPlaylist.name;
                    this.playlistManager.playlist = [];
                    this.playlistManager.currentPlaylistId = defaultPlaylist.id;

                    // 重置UI
                    this.playlistManager.uiManager.showDefaultUi();
                } else {
                    // 切换到新的歌单
                    this.activePlaylistIndex = newIndex;
                    const newPlaylist = this.playlists[newIndex];
                    this.playlistManager.playlistName = newPlaylist.name;
                    this.playlistManager.playlist = [...newPlaylist.songs];
                    this.playlistManager.currentPlaylistId = newPlaylist.id;

                    // 自动点击新的歌单
                    const newPlaylistElement = document.querySelector(`li[data-id="${newPlaylist.id}"]`);
                    if (newPlaylistElement) {
                        newPlaylistElement.click();
                    }
                }
            } else {
                // 如果删除的不是当前播放的歌单
                this.playlists.splice(index, 1);
                if (index < this.activePlaylistIndex) {
                    this.activePlaylistIndex--;
                }
            }

            this.savePlaylists();
            this.renderPlaylistList();
            this.renderSongList();
            return;
        }

        // 第一次点击,显示确认状态
        deleteBtn.classList.add('confirm-delete');
        deleteBtn.style.color = 'red';

        const confirmText = document.createElement('span');
        confirmText.textContent = '再次点击确认删除';
        confirmText.style.cssText = `
            color: red;
            position: relative;
            top: 0.25em;
            font-size: 12px;
            margin-left: 5px;
        `;
        deleteBtn.parentNode.appendChild(confirmText);

        // 3秒后恢复原状
        setTimeout(() => {
            deleteBtn.classList.remove('confirm-delete');
            deleteBtn.style.color = '';
            if (confirmText.parentNode) {
                confirmText.remove();
            }
        }, 3000);
    }

    handlePlaylistUpdate() {
        const activePlaylist = this.playlists[this.activePlaylistIndex];
        if (activePlaylist && activePlaylist.name === this.playlistManager.playlistName) {
            // 深拷贝当前播放列表的歌曲到激活的歌单
            activePlaylist.songs = JSON.parse(JSON.stringify(this.playlistManager.playlist));
            // 保存更新后的歌单
            this.savePlaylists();
            
            // 触发UI更新
            if (this.uiManager) {
                this.uiManager.renderPlaylist();
            }
        }

        this.renderPlaylistList();
        this.renderSongList();
        this.playlistManager.shuffledlist = [];
    }
    async importFromBiliFav(mediaId) {
        let importNotification = null;
        let lyricsNotification = null;

        try {
            // 解析收藏夹ID
            let favId = mediaId;
            if (!/^\d+$/.test(mediaId)) {
                // 解析链接中的ID
                const match = mediaId.match(/fid=(\d+)/);
                if (!match) {
                    throw new Error('无法解析收藏夹ID，请确认输入格式正确');
                }
                favId = match[1];
            }

            // 1. 获取收藏夹信息
            const favResponse = await axios.get(`https://api.bilibili.com/x/v3/fav/folder/info?media_id=${favId}`);
            if (favResponse.data.code !== 0) {
                throw new Error('获取收藏夹信息失败');
            }

            const favInfo = favResponse.data.data;
            const totalCount = favInfo.media_count;
            const pageSize = 20;
            const totalPages = Math.ceil(totalCount / pageSize);

            // 创建新歌单
            const playlistTitle = `${favInfo.title}`;
            const playlistIndex = this.playlists.length;
            this.playlists.push({
                id: this.generateUUID(),
                name: playlistTitle,
                songs: []
            });

            // 2. 收集所有要添加的歌曲信息
            const songsToAdd = [];
            let processedCount = 0;

            // 显示导入进度通知
            importNotification = this.uiManager.showNotification(
                `正在导入歌单: 0/${totalCount}`,
                'info',
                { showProgress: true, progress: 0 }
            );

            // 3. 逐页获取视频信息
            for (let page = 1; page <= totalPages; page++) {
                const resourcesResponse = await axios.get(
                    `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${favId}&pn=${page}&ps=${pageSize}&platform=web`
                );

                if (resourcesResponse.data.code !== 0) continue;

                const medias = resourcesResponse.data.data.medias;
                if (!medias) continue;

                // 处理每个视频
                for (const media of medias) {
                    if (media.attr === 1) continue; // 跳过失效视频

                    try {
                        const cidResponse = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${media.bvid}`);
                        if (cidResponse.data.code === 0) {
                            songsToAdd.push({
                                title: media.title,
                                artist: media.upper.name,
                                bvid: media.bvid,
                                cid: cidResponse.data.data.cid,
                                duration: media.duration,
                                poster: media.cover,
                                audio: null
                            });

                            // 更新导入进度
                            processedCount++;
                            const progress = (processedCount / totalCount) * 100;

                            // 更新进度条和文本
                            importNotification.querySelector('.notification-message').textContent =
                                `正在导入歌单: ${processedCount}/${totalCount}`;
                            importNotification.querySelector('.notification-progress-inner').style.width =
                                `${progress}%`;
                        }
                    } catch (error) {
                        console.warn(`获取视频 ${media.bvid} 的CID失败:`, error);
                        continue;
                    }
                }
            }

            // 导入完成后移除通知
            importNotification.remove();

            // 4. 获取歌词
            const songsWithLyrics = await this.processSongsLyrics(songsToAdd);

            // 5. 更新歌单
            this.playlists[playlistIndex].songs = songsWithLyrics;
            this.handlePlaylistUpdate();
            this.savePlaylists();

            // 6. 显示完成消息
            return {
                success: true,
                message: `成功导入 ${songsWithLyrics.length} 首歌曲到歌单"${playlistTitle}"`
            };

        } catch (error) {
            // 发生错误时移除进度通知
            importNotification?.remove();
            lyricsNotification?.remove();

            // 显示错误消息
            console.error('从B站收藏夹导入失败:', error);
            return {
                success: false,
                message: '导入失败: ' + error.message
            };
        }
    }
    async showLyricSearchDialog(song) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('lyricSearchDialog');
            const titleDiv = document.getElementById('currentSongTitle');
            const keywordInput = document.getElementById('lyricKeyword');
            const skipBtn = document.getElementById('skipLyric');
            const confirmBtn = document.getElementById('confirmLyric');

            // 显示当前歌曲信息
            titleDiv.textContent = song.title;
            keywordInput.value = song.title;
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
                        const lyric = await this.musicSearcher.getLyrics(keyword);
                        resolve(lyric);
                    } catch (error) {
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

            const cleanup = () => {
                dialog.classList.add('hide');
                skipBtn.removeEventListener('click', handleSkip);
                confirmBtn.removeEventListener('click', handleConfirm);
                keywordInput.removeEventListener('keydown', handleKeydown);
            };

            skipBtn.addEventListener('click', handleSkip);
            confirmBtn.addEventListener('click', handleConfirm);
            keywordInput.addEventListener('keydown', handleKeydown);

            // 聚焦输入框
            keywordInput.focus();
            keywordInput.select();
        });
    }

    parseInputId(input, type) {
        // 根据不同类型解析ID
        switch (type) {
            case 'fav':
                if (/^\d+$/.test(input)) {
                    return input; // 直接输入的ID
                } else {
                    // 解析链接中的ID
                    const match = input.match(/fid=(\d+)/);
                    if (match) return match[1];
                }
                break;
            case 'season':
                if (/^\d+$/.test(input)) {
                    return input; // 直接输入的ID
                } else {
                    // 解析合集链接格式：https://space.bilibili.com/1060544882/lists/1049571?type=season
                    const match = input.match(/\/lists\/(\d+)/) || 
                                  input.match(/sid=(\d+)/) || 
                                  input.match(/season_id=(\d+)/);
                    if (match) return match[1];
                }
                break;
        }
        
        return null; // 无法解析
    }

    async importFromBiliSeason(input) {
        let importNotification = null;
        let lyricsNotification = null;

        try {
            // 解析合集ID
            const seasonId = this.parseInputId(input, 'season');
            if (!seasonId) {
                throw new Error('无法解析合集ID，请确认输入格式正确');
            }

            // 1. 获取合集信息，需要mid参数，先尝试获取
            const testResponse = await axios.get(`https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?season_id=${seasonId}&page_num=1&page_size=1`);
            if (testResponse.data.code !== 0) {
                throw new Error('获取合集信息失败: ' + testResponse.data.message);
            }

            const mid = testResponse.data.data.meta.mid;
            const seasonInfo = testResponse.data.data.meta;

            // 2. 使用mid获取完整合集信息
            const seasonResponse = await axios.get(
                `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${mid}&season_id=${seasonId}&page_num=1&page_size=100`
            );

            if (seasonResponse.data.code !== 0) {
                throw new Error('获取合集视频失败: ' + seasonResponse.data.message);
            }

            const videos = seasonResponse.data.data.archives;
            const totalCount = videos.length;

            if (totalCount === 0) {
                throw new Error('该合集中没有视频');
            }

            // 创建新歌单
            const playlistTitle = `${seasonInfo.name}`;
            const playlistIndex = this.playlists.length;
            this.playlists.push({
                id: this.generateUUID(),
                name: playlistTitle,
                songs: []
            });

            // 收集所有要添加的歌曲信息
            const songsToAdd = [];
            let processedCount = 0;

            // 显示导入进度通知
            importNotification = this.uiManager.showNotification(
                `正在导入歌单: 0/${totalCount}`,
                'info',
                { showProgress: true, progress: 0 }
            );

            // 处理每个视频
            for (const video of videos) {
                try {
                    // 检查video对象中是否包含有效的cid
                    // 如果没有cid或cid为无效值，则获取视频详情
                    let cid = video.cid;
                    
                    // 如果cid不存在或无效
                    if (!cid) {
                        try {
                            const videoDetailResponse = await axios.get(
                                `https://api.bilibili.com/x/web-interface/view?bvid=${video.bvid}`
                            );
                            
                            if (videoDetailResponse.data.code === 0) {
                                cid = videoDetailResponse.data.data.cid;
                            }
                            
                            // 如果获取失败，记录警告但继续处理
                            if (!cid) {
                                console.warn(`无法获取视频 ${video.bvid} 的CID，可能会影响播放`);
                            }
                        } catch (error) {
                            console.warn(`获取视频 ${video.bvid} 详情失败:`, error);
                        }
                    }
                    
                    songsToAdd.push({
                        title: video.title,
                        artist: video.author || seasonInfo.name || "未知UP主",
                        bvid: video.bvid,
                        cid: cid, // 确保使用获取到的cid
                        duration: video.duration,
                        poster: video.pic,
                        audio: null
                    });

                    // 更新导入进度
                    processedCount++;
                    const progress = (processedCount / totalCount) * 100;

                    // 更新进度条和文本
                    importNotification.querySelector('.notification-message').textContent =
                        `正在导入歌单: ${processedCount}/${totalCount}`;
                    importNotification.querySelector('.notification-progress-inner').style.width =
                        `${progress}%`;
                } catch (error) {
                    console.warn(`处理视频 ${video.bvid} 失败:`, error);
                    continue;
                }

                // 加入适当的延迟，避免请求过于频繁
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // 导入完成后移除通知
            importNotification.remove();

            // 获取歌词
            const songsWithLyrics = await this.processSongsLyrics(songsToAdd);

            // 更新歌单
            this.playlists[playlistIndex].songs = songsWithLyrics;
            this.handlePlaylistUpdate();
            this.savePlaylists();

            // 显示完成消息
            return {
                success: true,
                message: `成功导入 ${songsWithLyrics.length} 首歌曲到歌单"${playlistTitle}"`
            };

        } catch (error) {
            // 发生错误时移除进度通知
            importNotification?.remove();
            lyricsNotification?.remove();

            console.error('从B站合集导入失败:', error);
            return {
                success: false,
                message: '导入失败: ' + error.message
            };
        }
    }

    async processSongsLyrics(songsToAdd) {
        const lyricsNotification = this.uiManager.showNotification(
            `正在获取歌词: 0/${songsToAdd.length}`,
            'info',
            { showProgress: true, progress: 0 }
        );

        let lyricsCount = 0;
        const songsWithLyrics = [];
        
        for (const song of songsToAdd) {
            try {
                let lyric;
                if (this.lyricSearchType === 'custom') {
                    lyric = await this.showLyricSearchDialog(song);
                } else {
                    lyric = await this.musicSearcher.getLyrics(song.title);
                }

                songsWithLyrics.push({
                    ...song,
                    lyric: lyric || "暂无歌词，尽情欣赏音乐"
                });

                // 更新歌词获取进度
                lyricsCount++;
                const progress = (lyricsCount / songsToAdd.length) * 100;

                // 更新进度条和文本
                lyricsNotification.querySelector('.notification-message').textContent =
                    `正在获取歌词: ${lyricsCount}/${songsToAdd.length}`;
                lyricsNotification.querySelector('.notification-progress-inner').style.width =
                    `${progress}%`;
            } catch (error) {
                console.warn(`获取歌词失败: ${song.title}`, error);
                songsWithLyrics.push({
                    ...song,
                    lyric: "暂无歌词，尽情欣赏音乐"
                });
                
                // 仍然更新进度
                lyricsCount++;
                const progress = (lyricsCount / songsToAdd.length) * 100;
                lyricsNotification.querySelector('.notification-message').textContent =
                    `正在获取歌词: ${lyricsCount}/${songsToAdd.length}`;
                lyricsNotification.querySelector('.notification-progress-inner').style.width =
                    `${progress}%`;
            }
        }

        // 歌词获取完成后移除通知
        lyricsNotification.remove();
        
        return songsWithLyrics;
    }
}

module.exports = MusiclistManager;