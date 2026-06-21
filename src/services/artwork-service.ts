/**
 * Fetches album artwork over HTTP and returns a base64 data URI suitable for
 * `action.setImage`. Keeps a tiny LRU keyed by URL so the current/previous
 * track's art isn't refetched. No native image dependency - the Stream Deck
 * scales the image to the key.
 */

// Enough to hold the playback-dial art, album-art tiles, and the ~5 covers the
// coverflow dial shows at once (plus a couple either side as the cursor moves).
const MAX_ENTRIES = 16;

export class ArtworkService {
	private readonly cache = new Map<string, string>();
	private readonly inflight = new Map<string, Promise<string | undefined>>();

	/**
	 * Synchronously return a cached data URI without fetching (refreshing LRU
	 * recency), or undefined if not yet cached. Lets callers render immediately
	 * with whatever art is on hand and fill the rest in via {@link getDataUri}.
	 */
	peek(url: string): string | undefined {
		const cached = this.cache.get(url);
		if (cached) {
			this.cache.delete(url);
			this.cache.set(url, cached);
		}
		return cached;
	}

	/** Returns a `data:` URI for the artwork at `url`, or undefined on failure. */
	async getDataUri(url: string): Promise<string | undefined> {
		const cached = this.cache.get(url);
		if (cached) {
			// refresh LRU recency
			this.cache.delete(url);
			this.cache.set(url, cached);
			return cached;
		}

		const existing = this.inflight.get(url);
		if (existing) return existing;

		const task = this.fetchAndEncode(url).finally(() => this.inflight.delete(url));
		this.inflight.set(url, task);
		return task;
	}

	private async fetchAndEncode(url: string): Promise<string | undefined> {
		try {
			const res = await fetch(url);
			if (!res.ok) return undefined;
			const contentType = res.headers.get("content-type") ?? "image/jpeg";
			const buf = Buffer.from(await res.arrayBuffer());
			const dataUri = `data:${contentType};base64,${buf.toString("base64")}`;
			this.store(url, dataUri);
			return dataUri;
		} catch {
			return undefined;
		}
	}

	private store(url: string, dataUri: string): void {
		this.cache.set(url, dataUri);
		while (this.cache.size > MAX_ENTRIES) {
			const oldest = this.cache.keys().next().value;
			if (oldest === undefined) break;
			this.cache.delete(oldest);
		}
	}
}
