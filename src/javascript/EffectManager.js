class EffectManager {
    /**
     * 音效控制组件 @782
     * @param {import("./AudioPlayer.js")} audioPlayer
     * @param {import("./SettingManager.js")} settingManager
     */
    constructor(audioPlayer, settingManager) {
        this.audioPlayer = audioPlayer;
        this.settingManager = settingManager;
        this.audioContext = new AudioContext();
        this.mediaSource = this.audioContext.createMediaElementSource(audioPlayer.audio);
        this.frequencies = [100, 200, 400, 600, 1000, 3000, 6000, 12000, 14000, 16000];
        this.frequencyFilters = new Object();
        this.initializeAnalyzer();
        this.initializeEqualizer();
        this.initializeEcho();
        this.initializeConvolver();
        this.initializeElements();
        this.connectDestination();
    }

    initializeElements() {
        /**
         * @type {HTMLButtonElement}
         */
        const effectbtn = document.querySelector(".play-container .effect-btn");
        const effectdialog = document.querySelector("#audioEffectDialog");
        const effectdialogcontent = effectdialog.querySelector(".dialog");
        effectbtn.addEventListener("click", () => {
            effectdialog.classList.remove("hide");
        });
        document.addEventListener("keydown", (e) => {
            if (e.key == "Escape" && !effectdialog.classList.contains("hide")) {
                effectdialog.classList.add("hide");
            }
        });
        effectdialogcontent.querySelectorAll(".equalizer-item>.slider").forEach((element) => {
            element.addEventListener("input", (e) => {
                this.adjustFrequency(e.target.dataset.adjust, e.target.value);
            });
        });
        effectdialog.querySelector(".close-btn").addEventListener("click", () => {
            effectdialog.classList.add("hide");
        });
        effectdialogcontent.addEventListener("mousedown", (e) => {
            e.stopPropagation();
        });
        effectdialog.addEventListener("mousedown", () => {
            effectdialog.classList.add("hide");
        });
        // 添加重置按钮事件监听
        effectdialogcontent.querySelector('.reset-btn').addEventListener('click', () => {
            this.frequencies.forEach(freq => {
                this.adjustFrequency(freq, 0);
                const slider = effectdialogcontent.querySelector(`.equalizer-item>.slider[data-adjust="${freq}"]`);
                if (slider) {
                    slider.value = 0;
                }
            });
        });

        if (this.settingManager.getSetting("echo") == "true") {
            effectdialogcontent.querySelector('a.echo[data-value="true"]').classList.add("active");
        } else {
            effectdialogcontent.querySelector('a.echo[data-value="false"]').classList.add("active");
        }
        this.settingManager.addListener("echo", () => {
            this.disconnectAll();
            this.connectDestination();
        });
    }
    initializeAnalyzer() {
        const analyserNode = this.audioContext.createAnalyser();
        this.analyserNode = analyserNode;
        analyserNode.fftSize = 128;
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const settings = this.settingManager.settings;

        const canvas = document.querySelector("#frequency");
        const canvasCtx = canvas.getContext("2d");

        function draw() {
            analyserNode.getByteFrequencyData(dataArray);
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            const gradient = canvasCtx.createLinearGradient(0, canvas.height - 255, canvas.width, canvas.height);
            gradient.addColorStop(0, settings.primaryColor);
            gradient.addColorStop(1, settings.secondaryColor);
            canvasCtx.fillStyle = gradient;
            const sliceWidth = (canvas.width * 1.0) / bufferLength / 2;
            let x = canvas.width / 2;
            for (var i = 0; i < bufferLength; i++) {
                var v = dataArray[i] - 128.0;
                canvasCtx.fillRect(x, canvas.height - v, sliceWidth - 3, v);
                canvasCtx.fillRect(x - i * 2 * sliceWidth, canvas.height - v, sliceWidth - 3, v);
                x += sliceWidth;
            }
            window.requestAnimationFrame(draw);
        }

        draw();
    }

    initializeEqualizer() {
        this.frequencies.forEach((frequency, index) => {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = "peaking";
            filter.frequency.value = frequency;
            filter.Q.value = 1;
            filter.gain.value = 0;
            this.frequencyFilters[frequency] = filter;
            if (index != 0) {
                this.frequencyFilters[this.frequencies[index - 1]].connect(this.frequencyFilters[frequency]);
            }
        });
    }

    initializeEcho() {
        this.delay = this.audioContext.createDelay();
        this.delay.delayTime.value = 0.06;

        this.feedback = this.audioContext.createGain();
        this.feedback.gain.value = 0.35;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1500;

        this.delay.connect(this.feedback);
        this.feedback.connect(filter);
        filter.connect(this.delay);
    }

    initializeConvolver() {
        this.convolver = this.audioContext.createConvolver();
    }

    adjustFrequency(frequency, value) {
        this.frequencyFilters[frequency].gain.value = value;
    }

    disconnectAll() {
        this.mediaSource.disconnect();
        this.frequencyFilters[this.frequencies[this.frequencies.length - 1]].disconnect();
        this.delay.disconnect();
        this.delay.connect(this.feedback);
        this.convolver.disconnect();
        this.analyserNode.disconnect();
    }

    connectDestination() {
        const nodes = [];
        this.mediaSource.connect(this.frequencyFilters[this.frequencies[0]]);
        nodes.push(this.frequencyFilters[this.frequencies[this.frequencies.length - 1]]);
        if (this.settingManager.getSetting("echo") == "true") {
            nodes.push(this.delay);
        }
        if (this.settingManager.getSetting("convolver") == "true") {
            nodes.push(this.convolver);
        }
        nodes.push(this.analyserNode);
        console.log(nodes);
        nodes.forEach((element, index) => {
            if (index != nodes.length - 1) {
                element.connect(nodes[index + 1]);
            }
        });
        this.analyserNode.connect(this.audioContext.destination);
    }
}

module.exports = EffectManager;
