const UIModule = require('./UIModule');

/**
 * 自定义选择控件模块
 * 处理应用内自定义下拉选择框的创建和管理
 */
class SelectControlModule extends UIModule {
    /**
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
    }

    /**
     * 初始化自定义选择控件模块
     */
    initialize() {
        this.initializeCustomSelects();
        this.initializeAdvancedControls();
    }

    /**
     * 初始化高级控制功能
     */
    initializeAdvancedControls() {
        // 替换原有的速度选择下拉框实现
        const speedControl = document.querySelector(".speed-control");
        if (speedControl) {
            this.createCustomSelect(speedControl, [
                { value: "0.5", text: "0.5x" },
                { value: "1", text: "1x", selected: true },
                { value: "1.25", text: "1.25x" },
                { value: "1.5", text: "1.5x" },
                { value: "2", text: "2x" }
            ], (value) => {
                this.audioPlayer.audio.playbackRate = parseFloat(value);
            });
        }

        // 为自定义速度选择下拉框添加事件监听
        const speedControlWrapper = document.querySelector(".speed-control-wrapper");
        if (speedControlWrapper) {
            const selectItems = speedControlWrapper.querySelectorAll(".select-item");
            const selectSelected = speedControlWrapper.querySelector(".select-selected");
            
            // 点击选中区域时切换下拉框显示状态
            selectSelected.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // 关闭其他所有已打开的下拉框
                document.querySelectorAll('.select-selected.open').forEach(el => {
                    if (el !== selectSelected) {
                        el.classList.remove('open');
                        el.nextElementSibling.classList.remove('open');
                    }
                });
                
                // 切换当前下拉框状态
                selectSelected.classList.toggle('open');
                selectSelected.nextElementSibling.classList.toggle('open');
            });
            
            // 为每个选项添加点击事件
            selectItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // 更新UI
                    selectItems.forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                    selectSelected.textContent = item.textContent;
                    
                    // 关闭下拉框
                    selectSelected.classList.remove('open');
                    selectSelected.nextElementSibling.classList.remove('open');
                    
                    // 设置播放速度
                    const value = item.dataset.value;
                    if (value && this.audioPlayer) {
                        this.audioPlayer.audio.playbackRate = parseFloat(value);
                    }
                });
            });
            
            // 点击页面其他区域时关闭下拉框
            document.addEventListener('click', () => {
                selectSelected.classList.remove('open');
                selectSelected.nextElementSibling.classList.remove('open');
            });
        }

        // 下载按钮
        const downloadBtn = document.querySelector(".import-btn");
        downloadBtn?.addEventListener("click", async () => {
            try {
                const currentSong = this.playlistManager.playlist[this.playlistManager.playingNow];
                if (!currentSong) {
                    this.uiManager.showNotification('没有可下载的音乐', 'error');
                    return;
                }
        
                // 显示加载提示
                this.uiManager.showNotification('正在准备下载...', 'info');
        
                // 获取最新的音频URL
                const audioUrl = currentSong.audio;
                if (!audioUrl) {
                    throw new Error('无法获取音频链接');
                }
        
                // 使用 fetch 下载音频文件
                const response = await fetch(audioUrl);
                if (!response.ok) {
                    throw new Error('下载失败');
                }
        
                // 获取音频数据
                const blob = await response.blob();
                
                // 创建下载链接
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                // 清理文件名，移除非法字符
                const fileName = currentSong.title.replace(/[<>:"/\\|?*]+/g, '_');
                a.download = `${fileName}.mp3`; // 使用 .mp3 扩展名
                a.href = url;
                
                // 触发下载
                document.body.appendChild(a);
                a.click();
                
                // 清理
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
        
                this.uiManager.showNotification('开始下载音乐', 'success');
        
            } catch (error) {
                console.error("下载失败:", error);
                this.uiManager.showNotification('下载失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 初始化页面上所有的自定义下拉框
     */
    initializeCustomSelects() {
        // 查找页面上所有需要转换的select元素 (跳过已有的自定义下拉框)
        const selects = document.querySelectorAll('select:not(.custom-select-initialized):not(.speed-control)');
        
        selects.forEach(select => {
            // 跳过已经初始化的select或速度控制select（它有特殊处理）
            if (select.classList.contains('custom-select-initialized') || 
                select.classList.contains('speed-control')) {
                return;
            }
            
            // 从原生select中获取选项
            const options = Array.from(select.options).map(option => ({
                value: option.value,
                text: option.textContent,
                selected: option.selected
            }));
            
            // 如果原select有change事件处理器，需要保留该行为
            const onChangeCallback = (value) => {
                // 创建并触发一个合成的change事件
                const event = new Event('change', { bubbles: true });
                select.value = value;
                select.dispatchEvent(event);
            };
            
            // 标记为已初始化
            select.classList.add('custom-select-initialized');
            
            // 创建自定义下拉框
            this.createCustomSelect(select, options, onChangeCallback);
        });
    }

    /**
     * 创建自定义下拉框
     * @param {HTMLElement} selectElement - 原始select元素
     * @param {Array} options - 选项数组，每项包含value和text
     * @param {Function} onChangeCallback - 值变化时的回调函数
     */
    createCustomSelect(selectElement, options, onChangeCallback) {
        // 创建容器并保持原始select的属性
        const customSelect = document.createElement('div');
        customSelect.className = 'custom-select';
        customSelect.id = selectElement.id || '';
        if (selectElement.disabled) {
            customSelect.classList.add('disabled');
        }
        
        // 获取当前选中项
        const selectedOption = options.find(opt => opt.selected) || options[0];
        
        // 创建选中项显示区域
        const selectSelected = document.createElement('div');
        selectSelected.className = 'select-selected';
        selectSelected.textContent = selectedOption ? selectedOption.text : '';
        customSelect.appendChild(selectSelected);
        
        // 创建下拉选项容器
        const selectItems = document.createElement('div');
        selectItems.className = 'select-items';
        customSelect.appendChild(selectItems);
        
        // 添加所有选项
        options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'select-item';
            if (option.selected) {
                item.classList.add('selected');
            }
            item.textContent = option.text;
            item.dataset.value = option.value;
            
            // 点击选项时更新选中状态
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // 视觉上的选中效果
                selectItems.querySelectorAll('.select-item').forEach(el => {
                    el.classList.remove('selected');
                });
                item.classList.add('selected');
                
                // 更新显示文本
                selectSelected.textContent = option.text;
                
                // 关闭下拉框
                selectSelected.classList.remove('open');
                selectItems.classList.remove('open');
                
                // 调用回调函数
                if (onChangeCallback) {
                    onChangeCallback(option.value);
                }
            });
            
            selectItems.appendChild(item);
        });
        
        // 点击选中区域时切换下拉框显示状态
        selectSelected.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // 关闭其他所有已打开的下拉框
            document.querySelectorAll('.select-selected.open').forEach(el => {
                if (el !== selectSelected) {
                    el.classList.remove('open');
                    el.nextElementSibling.classList.remove('open');
                }
            });
            
            // 切换当前下拉框状态
            selectSelected.classList.toggle('open');
            selectItems.classList.toggle('open');
        });
        
        // 点击页面其他区域时关闭下拉框
        document.addEventListener('click', () => {
            selectSelected.classList.remove('open');
            selectItems.classList.remove('open');
        });
        
        // 在原select位置插入自定义下拉框，并隐藏原select
        selectElement.parentNode.insertBefore(customSelect, selectElement);
        selectElement.style.display = 'none';
    }
}

module.exports = SelectControlModule; 