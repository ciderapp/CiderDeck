/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

// Initalize actions
const toggleAction = new Action('sh.cider.streamdeck.toggle');
const skipAction = new Action('sh.cider.streamdeck.skip');
const previousAction = new Action('sh.cider.streamdeck.previous');
const songNameAction = new Action('sh.cider.streamdeck.songname');
const albumArtAction = new Action('sh.cider.streamdeck.albumart');
const likeAction = new Action('sh.cider.streamdeck.like');
const dislikeAction = new Action('sh.cider.streamdeck.dislike');
const addToLibraryAction = new Action('sh.cider.streamdeck.addToLibrary');
const volumeUpAction = new Action('sh.cider.streamdeck.volumeUp');
const volumeDownAction = new Action('sh.cider.streamdeck.volumeDown');

/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(() => {
	console.debug('[DEBUG] [Init] Stream Deck connected!');
	setDefaults();
	setTimeout(startWebSocket(), 500);
});

// Initalize WebSocket Connection with Cider.

function startWebSocket() {
	try {
		// Connect to the websocket server
		console.debug('[DEBUG] [Init] Configuring websocket connection...');
		const CiderApp = new WebSocket('ws://localhost:10766');
		console.debug('[DEBUG] [Init] Websocket connection established!');

		// Set up websocket artwork/information handling

		CiderApp.onMessage = (event) => {
			console.debug('[DEBUG] [Init] Websocket message received:', event.data);

			if (event.data !== undefined || event.data !== null) {
				try {
					let playbackInfo = JSON.parse(event.data);
					setData(playbackInfo);
				} catch (error) {
					console.debug('[DEBUG] [Init] Websocket parsing error:', error);
				}
			} else {
				console.log("[DEBUG] [Init] Websocket message is undefined or null, skipping.")
				setDefaults();
			}
		}

		CiderApp.onClose = () => {
			console.debug('[DEBUG] [Init] Websocket connection closed!');
			setDefaults();
			console.debug("[DEBUG] [Init] Retrying in 5 seconds...")
			setTimeout(startWebSocket, 5000);
		}

		CiderApp.onError = (error) => {
			console.debug('[DEBUG] [Init] Websocket error:', error);
			setDefaults();
			console.debug("[DEBUG] [Init] Retrying in 5 seconds...")
			setTimeout(startWebSocket, 5000);
		}

	} catch (error) {
		console.debug('[DEBUG] [Init] Websocket error:', error);
		console.debug("[DEBUG] [Init] Retrying in 5 seconds...")
		setTimeout(startWebSocket, 5000);
	}
}

// Set defaults on plugin load

async function setDefaults () {
	console.debug("[DEBUG] [Actions] Setting default state.")
	// Set defaults.
    forEach(window.contexts.toggleAction, function (context) {
	    setImage(context, 'actions/playback/assets/play.png', 0);
    });

    forEach(window.contexts.albumArtAction, function (context) {
		setImage(context, 'actions/playback/assets/icon.png', 0);
    });
        
    forEach(window.contexts.songNameAction, function (context) {
		setTitle(context, "No Song Playing", 0)
    });

	forEach(window.contexts.dislikeAction, function (context) {
		setImage(context, 'actions/playback/assets/dislike.png', 0);
	});

	forEach(window.contexts.likeAction, function (context) {
		setImage(context, 'actions/playback/assets/like.png', 0);
	});

	forEach(window.contexts.addToLibraryAction, function (context) {
		setImage(context, 'actions/playback/assets/add.png', 0);
	});

	forEach(window.contexts.volumeUpAction, function (context) {
		setImage(context, 'actions/playback/assets/volumeup.png', 0);
	});

	forEach(window.contexts.volumeDownAction, function (context) {
		setImage(context, 'actions/playback/assets/volumedown.png', 0);
	});
}

// Album Art & Song Name event handling

