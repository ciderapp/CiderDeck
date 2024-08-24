// ==========================================================================
//  Cider Stream Deck Plugin - Main Application
// ==========================================================================
//  This file contains the main logic for the Cider Stream Deck plugin.
//  It handles communication with the Stream Deck, manages actions,
//  and interacts with the Cider application.
// ==========================================================================

/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

// ==========================================================================
//  Global State
// ==========================================================================

const AppState = {
    STARTING_UP: 'starting_up',
    READY: 'ready',
    ERROR: 'error'
};

let currentAppState = AppState.STARTING_UP;
let isAuthenticated = false;

// ==========================================================================
//  Initialization and Setup
// ==========================================================================

$SD.onConnected(() => {
    console.debug('[DEBUG] [System] Stream Deck connected!');
    currentAppState = AppState.STARTING_UP;
    setDefaults();
    $SD.getGlobalSettings();
});

// Initialize actions and contexts
const actions = {
    toggleAction: new Action('sh.cider.streamdeck.toggle'),
    skipAction: new Action('sh.cider.streamdeck.skip'),
    previousAction: new Action('sh.cider.streamdeck.previous'),
    songNameAction: new Action('sh.cider.streamdeck.songname'),
    albumArtAction: new Action('sh.cider.streamdeck.albumart'),
    likeAction: new Action('sh.cider.streamdeck.like'),
    dislikeAction: new Action('sh.cider.streamdeck.dislike'),
    addToLibraryAction: new Action('sh.cider.streamdeck.addtolibrary'),
    volumeUpAction: new Action('sh.cider.streamdeck.volumeup'),
    volumeDownAction: new Action('sh.cider.streamdeck.volumedown'),
    ciderLogoAction: new Action('sh.cider.streamdeck.ciderlogo'),
    ciderPlaybackAction: new Action('sh.cider.streamdeck.playback')
};

// Global variables
let marqueeInterval, marqueePosition = 0, currentMarqueeText = '', isScrolling = false;
let MARQUEE_SPEED = 200, MARQUEE_STEP = 1, PAUSE_DURATION = 2000, DISPLAY_LENGTH = 15; lastMarqueeUpdateTime = 0;
let marqueeEnabled = true, tapBehavior = 'addToLibrary', volumeStep = 1, pressBehavior = 'togglePlay';
let useAdaptiveIcons = false, rpcKey = null;

// Ensure window.contexts is initialized
window.contexts = window.contexts || {};

// ==========================================================================
//  Context Management
// ==========================================================================

