/**
 * Renders the SD+ touchscreen "coverflow" - a 200x100 pixmap showing the queue
 * around a cursor: the centre track large, neighbours smaller and dimmed for a
 * pseudo-3D depth (the device has no skew/perspective, so depth is faked with
 * size + opacity + overlap). Composed from `<image>` + `<rect>` + `<path>` +
 * `<text>` only. See [[streamdeck-svg-renderer-limits]].
 *
 * Covers are rounded via corner-masking (the device ignores clip-path/mask), so
 * the background must be a solid colour - we tint it dark from the now-playing
 * artwork rather than pure black. Two borders disambiguate state: a **white**
 * border marks the browse cursor (always the centre); a **red** border + the
 * play marker follows the actually-playing track across whatever slot it occupies,
 * and an edge arrow points to it (with a track distance) when it scrolls
 * off-screen.
 */

import { pauseBars, svgToDataUri } from "./svg-image";

const W = 200;
const H = 100;
const FONT = "Figtree, -apple-system, 'Segoe UI', Roboto, sans-serif";
const PLACEHOLDER = "#2a2a32";
const ACCENT = "#fa2d48"; // Cider red - the now-playing marker
const CURSOR = "#ffffff"; // browse-cursor border

export interface CoverSlot {
	/** Artwork data URI; when absent a placeholder is drawn. */
	art?: string;
	/** This slot holds the currently-playing track. */
	playing?: boolean;
}

export interface CoverflowModel {
	farLeft?: CoverSlot;
	left?: CoverSlot;
	center: CoverSlot;
	right?: CoverSlot;
	farRight?: CoverSlot;
	title: string;
	artist: string;
	/** 1-based cursor position and queue length, shown top-right. */
	position: number;
	total: number;
	/** Solid background colour (tinted from now-playing artwork). */
	bg: string;
	/** Now-playing track is outside the visible window: which way + how far. */
	offscreen?: { side: "left" | "right"; distance: number };
	/** Playback is paused - dim the now-playing cover and overlay a pause glyph. */
	paused?: boolean;
}

type Geom = { x: number; y: number; s: number; r: number; op: number };

const SLOT: Record<"farLeft" | "left" | "right" | "farRight" | "center", Geom> = {
	farLeft: { x: 2, y: 20, s: 32, r: 6, op: 0.55 },
	left: { x: 28, y: 12, s: 46, r: 7, op: 0.82 },
	center: { x: 69, y: 4, s: 62, r: 9, op: 1 },
	right: { x: 126, y: 12, s: 46, r: 7, op: 0.82 },
	farRight: { x: 166, y: 20, s: 32, r: 6, op: 0.55 },
};

export function renderCoverflow(m: CoverflowModel): string {
	const body =
		`<rect width="${W}" height="${H}" fill="${m.bg}"/>` +
		neighbour(m.farLeft, SLOT.farLeft, m.bg, m.paused) +
		neighbour(m.farRight, SLOT.farRight, m.bg, m.paused) +
		neighbour(m.left, SLOT.left, m.bg, m.paused) +
		neighbour(m.right, SLOT.right, m.bg, m.paused) +
		centre(m.center, SLOT.center, m.paused) +
		offscreen(m.offscreen) +
		`<rect x="4" y="68" width="192" height="30" rx="8" fill="#000000" opacity="0.4"/>` +
		`<text x="100" y="81" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="600" fill="#ffffff">${escape(truncate(m.title, 26))}</text>` +
		`<text x="100" y="93" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="400" fill="#c4c4cd">${escape(truncate(m.artist, 34))}</text>` +
		`<rect x="162" y="1" width="36" height="14" rx="4" fill="#000000" opacity="0.4"/>` +
		`<text x="196" y="11" text-anchor="end" font-family="${FONT}" font-size="9" font-weight="500" fill="#c4c4cd">${m.position} / ${m.total}</text>`;
	return frame(body);
}

/** A centred single-line message (offline / empty queue). */
export function renderCoverflowMessage(text: string, bg = "#0e0e12"): string {
	return frame(
		`<rect width="${W}" height="${H}" fill="${bg}"/>` +
			`<text x="100" y="55" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="500" fill="#c4c4cd">${escape(text)}</text>`,
	);
}

/** Centre/cursor cover: always bordered - red if it is the playing track, else white. */
function centre(slot: CoverSlot, g: Geom, paused?: boolean): string {
	return bordered(slot, g, slot.playing ? ACCENT : CURSOR, paused);
}

