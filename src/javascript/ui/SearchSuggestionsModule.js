const UIModule = require('./UIModule');

/**
 * 搜索建议模块
 * 处理搜索输入框的建议功能
 */
class SearchSuggestionsModule extends UIModule {
    /**
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
        this.selectedSuggestionIndex = -1;
        this.suggestions = [];
    }

    /**
     * 初始化搜索建议功能
     */
    initialize() {
        const searchInput = document.querySelector('.search input');
        if (!searchInput) return;

        // 创建建议容器
        const suggestionContainer = document.createElement('div');
        suggestionContainer.classList.add('suggestions');
        document.querySelector(".loading").parentNode.appendChild(suggestionContainer);

        this.searchInput = searchInput;
        this.suggestionContainer = suggestionContainer;

        this.setupEventListeners();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        let debounceTimer;

        // 输入事件处理
        this.searchInput.addEventListener('input', async (e) => {
            clearTimeout(debounceTimer);
            this.selectedSuggestionIndex = -1;
            const term = e.target.value.trim();

            if (!term) {
                this.clearSuggestions();
                return;
            }

            debounceTimer = setTimeout(async () => {
                this.suggestions = await this.musicSearcher.getSearchSuggestions(term);
                if (!this.suggestions.length) {
                    this.clearSuggestions();
                } else {
                    this.renderSuggestions();
                }
            }, 20);
        });

        // 键盘事件处理
        this.searchInput.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.selectedSuggestionIndex = (this.selectedSuggestionIndex + 1) % this.suggestions.length;
                    this.updateSelection();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.selectedSuggestionIndex = this.selectedSuggestionIndex <= 0 ? 
                        this.suggestions.length - 1 : this.selectedSuggestionIndex - 1;
                    this.updateSelection();
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (this.selectedSuggestionIndex >= 0) {
                        // 选中建议项
                        this.searchInput.value = this.suggestions[this.selectedSuggestionIndex].value;
                        // 触发搜索
                        this.handleSearch();
                    } else {
                        // 直接搜索输入内容
                        this.handleSearch();
                    }
                    // 无论是哪种情况，都清除搜索建议
                    this.clearSuggestions();
                    break;
                case 'Escape':
                    this.clearSuggestions();
                    break;
            }
        });

        // 点击建议项
        this.suggestionContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                this.searchInput.value = item.dataset.term;
                this.clearSuggestions();
                this.handleSearch();
            }
        });

        // 点击外部关闭建议框
        document.addEventListener('click', (e) => {
            if (!this.suggestionContainer.contains(e.target) && e.target !== this.searchInput) {
                this.clearSuggestions();
            }
        });
    }

    /**
     * 清除搜索建议
     */
    clearSuggestions() {
        this.suggestionContainer.innerHTML = '';
        this.suggestionContainer.classList.remove('active');
        this.suggestions = [];
        this.selectedSuggestionIndex = -1;
    }

    /**
     * 渲染搜索建议
     */
    renderSuggestions() {
        this.suggestionContainer.innerHTML = this.suggestions
            .map(s => `
                <div class="suggestion-item" data-term="${s.value}">
                    ${s.name}
                </div>
            `).join('');
        this.suggestionContainer.classList.add('active');
    }

    /**
     * 更新选中状态
     */
    updateSelection() {
        const items = this.suggestionContainer.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            if (index === this.selectedSuggestionIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * 处理搜索请求
     */
    async handleSearch() {
        try {
            const keyword = this.searchInput.value;
            if (!keyword) return;
            
            // 确保执行搜索时也移除搜索建议
            this.clearSuggestions();
            
            // 执行搜索
            this.musicSearcher.searchMusic(keyword);
        } catch (error) {
            this.uiManager.showNotification('搜索失败: ' + error.message, 'error');
        }
    }
}

module.exports = SearchSuggestionsModule; 