Object.keys(actions).forEach(actionKey => {
    if (!window.contexts[actionKey]) {
        window.contexts[actionKey] = [];
    }
    const action = actions[actionKey];

    action.onWillAppear(({ context }) => {
        if (!window.contexts[actionKey].includes(context)) {
            window.contexts[actionKey].push(context);
            console.debug(`[DEBUG] [Context] Context added for ${actionKey}: ${context}`);
        }
        if (currentAppState === AppState.READY) {
            if (actionKey === 'ciderPlaybackAction' || actionKey === 'albumArtAction' && currentAppState === AppState.READY) {
                initialize();
            }
        }
    });

    action.onWillDisappear(({ context }) => {
        const index = window.contexts[actionKey].indexOf(context);
        if (index > -1) {
            window.contexts[actionKey].splice(index, 1);
            console.debug(`[DEBUG] [Context] Context removed for ${actionKey}: ${context}`);
        }

        if (actionKey === 'ciderPlaybackAction' || actionKey === 'albumArtAction') {
            if (!window.contexts.ciderPlaybackAction[0] && !window.contexts.albumArtAction[0]) {
                console.debug(`[DEBUG] [Action] ciderPlaybackAction and albumArtAction disappeared.`);
                clearMarquee();
                window.artworkCache = null;
                window.songCache = null;
            }
        }
    });

    action.onKeyDown(() => {
        console.debug(`[DEBUG] [Action] ${actionKey} action triggered.`);
        switch (actionKey) {
            case 'toggleAction':
                comRPC("POST", "playpause");
                setTimeout(() => {
                    comRPC("GET", "now-playing").then(data => setData(data));
                }, 500);
                break;
            case 'skipAction':
                comRPC("POST", "next");
                break;
            case 'previousAction':
                comRPC("POST", "previous");
                break;
            case 'likeAction':
                setRating(1);
                break;
            case 'dislikeAction':
                setRating(-1);
                break;
            case 'addToLibraryAction':
                addToLibrary();
                break;
            case 'volumeUpAction':
                handleVolumeChange(null, null, 'up');
                break;
            case 'volumeDownAction':
                handleVolumeChange(null, null, 'down');
                break;
            case 'ciderLogoAction':
                console.warn(`[DEBUG] [Action] User must be high, why you clicking the logo?`);
                break;
            default:
                console.warn(`[DEBUG] [Action] No handler for ${actionKey}`);
                break;
        }
    });

    if (actionKey === 'ciderPlaybackAction') {
        action.onDialDown(() => {
            console.debug(`[DEBUG] [Action] ciderPlaybackAction dial pressed`);
            switch (window.pressBehavior) {
                case 'togglePlay':
                    comRPC("POST", "playpause");
                    break;
                case 'toggleMute':
                    handleVolumeChange(null, window.contexts.ciderPlaybackAction[0], 'mute');
                    break;
                default:
                    comRPC("POST", "playpause");
                    break;
            }
        });

        action.onDialRotate((jsonObj) => {
            handleVolumeChange(actions.ciderPlaybackAction, window.contexts.ciderPlaybackAction[0], null, jsonObj.payload);
        });

        action.onTouchTap(() => {
            console.debug(`[DEBUG] [Action] ciderPlaybackAction touch tapped`);
            switch (window.tapBehavior) {
                case 'addToLibrary':
                    addToLibrary();
                    break;
                case 'favorite':
                    setRating(1);
                    break;
                case 'both':
                    addToLibrary();
                    setRating(1);
                    break;
            }
        });
    }
});

// ==========================================================================
//  Settings Management
// ==========================================================================

const defaultSettings = {
    iconSettings: { useAdaptiveIcons: true },
    marqueeSettings: {
        enabled: true,
        speed: 200,
        delay: 2000,
        length: 15
    },
    tapSettings: { tapBehavior: 'addToLibrary' },
    knobSettings: {
        volumeStep: 1,
        pressBehavior: 'togglePlay'
    },
    authorization: { rpcKey: null }
};

function updateSettings(settings) {
    const mergedSettings = {...defaultSettings, ...settings};

    useAdaptiveIcons = mergedSettings.iconSettings.useAdaptiveIcons;
    
    Object.assign(window, {
        marqueeEnabled: mergedSettings.marqueeSettings.enabled,
        MARQUEE_SPEED: mergedSettings.marqueeSettings.speed,
        PAUSE_DURATION: mergedSettings.marqueeSettings.delay,
        DISPLAY_LENGTH: mergedSettings.marqueeSettings.length,
        tapBehavior: mergedSettings.tapSettings.tapBehavior,
        volumeStep: mergedSettings.knobSettings.volumeStep,
        pressBehavior: mergedSettings.knobSettings.pressBehavior,
        token: mergedSettings.authorization.rpcKey
    });

    console.debug(`[DEBUG] [Settings] Updated settings:`, mergedSettings);

    if (currentAppState === AppState.STARTING_UP) {
        startupProcess();
    }
}

$SD.onDidReceiveGlobalSettings(({ payload }) => {
    console.debug(`[DEBUG] [Settings] Global settings received:`, payload.settings);
    updateSettings(payload.settings);
    checkAuthKey();
});

// ==========================================================================
//  Authentication and Connection
// ==========================================================================

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 5000; // 5 seconds
let retryAttempts = 0;
let reconnectTimeout;

