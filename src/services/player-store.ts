/**
 * In-memory, normalized player state with granular change events.
 */

import {
	CiderEvents,
	type NowPlayingItem,
	type PlaybackSnapshot,
} from "../models/cider-api";
import {
	type PlaybackState,
	type PlayerState,
	type RepeatMode,
	type StoreEvent,
	initialPlayerState,
	repeatModeFromNumber,
} from "../models/player-state";
import { pickAccentColor } from "../util/color";
import { resolveArtwork } from "../util/format";

type Listener = (state: Readonly<PlayerState>) => void;

export class PlayerStore {
	private state: PlayerState = initialPlayerState();
	private readonly listeners = new Map<StoreEvent, Set<Listener>>();

	get snapshot(): Readonly<PlayerState> {
		return this.state;
	}

	/** Subscribe to a slice. Returns an unsubscribe function. */
	on(event: StoreEvent, cb: Listener): () => void {
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		set.add(cb);
		return () => set?.delete(cb);
	}

	private emit(...events: StoreEvent[]): void {
		for (const event of events) {
			const set = this.listeners.get(event);
			if (!set) continue;
			for (const cb of set) {
				try {
					cb(this.state);
				} catch {
					/* a listener throwing must not break fan-out */
				}
			}
		}
	}

	// --- connection -------------------------------------------------------

	setOnline(): void {
		if (this.state.online) return;
		this.state.online = true;
		this.emit("connection");
	}

	setOffline(): void {
		if (!this.state.online) return;
		this.state.online = false;
		this.emit("connection");
	}

	// --- snapshot priming -------------------------------------------------

	primeFromSnapshot(snap: PlaybackSnapshot): void {
		this.state.state = (snap.state as PlaybackState) ?? "stopped";
		this.state.playing = this.state.state === "playing";
		if (snap.nowPlaying) {
			this.applyTrack(snap.nowPlaying);
			this.state.inLibrary = !!snap.nowPlaying.inLibrary;
			this.state.inFavorites = !!snap.nowPlaying.inFavorites;
		} else {
			// Empty Cider (e.g. a fresh restart with nothing playing)
			this.state.nowPlaying = null;
			this.state.inLibrary = false;
			this.state.inFavorites = false;
			this.state.rating = 0;
		}
		if (snap.time) {
			this.state.time = {
				currentMs: secToMs(snap.time.currentTime),
				durationMs: secToMs(snap.time.duration),
				remainingMs: secToMs(snap.time.remaining),
			};
		} else {
			this.state.time = { currentMs: 0, durationMs: 0, remainingMs: 0 };
		}
		if (typeof snap.volume === "number") this.state.volume = snap.volume;
		if (snap.repeatMode) this.state.repeatMode = snap.repeatMode as RepeatMode;
		if (typeof snap.shuffleMode === "boolean") this.state.shuffle = snap.shuffleMode;
		// Broadcast everything once after priming.
		this.emit("connection", "track", "playState", "time", "volume", "repeat", "shuffle", "library", "favorite", "audio", "queue");
	}

	/** Prime audio-setting states (not included in the playback snapshot). */
	primeAudio(audio: Partial<Pick<PlayerState["audio"], "atmos" | "crossfade" | "automix" | "listeningMode">>): void {
		let changed = false;
		for (const [k, v] of Object.entries(audio) as [keyof PlayerState["audio"], unknown][]) {
			if (v !== undefined && this.state.audio[k] !== v) {
				(this.state.audio as Record<string, unknown>)[k] = v;
				changed = true;
			}
		}
		if (changed) this.emit("audio");
	}

	/** Prime / update Smart Queue Optimizer state. */
	primeSmartQueue(s: { enabled?: boolean; busy?: boolean }): void {
		this.setSmartQueue(s.enabled, s.busy);
	}

	/**
	 * Authoritative library/favorite status for the current track.
	 */
	primeLibraryStatus(status: { inLibrary?: boolean; rating?: -1 | 0 | 1 }): void {
		if (typeof status.inLibrary === "boolean" && status.inLibrary !== this.state.inLibrary) {
			this.state.inLibrary = status.inLibrary;
			this.emit("library");
		}
		if (status.rating !== undefined) {
			this.state.rating = status.rating;
			const fav = status.rating === 1;
			if (fav !== this.state.inFavorites) {
				this.state.inFavorites = fav;
				this.emit("favorite");
			}
		}
	}

	/**
	 * Authoritative queue position/total (from `GET /queue/position`).
	 */
	primeQueue(position: number, total: number): void {
		if (position === this.state.queue.position && total === this.state.queue.total) return;
		this.state.queue = { position, total };
		this.emit("queue");
	}

	// --- socket ingest ----------------------------------------------------

