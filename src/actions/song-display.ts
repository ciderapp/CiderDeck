import { action, type KeyAction } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import type { SongDisplaySettings } from "../models/settings";
import { renderOfflineSvg, renderSongSvg } from "../rendering/svg-song";
import { CiderKeyAction } from "./base/cider-action";

const TICK_ID = "song-display";

/** Read-only text tile (SVG) of the current song, with marquee scrolling for overflowing lines. */
@action({ UUID: UUID.SONGNAME })
export class SongDisplayAction extends CiderKeyAction {
	private offset = 0;
	private animating = false;
	private lastTrackId: string | undefined;
	private readonly lastSvg = new Map<string, string>();

	protected slices(): ["track"] {
		return ["track"];
	}

	protected override repaintAll(state: Readonly<PlayerState>): void {
		const trackId = state.nowPlaying?.id ?? state.nowPlaying?.title;
		if (trackId !== this.lastTrackId) {
			this.lastTrackId = trackId;
			this.offset = 0;
			this.lastSvg.clear();
		}
		this.setAnimating(state.online && !!state.nowPlaying);
		this.renderAll(state);
	}

	protected async paint(action: KeyAction, state: Readonly<PlayerState>): Promise<void> {
		const settings = (await action.getSettings()) as SongDisplaySettings;
		const svg = !state.online
			? renderOfflineSvg(settings.backgroundColor)
			: renderSongSvg(state.nowPlaying, settings, this.animating ? this.offset : undefined);
		if (this.lastSvg.get(action.id) === svg) return; // skip redundant frames
		this.lastSvg.set(action.id, svg);
		void action.setImage(svg);
	}

	private renderAll(state: Readonly<PlayerState>): void {
		for (const a of this.actions) {
			if (a.isKey()) void this.paint(a, state);
		}
	}

	private setAnimating(on: boolean): void {
		if (on === this.animating) return;
		this.animating = on;
		if (on) {
			this.services.ticker.subscribe(TICK_ID, () => {
				this.offset++;
				this.renderAll(this.store.snapshot);
			});
		} else {
			this.services.ticker.unsubscribe(TICK_ID);
		}
	}

	protected override onLastDisappear(): void {
		this.setAnimating(false);
		this.lastSvg.clear();
	}

	protected override invalidateCaches(): void {
		this.lastSvg.clear();
	}

	override async onDidReceiveSettings(): Promise<void> {
		this.lastSvg.clear(); // formatting changed; force re-render
		this.renderAll(this.store.snapshot);
	}
}
