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
const addToLibraryAction = new Action('sh.cider.streamdeck.addtolibrary');
const volumeUpAction = new Action('sh.cider.streamdeck.volumeup');
const volumeDownAction = new Action('sh.cider.streamdeck.volumedown');
const ciderLogoAction = new Action('sh.cider.streamdeck.ciderlogo');

/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(() => {
	console.debug('[DEBUG] [Init] Stream Deck connected!');
	console.debug("[DEBUG] [Contexts] Available Contexts:", window.contexts);
	setDefaults();
	setTimeout(startWebSocket, 500);
});

// Initalize WebSocket Connection with Cider.

function startWebSocket() {
	try {
		// Connect to the websocket server
		console.debug('[DEBUG] [Init] Configuring websocket connection...');
		const CiderApp = new WebSocket('ws://localhost:10766/ws');
		console.debug('[DEBUG] [Init] Websocket connection established!');

		// Set up websocket artwork/information handling

		CiderApp.addEventListener("message", (event) => {

			// Parse data if it's not null or undefined.
			let parsedEvent;

			try {
				parsedEvent = JSON.parse(event.data);
			} catch (error) {
				console.debug("[DEBUG] [Init] Websocket message is not JSON, skipping.")
				return;
			}

			// Check if the event is null or undefined, if so, set defaults.
			if (event.data === undefined || event.data === null) {
				console.log("[DEBUG] [Init] Websocket message is undefined or null, skipping.")
				setDefaults();
				return;
			}
			
			// Check nowPlayingStatusDidChange event, set library and like/dislike status into cache and update the context.
			if (parsedEvent.type === "playbackStatus.nowPlayingStatusDidChange") {
				setAdaptiveData(parsedEvent.data);
			} else if (parsedEvent.type === "playbackStatus.playbackTimeDidChange") {
				if (parsedEvent.data?.status !== undefined || parsedEvent.data?.artwork?.url !== undefined || parsedEvent.data?.name !== undefined) {
					setData(parsedEvent);
				}
			}
		});

		CiderApp.addEventListener("close", (event) => {
			console.debug('[DEBUG] [Init] Websocket connection closed!');
			setDefaults();
			console.debug("[DEBUG] [Init] Retrying in 5 seconds...")
			setTimeout(startWebSocket, 5000);
		});

		CiderApp.addEventListener("error", (event) => {
			console.debug('[DEBUG] [Init] Websocket error:', error);
			setDefaults();
			console.debug("[DEBUG] [Init] Retrying in 5 seconds...")
			setTimeout(startWebSocket, 5000);
		});

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
    window.contexts.toggleAction.forEach(function (context) {
	    setImage(context, 'actions/playback/assets/play.png', 0);
    });

    window.contexts.albumArtAction.forEach(function (context) {
		setImage(context, 'actions/playback/assets/icon.png', 0);
    });
        
    window.contexts.songNameAction.forEach(function (context) {
		setTitle(context, "No Song Playing", 0)
    });

	window.contexts.dislikeAction.forEach(function (context) {
		setImage(context, 'actions/playback/assets/dislike.png', 0);
	});

	window.contexts.likeAction.forEach(function (context) {
		setImage(context, 'actions/playback/assets/like.png', 0);
	});

	window.contexts.addToLibraryAction.forEach(function (context) {
		setImage(context, 'actions/playback/assets/add.png', 0);
	});

	window.contexts.volumeUpAction.forEach(function (context) {
		setImage(context, 'actions/playback/assets/volumeup.png', 0);
	});

	window.contexts.volumeDownAction.forEach(function (context) {
		setImage(context, 'actions/playback/assets/volumedown.png', 0);
	});

	window.contexts.ciderLogoAction.forEach(function (context) {
		setImage(context, 'actions/playback/assets/icon.png', 0);
	});
}

async function setAdaptiveData(libraryInfo) {
	// Set library icon depending on current song library status.

	switch (libraryInfo?.inLibrary) {
		case true:
			window.contexts.addToLibraryAction.forEach(function (context) {
				setImage(context, 'actions/playback/assets/check.png', 0);
			});
			window.addedToLibrary = true;
			break;
		case false:
			window.contexts.addToLibraryAction.forEach(function (context) {
				setImage(context, 'actions/playback/assets/add.png', 0);
			});
			window.addedToLibrary = false;
			break;
	}

	// Set like/dislike icons depending on current song rating.

	switch (libraryInfo?.inFavorites) {
		case true:
			window.contexts.likeAction.forEach(function (context) {
				setImage(context, 'actions/playback/assets/liked.png', 0);
			});
			window.contexts.dislikeAction.forEach(function (context) {
				setImage(context, 'actions/playback/assets/dislike.png', 0);
			});
			window.ratingCache = 1;
			break;
		case false:
			window.contexts.likeAction.forEach(function (context) {
				setImage(context, 'actions/playback/assets/like.png', 0);
			});
			window.contexts.dislikeAction.forEach(function (context) {
				setImage(context, 'actions/playback/assets/dislike.png', 0);
			});
			window.ratingCache = 0;
			break;
	}

	return;
}

// Album Art & Song Name event handling
async function setData(playbackInfo) {
	setPlaybackStatus(playbackInfo.data?.status);

	// Set variables for artwork and song name
	window.artwork = playbackInfo.data?.artwork?.url?.replace('{w}', '100').replace('{h}', '100');
	window.artworkCache;
	window.songCache;
	window.kind = playbackInfo.data?.playParams?.kind;
	window.id = playbackInfo.data?.playParams?.id;

	// Cache artwork and song name to prevent unnecessary updates
	if (window.artworkCache !== window.artwork) {
		window.artworkCache = window.artwork;
		console.debug("[DEBUG] [Artwork] Artwork is different, updating.")
		let art64 = await getBase64Image(artwork);
        window.contexts.albumArtAction.forEach(function (context) {
		    setImage(context, art64, 0);
        });
	}
	if (window.songCache !== playbackInfo.data?.name) {
		window.songCache = playbackInfo.data?.name;
		console.debug("[DEBUG] [SongName] Song is different, updating.")
		window.addedToLibrary = false;
		window.contexts.addToLibraryAction.forEach(function (context) {
			setImage(context, 'actions/playback/assets/add.png', 0);
		});
        window.contexts.songNameAction.forEach(function (context) {
		    setTitle(context, playbackInfo.data?.name, 0)
        });
	}

	// Set Action to use the correct icon
	if (playbackInfo.data?.status === "playing") {
        window.contexts.toggleAction.forEach(function (context) {
		    setImage(context, 'actions/playback/assets/pause.png', 0);
        })
	}
	else if (playbackInfo.data?.status === "paused") {
        window.contexts.toggleAction.forEach(function (context) {
		    setImage(context, 'actions/playback/assets/play.png', 0);
        });
	}

	return;
}

// Playback Status event handling

async function setPlaybackStatus(status) {
	if (window.statusCache !== status) {
		window.statusCache = status;
		console.debug("[DEBUG] [Status] Status is different, updating.")
		if (status) {
			console.debug("[DEBUG] [Status] Setting as playing.")
            window.contexts.toggleAction.forEach(function (context) {
			    setImage(context, 'actions/playback/assets/pause.png', 0);
            });
		} else if (!status) {
			console.debug("[DEBUG] [Status] Setting as paused.")
            window.contexts.toggleAction.forEach(function (context) {
			    setImage(context, 'actions/playback/assets/play.png', 0);
            });
		}
	}
}

// Library status event handling

async function addToLibrary(playbackInfo) {
	if (!window.addedToLibrary) {
		comRPC("GET", "addToLibrary", true);
		window.contexts.addToLibraryAction.forEach(function (context) {
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
		comRPC("GET", "audio/"+newVolume, true);
	});
}


// Like/Dislike event handling

async function setRating(rating) {
	if (window.ratingCache !== rating) {
		console.debug("[DEBUG] [Status] Rating is different, updating.")
		comRPC("PUT", `setRating/${rating}`, true);
		switch (rating) {
			case 1:
				window.contexts.likeAction.forEach(function (context) {
					setImage(context, 'actions/playback/assets/liked.png', 0);
				});
				window.contexts.dislikeAction.forEach(function (context) {
					setImage(context, 'actions/playback/assets/dislike.png', 0);
				});
				window.ratingCache = 1;
				break;
			case -1:
				window.contexts.likeAction.forEach(function (context) {
					setImage(context, 'actions/playback/assets/like.png', 0);
				});
				window.contexts.dislikeAction.forEach(function (context) {
					setImage(context, 'actions/playback/assets/disliked.png', 0);
				});
				window.ratingCache = -1;
				break;
			case 0:
				window.contexts.likeAction.forEach(function (context) {
					setImage(context, 'actions/playback/assets/like.png', 0);
				});
				window.contexts.dislikeAction.forEach(function (context) {
					setImage(context, 'actions/playback/assets/dislike.png', 0);
				});
				window.ratingCache = 0;
				break;
		}
	} else {
		// Rating is the same reset to 0, assume the user wants to reset the rating.
		window.contexts.likeAction.forEach(function (context) {
			setImage(context, 'actions/playback/assets/like.png', 0);
		});
		window.contexts.dislikeAction.forEach(function (context) {
			setImage(context, 'actions/playback/assets/dislike.png', 0);
		});
		comRPC("PUT", `rating/${await window.kind}/${await window.id}/${rating}`, true);
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
	volumeDownAction : [],
	ciderLogoAction : []
};

// Await the contexts and add them to the array.

toggleAction.onWillAppear(({ context }) => {
	if (window.contexts.toggleAction.indexOf(context) === -1) {
		window.contexts.toggleAction.push(context);
	}
});
skipAction.onWillAppear(({ context }) => {
	if (window.contexts.skipAction.indexOf(context) === -1) {
		window.contexts.skipAction.push(context);
	}
});
previousAction.onWillAppear(({ context }) => {
	if (window.contexts.previousAction.indexOf(context) === -1) {
		window.contexts.previousAction.push(context);
	}
});
songNameAction.onWillAppear(({ context }) => {
	if (window.contexts.songNameAction.indexOf(context) === -1) {
		window.contexts.songNameAction.push(context);
	}
});
albumArtAction.onWillAppear(({ context }) => {
	if (window.contexts.albumArtAction.indexOf(context) === -1) {
		window.contexts.albumArtAction.push(context);
	}
});
likeAction.onWillAppear(({ context }) => {
	if (window.contexts.likeAction.indexOf(context) === -1) {
		window.contexts.likeAction.push(context);
	}
});
dislikeAction.onWillAppear(({ context }) => {
	if (window.contexts.dislikeAction.indexOf(context) === -1) {
		window.contexts.dislikeAction.push(context);
	}
});
addToLibraryAction.onWillAppear(({ context }) => {
	if (window.contexts.addToLibraryAction.indexOf(context) === -1) {
		window.contexts.addToLibraryAction.push(context);
	}
});
volumeUpAction.onWillAppear(({ context }) => {
	if (window.contexts.volumeUpAction.indexOf(context) === -1) {
		window.contexts.volumeUpAction.push(context);
	}
});
volumeDownAction.onWillAppear(({ context }) => {
	if (window.contexts.volumeDownAction.indexOf(context) === -1) {
		window.contexts.volumeDownAction.push(context);
	}
});
ciderLogoAction.onWillAppear(({ context }) => {
	if (window.contexts.ciderLogoAction.indexOf(context) === -1) {
		window.contexts.ciderLogoAction.push(context);
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
ciderLogoAction.onWillDisappear(({ context }) => {
	if (window.contexts.ciderLogoAction.indexOf(context) > -1) {
		window.contexts.ciderLogoAction.splice(window.contexts.ciderLogoAction.indexOf(context), 1);
	}
});

// RPC Function for Key Events
async function comRPC(method, request, noCheck) {
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
  	.catch(error => {if (!noCheck) { console.debug("[DEBUG] [ERROR] An error occurred while processing the request:", error) }});
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