	ingest(type: string, data: unknown): void {
		switch (type) {
			case CiderEvents.nowPlayingItemDidChange: {
				this.applyTrack(unwrapTrack(data));
				this.emit("track");
				break;
			}
			case CiderEvents.nowPlayingStatusDidChange: {
				const d = data as { inLibrary?: boolean; inFavorites?: boolean };
				this.setIf(d.inLibrary !== undefined && d.inLibrary !== this.state.inLibrary, () => {
					this.state.inLibrary = !!d.inLibrary;
				}, "library");
				this.setIf(d.inFavorites !== undefined && d.inFavorites !== this.state.inFavorites, () => {
					this.state.inFavorites = !!d.inFavorites;
					this.state.rating = d.inFavorites ? 1 : this.state.rating === 1 ? 0 : this.state.rating;
				}, "favorite");
				break;
			}
			case CiderEvents.playbackStateDidChange: {
				const d = data as { state?: string };
				this.setPlaybackState((d?.state as PlaybackState) ?? this.state.state);
				break;
			}
			case CiderEvents.playbackTimeDidChange: {
				const d = data as {
					currentPlaybackTime?: number;
					currentPlaybackDuration?: number;
					currentPlaybackTimeRemaining?: number;
					isPlaying?: boolean;
				};
				this.state.time = {
					currentMs: secToMs(d.currentPlaybackTime ?? 0),
					durationMs: secToMs(d.currentPlaybackDuration ?? this.state.time.durationMs / 1000),
					remainingMs: secToMs(d.currentPlaybackTimeRemaining ?? 0),
				};
				if (typeof d.isPlaying === "boolean") {
					this.setPlaybackState(d.isPlaying ? "playing" : "paused");
				}
				this.emit("time");
				break;
			}
			case CiderEvents.volumeDidChange: {
				const v = typeof data === "number" ? data : (data as { volume?: number })?.volume ?? this.state.volume;
				this.setIf(v !== this.state.volume, () => {
					this.state.volume = v;
					if (v > 0) this.state.muted = false;
				}, "volume");
				break;
			}
			case CiderEvents.repeatModeDidChange: {
				const mode = repeatModeFromNumber(typeof data === "number" ? data : Number(data));
				this.setIf(mode !== this.state.repeatMode, () => (this.state.repeatMode = mode), "repeat");
				break;
			}
			case CiderEvents.shuffleModeDidChange: {
				const on = (typeof data === "number" ? data : Number(data)) === 1;
				this.setIf(on !== this.state.shuffle, () => (this.state.shuffle = on), "shuffle");
				break;
			}
			case CiderEvents.crossfadeChanged: {
				this.setAudio("crossfade", (data as { enabled?: boolean })?.enabled);
				break;
			}
			case CiderEvents.automixChanged: {
				this.setAudio("automix", (data as { enabled?: boolean })?.enabled);
				break;
			}
			case CiderEvents.atmosChanged: {
				this.setAudio("atmos", (data as { enabled?: boolean })?.enabled);
				break;
			}
			case CiderEvents.listeningModeChanged: {
				const mode = (data as { mode?: string })?.mode;
				this.setIf(mode !== undefined && mode !== this.state.audio.listeningMode, () => {
					this.state.audio.listeningMode = mode;
				}, "audio");
				break;
			}
			case CiderEvents.qualityChanged: {
				const d = data as { flavor?: string; flavorLabel?: string };
				this.state.audio.qualityFlavor = d.flavor;
				this.state.audio.qualityLabel = d.flavorLabel;
				this.emit("audio");
				break;
			}
			case CiderEvents.queueChanged: {
				const d = data as { position?: number; total?: number };
				this.state.queue = {
					position: d.position ?? this.state.queue.position,
					total: d.total ?? this.state.queue.total,
				};
				this.emit("queue");
				break;
			}
			case CiderEvents.smartQueueChanged: {
				const d = data as { enabled?: boolean; busy?: boolean };
				this.setSmartQueue(d.enabled, d.busy);
				break;
			}
			default:
				break;
		}
	}

	// --- mutation helpers -------------------------------------------------

	private setIf(changed: boolean, apply: () => void, ...events: StoreEvent[]): void {
		if (!changed) return;
		apply();
		this.emit(...events);
	}

	private setPlaybackState(state: PlaybackState): void {
		if (this.state.state === state) return;
		this.state.state = state;
		this.state.playing = state === "playing";
		this.emit("playState");
	}

	private setAudio(key: "crossfade" | "automix" | "atmos", value: boolean | undefined): void {
		if (value === undefined || this.state.audio[key] === value) return;
		this.state.audio[key] = value;
		this.emit("audio");
	}

	private setSmartQueue(enabled: boolean | undefined, busy: boolean | undefined): void {
		let changed = false;
		if (typeof enabled === "boolean" && enabled !== this.state.smartQueue.enabled) {
			this.state.smartQueue.enabled = enabled;
			changed = true;
		}
		if (typeof busy === "boolean" && busy !== this.state.smartQueue.busy) {
			this.state.smartQueue.busy = busy;
			changed = true;
		}
		if (changed) this.emit("smartqueue");
	}

	private applyTrack(item: NowPlayingItem): void {
		const a = item.attributes ?? item;
		this.state.nowPlaying = {
			id: a.id ?? item.id,
			title: a.name ?? "",
			artist: a.artistName ?? "",
			album: a.albumName ?? "",
			artworkUrl: resolveArtwork(a.artwork?.url),
			accentColor: pickAccentColor(a.artwork),
			paletteBg: a.artwork?.bgColor,
			durationMs: a.durationInMillis ?? 0,
		};
		if (a.inLibrary !== undefined) this.state.inLibrary = !!a.inLibrary;
		if (a.inFavorites !== undefined) this.state.inFavorites = !!a.inFavorites;
	}
}

function unwrapTrack(data: unknown): NowPlayingItem {
	if (data && typeof data === "object") return data as NowPlayingItem;
	return {};
}

function secToMs(sec: number | undefined): number {
	return Math.max(0, Math.round((sec ?? 0) * 1000));
}
