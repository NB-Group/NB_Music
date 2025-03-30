// 均衡器管理器类
class EQManager {
    constructor(audioContext) {
        this.audioContext = audioContext;
        // 创建10个BiquadFilter节点用于不同频段
        this.eqNodes = [
            this.createFilter('peaking', 31, 1, 0),    // 31Hz
            this.createFilter('peaking', 62, 1, 0),    // 62Hz
            this.createFilter('peaking', 125, 1, 0),   // 125Hz
            this.createFilter('peaking', 250, 1, 0),   // 250Hz
            this.createFilter('peaking', 500, 1, 0),   // 500Hz
            this.createFilter('peaking', 1000, 1, 0),  // 1kHz
            this.createFilter('peaking', 2000, 1, 0),  // 2kHz
            this.createFilter('peaking', 4000, 1, 0),  // 4kHz
            this.createFilter('peaking', 8000, 1, 0),  // 8kHz
            this.createFilter('peaking', 16000, 1, 0)  // 16kHz
        ];
        this.settingManager = null; // 将在初始化时设置
    }
    
    // 创建滤波器节点
    createFilter(type, frequency, Q, gain) {
        const filter = this.audioContext.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = Q;
        filter.gain.value = gain;
        return filter;
    }

    // 应用均衡器设置
    applySettings(settings) {
        if (settings.bands && settings.bands.length === this.eqNodes.length) {
            settings.bands.forEach((gain, index) => {
                this.eqNodes[index].gain.value = gain;
            });
            // 自动保存均衡器设置
            if (this.settingManager) {
                this.settingManager.setSetting('eqSettings', settings);
            }
        }
    }



    // 连接到音频节点
    connect(source, destination) {
        // 串联连接所有滤波器节点
        source.connect(this.eqNodes[0]);
        for (let i = 0; i < this.eqNodes.length - 1; i++) {
            this.eqNodes[i].connect(this.eqNodes[i + 1]);
        }
        this.eqNodes[this.eqNodes.length - 1].connect(destination);
    }

    // 断开连接
    disconnect() {
        this.eqNodes.forEach(node => node.disconnect());
    }
    
    // 设置settingManager的方法
    setSettingManager(settingManager) {
        this.settingManager = settingManager;
        // 当settingManager被设置时，立即加载保存的均衡器设置
        const savedSettings = this.settingManager.getSetting('eqSettings');
        if (savedSettings) {
            this.applySettings(savedSettings);
        }
    }
}