class CacheManager {
    constructor() {
        this.cachePrefix = "nbmusic_cache_";
    }

    cacheItem(key, data) {
        try {
            localStorage.setItem(this.cachePrefix + key, JSON.stringify(data));
        } catch (e) {
            console.error("缓存失败:", e);
        }
    }

    getCachedItem(key) {
        try {
            const item = localStorage.getItem(this.cachePrefix + key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error("读取缓存失败:", e);
            return null;
        }
    }

    clearCache() {
        Object.keys(localStorage).forEach(key => {
            if(key.startsWith(this.cachePrefix)) {
                localStorage.removeItem(key);
            }
        });
    }
}

module.exports = CacheManager;