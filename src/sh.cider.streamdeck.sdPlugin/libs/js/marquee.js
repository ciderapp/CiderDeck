/**
 * CiderDeck Marquee Functions
 * Handles scrolling text on Stream Deck+ displays
 */

// Create module-specific logger
const logger = window.CiderDeckLogger?.createLogger('Marquee') || {
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

// Marquee state
let marqueeInterval = null;
let marqueePosition = 0;
let currentMarqueeText = '';
let isScrolling = false;
let lastMarqueeUpdateTime = 0;
const MARQUEE_STEP = 1;

/**
 * Clears any active marquee animation
 */
function clearMarquee() {
    if (marqueeInterval) {
        logger.debug("Clearing active marquee animation");
        clearInterval(marqueeInterval);
        marqueeInterval = null;
    }
    marqueePosition = 0;
    currentMarqueeText = '';
    isScrolling = false;
    lastMarqueeUpdateTime = 0;
    logger.debug("Marquee state reset");
}

/**
 * Starts a marquee animation for text
 * @param {Array} contexts - Array of Stream Deck context IDs
 * @param {string} text - Text to scroll
 */
function startMarquee(contexts, text) {
    logger.info(`Starting marquee for text: "${text}"`);
    clearMarquee();
    currentMarqueeText = text;
  
    // Get marquee settings from the hierarchical structure
    const marqueeSettings = window.ciderDeckSettings?.dial?.marquee || {};
    const marqueeSpeed = marqueeSettings.speed ?? 200;
    const pauseDuration = marqueeSettings.delay ?? 2000;
    
    logger.debug(`Using settings - Speed: ${marqueeSpeed}ms, Delay: ${pauseDuration}ms`);
  
    // Update display for all contexts
    updateMarqueeForAllContexts(contexts);
    
    logger.debug("Initial marquee display set, scheduling scroll");
  
    setTimeout(() => {
        logger.debug("Beginning scrolling phase of marquee");
        isScrolling = true;
        marqueeInterval = setInterval(() => {
            const currentTime = Date.now();
            if (isScrolling && (currentTime - lastMarqueeUpdateTime) >= marqueeSpeed) {
                marqueePosition += MARQUEE_STEP;
                updateMarqueeForAllContexts(contexts);
                lastMarqueeUpdateTime = currentTime;
            }
        }, Math.max(marqueeSpeed / 2, 16)); // Run the interval more frequently, but update based on time
    }, pauseDuration);
}

/**
 * Updates marquee display for all provided contexts
 * @param {Array} contexts - Array of Stream Deck context IDs
 */
function updateMarqueeForAllContexts(contexts) {
    logger.debug(`Updating marquee for ${contexts.length} contexts`);
    contexts.forEach(context => updateMarqueeDisplay(context));
}

/**
 * Updates the marquee display for a specific context
 * @param {string} context - Stream Deck context ID
 */
function updateMarqueeDisplay(context) {
    const totalTextLength = currentMarqueeText.length;
  
    // Get display length from settings
    const marqueeSettings = window.ciderDeckSettings?.dial?.marquee || {};
    const displayLength = marqueeSettings.length ?? 15;
    
    logger.debug(`Updating marquee display for context: ${context} (text length: ${totalTextLength}, display length: ${displayLength})`);
  
    // For continuous scrolling, we need to handle wrapping properly
    if (totalTextLength > displayLength) {
        // Create a continuous scrolling effect by appending the beginning of text to the end
        const paddedText = currentMarqueeText + " - " + currentMarqueeText.substring(0, displayLength);
    
        // Reset position if it exceeds the original text length (plus the separator)
        if (marqueePosition >= totalTextLength + 3) {
            marqueePosition = 0;
            logger.debug("Marquee position reset to beginning");
            // No need to pause here for continuous scrolling
        }
    
        let visibleText = paddedText.substring(marqueePosition, marqueePosition + displayLength);
        logger.debug(`Setting visible text: "${visibleText}"`);
    
        $SD.setFeedback(context, { "title": visibleText });
    } else {
        // If text is shorter than display length, just center it
        logger.debug(`Text fits display, no scrolling needed: "${currentMarqueeText}"`);
        $SD.setFeedback(context, { "title": currentMarqueeText });
    }
}

// Export the marquee functions
window.CiderDeckMarquee = {
    clearMarquee,
    startMarquee,
    updateMarqueeForAllContexts,
    updateMarqueeDisplay
};
