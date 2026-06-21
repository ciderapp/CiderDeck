/**
 * Composited "status strip" for the SD+ playback dial: a centered row of small
 * state icons (favorite / library / shuffle / repeat) that the user opts into in
 * the dial's settings. Rendered as a single pixmap that's only re-sent when a
 * status actually changes, so the native player layout keeps its cheap title
 * marquee + live progress bar.
 *
 * Uses the real app glyphs (see [[use-sdpi-native-styling]] spirit - match the
 * plugin's own iconography). Active icons are full-opacity with a Cider-red
 * underline; inactive ones are dimmed.
 */

import type { RepeatMode } from "../models/player-state";
import { assetDataUri } from "../util/asset";
import { svgToDataUri } from "./svg-image";

const G = {
	star: assetDataUri("actions/assets/app/star.png"),
	plus: assetDataUri("actions/assets/app/plus.png"),
	check: assetDataUri("actions/assets/app/check.png"),
	shuffle: assetDataUri("actions/assets/app/shuffle.png"),
	repeat: assetDataUri("actions/assets/app/repeat.png"),
	repeatOne: assetDataUri("actions/assets/app/repeat-once.png"),
};
const ACCENT = "#fa2d48";
const FONT = "Figtree, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Canvas matches the layout "status" rect aspect (100x24 ~ 4.17:1) at 3x.
const W = 300;
const H = 72;
const IS = 50; // icon size
const GAP = 16;

export type StatusItem =
	| { kind: "favorite"; active: boolean }
	| { kind: "library"; active: boolean }
	| { kind: "shuffle"; active: boolean }
	| { kind: "repeat"; mode: RepeatMode };

function glyphFor(item: StatusItem): { href: string | undefined; active: boolean } {
	switch (item.kind) {
		case "favorite":
			return { href: G.star, active: item.active };
		case "library":
			return { href: item.active ? G.check : G.plus, active: item.active };
		case "shuffle":
			return { href: G.shuffle, active: item.active };
		case "repeat":
			return { href: item.mode === "one" ? G.repeatOne : G.repeat, active: item.mode !== "none" };
	}
}

/** Render the enabled status icons, centered. Empty input -> a blank strip. */
export function renderStatusStrip(items: StatusItem[]): string {
	let body = "";
	if (items.length) {
		const total = items.length * IS + (items.length - 1) * GAP;
		let x = (W - total) / 2;
		const y = (H - IS) / 2 - 4;
		for (const item of items) {
			const { href, active } = glyphFor(item);
			if (href) {
				body += `<image xlink:href="${href}" x="${x}" y="${y}" width="${IS}" height="${IS}" opacity="${active ? 1 : 0.3}"/>`;
			}
			if (active) {
				body += `<rect x="${x + IS / 2 - 12}" y="${y + IS + 3}" width="24" height="5" rx="2.5" fill="${ACCENT}"/>`;
			}
			x += IS + GAP;
		}
	}
	return svgToDataUri(
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`,
	);
}

/** Volume-mode variant: the percentage centered in the same status slot (the
 *  center area doubles as the volume readout, since the layout has no separate
 *  center text item). */
export function renderVolumeLabel(pct: number): string {
	return svgToDataUri(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
			`<text x="${W / 2}" y="${H / 2 + 16}" text-anchor="middle" font-family="${FONT}" font-size="44" font-weight="600" fill="#ffffff">${pct}%</text>` +
			`</svg>`,
	);
}

function escapeText(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Full-touchscreen action carousel (the held-touch "extras" picker). The
 * selected action sits large in the centre over an accent halo with its label
 * below; the previous/next actions flank it dimmed. Rotating the dial moves the
 * selection; a tap/press fires it.
 */
export function renderActionCarousel(
	items: { glyph?: string; label: string; active?: boolean }[],
	selected: number,
): string {
	const CW = 200;
	const CH = 100;
	const n = items.length;
	if (!n) return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}"></svg>`);
	const at = (off: number) => items[(((selected + off) % n) + n) % n];
	const img = (it: { glyph?: string }, x: number, y: number, sz: number, op: number) =>
		it.glyph ? `<image xlink:href="${it.glyph}" x="${x}" y="${y}" width="${sz}" height="${sz}" opacity="${op}"/>` : "";
	// Active (on) state, like the full tiles: the centre gets an accent halo, the
	// side actions a small accent dot beneath them.
	const dot = (it: { active?: boolean }, cx: number, cy: number) =>
		it.active ? `<circle cx="${cx}" cy="${cy}" r="2.6" fill="${ACCENT}"/>` : "";
	const center = at(0);
	const body =
		`<rect width="${CW}" height="${CH}" fill="#0e0e12"/>` +
		`<circle cx="100" cy="32" r="25" fill="${center.active ? ACCENT : "#ffffff"}" opacity="${center.active ? 0.5 : 0.1}"/>` +
		(n >= 3
			? img(at(-1), 27, 20, 24, 0.4) + dot(at(-1), 39, 49) + img(at(1), 149, 20, 24, 0.4) + dot(at(1), 161, 49)
			: "") +
		img(center, 82, 13, 36, 1) +
		`<text x="100" y="74" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="600" fill="#ffffff">${escapeText(center.label)}</text>` +
		`<text x="100" y="92" text-anchor="middle" font-family="${FONT}" font-size="9.5" fill="#ffffff" opacity="0.7">rotate to browse · tap/press to confirm</text>`;
	return svgToDataUri(
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">${body}</svg>`,
	);
}
