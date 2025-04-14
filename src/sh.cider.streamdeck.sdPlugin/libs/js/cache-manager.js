/**
 * Cache Manager for CiderDeck
 * 
 * Provides a centralized cache management system for the application
 * to avoid using direct window object properties.
 */

class CacheManager {
    constructor() {
        // Initialize cache store
        this.cache = {
            artwork: null,
            song: null,
            status: null,
            addedToLibrary: null,
            rating: null,
            currentPlaybackTime: null
        };
    }

    /**
     * Get a cached value
     * @param {string} key - The cache key
     * @returns {any} The cached value or null
     */
    get(key) {
        return this.cache[key] ?? null;
    }

    /**
     * Set a cached value
     * @param {string} key - The cache key
     * @param {any} value - The value to cache
     * @returns {boolean} True if the value changed, false if it's the same
     */
    set(key, value) {
        if (!this.hasKey(key)) {
            console.warn(`[WARN] [Cache] Unknown cache key: ${key}`);
            return false;
        }

        // Return false if the value hasn't changed (helps prevent unnecessary updates)
        if (this.cache[key] === value) {
            return false;
        }

        this.cache[key] = value;
        return true;
    }

    /**
     * Check if a value has changed and update it if it has
     * @param {string} key - The cache key
     * @param {any} value - The new value to check and potentially set
     * @returns {boolean} True if the value was updated, false if unchanged
     */
    checkAndUpdate(key, value) {
        if (this.get(key) !== value) {
            this.set(key, value);
            return true;
        }
        return false;
    }

    /**
     * Check if the cache has a specific key
     * @param {string} key - The key to check
     * @returns {boolean} True if the key exists
     */
    hasKey(key) {
        return key in this.cache;
    }

    /**
     * Clear all cached data
     */
    clearAll() {
        Object.keys(this.cache).forEach(key => {
            this.cache[key] = null;
        });
        console.log("[INFO] [Cache] Cleared all cached data");
    }
}

// Create a singleton instance
const cacheManager = new CacheManager();
