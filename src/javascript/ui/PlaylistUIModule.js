const UIModule = require('./UIModule');
const { extractMusicTitle } = require("../../utils.js");

/**
 * 播放列表UI模块
 * 处理播放列表的UI渲染和相关交互
 */
class PlaylistUIModule extends UIModule {
    /**
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
    }

    /**
     * 初始化播放列表UI功能
     */
    initialize() {
        this.initializeListControls();
    }

    /**
     * 初始化播放列表控制功能
     */
    initializeListControls() {
        // 播放模式切换按钮
        document.querySelector(".listname .controls .playmode").addEventListener("click", (e) => {
            e.stopPropagation();
            this.playlistManager.togglePlayMode();
        });

        // 重命名按钮
        document.querySelector(".listname .controls .rename").addEventListener("click", (e) => {
            e.stopPropagation();
            this.playlistManager.renamePlaylist();
        });
    }

    /**
     * 渲染播放列表UI
     */
    renderPlaylist() {
        if (!this.playlistManager) {
            return;
        }
        document.querySelector("#listname").textContent = this.playlistManager.playlistName;
        const playlistElement = document.querySelector("#playing-list");
        playlistElement.innerHTML = "";

        this.playlistManager.playlist.forEach((song) => {
            const div = this.createSongElement(song, song.bvid, {
                isExtract: true
            });
            // 确保当前播放歌曲存在，并且有有效的bvid值
            const currentlyPlaying = this.playlistManager.playlist[this.playlistManager.playingNow];
            if (currentlyPlaying && currentlyPlaying.bvid === song.bvid) {
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

    /**
     * 创建歌曲元素
     * @param {Object} song - 歌曲信息对象
     * @param {string} bvid - 歌曲的BV号
     * @param {Object} options - 配置选项
     * @param {boolean} options.isLove - 是否显示收藏按钮
     * @param {boolean} options.isDelete - 是否显示删除按钮
     * @param {boolean} options.isExtract - 是否提取标题
     * @returns {HTMLElement} 歌曲元素
     */
    createSongElement(song, bvid, { isLove = true, isDelete = true, isExtract = false } = {}) {
        const div = document.createElement("div");
        div.classList.add("song");
        div.setAttribute("data-bvid", bvid);

        // 添加空检查，避免在favoriteManager未初始化时出错
        let isLoved = false;
        if (this.favoriteManager && this.favoriteManager.lovelist) {
            isLoved = this.favoriteManager.lovelist.some((item) => item.bvid === song.bvid);
        }

        div.innerHTML = `
            <img class="poster" alt="Poster image">
            <div class="info">
                <div class="name"></div>
                <div class="artist"></div>
            </div>
            <div class="controls">
                ${isLove
                ? `<div class="love">
                    <i class="bi bi-heart${isLoved ? "-fill" : ""} ${isLoved ? "loved" : ""}"></i>
                </div>`
                : ""
            }
                ${isDelete
                ? `<div class="delete">
                    <i class="bi bi-trash"></i>
                </div>`
                : ""
            }
            </div>`;
        div.querySelector(".poster").src = song.poster;
        
        // 添加空检查
        let titleMode = 'off';
        if (this.settingManager) {
            titleMode = this.settingManager.getSetting('extractTitle');
        }
        
        let displayTitle = song.title;

        switch (titleMode) {
            case 'on':
                displayTitle = extractMusicTitle(song.title);
                break;
            case 'auto':
                div.setAttribute('data-title-mode', 'auto');
                break;
            case 'off':
            default:
                break;
        }

        // 标题截断处理
        const titleElement = div.querySelector(".name");
        const maxLength = 25; // 最大显示字符数
        
        if (displayTitle && displayTitle.length > maxLength) {
            // 截断标题并添加省略号
            const truncatedTitle = displayTitle.substring(0, maxLength) + "...";
            titleElement.textContent = truncatedTitle;
            
            // 添加title属性，以便用户悬停时可以看到完整标题
            titleElement.title = displayTitle;
        } else {
            titleElement.textContent = displayTitle;
        }
        
        div.querySelector(".artist").textContent = song.artist;
        return div;
    }

    /**
     * 显示默认UI
     */
    showDefaultUi() {
        // 设置默认UI显示
        document.querySelector(".player-content .cover .cover-img").src = "../img/NB_Music.png";
        document.querySelector("html").style.setProperty("--bgul", "url(../../img/NB_Music.png)");
        document.querySelector("video")?.remove();
        document.querySelector(".player .info .title").textContent = "NB Music";
        document.querySelector(".player .info .artist").textContent = "欢迎使用";
        document.querySelector(".control>.buttons>.play").classList = "play paused";
        document.querySelector(".progress-bar-inner").style.width = "0%";
        this.audioPlayer.audio.src = "";
        
        // 添加空值检查，避免空引用异常
        if (this.uiManager.lyricsPlayer) {
            this.uiManager.lyricsPlayer.changeLyrics("");
        }
    }
}

module.exports = PlaylistUIModule; 