async function setData(playbackInfo) {
	setPlaybackStatus(playbackInfo);
	// Set variables for artwork and song name
	window.artwork = playbackInfo.info?.artwork?.url?.replace('{w}', '100').replace('{h}', '100');
	window.artworkCache;
	window.songCache;

	// Cache artwork and song name to prevent unnecessary updates
	if (window.artworkCache !== window.artwork) {
		window.artworkCache = window.artwork;
		console.debug("[DEBUG] [Artwork] Artwork is different, updating.")
		let art64 = await getBase64Image(artwork);
        forEach(window.contexts.albumArtAction, function (context) {
		    setImage(context, art64, 0);
        });
	}
	if (window.songCache !== playbackInfo.info?.name) {
		window.songCache = playbackInfo.info?.name;
		console.debug("[DEBUG] [SongName] Song is different, updating.")
		window.addedToLibrary = false;
		forEach(window.contexts.addToLibraryAction, function (context) {
			setImage(context, 'actions/playback/assets/add.png', 0);
		});
        forEach(window.contexts.songNameAction, function (context) {
		    setTitle(context, playbackInfo.info?.name, 0)
        });
	}
	// Set Action to use the correct icon
	if (playbackInfo.info?.status === "playing") {
        forEach(window.contexts.toggleAction, function (context) {
		    setImage(context, 'actions/playback/assets/pause.png', 0);
        })
	}
	else if (playbackInfo.info?.status === "paused") {
        forEach(window.contexts.toggleAction, function (context) {
		    setImage(context, 'actions/playback/assets/play.png', 0);
        });
	}

	// Set like/dislike icons depending on current song rating.
	try {
		comRPC("GET", `rating/${playbackInfo.info?.playParams?.kind}/${playbackInfo.info?.songId}`).then((ratingData) => {
			window.ratingCache = ratingData[0].attributes.value;

			switch (ratingData[0].attributes.value) {
				case 1:
					forEach(window.contexts.likeAction, function (context) {
						setImage(context, 'actions/playback/assets/liked.png', 0);
					});
					forEach(window.contexts.dislikeAction, function (context) {
						setImage(context, 'actions/playback/assets/dislike.png', 0);
					});
					break;
				case -1:
					forEach(window.contexts.likeAction, function (context) {
						setImage(context, 'actions/playback/assets/like.png', 0);
					});
					forEach(window.contexts.dislikeAction, function (context) {
						setImage(context, 'actions/playback/assets/disliked.png', 0);
					});
					break;
				case 0:
					forEach(window.contexts.likeAction, function (context) {
						setImage(context, 'actions/playback/assets/like.png', 0);
					});
					forEach(window.contexts.dislikeAction, function (context) {
						setImage(context, 'actions/playback/assets/dislike.png', 0);
					});
					break;
				}
		})
	} catch (error) {
		console.debug("[DEBUG] [ERROR] An error occurred while processing the rating:", error);
	}
}

// Playback Status event handling

async function setPlaybackStatus(status) {
	if (window.statusCache !== status.isPlaying) {
		window.statusCache = status.isPlaying;
		console.debug("[DEBUG] [Status] Status is different, updating.")
		if (status.isPlaying) {
			console.debug("[DEBUG] [Status] Setting as playing.")
            forEach(window.contexts.toggleAction, function (context) {
			    setImage(context, 'actions/playback/assets/pause.png', 0);
            });
		} else if (!status.isPlaying) {
			console.debug("[DEBUG] [Status] Setting as paused.")
            forEach(window.contexts.toggleAction, function (context) {
			    setImage(context, 'actions/playback/assets/play.png', 0);
            });
		}
	}
}

// Library status event handling

async function addToLibrary() {
	if (!window.addedToLibrary) {
		comRPC("GET", "addToLibrary");
		forEach(window.contexts.addToLibraryAction, function (context) {
			setImage(context, 'actions/playback/assets/check.png', 0);
		});
		window.addedToLibrary = true;
	} else {
		console.log("[DEBUG] [Library] Song is already in library, skipping.")
	}
}

// Volume Up/Down event handling

