import {
	action,
	type DialAction,
	type DialDownEvent,
	type DialRotateEvent,
	type DialUpEvent,
	type DidReceiveSettingsEvent,
	type TouchTapEvent,
	type WillAppearEvent,
} from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { DEFAULTS, type DialSettings } from "../models/settings";
import { marqueeWindow } from "../rendering/animation-ticker";
import { renderBarDataUri } from "../rendering/svg-bar";
import { renderRoundedImage } from "../rendering/svg-image";
import {
	renderActionCarousel,
	renderStatusStrip,
	renderVolumeLabel,
	type StatusItem,
} from "../rendering/svg-status-strip";
import { assetDataUri } from "../util/asset";
import { formatTime, resolveArtwork } from "../util/format";
import { CiderDialAction } from "./base/cider-dial-action";

const TICK_ID = "playback-dial";
const TITLE_WIDTH = 16;
const BAR = { w: 184, h: 6 };
const BAR_BG = "#3a3a44";
const PROGRESS_FILL = "#fa2d48";
const VOLUME_FILL = "#ffffff";
const DEFAULT_ICON = "actions/assets/app/icon.png";
const OFFLINE_ICON = "actions/assets/buttons/offline/media-playlist.png";
const ICON_SIZE = 40; // matches the icon rect in layouts/playback.json
const ICON_RADIUS = 6;

const PLAYER_LAYOUT = "layouts/playback.json";
const CAROUSEL_LAYOUT = "layouts/dial-actions.json";
const CAROUSEL_IDLE_MS = 8000; // auto-exit the action carousel after this idle
const LONGPRESS_MS = 500; // hold the dial this long to open the carousel (tactile alt. to touch-hold)
const ACTION_GLYPH = {
	play: assetDataUri("actions/assets/app/media-play.png"),
	pause: assetDataUri("actions/assets/app/media-pause.png"),
	star: assetDataUri("actions/assets/app/star.png"),
	plus: assetDataUri("actions/assets/app/plus.png"),
	check: assetDataUri("actions/assets/app/check.png"),
	dislike: assetDataUri("actions/assets/app/thumbs-down.png"),
	shuffle: assetDataUri("actions/assets/app/shuffle.png"),
	repeat: assetDataUri("actions/assets/app/repeat.png"),
	repeatOne: assetDataUri("actions/assets/app/repeat-once.png"),
};

type DialMode = "progress" | "volume";

/**
 * Stream Deck + encoder showing now-playing on the touchscreen.
 *
 * - **Progress mode** (default): rounded progress bar with the elapsed time on
 *   the left and remaining time on the right. Rotate seeks.
 * - **Volume mode**: rounded volume bar with the percentage centred below.
 *   Rotate adjusts volume.
 * - **Press** toggles between the two modes; **tap** plays/pauses (configurable).
 */
@action({ UUID: UUID.PLAYBACK })
export class PlaybackDialAction extends CiderDialAction {
	/** Per-instance display mode (transient UI state, not persisted). */
	private readonly mode = new Map<string, DialMode>();
	/** Last artwork sent per instance, so the image is only resent on track change. */
	private readonly lastIcon = new Map<string, string>();
	/** Last status strip sent per instance, so it's only resent when a state changes. */
	private readonly lastStatus = new Map<string, string>();
	private readonly settingsCache = new Map<string, DialSettings>();
	/** Per-dial action-carousel state: present = active, value = selected index. */
	private readonly carousel = new Map<string, number>();
	private readonly idleTimer = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly lastCarousel = new Map<string, string>();
	/** Dial long-press detection: a pending open timer, and a flag so the matching
	 *  release (or a rotate mid-press) doesn't also run the short-press action. */
	private readonly pressTimer = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly pressConsumed = new Set<string>();
	private offset = 0;
	private animating = false;
	private lastTrackId: string | undefined;

