const { ipcRenderer } = require("electron");
const { extractMusicTitle } = require("../utils.js");

class UIManager {
    constructor(audioPlayer, playlistManager, favoriteManager, musicSearcher) {
        this.audioPlayer = audioPlayer;
        this.playlistManager = playlistManager;
        this.favoriteManager = favoriteManager;
        this.musicSearcher = musicSearcher;
        this.isMaximized = false;
        this.minimizeBtn = document.getElementById("maximize");

        this.initializeEvents();
        this.initializePlayerControls();
        this.initializePageEvents();
    }

    initializePlayerControls() {
        // 进度条控制
        const progressBar = document.querySelector("input[type='range']");
        progressBar?.addEventListener("input", (e) => {
            const percent = e.target.value / 100;
            this.audioPlayer.audio.currentTime = percent * this.audioPlayer.audio.duration;
            document.querySelector(".track-active").style.width = `${e.target.value}%`;
            document.querySelector(".handle").style.left = `${e.target.value}%`;
        });

        // 播放时更新进度条
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress = (this.audioPlayer.audio.currentTime / this.audioPlayer.audio.duration) * 100;
            progressBar.value = progress;
            document.querySelector(".track-active").style.width = `${progress}%`;
            document.querySelector(".handle").style.left = `${progress}%`;
        });

        // 播放控制按钮（使用事件委托）
        const buttonsContainer = document.querySelector(".buttons");
        buttonsContainer?.addEventListener("click", (e) => {
            const button = e.target.closest("[data-action]");
            if (!button) return;

            const action = button.dataset.action;
            switch (action) {
                case "play":
                    this.audioPlayer.play();
                    break;
                case "prev":
                    this.audioPlayer.prev();
                    break;
                case "next":
                    this.audioPlayer.next();
                    break;
            }
        });

        // 播放状态图标更新
        this.audioPlayer.audio.addEventListener("play", () => {
            document.querySelector("mdui-button-icon .play").classList = "play played";
        });

        this.audioPlayer.audio.addEventListener("pause", () => {
            document.querySelector("mdui-button-icon .play").classList = "play paused";
        });
    }

    initializePageEvents() {
        // 获取所有可点击导航元素
        const navElements = document.querySelectorAll("[data-page]");

        navElements.forEach((element) => {
            element.addEventListener("click", (e) => {
                e.preventDefault();
                this.show(element.dataset.page);
            });
        });
    }

    // 页面切换方法
    show(pageName) {
        // 隐藏所有内容
        const contents = document.querySelectorAll(".content>div");
        contents.forEach((content) => content.classList.add("hide"));

        // 移除所有导航项的选中状态
        const navItems = document.querySelectorAll("#function-list>a");
        navItems.forEach((item) => item.classList.remove("check"));

        // 显示目标内容
        const targetContent = document.querySelector(`.content ${pageName}`);
        if (targetContent) {
            targetContent.classList.remove("hide");
        }

        // 设置导航项选中状态
        const targetNav = document.querySelector(`#function-list ${pageName}`);
        if (targetNav) {
            targetNav.classList.add("check");
        }
    }

    initializeEvents() {
        // 窗口控制按钮
        document.getElementById("minimize").addEventListener("click", () => {
            ipcRenderer.send("window-minimize");
        });

        document.getElementById("maximize").addEventListener("click", () => {
            ipcRenderer.send("window-maximize");
        });

        document.getElementById("close").addEventListener("click", () => {
            ipcRenderer.send("window-close");
        });

        // ipcRenderer.on("window-state-changed", (event, maximized) => {
        //     this.isMaximized = maximized;
        //     if (this.isMaximized) {
        //         this.minimizeBtn.icon = "filter_none"
        //     } else {
        //         this.minimizeBtn.innerHTML = 'crop_square--rounded';
        //     }
        // });

        const progressSlider = document.querySelector("#progress");

        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress = (this.audioPlayer.audio.currentTime / this.audioPlayer.audio.duration) * 100;
            progressSlider.value = progress;
        });

        // 进度条变化监听
        progressSlider.addEventListener("input", (event) => {
            const progress = event.target.value;
            const audioTime = (progress / 100) * this.audioPlayer.audio.duration;
            this.audioPlayer.audio.currentTime = audioTime;
        });

        const searchField = document.querySelector("mdui-text-field");
        const searchButton = document.querySelector("mdui-button-icon[icon='search--rounded']");

        searchField.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                this.handleSearch(searchField.value);
            }
        });

        searchButton.addEventListener("click", () => {
            this.handleSearch(searchField.value);
        });
    }

    async handleSearch(keyword) {
        if (!keyword) {
            keyword = document.querySelector("mdui-text-field").value;
        }

        if (!keyword.trim()) return;
        this.musicSearcher.searchMusic(keyword);
    }

    renderPlaylist() {
        document.querySelector("#listname").textContent = this.playlistManager.playlistName;
        const playlistElement = document.querySelector("#playing-list");
        playlistElement.innerHTML = "";

        this.playlistManager.playlist.forEach((song) => {
            const div = this.createSongElement(song, song.bvid, {
                isExtract: true
            });
            if (this.playlistManager.playlist[this.playlistManager.playingNow].bvid === song.bvid) {
                div.classList.add("playing");
            }
            div.addEventListener("click", (e) => {
                const loveBtn = e.target.closest(".love");
                const deleteBtn = e.target.closest(".delete");
                if (!loveBtn && !deleteBtn) {
                    const index = this.playlistManager.playlist.findIndex((item) => item.bvid === song.bvid);
                    this.playlistManager.setPlayingNow(index, e);
                    document.querySelector(".player").click();
                }
                let songIndex = this.playlistManager.playlist.findIndex((item) => item.bvid === song.bvid);
                if (loveBtn) {
                    const song = this.playlistManager.playlist[songIndex];

                    if (loveBtn.querySelector("i").classList.contains("loved")) {
                        this.favoriteManager.removeFromFavorites(song);
                    } else {
                        this.favoriteManager.addToFavorites(song);
                    }
                }
                if (deleteBtn) {
                    this.playlistManager.removeSong(song.bvid, e);
                }
            });

            playlistElement.appendChild(div);
        });
    }
    createSongElement(song, bvid, { isLove = true, isDelete = true, isExtract = false } = {}) {
        const isLoved = window.app.favoriteManager.lovelist.some((item) => item.bvid === song.bvid);
        
        // 创建mdui-list-item元素
        const listItem = document.createElement("mdui-list-item");
        listItem.setAttribute("rounded", "");
        listItem.setAttribute("data-bvid", bvid);
        
        // 设置主标题内容
        listItem.textContent = isExtract ? extractMusicTitle(song.title) : song.title;
    
        // 添加封面图片
        const img = document.createElement("img");
        img.setAttribute("slot", "icon");
        img.classList.add("poster"); 
        img.src = song.poster;
        img.alt = "Poster image";
        listItem.appendChild(img);
    
        // 创建控制按钮容器
        const controls = document.createElement("div");
        controls.setAttribute("slot", "end-icon");
    
        // 添加收藏按钮
        if (isLove) {
            const loveBtn = document.createElement("mdui-button-icon");
            loveBtn.classList.add("love");
            loveBtn.setAttribute("icon", isLoved ? "favorite--rounded" : "favorite_border--rounded");
            controls.appendChild(loveBtn);
        }
    
        // 添加删除按钮 
        if (isDelete) {
            const deleteBtn = document.createElement("mdui-button-icon");
            deleteBtn.classList.add("delete");
            deleteBtn.setAttribute("icon", "delete--rounded");
            controls.appendChild(deleteBtn);
        }
    
        listItem.appendChild(controls);
    
        return listItem;
    }
}

module.exports = UIManager;
