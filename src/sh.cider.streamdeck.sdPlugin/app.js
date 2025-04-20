// ==========================================================================
//  Cider Stream Deck Plugin - Main Application
// ==========================================================================
//  This file contains the main logic for the Cider Stream Deck plugin.
//  It handles communication with the Stream Deck, manages actions,
//  and interacts with the Cider application.
// ==========================================================================

/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />
/// <reference path="libs/js/cache-manager.js" />
/// <reference path="libs/js/utilities.js" />
/// <reference path="libs/js/marquee.js" />
/// <reference path="libs/js/playback.js" />
/// <reference path="libs/js/library.js" />
/// <reference path="libs/js/volume.js" />
/// <reference path="libs/js/song-display.js" />

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

// Make actions available globally
window.actions = actions;

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

// Global connection state
window.isConnected = false;

// Ensure window.contexts is initialized
window.contexts = window.contexts || {};

// ==========================================================================
//  Initialization and Setup
// ==========================================================================

$SD.onConnected(() => {
    console.debug('[DEBUG] [System] Stream Deck connected!');
    currentAppState = AppState.STARTING_UP;
    
    // Initialize the song renderer if it hasn't been
    if (!window.songDisplayRenderer) {
        console.debug('[DEBUG] [SongDisplay] Initializing song display renderer');
        window.songDisplayRenderer = new SongDisplayRenderer();
    }
    
    CiderDeckPlayback.setDefaults();
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
    
    action.onWillAppear(({ context, payload }) => {
        if (!window.contexts[actionKey].includes(context)) {
            window.contexts[actionKey].push(context);
            console.debug(`[DEBUG] [Context] Context added for ${actionKey}: ${context}`);
        }
        
        // Handle song display settings if this is a song name action
        if (actionKey === 'songNameAction') {
            if (payload.settings?.songDisplaySettings) {
                console.debug(`[DEBUG] [SongDisplay] Received settings on appearance:`, payload.settings.songDisplaySettings);
                cacheManager.set('songDisplaySettings', payload.settings.songDisplaySettings);
                
                // Initialize the song renderer if it hasn't been yet
                if (!window.songDisplayRenderer) {
                    console.debug('[DEBUG] [SongDisplay] Initializing song display renderer on first appearance');
                    window.songDisplayRenderer = new SongDisplayRenderer();
                }
                
                // Update renderer configuration
                window.songDisplayRenderer.updateSettings(payload.settings.songDisplaySettings);
                
                // Update display immediately if we have song info
                if (cacheManager.get('song')) {
                    CiderDeckSongDisplay.updateCustomSongDisplay();
                }
            }
            
            // Add event handler for settings changes
            action.onDidReceiveSettings(function(jsn) {
                console.debug(`[DEBUG] [SongDisplay] Received updated settings:`, jsn.payload.settings);
                if (jsn.payload.settings?.songDisplaySettings) {
                    cacheManager.set('songDisplaySettings', jsn.payload.settings.songDisplaySettings);
                    // Update renderer with new settings
                    if (window.songDisplayRenderer) {
                        window.songDisplayRenderer.updateSettings(jsn.payload.settings.songDisplaySettings);
                        CiderDeckSongDisplay.updateCustomSongDisplay();
                    }
                }
            });
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
                CiderDeckMarquee.clearMarquee();
                window.artworkCache = null;
                window.songCache = null;
            }
        }
    });

    action.onKeyDown(() => {
        console.debug(`[DEBUG] [Action] ${actionKey} action triggered.`);
        switch (actionKey) {
            case 'toggleAction':
                CiderDeckUtils.comRPC("POST", "playpause");
                setTimeout(() => {
                    CiderDeckUtils.comRPC("GET", "now-playing").then(data => {
                        if (data && data.status === "ok") {
                            CiderDeckPlayback.setManualData(data.info);
                        }
                    });
                }, 1000);
                break;
            case 'repeatAction':
                CiderDeckUtils.comRPC("POST", "toggle-repeat");
                break;
            case 'shuffleAction':
                CiderDeckUtils.comRPC("POST", "toggle-shuffle");
                break;
            case 'skipAction':
                CiderDeckUtils.comRPC("POST", "next");
                break;
            case 'previousAction':
                CiderDeckPlayback.goBack();
                break;
            case 'likeAction':
                CiderDeckLibrary.setRating(1);
                break;
            case 'dislikeAction':
                CiderDeckLibrary.setRating(-1);
                break;
            case 'addToLibraryAction':
                CiderDeckLibrary.addToLibrary();
                break;
            case 'volumeUpAction':
                CiderDeckVolume.handleVolumeChange(null, null, 'up');
                break;
            case 'volumeDownAction':
                CiderDeckVolume.handleVolumeChange(null, null, 'down');
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
            // Get press behavior from the hierarchical settings
            const pressBehavior = window.ciderDeckSettings?.dial?.pressBehavior || 'togglePlay';
            
            switch (pressBehavior) {
                case 'togglePlay':
                    CiderDeckUtils.comRPC("POST", "playpause");
                    setTimeout(() => {
                        CiderDeckUtils.comRPC("GET", "now-playing").then(data => {
                            if (data && data.status === "ok") {
                                CiderDeckPlayback.setManualData(data.info);
                            }
                        });
                    }, 1000);
                    break;
                case 'mute':
                    CiderDeckVolume.handleVolumeChange(null, window.contexts.ciderPlaybackAction[0], 'mute');
                    break;
                default:
                    CiderDeckUtils.comRPC("POST", "playpause");
                    break;
            }
        });

        action.onDialRotate((jsonObj) => {
            CiderDeckVolume.handleVolumeChange(actions.ciderPlaybackAction, window.contexts.ciderPlaybackAction[0], null, jsonObj.payload);
        });
        
        action.onTouchTap(() => {
            console.debug(`[DEBUG] [Action] ciderPlaybackAction touch tapped`);
            // Get tap behavior from the hierarchical settings
            const tapBehavior = window.ciderDeckSettings?.dial?.tapBehavior || 'addToLibrary';
            
            switch (tapBehavior) {
                case 'addToLibrary':
                    CiderDeckLibrary.addToLibrary();
                    break;
                case 'favorite':
                    CiderDeckLibrary.setRating(1);
                    break;
                case 'both':
                    CiderDeckLibrary.addToLibrary();
                    CiderDeckLibrary.setRating(1);
                    break;
                default:
                    CiderDeckLibrary.addToLibrary();
                    break;
            }
        });
    }
});

