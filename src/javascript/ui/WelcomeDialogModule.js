const UIModule = require('./UIModule');
const { ipcRenderer } = require("electron");

/**
 * 欢迎对话框模块
 * 处理应用的首次使用引导和欢迎对话框
 */
class WelcomeDialogModule extends UIModule {
    /**
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
    }

    /**
     * 初始化欢迎对话框模块
     */
    initialize() {
        this.initializeWelcomeDialog();
    }

    /**
     * 初始化欢迎对话框事件和功能
     */
    initializeWelcomeDialog() {
        // 处理复选框状态变化
        const agreeCheckbox = document.getElementById('agreeCheckbox');
        const agreeButton = document.getElementById('agreeTerms');
        
        if (agreeCheckbox && agreeButton) {
            // 复选框状态变化时更新按钮状态
            agreeCheckbox.addEventListener('change', () => {
                agreeButton.disabled = !agreeCheckbox.checked;
            });
        }
        
        // 免责声明链接点击事件
        const disclaimerLink = document.getElementById('disclaimer-link');
        if (disclaimerLink) {
            disclaimerLink.addEventListener('click', (e) => {
                e.preventDefault();
                // 使用Electron的shell模块打开外部链接
                ipcRenderer.send('open-external-link', 'https://nb-group.github.io/nb-music/disclaimer');
            });
        }
        
        // 同意按钮点击事件
        if (agreeButton) {
            agreeButton.addEventListener('click', () => {
                if (agreeCheckbox && agreeCheckbox.checked) {
                    // 标记已经看过首次使用对话框
                    localStorage.setItem("nbmusic_first_use_seen", "true");
                    
                    // 隐藏对话框
                    const firstUseDialog = document.getElementById("firstUseDialog");
                    if (firstUseDialog) {
                        firstUseDialog.classList.add("hide");
                    }
                } else {
                    this.uiManager.showNotification('请先同意免责声明', 'warning');
                }
            });
        }

        // 监听主进程请求显示欢迎对话框的事件
        ipcRenderer.on('show-welcome', () => {
            this.showWelcomeDialog();
        });
    }
    
    /**
     * 检查是否是首次使用应用，如果是则显示欢迎对话框
     */
    checkFirstUse() {
        // 检查是否是首次使用
        const hasUsedBefore = localStorage.getItem("nbmusic_first_use_seen");
        
        if (!hasUsedBefore) {
            this.showWelcomeDialog();
        }
    }
    
    /**
     * 显示欢迎对话框
     */
    showWelcomeDialog() {
        const firstUseDialog = document.getElementById("firstUseDialog");
        if (firstUseDialog) {
            firstUseDialog.classList.remove("hide");
            
            // 重置复选框和按钮状态
            const agreeCheckbox = document.getElementById('agreeCheckbox');
            const agreeButton = document.getElementById('agreeTerms');
            
            if (agreeCheckbox) agreeCheckbox.checked = false;
            if (agreeButton) agreeButton.disabled = true;
        }
    }
}

module.exports = WelcomeDialogModule; 