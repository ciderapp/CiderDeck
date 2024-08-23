/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

// RPC Authorization (Required for Cider 2.5.x and above)

$SD.onConnected(() => {
    console.debug('[DEBUG] [System] Stream Deck connected!');
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

let marqueeInterval;
let marqueePosition = 0;
let currentMarqueeText = '';
let isScrolling = false;
let MARQUEE_SPEED = 200; // Default value
let MARQUEE_STEP = 1;
let PAUSE_DURATION = 2000; // Default value
let DISPLAY_LENGTH = 15; // Default value
let marqueeEnabled = true;

let tapBehavior = 'addToLibrary';

let volumeStep = 1;
let pressBehavior = 'togglePlay';

let useAdaptiveIcons = false;
let rpcKey = null;

// Ensure window.contexts is initialized
window.contexts = window.contexts || {};

actions.ciderPlaybackAction.onTouchTap(() => {
    console.debug(`[DEBUG] [Action] ciderPlaybackAction action tapped.`);
    switch (tapBehavior) {
        case 'addToLibrary':
            addToLibrary();
            break;
        case 'favorite':
            setRating(1);
            break;
        default:
            addToLibrary();
            setRating(1);
            break;
    }
});

actions.ciderPlaybackAction.onDialDown(() => {
    console.debug(`[DEBUG] [Action] ciderPlaybackAction dial pressed`);
    switch (pressBehavior) {
        case 'togglePlay':
            comRPC("POST", "playpause");
            break;
        case 'toggleMute':
            muteVolume();
            break;
        default:
            comRPC("POST", "playpause");
            break;
    }
});


actions.ciderPlaybackAction.onDialRotate((jsonObj) => {
    setPreciseVolume(actions.ciderPlaybackAction, window.contexts.ciderPlaybackAction[0], jsonObj.payload, volumeStep);
});
    

// Action Initialization and Context Management
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
    });

    action.onWillDisappear(({ context }) => {
        const index = window.contexts[actionKey].indexOf(context);
        if (index > -1) {
            window.contexts[actionKey].splice(index, 1);
            console.debug(`[DEBUG] [Context] Context removed for ${actionKey}: ${context}`);
        }
    });

    // Stream Deck Action Handlers
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
                setVolume("up");
                break;
            case 'volumeDownAction':
                setVolume("down");
                break;
            case 'ciderLogoAction':
				console.warn(`[DEBUG] [Action] User must be high, why you clicking the logo?`);
                break;
            default:
                console.warn(`[DEBUG] [Action] No handler for ${actionKey}`);
                break;
        }
    });
});

// Receiving Global Settings
$SD.onDidReceiveGlobalSettings(({ payload }) => {
    console.debug(`[DEBUG] [Settings] Global settings received: ${JSON.stringify(payload.settings)}`);
    
    // Set the settings based on the received global settings
    useAdaptiveIcons = payload.settings.iconSettings?.useAdaptiveIcons || true;
    
    if (payload.settings.marqueeSettings) {
        marqueeEnabled = payload.settings.marqueeSettings.enabled !== false;
        MARQUEE_SPEED = payload.settings.marqueeSettings.speed || 200;
        PAUSE_DURATION = payload.settings.marqueeSettings.delay || 2000;
        DISPLAY_LENGTH = payload.settings.marqueeSettings.length || 15;
    }

    if (payload.settings.tapSettings) {
        pressBehavior = payload.settings.tapSettings.tapBehavior || 'addToLibrary';
    }

    if (payload.settings.knobSettings) {
        volumeStep = payload.settings.knobSettings.volumeStep || 1;
        pressBehavior = payload.settings.knobSettings.pressBehavior || 'togglePlay';
    }

    console.debug(`[DEBUG] [Settings] Adaptive icons: ${useAdaptiveIcons}; Marquee enabled: ${marqueeEnabled}; Speed: ${MARQUEE_SPEED}; Length: ${DISPLAY_LENGTH}; Delay: ${PAUSE_DURATION}`);

    rpcKey = payload.settings.authorization?.rpcKey || null;
    window.token = rpcKey;
    
    checkAuthKey();
});

async function checkAuthKey() {
    if (!window.token) {
        console.log("CiderDeck: Please enter your Cider authorization key in the plugin settings.");
        return;
    }
    try {
        const data = await comRPC("GET", "active", true);
        if (data.error) {
            alertContexts();
            $SD.getGlobalSettings();
        } else {
            startWebSocket();
        }
    } catch (error) {
        alertContexts();
        $SD.getGlobalSettings();
    }
}

