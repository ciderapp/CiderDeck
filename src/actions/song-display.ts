import {
	action,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import type { SongDisplaySettings } from "../models/settings";
import { renderOfflineSvg, renderSongSvg, songNeedsMarquee } from "../rendering/svg-song";
import { CiderKeyAction } from "./base/cider-action";

const TICK_ID = "song-display";

/** Read-only text tile (SVG) of the current song, with marquee scrolling for overflowing lines. */
@action({ UUID: UUID.SONGNAME })
export class SongDisplayAction extends CiderKeyAction {
	private offset = 0;
	private animating = false;
	private lastTrackId: string | undefined;
	private readonly settings = new Map<string, SongDisplaySettings>();
	private readonly needsMarquee = new Map<string, boolean>();
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
		this.renderAll(state);
		this.updateTicker();
	}

	override onWillAppear(ev: WillAppearEvent): void {
		this.settings.set(ev.action.id, (ev.payload.settings ?? {}) as SongDisplaySettings);
		super.onWillAppear(ev);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		this.settings.delete(ev.action.id);
		this.needsMarquee.delete(ev.action.id);
		this.lastSvg.delete(ev.action.id);
		super.onWillDisappear(ev);
		this.updateTicker();
	}

	protected override paintInstance(ev: WillAppearEvent, state: Readonly<PlayerState>): void {
		if (ev.action.isKey()) this.paint(ev.action, state);
		this.updateTicker();
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		const settings = this.settings.get(action.id) ?? {};
		const needsMarquee = state.online && !!state.nowPlaying && songNeedsMarquee(state.nowPlaying, settings);
		this.needsMarquee.set(action.id, needsMarquee);
		const svg = !state.online
			? renderOfflineSvg(settings.backgroundColor)
			: renderSongSvg(state.nowPlaying, settings, needsMarquee ? this.offset : undefined);
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

	private updateTicker(): void {
		for (const needed of this.needsMarquee.values()) {
			if (needed) {
				this.setAnimating(true);
				return;
			}
		}
		this.setAnimating(false);
	}

	protected override onLastDisappear(): void {
		this.setAnimating(false);
		this.settings.clear();
		this.needsMarquee.clear();
		this.lastSvg.clear();
	}

	protected override invalidateCaches(): void {
		this.lastSvg.clear();
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		this.settings.set(ev.action.id, (ev.payload.settings ?? {}) as SongDisplaySettings);
		this.lastSvg.delete(ev.action.id); // formatting changed; force re-render
		if (ev.action.isKey()) this.paint(ev.action, this.store.snapshot);
		this.updateTicker();
	}
}
