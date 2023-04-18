/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />
const toggleAction = new Action('sh.cider.streamdeck.toggle');
const skipAction = new Action('sh.cider.streamdeck.skip');
const previousAction = new Action('sh.cider.streamdeck.previous');
const songNameAction = new Action('sh.cider.streamdeck.songname');
const albumArtAction = new Action('sh.cider.streamdeck.albumart');
/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(() => {
	console.debug('[DEBUG] [Init] Stream Deck connected!');
	setInterval(setData, 4000);
});
// Album Art & Song Name event handling
async function setData() {
	const playbackInfo = await grabPlaybackInfo();

	if (playbackInfo === undefined) {
		console.debug("[DEBUG] [PlaybackInfo] Playback info is undefined, skipping.")
		// Set defaults.
	    setImage(window.toggleActionContext, 'actions/playback/assets/play.png', 0);
		setImage(window.albumArtActionContext, 'actions/playback/assets/icon.png', 0);
		setTitle(window.songNameActionContext, "No Song Playing", 0)
		return;
	}
	setPlaybackStatus();
	// Set variables for artwork and song name
	window.artwork = playbackInfo.info?.artwork?.url?.replace('{w}', '100').replace('{h}', '100');
	window.artworkCache;
	window.songCache;
	// Cache artwork and song name to prevent unnecessary updates
	if (window.artworkCache !== window.artwork) {
		window.artworkCache = window.artwork;
		console.debug("[DEBUG] [Artwork] Artwork is different, updating.")
		let art64 = await getBase64Image(artwork);
		setImage(window.albumArtActionContext, art64, 0);
	}
	if (window.songCache !== playbackInfo.info?.name) {
		window.songCache = playbackInfo.info?.name;
		console.debug("[DEBUG] [SongName] Song is different, updating.")
		setTitle(window.songNameActionContext, playbackInfo.info?.name, 0)
	}
	// Set Action to use the correct icon
	if (playbackInfo.info?.status === "playing") {
		setImage(window.toggleActionContext, 'actions/playback/assets/pause.png', 0);
	}
	else if (playbackInfo.info?.status === "paused") {
		setImage(window.toggleActionContext, 'actions/playback/assets/play.png', 0);
	}
}
async function setPlaybackStatus() {
	// Set Action to use the correct icon
	let status = await comRPC("GET", "isPlaying");
	if (window.statusCache !== status.is_playing) {
		window.statusCache = status.is_playing;
		console.debug("[DEBUG] [Status] Status is different, updating.")
		if (status.is_playing) {
			console.debug("[DEBUG] [Status] Setting as playing.")
			setImage(window.toggleActionContext, 'actions/playback/assets/pause.png', 0);
		} else if (!status.is_playing) {
			console.debug("[DEBUG] [Status] Setting as paused.")
			setImage(window.toggleActionContext, 'actions/playback/assets/play.png', 0);
		}
	}
}
// Key events
toggleAction.onKeyUp(() => {
	comRPC("GET", "playPause");
	setTimeout(setPlaybackStatus, 500);
});
skipAction.onKeyUp(() => {
	comRPC("GET", "next");
	setTimeout(setData, 500);
});
previousAction.onKeyUp(() => {
	comRPC("GET", "previous");
	setTimeout(setData, 500);
});
// Fetch Contexts
toggleAction.onWillAppear(({ context }) => {
	console.debug("[DEBUG] [Context] ToggleContext: " + context)
	window.toggleActionContext = context;
});
skipAction.onWillAppear(({ context }) => {
	console.debug("[DEBUG] [Context] SkipContext: " + context)
	window.skipActionContext = context;
});
previousAction.onWillAppear(({ context }) => {
	console.debug("[DEBUG] [Context] PreviousContext: " + context)
	window.previousActionContext = context;
});
songNameAction.onWillAppear(({ context }) => {
	console.debug("[DEBUG] [Context] SongNameContext: " + context)
	window.songNameActionContext = context;
});
albumArtAction.onWillAppear(({ context }) => {
	console.debug("[DEBUG] [Context] AlbumArtContext: " + context)
	window.albumArtActionContext = context;
});
// Runtime Timer for playback info fetching.
async function grabPlaybackInfo() {
	return fetch('http://localhost:10769/currentPlayingSong', {
		method: 'GET',
		headers: {
		  'Content-Type': 'application/json'
		},
	})
	.then(response => response.json())
	.then(json => {
		return json;
	})
	.catch(error => console.debug("[DEBUG] [ERROR] An error occurred while processing the request:", error));
}
// RPC Function for Key Events
async function comRPC(method, request) {
	return fetch('http://localhost:10769/'+request, {
  		method: method,
  		headers: {
    		'Content-Type': 'application/json'
  		},
	})
  	.then(response => response.json())
  	.then(json => {
		return json;
	})
  	.catch(error => console.debug("[DEBUG] [ERROR] An error occurred while processing the request:", error));
}
// Utility Functions
function setImage(action, image, context) {
	console.log("[DEBUG] IM GETTING CALLED IMAGE")
	if (action !== null && image !== null && context !== null) {
		console.log("[DEBUG] IM GETTING CALLED IMAGE 2")
		$SD.setImage(action, image, context);
	}
}
function setTitle(action, title, context) {
	console.log("[DEBUG] IM GETTING CALLED SONG")
	if (action !== null && title !== null && context !== null) {
		console.log("[DEBUG] IM GETTING CALLED SONG 2")
		$SD.setTitle(action, title, context);
	}
}
function getBase64Image(url) {
	return new Promise((resolve, reject) => {
	  const image = new Image();
	  image.crossOrigin = 'anonymous';
	  image.onload = function() {
		const canvas = document.createElement('canvas');
		canvas.width = this.naturalWidth;
		canvas.height = this.naturalHeight;
		canvas.getContext('2d').drawImage(this, 0, 0);
		const base64 = canvas.toDataURL('image/png');
		resolve(base64);
	  };
	  image.onerror = function() {
		reject(new Error('Failed to load image'));
	  };
	  image.src = url;
	});
}