async function startupProcess() {
    currentAppState = AppState.STARTING_UP;
    console.log("[INFO] [Startup] Beginning startup process...");

    if (!window.token) {
        console.log("CiderDeck: Please enter your Cider authorization key in the plugin settings.");
        alertContexts("No auth key");
        currentAppState = AppState.ERROR;
        return;
    }

    try {
        await checkAuthKey();
        await startWebSocket();
        await initialize();
        currentAppState = AppState.READY;
        console.log("[INFO] [Startup] Startup process completed successfully.");
    } catch (error) {
        console.error("[ERROR] [Startup] Startup process failed:", error);
        currentAppState = AppState.ERROR;
        handleConnectionFailure();
    }
}

async function checkAuthKey() {
    try {
        const data = await comRPC("GET", "active", true);
        if (data.error) {
            throw new Error("Invalid response from Cider");
        }
        console.debug("[DEBUG] [Auth] Successfully authenticated with Cider");
        isAuthenticated = true;
    } catch (error) {
        console.error("[ERROR] [Auth] Failed to authenticate:", error.message);
        throw error;
    }
}

function handleConnectionFailure() {
    isAuthenticated = false;
    alertContexts("Connection failed");
    
    if (retryAttempts < MAX_RETRY_ATTEMPTS) {
        retryAttempts++;
        console.log(`[INFO] [Auth] Retrying connection (Attempt ${retryAttempts}/${MAX_RETRY_ATTEMPTS})...`);
        reconnectTimeout = setTimeout(startupProcess, RETRY_DELAY);
    } else {
        console.error("[ERROR] [Auth] Max retry attempts reached. Please check your settings and Cider application status.");
        $SD.getGlobalSettings();
    }
}

function startWebSocket() {
    return new Promise((resolve, reject) => {
        try {
            const CiderApp = io('http://localhost:10767', {
                reconnectionAttempts: MAX_RETRY_ATTEMPTS,
                reconnectionDelay: RETRY_DELAY,
                timeout: 10000 // 10 seconds timeout
            });

            CiderApp.on('connect', () => {
                console.log("[INFO] [WebSocket] Connected to Cider");
                resolve();
            });

            CiderApp.on("API:Playback", handlePlaybackEvent);

            CiderApp.on('disconnect', (reason) => {
                console.warn("[WARN] [WebSocket] Disconnected from Cider:", reason);
                isAuthenticated = false;
                currentAppState = AppState.ERROR;
                if (reason === 'io server disconnect') {
                    CiderApp.connect();
                }
            });

            CiderApp.on('error', (error) => {
                console.error("[ERROR] [WebSocket] Connection error:", error);
                handleConnectionFailure();
            });

            CiderApp.io.on('reconnect_attempt', (attemptNumber) => {
                console.log(`[INFO] [WebSocket] Reconnection attempt ${attemptNumber}`);
            });

             CiderApp.io.on('reconnect_failed', () => {
                console.error("[ERROR] [WebSocket] Failed to reconnect after all attempts");
                handleConnectionFailure();
            });
        } catch (error) {
            console.error("[ERROR] [WebSocket] Failed to initialize WebSocket:", error);
            handleConnectionFailure();
        }
    });
}

function handlePlaybackEvent({ data, type }) {
    if (!data && data !== 0) {
        setDefaults();
        return;
    }
    
    switch (type) {
        case "playbackStatus.nowPlayingStatusDidChange":
            setAdaptiveData(data);
            break;
        case "playbackStatus.nowPlayingItemDidChange":
            setManualData(data);
            break;
        case "playbackStatus.playbackStateDidChange":
            if (data) setData(data);
            break;
        case "playbackStatus.playbackTimeDidChange":
            setPlaybackStatus(data.isPlaying);
            if (window.contexts.ciderPlaybackAction[0]) {
                setPlaybackTime(data.currentPlaybackTime, data.currentPlaybackDuration);
            }
            break;
        case "playerStatus.volumeDidChange":
            if (window.contexts.ciderPlaybackAction[0]) {
                updateVolumeDisplay(window.contexts.ciderPlaybackAction[0], data);
            }
            break;
        default:
            console.warn("[WARN] [Playback] Unhandled event type:", type);
    }
}

