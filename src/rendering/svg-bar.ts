/**
 * Renders a rounded (pill) progress/volume bar as an SVG data URI for use as a
 * Stream Deck + touchscreen `pixmap` feedback item - the native `bar`/`gbar`
 * types are square-cornered and can't be rounded.
 */

export interface BarOptions {
	/** Fill amount, 0-100. */
	percent: number;
	width: number;
	height: number;
	fill: string;
	bg: string;
	/** Corner radius; defaults to a full pill (height / 2). */
	radius?: number;
}

export function renderBarDataUri(opts: BarOptions): string {
	const { width, height, fill, bg } = opts;
	const r = opts.radius ?? height / 2;
	const pct = Math.max(0, Math.min(100, opts.percent)) / 100;
	const fillW = Math.max(0, Math.round(width * pct));

	const track = `<rect x="0" y="0" width="${width}" height="${height}" rx="${r}" ry="${r}" fill="${bg}"/>`;
	// Rounded fill rect (no clipPath, for rasterizer robustness); rx is clamped so a
	// thin fill stays a neat pill rather than overflowing its width.
	const fillR = Math.min(r, fillW / 2);
	const fillRect =
		fillW > 0
			? `<rect x="0" y="0" width="${fillW}" height="${height}" rx="${fillR}" ry="${r}" fill="${fill}"/>`
			: "";

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
		track +
		fillRect +
		`</svg>`;

	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
