const UIModule = require('./UIModule');

/**
 * 通知模块
 * 处理应用内通知的显示和管理
 */
class NotificationModule extends UIModule {
    /**
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
    }

    /**
     * 初始化通知模块
     */
    initialize() {
        // 通知模块不需要特别初始化，主要提供方法供其他模块调用
    }

    /**
     * 显示通知消息
     * @param {string} message - 通知消息内容
     * @param {string} type - 通知类型 ('info'|'success'|'warning'|'error')
     * @param {object} options - 配置选项
     * @param {boolean} options.showProgress - 是否显示进度条
     * @param {number} options.progress - 进度值(0-100)
     * @returns {HTMLElement} 通知元素
     */
    showNotification(message, type = 'info', {showProgress = false, progress = 0} = {}) {
        // 1. 确保有容器
        let container = document.querySelector('.notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        // 2. 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // 3. 创建消息文本容器
        const messageDiv = document.createElement('div');
        messageDiv.className = 'notification-message';
        messageDiv.textContent = message;
        notification.appendChild(messageDiv);
        
        // 4. 如果需要进度条则添加
        if (showProgress) {
            const progressBar = document.createElement('div');
            progressBar.className = 'notification-progress';
            
            const progressInner = document.createElement('div');
            progressInner.className = 'notification-progress-inner';
            progressInner.style.width = `${progress}%`;
            
            progressBar.appendChild(progressInner);
            notification.appendChild(progressBar);
        }
        
        // 5. 添加到容器
        container.appendChild(notification);
        
        // 6. 如果不是进度通知，3秒后自动移除
        if (!showProgress) {
            setTimeout(() => {
                notification.classList.add('fade-out');
                setTimeout(() => {
                    notification.remove();
                    // 如果容器为空则移除容器
                    if (!container.children.length) {
                        container.remove();
                    }
                }, 300);
            }, 3000);
        }
        
        return notification;
    }

    /**
     * 更新进度条通知的进度
     * @param {HTMLElement} notification - 通知元素
     * @param {number} progress - 新的进度值(0-100)
     */
    updateNotificationProgress(notification, progress) {
        const progressInner = notification.querySelector('.notification-progress-inner');
        if (progressInner) {
            progressInner.style.width = `${progress}%`;
        }
    }

    /**
     * 关闭指定的通知
     * @param {HTMLElement} notification - 通知元素
     */
    closeNotification(notification) {
        if (!notification) return;
        
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
            
            // 如果容器为空则移除容器
            const container = document.querySelector('.notification-container');
            if (container && !container.children.length) {
                container.remove();
            }
        }, 300);
    }
}

module.exports = NotificationModule; 