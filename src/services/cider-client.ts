/**
 * Typed REST client for the Cider v2 ("Citadel") API. One instance is shared
 * plugin-wide. Always sends the `apptoken` header and unwraps the `{ data }`
 * envelope. Throws {@link CiderAuthError} on 401/403 and {@link CiderOfflineError}
 * when Cider is unreachable.
 * 
 * Reminder to self, we'll probably need to actually make a real typed client for the v2 API at some point, but for now this
 * is just a thin wrapper around fetch() that handles the token and error cases. The v2 API is still in flux, 
 * so we don't want to hard-code too much of it yet.
 */

import type {
	AtmosState,
	AudioQuality,
	AudioToggleState,
	AuthRequestResult,
	CollectionItem,
	CollectionType,
	LibraryStatus,
	NowPlayingItem,
	PageMeta,
	PlaybackSnapshot,
	QueueItem,
	QueuePosition,
	SmartOptimizerState,
	SongItem,
} from "../models/cider-api";
import { DEFAULT_SERVER } from "../models/settings";

export class CiderAuthError extends Error {
	constructor(
		public status: number,
		public code?: string,
		public detail?: string,
	) {
		super(`Cider auth failed (${status}${code ? ` ${code}` : ""})${detail ? `: ${detail}` : ""}`);
		this.name = "CiderAuthError";
	}

	get friendly(): string {
		if (this.code === "INSUFFICIENT_SCOPE") {
			return `Token is missing a required scope${this.detail ? ` (${this.detail})` : ""}. Re-grant via Request Authorization.`;
		}
		if (this.code === "UNAUTHORIZED_APP_TOKEN") {
			return "Token is invalid or empty. Use Request Authorization, or paste a valid token.";
		}
		return this.detail || `Cider rejected the token (${this.status}).`;
	}
}

export class CiderOfflineError extends Error {
	constructor(cause?: unknown) {
		super("Cider is unreachable");
		this.name = "CiderOfflineError";
		this.cause = cause;
	}
}

export class CiderApiError extends Error {
	constructor(public status: number, message: string) {
		super(message);
		this.name = "CiderApiError";
	}
}

interface ListResult<T> {
	items: T[];
	meta?: PageMeta;
}

export class CiderClient {
	private host: string = DEFAULT_SERVER.host;
	private port: number = DEFAULT_SERVER.port;
	private token: string | null = null;

	get baseUrl(): string {
		return `http://${this.host}:${this.port}`;
	}

	get hasToken(): boolean {
		return !!this.token;
	}

	setConnection(host: string, port: number): void {
		this.host = host || DEFAULT_SERVER.host;
		this.port = port || DEFAULT_SERVER.port;
	}

	setToken(token: string | null): void {
		this.token = token;
	}

	// --- core request -----------------------------------------------------

	private async request<T = void>(method: string, path: string, body?: unknown): Promise<T> {
		const headers: Record<string, string> = {};
		if (this.token) headers["apptoken"] = this.token;
		if (body !== undefined) headers["Content-Type"] = "application/json";

		let res: Response;
		try {
			res = await fetch(`${this.baseUrl}/api/v2${path}`, {
				method,
				headers,
				body: body !== undefined ? JSON.stringify(body) : undefined,
			});
		} catch (err) {
			throw new CiderOfflineError(err);
		}

		if (res.status === 401 || res.status === 403) {
			throw await readAuthError(res);
		}
		if (!res.ok) {
			throw new CiderApiError(res.status, await readError(res));
		}
		if (res.status === 204) return undefined as T;

		const json = (await res.json().catch(() => ({}))) as { data?: T };
		return (json?.data ?? (json as unknown as T)) as T;
	}

	private async requestList<T>(path: string, offset = 0, limit = 50): Promise<ListResult<T>> {
		// Apple Music's `/v1/me/library/*` endpoints cap `limit` at 100 and return
		// an empty list (total 0) when exceeded.
		if (path.startsWith("/library") && limit > 100) limit = 100;
		const headers: Record<string, string> = {};
		if (this.token) headers["apptoken"] = this.token;
		const sep = path.includes("?") ? "&" : "?";
		let res: Response;
		try {
			res = await fetch(`${this.baseUrl}/api/v2${path}${sep}offset=${offset}&limit=${limit}`, { headers });
		} catch (err) {
			throw new CiderOfflineError(err);
		}
		if (res.status === 401 || res.status === 403) throw await readAuthError(res);
		if (!res.ok) throw new CiderApiError(res.status, await readError(res));
		const json = (await res.json().catch(() => ({}))) as { data?: { items?: T[] }; meta?: PageMeta };
		return { items: json?.data?.items ?? [], meta: json?.meta };
	}

