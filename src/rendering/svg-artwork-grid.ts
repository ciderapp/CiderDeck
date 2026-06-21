/**
 * Renders one cell of a multi-key album-art grid. Several "Album Art Grid"
 * instances placed in a block self-organize (by coordinates) into an NxM grid;
 * each cell shows its slice of the current artwork so the whole block reads as
 * one large cover.
 *
 * The crop is done with the SVG **viewBox**: the full artwork is drawn across
 * the entire grid's coordinate space (`cols*U x rows*U`) and each cell's viewBox
 * selects just its `UxU` window - no native image cropping needed. Only the
 * grid's *outer* corners are rounded (via the corner-mask technique). Device-safe
 * primitives only. See [[streamdeck-svg-renderer-limits]].
 */

import { pauseBars, svgToDataUri } from "./svg-image";

const U = 144; // per-cell unit in the shared coordinate space
const R = 16; // outer-corner radius

export function renderArtworkCell(
	art: string | undefined,
	gx: number,
	gy: number,
	cols: number,
	rows: number,
	paused = false,
): string {
	const W = cols * U;
	const H = rows * U;
	const x0 = gx * U;
	const y0 = gy * U;

	const cellBg = `<rect x="${x0}" y="${y0}" width="${U}" height="${U}" fill="#000000"/>`;
	const image = art
		? `<image xlink:href="${art}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
		: "";

	let overlay = "";
	if (paused) {
		// Dim this cell, and draw the pause glyph centred on the *whole* grid so the
		// block shows one pause icon spanning the cells (each viewBox shows its part).
		overlay = `<rect x="${x0}" y="${y0}" width="${U}" height="${U}" fill="#000000" opacity="0.45"/>`;
		const sz = Math.min(W, H) * 0.42;
		overlay += pauseBars(W / 2 - sz / 2, H / 2 - sz / 2, sz);
	}

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
		`width="${U}" height="${U}" viewBox="${x0} ${y0} ${U} ${U}">` +
		cellBg +
		image +
		overlay +
		outerCorners(gx, gy, cols, rows) +
		`</svg>`;
	return svgToDataUri(svg);
}

/** Black corner wedges for the grid-exterior corners this cell owns. */
function outerCorners(gx: number, gy: number, cols: number, rows: number): string {
	const x0 = gx * U;
	const y0 = gy * U;
	const x1 = (gx + 1) * U;
	const y1 = (gy + 1) * U;
	let s = "";
	if (gx === 0 && gy === 0) s += wedge(`M${x0} ${y0} L${x0 + R} ${y0} A${R} ${R} 0 0 0 ${x0} ${y0 + R} Z`);
	if (gx === cols - 1 && gy === 0) s += wedge(`M${x1} ${y0} L${x1 - R} ${y0} A${R} ${R} 0 0 1 ${x1} ${y0 + R} Z`);
	if (gx === 0 && gy === rows - 1) s += wedge(`M${x0} ${y1} L${x0 + R} ${y1} A${R} ${R} 0 0 1 ${x0} ${y1 - R} Z`);
	if (gx === cols - 1 && gy === rows - 1) s += wedge(`M${x1} ${y1} L${x1 - R} ${y1} A${R} ${R} 0 0 0 ${x1} ${y1 - R} Z`);
	return s;
}

function wedge(d: string): string {
	return `<path d="${d}" fill="#000000"/>`;
}