	/** The "extras" shown in the held-touch carousel - each derives its glyph,
	 *  label and active (on) state from the live player state, like the full tiles. */
	private readonly carouselActions: {
		display: (s: Readonly<PlayerState>) => { glyph: string | undefined; label: string; active: boolean };
		run: () => Promise<void>;
		/** Multi-state action (e.g. repeat): keep the carousel open after firing so
		 *  the user can cycle through its states instead of dismissing. */
		keepOpen?: boolean;
	}[] = [
		{
			display: (s) =>
				s.playing
					? { glyph: ACTION_GLYPH.pause, label: "Pause", active: false }
					: { glyph: ACTION_GLYPH.play, label: "Play", active: false },
			run: () => this.client.toggle(),
		},
		{
			display: (s) => ({ glyph: ACTION_GLYPH.star, label: s.inFavorites ? "Favorited" : "Favorite", active: s.inFavorites }),
			run: () => this.client.love(),
		},
		{
			display: (s) =>
				s.inLibrary
					? { glyph: ACTION_GLYPH.check, label: "In Library", active: true }
					: { glyph: ACTION_GLYPH.plus, label: "Add to Library", active: false },
			run: () => (this.store.snapshot.inLibrary ? this.client.removeFromLibrary() : this.client.addToLibrary()),
		},
		{
			display: (s) => ({ glyph: ACTION_GLYPH.dislike, label: s.rating === -1 ? "Disliked" : "Dislike", active: s.rating === -1 }),
			run: () => this.client.dislike(),
		},
		{
			display: (s) => ({ glyph: ACTION_GLYPH.shuffle, label: s.shuffle ? "Shuffle: On" : "Shuffle: Off", active: s.shuffle }),
			run: () => this.client.toggleShuffle(),
		},
		{
			display: (s) => ({
				glyph: s.repeatMode === "one" ? ACTION_GLYPH.repeatOne : ACTION_GLYPH.repeat,
				label: s.repeatMode === "none" ? "Repeat: Off" : s.repeatMode === "one" ? "Repeat: One" : "Repeat: All",
				active: s.repeatMode !== "none",
			}),
			run: () => this.client.toggleRepeat(),
			keepOpen: true,
		},
	];

	protected slices(): ["track", "time", "volume", "playState", "favorite", "library", "shuffle", "repeat"] {
		return ["track", "time", "volume", "playState", "favorite", "library", "shuffle", "repeat"];
	}

	override onWillAppear(ev: WillAppearEvent): void {
		this.settingsCache.set(ev.action.id, { ...DEFAULTS.dial, ...(ev.payload.settings as DialSettings) });
		// Force the device to (re)load the current layout - a layout-file edit isn't
		// reliably re-read on a hot plugin restart, which can leave a stale/broken
		// layout cached and the encoder showing only its default icon.
		if (ev.action.isDial()) void ev.action.setFeedbackLayout(PLAYER_LAYOUT);
		super.onWillAppear(ev);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		this.settingsCache.set(ev.action.id, { ...DEFAULTS.dial, ...(ev.payload.settings as DialSettings) });
		if (ev.action.isDial()) void this.paint(ev.action, this.store.snapshot);
	}

	protected async paint(dial: DialAction, state: Readonly<PlayerState>): Promise<void> {
		// While the action carousel is open it owns the touchscreen - don't repaint
		// the player view underneath it on incidental store updates.
		if (this.carousel.has(dial.id)) {
			this.paintCarousel(dial);
			return;
		}
		const trackId = state.nowPlaying?.id ?? state.nowPlaying?.title;
		if (trackId !== this.lastTrackId) {
			this.lastTrackId = trackId;
			this.offset = 0;
		}
		this.setAnimating(this.titleNeedsMarquee(state));

		const feedback: Record<string, string | number> = this.buildFeedback(dial, state);
		await this.attachIcon(dial, state, feedback);
		this.attachStatus(dial, state, feedback);
		void dial.setFeedback(feedback);
	}