async function setVolume(direction) {
	comRPC("GET", "audio").then((audioData) => {
		// Round to nearest 10% for convenience.
		const roundedVolume = Math.round(audioData * 10) / 10;
		
		// Calculate the new volume.
		let newVolume;
  		if (direction === "up") {
    		newVolume = Math.min(roundedVolume + 0.1, 1); // Ensure the volume doesn't exceed 1
  		} else if (direction === "down") {
    		newVolume = Math.max(roundedVolume - 0.1, 0); // Ensure the volume doesn't go below 0
  		} else {
    		console.error("Invalid action");
    		return;
  		}

		// Finally, set the volume.
		comRPC("GET", "audio/"+newVolume);
	});
}


// Like/Dislike event handling

async function setRating(rating) {
	if (window.ratingCache !== rating) {
		// Rating is different, update.
		comRPC("PUT", `rating/${playbackInfo.info?.playParams?.kind}/${playbackInfo.info?.songId}/${rating}`);
		switch (rating) {
			case 1:
				forEach(window.contexts.likeAction, function (context) {
					setImage(context, 'actions/playback/assets/liked.png', 0);
				});
				forEach(window.contexts.dislikeAction, function (context) {
					setImage(context, 'actions/playback/assets/dislike.png', 0);
				});
				window.ratingCache = 1;
				break;
			case -1:
				forEach(window.contexts.likeAction, function (context) {
					setImage(context, 'actions/playback/assets/like.png', 0);
				});
				forEach(window.contexts.dislikeAction, function (context) {
					setImage(context, 'actions/playback/assets/disliked.png', 0);
				});
				window.ratingCache = -1;
				break;
			case 0:
				forEach(window.contexts.likeAction, function (context) {
					setImage(context, 'actions/playback/assets/like.png', 0);
				});
				forEach(window.contexts.dislikeAction, function (context) {
					setImage(context, 'actions/playback/assets/dislike.png', 0);
				});
				window.ratingCache = 0;
				break;
		}
	} else {
		// Rating is the same reset to 0, assume the user wants to reset the rating.
		forEach(window.contexts.likeAction, function (context) {
			setImage(context, 'actions/playback/assets/like.png', 0);
		});
		forEach(window.contexts.dislikeAction, function (context) {
			setImage(context, 'actions/playback/assets/dislike.png', 0);
		});
		window.ratingCache = 0;
	}
}


				

// Key events
toggleAction.onKeyDown(() => {
	comRPC("GET", "playPause");
	setTimeout(setPlaybackStatus, 500);
});
skipAction.onKeyDown(() => {
	comRPC("GET", "next");
});
previousAction.onKeyDown(() => {
	comRPC("GET", "previous");
});
likeAction.onKeyDown(() => {
	setRating(1);
});
dislikeAction.onKeyDown(() => {
	setRating(-1);
});
addToLibraryAction.onKeyDown(() => {
	addToLibrary();
});
volumeUpAction.onKeyDown(() => {
	setVolume("up");
});
volumeDownAction.onKeyDown(() => {
	setVolume("down");
});


// Initalize window.contexts

window.contexts = {
    toggleAction : [],
    skipAction : [],
    previousAction : [],
    songNameAction : [],
    albumArtAction : [],
	likeAction : [],
    dislikeAction : [],
	addToLibraryAction : [],
	volumeUpAction : [],
	volumeDownAction : []
};

// Await the contexts and add them to the array.