async function startWebSocket() {
    try {
        const CiderApp = io('http://localhost:10767');

        await comRPC("GET", "now-playing").then(data => {
            if (data.status === "ok") {
                setManualData(data.info);
                setAdaptiveData(data.info);

                if(window.contexts.ciderPlaybackAction[0]) {
                    initializeVolumeDisplay(actions.ciderPlaybackAction, window.contexts.ciderPlaybackAction);
                };
            }
        }).catch(console.error);

        CiderApp.on("API:Playback", ({ data, type }) => {
            if (!data && data !== 0) return setDefaults();
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
                    if(window.contexts.ciderPlaybackAction[0]) { setPlaybackTime(data.currentPlaybackTime, data.currentPlaybackDuration); }
                    break;
            }
        });

        CiderApp.on("close", () => setTimeout(checkAuthKey, 5000));
        CiderApp.onerror = () => setTimeout(checkAuthKey, 5000);

    } catch (error) {
        // Retry connection on failure.
        $SD.getGlobalSettings();
    }
}

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
        if (window.contexts.ciderPlaybackAction[0]) {
            const fullTitle = `${songName} - ${albumName}`;
            clearMarquee();
            if (marqueeEnabled) {
                startMarquee(window.contexts.ciderPlaybackAction[0], fullTitle);
            } else {
                $SD.setFeedback(window.contexts.ciderPlaybackAction[0], { "title": fullTitle });
            }
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

async function addToLibrary() {
    if (!window.addedToLibrary) {
        await comRPC("POST", "add-to-library", true);
        window.contexts.addToLibraryAction?.forEach(context => setImage(context, 'actions/playback/assets/check.png', 0));
        window.addedToLibrary = true;
        console.debug("[DEBUG] [Library] Added to library");
    }
}

let isChangingVolume = false;
let isMuted = false;
let previousVolume;

async function setVolume(direction) {
    if (isChangingVolume) return;
    if (isMuted) { muteVolume(!isMuted); return};
    isChangingVolume = true;

    try {
        const { volume: audioData } = await comRPC("GET", "volume");
        const roundedVolume = Math.round(audioData * 20) / 20;
        const newVolume = direction === "up" ? Math.min(roundedVolume + 0.05, 1) : Math.max(roundedVolume - 0.05, 0);
        await comRPC("POST", "volume", true, { volume: newVolume });
        console.debug("[DEBUG] [Volume] Volume changed to:", newVolume);
    } catch (error) {
        console.error("Error changing volume:", error);
    } finally {
        isChangingVolume = false;
    }
}

async function muteVolume() {
    if (isChangingVolume) return;
    isChangingVolume = true;
    if (!isMuted) {
        previousVolume = await comRPC("GET", "volume").then(data => data.volume);
    }
    isMuted = !isMuted;

    try {
        const newVolume = isMuted ? 0 : previousVolume;
        await comRPC("POST", "volume", true, { volume: newVolume });
        console.debug("[DEBUG] [Volume] Volume changed to:", newVolume);

        // Update Stream Deck+ display
        if (window.contexts.ciderPlaybackAction[0]) {
            const feedbackPayload = {
                "indicator2": isMuted ? 0 : Math.round(previousVolume * 100),
            };
            $SD.setFeedback(window.contexts.ciderPlaybackAction[0], feedbackPayload);
        }
    } catch (error) {
        console.error("Error changing volume:", error);
    } finally {
        isChangingVolume = false;
    }
}

// Stream Deck + Exclusive Vol Control (Left/Right +1% and set progress bar on dial display)
async function setPreciseVolume(action, context, payload, volumeStep) {
    if (isChangingVolume) return;
    if (isMuted) { muteVolume(!isMuted); return};
    isChangingVolume = true;

    try {
        const { volume: currentVolume } = await comRPC("GET", "volume");
        let newVolume;

        if (payload.ticks !== undefined) {
            // Dial rotation
            // multiply 0.01 by volumeStep to adjust sensitivity (1-10)
            newVolume = Math.max(0, Math.min(1, currentVolume + (payload.ticks * 0.01 * volumeStep)));
        }

        await comRPC("POST", "volume", true, { volume: newVolume });
        console.debug("[DEBUG] [Volume] Volume changed to:", newVolume);

        // Update Stream Deck+ display
        const volumePercentage = Math.round(newVolume * 100);
        const feedbackPayload = {
            "indicator2": volumePercentage
        };
        $SD.setFeedback(context, feedbackPayload);

    } catch (error) {
        console.error("Error changing volume:", error);
    } finally {
        isChangingVolume = false;
    }
}

async function initializeVolumeDisplay(action, context, payload) {
    try {
        const { volume: currentVolume } = await comRPC("GET", "volume");
        const volumePercentage = Math.round(currentVolume * 100);

        const feedbackPayload = {
            "indicator2": volumePercentage,
            "icon2": "actions/playback/assets/volup"
        };
        $SD.setFeedback(context, feedbackPayload);

        console.debug("[DEBUG] [Volume] Display initialized with volume:", volumePercentage);
    } catch (error) {
        console.error("Error initializing volume display:", error);
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

function alertContexts() {
    Object.keys(window.contexts).forEach(actionKey => {
        window.contexts[actionKey].forEach(context => {
            $SD.showAlert(context);
            console.debug(`[DEBUG] [Alert] Alert shown for context: ${context}`);
        });
    });
}

async function comRPC(method, request, noCheck, _body) {
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

function clearMarquee() {
    if (marqueeInterval) {
        clearInterval(marqueeInterval);
        marqueeInterval = null;
    }
    marqueePosition = 0;
    currentMarqueeText = '';
    isScrolling = false;
}

function startMarquee(context, text) {
    clearMarquee();
    currentMarqueeText = text;
    updateMarqueeDisplay(context);
    
    setTimeout(() => {
        isScrolling = true;
        marqueeInterval = setInterval(() => {
            if (isScrolling) {
                marqueePosition += MARQUEE_STEP;
                updateMarqueeDisplay(context);
            }
        }, MARQUEE_SPEED);
    }, PAUSE_DURATION);
}

function updateMarqueeDisplay(context) {
    const totalTextLength = currentMarqueeText.length;
    
    if (marqueePosition >= totalTextLength) {
        isScrolling = false;
        marqueePosition = 0;
        updateMarqueeDisplay(context); // Display the start immediately
        setTimeout(() => {
            isScrolling = true;
        }, PAUSE_DURATION);
        return;
    }
    
    let visibleText = currentMarqueeText.substr(marqueePosition, DISPLAY_LENGTH);
    
    // Pad with spaces if we're near the end to avoid text wrapping
    if (visibleText.length < DISPLAY_LENGTH) {
        visibleText = visibleText.padEnd(DISPLAY_LENGTH, ' ');
    }
    
    //console.log(`Marquee position: ${marqueePosition}, Scrolling: ${isScrolling}, Displaying: "${visibleText}"`);
    $SD.setFeedback(context, { "title": visibleText });
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
