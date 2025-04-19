const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { ipcRenderer } = require("electron");
class MusiclistManager {
    /**
     * 歌单管理组件
     * @param {import("./PlaylistManager.js")} playlistManager
     * @param {import("./MusicSearcher.js")} musicSearcher
     * @param {import("./CacheManager.js")} cacheManager
     * @param {import("./LoginManager.js")} loginManager
     */
    constructor(playlistManager, musicSearcher, cacheManager, loginManager) {
        this.isUpdating = false;
        this.playlistManager = playlistManager;
        this.musicSearcher = musicSearcher;
        this.cacheManager = cacheManager;
        this.playlists = [];
        this.activePlaylistIndex = 0;
        this.lyricSearchType = "auto";
        /**
         * @type {import("./LoginManager.js")}
         */
        this.uiManager = null;
        this.loginManager = loginManager;

        this.musicListContainer = document.querySelector(".content .music-list");
        this.playlistSection = this.musicListContainer.querySelector("#playlistList");
        this.songSection = this.musicListContainer.querySelector("#songList");
        this.newPlaylistBtn = this.musicListContainer.querySelector("#newPlaylist");
        this.favGroup = document.getElementById("favGroup");
        this.favLinkInputGroup = document.getElementById("favLinkGroup");

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
    async downloadPlaylist(songs, name) {
        let i = 0;
        let importNotification = this.uiManager.showNotification(`正在下载歌曲: 0/${songs.length}`, "info", { showProgress: true, progress: 0 });
        await songs.forEach(async (item) => {
            const link = await this.musicSearcher.getAudioLink(item.bvid);
            link.pop();
            console.log(link);
            const downloadPath = await ipcRenderer.invoke("get-download-path");
            const data = { folder: path.join(downloadPath, "NB-Music", name), link: link, name: item.title, bvid: item.bvid };
            if (!fs.existsSync(path.join(downloadPath, "NB-Music"))) {
                fs.mkdirSync(path.join(downloadPath, "NB-Music"));
            }
            if (!fs.existsSync(data.folder)) {
                fs.mkdirSync(data.folder);
            }
            try {
                let response = await axios({
                    url: data.link[0],
                    method: "GET",
                    responseType: "arraybuffer"
                });
                const buffer = Buffer.from(response.data); // 进行转换
                await fs.promises.writeFile(path.join(data.folder, data.name.replace(/[<>:"/\\|?*]+/g, "_") + ".m4s"), buffer);
            } catch {
                let response = await axios({
                    url: data.link[1][0],
                    method: "GET",
                    responseType: "arraybuffer"
                });
                const buffer = Buffer.from(response.data); // 进行转换
                await fs.promises.writeFile(path.join(data.folder, data.name.replace(/[<>:"/\\|?*]+/g, "_") + ".m4s"), buffer);
            } finally {
                importNotification.querySelector(".notification-message").textContent = `正在下载音乐: ${++i}/${songs.length}`;
                importNotification.querySelector(".notification-progress-inner").style.width = `${(i / songs.length) * 100}%`;
                if (i == songs.length) {
                    window.setTimeout(() => {
                        importNotification.remove();
                        this.uiManager.showNotification(`成功从${name}下载 ${songs.length} 首歌曲！`, "success");
                    }, 1000);
                }
            }
        });
    }
    loadLastPlayedPlaylist() {
        if (this.uiManager && typeof this.uiManager.showDefaultUi === "function") {
            this.uiManager.showDefaultUi();
        }
        // 1. 加载所有歌单数据
        const savedPlaylists = localStorage.getItem("nbmusic_playlists");
        if (savedPlaylists) {
            this.playlists = JSON.parse(savedPlaylists);

            // 确保每个歌单有播放状态属性
            this.playlists.forEach((playlist) => {
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
            this.playlists = [
                {
                    id: this.generateUUID(),
                    name: "默认歌单",
                    songs: [],
                    lastPlayedIndex: 0,
                    lastPlayedTime: 0
                }
            ];
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
            const playlistIndex = this.playlists.findIndex((p) => p.id === playlistId);
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
                        this.playlistManager.playingNow = Math.min(playlist.lastPlayedIndex || 0, playlist.songs.length - 1);
                        this.playlistManager.currentTime = playlist.lastPlayedTime || 0;
                    } else {
                        this.playlistManager.playingNow = 0;
                        this.playlistManager.currentTime = 0;
                    }
                }
            }
        }

        // 3. 更新 UI
        if (this.uiManager) {
            this.uiManager.renderPlaylist();
        }

        // 设置播放但不自动播放
        if (this.playlistManager.playlist.length > 0) {
            // 检查是否启用了自动播放
            const autoPlay = this.playlistManager.settingManager && this.playlistManager.settingManager.getSetting("autoPlayOnStartup") === "true";

            // 传递autoPlay参数，控制是否自动播放
            this.playlistManager.setPlayingNow(this.playlistManager.playingNow, false, autoPlay);

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
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    ensurePlaylistIds() {
        this.playlists.forEach((playlist) => {
            if (!playlist.id) {
                playlist.id = this.generateUUID();
            }
        });
        this.savePlaylists();
    }

    init() {
        const lyricSearchTypeSelect = document.getElementById("lyricSearchType");
        lyricSearchTypeSelect.addEventListener("change", (e) => {
            this.lyricSearchType = e.target.value;
        });
        document.getElementById('autoUpdateBtn').addEventListener('click', () => {
            this.updateBiliFav(this.activePlaylistIndex);
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
                    if (this.playlists.some((p) => p.name === name)) {
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
        const importBtn = document.getElementById("importPlaylist");
        const importDialog = document.getElementById("importDialog");
        const cancelBtn = document.getElementById("cancelImport");
        const confirmBtn = document.getElementById("confirmImport");
        const favLabel = document.getElementById("favLabel");
        const favLinkLabel = document.getElementById("favLinkLabel");
        const favLinkInput = document.getElementById("favLinkInput");
        const formatExample = document.getElementById("formatExample");

        // 添加获取自定义下拉框值的辅助函数
        const getCustomSelectValue = (selectId) => {
            const customSelect = document.getElementById(selectId);
            if (!customSelect) return null;
            const selectedItem = customSelect.querySelector(".select-item.selected");
            return selectedItem ? selectedItem.getAttribute("data-value") : null;
        };

        const loadFav = (type) => {
            const favSelect = document.createElement("select");
            favSelect.id = "favSelect";

            const option = document.createElement("option");

            option.value = "inputLink";

            let url = "https://api.bilibili.com/x/v3/fav/folder";

            if (type === "season") {
                url += "/collected/list?pn=1&ps=50&platform=web&up_mid=";
                option.textContent = "手动输入合集链接";
            } else {
                url += "/created/list-all?up_mid=";
                option.textContent = "手动输入收藏夹链接";
            }

            favSelect.appendChild(option);

            if (this.loginManager.isLogin) {
                axios
                    .get(url + this.loginManager.userMid)
                    .then((response) => {
                        const data = response.data;

                        if (data.code === 0) {
                            data.data.list.forEach((item) => {
                                const option = document.createElement("option");

                                option.value = item.id;
                                option.textContent = item.title;
                                favSelect.appendChild(option);
                            });

                            this.favGroup.appendChild(favSelect);
                            this.uiManager.initializeCustomSelects();
                        } else {
                            console.error(data.message);
                            this.uiManager.showNotification("获取用户合集失败：" + data.message, "error");
                        }
                    })
                    .catch((error) => {
                        console.error(error);
                        this.uiManager.showNotification("获取用户收藏夹失败：" + error.message, "error");
                    });
            } else {
                this.favGroup.appendChild(favSelect);
                this.uiManager.initializeCustomSelects();
            }
        };

        // 监听自定义下拉框点击，在事件委托由其他代码处理，这里只处理显示相关内容的更新
        document.addEventListener("click", (e) => {
            if (e.target.classList.contains("select-item")) {
                // 如果是选择了importType的选项
                if (e.target.closest("#importType")) {
                    // 更新提示文本基于选中的值
                    const importType = e.target.getAttribute("data-value");

                    updateImportTypeUI(importType);
                    this.cleanFavGroup();
                    loadFav(importType);
                } else if (e.target.closest("#favSelect")) {
                    if (getCustomSelectValue("favSelect") === "inputLink") {
                        this.favLinkInputGroup.classList.remove("hide");
                    } else {
                        this.favLinkInputGroup.classList.add("hide");
                    }
                }
            }
        });

        // 更新导入类型提示的函数
        const updateImportTypeUI = (importType) => {
            switch (importType) {
                case "fav":
                    favLabel.textContent = "选择一个收藏夹";
                    favLinkLabel.textContent = "收藏夹链接或ID:";
                    favLinkInput.placeholder = "输入收藏夹链接或ID";
                    formatExample.textContent = "收藏夹ID或链接(fid=xxx)";
                    break;
                case "season":
                    favLabel.textContent = "选择一个合集";
                    favLinkLabel.textContent = "合集链接或ID:";
                    favLinkInput.placeholder = "输入合集链接或ID";
                    formatExample.textContent = "合集链接(space.bilibili.com/xxx/lists/数字)或ID";
                    break;
            }
        };

        // 初始化时设置默认导入类型UI
        setTimeout(() => {
            const initialImportType = getCustomSelectValue("importType") || "fav";
            updateImportTypeUI(initialImportType);
        }, 100);

        importBtn.addEventListener("click", () => {
            loadFav(getCustomSelectValue("importType"));

            importDialog.classList.remove("hide");
        });

        cancelBtn.addEventListener("click", () => {
            importDialog.classList.add("hide");
            this.cleanFavGroup();
            favLinkInput.value = "";
        });

        confirmBtn.addEventListener("click", async () => {
            let input = getCustomSelectValue("favSelect");
            const importType = getCustomSelectValue("importType") || "fav";

            if (input === "inputLink") {
                input = favLinkInput.value.trim();
            }

            if (!input) {
                this.uiManager.showNotification("请输入链接或ID", "error");
                return;
            }

            try {
                confirmBtn.disabled = true;
                confirmBtn.textContent = "导入中...";

                let result;
                switch (importType) {
                    case "fav":
                        result = await this.importFromBiliFav(input);
                        break;
                    case "season":
                        result = await this.importFromBiliSeason(input);
                        break;
                    default:
                        throw new Error("未知的导入类型");
                }

                if (result.success) {
                    this.uiManager.showNotification(result.message, "success");
                    importDialog.classList.add("hide");
                    this.cleanFavGroup();
                    favLinkInput.value = "";
                    this.renderPlaylistList();
                } else {
                    this.uiManager.showNotification(result.message, "error");
                }
            } catch (error) {
                this.uiManager.showNotification("导入失败: " + error.message, "error");
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = "导入";
            }
        });

        // 按ESC关闭对话框
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !importDialog.classList.contains("hide")) {
                importDialog.classList.add("hide");
                this.cleanFavGroup();
                favLinkInput.value = "";
            }
        });
    }

    cleanFavGroup() {
        Array.from(this.favGroup.children).forEach((child) => {
            if (child.id === "favSelect") {
                child.remove();
            }
        });

        this.favLinkInputGroup.classList.remove("hide");
    }

    savePlaylists() {
        try {
            if (this.playlists.length === 1 && this.playlists[0].name === "默认歌单" && this.playlists[0].songs.length === 0) {
                return;
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
            localStorage.setItem(
                "nbmusic_current_playlist",
                JSON.stringify({
                    playlistId: this.playlistManager.currentPlaylistId,
                    songIndex: this.playlistManager.playingNow,
                    currentTime: this.playlistManager.audioPlayer?.audio?.currentTime || 0
                })
            );
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

            const downloadBtn = document.createElement("i");
            downloadBtn.classList.add("bi", "bi-download");
            downloadBtn.onclick = (e) => {
                e.stopPropagation();
                this.downloadPlaylist(playlist.songs, playlist.name);
            };

            buttonContainer.appendChild(renameBtn);
            buttonContainer.appendChild(downloadBtn);
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
                const songIndex = Math.min(targetPlaylist.lastPlayedIndex || 0, targetPlaylist.songs.length - 1);

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
                                this.playlistManager.audioPlayer.audio.play().catch((err) => console.warn("自动播放失败:", err));
                            }
                        }, 500);
                    } else if (shouldPlay) {
                        // 如果当前正在播放，且没有进度，直接播放
                        setTimeout(() => {
                            this.playlistManager.audioPlayer.audio.play().catch((err) => console.warn("自动播放失败:", err));
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

            li.appendChild(delBtn);
            this.songSection.appendChild(li);
        });
    }

    renamePlaylist(playlistId) {
        const playlist = this.playlists.find((p) => p.id === playlistId);
        if (!playlist) return;

        const playlistItem = document.querySelector(`li[data-id="${playlistId}"]`);
        const nameSpan = playlistItem.querySelector(".playlist-name");
        const originalName = nameSpan.textContent;

        // 创建输入框
        const input = document.createElement("input");
        input.type = "text";
        input.value = originalName;
        input.className = "playlist-input";
        input.style.width = "calc(100% - 60px)";
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
                if (this.playlists.some((p) => p.id !== playlistId && p.name === newName)) {
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
            } else {
                input.replaceWith(nameSpan);
            }
        };

        input.addEventListener("blur", handleRename);
        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                input.blur();
            } else if (e.key === "Escape") {
                input.replaceWith(nameSpan);
            }
        });
    }

    deletePlaylist(playlistId) {
        const index = this.playlists.findIndex((p) => p.id === playlistId);
        if (index === -1) return;

        const deleteBtn = document.querySelector(`li[data-id="${playlistId}"] .bi-trash`);

        // 如果已经是确认状态
        if (deleteBtn.classList.contains("confirm-delete")) {
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
        deleteBtn.classList.add("confirm-delete");
        deleteBtn.style.color = "red";

        const confirmText = document.createElement("span");
        confirmText.textContent = "再次点击确认删除";
        confirmText.style.cssText = `
            color: red;
            position: relative;
            top: 0.25em;
            font-size: 12px;
            margin-left: 5px;
        `;
        deleteBtn.parentNode.appendChild(confirmText);

        // 5秒后恢复原状
        setTimeout(() => {
            deleteBtn.classList.remove("confirm-delete");
            deleteBtn.style.color = "";
            if (confirmText.parentNode) {
                confirmText.remove();
            }
        }, 5000);
    }

    handlePlaylistUpdate() {
        const activePlaylist = this.playlists[this.activePlaylistIndex];
        if (activePlaylist && activePlaylist.name === this.playlistManager.playlistName) {
            // 深拷贝当前播放列表的歌曲到激活的歌单
            activePlaylist.songs = JSON.parse(JSON.stringify(this.playlistManager.playlist));
            // 保存更新后的歌单
            this.savePlaylists();
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
            let favId = this.parseFavId(mediaId);
            if (!favId) {
                throw new Error("无法解析收藏夹ID，请确认输入格式正确");
            }

            // 1. 获取收藏夹信息
            const favResponse = await axios.get(`https://api.bilibili.com/x/v3/fav/folder/info?media_id=${favId}`);
            if (favResponse.data.code !== 0) {
                throw new Error("获取收藏夹信息失败");
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
                songs: [],
                meta: { 
                    mediaId: favId,
                    type: 'bilibili',
                    total: favInfo.media_count
                }
            });

            // 2. 收集所有要添加的歌曲信息
            const songsToAdd = [];
            let processedCount = 0;

            // 显示导入进度通知
            importNotification = this.uiManager.showNotification(`正在导入歌单: 0/${totalCount}`, "info", { showProgress: true, progress: 0 });

            // 3. 逐页获取视频信息
            for (let page = 1; page <= totalPages; page++) {
                const resourcesResponse = await axios.get(`https://api.bilibili.com/x/v3/fav/resource/list?media_id=${favId}&pn=${page}&ps=${pageSize}&platform=web`);

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
                            importNotification.querySelector(".notification-message").textContent = `正在导入歌单: ${processedCount}/${totalCount}`;
                            importNotification.querySelector(".notification-progress-inner").style.width = `${progress}%`;
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
            console.error("从B站收藏夹导入失败:", error);
            return {
                success: false,
                message: "导入失败: " + error.message
            };
        }
    }
    async updateBiliFav(playlistIndex) {
        const playlist = this.playlists[playlistIndex];
        let updateNotification = null;
        
        // 新增状态检查防止重复点击
        if (this.isUpdating) {
            this.uiManager.showNotification('更新正在进行中，请稍后再试', 'warning');
            return;
        }
        
        try {
            this.isUpdating = true; // 设置更新状态
            // 增强类型验证逻辑
            const { mediaId, seasonId, type } = playlist.meta || {};

            // 根据不同类型选择更新方式
            if (type === 'bilibili-season' && seasonId) {
                return await this.updateBiliSeason(playlistIndex);
            }

            // 原有收藏夹更新逻辑
            if (!mediaId) {
                throw new Error('此歌单未关联B站收藏夹,请重新添加收藏夹');
            }

            // 修改API请求使用v3接口
            const favResponse = await axios.get(
                `https://api.bilibili.com/x/v3/fav/folder/info?media_id=${mediaId}`
            );

            const favInfo = favResponse.data.data;
            const totalCount = favInfo.media_count;
            const existingBVids = new Set(playlist.songs.map(song => song.bvid));

            // 设置进度通知
            updateNotification = this.uiManager.showNotification(
                `正在检查更新 (0/${totalCount})`,
                'info',
                { showProgress: true, progress: 0 }
            );

            let newSongs = [];
            const pageSize = 20;
            const totalPages = Math.ceil(totalCount / pageSize);

            // 遍历所有页面
            for (let page = 1; page <= totalPages; page++) {
                const res = await axios.get(
                    `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${mediaId}&pn=${page}&ps=${pageSize}`
                );

                if (res.data.code === 0) {
                    const medias = res.data.data.medias || [];

                    // 过滤已存在的视频
                    const filtered = medias.filter(media =>
                        !existingBVids.has(media.bvid) && media.attr !== 1
                    );

                    // 转换格式并添加到新歌曲列表
                    newSongs.push(...await Promise.all(filtered.map(async media => ({
                        title: media.title,
                        artist: media.upper.name,
                        bvid: media.bvid,
                        duration: media.duration,
                        poster: media.cover,
                        meta: { mediaId } // 保存收藏夹ID用于后续更新
                    }))));

                    // 更新进度
                    const processed = page * pageSize;
                    const progress = Math.min(processed / totalCount * 100, 100);
                    const progressBar = updateNotification.querySelector('.notification-progress-inner'); // 修正选择器
                    const progressText = updateNotification.querySelector('.notification-message');

                    if (progressText && progressBar) { // 添加空值检查
                        progressText.textContent =
                            `正在检查更新 (${Math.min(processed, totalCount)}/${totalCount})`;
                        progressBar.style.width = `${progress}%`;
                    }
                }
            }

            // 应用更新
            if (newSongs.length > 0) {
                // 处理新增歌曲的歌词
                const newSongsWithLyrics = await this.processSongsLyrics(newSongs); // 新增歌词处理

                playlist.songs = [...newSongsWithLyrics, ...playlist.songs]; // 使用带歌词的新数据
                this.savePlaylists();
                this.uiManager.showNotification(`发现${newSongs.length}首新歌曲`, 'success');

                // 强制刷新歌单列表并保持激活状态
                this.renderPlaylistList();
                this.renderSongList();

                // 高亮更新后的歌单条目
                const updatedElement = document.querySelector(`li[data-id="${playlist.id}"]`);
                if (updatedElement) {
                    updatedElement.classList.add('active');
                    updatedElement.click();
                }
            } else {
                this.uiManager.showNotification('当前歌单已是最新', 'info');
            }
        } catch (error) {
            this.uiManager.showNotification(`更新失败: ${error.message}`, 'error');
        } finally {
            this.isUpdating = false; // 重置更新状态
            if (updateNotification) {  // 添加安全判断
                updateNotification.remove();
            }
        }
    }

    async updateBiliSeason(playlistIndex) {
        const playlist = this.playlists[playlistIndex];
        let updateNotification = null;
        try {
            const { seasonId, mid } = playlist.meta || {};
            if (!seasonId || !mid) {
                throw new Error('此歌单未关联B站合集或信息不完整');
            }

            // 获取合集信息
            const seasonResponse = await axios.get(
                `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${mid}&season_id=${seasonId}&page_num=1&page_size=100`
            );

            if (seasonResponse.data.code !== 0) {
                throw new Error('获取合集信息失败: ' + seasonResponse.data.message);
            }

            const videos = seasonResponse.data.data.archives;
            const totalCount = videos.length;
            const existingBVids = new Set(playlist.songs.map(song => song.bvid));

            // 获取合集名称
            const seasonName = playlist.name.replace(/\([^)]*\)$/, '').trim();

            // 设置进度通知
            updateNotification = this.uiManager.showNotification(
                `正在检查更新 (0/${totalCount})`,
                'info',
                { showProgress: true, progress: 0 }
            );

            let newSongs = [];
            let processedCount = 0;

            // 处理每个视频
            for (const video of videos) {
                try {
                    // 跳过已存在的视频
                    if (existingBVids.has(video.bvid)) {
                        processedCount++;
                        continue;
                    }

                    // 获取视频详情以获取CID
                    let cid = video.cid;
                    if (!cid) {
                        const videoDetailResponse = await axios.get(
                            `https://api.bilibili.com/x/web-interface/view?bvid=${video.bvid}`
                        );
                        if (videoDetailResponse.data.code === 0) {
                            cid = videoDetailResponse.data.data.cid;
                        }
                    }

                    newSongs.push({
                        title: video.title,
                        artist: seasonName,
                        bvid: video.bvid,
                        cid: cid,
                        duration: video.duration,
                        poster: video.pic,
                        meta: { seasonId, mid }
                    });

                    // 更新进度
                    processedCount++;
                    const progress = (processedCount / totalCount) * 100;
                    updateNotification.querySelector(".notification-message").textContent = 
                        `正在检查更新 (${processedCount}/${totalCount})`;
                    updateNotification.querySelector(".notification-progress-inner").style.width = 
                        `${progress}%`;

                } catch (error) {
                    console.warn(`处理视频 ${video.bvid} 失败:`, error);
                    continue;
                }
            }

            // 应用更新
            if (newSongs.length > 0) {
                // 处理新增歌曲的歌词
                const newSongsWithLyrics = await this.processSongsLyrics(newSongs);

                playlist.songs = [...newSongsWithLyrics, ...playlist.songs];
                this.savePlaylists();
                this.uiManager.showNotification(`发现${newSongs.length}首新歌曲`, 'success');

                // 强制刷新歌单列表并保持激活状态
                this.renderPlaylistList();
                this.renderSongList();

                // 高亮更新后的歌单条目
                const updatedElement = document.querySelector(`li[data-id="${playlist.id}"]`);
                if (updatedElement) {
                    updatedElement.classList.add('active');
                    updatedElement.click();
                }
            } else {
                this.uiManager.showNotification('当前歌单已是最新', 'info');
            }
        } catch (error) {
            this.uiManager.showNotification(`更新失败: ${error.message}`, 'error');
        } finally {
            if (updateNotification) {
                updateNotification.remove();
            }
        }
    }

    async showLyricSearchDialog(song) {
        return new Promise((resolve) => {
            const dialog = document.getElementById("lyricSearchDialog");
            const titleDiv = document.getElementById("currentSongTitle");
            const keywordInput = document.getElementById("lyricKeyword");
            const skipBtn = document.getElementById("skipLyric");
            const confirmBtn = document.getElementById("confirmLyric");

            // 显示当前歌曲信息
            titleDiv.textContent = song.title;
            keywordInput.value = song.title;
            dialog.classList.remove("hide");

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
                    } catch {
                        resolve("暂无歌词，尽情欣赏音乐");
                    }
                } else {
                    resolve("暂无歌词，尽情欣赏音乐");
                }
            };

            const handleKeydown = (e) => {
                if (e.key === "Enter") {
                    handleConfirm();
                } else if (e.key === "Escape") {
                    handleSkip();
                }
            };

            const cleanup = () => {
                dialog.classList.add("hide");
                skipBtn.removeEventListener("click", handleSkip);
                confirmBtn.removeEventListener("click", handleConfirm);
                keywordInput.removeEventListener("keydown", handleKeydown);
            };

            skipBtn.addEventListener("click", handleSkip);
            confirmBtn.addEventListener("click", handleConfirm);
            keywordInput.addEventListener("keydown", handleKeydown);

            // 聚焦输入框
            keywordInput.focus();
            keywordInput.select();
        });
    }

    // 解析收藏夹ID（也适用于合集链接）
    parseFavId(input) {
        if (/^\d+$/.test(input)) {
            return input; // 直接输入的ID
        } else {
            // 解析链接中的ID
            const match = input.match(/fid=(\d+)/);
            if (match) return match[1]; else return null;
        }
    }

    // 解析合集ID
    parseSeasonId(input) {
        if (/^\d+$/.test(input)) {
            return input; // 直接输入的ID
        } else {
            // 解析合集链接格式：https://space.bilibili.com/1060544882/lists/1049571?type=season
            const match = input.match(/\/lists\/(\d+)/) ||
                input.match(/sid=(\d+)/) ||
                input.match(/season_id=(\d+)/);
            if (match) return match[1]; else return null;
        }
    }

    async importFromBiliSeason(input) {
        let importNotification = null;
        let lyricsNotification = null;

        try {
            // 解析合集ID
            let seasonId = this.parseSeasonId(input) ?? this.parseFavId(input);
            if (!seasonId) {
                throw new Error('无法解析合集ID，请确认输入格式正确');
            }

            // 1. 获取合集信息，需要mid参数，先尝试获取
            const testResponse = await axios.get(`https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?season_id=${seasonId}&page_num=1&page_size=1`);
            if (testResponse.data.code !== 0) {
                throw new Error("获取合集信息失败: " + testResponse.data.message);
            }

            const mid = testResponse.data.data.meta.mid;
            const seasonInfo = testResponse.data.data.meta;

            // 2. 使用mid获取完整合集信息
            const seasonResponse = await axios.get(`https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${mid}&season_id=${seasonId}&page_num=1&page_size=100`);

            if (seasonResponse.data.code !== 0) {
                throw new Error("获取合集视频失败: " + seasonResponse.data.message);
            }

            const videos = seasonResponse.data.data.archives;
            const totalCount = videos.length;

            if (totalCount === 0) {
                throw new Error("该合集中没有视频");
            }

            // 创建新歌单
            const playlistTitle = `${seasonInfo.name}`;
            const playlistIndex = this.playlists.length;
            this.playlists.push({
                id: this.generateUUID(),
                name: playlistTitle,
                songs: [],
                meta: {
                    seasonId: seasonId,
                    mid: mid,
                    type: 'bilibili-season',
                    total: totalCount
                }
            });

            // 收集所有要添加的歌曲信息
            const songsToAdd = [];
            let processedCount = 0;

            // 显示导入进度通知
            importNotification = this.uiManager.showNotification(`正在导入歌单: 0/${totalCount}`, "info", { showProgress: true, progress: 0 });

            // 处理每个视频
            for (const video of videos) {
                try {
                    // 检查video对象中是否包含有效的cid
                    // 如果没有cid或cid为无效值，则获取视频详情
                    let cid = video.cid;

                    // 如果cid不存在或无效
                    if (!cid) {
                        try {
                            const videoDetailResponse = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${video.bvid}`);

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
                    importNotification.querySelector(".notification-message").textContent = `正在导入歌单: ${processedCount}/${totalCount}`;
                    importNotification.querySelector(".notification-progress-inner").style.width = `${progress}%`;
                } catch (error) {
                    console.warn(`处理视频 ${video.bvid} 失败:`, error);
                    continue;
                }

                // 加入适当的延迟，避免请求过于频繁
                await new Promise((resolve) => setTimeout(resolve, 300));
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

            console.error("从B站合集导入失败:", error);
            return {
                success: false,
                message: "导入失败: " + error.message
            };
        }
    }

    async processSongsLyrics(songsToAdd) {
        const lyricsNotification = this.uiManager.showNotification(`正在获取歌词: 0/${songsToAdd.length}`, "info", { showProgress: true, progress: 0 });

        let lyricsCount = 0;
        const songsWithLyrics = [];

        for (const song of songsToAdd) {
            try {
                let lyric;
                if (this.lyricSearchType === "custom") {
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
                lyricsNotification.querySelector(".notification-message").textContent = `正在获取歌词: ${lyricsCount}/${songsToAdd.length}`;
                lyricsNotification.querySelector(".notification-progress-inner").style.width = `${progress}%`;
            } catch (error) {
                console.warn(`获取歌词失败: ${song.title}`, error);
                songsWithLyrics.push({
                    ...song,
                    lyric: "暂无歌词，尽情欣赏音乐"
                });

                // 仍然更新进度
                lyricsCount++;
                const progress = (lyricsCount / songsToAdd.length) * 100;
                lyricsNotification.querySelector(".notification-message").textContent = `正在获取歌词: ${lyricsCount}/${songsToAdd.length}`;
                lyricsNotification.querySelector(".notification-progress-inner").style.width = `${progress}%`;
            }
        }

        // 歌词获取完成后移除通知
        lyricsNotification.remove();

        return songsWithLyrics;
    }
}

module.exports = MusiclistManager;
