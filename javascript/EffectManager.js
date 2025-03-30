class EffectManager {
    constructor(audioPlayer, settingManager) {
        this.audioPlayer = audioPlayer;
        this.settingManager = settingManager;
        this.audioContext = new AudioContext();
        this.mediaSource = this.audioContext.createMediaElementSource(audioPlayer.audio);

        this.initializeAnalyzer();
    }
    initializeAnalyzer() {
        const analyserNode = this.audioContext.createAnalyser();
        this.mediaSource.connect(analyserNode);
        analyserNode.connect(this.audioContext.destination);
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
}

module.exports = EffectManager;
