/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

// RPC Authorization (Required for Cider 2.5.x and above)

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
    ciderLogoAction: new Action('sh.cider.streamdeck.ciderlogo')
};

// Ensure window.contexts is initialized
window.contexts = window.contexts || {};

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

$SD.onConnected(() => {
    console.debug('[DEBUG] [System] Stream Deck connected!');
    setDefaults();
    $SD.getGlobalSettings();
});

$SD.onDidReceiveGlobalSettings(({ payload }) => {
    window.token = payload.settings.authkey;
    checkAuthKey();
});

async function checkAuthKey() {
    if (!window.token) {
        $SD.showAlert("CiderDeck: Please enter your Cider authorization key in the plugin settings.");
        return;
    }
    try {
        const data = await comRPC("GET", "active", true);
        if (data.error || undefined || null) {
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
            }
        }).catch(console.error);

        CiderApp.on("API:Playback", ({ data, type }) => {
            if (!data) return setDefaults();
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
        const libraryIcon = inLibrary ? 'check.png' : 'add.png';
        window.contexts.addToLibraryAction?.forEach(context => setImage(context, `actions/playback/assets/${libraryIcon}`, 0));
        window.addedToLibrary = inLibrary;
        console.debug("[DEBUG] [Library] Updated library status:", inLibrary);
    }

    if (window.ratingCache !== inFavorites) {
        const likeIcon = inFavorites ? 'liked.png' : 'like.png';
        window.contexts.likeAction?.forEach(context => setImage(context, `actions/playback/assets/${likeIcon}`, 0));
        window.contexts.dislikeAction?.forEach(context => setImage(context, 'actions/playback/assets/dislike.png', 0));
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
        const art64 = await getBase64Image(artwork);
        window.contexts.albumArtAction?.forEach(context => setImage(context, art64, 0));
        logMessage += `Updated artwork: ${artwork}; `;
    }

    if (window.songCache !== songName) {
        window.songCache = songName;
        window.contexts.songNameAction?.forEach(context => setTitle(context, songName, 0));
        logMessage += `Updated song: ${songName}; Artist: ${artistName}; Album: ${albumName}; `;
    }

    const toggleIcon = state === "playing" ? 'pause.png' : 'play.png';
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

async function addToLibrary() {
    if (!window.addedToLibrary) {
        await comRPC("POST", "add-to-library", true);
        window.contexts.addToLibraryAction?.forEach(context => setImage(context, 'actions/playback/assets/check.png', 0));
        window.addedToLibrary = true;
        console.debug("[DEBUG] [Library] Added to library");
    }
}

let isChangingVolume = false;
async function setVolume(direction) {
    if (isChangingVolume) return;
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