// ==========================================================================
//  Settings Management
// ==========================================================================

const defaultSettings = {
    global: {
        authorization: {
            rpcKey: null
        }
    },
    playback: {
        alwaysGoToPrevious: false
    },
    favorite: {
        alsoAddToLibrary: false
    },
    dial: {
        rotationAction: 'volume',
        volumeStep: 1,
        pressBehavior: 'togglePlay',
        tapBehavior: 'addToLibrary',
        marquee: {
            enabled: true,
            speed: 200,
            length: 15,
            delay: 2000
        },
        showIcons: true,
        showArtworkOnDial: true
    },
    songDisplay: {
        fontSize: 16,
        fontFamily: 'Figtree',
        textColor: '#FFFFFF',
        backgroundColor: '#000000',
        textAlign: 'center',
        showArtist: true,
        showAlbum: false,
        maxLines: 2,
        lineHeight: 1.2,
        alignment: 'center',
        showIcons: true,
        useShadow: true,
        iconSize: 24,
        textStyle: 'bold',
        verticalPosition: 'bottom',
        lineSpacing: 13,
        textPrefix: '',
        customFormat: '',
        marquee: {
            enabled: false,
            speed: 40,
            pause: 2000
        }
    }
};

function updateSettings(settings) {
    // Deep merge to properly handle nested objects
    const mergedSettings = CiderDeckUtils.deepMerge(defaultSettings, settings || {});
    
    // Apply settings to window variables, prioritizing the new structure
    // but maintaining backward compatibility
    Object.assign(window, {
        // Marquee settings (display related)
        marqueeEnabled: mergedSettings.dial?.marquee?.enabled ?? 
                        mergedSettings.songDisplay?.marquee?.enabled ?? 
                        mergedSettings.marqueeSettings?.enabled ?? true,
        MARQUEE_SPEED: mergedSettings.dial?.marquee?.speed ?? 
                      mergedSettings.songDisplay?.marquee?.speed ?? 
                      mergedSettings.marqueeSettings?.speed ?? 200,
        PAUSE_DURATION: mergedSettings.dial?.marquee?.delay ?? 
                       mergedSettings.songDisplay?.marquee?.pause ?? 
                       mergedSettings.marqueeSettings?.delay ?? 2000,
        DISPLAY_LENGTH: mergedSettings.dial?.marquee?.length ?? 
                       mergedSettings.marqueeSettings?.length ?? 15,
        
        // Behavior settings
        tapBehavior: mergedSettings.dial?.tapBehavior ?? 
                    mergedSettings.tapSettings?.tapBehavior ?? 'addToLibrary',
        volumeStep: mergedSettings.dial?.volumeStep ?? 
                   mergedSettings.knobSettings?.volumeStep ?? 1,
        pressBehavior: mergedSettings.dial?.pressBehavior ?? 
                      mergedSettings.knobSettings?.pressBehavior ?? 'togglePlay',
        
        // Authentication
        token: mergedSettings.global?.authorization?.rpcKey ?? 
              mergedSettings.authorization?.rpcKey ?? null
    });

    // Store the complete settings for potential access by other components
    window.ciderDeckSettings = mergedSettings;

    console.debug(`[DEBUG] [Settings] Updated settings:`, mergedSettings);

    // Check if we have a token now but we're in startup state
    const hasToken = !!(window.token);
    
    if (currentAppState === AppState.STARTING_UP) {
        startupProcess();
    } else if (currentAppState === AppState.ERROR && hasToken) {
        // If we were in an error state and now have a token, try to restart
        console.log("[INFO] [Settings] Token received while in error state, attempting to restart...");
        currentAppState = AppState.STARTING_UP;
        startupProcess();
    }
}

