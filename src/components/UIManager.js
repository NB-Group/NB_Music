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
        const progressBar = document.querySelector(".progress-bar");
        progressBar?.addEventListener("click", (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            this.audioPlayer.audio.currentTime = percent * this.audioPlayer.audio.duration;
        });

        // 播放时更新进度条
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress = (this.audioPlayer.audio.currentTime / this.audioPlayer.audio.duration) * 100;
            document.querySelector(".progress-bar-inner").style.width = `${progress}%`;
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
            document.querySelector(".control>.buttons>.play").classList = "play played";
        });

        this.audioPlayer.audio.addEventListener("pause", () => {
            document.querySelector(".control>.buttons>.play").classList = "play paused";
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

        ipcRenderer.on("window-state-changed", (event, maximized) => {
            this.isMaximized = maximized;
            if (this.isMaximized) {
                this.minimizeBtn.innerHTML = `<svg version="1.1" width="12" height="12" viewBox="0,0,37.65105,35.84556" style="margin-top:1px;"><g transform="translate(-221.17804,-161.33903)"><g style="stroke:var(--text);" data-paper-data="{&quot;isPaintingLayer&quot;:true}" fill="none" fill-rule="nonzero" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0"><path d="M224.68734,195.6846c-2.07955,-2.10903 -2.00902,-6.3576 -2.00902,-6.3576l0,-13.72831c0,0 -0.23986,-1.64534 2.00902,-4.69202c1.97975,-2.68208 4.91067,-2.00902 4.91067,-2.00902h14.06315c0,0 3.77086,-0.23314 5.80411,1.67418c2.03325,1.90732 1.33935,5.02685 1.33935,5.02685v13.39347c0,0 0.74377,4.01543 -1.33935,6.3576c-2.08312,2.34217 -5.80411,1.67418 -5.80411,1.67418h-13.39347c0,0 -3.50079,0.76968 -5.58035,-1.33935z"></path><path d="M229.7952,162.85325h16.06111c0,0 5.96092,-0.36854 9.17505,2.64653c3.21412,3.01506 2.11723,7.94638 2.11723,7.94638v18.55642"></path></g></g></svg>`;
            } else {
                this.minimizeBtn.innerHTML = '<i class="bi bi-app"></i>';
            }
        });

        // 音频进度条
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress = (this.audioPlayer.audio.currentTime / this.audioPlayer.audio.duration) * 100;
            document.querySelector(".player .control .progress .progress-bar .progress-bar-inner").style.width = progress + "%";
        });

        // 进度条点击
        document.querySelector(".player .control .progress .progress-bar").addEventListener("click", (event) => {
            const progressBar = event.currentTarget;
            const clickPosition = event.offsetX;
            const progressBarWidth = progressBar.offsetWidth;
            const progress = (clickPosition / progressBarWidth) * this.audioPlayer.audio.duration;
            this.audioPlayer.audio.currentTime = progress;
        });

        // 侧边栏点击事件
        document.addEventListener("click", (event) => {
            if (!event.target.closest(".sidebar") && !event.target.closest(".dock.sidebar")) {
                document.querySelector(".sidebar").classList.add("hide");
            }
        });

        document.querySelector(".sidebar").addEventListener("mouseover", () => {
            document.querySelector(".sidebar").classList.remove("hide");
        });

        // 列表焦点效果
        document.querySelectorAll("#function-list").forEach((list) => {
            list.addEventListener("click", (e) => {
                const clickedItem = e.target.closest("a");
                if (!clickedItem) return;

                const spanFocs = list.querySelector("span.focs");
                if (!spanFocs) return;

                // 移除之前的所有选中状态
                list.querySelectorAll("a").forEach((a) => a.classList.remove("check"));
                // 添加新的选中状态
                clickedItem.classList.add("check");

                // 显示焦点指示器
                spanFocs.style.display = "block";
                spanFocs.classList.add("moving");

                // 设置位置 - 不再使用 transform，直接设置 top
                if (spanFocs.dataset.type === "abs") {
                    spanFocs.style.top = clickedItem.offsetTop + 10 + "px";
                } else {
                    spanFocs.style.top = clickedItem.offsetTop + 10 + "px";
                    spanFocs.style.left = clickedItem.offsetLeft + 10 + "px";
                }

                setTimeout(() => {
                    spanFocs.classList.remove("moving");
                }, 300);
            });
        });

        // 搜索输入框事件
        document.querySelector(".search input").addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                this.handleSearch(event);
            }
        });

        // 主题切换事件
        document.querySelector(".dock.theme").addEventListener("click", () => {
            this.toggleTheme();
        });
    }

    async handleSearch() {
        const keyword = document.querySelector(".search input").value;
        if (!keyword) return;
        this.musicSearcher.searchMusic(keyword);
    }

    toggleTheme() {
        document.querySelector(".dock.theme").classList.toggle("dk");
        document.documentElement.classList.toggle("dark");

        if (document.documentElement.classList.contains("dark")) {
            localStorage.setItem("theme", "dark");
        } else {
            localStorage.setItem("theme", "light");
        }
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
                    document.querySelector("#function-list .player").click();
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
        const div = document.createElement("div");
        div.classList.add("song");
        div.setAttribute("data-bvid", bvid);

        const isLoved = window.app.favoriteManager.lovelist.some((item) => item.bvid === song.bvid);

        div.innerHTML = `
            <img class="poster" alt="Poster image">
            <div class="info">
                <div class="name"></div>
                <div class="artist"></div>
            </div>
            <div class="controls">
                ${
                    isLove
                        ? `<div class="love">
                    <i class="bi bi-heart${isLoved ? "-fill" : ""} ${isLoved ? "loved" : ""}"></i>
                </div>`
                        : ""
                }
                ${
                    isDelete
                        ? `<div class="delete">
                    <i class="bi bi-trash"></i>
                </div>`
                        : ""
                }
            </div>`;
        div.querySelector(".poster").src = song.poster;
        div.querySelector(".name").textContent = isExtract ? extractMusicTitle(song.title) : song.title;
        div.querySelector(".artist").textContent = song.artist;
        return div;
    }
}

module.exports = UIManager;