/** Neighbour cover: red-bordered only if it is the playing track, else plain. */
function neighbour(slot: CoverSlot | undefined, g: Geom, bg: string, paused?: boolean): string {
	if (!slot) return "";
	return slot.playing ? bordered(slot, g, ACCENT, paused) : plain(slot, g, bg);
}

/** Rounded cover masked against the solid background. */
function plain(slot: CoverSlot, g: Geom, bg: string): string {
	if (!slot.art) {
		return `<rect x="${g.x}" y="${g.y}" width="${g.s}" height="${g.s}" rx="${g.r}" fill="${PLACEHOLDER}" opacity="${g.op}"/>`;
	}
	return (
		`<image xlink:href="${slot.art}" x="${g.x}" y="${g.y}" width="${g.s}" height="${g.s}" preserveAspectRatio="xMidYMid slice" opacity="${g.op}"/>` +
		`<path d="${corners(g.x, g.y, g.s, g.r)}" fill="${bg}"/>`
	);
}

/** Rounded cover inset inside a coloured card -> a clean rounded border. */
function bordered(slot: CoverSlot, g: Geom, color: string, paused?: boolean): string {
	const b = 2;
	const ix = g.x + b;
	const iy = g.y + b;
	const is = g.s - b * 2;
	const ir = Math.max(1, g.r - 1);
	const card = `<rect x="${g.x}" y="${g.y}" width="${g.s}" height="${g.s}" rx="${g.r}" fill="${color}"/>`;
	const showPause = !!(slot.playing && paused);
	const base = slot.art
		? `<image xlink:href="${slot.art}" x="${ix}" y="${iy}" width="${is}" height="${is}" preserveAspectRatio="xMidYMid slice"/>`
		: `<rect x="${ix}" y="${iy}" width="${is}" height="${is}" rx="${ir}" fill="${PLACEHOLDER}"/>`;
	const dim = showPause ? `<rect x="${ix}" y="${iy}" width="${is}" height="${is}" fill="#000000" opacity="0.45"/>` : "";
	// The corner mask rounds the image (and the paused dim over it); a bare
	// placeholder is already rounded, so it only needs the mask when dimmed.
	const mask = slot.art || showPause ? `<path d="${corners(ix, iy, is, ir)}" fill="${color}"/>` : "";
	const bars = showPause ? pauseBars(ix, iy, is) : "";
	return card + base + dim + mask + bars;
}

/** Edge arrow + track distance pointing to an off-screen now-playing track. */
function offscreen(o: CoverflowModel["offscreen"]): string {
	if (!o) return "";
	const label = String(o.distance);
	if (o.side === "left") {
		return (
			`<rect x="0" y="24" width="20" height="34" rx="6" fill="#000000" opacity="0.5"/>` +
			`<path d="M14 30 L5 40 L14 50 Z" fill="${ACCENT}"/>` +
			`<text x="10" y="58" text-anchor="middle" font-family="${FONT}" font-size="8" font-weight="600" fill="#ffffff">${label}</text>`
		);
	}
	return (
		`<rect x="180" y="24" width="20" height="34" rx="6" fill="#000000" opacity="0.5"/>` +
		`<path d="M186 30 L195 40 L186 50 Z" fill="${ACCENT}"/>` +
		`<text x="190" y="58" text-anchor="middle" font-family="${FONT}" font-size="8" font-weight="600" fill="#ffffff">${label}</text>`
	);
}

/** Four corner cut-outs (filled with the background) to round an image. */
function corners(x: number, y: number, s: number, r: number): string {
	return (
		`M${x} ${y} L${x + r} ${y} A${r} ${r} 0 0 0 ${x} ${y + r} Z ` +
		`M${x + s} ${y} L${x + s - r} ${y} A${r} ${r} 0 0 1 ${x + s} ${y + r} Z ` +
		`M${x + s} ${y + s} L${x + s - r} ${y + s} A${r} ${r} 0 0 0 ${x + s} ${y + s - r} Z ` +
		`M${x} ${y + s} L${x + r} ${y + s} A${r} ${r} 0 0 1 ${x} ${y + s - r} Z`
	);
}

function frame(body: string): string {
	return svgToDataUri(
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
			`width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`,
	);
}

function truncate(text: string, max: number): string {
	const t = text ?? "";
	return t.length <= max ? t : `${t.slice(0, Math.max(1, max - 1))}…`;
}

function escape(text: string): string {
	return (text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
