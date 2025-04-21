/**
 * CiderDeck Playback Controls
 * Handles playback-related functionality: play/pause, skip, repeat, shuffle, etc.
 */

// Create module-specific loggers
const logger = window.CiderDeckLogger?.createLogger('Playback') || {
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
const repeatLogger = logger.category('Repeat');
const shuffleLogger = logger.category('Shuffle');
const artworkLogger = window.CiderDeckLogger?.createLogger('Artwork') || logger;

// Debounce function for logging
const debounce = (func, wait) => {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

// Debounced version of the logger.info method (200ms)
const debouncedPlaybackInfo = debounce(logger.info.bind(logger), 200);

// Playback state tracking
let currentRepeatMode = 0; // 0: off, 1: repeat one, 2: repeat all, 3: disabled
let currentShuffleMode = 0; // 0: off, 1: on, 2: disabled

/**
 * Sets default playback states for all controls
 */
async function setDefaults() {
    logger.debug("Setting default state");
    Object.keys(window.actions || {}).forEach(actionKey => {
        window.contexts[actionKey]?.forEach(context => {
            if (actionKey === 'ciderPlaybackAction') {
                const feedbackPayload = {
                    "icon1": "actions/assets/buttons/media-playlist",
                    "icon2": "actions/assets/buttons/volume-off",
                    "title": "Cider - N/A",
                };
                $SD.setFeedback(context, feedbackPayload);
                logger.info("Set default feedback for Cider Playback Action");
            } else {
                $SD.setState(context, 0);
            }
        });
    });
}

/**
 * Updates library and favorite states based on current playback
 * @param {Object} data - The playback data containing library and favorites status
 */
async function setAdaptiveData({ inLibrary, inFavorites }) {
    const libraryLogger = window.CiderDeckLogger?.createLogger('Library') || logger;
    const favoritesLogger = window.CiderDeckLogger?.createLogger('Favorites') || logger;
    
    libraryLogger.debug(`inLibrary: ${inLibrary}, inFavorites: ${inFavorites}`);
    
    const cacheManager = window.cacheManager;
    
    // Skip if cache manager is not available
    if (!cacheManager) {
        libraryLogger.warn("Cache manager not available");
        return;
    }
    
    if (cacheManager.checkAndUpdate('addedToLibrary', inLibrary)) {
        window.contexts.addToLibraryAction?.forEach(context => {
            $SD.setState(context, inLibrary ? 1 : 0);
        });
        libraryLogger.debug(`Updated library status: ${inLibrary}`);
    }

    if (cacheManager.checkAndUpdate('rating', inFavorites ? 1 : 0)) {
        window.contexts.likeAction?.forEach(context => {
            $SD.setState(context, inFavorites ? 1 : 0);
        });
        window.contexts.dislikeAction?.forEach(context => {
            $SD.setState(context, 0); // Always set to default state for dislike
        });
        favoritesLogger.debug(`Updated favorites status: ${inFavorites}`);
    }
}

/**
 * Updates display data based on current playback state
 * @param {Object} data - The playback data
 */
async function setData({ state, attributes }) {
    setPlaybackStatus(state);

    const cacheManager = window.cacheManager;
    if (!cacheManager) {
        logger.error("Cache manager is not available");
        return;
    }

    let artwork = cacheManager.get('artwork');

    if (attributes?.artwork) {
        artwork = attributes.artwork?.url?.replace('{w}', attributes?.artwork?.width).replace('{h}', attributes?.artwork?.height);
    }

    const songName = attributes.name;
    const artistName = attributes.artistName;
    const albumName = attributes.albumName;

    debouncedPlaybackInfo(`Processing: "${songName}" by ${artistName} from ${albumName}`);
    logger.debug(`Artwork URL: ${artwork}`);
    
    let logMessage = "[DEBUG] [Playback] ";
    
    if (cacheManager.checkAndUpdate('artwork', artwork) && artwork) {
        artworkLogger.debug(`Updating artwork from: ${artwork}`);
        const utils = window.CiderDeckUtils;
        if (utils && utils.getBase64Image) {
            utils.getBase64Image(artwork).then(art64 => {
                artworkLogger.debug(`Successfully converted artwork to base64`);
                window.contexts.albumArtAction?.forEach(context => {
                    artworkLogger.debug(`Setting album art for context: ${context}`);
                    if (utils.setImage) {
                        utils.setImage(context, art64, 0);
                    } else {
                        $SD.setImage(context, art64, 0);
                    }
                });
                if (window.contexts.ciderPlaybackAction && window.contexts.ciderPlaybackAction[0]) {
                    // Check if user wants to show artwork on dial or use default Cider logo
                    const showArtworkOnDial = window.ciderDeckSettings?.dial?.showArtworkOnDial ?? true;
                    const dialLogger = logger.category('Dial');
                    dialLogger.debug(`Show artwork on dial: ${showArtworkOnDial}`);
                    if (showArtworkOnDial) {
                        $SD.setFeedback(window.contexts.ciderPlaybackAction[0], { "icon1": art64 });
                        dialLogger.debug(`Set artwork on dial`);
                    } else {
                        // Use Cider logo instead
                        $SD.setFeedback(window.contexts.ciderPlaybackAction[0], { "icon1": "actions/assets/buttons/media-playlist" });
                        dialLogger.debug(`Set Cider logo on dial`);
                    }
                }
            }).catch(err => {
                artworkLogger.error(`Failed to get base64 image: ${err}`);
            });
            logMessage += `Updated artwork: ${artwork}; `;
        }
    }
    
    if (cacheManager.checkAndUpdate('song', songName)) {
        // Get dial and song display settings
        const dialSettings = window.ciderDeckSettings?.dial || {};
        
        // Format title according to custom format if available
        const songInfo = {
            title: songName,
            artist: artistName,
            album: albumName
        };
        
        // Format the text using the custom format from dial settings (or fallback to default)
        const customFormat = dialSettings.customFormat || '{song} - {album}';
        const textPrefix = dialSettings.textPrefix || '';
        const fullTitle = textPrefix + formatSongInfo(customFormat, songInfo);
        
        // Initialize the song renderer if it hasn't been yet
        if (!window.songDisplayRenderer) {
            const songDisplayLogger = logger.category('SongDisplay');
            songDisplayLogger.debug('Initializing song display renderer on data update');
            try {
                window.songDisplayRenderer = new SongDisplayRenderer();
            } catch (err) {
                songDisplayLogger.error(`Failed to initialize renderer: ${err}`);
            }
        }
        
        // Update song info in the custom renderer
        if (window.songDisplayRenderer) {
            try {
                window.songDisplayRenderer.updateSongInfo({
                    title: songName,
                    artist: artistName,
                    album: albumName
                });
            } catch (err) {
                const songDisplayLogger = logger.category('SongDisplay');
                songDisplayLogger.error(`Failed to update song info: ${err}`);
            }
        }
        
        // Handle Stream Deck+ marquee display
        const marquee = window.CiderDeckMarquee;
        if (marquee && marquee.clearMarquee) {
            const marqueeLogger = logger.category('Marquee');
            marqueeLogger.debug('Clearing current marquee display');
            
            marquee.clearMarquee();
            const marqueeSettings = window.ciderDeckSettings?.dial?.marquee || {};
            const isMarqueeEnabled = marqueeSettings.enabled ?? true;
            const displayLength = marqueeSettings.length ?? 15;
            
            marqueeLogger.debug(`Marquee enabled: ${isMarqueeEnabled}, Title length: ${fullTitle.length}, Display length: ${displayLength}`);
            
            if (isMarqueeEnabled && fullTitle.length > displayLength && 
                window.contexts.ciderPlaybackAction && window.contexts.ciderPlaybackAction[0]) {
                const allContexts = [window.contexts.ciderPlaybackAction[0]];
                marqueeLogger.debug(`Starting marquee with text: "${fullTitle}"`);
                marquee.startMarquee(allContexts, fullTitle);
            } else if (window.contexts.ciderPlaybackAction && window.contexts.ciderPlaybackAction[0]) {
                marqueeLogger.debug(`Setting static title: "${fullTitle}"`);
                $SD.setFeedback(window.contexts.ciderPlaybackAction[0], { "title": fullTitle });
            }
        }
        
        // Update custom rendered song display for regular Stream Deck
        const songDisplay = window.CiderDeckSongDisplay;
        if (songDisplay && songDisplay.updateCustomSongDisplay) {
            try {
                const songDisplayLogger = logger.category('SongDisplay');
                songDisplayLogger.debug('Updating custom song display');
                songDisplay.updateCustomSongDisplay();
            } catch (err) {
                const songDisplayLogger = logger.category('SongDisplay');
                songDisplayLogger.error(`Failed to update custom display: ${err}`);
            }
        }
        
        logMessage += `Updated song: ${songName}; Artist: ${artistName}; Album: ${albumName}; `;
    }

    const toggleIcon = state === "playing" ? 'pause.png' : 'play.png';

    window.contexts.toggleAction?.forEach(context => {
        const utils = window.CiderDeckUtils;
        if (utils && utils.setImage) {
            utils.setImage(context, `actions/playback/assets/${toggleIcon}`, 0);
        } else {
            $SD.setImage(context, `actions/playback/assets/${toggleIcon}`, 0);
        }
    });
    logMessage += `State: ${state === "playing" ? "playing" : "paused"}`;

    // Use our colorful logger instead of standard console.debug
    logger.debug(logMessage);
}

/**
 * Updates playback data from the full playback info object
 * @param {Object} playbackInfo - The full playback info from Cider
 */
async function setManualData(playbackInfo) {
    setData({ state: playbackInfo.state, attributes: playbackInfo });
}

/**
 * Updates playback status (playing/paused) on Stream Deck buttons
 * @param {string|number} status - The current playback status
 */
async function setPlaybackStatus(status) {
    // Convert string status to numeric value if needed
    if (typeof status === 'string') {
        status = status === 'playing' ? 1 : 0;
    }
    
    const cacheManager = window.cacheManager;
    if (!cacheManager) {
        logger.warn("Cache manager not available, setting status directly");
        window.contexts.toggleAction?.forEach(context => {
            $SD.setState(context, status ? 1 : 0);
        });
        return;
    }
    
    if (cacheManager.checkAndUpdate('status', status)) {
        window.contexts.toggleAction?.forEach(context => {
            $SD.setState(context, status ? 1 : 0);
        });
        logger.debug(`Updated playback status: ${status ? "playing" : "paused"}`);
    }
}

/**
 * Updates repeat mode and corresponding button state
 * @param {number} mode - The repeat mode (0: off, 1: repeat one, 2: repeat all, 3: disabled)
 */
function updateRepeatMode(mode) {
    currentRepeatMode = mode;
    repeatLogger.debug(`Updated repeat mode to: ${currentRepeatMode}`);
    
    window.contexts.repeatAction?.forEach(context => {
        $SD.setState(context, currentRepeatMode);
    });
}

/**
 * Updates shuffle mode and corresponding button state
 * @param {number} mode - The shuffle mode (0: off, 1: on, 2: disabled)
 */
function updateShuffleMode(mode) {
    currentShuffleMode = mode;
    shuffleLogger.debug(`Updated shuffle mode to: ${currentShuffleMode}`);
    
    window.contexts.shuffleAction?.forEach(context => {
        $SD.setState(context, currentShuffleMode);
    });
}

/**
 * Handles "previous track" behavior based on settings and current playback time
 */
async function goBack() {
    // Check the setting that determines if we should always go to the previous track
    const alwaysGoToPrevious = window.ciderDeckSettings?.playback?.alwaysGoToPrevious ?? false;
    const utils = window.CiderDeckUtils;
    
    if (!utils || !utils.comRPC) {
        logger.error("CiderDeckUtils not available for comRPC");
        return;
    }
    
    if (alwaysGoToPrevious) {
        // If the setting is enabled, always go to the previous track
        logger.debug("Always go to previous track setting enabled, going to previous track");
        await utils.comRPC("POST", "previous");
    } else {
        // Otherwise, use the default behavior:
        // If within the first 10 seconds of the track, seek to the start
        // If later in the track, go to the previous track
        if (window.currentPlaybackTime > 10) {
            logger.debug("Going to previous track");
            await utils.comRPC("POST", "previous");
        } else {
            logger.debug("Seeking to start of current track");
            await utils.comRPC("POST", "seek", true, { position: 0 });
        }
    }
}

/**
 * Updates repeat and shuffle modes from current Cider state
 */
async function updatePlaybackModes() {
    try {
        const utils = window.CiderDeckUtils;
        if (!utils || !utils.comRPC) {
            logger.error("CiderDeckUtils not available for comRPC");
            return;
        }
        
        const repeatMode = await utils.comRPC("GET", "repeat-mode");
        if (repeatMode && repeatMode.status === "ok" && repeatMode.value !== undefined) {
            updateRepeatMode(repeatMode.value);
        }
        
        const shuffleMode = await utils.comRPC("GET", "shuffle-mode");
        if (shuffleMode && shuffleMode.status === "ok" && shuffleMode.value !== undefined) {
            updateShuffleMode(shuffleMode.value);
        }
    } catch (error) {
        logger.error(`Error updating playback modes: ${error}`);
    }
}

/**
 * Formats song information according to a template
 * Supports variables: {song}, {artist}, {album}, {duration}
 * @param {string} template - The format template
 * @param {Object} songInfo - Object containing song details
 * @returns {string} Formatted text
 */
function formatSongInfo(template, songInfo) {
    const formatLogger = logger.category('Format');
    
    // If no custom format is provided, use a default format
    if (!template || template === '') {
        formatLogger.debug("No template provided, using default format");
        return `${songInfo.title || ''} - ${songInfo.album || ''}`;
    }
    
    formatLogger.debug(`Formatting with template: "${template}"`);
    
    // Apply variable replacements
    let formattedText = template
        .replace(/\{song\}/gi, songInfo.title || '')
        .replace(/\{artist\}/gi, songInfo.artist || '')
        .replace(/\{album\}/gi, songInfo.album || '')
        .replace(/\{duration\}/gi, songInfo.duration || '');
    
    formatLogger.debug(`Formatted result: "${formattedText}"`);
    return formattedText;
}

/**
 * Updates playback time indicator on Stream Deck+
 * @param {number} time - Current playback time in seconds
 * @param {number} duration - Total track duration in seconds
 */
async function setPlaybackTime(time, duration) {
    const cacheManager = window.cacheManager;
    if (cacheManager) {
        cacheManager.set('currentPlaybackTime', time);
    }
    window.currentPlaybackTime = time; // Backup in case cacheManager isn't available
    
    const progress = Math.round((time / duration) * 100);
    
    // Create a specialized logger for playback time
    const timeLogger = logger.category('Time');
    timeLogger.debug(`Current time: ${time}s, Duration: ${duration}s, Progress: ${progress}%`);

    // Update Stream Deck+ display if available
    if (window.contexts.ciderPlaybackAction && window.contexts.ciderPlaybackAction[0]) {
        const feedbackPayload = {
            "indicator1": progress
        };
        $SD.setFeedback(window.contexts.ciderPlaybackAction[0], feedbackPayload);
    }
}

// Export the playback functions
window.CiderDeckPlayback = {
    setDefaults,
    setAdaptiveData,
    setData,
    setManualData,
    setPlaybackStatus,
    updateRepeatMode,
    updateShuffleMode,
    goBack,
    updatePlaybackModes,
    setPlaybackTime,
    formatSongInfo,
    getCurrentRepeatMode: () => currentRepeatMode,
    getCurrentShuffleMode: () => currentShuffleMode,
    setCurrentRepeatMode: (mode) => { currentRepeatMode = mode; },
    setCurrentShuffleMode: (mode) => { currentShuffleMode = mode; }
};