	/** Build the configurable status strip; only resend it when it changes. */
	private attachStatus(
		dial: DialAction,
		state: Readonly<PlayerState>,
		feedback: Record<string, string | number>,
	): void {
		let strip: string;
		if ((this.mode.get(dial.id) ?? "progress") === "volume") {
			// Center slot doubles as the volume readout while adjusting volume.
			strip = renderVolumeLabel(Math.round(state.volume * 100));
		} else {
			const s = this.settingsCache.get(dial.id) ?? DEFAULTS.dial;
			const online = state.online;
			const items: StatusItem[] = [];
			if (s.showFavorite) items.push({ kind: "favorite", active: online && state.inFavorites });
			if (s.showLibrary) items.push({ kind: "library", active: online && state.inLibrary });
			if (s.showShuffle) items.push({ kind: "shuffle", active: online && state.shuffle });
			if (s.showRepeat) items.push({ kind: "repeat", mode: online ? state.repeatMode : "none" });
			strip = renderStatusStrip(items);
		}
		if (this.lastStatus.get(dial.id) !== strip) {
			this.lastStatus.set(dial.id, strip);
			feedback.status = strip;
		}
	}

	private buildFeedback(dial: DialAction, state: Readonly<PlayerState>): Record<string, string | number> {
		if (!state.online) {
			return { song: "Cider - Offline", artist: "", bar: this.bar(0, PROGRESS_FILL), tleft: "", tright: "" };
		}

		const song = this.titleText(state);
		const artist = state.nowPlaying?.artist || "";

		// Volume mode: the volume bar; the percentage is drawn in the status slot
		// (attachStatus), so the timestamp ends stay blank.
		if ((this.mode.get(dial.id) ?? "progress") === "volume") {
			return { song, artist, bar: this.bar(Math.round(state.volume * 100), VOLUME_FILL), tleft: "", tright: "" };
		}

		const { currentMs, durationMs, remainingMs } = state.time;
		const progressPct = durationMs > 0 ? (currentMs / durationMs) * 100 : 0;
		return {
			song,
			artist,
			bar: this.bar(progressPct, state.nowPlaying?.accentColor ?? PROGRESS_FILL),
			tleft: formatTime(currentMs),
			tright: durationMs > 0 ? `-${formatTime(remainingMs || durationMs - currentMs)}` : "",
		};
	}

	/** Add the album-art icon to the feedback, but only when it changed. */
	private async attachIcon(
		dial: DialAction,
		state: Readonly<PlayerState>,
		feedback: Record<string, string | number>,
	): Promise<void> {
		let icon = state.online ? DEFAULT_ICON : OFFLINE_ICON;
		const url = state.online ? resolveArtwork(state.nowPlaying?.artworkUrl, 144) : undefined;
		const paused = state.online && !!state.nowPlaying && !state.playing;
		if (url) {
			const dataUri = await this.services.artwork.getDataUri(url);
			if (dataUri) icon = renderRoundedImage(dataUri, ICON_SIZE, ICON_RADIUS, "#000000", paused);
		}
		if (this.lastIcon.get(dial.id) !== icon) {
			this.lastIcon.set(dial.id, icon);
			feedback.icon = icon;
		}
	}

	private bar(percent: number, fill: string): string {
		return renderBarDataUri({ percent, width: BAR.w, height: BAR.h, fill, bg: BAR_BG });
	}

	private titleText(state: Readonly<PlayerState>): string {
		const title = state.nowPlaying?.title || "Not Playing";
		return this.animating ? marqueeWindow(title, TITLE_WIDTH, this.offset) : title;
	}

	private titleNeedsMarquee(state: Readonly<PlayerState>): boolean {
		return state.online && (state.nowPlaying?.title?.length ?? 0) > TITLE_WIDTH;
	}

	private setAnimating(on: boolean): void {
		if (on === this.animating) return;
		this.animating = on;
		if (on) {
			this.services.ticker.subscribe(TICK_ID, () => {
				this.offset++;
				const state = this.store.snapshot;
				for (const a of this.actions) {
					// Skip dials showing the carousel - their layout has no "song" item.
					if (a.isDial() && !this.carousel.has(a.id)) void a.setFeedback({ song: this.titleText(state) });
				}
			});
		} else {
			this.services.ticker.unsubscribe(TICK_ID);
		}
	}

