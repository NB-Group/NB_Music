// 音频播放器类
class AudioPlayer {
    constructor(playlistManager) {
        this.playlistManager = playlistManager;
        this.audio = new Audio();
        this.audio.autoplay = false;
        this.audio.loop = false;
        this.audio.volume = 1;

        this.audio.addEventListener("ended", () => {
            if (this.audio.loop) {
                this.audio.currentTime = 0;
                this.audio.play();
            } else {
                this.next();
            }
        });

        if ("mediaSession" in navigator) {
            navigator.mediaSession.setActionHandler("play", () => {
                this.play();
            });
            navigator.mediaSession.setActionHandler("pause", () => {
                this.play();
            });
            navigator.mediaSession.setActionHandler("previoustrack", () => {
                this.prev();
            });
            navigator.mediaSession.setActionHandler("nexttrack", () => {
                this.next();
            });
        }

        this.audio.addEventListener("play", () => {
            if ("mediaSession" in navigator) {
                navigator.mediaSession.playbackState = "playing";
            }
        });

        this.audio.addEventListener("pause", () => {
            if ("mediaSession" in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
        });
    }

    async audioPlay() {
        await this.audio.play();
        const int = window.setInterval(
            (() => {
                this.audio.volume += 0.01;
                if (this.audio.volume >= 0.98) {
                    this.audio.volume = 1;
                    window.clearInterval(int);
                }
            }).bind(this),
            6
        );
    }

    audioPause() {
        const int = window.setInterval(
            (() => {
                this.audio.volume -= 0.01;
                if (this.audio.volume <= 0.02) {
                    this.audio.volume = 0;
                    this.audio.pause();
                    window.clearInterval(int);
                }
            }).bind(this),
            6
        );
    }

    async play() {
        try {
            if (this.audio.paused) {
                await this.audioPlay();
                document.querySelector("mdui-button-icon .play").classList = "play played";
            } else {
                this.audioPause();
                document.querySelector("mdui-button-icon .play").classList = "play paused";
            }
        } catch (e) {
            console.error("播放出错:", e);
            document.querySelector("mdui-button-icon .play").classList = "play paused";
        }
    }

    prev() {
        if (this.playlistManager.playingNow > 0) {
            this.playlistManager.setPlayingNow(this.playlistManager.playingNow - 1);
        }
    }

    next() {
        if (this.playlistManager.playingNow < this.playlistManager.playlist.length - 1) {
            this.playlistManager.setPlayingNow(this.playlistManager.playingNow + 1);
        }
    }
}

module.exports = AudioPlayer;
