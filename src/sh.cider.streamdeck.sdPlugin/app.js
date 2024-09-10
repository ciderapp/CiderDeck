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

// Startup states for the application
const AppState = {
    STARTING_UP: 'starting_up',
    READY: 'ready',
    ERROR: 'error'
};

let currentAppState = AppState.STARTING_UP;
let isAuthenticated = false;

// Initialize actions and contexts
const actions = {
    toggleAction: new Action('sh.cider.streamdeck.toggle'),
    repeatAction: new Action('sh.cider.streamdeck.repeat'),
    shuffleAction: new Action('sh.cider.streamdeck.shuffle'),
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

// Offline states for actions
const offlineStates = {
    'sh.cider.streamdeck.playback': 1,
    'sh.cider.streamdeck.songname': 0,
    'sh.cider.streamdeck.albumart': 1,
    'sh.cider.streamdeck.toggle': 2,
    'sh.cider.streamdeck.repeat': 3,
    'sh.cider.streamdeck.shuffle': 2,
    'sh.cider.streamdeck.volumeup': 1,
    'sh.cider.streamdeck.volumedown': 1,
    'sh.cider.streamdeck.addtolibrary': 2,
    'sh.cider.streamdeck.dislike': 2,
    'sh.cider.streamdeck.like': 2,
    'sh.cider.streamdeck.skip': 1,
    'sh.cider.streamdeck.previous': 1,
    'sh.cider.streamdeck.ciderlogo': 1
};

// Global Configuration
let marqueeInterval, marqueePosition = 0, currentMarqueeText = '', isScrolling = false;
let MARQUEE_SPEED = 200, MARQUEE_STEP = 1, PAUSE_DURATION = 2000, DISPLAY_LENGTH = 15; lastMarqueeUpdateTime = 0;
let marqueeEnabled = true, tapBehavior = 'addToLibrary', volumeStep = 1, pressBehavior = 'togglePlay';
let currentRepeatMode = 0; // 0: off, 1: repeat one, 2: repeat all, 3: disabled
let currentShuffleMode = 0; // 0: off, 1: on, 2: disabled
let useAdaptiveIcons = false, rpcKey = null;

// Ensure window.contexts is initialized
window.contexts = window.contexts || {};

// ==========================================================================
//  Initialization and Setup
// ==========================================================================

$SD.onConnected(() => {
    console.debug('[DEBUG] [System] Stream Deck connected!');
    currentAppState = AppState.STARTING_UP;
    setDefaults();
    $SD.getGlobalSettings();
});

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
                }, 1000);
                break;
            case 'repeatAction':
                comRPC("POST", "toggle-repeat");
                break;
            case 'shuffleAction':
                comRPC("POST", "toggle-shuffle");
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
                console.warn(`[DEBUG] [Action] Interesting decision?`);
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
                    setTimeout(() => {
                        comRPC("GET", "now-playing").then(data => setData(data));
                    }, 1000);
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
const SERVER_CHECK_INTERVAL = 10000; // 10 seconds
let retryAttempts = 0;
let reconnectTimeout;
let serverCheckInterval;


async function checkServerStatus() {
    try {
        const response = await fetch('http://127.0.0.1:10767/api/v1/playback/active', {
            headers: {
                'Content-Type': 'application/json',
                'apptoken': window.token
            }
        });
        const data = await response.json();
        return data.status === "ok";
    } catch (error) {
        console.debug("[DEBUG] [Server Check] Server not responding:", error.message);
        return false;
    }
}

async function startupProcess() {
    currentAppState = AppState.STARTING_UP;
    console.log("[INFO] [Startup] Beginning startup process...");

    if (!window.token) {
        console.log("CiderDeck: Please enter your Cider authorization key in the plugin settings.");
        currentAppState = AppState.ERROR;
        return;
    }

    try {
        const isServerAlive = await checkServerStatus();
        if (!isServerAlive) {
            console.log("[INFO] [Startup] Cider server is not responding. Waiting for it to come online...");
            handleConnectionFailure();
            return;
        }

        await checkAuthKey();
        await startWebSocket();
        await initialize();
        currentAppState = AppState.READY;
        console.log("[INFO] [Startup] Startup process completed successfully.");
    } catch (error) {
        console.info("[ERROR] [Startup] Startup process failed:", error);
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
        console.info("[ERROR] [Auth] Failed to authenticate:", error.message);
    }
}

function handleConnectionFailure() {
    isAuthenticated = false;
    setOfflineStates();
    
    if (!serverCheckInterval) {
        serverCheckInterval = setInterval(async () => {
            const isServerAlive = await checkServerStatus();
            if (isServerAlive) {
                console.log("[INFO] [Connection] Server is back online. Attempting to reconnect...");
                clearInterval(serverCheckInterval);
                serverCheckInterval = null;
                retryAttempts = 0;
                startupProcess();
            } else {
                console.debug("[DEBUG] [Connection] Server still offline. Continuing to monitor...");
            }
        }, SERVER_CHECK_INTERVAL);
    }
}

