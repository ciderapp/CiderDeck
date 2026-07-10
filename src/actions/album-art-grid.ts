import {
	action,
	type KeyAction,
	type KeyDownEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { renderArtworkCell } from "../rendering/svg-artwork-grid";
import { resolveArtwork } from "../util/format";
import { CiderKeyAction } from "./base/cider-action";

/**
 * One cell of a multi-key album-art grid. Place several across a block of keys
 * (e.g. a 2x2) and they self-organize by coordinates into a grid, each painting
 * its slice of the current artwork so the block reads as one large cover. A
 * single instance just shows the whole cover (like Album Art). Adding/removing a
 * cell re-tiles every cell.
 *
 * Clicking any cell toggles play/pause.
 */
@action({ UUID: UUID.ALBUM_ART_GRID })
export class AlbumArtGridAction extends CiderKeyAction {
	private readonly lastSvg = new Map<string, string>();
	private repaintTimer?: ReturnType<typeof setTimeout>;

	protected slices(): ["track", "playState"] {
		return ["track", "playState"];
	}

	override onWillAppear(ev: WillAppearEvent): void {
		super.onWillAppear(ev);
		this.scheduleRepaint(); // a new cell changes the grid - re-tile every cell
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		super.onWillDisappear(ev);
		this.scheduleRepaint();
	}

	/**
	 * Click album art = toggle play/pause
	 */
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await this.run(ev.action, () => this.client.toggle());
	}

	protected async paint(action: KeyAction, state: Readonly<PlayerState>): Promise<void> {
		const g = this.gridFor(action);

		let svg: string;

		if (!state.online) {
			svg = renderArtworkCell(
				undefined,
				g.gx,
				g.gy,
				g.cols,
				g.rows,
				false
			);
		} else {
			const paused = !!state.nowPlaying && !state.playing;

			// Request enough resolution that each cell still looks sharp (~2x per cell).
			const px = Math.min(1024, Math.max(g.cols, g.rows) * 320);

			const url = resolveArtwork(
				state.nowPlaying?.artworkUrl,
				px
			);

			const art = url
				? await this.services.artwork.getDataUri(url)
				: undefined;

			svg = renderArtworkCell(
				art,
				g.gx,
				g.gy,
				g.cols,
				g.rows,
				paused
			);
		}

		if (this.lastSvg.get(action.id) === svg) return;

		this.lastSvg.set(action.id, svg);
		void action.setImage(svg);
	}

	/**
	 * This cell's position + the grid's size,
	 * from the bounding box of all cells.
	 */
	private gridFor(action: KeyAction): {
		gx: number;
		gy: number;
		cols: number;
		rows: number;
	} {
		let minC = Number.POSITIVE_INFINITY;
		let minR = Number.POSITIVE_INFINITY;
		let maxC = Number.NEGATIVE_INFINITY;
		let maxR = Number.NEGATIVE_INFINITY;

		for (const a of this.actions) {
			if (!a.isKey()) continue;

			const c = a.coordinates;
			if (!c) continue;

			minC = Math.min(minC, c.column);
			maxC = Math.max(maxC, c.column);
			minR = Math.min(minR, c.row);
			maxR = Math.max(maxR, c.row);
		}

		const c = action.coordinates;

		if (!c || !Number.isFinite(minC)) {
			return {
				gx: 0,
				gy: 0,
				cols: 1,
				rows: 1,
			};
		}

		return {
			gx: c.column - minC,
			gy: c.row - minR,
			cols: maxC - minC + 1,
			rows: maxR - minR + 1,
		};
	}

	private scheduleRepaint(): void {
		if (this.repaintTimer) return;

		this.repaintTimer = setTimeout(() => {
			this.repaintTimer = undefined;

			const state = this.store.snapshot;

			for (const a of this.actions) {
				if (a.isKey()) {
					void this.paint(a, state);
				}
			}
		}, 60);
	}

	protected override invalidateCaches(): void {
		this.lastSvg.clear();
	}

	protected override onLastDisappear(): void {
		if (this.repaintTimer) {
			clearTimeout(this.repaintTimer);
			this.repaintTimer = undefined;
		}

		this.lastSvg.clear();
	}
}
