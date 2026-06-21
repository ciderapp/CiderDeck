/**
 * Wraps a raster image (data URI) in an SVG with rounded corners, for use as a
 * Stream Deck + touchscreen `pixmap`.
 *
 * The touchscreen SVG renderer ignores `clip-path` / `mask`, so we can't clip the
 * image. Instead we draw the full image and paint over the four corners with the
 * touchscreen background colour (black) using arc paths - only `<image>` and
 * `<path>` fills are needed, both of which the renderer supports.
 */

/**
 * Wrap a raw SVG string as a base64 `data:` URI. The Stream Deck app's
 * `setImage` handler does not render a bare `<svg>` XML string on-device (it is
 * silently dropped, leaving the manifest icon); a base64 data URI is the
 * verified-working form (same encoding the dial pixmaps use).
 */
export function svgToDataUri(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Two white "paused" bars centred in the square at (x, y) of side `s`. Shared by
 * the dial artwork and the coverflow now-playing cover so the paused overlay
 * looks identical in both.
 */
export function pauseBars(x: number, y: number, s: number): string {
	const barW = Math.max(2, Math.round(s * 0.11));
	const barH = Math.round(s * 0.34);
	const gap = Math.round(s * 0.12);
	const by = y + Math.round((s - barH) / 2);
	const cx = x + s / 2;
	const r = Math.max(1, Math.round(barW / 2.5));
	return (
		`<rect x="${cx - gap / 2 - barW}" y="${by}" width="${barW}" height="${barH}" rx="${r}" fill="#ffffff"/>` +
		`<rect x="${cx + gap / 2}" y="${by}" width="${barW}" height="${barH}" rx="${r}" fill="#ffffff"/>`
	);
}

export function renderRoundedImage(href: string, size: number, radius: number, bg = "#000000", paused = false): string {
	const s = size;
	const r = radius;
	// Four corner cut-outs (square corner minus the quarter-circle), filled with bg.
	const corners =
		`M0 0 L${r} 0 A${r} ${r} 0 0 0 0 ${r} Z ` +
		`M${s} 0 L${s - r} 0 A${r} ${r} 0 0 1 ${s} ${r} Z ` +
		`M${s} ${s} L${s - r} ${s} A${r} ${r} 0 0 0 ${s} ${s - r} Z ` +
		`M0 ${s} L${r} ${s} A${r} ${r} 0 0 1 0 ${s - r} Z`;

	// Paused: dim the art (drawn before the corner mask so its corners round too)
	// and place the pause bars on top.
	const dim = paused ? `<rect width="${s}" height="${s}" fill="#000000" opacity="0.45"/>` : "";
	const bars = paused ? pauseBars(0, 0, s) : "";

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
		`width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">` +
		`<image xlink:href="${href}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid slice"/>` +
		`${dim}<path d="${corners}" fill="${bg}"/>${bars}` +
		`</svg>`;
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
