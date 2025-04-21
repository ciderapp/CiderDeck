/**
 * CiderDeck Song Display
 * Handles custom song display rendering on Stream Deck buttons
 */

// Create module-specific logger
const songDisplayLogger = window.CiderDeckLogger?.createLogger('SongDisplay') || {
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
const songRendererLogger = songDisplayLogger.category('Renderer');
const settingsLogger = songDisplayLogger.category('Settings');
const songMarqueeLogger = songDisplayLogger.category('Marquee');

/**
 * Updates the custom rendered song display on Stream Deck keys
 */
function updateCustomSongDisplay() {
    songDisplayLogger.info("Starting custom song display update");
    
    if (!window.contexts || !window.contexts.songNameAction || window.contexts.songNameAction.length === 0) {
        songDisplayLogger.debug("No song name contexts available");
        return; // No song name action contexts available
    }
    
    songDisplayLogger.info(`Found ${window.contexts.songNameAction.length} song display contexts to update`);
    
    // Check if the renderer exists
    if (!window.songDisplayRenderer) {
        songDisplayLogger.error("Song display renderer is not initialized!");
        songDisplayLogger.info("Attempting to initialize song display renderer");
        try {
            window.songDisplayRenderer = new SongDisplayRenderer();
            songDisplayLogger.info("Successfully initialized song display renderer");
        } catch (err) {
            songDisplayLogger.error(`Failed to initialize renderer: ${err}`);
            return;
        }
    }
    
    const cacheManager = window.cacheManager;
    
    // Get settings for the renderer if available
    const globalSongDisplaySettings = window.ciderDeckSettings?.songDisplay || {};
    const localDisplaySettings = cacheManager ? cacheManager.get('songDisplaySettings') || {} : {};
    
    settingsLogger.info("Retrieving display settings");
    settingsLogger.debug(`Global settings: ${JSON.stringify(globalSongDisplaySettings)}`);
    settingsLogger.debug(`Local settings: ${JSON.stringify(localDisplaySettings)}`);
    
    // Merge global and local settings, giving priority to local settings
    const mergedSettings = {...globalSongDisplaySettings, ...localDisplaySettings};
    
    // Update renderer settings with merged settings
    if (Object.keys(mergedSettings).length > 0) {
        settingsLogger.info("Applying merged settings to renderer");
        settingsLogger.debug(`Merged settings: ${JSON.stringify(mergedSettings)}`);
        try {
            window.songDisplayRenderer.updateSettings(mergedSettings);
            settingsLogger.info("Successfully applied settings to renderer");
        } catch (err) {
            settingsLogger.error(`Failed to update settings: ${err}`);
        }
    }
    
    // Stop any existing animation
    try {
        songMarqueeLogger.info("Stopping any existing marquee animation");
        window.songDisplayRenderer.stopMarqueeAnimation();
    } catch (err) {
        songMarqueeLogger.error(`Failed to stop marquee animation: ${err}`);
    }
    
    songDisplayLogger.info(`Marquee enabled: ${window.songDisplayRenderer.settings?.marqueeEnabled}`);
      // Generate an initial static image to show while starting the animation
    let initialImage;
    try {
        songRendererLogger.info("Generating initial static image");
        initialImage = window.songDisplayRenderer.renderImage();
        songRendererLogger.info("Initial image generation successful");
    } catch (err) {
        songRendererLogger.error(`Failed to render image: ${err}`);
    }
    
    if (initialImage) {
        songDisplayLogger.info("Setting initial image on all contexts");
        window.contexts.songNameAction.forEach(context => {
            songDisplayLogger.debug(`Setting initial image on context: ${context}`);
            const utils = window.CiderDeckUtils;
            if (utils && utils.setImage) {
                utils.setImage(context, initialImage, 0);
            } else {
                $SD.setImage(context, initialImage, 0);
            }
        });
    }
    
    // If marquee is enabled and we have text that might need scrolling
    if (window.songDisplayRenderer.settings?.marqueeEnabled) {
        songMarqueeLogger.info("Marquee animation is enabled, preparing to start");
        
        // Give a short delay before starting the animation to ensure the UI is ready
        setTimeout(() => {
            songMarqueeLogger.info("Starting marquee animation after delay");
            try {
                window.songDisplayRenderer.startMarqueeAnimation((imageData) => {
                    if (!imageData) {
                        songMarqueeLogger.error("Failed to generate marquee image");
                        return;
                    }
                    
                    songMarqueeLogger.debug("Received new marquee image frame");
                    
                    // Update all song name contexts with the rendered image
                    window.contexts.songNameAction.forEach(context => {
                        const utils = window.CiderDeckUtils;
                        if (utils && utils.setImage) {
                            utils.setImage(context, imageData, 0);
                        } else {
                            $SD.setImage(context, imageData, 0);
                        }
                    });
                });
                songMarqueeLogger.info("Marquee animation started successfully");
            } catch (err) {
                songMarqueeLogger.error(`Failed to start marquee animation: ${err}`);
            }
        }, 100);
    } else {
        songDisplayLogger.info("Marquee animation is disabled, using static display");
    }
}

// Export the song display functions
window.CiderDeckSongDisplay = {
    updateCustomSongDisplay
};