toggleAction.onWillAppear(({ context }) => {
	if (window.contexts.toggleAction.indexOf(context) > -1) {
		window.contexts.toggleAction.push(context);
	}
});
skipAction.onWillAppear(({ context }) => {
	if (window.contexts.skipAction.indexOf(context) > -1) {
		window.contexts.skipAction.push(context);
	}
});
previousAction.onWillAppear(({ context }) => {
	if (window.contexts.previousAction.indexOf(context) > -1) {
		window.contexts.previousAction.push(context);
	}
});
songNameAction.onWillAppear(({ context }) => {
	if (window.contexts.songNameAction.indexOf(context) > -1) {
		window.contexts.songNameAction.push(context);
	}
});
albumArtAction.onWillAppear(({ context }) => {
	if (window.contexts.albumArtAction.indexOf(context) > -1) {
		window.contexts.albumArtAction.push(context);
	}
});
likeAction.onWillAppear(({ context }) => {
	if (window.contexts.likeAction.indexOf(context) > -1) {
		window.contexts.likeAction.push(context);
	}
});
dislikeAction.onWillAppear(({ context }) => {
	if (window.contexts.dislikeAction.indexOf(context) > -1) {
		window.contexts.dislikeAction.push(context);
	}
});
addToLibraryAction.onWillAppear(({ context }) => {
	if (window.contexts.toggleLibraryAction.indexOf(context) > -1) {
		window.contexts.toggleLibraryAction.push(context);
	}
});
volumeUpAction.onWillAppear(({ context }) => {
	if (window.contexts.volumeUpAction.indexOf(context) > -1) {
		window.contexts.volumeUpAction.push(context);
	}
});
volumeDownAction.onWillAppear(({ context }) => {
	if (window.contexts.volumeDownAction.indexOf(context) > -1) {
		window.contexts.volumeDownAction.push(context);
	}
});

// Handle onWillDisappear events

toggleAction.onWillDisappear(({ context }) => {
	if (window.contexts.toggleAction.indexOf(context) > -1) {
		window.contexts.toggleAction.splice(window.contexts.toggleAction.indexOf(context), 1);
	}
});
skipAction.onWillDisappear(({ context }) => {
	if (window.contexts.skipAction.indexOf(context) > -1) {
		window.contexts.skipAction.splice(window.contexts.skipAction.indexOf(context), 1);
	}
});
previousAction.onWillDisappear(({ context }) => {
	if (window.contexts.previousAction.indexOf(context) > -1) {
		window.contexts.previousAction.splice(window.contexts.previousAction.indexOf(context), 1);
	}
});
songNameAction.onWillDisappear(({ context }) => {
	if (window.contexts.songNameAction.indexOf(context) > -1) {
		window.contexts.songNameAction.splice(window.contexts.songNameAction.indexOf(context), 1);
	}
});
albumArtAction.onWillDisappear(({ context }) => {
	if (window.contexts.albumArtAction.indexOf(context) > -1) {
		window.contexts.albumArtAction.splice(window.contexts.albumArtAction.indexOf(context), 1);
	}
});
likeAction.onWillDisappear(({ context }) => {
	if (window.contexts.likeAction.indexOf(context) > -1) {
		window.contexts.likeAction.splice(window.contexts.likeAction.indexOf(context), 1);
	}
});
dislikeAction.onWillDisappear(({ context }) => {
	if (window.contexts.dislikeAction.indexOf(context) > -1) {
		window.contexts.dislikeAction.splice(window.contexts.dislikeAction.indexOf(context), 1);
	}
});
addToLibraryAction.onWillDisappear(({ context }) => {
	if (window.contexts.toggleLibraryAction.indexOf(context) > -1) {
		window.contexts.toggleLibraryAction.splice(window.contexts.toggleLibraryAction.indexOf(context), 1);
	}
});
volumeUpAction.onWillDisappear(({ context }) => {
	if (window.contexts.volumeUpAction.indexOf(context) > -1) {
		window.contexts.volumeUpAction.splice(window.contexts.volumeUpAction.indexOf(context), 1);
	}
});
volumeDownAction.onWillDisappear(({ context }) => {
	if (window.contexts.volumeDownAction.indexOf(context) > -1) {
		window.contexts.volumeDownAction.splice(window.contexts.volumeDownAction.indexOf(context), 1);
	}
});

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
	if (action !== null && image !== null && context !== null) {
		$SD.setImage(action, image, context);
	}
}
function setTitle(action, title, context) {
	if (action !== null && title !== null && context !== null) {
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