function startWebSocket() {
    return new Promise((resolve, reject) => {
        try {
            const CiderApp = io('http://127.0.0.1:10767', {
                reconnectionAttempts: Infinity,
                reconnectionDelay: RETRY_DELAY,
                timeout: 10000 // 10 seconds timeout
            });

            CiderApp.on('connect', () => {
                console.log("[INFO] [WebSocket] Connected to Cider");
                setDefaults()
                if (serverCheckInterval) {
                    clearInterval(serverCheckInterval);
                    serverCheckInterval = null;
                }
                retryAttempts = 0;
                resolve();
            });

            CiderApp.on("API:Playback", handlePlaybackEvent);

            CiderApp.on('disconnect', (reason) => {
                console.warn("[WARN] [WebSocket] Disconnected from Cider:", reason);
                handleConnectionFailure();
            });

            CiderApp.on('error', (error) => {
                console.info("[ERROR] [WebSocket] Connection error:", error);
                handleConnectionFailure();
            });

            CiderApp.io.on('reconnect_attempt', (attemptNumber) => {
                console.log(`[INFO] [WebSocket] Reconnection attempt ${attemptNumber}`);
            });

            CiderApp.io.on('reconnect_failed', () => {
                console.info("[ERROR] [WebSocket] Failed to reconnect after all attempts");
                handleConnectionFailure();
            });
        } catch (error) {
            console.info("[ERROR] [WebSocket] Failed to initialize WebSocket:", error);
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
            updatePlaybackModes();
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
        case "playerStatus.repeatModeDidChange":
            updateRepeatMode(data);
            break;
        case "playerStatus.shuffleModeDidChange":
            updateShuffleMode(data);
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
            resetStates(); // Reset states to normal
            setManualData(data.info);
            setAdaptiveData(data.info);
            await updatePlaybackModes();

            if(window.contexts.ciderPlaybackAction[0]) {
                initializeVolumeDisplay(actions.ciderPlaybackAction, window.contexts.ciderPlaybackAction[0]);
            }
        } else {
            throw new Error("Invalid response from now-playing endpoint");
        }
    } catch (error) {
        console.info("[ERROR] [Init] Failed to initialize:", error.message);
    }
}

// ==========================================================================
//  Playback Control Functions
// ==========================================================================

async function setDefaults() {
    console.debug("[DEBUG] [Defaults] Setting default state.");
    Object.keys(actions).forEach(actionKey => {
        window.contexts[actionKey]?.forEach(context => {
            actionKey.setState(0);
        });
    });
}

async function setAdaptiveData({ inLibrary, inFavorites }) {
    console.debug("[DEBUG] [Library] inLibrary:", inLibrary, "inFavorites:", inFavorites);
    if (window.addedToLibrary !== inLibrary) {
        window.contexts.addToLibraryAction?.forEach(context => {
            $SD.setState(context, inLibrary ? 1 : 0);
        });
        window.addedToLibrary = inLibrary;
        console.debug("[DEBUG] [Library] Updated library status:", inLibrary);
    }

    if (window.ratingCache !== inFavorites) {
        window.contexts.likeAction?.forEach(context => {
            $SD.setState(context, inFavorites ? 1 : 0);
        });
        window.contexts.dislikeAction?.forEach(context => {
            $SD.setState(context, 0); // Always set to default state for dislike
        });
        window.ratingCache = inFavorites ? 1 : 0;
        console.debug("[DEBUG] [Favorites] Updated favorites status:", inFavorites);
    }
}

async function setData({ state, attributes }) {
    setPlaybackStatus(state);

    let artwork = window.artworkCache

    if (attributes?.artwork) {
        artwork = attributes.artwork?.url?.replace('{w}', attributes?.artwork?.width).replace('{h}', attributes?.artwork?.height);
    }

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
        ? state === "playing" ? 'play.png' : 'play.png'
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

        // Check if its a string, if it is reformat to 0/1
        if (typeof status === 'string') {
            status = status === 'playing' ? 1 : 0;
        }
            
        window.contexts.toggleAction?.forEach(context => {
            $SD.setState(context, status ? 1 : 0);
        });
        console.debug("[DEBUG] [Playback] Updated playback status:", status ? "playing" : "paused");
    }
}

function updateRepeatMode(mode) {
    currentRepeatMode = mode;
    console.debug(`[DEBUG] [Repeat] Updated repeat mode to: ${currentRepeatMode}`);
    
    window.contexts.repeatAction?.forEach(context => {
        $SD.setState(context, currentRepeatMode);
    });
}

function updateShuffleMode(mode) {
    currentShuffleMode = mode;
    console.debug(`[DEBUG] [Shuffle] Updated shuffle mode to: ${currentShuffleMode}`);
    
    window.contexts.shuffleAction?.forEach(context => {
        $SD.setState(context, currentShuffleMode);
    });
}

