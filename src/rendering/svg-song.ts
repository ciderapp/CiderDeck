/**
 * Renders the Song Display tile as an SVG string: colours, font, alignment,
 * show artist/album, max lines, custom format, prefix. Long lines are truncated
 * with an ellipsis, or marqueed via the animation ticker when `scroll` is given.
 */

import type { NowPlaying } from "../models/player-state";
import { DEFAULTS, type SongDisplaySettings } from "../models/settings";
import { formatSongInfo } from "../util/format";
import { marqueeWindow } from "./animation-ticker";
import { svgToDataUri } from "./svg-image";

const SIZE = 144;

/** True when any rendered line overflows the tile (i.e. marquee would help). */
export function songNeedsMarquee(track: NowPlaying | null, raw: SongDisplaySettings): boolean {
	const s = { ...DEFAULTS.songDisplay, ...raw };
	const maxChars = estimateMaxChars(s.fontSize ?? 18, s.alignment === "center" ? SIZE - 16 : SIZE - 20);
	return buildLines(track, s)
		.slice(0, s.maxLines ?? 3)
		.some((line) => line.length > maxChars);
}

/** Render the song tile. When `scroll` is given, overflowing lines marquee. */
export function renderSongSvg(track: NowPlaying | null, raw: SongDisplaySettings, scroll?: number): string {
	const s = { ...DEFAULTS.songDisplay, ...raw };
	const lines = buildLines(track, s).slice(0, s.maxLines ?? 3);

	const fontSize = s.fontSize ?? 18;
	const lineHeight = Math.round(fontSize * 1.2);
	const subFontSize = Math.round(fontSize * 0.82);

	const anchor = s.alignment === "left" ? "start" : s.alignment === "right" ? "end" : "middle";
	const x = s.alignment === "left" ? 10 : s.alignment === "right" ? SIZE - 10 : SIZE / 2;
	const maxChars = estimateMaxChars(fontSize, s.alignment === "center" ? SIZE - 16 : SIZE - 20);

	const blockHeight = lines.reduce((h, _, i) => h + (i === 0 ? lineHeight : Math.round(subFontSize * 1.25)), 0);
	let y = Math.round((SIZE - blockHeight) / 2) + (lines.length ? fontSize : 0);

	const tspans = lines
		.map((line, i) => {
			const size = i === 0 ? fontSize : subFontSize;
			const weight = i === 0 ? 600 : 400;
			const dy = i === 0 ? 0 : Math.round(subFontSize * 1.25);
			y += dy;
			const shown =
				scroll !== undefined && line.length > maxChars
					? marqueeWindow(line, maxChars, scroll)
					: truncate(line, maxChars);
			return `<text x="${x}" y="${y}" fill="${escapeAttr(s.textColor ?? "#fff")}" font-family="${escapeAttr(
				s.fontFamily ?? "sans-serif",
			)}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeText(shown)}</text>`;
		})
		.join("");

	return svgToDataUri(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
			`<rect width="${SIZE}" height="${SIZE}" fill="${escapeAttr(s.backgroundColor ?? "#000")}"/>` +
			tspans +
			`</svg>`,
	);
}

/** A simple "offline" placeholder tile. */
export function renderOfflineSvg(backgroundColor = "#0b0b0f"): string {
	return svgToDataUri(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
			`<rect width="${SIZE}" height="${SIZE}" fill="${escapeAttr(backgroundColor)}"/>` +
			`<text x="${SIZE / 2}" y="${SIZE / 2 + 5}" fill="#777" font-family="sans-serif" font-size="15" text-anchor="middle">Offline</text>` +
			`</svg>`,
	);
}

function buildLines(track: NowPlaying | null, s: SongDisplaySettings): string[] {
	if (!track || !track.title) return ["Not Playing"];
	const prefix = s.textPrefix ?? "";
	if (s.customFormat && s.customFormat.trim()) {
		return formatSongInfo(prefix + s.customFormat, {
			title: track.title,
			artist: track.artist,
			album: track.album,
			durationMs: track.durationMs,
		})
			.split("\n")
			.filter((l) => l.length > 0);
	}
	const lines = [prefix + track.title];
	if (s.showArtist && track.artist) lines.push(track.artist);
	if (s.showAlbum && track.album) lines.push(track.album);
	return lines;
}

function estimateMaxChars(fontSize: number, width: number): number {
	// Rough average glyph advance ~ 0.55 x font size for sans-serif.
	return Math.max(6, Math.floor(width / (fontSize * 0.55)));
}

function truncate(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`;
}

function escapeText(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
	return escapeText(text).replace(/"/g, "&quot;");
}