$SD.onDidReceiveGlobalSettings(({ payload }) => {
    console.debug(`[DEBUG] [Settings] Global settings received:`, payload.settings);
    updateSettings(payload.settings);
});

// ==========================================================================
//  Settings Notification Handlers
// ==========================================================================

// Add listeners for each action to handle direct PI notifications
Object.keys(actions).forEach(actionKey => {
    const action = actions[actionKey];
    
    // Listen for direct messages from Property Inspector
    action.onSendToPlugin((data) => {
        const payload = data.payload;
        
        if (!payload) return;
        
        // Handle the 'settingsChanged' event to immediately update specific component settings
        if (payload.action === 'settingsChanged' && payload.actionType) {
            console.debug(`[DEBUG] [Settings] Received settingsChanged notification for ${payload.actionType}:`, payload.settings);
            
            // Update global settings if we have an actionType specified
            const updatedSettings = {
                ...window.ciderDeckSettings,
                [payload.actionType]: payload.settings
            };
            
            // Apply the settings update
            updateSettings(updatedSettings);
            
            // If this is song display settings, update immediately
            if (payload.actionType === 'songDisplay' && window.songDisplayRenderer) {
                console.debug('[DEBUG] [SongDisplay] Applying hot-reloaded settings');
                
                // First update the cache with the new settings
                cacheManager.set('songDisplaySettings', payload.settings);
                
                // Then make sure the renderer gets the latest settings
                window.songDisplayRenderer.updateSettings(payload.settings);
                
                // Force a complete re-render with the new settings
                const currentSongInfo = {
                    title: cacheManager.get('song') || 'Unknown',
                    artist: cacheManager.get('artist') || 'Unknown',
                    album: cacheManager.get('album') || 'Unknown'
                };
                
                // Make sure song info is updated too
                window.songDisplayRenderer.updateSongInfo(currentSongInfo);
                
                // Update all song display instances
                CiderDeckSongDisplay.updateCustomSongDisplay();
            }
            
            // If this is dial settings, handle hot reload properly
            if (payload.actionType === 'dial' && window.contexts.ciderPlaybackAction && window.contexts.ciderPlaybackAction.length > 0) {
                console.debug('[DEBUG] [Dial] Applying hot-reloaded dial settings');
                
                // If artwork setting changed, we need to update the dial display
                const artwork = cacheManager.get('artwork');
                if (artwork) {
                    CiderDeckUtils.getBase64Image(artwork).then(art64 => {
                        const showArtworkOnDial = payload.settings.showArtworkOnDial ?? true;
                        if (window.contexts.ciderPlaybackAction[0]) {
                            if (showArtworkOnDial) {
                                $SD.setFeedback(window.contexts.ciderPlaybackAction[0], { "icon1": art64 });
                            } else {
                                $SD.setFeedback(window.contexts.ciderPlaybackAction[0], { "icon1": "actions/assets/buttons/media-playlist" });
                            }
                        }
                    });
                }
                
                // Also update current song title display if needed
                const currentSong = cacheManager.get('song');
                const currentAlbum = cacheManager.get('album');
                
                if (currentSong) {
                    const fullTitle = `${currentSong} - ${currentAlbum || ''}`;
                    CiderDeckMarquee.clearMarquee();
                    
                    const marqueeSettings = payload.settings.marquee || {};
                    const isMarqueeEnabled = marqueeSettings.enabled ?? true;
                    const displayLength = marqueeSettings.length ?? 15;
                    
                    if (isMarqueeEnabled && fullTitle.length > displayLength && window.contexts.ciderPlaybackAction[0]) {
                        const allContexts = [window.contexts.ciderPlaybackAction[0]];
                        CiderDeckMarquee.startMarquee(allContexts, fullTitle);
                    } else if (window.contexts.ciderPlaybackAction[0]) {
                        $SD.setFeedback(window.contexts.ciderPlaybackAction[0], { "title": fullTitle });
                    }
                }
                
                // Update volume display if needed
                if (window.contexts.ciderPlaybackAction[0]) {
                    CiderDeckVolume.initializeVolumeDisplay(actions.ciderPlaybackAction, window.contexts.ciderPlaybackAction[0]);
                }
            }
        }
        
        // Handle the 'globalSettingsChanged' event to immediately update global settings
        if (payload.action === 'globalSettingsChanged' && payload.settings) {
            console.debug(`[DEBUG] [Settings] Received globalSettingsChanged notification:`, payload.settings);
            updateSettings(payload.settings);
        }
    });
});