async function setRepeatMode() {
    if (currentRepeatMode === 3) return; // Don't do anything if disabled

    try {
        // Predict the next mode
        const predictedMode = (currentRepeatMode + 1) % 3;
        
        // Update UI immediately (optimistic update)
        updateRepeatMode(predictedMode);

        // Send request to server
        const response = await comRPC("POST", "toggle-repeat", true);
        
        if (response && response.status === "ok") {
            // The Socket.io event will handle the actual update if it differs from our prediction
            console.debug(`[DEBUG] [Repeat] Toggled repeat mode`);
        } else {
            console.warn("[WARN] [Repeat] Failed to toggle repeat mode");
            // Revert to previous state if the request failed
            updateRepeatMode(currentRepeatMode);
        }
    } catch (error) {
        console.error("[ERROR] [Repeat] Error toggling repeat mode:", error);
        // Revert to previous state if there was an error
        updateRepeatMode(currentRepeatMode);
    }
}

async function setShuffleMode() {
    if (currentShuffleMode === 2) return; // Don't do anything if disabled

    try {
        // Predict the next mode
        const predictedMode = currentShuffleMode === 0 ? 1 : 0;
        
        // Update UI immediately (optimistic update)
        updateShuffleMode(predictedMode);

        // Send request to server
        const response = await comRPC("POST", "toggle-shuffle", true);
        
        if (response && response.status === "ok") {
            // The Socket.io event will handle the actual update if it differs from our prediction
            console.debug(`[DEBUG] [Shuffle] Toggled shuffle mode`);
        } else {
            console.warn("[WARN] [Shuffle] Failed to toggle shuffle mode");
            // Revert to previous state if the request failed
            updateShuffleMode(currentShuffleMode);
        }
    } catch (error) {
        console.error("[ERROR] [Shuffle] Error toggling shuffle mode:", error);
        // Revert to previous state if there was an error
        updateShuffleMode(currentShuffleMode);
    }
}

async function updatePlaybackModes() {
    try {
        const repeatMode = await comRPC("GET", "repeat-mode");
        if (repeatMode && repeatMode.status === "ok" && repeatMode.value !== undefined) {
            updateRepeatMode(repeatMode.value);
        }
        
        const shuffleMode = await comRPC("GET", "shuffle-mode");
        if (shuffleMode && shuffleMode.status === "ok" && shuffleMode.value !== undefined) {
            updateShuffleMode(shuffleMode.value);
        }
    } catch (error) {
        console.error("[ERROR] [Modes] Error updating playback modes:", error);
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
        window.contexts.addToLibraryAction?.forEach(context => {
            $SD.setState(context, 1);
        });
        window.addedToLibrary = true;
        console.debug("[DEBUG] [Library] Added to library");
    }
}

async function setRating(ratingValue) {
    if (window.ratingCache !== ratingValue) {
        await comRPC("POST", "set-rating", true, { rating: ratingValue });

        window.contexts.likeAction?.forEach(context => {
            $SD.setState(context, ratingValue === 1 ? 1 : 0);
        });
        window.contexts.dislikeAction?.forEach(context => {
            $SD.setState(context, ratingValue === -1 ? 1 : 0);
        });

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
        console.info("Error changing volume:", error);
    } finally {
        isChangingVolume = false;
    }
}

function updateVolumeDisplay(context, volume) {
    const volumePercentage = Math.round(volume * 100);
    const feedbackPayload = {
        "indicator2": volumePercentage,
        "icon2": volumePercentage === 0 ? "actions/assets/buttons/volume-off"
                 : volumePercentage <= 50 ? "actions/assets/buttons/volume-down-1"
                 : "actions/assets/buttons/volume-up-1"
    };
    $SD.setFeedback(context, feedbackPayload);
}

async function initializeVolumeDisplay(action, context) {
    try {
        const { volume: currentVolume } = await comRPC("GET", "volume");
        updateVolumeDisplay(context, currentVolume);
        console.debug("[DEBUG] [Volume] Display initialized with volume:", Math.round(currentVolume * 100));
    } catch (error) {
        console.info("Error initializing volume display:", error);
    }
}

// ==========================================================================
//  Utility Functions
// ==========================================================================

function setOfflineStates() {
    Object.keys(actions).forEach(actionKey => {
        const contexts = window.contexts[actionKey] || [];
        const uuid = actions[actionKey].UUID;
        let offlineState = offlineStates[uuid];
        
        if (actionKey === 'repeatAction') {
            offlineState = 3; // Disabled state for repeat
            currentRepeatMode = 3;
        } else if (actionKey === 'shuffleAction') {
            offlineState = 2; // Disabled state for shuffle
            currentShuffleMode = 2;
        }
        
        if (offlineState !== undefined) {
            contexts.forEach(context => {
                $SD.setState(context, offlineState);
                console.debug(`[DEBUG] [Offline] Set ${actionKey} to offline state: ${offlineState}`);
            });
        }
    });
}

function resetStates() {
    Object.keys(actions).forEach(actionKey => {
        const contexts = window.contexts[actionKey] || [];
        contexts.forEach(context => {
            if (actionKey === 'repeatAction') {
                currentRepeatMode = 0;
                $SD.setState(context, 0);
            } else if (actionKey === 'shuffleAction') {
                currentShuffleMode = 0;
                $SD.setState(context, 0);
            } else {
                $SD.setState(context, 0);
            }
            console.debug(`[DEBUG] [Online] Reset ${actionKey} to default state`);
        });
    });
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
        if (!noCheck) console.info("Request error:", error);
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