async function initialize() {
    if (!isAuthenticated) {
        throw new Error("Attempted to initialize before authentication.");
    }

    try {
        const data = await comRPC("GET", "now-playing");
        if (data.status === "ok") {
            setManualData(data.info);
            setAdaptiveData(data.info);

            if(window.contexts.ciderPlaybackAction[0]) {
                initializeVolumeDisplay(actions.ciderPlaybackAction, window.contexts.ciderPlaybackAction[0]);
            }
        } else {
            throw new Error("Invalid response from now-playing endpoint");
        }
    } catch (error) {
        console.error("[ERROR] [Init] Failed to initialize:", error.message);
        throw error;
    }
}

// ==========================================================================
//  Playback Control Functions
// ==========================================================================

async function setDefaults() {
    console.debug("[DEBUG] [Defaults] Setting default state.");
    Object.keys(actions).forEach(actionKey => {
        window.contexts[actionKey]?.forEach(context => {
            const img = actionKey === 'toggleAction' ? 'play.png' : `${actionKey.replace('Action', '')}.png`;
            setImage(context, `actions/playback/assets/${img}`, 0);
        });
    });
}

async function setAdaptiveData({ inLibrary, inFavorites }) {
    if (window.addedToLibrary !== inLibrary) {
        const libraryIcon = useAdaptiveIcons ? (inLibrary ? 'check_adaptive.png' : 'add_adaptive.png') : (inLibrary ? 'check.png' : 'add.png');
        window.contexts.addToLibraryAction?.forEach(context => setImage(context, `actions/playback/assets/${libraryIcon}`, 0));
        window.addedToLibrary = inLibrary;
        console.debug("[DEBUG] [Library] Updated library status:", inLibrary);
    }

    if (window.ratingCache !== inFavorites) {
        const likeIcon = useAdaptiveIcons ? (inFavorites ? 'liked_adaptive.png' : 'like_adaptive.png') : (inFavorites ? 'liked.png' : 'like.png');
        window.contexts.likeAction?.forEach(context => setImage(context, `actions/playback/assets/${likeIcon}`, 0));
        window.contexts.dislikeAction?.forEach(context => setImage(context, useAdaptiveIcons ? 'dislike_adaptive.png' : 'dislike.png', 0));
        window.ratingCache = inFavorites ? 1 : 0;
        console.debug("[DEBUG] [Favorites] Updated favorites status:", inFavorites);
    }
}

async function setData({ state, attributes }) {
    setPlaybackStatus(state);

    const artwork = attributes.artwork?.url?.replace('{w}', attributes?.artwork?.width).replace('{h}', attributes?.artwork?.height);
    const songName = attributes.name;
    const artistName = attributes.artistName;
    const albumName = attributes.albumName;

    let logMessage = "[DEBUG] [Playback] ";

    if (window.artworkCache !== artwork && artwork) {
        window.artworkCache = artwork;
        getBase64Image(artwork).then(art64 => {
            window.contexts.albumArtAction?.forEach(context => setImage(context, art64, 0));
            if (window.contexts.ciderPlaybackAction[0]) {
                $SD.setFeedback(window.contexts.ciderPlaybackAction[0], { "icon1": art64 });
            }
        });
        logMessage += `Updated artwork: ${artwork}; `;
    }

    if (window.songCache !== songName) {
        window.songCache = songName;
        window.contexts.songNameAction?.forEach(context => setTitle(context, songName, 0));
        const fullTitle = `${songName} - ${albumName}`;
        clearMarquee();
        if (marqueeEnabled && fullTitle.length > DISPLAY_LENGTH && window.contexts.ciderPlaybackAction[0]) {
          const allContexts = [window.contexts.ciderPlaybackAction[0]];
          startMarquee(allContexts, fullTitle);
        } else {
          $SD.setFeedback(window.contexts.ciderPlaybackAction[0], { "title": fullTitle });
        }
        logMessage += `Updated song: ${songName}; Artist: ${artistName}; Album: ${albumName}; `;
    }

    const toggleIcon = useAdaptiveIcons
        ? state === "playing" ? 'pause_adaptive.png' : 'play_adaptive.png'
        : state === "playing" ? 'pause.png' : 'play.png';

    window.contexts.toggleAction?.forEach(context => setImage(context, `actions/playback/assets/${toggleIcon}`, 0));
    logMessage += `State: ${state === "playing" ? "playing" : "paused"}`;

    console.debug(logMessage);
}

