const UIModule = require('./UIModule');
const { ipcRenderer } = require("electron");

/**
 * 窗口控制模块
 * 处理应用窗口的最小化、最大化、关闭等控制功能
 */
class WindowControlsModule extends UIModule {
    /**
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
        this.isMaximized = false;
        this.minimizeBtn = null;
    }

    /**
     * 初始化窗口控制模块
     */
    initialize() {
        this.minimizeBtn = document.getElementById("maximize");
        this.initializeWindowControls();
        this.initializeKeyboardShortcuts();
    }

    /**
     * 初始化窗口控制
     */
    initializeWindowControls() {
        // 最小化按钮
        document.getElementById("minimize").addEventListener("click", () => {
            ipcRenderer.send("window-minimize");
        });

        // 最大化/还原按钮
        this.minimizeBtn.addEventListener("click", () => {
            ipcRenderer.send("window-maximize");
        });

        // 关闭按钮
        document.getElementById("close").addEventListener("click", () => {
            ipcRenderer.send("window-close");
        });

        // 监听窗口状态变化
        ipcRenderer.on("window-state-changed", (event, maximized) => {
            this.updateMaximizeButtonIcon(maximized);
        });
    }

    /**
     * 初始化键盘快捷键
     */
    initializeKeyboardShortcuts() {
        window.addEventListener("keydown", (e) => {
            // F12 打开开发者工具
            if (e.key === "F12") {
                ipcRenderer.send("open-dev-tools");
            }
        });
    }

    /**
     * 更新最大化按钮图标
     * @param {boolean} maximized - 窗口是否处于最大化状态
     */
    updateMaximizeButtonIcon(maximized) {
        this.isMaximized = maximized;
        if (this.isMaximized) {
            this.minimizeBtn.innerHTML = `<svg version="1.1" width="12" height="12" viewBox="0,0,37.65105,35.84556" style="margin-top:1px;"><g transform="translate(-221.17804,-161.33903)"><g style="stroke:var(--text);" data-paper-data="{&quot;isPaintingLayer&quot;:true}" fill="none" fill-rule="nonzero" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0"><path d="M224.68734,195.6846c-2.07955,-2.10903 -2.00902,-6.3576 -2.00902,-6.3576l0,-13.72831c0,0 -0.23986,-1.64534 2.00902,-4.69202c1.97975,-2.68208 4.91067,-2.00902 4.91067,-2.00902h14.06315c0,0 3.77086,-0.23314 5.80411,1.67418c2.03325,1.90732 1.33935,5.02685 1.33935,5.02685v13.39347c0,0 0.74377,4.01543 -1.33935,6.3576c-2.08312,2.34217 -5.80411,1.67418 -5.80411,1.67418h-13.39347c0,0 -3.50079,0.76968 -5.58035,-1.33935z"></path><path d="M229.7952,162.85325h16.06111c0,0 5.96092,-0.36854 9.17505,2.64653c3.21412,3.01506 2.11723,7.94638 2.11723,7.94638v18.55642"></path></g></g></svg>`;
        } else {
            this.minimizeBtn.innerHTML = '<i class="bi bi-app"></i>';
        }
    }
}

module.exports = WindowControlsModule; 