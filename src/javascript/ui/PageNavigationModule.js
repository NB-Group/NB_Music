const UIModule = require('./UIModule');

/**
 * 页面导航模块
 * 处理应用内不同页面之间的导航和过渡
 */
class PageNavigationModule extends UIModule {
    /**
     * @param {Object} uiManager - 父级UI管理器
     */
    constructor(uiManager) {
        super(uiManager);
    }

    /**
     * 初始化页面导航功能
     */
    initialize() {
        this.initializePageEvents();
        this.initializeNavEffects();
        
        // 初始化焦点指示器位置
        setTimeout(() => {
            const list = document.querySelector("#function-list");
            if (!list) return;
            
            const activeItem = list.querySelector("a.check");
            if (!activeItem) return;
            
            const spanFocs = list.querySelector("span.focs");
            if (!spanFocs) return;
            
            const parentLi = activeItem.closest("li");
            const itemTop = parentLi.offsetTop;
            const itemHeight = parentLi.offsetHeight;
            
            spanFocs.style.top = (itemTop + (itemHeight / 2) - 10) + "px";
            spanFocs.style.left = "0px";
            spanFocs.style.display = "block";
        }, 100);
    }

    /**
     * 初始化页面切换事件
     */
    initializePageEvents() {
        // 获取所有可点击导航元素
        const navElements = document.querySelectorAll("[data-page]");

        navElements.forEach((element) => {
            element.addEventListener("click", (e) => {
                e.preventDefault();
                this.show(element.dataset.page);
            });
        });
    }

    /**
     * 初始化导航交互效果
     */
    initializeNavEffects() {
        // 侧边栏点击事件
        document.addEventListener("click", (event) => {
            if (!event.target.closest(".sidebar") && !event.target.closest(".dock.sidebar")) {
                document.querySelector(".sidebar").classList.add("hide");
            }
        });

        document.querySelector(".sidebar").addEventListener("mouseover", () => {
            document.querySelector(".sidebar").classList.remove("hide");
        });

        // 列表焦点效果
        document.querySelectorAll("#function-list").forEach((list) => {
            list.addEventListener("click", (e) => {
                const clickedItem = e.target.closest("a");
                if (!clickedItem) return;

                const spanFocs = list.querySelector("span.focs");
                if (!spanFocs) return;

                // 移除之前的所有选中状态
                list.querySelectorAll("a").forEach((a) => a.classList.remove("check"));
                // 添加新的选中状态
                clickedItem.classList.add("check");

                // 显示焦点指示器
                spanFocs.style.display = "block";
                spanFocs.classList.add("moving");

                // 获取li元素而不是a元素进行计算
                const parentLi = clickedItem.closest("li");
                // 设置位置 - 计算位置相对于项目的顶部
                const itemTop = parentLi.offsetTop;
                const itemHeight = parentLi.offsetHeight;
                
                // 将焦点指示器放在项目中间
                spanFocs.style.top = (itemTop + (itemHeight / 2) - 10) + "px"; // 10是焦点指示器高度的一半
                spanFocs.style.left = "0px"; // 确保左侧位置固定

                setTimeout(() => {
                    spanFocs.classList.remove("moving");
                }, 500);
            });
        });

        // 初始化导航波纹效果
        this.initializeRippleEffect();
        
        // 初始化视图过渡效果
        this.initializeViewTransitions();
    }

    /**
     * 初始化导航波纹效果
     */
    initializeRippleEffect() {
        document.querySelectorAll('nav').forEach(nav => {
            // 生成唯一标识
            const navId = nav.dataset.navId || `nav-${Math.random().toString(36).slice(2, 6)}`;
            nav.dataset.navId = navId;

            nav.querySelectorAll('a').forEach(link => {
                // 添加波纹效果处理
                link.addEventListener('mousedown', function(e) {
                    // 创建波纹元素
                    const ripple = document.createElement('span');
                    ripple.classList.add('ripple-effect');
                    
                    // 计算最大尺寸
                    const size = Math.max(this.offsetWidth, this.offsetHeight);
                    ripple.style.width = ripple.style.height = `${size * 2}px`;
                    
                    // 定位波纹
                    const rect = this.getBoundingClientRect();
                    ripple.style.left = `${e.clientX - rect.left - size}px`;
                    ripple.style.top = `${e.clientY - rect.top - size}px`;
                    
                    // 添加波纹元素
                    this.appendChild(ripple);
                    
                    // 动画结束后移除
                    setTimeout(() => ripple.remove(), 600);
                });
            });
        });
    }

    /**
     * 初始化视图过渡效果
     */
    initializeViewTransitions() {
        document.querySelectorAll('nav').forEach(nav => {
            const navId = nav.dataset.navId || `nav-${Math.random().toString(36).slice(2, 6)}`;
            
            nav.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', async (e) => {
                    e.preventDefault();

                    // 检查浏览器是否支持 View Transitions API
                    if (!document.startViewTransition) {
                        console.warn('Browser does not support View Transitions API');
                        // 降级处理
                        const activeLink = nav.querySelector('.active');
                        activeLink?.classList.remove('active');
                        link.classList.add('active');
                        return;
                    }

                    // 避免重复点击
                    if (link.classList.contains('active')) return;

                    const activeLink = nav.querySelector('.active');

                    try {
                        // 设置动态 view-transition-name
                        if (activeLink) {
                            activeLink.style.viewTransitionName = `${navId}-old`;
                        }
                        link.style.viewTransitionName = `${navId}-new`;

                        const transition = document.startViewTransition(() => {
                            activeLink?.classList.remove('active');
                            link.classList.add('active');
                            
                            // 在导航变化时触发一个微妙的缩放动画
                            nav.style.transform = 'scale(0.98)';
                            setTimeout(() => {
                                nav.style.transform = 'scale(1)';
                            }, 150);
                        });

                        // 等待过渡完成
                        await transition.finished;
                    } catch (error) {
                        console.error('View transition failed:', error);
                    } finally {
                        // 清理 view-transition-name
                        if (activeLink) {
                            activeLink.style.viewTransitionName = '';
                        }
                        link.style.viewTransitionName = '';
                    }
                });
            });
        });
    }

    /**
     * 页面切换方法
     * @param {string} pageName - 目标页面的CSS选择器
     */
    show(pageName) {
        // 隐藏所有内容
        const contents = document.querySelectorAll(".content>div");
        contents.forEach((content) => content.classList.add("hide"));

        // 移除所有导航项的选中状态
        const navItems = document.querySelectorAll("#function-list li>a");
        navItems.forEach((item) => item.classList.remove("check"));

        // 显示目标内容
        const targetContent = document.querySelector(`.content ${pageName}`);
        if (targetContent) {
            targetContent.classList.remove("hide");
            
            // 如果切换到播放器页面，刷新歌词布局
            if (pageName === '.player' && this.audioPlayer && this.uiManager.lyricsPlayer) {
                // 延迟一点时间确保DOM已完全显示
                setTimeout(() => {
                    // 刷新布局并确保如果音乐在播放，动画会自动启动
                    this.uiManager.lyricsPlayer.refreshLayout();
                    
                    // 如果音频正在播放但动画没有运行，明确启动它
                    if (!this.audioPlayer.audio.paused && !this.uiManager.lyricsPlayer.animationFrame) {
                        this.uiManager.lyricsPlayer.start();
                    }
                }, 100);
            }
        }

        // 设置导航项选中状态
        const targetNav = document.querySelector(`#function-list li>a[data-page="${pageName}"]`);
        if (targetNav) {
            targetNav.classList.add("check");
        }
    }
}

module.exports = PageNavigationModule; 