async function setManualData(playbackInfo) {
    setData({ state: playbackInfo.state, attributes: playbackInfo });
}

async function setPlaybackStatus(status) {
    if (window.statusCache !== status) {
        window.statusCache = status;
        const toggleIcon = status ? 'pause.png' : 'play.png';
        window.contexts.toggleAction?.forEach(context => setImage(context, `actions/playback/assets/${toggleIcon}`, 0));
        console.debug("[DEBUG] [Playback] Updated playback status:", status ? "playing" : "paused");
    }
}

async function setPlaybackTime(time, duration) {
    const progress = Math.round((time / duration) * 100);

    // Update Stream Deck+ display
    const feedbackPayload = {
        "indicator1": progress
    };
    $SD.setFeedback(window.contexts.ciderPlaybackAction[0], feedbackPayload);
}

// ==========================================================================
//  Library and Rating Functions
// ==========================================================================

async function addToLibrary() {
    if (!window.addedToLibrary) {
        await comRPC("POST", "add-to-library", true);
        window.contexts.addToLibraryAction?.forEach(context => setImage(context, 'actions/playback/assets/check.png', 0));
        window.addedToLibrary = true;
        console.debug("[DEBUG] [Library] Added to library");
    }
}

async function setRating(ratingValue) {
    if (window.ratingCache !== ratingValue) {
        await comRPC("POST", "set-rating", true, { rating: ratingValue });

        const likeIcon = ratingValue === 1 ? 'liked.png' : 'like.png';
        const dislikeIcon = ratingValue === -1 ? 'disliked.png' : 'dislike.png';

        window.contexts.likeAction?.forEach(context => setImage(context, `actions/playback/assets/${likeIcon}`, 0));
        window.contexts.dislikeAction?.forEach(context => setImage(context, `actions/playback/assets/${dislikeIcon}`, 0));

        window.ratingCache = ratingValue;
        console.debug("[DEBUG] [Rating] Updated rating to:", ratingValue);
    }
}

// ==========================================================================
//  Volume Control Functions
// ==========================================================================

let isChangingVolume = false;
let isMuted = false;
let previousVolume;

async function handleVolumeChange(action, context, direction, payload) {
    if (isChangingVolume) return;
    isChangingVolume = true;

    try {
        let { volume: currentVolume } = await comRPC("GET", "volume");
        let currentVolumePercent = Math.round(currentVolume * 100);

        const globalVolumeStep = window.volumeStep;

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
                ? Math.min(currentVolume + globalVolumeStep / 100, 1) 
                : Math.max(currentVolume - globalVolumeStep / 100, 0);
        } else if (payload && payload.ticks !== undefined) {
            newVolume = Math.max(0, Math.min(1, currentVolume + (payload.ticks * globalVolumeStep / 100)));
        }

        if (newVolume !== undefined) {
            let newVolumePercent = Math.round(newVolume * 100);
            
            if (Math.abs(newVolumePercent - currentVolumePercent) < globalVolumeStep / 2) {
                return;
            }

            await comRPC("POST", "volume", true, { volume: newVolume });
            console.debug(`[DEBUG] [Volume] Volume changed from to ${newVolumePercent}%`);
            updateVolumeDisplay(context, newVolume);
        }
    } catch (error) {
        console.error("Error changing volume:", error);
    } finally {
        isChangingVolume = false;
    }
}