	protected override onLastDisappear(): void {
		this.setAnimating(false);
		for (const t of this.idleTimer.values()) clearTimeout(t);
		this.idleTimer.clear();
		for (const t of this.pressTimer.values()) clearTimeout(t);
		this.pressTimer.clear();
		this.pressConsumed.clear();
		this.carousel.clear();
		this.lastCarousel.clear();
		this.lastStatus.clear();
		this.settingsCache.clear();
	}

	protected override invalidateCaches(): void {
		this.lastIcon.clear(); // resend artwork on reconnect even if the track is unchanged
		this.lastStatus.clear();
		this.lastCarousel.clear();
	}

	// --- action carousel (held touch) -------------------------------------

	private paintCarousel(dial: DialAction): void {
		const index = this.carousel.get(dial.id) ?? 0;
		const state = this.store.snapshot;
		const items = this.carouselActions.map((a) => a.display(state));
		const svg = renderActionCarousel(items, index);
		if (this.lastCarousel.get(dial.id) === svg) return;
		this.lastCarousel.set(dial.id, svg);
		void dial.setFeedback({ ac: svg });
	}

	private enterCarousel(dial: DialAction): void {
		this.carousel.set(dial.id, 0);
		this.lastCarousel.delete(dial.id);
		void dial.setFeedbackLayout(CAROUSEL_LAYOUT);
		// Let the layout swap settle before painting into its pixmap key.
		setTimeout(() => {
			if (this.carousel.has(dial.id)) this.paintCarousel(dial);
		}, 60);
		this.armIdle(dial);
	}

	private exitCarousel(dial: DialAction): void {
		if (!this.carousel.delete(dial.id)) return;
		this.lastCarousel.delete(dial.id);
		this.clearIdle(dial.id);
		this.lastIcon.delete(dial.id); // force a clean player repaint after the layout swap
		this.lastStatus.delete(dial.id);
		void dial.setFeedbackLayout(PLAYER_LAYOUT);
		setTimeout(() => {
			if (!this.carousel.has(dial.id)) void this.paint(dial, this.store.snapshot);
		}, 60);
	}

	private armIdle(dial: DialAction): void {
		this.clearIdle(dial.id);
		this.idleTimer.set(dial.id, setTimeout(() => this.exitCarousel(dial), CAROUSEL_IDLE_MS));
	}

	private clearIdle(id: string): void {
		const t = this.idleTimer.get(id);
		if (t) {
			clearTimeout(t);
			this.idleTimer.delete(id);
		}
	}

	private async fireSelected(dial: DialAction): Promise<void> {
		const index = this.carousel.get(dial.id);
		if (index === undefined) return;
		const action = this.carouselActions[index];
		if (action.keepOpen) {
			// Multi-state action (repeat) - fire but keep the carousel open so the
			// user can cycle through its states; reset the idle timer and let the
			// store event repaint the new state. Still closes on idle / hold / another action.
			this.armIdle(dial);
			await this.run(dial, () => action.run());
			return;
		}
		this.exitCarousel(dial); // back to the player immediately; the command runs next
		await this.run(dial, () => action.run());
	}

	// --- interactions -----------------------------------------------------

	/**
	 * Dial press uses press-and-hold detection so a hold opens the carousel (a
	 * tactile alternative to holding the touchscreen): {@link onDialDown} starts a
	 * timer; if it fires while still held the carousel opens (or closes); otherwise
	 * the release ({@link onDialUp}) runs the short-press action.
	 */
	override onDialDown(ev: DialDownEvent): void {
		const id = ev.action.id;
		const dial = ev.action;
		this.pressConsumed.delete(id);
		this.clearPressTimer(id);
		this.pressTimer.set(
			id,
			setTimeout(() => {
				this.pressTimer.delete(id);
				this.pressConsumed.add(id); // the matching release must not also act
				if (!dial.isDial()) return;
				if (this.carousel.has(id)) this.exitCarousel(dial);
				else this.enterCarousel(dial);
			}, LONGPRESS_MS),
		);
	}

