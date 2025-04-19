const { createObservableArray } = require("../utils.js");

class FavoriteManager {
    /**
     * 收藏管理组件
     * @param {import("./PlaylistManager.js")} playlistManager 
     * @param {import("./UIManager.js")} uiManager 
     */
    constructor(playlistManager, uiManager) {
        this.playlistManager = playlistManager;
        this.uiManager = uiManager;
        this.initializeLovelist();

        this.lovelist = createObservableArray((change) => {
            const listElement = document.querySelector("#lovelist");
            switch (change.type) {
                case "set":
                    break;
                case "method":
                    if (change.method === "push" || change.method === "unshift" || change.method === "splice") {
                        this.renderFavoriteList(listElement);
                    }
                    break;
            }
        });
    }
    initializeLovelist() {
        this.lovelist = createObservableArray(() => {
            const listElement = document.querySelector("#lovelist");
            if (listElement) {
                this.renderFavoriteList(listElement);
            }
        });
    }

    saveFavorites() {
        try {
            localStorage.setItem("nbmusic_favorites", JSON.stringify(this.lovelist));
        } catch (error) {
            console.error("保存收藏列表失败:", error);
        }
    }
    loadFavorites() {
        try {
            const savedFavorites = localStorage.getItem("nbmusic_favorites");
            if (savedFavorites) {
                // 不直接赋值，而是通过数组方法添加
                const favorites = JSON.parse(savedFavorites);
                this.lovelist.length = 0; // 清空数组
                favorites.forEach((item) => this.lovelist.push(item)); // 逐个添加以触发观察者
            }
        } catch (error) {
            console.error("加载收藏列表失败:", error);
            this.initializeLovelist(); // 重新初始化
        }
    }
    removeFromFavorites(song) {
        // 使用 splice 而不是 filter 来确保触发观察者
        const removeIndex = this.lovelist.findIndex((item) => item.title === song.title);
        if (removeIndex !== -1) {
            this.lovelist.splice(removeIndex, 1);
            
            // 修改后的清空检测逻辑
            if (this.lovelist.length === 0) {
                const listElement = document.querySelector("#lovelist");
                listElement.innerHTML = '<div class="empty-state fadein">' + 
                    '<i class="bi bi-music-note-beamed"></i>' +
                    '<p>还没有收藏的音乐哦</p>' +
                    '<span class="tip">小贴士：在播放界面点击❤️图标即可收藏歌曲</span>' +
                    '</div>';
            }
        }

        // 更新UI
        const songElements = document.querySelectorAll(`[data-bvid="${song.bvid}"]`);
        songElements.forEach((songElement) => {
            if (songElement) {
                const loveButton = songElement.querySelector(".controls .love");
                loveButton.innerHTML = '<i class="bi bi-heart"></i>';
                loveButton.querySelector("i").classList.remove("loved");
            }
        });
        this.saveFavorites();
    }

    addToFavorites(song) {
        // 检查是否已存在
        if (this.lovelist.some((item) => item.bvid === song.bvid)) {
            return;
        }

        this.lovelist.push(song); // 这会触发观察者

        // 更新UI
        const songElement = document.querySelector(`[data-bvid="${song.bvid}"]`);
        if (songElement) {
            const loveButton = songElement.querySelector(".controls .love");
            loveButton.innerHTML = '<i class="bi bi-heart-fill"></i>';
            loveButton.querySelector("i").classList.add("loved");
        }
        this.saveFavorites();
    }

    renderFavoriteList(listElement) {
        listElement.innerHTML = "";

        // 重新渲染所有收藏歌曲
        this.lovelist.forEach((song) => {
            const div = this.uiManager.createSongElement(song, song.bvid, {
                isDelete: false
            });

            // 点击播放
            div.addEventListener("click", (e) => {
                const playlist = this.playlistManager.playlist;
                const loveBtn = e.target.closest(".love");
                if (loveBtn) {
                    e.stopPropagation();
                    // 修改这里：使用 closest 获取父元素的 data-bvid
                    const songBvid = e.target.closest('[data-bvid]').getAttribute('data-bvid');
                    const songIndex = playlist.findIndex((item) => item.bvid === songBvid);
                    const song = this.playlistManager.playlist[songIndex];

                    if (loveBtn.querySelector("i").classList.contains("loved")) {
                        this.removeFromFavorites(song);
                    } else {
                        this.addToFavorites(song);
                    }
                } else {
                    //如果在播放列表中找到了这首歌
                    if (playlist.some((item) => item.bvid === song.bvid)) {
                        this.playlistManager.setPlayingNow(playlist.findIndex((item) => item.bvid === song.bvid));
                        document.querySelector("#function-list .player").click();
                    } else {
                        this.playlistManager.addSong(song);
                        this.playlistManager.setPlayingNow(playlist.length - 1, false);
                        this.uiManager.renderPlaylist();
                        document.querySelector("#function-list .player").click();
                    }
                }
            });

            listElement.appendChild(div);
        });
    }
}

module.exports = FavoriteManager;