// ==========================================================================
//  Authentication and Connection
// ==========================================================================

async function startupProcess() {
    currentAppState = AppState.STARTING_UP;
    console.log("[INFO] [Startup] Beginning startup process...");

    if (!window.token) {
        console.log("CiderDeck: Please enter your Cider authorization key in the plugin settings.");
        currentAppState = AppState.ERROR;
        return;
    }

    try {
        await startWebSocket();
        // The rest of the initialization will be handled in the 'connect' event
    } catch (error) {
        console.info("[ERROR] [Startup] Startup process failed:", error);
        currentAppState = AppState.ERROR;
        handleDisconnection();
    }
}

function startWebSocket() {
    return new Promise((resolve, reject) => {
        try {
            const CiderApp = io('http://localhost:10767', {
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                timeout: 10000 // 10 seconds timeout
            });

            CiderApp.on('connect', () => {
                console.log("[INFO] [WebSocket] Connected to Cider");
                window.isConnected = true;
                resetStates();
                initialize().then(() => {
                    currentAppState = AppState.READY;
                    console.log("[INFO] [Startup] Startup process completed successfully.");
                }).catch(error => {
                    console.info("[ERROR] [Startup] Failed to initialize:", error);
                    currentAppState = AppState.ERROR;
                });
                resolve();
            });

            CiderApp.on("API:Playback", handlePlaybackEvent);

            CiderApp.on('disconnect', (reason) => {
                console.warn("[WARN] [WebSocket] Disconnected from Cider:", reason);
                window.isConnected = false;
                handleDisconnection();
            });

            CiderApp.on('error', (error) => {
                console.info("[ERROR] [WebSocket] Connection error:", error);
            });

            CiderApp.io.on('reconnect_attempt', (attemptNumber) => {
                console.log(`[INFO] [WebSocket] Reconnection attempt ${attemptNumber}`);
            });

            CiderApp.io.on('reconnect_failed', () => {
                console.info("[ERROR] [WebSocket] Failed to reconnect after all attempts");
                window.isConnected = false;
                handleDisconnection();
            });
        } catch (error) {
            console.info("[ERROR] [WebSocket] Failed to initialize WebSocket:", error);
            window.isConnected = false;
            handleDisconnection();
            reject(error);
        }
    });
}

function handleDisconnection() {
    currentAppState = AppState.ERROR;
    clearCachedData();
    setOfflineStates();
}

function clearCachedData() {
    // Clear all cached data using the cache manager
    cacheManager.clearAll();

    // Reset playback modes
    CiderDeckPlayback.setCurrentRepeatMode(0);
    CiderDeckPlayback.setCurrentShuffleMode(0);

    // Clear marquee data
    CiderDeckMarquee.clearMarquee();

    // Reset volume-related variables
    CiderDeckVolume.resetVolumeState();
}

