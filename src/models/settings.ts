/**
 * Settings models. Global settings persist plugin-wide config (token, server);
 * per-action settings live on individual key/dial instances.
 *
 * Plugin-wide global settings (persisted via streamDeck.settings). Flat keys so
 * sdpi-components can bind to them directly with `global` in the PI.
 */
export type GlobalSettings = {
	token?: string | null;
	host?: string;
	port?: number | string;
	scopes?: string[];
	grantedAt?: string;
	authorization?: {
		rpcKey?: string;
	};
};

export const DEFAULT_SERVER = { host: "127.0.0.1", port: 10767 } as const;
export const REQUESTED_SCOPES = ["playback", "queue", "library", "audio", "config"] as const;

// --- Per-action settings -------------------------------------------------

export type PreviousSettings = {
	/** When true, always go to the previous track instead of restarting the current one. */
	alwaysGoToPrevious?: boolean;
};

export type LikeSettings = {
	/** When favoriting, also add the track to the library. */
	alsoAddToLibrary?: boolean;
};

export type VolumeStepSettings = {
	/** Percentage points to change per press (default 10). */
	step?: number;
};

export type DialTouchAction = "playpause" | "addtolibrary" | "dislike";

/** Touchscreen background: none (device default), album-tinted, or a custom colour. */
export type DialBackground = "none" | "album" | "custom";

export type DialSettings = {
	touchAction?: DialTouchAction;
	volumeStep?: number;
	seekStep?: number;
	showFavorite?: boolean;
	showLibrary?: boolean;
	showShuffle?: boolean;
	showRepeat?: boolean;
};

export type QueueDialSettings = {
	/** Coverflow background: album-tinted (default), a custom colour, or neutral dark. */
	background?: DialBackground;
	/** Custom background colour (when `background` is "custom"). */
	backgroundColor?: string;
};

export type PinnedSource = "playlists" | "albums" | "stations";

/** A key that plays a pinned playlist/album/station via `/playback/play-collection`. */
export type PinnedItemSettings = {
	/** "type:id" chosen from the library browser (e.g. "playlists:p.AbC123"). */
	pin?: string;
	/** Display name + artwork of the picked collection, for the tile. */
	pinName?: string;
	pinArtworkUrl?: string;
	/** Manual override (stations, or pasting an id / beyond the first 100). */
	collectionType?: PinnedSource;
	collectionId?: string;
	/** Shuffle the collection on play. */
	shuffle?: boolean;
};

export type SongDisplaySettings = {
	fontFamily?: string;
	fontSize?: number;
	textColor?: string;
	backgroundColor?: string;
	alignment?: "left" | "center" | "right";
	showArtist?: boolean;
	showAlbum?: boolean;
	maxLines?: 1 | 2 | 3;
	/** Token format, e.g. "{title}". Overrides showArtist/showAlbum when set. */
	customFormat?: string;
	textPrefix?: string;
};

export const DEFAULTS = {
	previous: { alwaysGoToPrevious: false } satisfies PreviousSettings,
	like: { alsoAddToLibrary: false } satisfies LikeSettings,
	volume: { step: 10 } satisfies VolumeStepSettings,
	dial: {
		touchAction: "playpause",
		volumeStep: 2,
		seekStep: 5,
		showFavorite: true,
		showLibrary: false,
		showShuffle: true,
		showRepeat: true,
	} satisfies DialSettings,
	queueDial: {
		background: "album",
		backgroundColor: "#1c1c24",
	} satisfies QueueDialSettings,
	songDisplay: {
		fontFamily: "Figtree, Helvetica, Arial, sans-serif",
		fontSize: 18,
		textColor: "#ffffff",
		backgroundColor: "#0b0b0f",
		alignment: "center",
		showArtist: true,
		showAlbum: false,
		maxLines: 3,
		customFormat: "",
		textPrefix: "",
	} satisfies SongDisplaySettings,
};
