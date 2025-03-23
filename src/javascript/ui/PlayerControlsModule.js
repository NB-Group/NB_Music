const UIModule = require('./UIModule');

/**
 * 播放器控制模块
 * 处理播放/暂停/上一首/下一首按钮和进度条等UI控件
 */
class PlayerControlsModule extends UIModule {
    /**
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
    }

    /**
     * 初始化播放器控制
     */
    initialize() {
        this.initializeProgressBar();
        this.initializePlaybackControls();
        this.initializePlaybackIndicators();
        this.initializeKeyboardControls();
    }

    /**
     * 初始化进度条控制
     */
    initializeProgressBar() {
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
    }

    /**
     * 初始化播放控制按钮
     */
    initializePlaybackControls() {
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
    }

    /**
     * 初始化播放状态指示器
     */
    initializePlaybackIndicators() {
        // 播放状态图标更新
        this.audioPlayer.audio.addEventListener("play", () => {
            document.querySelector(".control>.buttons>.play").classList = "play played";
        });

        this.audioPlayer.audio.addEventListener("pause", () => {
            document.querySelector(".control>.buttons>.play").classList = "play paused";
        });
    }

    /**
     * 初始化键盘控制
     */
    initializeKeyboardControls() {
        // 空格键控制播放/暂停
        window.addEventListener("keydown", (e) => {
            // 空格键控制播放/暂停
            if (e.key === " " && e.target.tagName !== "INPUT") { // 避免在输入框中按空格触发
                e.preventDefault(); // 阻止页面滚动
                this.audioPlayer.play();
            }
        });
    }
}

module.exports = PlayerControlsModule; 