	// --- auth -------------------------------------------------------------

	/** Unauthenticated token bootstrap. */
	requestAuth(body: { app_name: string; app_image?: string; scopes: string[] }): Promise<AuthRequestResult> {
		return this.request<AuthRequestResult>("POST", "/auth/request", body);
	}

	/** Lightweight reachability + auth probe (scope-less). */
	getClientInfo(): Promise<{ version: string; platform: string }> {
		return this.request("GET", "/client/info");
	}

	// --- playback ---------------------------------------------------------

	getPlaybackSnapshot(): Promise<PlaybackSnapshot> {
		return this.request("GET", "/playback");
	}
	getNowPlaying(): Promise<NowPlayingItem> {
		return this.request("GET", "/playback/now-playing");
	}
	play(): Promise<void> {
		return this.request("POST", "/playback/play");
	}
	pause(): Promise<void> {
		return this.request("POST", "/playback/pause");
	}
	stop(): Promise<void> {
		return this.request("POST", "/playback/stop");
	}
	toggle(): Promise<void> {
		return this.request("POST", "/playback/toggle");
	}
	next(): Promise<void> {
		return this.request("POST", "/playback/next");
	}
	previous(force = false): Promise<void> {
		return this.request("POST", "/playback/previous", force ? { force: true } : undefined);
	}
	seek(positionSec: number): Promise<void> {
		return this.request("POST", "/playback/seek", { position: positionSec });
	}
	playItem(type: string, id: string): Promise<void> {
		return this.request("POST", "/playback/play-item", { type, id });
	}
	playCollection(type: CollectionType, id: string, shuffle = false): Promise<void> {
		return this.request("POST", "/playback/play-collection", { type, id, shuffle });
	}

	// modes
	toggleRepeat(): Promise<void> {
		return this.request("POST", "/playback/repeat/toggle");
	}
	toggleShuffle(): Promise<void> {
		return this.request("POST", "/playback/shuffle/toggle");
	}
	toggleAutoplay(): Promise<void> {
		return this.request("POST", "/playback/autoplay/toggle");
	}
	getRate(): Promise<{ rate: number }> {
		return this.request("GET", "/playback/rate");
	}
	setRate(rate: number): Promise<void> {
		return this.request("PATCH", "/playback/rate", { rate });
	}
	getAudioQuality(): Promise<AudioQuality> {
		return this.request("GET", "/playback/audio-quality");
	}

	// --- audio ------------------------------------------------------------

	getVolume(): Promise<{ volume: number }> {
		return this.request("GET", "/audio/volume");
	}
	setVolume(volume: number): Promise<void> {
		return this.request("PATCH", "/audio/volume", { volume: clamp01(volume) });
	}
	getCrossfade(): Promise<AudioToggleState> {
		return this.request("GET", "/audio/crossfade");
	}
	setCrossfade(patch: Record<string, unknown>): Promise<void> {
		return this.request("PATCH", "/audio/crossfade", patch);
	}
	getAutomix(): Promise<AudioToggleState> {
		return this.request("GET", "/audio/automix");
	}
	setAutomix(patch: Record<string, unknown>): Promise<void> {
		return this.request("PATCH", "/audio/automix", patch);
	}
	getAtmos(): Promise<AtmosState> {
		return this.request("GET", "/audio/atmos");
	}
	setAtmos(patch: Record<string, unknown>): Promise<void> {
		return this.request("PATCH", "/audio/atmos", patch);
	}
	getListeningMode(): Promise<{ mode: string; available?: boolean }> {
		return this.request("GET", "/audio/listening-mode");
	}
	setListeningMode(mode: string): Promise<{ mode: string; available?: boolean }> {
		return this.request("PATCH", "/audio/listening-mode", { mode });
	}

	// --- library / rating -------------------------------------------------

