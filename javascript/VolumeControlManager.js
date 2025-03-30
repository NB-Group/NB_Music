class VolumeControlManager {
    constructor(settingManager, audioPlayer) {
        this.settingManager = settingManager;
        this.audioPlayer = audioPlayer;
        // 确保音量设置存在，否则设置默认值
        if(!settingManager.getSetting('volume')) {
            settingManager.setSetting('volume', 50);
        }
        this.volume = this.settingManager.getSetting('volume');
        this.initVolumeControl();
        
        // 强制应用音量设置
        this.setVolume(this.volume);
    }

    initVolumeControl() {
        const volBtn = document.getElementById('VolCtrlBtn');
        const volSlider = document.createElement('div');
        volSlider.className = 'volume-slider'; // 移除初始的hide类
        volSlider.innerHTML = `
            <input type="range" min="0" max="100" value="${this.volume}" class="volume-range" orient="vertical">
            <span class="volume-value">${this.volume}%</span>
        `;
        volBtn.parentNode.insertBefore(volSlider, volBtn.nextSibling);
    
        // 点击按钮显示/隐藏滑块
        volBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            volSlider.classList.toggle('show');
        });

        // 滑块控制
        const range = volSlider.querySelector('.volume-range');
        const valueDisplay = volSlider.querySelector('.volume-value');

        range.addEventListener('input', () => {
            this.setVolume(range.value);
            valueDisplay.textContent = `${range.value}%`;
            
            // 动态更新填充部分的宽度
            range.style.setProperty('--fill-width', `${range.value}%`);
        });
        // 初始化时设置填充宽度
        range.style.setProperty('--fill-width', `${this.volume}%`);

        // 点击其他地方隐藏滑块
        document.addEventListener('click', (e) => {
            if (!volSlider.contains(e.target) && e.target !== volBtn) {
                volSlider.classList.remove('show');
            }
        });

        // 初始化音量
        this.setVolume(this.volume);
    }

    setVolume(volume) { 
        this.volume = Math.min(100, Math.max(0, volume));
        this.settingManager.setSetting('volume', this.volume);

        // 转换为0-1范围给audio元素使用
        const normalizedVolume = this.volume === 0 ? 0 : this.volume / 100;
        if (this.audioPlayer && this.audioPlayer.audio) {
            this.audioPlayer.audio.volume = normalizedVolume;
        }
    }

    getVolume() {
        return this.volume;
    }
}

module.exports = VolumeControlManager;
