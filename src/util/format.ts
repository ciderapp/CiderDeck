/** Formatting helpers shared across renderers and actions. */

/**
 * Resolve a MusicKit-style artwork URL template (`{w}`/`{h}`/`{f}`) to a usable
 * URL. v2 library URLs are already pre-resolved, but socket payloads may still
 * carry templates, so this is safe to apply unconditionally.
 */
export function resolveArtwork(url: string | undefined, size = 512): string | undefined {
	if (!url) return undefined;
	return url
		.replace(/\{w\}/g, String(size))
		.replace(/\{h\}/g, String(size))
		.replace(/\{f\}/g, "jpg")
		.replace(/\{c\}/g, "cc");
}

/** Format milliseconds as `m:ss`. */
export function formatTime(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) ms = 0;
	const total = Math.floor(ms / 1000);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Substitute the `{title}` / `{artist}` / `{album}` / `{duration}` tokens used by
 * the Song Display / dial title formats.
 */
export function formatSongInfo(
	template: string,
	info: { title?: string; artist?: string; album?: string; durationMs?: number },
): string {
	return template
		.replace(/\{title\}/g, info.title ?? "")
		.replace(/\{artist\}/g, info.artist ?? "")
		.replace(/\{album\}/g, info.album ?? "")
		.replace(/\{duration\}/g, info.durationMs != null ? formatTime(info.durationMs) : "");
}
