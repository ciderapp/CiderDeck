/**
 * Types describing the Cider v2 ("Citadel") HTTP + WebSocket API surface.
 * See D:/GitHub/Citadel/docs/API_v2.md.
 */

/** Standard success envelope. `meta` is only present on paginated endpoints. */
export interface Envelope<T> {
	data: T;
	meta?: PageMeta;
}

export interface PageMeta {
	offset: number;
	limit: number;
	total: number;
}

export interface Artwork {
	url: string;
	width?: number;
	height?: number;
	/** Apple Music palette (hex without `#`), present on now-playing broadcasts. */
	bgColor?: string;
	textColor1?: string;
	textColor2?: string;
	textColor3?: string;
	textColor4?: string;
}

export type RawPlaybackState = "playing" | "paused" | "stopped";
export type RawRepeatMode = "none" | "one" | "all";

/** `GET /api/v2/playback` snapshot. */
export interface PlaybackSnapshot {
	state: RawPlaybackState;
	nowPlaying?: NowPlayingItem | null;
	time?: { currentTime: number; duration: number; remaining: number };
	volume?: number;
	repeatMode?: RawRepeatMode;
	shuffleMode?: boolean;
	autoplay?: boolean;
	rate?: number;
}

export interface NowPlayingItem {
	name?: string;
	artistName?: string;
	albumName?: string;
	artwork?: Artwork;
	durationInMillis?: number;
	inFavorites?: boolean;
	inLibrary?: boolean;
	flavor?: string;
	attributes?: NowPlayingItem;
	id?: string;
}

export interface LibraryStatus {
	inLibrary: boolean;
	rating: -1 | 0 | 1;
}

export interface AudioToggleState {
	enabled: boolean;
	effectiveEnabled?: boolean;
	[key: string]: unknown;
}

export interface AtmosState {
	enabled: boolean;
	binaural?: boolean;
	devicePreferences?: Record<string, string>;
}

export interface AudioQuality {
	flavor: string;
	flavorLabel: string;
	deviceAudioConfig?: {
		channelCount?: number;
		sampleRate?: number;
		supportsAtmos?: boolean;
		supportedCodecs?: string[];
	};
	localPlayback?: unknown;
}

export interface QueuePosition {
	position: number;
	total: number;
}

export interface SmartOptimizerState {
	enabled: boolean;
	busy: boolean;
	pending: number;
	message: string | null;
}

export interface CollectionItem {
	id: string;
	name: string;
	description?: string;
	artistName?: string;
	trackCount?: number;
	releaseDate?: string;
	canEdit?: boolean;
	artwork?: Artwork;
}

export interface SongItem {
	id: string;
	name: string;
	artistName?: string;
	albumName?: string;
	durationMs?: number;
	trackNumber?: number;
	artwork?: Artwork;
}

export interface QueueItem {
	track: { id: string; type: string; attributes?: Record<string, unknown> };
	source?: string;
	containerContext?: { type: string; id: string; name?: string };
}

export interface AuthRequestResult {
	token: string;
	scopes: string[];
}

export type CollectionType = "albums" | "playlists" | "stations";

export interface PlaybackChannelMessage {
	type: string;
	data: unknown;
}

export const CiderEvents = {
	nowPlayingItemDidChange: "playbackStatus.nowPlayingItemDidChange",
	nowPlayingStatusDidChange: "playbackStatus.nowPlayingStatusDidChange",
	playbackStateDidChange: "playbackStatus.playbackStateDidChange",
	playbackTimeDidChange: "playbackStatus.playbackTimeDidChange",
	transitionStarted: "playbackStatus.transitionStarted",
	transitionCompleted: "playbackStatus.transitionCompleted",
	volumeDidChange: "playerStatus.volumeDidChange",
	repeatModeDidChange: "playerStatus.repeatModeDidChange",
	shuffleModeDidChange: "playerStatus.shuffleModeDidChange",
	crossfadeChanged: "audioStatus.crossfadeChanged",
	automixChanged: "audioStatus.automixChanged",
	atmosChanged: "audioStatus.atmosChanged",
	qualityChanged: "audioStatus.qualityChanged",
	queueChanged: "queueStatus.queueChanged",
	smartQueueChanged: "queueStatus.smartQueueChanged",
	listeningModeChanged: "audioStatus.listeningModeChanged",
} as const;