	getLibraryStatus(): Promise<LibraryStatus> {
		return this.request("GET", "/library/now-playing/status");
	}
	addToLibrary(): Promise<void> {
		return this.request("POST", "/library/now-playing/add");
	}
	removeFromLibrary(): Promise<void> {
		return this.request("DELETE", "/library/now-playing");
	}
	love(): Promise<void> {
		return this.request("POST", "/library/now-playing/love");
	}
	dislike(): Promise<void> {
		return this.request("POST", "/library/now-playing/dislike");
	}
	setRating(rating: -1 | 0 | 1): Promise<void> {
		return this.request("PUT", "/library/now-playing/rating", { rating });
	}
	clearRating(): Promise<void> {
		return this.request("DELETE", "/library/now-playing/rating");
	}

	getPlaylists(offset = 0, limit = 50): Promise<ListResult<CollectionItem>> {
		return this.requestList<CollectionItem>("/library/playlists", offset, limit);
	}
	getPlaylistSongs(id: string, offset = 0, limit = 50): Promise<ListResult<SongItem>> {
		return this.requestList<SongItem>(`/library/playlists/${encodeURIComponent(id)}/songs`, offset, limit);
	}
	getAlbums(offset = 0, limit = 50): Promise<ListResult<CollectionItem>> {
		return this.requestList<CollectionItem>("/library/albums", offset, limit);
	}
	getAlbumSongs(id: string, offset = 0, limit = 50): Promise<ListResult<SongItem>> {
		return this.requestList<SongItem>(`/library/albums/${encodeURIComponent(id)}/songs`, offset, limit);
	}
	getLibrarySongs(offset = 0, limit = 50): Promise<ListResult<SongItem>> {
		return this.requestList<SongItem>("/library/songs", offset, limit);
	}

	// --- queue ------------------------------------------------------------

	getQueue(offset = 0, limit = 50): Promise<ListResult<QueueItem>> {
		return this.requestList<QueueItem>("/queue", offset, limit);
	}
	getQueuePosition(): Promise<QueuePosition> {
		return this.request("GET", "/queue/position");
	}
	queueJump(index: number): Promise<void> {
		return this.request("POST", "/queue/jump", { index });
	}
	queueAddNext(type: string, id: string): Promise<void> {
		return this.request("POST", "/queue/add-next", { type, id });
	}
	queueAddLater(type: string, id: string): Promise<void> {
		return this.request("POST", "/queue/add-later", { type, id });
	}
	queueMove(from: number, to: number): Promise<void> {
		return this.request("POST", "/queue/move", { from, to });
	}
	queueRemove(index: number): Promise<void> {
		return this.request("DELETE", `/queue/items/${index}`);
	}
	queueShuffle(): Promise<void> {
		return this.request("POST", "/queue/shuffle");
	}
	queueClear(): Promise<void> {
		return this.request("DELETE", "/queue");
	}
	getSmartOptimizer(): Promise<SmartOptimizerState> {
		return this.request("GET", "/queue/smart-optimizer");
	}
	toggleSmartOptimizer(): Promise<void> {
		return this.request("POST", "/queue/smart-optimizer/toggle");
	}

	// --- config -----------------------------------------------------------

	getConfig<T = unknown>(path?: string): Promise<T> {
		const q = path ? `?path=${encodeURIComponent(path)}` : "";
		return this.request("GET", `/config${q}`);
	}
}

async function readError(res: Response): Promise<string> {
	try {
		const j = (await res.json()) as { error?: { message?: string } | string };
		if (typeof j.error === "string") return j.error;
		return j.error?.message ?? res.statusText;
	} catch {
		return res.statusText;
	}
}

/** Parse a 401/403 body into a typed {@link CiderAuthError} carrying code + detail. */
async function readAuthError(res: Response): Promise<CiderAuthError> {
	try {
		const j = (await res.json()) as { error?: { code?: string; message?: string } | string };
		if (typeof j.error === "string") return new CiderAuthError(res.status, j.error);
		return new CiderAuthError(res.status, j.error?.code, j.error?.message);
	} catch {
		return new CiderAuthError(res.status);
	}
}

function clamp01(v: number): number {
	return Math.max(0, Math.min(1, v));
}
