/**
 * CiderDeck Logger
 * Provides colorful, consistent logging across all CiderDeck modules
 */

// Define color schemes for different modules and log types
const LOG_STYLES = {
    // Core systems
    System: {
        color: '#4287f5',
        emoji: '🖥️'
    },
    Settings: {
        color: '#42b883',
        emoji: '⚙️'
    },
    Cache: {
        color: '#9c42f5',
        emoji: '💾'
    },
    Socket: {
        color: '#42f5d1',
        emoji: '🔌'
    },
    
    // Playback controls
    Playback: {
        color: '#f54242',
        emoji: '▶️'
    },
    Repeat: {
        color: '#f542cb',
        emoji: '🔁'
    },
    Shuffle: {
        color: '#8f42f5',
        emoji: '🔀'
    },
    Previous: {
        color: '#42a4f5',
        emoji: '⏮️'
    },
    Skip: {
        color: '#42a4f5',
        emoji: '⏭️'
    },
    
    // Media features
    Artwork: {
        color: '#f5a742',
        emoji: '🖼️'
    },
    SongDisplay: {
        color: '#da42f5',
        emoji: '🎵'
    },
    Marquee: {
        color: '#f5429e',
        emoji: '📜'
    },
    
    // Button actions
    Action: {
        color: '#42f550',
        emoji: '🎮'
    },
    Context: {
        color: '#42f5e3',
        emoji: '🔄'
    },
    
    // Library features
    Library: {
        color: '#f56642',
        emoji: '📚'
    },
    Favorites: {
        color: '#f5d742',
        emoji: '⭐'
    },
    Rating: {
        color: '#f57542',
        emoji: '👍'
    },
    
    // Hardware features
    Dial: {
        color: '#427af5',
        emoji: '🎛️'
    },
    Volume: {
        color: '#42f59e',
        emoji: '🔊'
    },
    
    // Default style
    Default: {
        color: '#7a7a7a',
        emoji: 'ℹ️'
    },
    
    // Error levels
    INFO: {
        prefix: 'INFO',
        style: 'color: white; background-color: #42b883; padding: 2px 4px; border-radius: 2px;'
    },
    DEBUG: {
        prefix: 'DEBUG',
        style: 'color: white; background-color: #427af5; padding: 2px 4px; border-radius: 2px;'
    },
    WARN: {
        prefix: 'WARN',
        style: 'color: white; background-color: #f59b42; padding: 2px 4px; border-radius: 2px;'
    },
    ERROR: {
        prefix: 'ERROR',
        style: 'color: white; background-color: #f54242; padding: 2px 4px; border-radius: 2px;'
    }
};

/**
 * Creates a logger instance for a specific module
 * @param {string} module - The module name to create a logger for
 * @returns {object} - A logger object with info, debug, warn, and error methods
 */
function createLogger(module) {
    // Get the style for this module, or use the default style
    const moduleStyle = LOG_STYLES[module] || LOG_STYLES.Default;
    
    return {
        /**
         * Log an info-level message
         * @param {...any} args - Arguments to log
         */
        info: function(...args) {
            const style = LOG_STYLES.INFO.style;
            const moduleColor = `color: ${moduleStyle.color}; font-weight: bold;`;
            console.log(
                `%c${LOG_STYLES.INFO.prefix}%c ${moduleStyle.emoji} [%c${module}%c]`,
                style, 'color: #7a7a7a;', moduleColor, 'color: #7a7a7a;',
                ...args
            );
        },
        
        /**
         * Log a debug-level message
         * @param {...any} args - Arguments to log
         */
        debug: function(...args) {
            const style = LOG_STYLES.DEBUG.style;
            const moduleColor = `color: ${moduleStyle.color}; font-weight: bold;`;
            console.debug(
                `%c${LOG_STYLES.DEBUG.prefix}%c ${moduleStyle.emoji} [%c${module}%c]`,
                style, 'color: #7a7a7a;', moduleColor, 'color: #7a7a7a;',
                ...args
            );
        },
        
        /**
         * Log a warning-level message
         * @param {...any} args - Arguments to log
         */
        warn: function(...args) {
            const style = LOG_STYLES.WARN.style;
            const moduleColor = `color: ${moduleStyle.color}; font-weight: bold;`;
            console.warn(
                `%c${LOG_STYLES.WARN.prefix}%c ${moduleStyle.emoji} [%c${module}%c]`,
                style, 'color: #7a7a7a;', moduleColor, 'color: #7a7a7a;',
                ...args
            );
        },
        
        /**
         * Log an error-level message
         * @param {...any} args - Arguments to log
         */
        error: function(...args) {
            const style = LOG_STYLES.ERROR.style;
            const moduleColor = `color: ${moduleStyle.color}; font-weight: bold;`;
            console.error(
                `%c${LOG_STYLES.ERROR.prefix}%c ${moduleStyle.emoji} [%c${module}%c]`,
                style, 'color: #7a7a7a;', moduleColor, 'color: #7a7a7a;',
                ...args
            );
        },

        /**
         * Create a sub-logger for a specific category within this module
         * @param {string} category - The category name
         * @returns {object} - A new logger for the specified category
         */
        category: function(category) {
            return {
                info: (...args) => {
                    const style = LOG_STYLES.INFO.style;
                    const moduleColor = `color: ${moduleStyle.color}; font-weight: bold;`;
                    console.log(
                        `%c${LOG_STYLES.INFO.prefix}%c ${moduleStyle.emoji} [%c${module}%c] [${category}]`,
                        style, 'color: #7a7a7a;', moduleColor, 'color: #7a7a7a;',
                        ...args
                    );
                },
                debug: (...args) => {
                    const style = LOG_STYLES.DEBUG.style;
                    const moduleColor = `color: ${moduleStyle.color}; font-weight: bold;`;
                    console.debug(
                        `%c${LOG_STYLES.DEBUG.prefix}%c ${moduleStyle.emoji} [%c${module}%c] [${category}]`,
                        style, 'color: #7a7a7a;', moduleColor, 'color: #7a7a7a;',
                        ...args
                    );
                },
                warn: (...args) => {
                    const style = LOG_STYLES.WARN.style;
                    const moduleColor = `color: ${moduleStyle.color}; font-weight: bold;`;
                    console.warn(
                        `%c${LOG_STYLES.WARN.prefix}%c ${moduleStyle.emoji} [%c${module}%c] [${category}]`,
                        style, 'color: #7a7a7a;', moduleColor, 'color: #7a7a7a;',
                        ...args
                    );
                },
                error: (...args) => {
                    const style = LOG_STYLES.ERROR.style;
                    const moduleColor = `color: ${moduleStyle.color}; font-weight: bold;`;
                    console.error(
                        `%c${LOG_STYLES.ERROR.prefix}%c ${moduleStyle.emoji} [%c${module}%c] [${category}]`,
                        style, 'color: #7a7a7a;', moduleColor, 'color: #7a7a7a;',
                        ...args
                    );
                }
            };
        }
    };
}

// Export the logger factory
window.CiderDeckLogger = {
    createLogger
};
