/**
 * Renders the Listening Mode (Occlusion DSP) tile as an SVG string. Design: the
 * "Wordmark" variant - a large mode word, a small "LISTENING MODE" caption, and
 * a thin status bar (filled when a mode is active, dim when Off/offline). It is
 * styled to match Cider's monochrome quick-menu aesthetic (white-on-dark, no
 * colour accents).
 *
 * Uses only `<rect>` and `<text>` - both in the Stream Deck SVG rasterizer's
 * supported subset (no gradients/clip-path). See [[streamdeck-svg-renderer-limits]].
 * Returned as a base64 `data:` URI because `setImage` ignores a bare SVG string.
 */

import { svgToDataUri } from "./svg-image";

const SIZE = 144;
// Pure black to blend with the neighbouring white-glyph icon tiles.
const BG = "#000000";
const FONT = "Figtree, -apple-system, 'Segoe UI', Roboto, sans-serif";
// Largest word size that still fits the longest label within the usable width.
const MAX_WORD = 38;
const USABLE_W = 126;
const GLYPH_RATIO = 0.64; // bold sans-serif average advance ~ 0.64 x font size

export interface ListeningModeTile {
	/** Display word, e.g. "Off" / "Gaming" / "Unwind". */
	label: string;
	/** A non-Off mode is engaged. */
	active: boolean;
	/** Cider is reachable; offline dims the whole tile. */
	online: boolean;
}

export function renderListeningModeSvg({ label, active, online }: ListeningModeTile): string {
	// Scale the word up to fill the tile (matching the neighbouring icon tiles'
	// visual weight), shrinking only when a longer word would overflow.
	const fontSize = Math.min(MAX_WORD, Math.floor(USABLE_W / (Math.max(3, label.length) * GLYPH_RATIO)));

	const wordOpacity = !online ? 0.25 : active ? 1 : 0.85;
	const captionOpacity = !online ? 0.18 : 0.45;
	const barOpacity = !online ? 0.12 : active ? 0.9 : 0.28;

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
		`<rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>` +
		`<text x="72" y="74" text-anchor="middle" font-family="${FONT}" font-size="${fontSize}" ` +
		`font-weight="700" letter-spacing="-1" fill="#ffffff" opacity="${wordOpacity}">${escapeText(label)}</text>` +
		`<text x="72" y="100" text-anchor="middle" font-family="${FONT}" font-size="11" ` +
		`font-weight="600" letter-spacing="2" fill="#ffffff" opacity="${captionOpacity}">LISTENING MODE</text>` +
		`<rect x="49" y="112" width="46" height="6" rx="3" fill="#ffffff" opacity="${barOpacity}"/>` +
		`</svg>`;
	return svgToDataUri(svg);
}

function escapeText(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
