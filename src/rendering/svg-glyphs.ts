/**
 * White-on-black glyph tiles for the queue key actions, rendered to match the
 * existing playback-button icons. Returned as base64 `data:` URIs because
 * `setImage` ignores a bare SVG string. See [[streamdeck-svg-renderer-limits]].
 *
 * Only `<rect>`, `<path>` and `<text>` are used - the device rasterizer's
 * verified-working subset (no `<polygon>`, gradients, clip-path or transforms).
 */

import { svgToDataUri } from "./svg-image";

const SIZE = 144;
const FONT = "Figtree, -apple-system, 'Segoe UI', Roboto, sans-serif";
const ACCENT = "#fa2d48"; // Cider red, used for the "armed" clear confirmation
const OFFLINE_OPACITY = 0.3;

function frame(body: string): string {
	return svgToDataUri(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
			`<rect width="${SIZE}" height="${SIZE}" fill="#000000"/>${body}</svg>`,
	);
}

/** Trash-can glyph. Idle = white; armed = Cider-red (press again to confirm). */
export function renderClearGlyph({ armed, online }: { armed: boolean; online: boolean }): string {
	const fill = armed ? ACCENT : "#ffffff";
	const opacity = online ? 1 : OFFLINE_OPACITY;
	const can =
		`<g fill="${fill}" opacity="${opacity}">` +
		`<rect x="60" y="34" width="24" height="8" rx="4"/>` +
		`<rect x="38" y="46" width="68" height="9" rx="4.5"/>` +
		`<path d="M47 60 L97 60 L91 110 L53 110 Z"/>` +
		`</g>` +
		// ribs cut from the body in background black
		`<g fill="#000000">` +
		`<rect x="62" y="68" width="4" height="34" rx="2"/>` +
		`<rect x="70" y="68" width="4" height="34" rx="2"/>` +
		`<rect x="78" y="68" width="4" height="34" rx="2"/>` +
		`</g>`;
	return frame(can);
}

/**
 * Pinned tile showing the collection's artwork (rounded) with a corner badge -
 * a shuffle glyph when the pin plays shuffled, else a play triangle.
 */
export function renderPinnedArtwork(artHref: string, shuffle = false, shuffleIcon?: string): string {
	const S = 144;
	const R = 16;
	const corners =
		`M0 0 L${R} 0 A${R} ${R} 0 0 0 0 ${R} Z ` +
		`M${S} 0 L${S - R} 0 A${R} ${R} 0 0 1 ${S} ${R} Z ` +
		`M${S} ${S} L${S - R} ${S} A${R} ${R} 0 0 0 ${S} ${S - R} Z ` +
		`M0 ${S} L${R} ${S} A${R} ${R} 0 0 1 0 ${S - R} Z`;
	const badge =
		shuffle && shuffleIcon
			? `<circle cx="113" cy="113" r="21" fill="#000000" opacity="0.55"/>` +
				`<image xlink:href="${shuffleIcon}" x="96" y="96" width="34" height="34"/>`
			: `<circle cx="114" cy="114" r="17" fill="#000000" opacity="0.5"/>` +
				`<path d="M108 105 L108 123 L125 114 Z" fill="#ffffff"/>`;
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
		`<rect width="${S}" height="${S}" fill="#000000"/>` +
		`<image xlink:href="${artHref}" x="0" y="0" width="${S}" height="${S}" preserveAspectRatio="xMidYMid slice"/>` +
		`<path d="${corners}" fill="#000000"/>` +
		badge +
		`</svg>`;
	return svgToDataUri(svg);
}

/**
 * Pinned-collection glyph: two stacked album cards with a play cut-out, meaning
 * "tap to play this collection". White when configured, grey when not yet set,
 * dim when offline.
 */
export function renderPinnedGlyph({ configured, online }: { configured: boolean; online: boolean }): string {
	const card = !online ? "#3a3a3f" : configured ? "#ffffff" : "#6a6a72";
	const stack =
		`<rect x="54" y="32" width="52" height="52" rx="10" fill="${card}" opacity="0.3"/>` +
		`<rect x="36" y="46" width="62" height="62" rx="12" fill="${card}"/>` +
		`<path d="M57 63 L57 91 L83 77 Z" fill="#000000"/>`;
	return frame(stack);
}

/** Sparkle glyph (Smart Queue Optimizer): on / off / unavailable. */
export function renderSmartQueueGlyph({
	enabled,
	available,
	online,
}: {
	enabled: boolean;
	available: boolean;
	online: boolean;
}): string {
	const opacity = !online ? OFFLINE_OPACITY : !available ? 0.18 : enabled ? 1 : 0.42;
	const sparkle =
		`<g fill="#ffffff" opacity="${opacity}">` +
		`<path d="M70 32 L79 60 L106 70 L79 80 L70 108 L61 80 L34 70 L61 60 Z"/>` +
		`<path d="M108 38 L112 50 L124 54 L112 58 L108 70 L104 58 L92 54 L104 50 Z"/>` +
		`</g>`;
	// When online but Automix is off, the optimizer can't run - label it.
	const hint =
		online && !available
			? `<text x="72" y="130" text-anchor="middle" font-family="${FONT}" font-size="13" ` +
				`font-weight="600" fill="#ffffff" opacity="0.4">Automix off</text>`
			: "";
	return frame(sparkle + hint);
}