	override onDialUp(ev: DialUpEvent): void {
		const id = ev.action.id;
		this.clearPressTimer(id);
		if (this.pressConsumed.delete(id)) return; // a long-press already handled this gesture
		if (this.carousel.has(id)) {
			if (ev.action.isDial()) void this.fireSelected(ev.action);
			return;
		}
		// Short press toggles the touchscreen between progress and volume.
		const next: DialMode = this.mode.get(id) === "volume" ? "progress" : "volume";
		this.mode.set(id, next);
		if (ev.action.isDial()) void this.paint(ev.action, this.store.snapshot);
	}

	private clearPressTimer(id: string): void {
		const t = this.pressTimer.get(id);
		if (t) {
			clearTimeout(t);
			this.pressTimer.delete(id);
		}
	}

	override async onDialRotate(ev: DialRotateEvent): Promise<void> {
		// A rotation cancels a pending long-press and consumes the gesture, so
		// rotating while the dial is held means "rotate", not "click on release".
		this.clearPressTimer(ev.action.id);
		this.pressConsumed.add(ev.action.id);
		// In the carousel, rotation browses the actions.
		if (this.carousel.has(ev.action.id)) {
			const n = this.carouselActions.length;
			const cur = this.carousel.get(ev.action.id) ?? 0;
			this.carousel.set(ev.action.id, (((cur + ev.payload.ticks) % n) + n) % n);
			this.armIdle(ev.action);
			if (ev.action.isDial()) this.paintCarousel(ev.action);
			return;
		}
		const s = { ...DEFAULTS.dial, ...(ev.payload.settings as DialSettings) };
		const state = this.store.snapshot;
		const mode = this.mode.get(ev.action.id) ?? "progress";
		await this.run(ev.action, () => {
			if (mode === "volume") {
				const next = state.volume + ev.payload.ticks * ((s.volumeStep ?? 2) / 100);
				return this.client.setVolume(Math.max(0, Math.min(1, next)));
			}
			const sec = state.time.currentMs / 1000 + ev.payload.ticks * (s.seekStep ?? 5);
			const max = state.time.durationMs / 1000 || sec;
			return this.client.seek(Math.max(0, Math.min(max, sec)));
		});
	}

	/**
	 * Touch gestures (SD+ exposes only tap + long-press + tap position - no swipe):
	 * - **Hold** opens the action carousel (or, while it's open, cancels it).
	 * - **Quick tap** in the carousel fires the selection.
	 * - **Quick tap** otherwise: left third = previous, right third = next, centre
	 *   = the configurable touch action (play/pause by default) - so a normal tap
	 *   never accidentally opens the carousel.
	 */
	override async onTouchTap(ev: TouchTapEvent): Promise<void> {
		const id = ev.action.id;
		if (this.carousel.has(id)) {
			if (ev.payload.hold) this.exitCarousel(ev.action);
			else if (ev.action.isDial()) await this.fireSelected(ev.action);
			return;
		}
		if (ev.payload.hold) {
			if (ev.action.isDial()) this.enterCarousel(ev.action);
			return;
		}
		const s = { ...DEFAULTS.dial, ...(ev.payload.settings as DialSettings) };
		const state = this.store.snapshot;
		const x = ev.payload.tapPos?.[0] ?? 100;
		await this.run(ev.action, () => {
			if (x < 66) return this.client.previous();
			if (x > 134) return this.client.next();
			switch (s.touchAction) {
				case "addtolibrary":
					return state.inLibrary ? this.client.removeFromLibrary() : this.client.addToLibrary();
				case "dislike":
					return this.client.dislike();
				default:
					return this.client.toggle();
			}
		});
	}
}
