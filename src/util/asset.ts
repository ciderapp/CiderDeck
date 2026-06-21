/**
 * Reads bundled plugin assets (e.g. button PNGs) into base64 `data:` URIs so
 * they can be composited into `setImage` SVGs. Results are cached. Resolves
 * relative to the plugin root (the bundle's `bin/` parent).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map<string, string | null>();

/** A `data:` URI for a plugin-relative asset path, or undefined if unreadable. */
export function assetDataUri(relPath: string, mime = "image/png"): string | undefined {
	if (cache.has(relPath)) return cache.get(relPath) ?? undefined;
	try {
		const buf = readFileSync(join(PLUGIN_ROOT, relPath));
		const uri = `data:${mime};base64,${buf.toString("base64")}`;
		cache.set(relPath, uri);
		return uri;
	} catch {
		cache.set(relPath, null); // cache the failure so we don't retry every paint
		return undefined;
	}
}
