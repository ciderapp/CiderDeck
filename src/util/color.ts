/**
 * Picks an accent colour sampled from the Apple Music artwork palette
 * (`bgColor` / `textColor1-4`) for the dial progress bar, but only when it
 * contrasts well with the bar's track colour.
 */

import type { Artwork } from "../models/cider-api";
import type { PlayerState } from "../models/player-state";

type RGB = [number, number, number];

/** Neutral fallback when there's no usable artwork colour. */
export const NEUTRAL_BG = "#0e0e12";

/**
 * Darken a hex colour toward black by `factor` (0-1) for use as a legible
 * background tint. Returns {@link NEUTRAL_BG} for malformed input.
 */
export function tintBackground(hex: string | undefined, factor = 0.22): string {
	const rgb = parseHex(hex);
	if (!rgb) return NEUTRAL_BG;
	return toHex(rgb.map((c) => Math.round(c * factor)) as RGB);
}

/** Dark backdrop tinted from the now-playing artwork (dominant bg, then accent). */
export function albumBackground(state: Readonly<PlayerState>): string {
	return tintBackground(state.nowPlaying?.paletteBg ?? state.nowPlaying?.accentColor);
}

/** The bar track colour the fill sits on (#3a3a44). */
const TRACK_RGB: RGB = [58, 58, 68];
const MIN_CONTRAST = 2.2;
const MAX_LUMINANCE = 0.92; // avoid near-white (keeps progress distinct from the white volume bar)

export function pickAccentColor(artwork?: Artwork): string | undefined {
	if (!artwork) return undefined;
	const trackL = luminance(TRACK_RGB);

	const qualifies = (rgb: RGB): boolean => {
		const l = luminance(rgb);
		return l > trackL && l <= MAX_LUMINANCE && contrast(l, trackL) >= MIN_CONTRAST;
	};

	// Prefer the dominant background colour when it's usable.
	const bg = parseHex(artwork.bgColor);
	if (bg && qualifies(bg)) return toHex(bg);

	// Otherwise fall back to the most colourful usable text colour.
	const texts = [artwork.textColor1, artwork.textColor2, artwork.textColor3, artwork.textColor4]
		.map(parseHex)
		.filter((c): c is RGB => !!c && qualifies(c))
		.sort((a, b) => chroma(b) - chroma(a));

	return texts.length ? toHex(texts[0]) : undefined;
}

function parseHex(hex?: string): RGB | undefined {
	if (!hex) return undefined;
	const h = hex.replace(/^#/, "");
	if (!/^[0-9a-fA-F]{6}$/.test(h)) return undefined;
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: RGB): string {
	return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function luminance([r, g, b]: RGB): number {
	const lin = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(l1: number, l2: number): number {
	const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
	return (hi + 0.05) / (lo + 0.05);
}

/** Colourfulness 0-1 (max channel minus min channel). */
function chroma([r, g, b]: RGB): number {
	return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}
