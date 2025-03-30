const { ipcRenderer } = require('electron');

class UpdateManager {
    constructor() {
        this.container = document.getElementById('update-container');
        this.status = document.getElementById('update-status');
        this.progressWrapper = document.getElementById('update-progress');
        this.progressBar = document.getElementById('progress-inner');
        this.progressText = document.getElementById('progress-percent');
        this.actions = document.getElementById('update-actions');
        
        this.initializeEvents();
    }

    initializeEvents() {
        // 监听主进程发来的更新消息
        ipcRenderer.on('update-error', (_, message) => {
            this.showStatus(`更新检查失败: ${message}`, 'error');
            setTimeout(() => this.hide(), 3000);
        });

        ipcRenderer.on('update-available', () => {
            this.showStatus('发现新版本,开始下载...');
            this.progressWrapper.classList.remove('hide');
        });

        ipcRenderer.on('update-not-available', (_, info) => {
            // 可以处理额外信息，比如开发环境的消息
            const message = info && info.message ? info.message : '当前已是最新版本';
            this.showStatus(message, 'success');
            setTimeout(() => this.hide(), 3000);
        });

        ipcRenderer.on('download-progress', (_, progress) => {
            const percent = Math.round(progress.percent);
            this.progressBar.style.width = `${percent}%`;
            this.progressText.textContent = `${percent}%`;
            this.showStatus(`正在下载更新...`);
        });

        ipcRenderer.on('update-downloaded', () => {
            this.showStatus('更新已下载完成', 'success');
            this.progressWrapper.classList.add('hide');
            this.actions.classList.remove('hide');
            
            // 绑定按钮事件
            const updateNowBtn = document.getElementById('update-now');
            const updateLaterBtn = document.getElementById('update-later');
            
            // 移除旧的事件监听器
            const newUpdateNowBtn = updateNowBtn.cloneNode(true);
            const newUpdateLaterBtn = updateLaterBtn.cloneNode(true);
            
            updateNowBtn.parentNode.replaceChild(newUpdateNowBtn, updateNowBtn);
            updateLaterBtn.parentNode.replaceChild(newUpdateLaterBtn, updateLaterBtn);
            
            // 添加新的事件监听器
            newUpdateNowBtn.addEventListener('click', () => {
                ipcRenderer.send('install-update');
            });
            
            newUpdateLaterBtn.addEventListener('click', () => {
                this.hide();
            });
        });
    }

    show() {
        // 重置状态
        this.progressWrapper.classList.add('hide');
        this.actions.classList.add('hide');
        
        // 显示对话框
        this.container.classList.remove('hide');
        
        // 使用动画效果显示
        requestAnimationFrame(() => {
            this.container.style.opacity = '1';
        });
    }

    hide() {
        // 使用淡出效果
        this.container.style.opacity = '0';
        
        // 等待动画完成后隐藏
        setTimeout(() => {
            this.container.classList.add('hide');
            this.progressWrapper.classList.add('hide');
            this.actions.classList.add('hide');
        }, 300);
    }

    showStatus(message, type = 'info') {
        this.show();
        this.status.textContent = message;
        this.status.className = `update-status ${type}`;
    }
}

module.exports = UpdateManager;
