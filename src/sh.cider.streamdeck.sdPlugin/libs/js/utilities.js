/**
 * CiderDeck Utilities
 * Common utility functions used throughout the CiderDeck plugin
 */

/**
 * Sets an image on a Stream Deck button
 * @param {string} action - The action context
 * @param {string} image - The image path or data URL
 * @param {number} context - The context index
 */
function setImage(action, image, context) {
    if (action && image && context !== null) $SD.setImage(action, image, context);
}

/**
 * Sets a title on a Stream Deck button
 * @param {string} action - The action context
 * @param {string} title - The title text
 * @param {number} context - The context index
 */
function setTitle(action, title, context) {
   if (action && title && context !== null) $SD.setTitle(action, title, context);
}

/**
 * Converts an image URL to a base64 data URL
 * @param {string} url - The image URL
 * @returns {Promise<string>} - A promise that resolves to the base64 data URL
 */
function getBase64Image(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            canvas.getContext('2d').drawImage(image, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = () => reject(new Error('Failed to load image'));
        image.src = url;
    });
}

/**
 * Helper function to deep merge objects
 * @param {Object} target - Target object to merge into
 * @param {Object} source - Source object to merge from
 * @returns {Object} - Merged object
 */
function deepMerge(target, source) {
    const result = {...target};
    
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    result[key] = source[key];
                } else {
                    result[key] = deepMerge(target[key], source[key]);
                }
            } else {
                result[key] = source[key];
            }
        });
    }
    
    return result;
}

/**
 * Helper function to check if a value is an object
 * @param {*} item - Value to check
 * @returns {boolean} - True if object
 */
function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Sends an API request to Cider
 * @param {string} method - HTTP method (GET, POST)
 * @param {string} request - API endpoint
 * @param {boolean} noCheck - Whether to suppress error logging
 * @param {Object} _body - Request body
 * @returns {Promise<Object>} - API response
 */
async function comRPC(method, request, noCheck, _body) {
    if (!window.token) {
        console.log("CiderDeck: Please enter your Cider authorization key in the plugin settings.");
        return;
    }

    if (!window.isConnected) {
        console.warn("[WARN] [comRPC] Attempted to make request while disconnected");
        return;
    }

    const fetchOptions = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'apptoken': window.token
        },
        body: method !== "GET" ? JSON.stringify(_body || {}) : undefined
    };
    try {
        const response = await fetch(`http://localhost:10767/api/v1/playback/${request}`, fetchOptions);
        return await response.json();
    } catch (error) {
        if (!noCheck) console.info("Request error:", error);
        throw error;
    }
}

// Export the utility functions
window.CiderDeckUtils = {
    setImage,
    setTitle,
    getBase64Image,
    deepMerge,
    isObject,
    comRPC
};
