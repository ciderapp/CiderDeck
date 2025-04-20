/**
 * CiderDeck Library & Rating Functions
 * Handles adding songs to library and managing ratings
 */

// Create module-specific loggers
const libraryLogger = window.CiderDeckLogger?.createLogger('Library') || {
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
const ratingLogger = libraryLogger.category('Rating');
const stationLogger = libraryLogger.category('Station');

/**
 * Adds the current song to the user's library
 */
async function addToLibrary() {
    if (!window.cacheManager.get('addedToLibrary')) {
        libraryLogger.info("Adding current song to library");
        await window.CiderDeckUtils.comRPC("POST", "add-to-library", true);
        window.contexts.addToLibraryAction?.forEach(context => {
            $SD.setState(context, 1);
        });
        window.cacheManager.set('addedToLibrary', true);
        libraryLogger.debug("Song successfully added to library");
    } else {
        libraryLogger.debug("Song is already in library, skipping add operation");
    }
}

/**
 * Sets the rating for the current song
 * @param {number} ratingValue - Rating value (1 for like, -1 for dislike, 0 for none)
 */
async function setRating(ratingValue) {
    const currentRating = window.cacheManager.get('rating');
    
    if (currentRating !== ratingValue) {
        // Convert numeric rating to descriptive string for logs
        const ratingDescription = 
            ratingValue === 1 ? 'liked' :
            ratingValue === -1 ? 'disliked' :
            'removed rating from';
            
        ratingLogger.info(`${ratingValue === currentRating ? 'Maintaining' : 'Setting'} song as ${ratingDescription}`);
        
        await window.CiderDeckUtils.comRPC("POST", "set-rating", true, { rating: ratingValue });

        window.contexts.likeAction?.forEach(context => {
            $SD.setState(context, ratingValue === 1 ? 1 : 0);
        });
        window.contexts.dislikeAction?.forEach(context => {
            $SD.setState(context, ratingValue === -1 ? 1 : 0);
        });

        window.cacheManager.set('rating', ratingValue);
        ratingLogger.debug(`Rating updated to: ${ratingValue}`);
        
        // If this is a "like" (rating = 1) and the alsoAddToLibrary setting is enabled,
        // also add the song to the library
        if (ratingValue === 1) {
            const alsoAddToLibrary = window.ciderDeckSettings?.favorite?.alsoAddToLibrary ?? false;
            if (alsoAddToLibrary && !window.cacheManager.get('addedToLibrary')) {
                ratingLogger.debug("Also adding song to library due to favorite setting");
                await addToLibrary();
            }
        }
    } else {
        ratingLogger.debug(`Song already has rating ${ratingValue}, no change needed`);
    }
}

/**
 * Play a station selected by user
 * @param {string} stationType - Type of station to play
 */
async function playStation(stationType) {
    // This function will play a station selected by the user via a property inspector
    // Could be either Discovery, Personal, or Focus stations
    console.debug("[DEBUG] [Stations] Function not yet implemented");
}

/**
 * Play a mix selected by user
 * @param {string} mixId - ID of mix to play
 */
async function playMix(mixId) {
    // This function will play a mix selected by the user via a property inspector
    // New Music Mix, Friends Mix, Get Up Mix, Chill Mix, Heavy Rotation Mix, or Favorites Mix
    console.debug("[DEBUG] [Mixes] Function not yet implemented");
}

// Playlist functions

/**
 * Find action keys binded to playlists
 */
async function findBindedKeys(actionKeys, configStore) {
    // This function fetches all the action keys and looks for any tied to playlists
    console.debug("[DEBUG] [Playlists] findBindedKeys not yet implemented");
}

/**
 * Bind a playlist to an action key
 */
async function bindPlaylist(playlistId, actionKey) {
    // This function binds the playlistId with the Action Key
    console.debug("[DEBUG] [Playlists] bindPlaylist not yet implemented");
}

/**
 * Add current track to playlist
 */
async function addToPlaylist(playlistId) {
    try {
        // Run Apple Music request, via RPC
        // Check for duplicates, if so show alt warn state on key (icon 3)
        // on press again add to playlist anyways
        console.debug("[DEBUG] [Playlists] addToPlaylist not yet implemented");
    } catch (error) {
        console.info("Error adding to playlist:", error);
    }
}

/**
 * Generate an icon for a playlist
 */
async function generatePlaylistIcon(playlistId) {
    // Generate a playlist icon for a binded playlist action key
    console.debug("[DEBUG] [Playlists] generatePlaylistIcon not yet implemented");
}

/**
 * Queue a playlist and optionally shuffle it
 */
async function queuePlaylist(playlistId, shouldShuffle) {
    // Queue up a playlist immediately
    console.debug("[DEBUG] [Playlists] queuePlaylist not yet implemented");
}

/**
 * Fetch playlist details
 */
async function fetchPlaylist(playlistId) {
    // Save current state of a playlist into cache for manipulation
    console.debug("[DEBUG] [Playlists] fetchPlaylist not yet implemented");
}

/**
 * Check if song is already in playlist
 */
async function checkforDuplicate(playlistId, songId) {
    // Check if song already exists in playlist
    console.debug("[DEBUG] [Playlists] checkforDuplicate not yet implemented");
    return false;
}

// Export the library and rating functions
window.CiderDeckLibrary = {
    addToLibrary,
    setRating,
    playStation,
    playMix,
    findBindedKeys,
    bindPlaylist,
    addToPlaylist,
    generatePlaylistIcon,
    queuePlaylist,
    fetchPlaylist,
    checkforDuplicate
};
