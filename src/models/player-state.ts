/**
 * Normalized, in-memory player state maintained by {@link PlayerStore}.
 * Actions read this rather than calling the API directly.
 */

import type { RawRepeatMode } from "./cider-api";

export type RepeatMode = RawRepeatMode;
export type PlaybackState = "playing" | "paused" | "stopped";

export interface NowPlaying {
	id?: string;
	title: string;
	artist: string;
	album: string;
	artworkUrl?: string;
	accentColor?: string;
	paletteBg?: string;
	durationMs: number;
}

export interface PlayerTime {
	currentMs: number;
	durationMs: number;
	remainingMs: number;
}

export interface AudioState {
	atmos?: boolean;
	crossfade?: boolean;
	automix?: boolean;
	listeningMode?: string;
	qualityFlavor?: string;
	qualityLabel?: string;
}

export interface PlayerState {
	online: boolean;
	state: PlaybackState;
	playing: boolean;
	repeatMode: RepeatMode;
	shuffle: boolean;
	volume: number; // 0..1
	muted: boolean;
	inLibrary: boolean;
	inFavorites: boolean;
	rating: -1 | 0 | 1;
	nowPlaying: NowPlaying | null;
	time: PlayerTime;
	audio: AudioState;
	queue: { position: number; total: number };
	smartQueue: { enabled: boolean; busy: boolean };
}

/**
 * Granular change slices emitted by {@link PlayerStore}. Actions subscribe only
 * to the slices they care about; `connection` is always delivered.
 */
export type StoreEvent =
	| "track"
	| "playState"
	| "repeat"
	| "shuffle"
	| "volume"
	| "library"
	| "favorite"
	| "time"
	| "audio"
	| "queue"
	| "smartqueue"
	| "connection";

export function initialPlayerState(): PlayerState {
	return {
		online: false,
		state: "stopped",
		playing: false,
		repeatMode: "none",
		shuffle: false,
		volume: 0,
		muted: false,
		inLibrary: false,
		inFavorites: false,
		rating: 0,
		nowPlaying: null,
		time: { currentMs: 0, durationMs: 0, remainingMs: 0 },
		audio: {},
		queue: { position: 0, total: 0 },
		smartQueue: { enabled: false, busy: false },
	};
}

/** Map the numeric repeat mode used by WebSocket events to the string form. */
export function repeatModeFromNumber(n: number): RepeatMode {
	return n === 1 ? "one" : n === 2 ? "all" : "none";
}