function handlePlaybackEvent({ data, type }) {
    if (!data && data !== 0) {
        CiderDeckPlayback.setDefaults();
        return;
    }
    
    switch (type) {
        case "playbackStatus.nowPlayingStatusDidChange":
            CiderDeckPlayback.setAdaptiveData(data);
            break;
        case "playbackStatus.nowPlayingItemDidChange":
            CiderDeckPlayback.setManualData(data);
            CiderDeckPlayback.updatePlaybackModes();
            break;
        case "playbackStatus.playbackStateDidChange":
            CiderDeckPlayback.setPlaybackStatus(data);
            if (data) CiderDeckPlayback.setData(data);
            break;
        case "playbackStatus.playbackTimeDidChange":
            CiderDeckPlayback.setPlaybackStatus(data.isPlaying);
            if (window.contexts.ciderPlaybackAction[0]) {
                window.currentPlaybackTime = data.currentPlaybackTime;
                CiderDeckPlayback.setPlaybackTime(data.currentPlaybackTime, data.currentPlaybackDuration);
            }
            break;
        case "playerStatus.volumeDidChange":
            if (window.contexts.ciderPlaybackAction[0]) {
                CiderDeckVolume.updateVolumeDisplay(window.contexts.ciderPlaybackAction[0], data);
            }
            break;
        case "playerStatus.repeatModeDidChange":
            CiderDeckPlayback.updateRepeatMode(data);
            break;
        case "playerStatus.shuffleModeDidChange":
            CiderDeckPlayback.updateShuffleMode(data);
            break;
        default:
            console.warn("[WARN] [Playback] Unhandled event type:", type);
    }
}

async function initialize() {
    if (!window.isConnected) {
        throw new Error("Attempted to initialize before WebSocket connection established.");
    }

    try {
        const data = await CiderDeckUtils.comRPC("GET", "now-playing");
        if (data.status === "ok") {
            if (data.info === 0) return;
            CiderDeckPlayback.setManualData(data.info);
            CiderDeckPlayback.setAdaptiveData(data.info);
            await CiderDeckPlayback.updatePlaybackModes();

            if(window.contexts.ciderPlaybackAction[0]) {
                CiderDeckVolume.initializeVolumeDisplay(actions.ciderPlaybackAction, window.contexts.ciderPlaybackAction[0]);
            }
        } else {
            throw new Error("Invalid response from now-playing endpoint");
        }
    } catch (error) {
        console.info("[ERROR] [Init] Failed to initialize:", error.message);
        throw error;
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
            CiderDeckPlayback.setCurrentRepeatMode(3);
        } else if (actionKey === 'shuffleAction') {
            offlineState = 2; // Disabled state for shuffle
            CiderDeckPlayback.setCurrentShuffleMode(2);
        }
        
        if (offlineState !== undefined) {
            contexts.forEach(context => {
                $SD.setState(context, offlineState);
                console.debug(`[DEBUG] [Offline] Set ${actionKey} to offline state: ${offlineState}`);
            });
        }

        if (actionKey === 'ciderPlaybackAction') {
            const feedbackPayload = {
                "icon1": "actions/assets/buttons/media-playlist",
                "icon2": "actions/assets/buttons/volume-off",
                "indicator1": 0,
                "indicator2": 0,
                "title": "Cider - Offline",
            };
            contexts.forEach(context => {
                $SD.setFeedback(context, feedbackPayload);
            });
        }
    });
}

function resetStates() {
    Object.keys(actions).forEach(actionKey => {
        const contexts = window.contexts[actionKey] || [];
        contexts.forEach(context => {
            if (actionKey === 'repeatAction') {
                CiderDeckPlayback.setCurrentRepeatMode(0);
                $SD.setState(context, 0);
            } else if (actionKey === 'shuffleAction') {
                CiderDeckPlayback.setCurrentShuffleMode(0);
                $SD.setState(context, 0);
            } else {
                $SD.setState(context, 0);
            }

            if (actionKey === 'albumArtAction') {
                $SD.setImage(context, "actions/assets/buttons/icon", 0);
            }

            if (actionKey === 'ciderPlaybackAction') {
                const feedbackPayload = {
                    "icon1": "actions/assets/buttons/media-playlist",
                    "icon2": "actions/assets/buttons/volume-off",
                    "title": "Cider - N/A",
                };
                $SD.setFeedback(context, feedbackPayload);
                console.log("[DEBUG] [Online] Set default feedback for Cider Playback Action.");
            } else {
                console.debug(`[DEBUG] [Online] Reset ${actionKey} to default state`);
            }
        });
    });
}
