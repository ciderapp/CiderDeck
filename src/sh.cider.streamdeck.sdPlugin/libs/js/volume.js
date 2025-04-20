/**
 * CiderDeck Volume Controls
 * Handles volume adjustment and mute/unmute functionality
 */

// Create module-specific logger
const volumeLogger = window.CiderDeckLogger?.createLogger('Volume') || {
    info: console.log,
    debug: console.debug,
    warn: console.warn,
    error: console.error,
    category: () => ({
        info: console.log,
        debug: console.debug,
        warn: console.warn,
        error: console.error
    })
};

// Create subcategory loggers
const muteLogger = volumeLogger.category('Mute');
const sliderLogger = volumeLogger.category('Slider');

// Volume state tracking
let isChangingVolume = false;
let isMuted = false;
let previousVolume;

/**
 * Handles volume changes from both buttons and dials
 * @param {Object} action - The action object
 * @param {string} context - The Stream Deck context
 * @param {string} direction - Direction of change ('up', 'down', 'mute')
 * @param {Object} payload - Additional payload (for dial rotations)
 */
async function handleVolumeChange(action, context, direction, payload) {
    if (isChangingVolume) return;
    isChangingVolume = true;

    try {
        let { volume: currentVolume } = await window.CiderDeckUtils.comRPC("GET", "volume");
        let currentVolumePercent = Math.round(currentVolume * 100);

        // Get volume step from the hierarchical settings structure
        const volumeStep = window.ciderDeckSettings?.dial?.volumeStep ?? 1;

        let newVolume;

        if (isMuted && direction !== 'mute') {
            isMuted = false;
            newVolume = previousVolume;
        } else if (direction === 'mute') {
            isMuted = !isMuted;
            previousVolume = currentVolume;
            newVolume = isMuted ? 0 : previousVolume;
        } else if (direction === 'up' || direction === 'down') {
            newVolume = direction === 'up' 
                ? Math.min(currentVolume + volumeStep / 100, 1) 
                : Math.max(currentVolume - volumeStep / 100, 0);
        } else if (payload && payload.ticks !== undefined) {
            newVolume = Math.max(0, Math.min(1, currentVolume + (payload.ticks * volumeStep / 100)));
        }

        if (newVolume !== undefined) {
            let newVolumePercent = Math.round(newVolume * 100);
            
            if (Math.abs(newVolumePercent - currentVolumePercent) < volumeStep / 2) {
                return;
            }

            await window.CiderDeckUtils.comRPC("POST", "volume", true, { volume: newVolume });
            
            if (direction === 'mute') {
                muteLogger.info(`Volume ${isMuted ? 'muted' : 'unmuted'}`);
            } else {
                volumeLogger.debug(`Volume changed to ${newVolumePercent}%`);
            }
            
            updateVolumeDisplay(context, newVolume);
        }
    } catch (error) {
        volumeLogger.error(`Error changing volume: ${error}`);
    } finally {
        isChangingVolume = false;
    }
}

/**
 * Updates the volume display on Stream Deck+
 * @param {string} context - The Stream Deck context
 * @param {number} volume - Current volume (0-1)
 */
function updateVolumeDisplay(context, volume) {
    const volumePercentage = Math.round(volume * 100);
    sliderLogger.debug(`Updating volume display to ${volumePercentage}%`);
    
    // Determine the appropriate icon based on volume level
    let iconName;
    if (volumePercentage === 0) {
        iconName = "volume-off";
    } else if (volumePercentage <= 50) {
        iconName = "volume-down-1";
    } else {
        iconName = "volume-up-1";
    }
    
    sliderLogger.debug(`Using icon: ${iconName}`);
    
    const feedbackPayload = {
        "indicator2": volumePercentage,
        "icon2": `actions/assets/buttons/${iconName}`
    };
    $SD.setFeedback(context, feedbackPayload);
}

/**
 * Initializes the volume display on Stream Deck+
 * @param {Object} action - The action object
 * @param {string} context - The Stream Deck context
 */
async function initializeVolumeDisplay(action, context) {
    try {
        const { volume: currentVolume } = await window.CiderDeckUtils.comRPC("GET", "volume");
        updateVolumeDisplay(context, currentVolume);
        console.debug("[DEBUG] [Volume] Display initialized with volume:", Math.round(currentVolume * 100));
    } catch (error) {
        console.info("Error initializing volume display:", error);
    }
}

/**
 * Resets volume control state
 */
function resetVolumeState() {
    isChangingVolume = false;
    isMuted = false;
    previousVolume = null;
}

// Export the volume control functions
window.CiderDeckVolume = {
    handleVolumeChange,
    updateVolumeDisplay,
    initializeVolumeDisplay,
    resetVolumeState,
    isMuted: () => isMuted
};