function updateVolumeDisplay(context, volume) {
    const volumePercentage = Math.round(volume * 100);
    const feedbackPayload = {
        "indicator2": volumePercentage,
        "icon2": "actions/playback/assets/volup"
    };
    $SD.setFeedback(context, feedbackPayload);
}

async function initializeVolumeDisplay(action, context) {
    try {
        const { volume: currentVolume } = await comRPC("GET", "volume");
        updateVolumeDisplay(context, currentVolume);
        console.debug("[DEBUG] [Volume] Display initialized with volume:", Math.round(currentVolume * 100));
    } catch (error) {
        console.error("Error initializing volume display:", error);
    }
}

// ==========================================================================
//  Utility Functions
// ==========================================================================

function alertContexts(message) {
    Object.values(window.contexts).flat().forEach(context => {
        $SD.showAlert(context);
        console.debug(`[DEBUG] [Alert] Alert shown for context: ${context}`);
    });
    if (message) {
        console.log(`[INFO] [Alert] ${message}`);
    }
}

async function comRPC(method, request, noCheck, _body) {
    // Check and make sure token is set before attempting to make a request.
    if (!window.token) {
        console.log("CiderDeck: Please enter your Cider authorization key in the plugin settings.");
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
        if (!noCheck) console.error("Request error:", error);
    }
}

function setImage(action, image, context) {
    if (action && image && context !== null) $SD.setImage(action, image, context);
}

function setTitle(action, title, context) {
   if (action && title && context !== null) $SD.setTitle(action, title, context);
}

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

// ==========================================================================
//  Marquee Functions
// ==========================================================================

function clearMarquee() {
  if (marqueeInterval) {
      clearInterval(marqueeInterval);
      marqueeInterval = null;
  }
  marqueePosition = 0;
  currentMarqueeText = '';
  isScrolling = false;
  lastMarqueeUpdateTime = 0;
}

function startMarquee(contexts, text) {
  clearMarquee();
  currentMarqueeText = text;
  
  // Update display for all contexts
  updateMarqueeForAllContexts(contexts);
  
  setTimeout(() => {
      isScrolling = true;
      marqueeInterval = setInterval(() => {
          const currentTime = Date.now();
          if (isScrolling && (currentTime - lastMarqueeUpdateTime) >= MARQUEE_SPEED) {
              marqueePosition += MARQUEE_STEP;
              updateMarqueeForAllContexts(contexts);
              lastMarqueeUpdateTime = currentTime;
          }
      }, Math.max(MARQUEE_SPEED / 2, 16)); // Run the interval more frequently, but update based on time
  }, PAUSE_DURATION);
}

function updateMarqueeForAllContexts(contexts) {
  contexts.forEach(context => updateMarqueeDisplay(context));
}

function updateMarqueeDisplay(context) {
  const totalTextLength = currentMarqueeText.length;
  
  if (marqueePosition >= totalTextLength) {
      isScrolling = false;
      marqueePosition = 0;
      updateMarqueeDisplay(context); // Display the start immediately
      setTimeout(() => {
          isScrolling = true;
          lastMarqueeUpdateTime = Date.now(); // Reset the last update time
      }, PAUSE_DURATION);
      return;
  }
  
  let visibleText = currentMarqueeText.substring(marqueePosition, marqueePosition + DISPLAY_LENGTH);
  
  // Pad with spaces if we're near the end to avoid text wrapping
  if (visibleText.length < DISPLAY_LENGTH) {
      visibleText = visibleText.padEnd(DISPLAY_LENGTH, ' ');
  }
  
  $SD.setFeedback(context, { "title": visibleText });
}
