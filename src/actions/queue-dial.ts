import {
	action,
	type DialAction,
	type DialDownEvent,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { QueueItem } from "../models/cider-api";
import type { PlayerState } from "../models/player-state";
import { DEFAULTS, type QueueDialSettings } from "../models/settings";
import { type CoverflowModel, renderCoverflow, renderCoverflowMessage } from "../rendering/svg-coverflow";
import { NEUTRAL_BG, albumBackground } from "../util/color";
import { resolveArtwork } from "../util/format";
import { CiderDialAction } from "./base/cider-dial-action";

/** How many items to pull per page; the cursor sits roughly in the middle. */
const PAGE = 12;
/** Coalesce "cover loaded -> repaint" bursts into one repaint. */
const REPAINT_DEBOUNCE_MS = 120;

/**
 * Stream Deck + encoder presenting the up-next queue as a coverflow on the
 * touchscreen. Rotate scrolls a cursor through the queue (centre cover = the
 * highlighted track); press jumps playback to it (`POST /queue/jump`). The
 * now-playing track is framed in Cider-red with a play badge so it stays
 * distinguishable from the browse cursor.
 *
 * Rendering never blocks on the network: covers are read from the artwork
 * cache synchronously ({@link ArtworkService.peek}); misses draw a placeholder
 * and are fetched in the background, repainting once they arrive. Each loaded
 * page is prefetched so scrolling stays smooth.
 */
@action({ UUID: UUID.QUEUE_DIAL })
export class QueueDialAction extends CiderDialAction {
	private readonly cursor = new Map<string, number>();
	private readonly playingIndex = new Map<string, number>();
	private readonly total = new Map<string, number>();
	private readonly window = new Map<string, { offset: number; items: QueueItem[] }>();
	private readonly queueSig = new Map<string, string>();
	private readonly seq = new Map<string, number>();
	private readonly lastFeedback = new Map<string, string>();
	private readonly settingsCache = new Map<string, QueueDialSettings>();
	private repaintTimer?: ReturnType<typeof setTimeout>;

	protected slices(): ["queue", "track", "playState"] {
		return ["queue", "track", "playState"];
	}

	protected async paint(dial: DialAction, state: Readonly<PlayerState>): Promise<void> {
		const id = dial.id;
		// Race guard: only the most recent render for this dial wins the setFeedback.
		const mySeq = (this.seq.get(id) ?? 0) + 1;
		this.seq.set(id, mySeq);

		let feedback: string;
		try {
			feedback = await this.computeFeedback(dial, state);
		} catch (err) {
			// Never leave the dial wedged on a swallowed rejection: always emit a frame.
			this.services.handleError(err);
			feedback = renderCoverflowMessage("Queue unavailable");
		}

		if (this.seq.get(id) !== mySeq) return; // a newer render superseded this one
		if (this.lastFeedback.get(id) === feedback) return;
		this.lastFeedback.set(id, feedback);
		void dial.setFeedback({ cf: feedback });
	}

	private async computeFeedback(dial: DialAction, state: Readonly<PlayerState>): Promise<string> {
		const id = dial.id;
		const bg = this.resolveBackground(await this.dialSettings(dial), state);
		if (!state.online) {
			this.queueSig.delete(id); // force a fresh re-sync on reconnect
			return renderCoverflowMessage("Queue - Offline");
		}

		await this.reconcile(id, state);

		const total = this.total.get(id) ?? 0;
		if (total === 0) return renderCoverflowMessage("Queue is empty", bg);

		const cur = clamp(this.cursor.get(id) ?? 0, 0, total - 1);
		this.cursor.set(id, cur);
		await this.ensureWindow(id, cur);

		const { model, missing } = this.buildModel(id, cur, total, bg, !state.playing);
		if (missing.length) this.warm(missing);
		return renderCoverflow(model);
	}

	private resolveBackground(settings: QueueDialSettings, state: Readonly<PlayerState>): string {
		switch (settings.background) {
			case "custom":
				return settings.backgroundColor ?? "#1c1c24";
			case "none":
				return NEUTRAL_BG; // "Neutral dark" choice in the PI
			default:
				return albumBackground(state); // "album" (default)
		}
	}

	private async dialSettings(dial: DialAction): Promise<QueueDialSettings> {
		let s = this.settingsCache.get(dial.id);
		if (!s) {
			try {
				s = { ...DEFAULTS.queueDial, ...((await dial.getSettings()) as QueueDialSettings) };
			} catch {
				s = { ...DEFAULTS.queueDial }; // a settings read must never abort the render
			}
			this.settingsCache.set(dial.id, s);
		}
		return s;
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		this.settingsCache.set(ev.action.id, { ...DEFAULTS.queueDial, ...(ev.payload.settings as QueueDialSettings) });
		if (ev.action.isDial()) void this.paint(ev.action, this.store.snapshot);
	}

	/**
	 * Re-sync the now-playing position + queue length whenever the track OR the
	 * queue changes. Citadel does not emit `queueChanged` on a natural track
	 * advance (only `nowPlayingItemDidChange`), so `state.queue.position` can be
	 * stale - we re-read the authoritative live position via `getQueuePosition`.
	 * The cursor follows the playing track only when the user wasn't browsing
	 * elsewhere; the loaded page is invalidated so the shifted queue is refetched.
	 */
	private async reconcile(id: string, state: Readonly<PlayerState>): Promise<void> {
		const sig = `${state.nowPlaying?.id ?? ""}|${state.queue.position}/${state.queue.total}`;
		const first = !this.queueSig.has(id);
		if (this.queueSig.get(id) === sig) return; // nothing relevant changed
		this.queueSig.set(id, sig);

		let position = state.queue.position;
		let total = state.queue.total;
		try {
			const live = await this.client.getQueuePosition();
			position = live.position;
			total = live.total;
		} catch {
			/* fall back to the (possibly stale) store values */
		}

		this.total.set(id, total);
		if (total <= 0) {
			this.playingIndex.delete(id);
			this.window.delete(id);
			return;
		}

		const playing = clamp(position, 0, total - 1);
		const cursor = this.cursor.get(id);
		const wasFollowing = first || cursor === undefined || cursor === this.playingIndex.get(id);
		this.playingIndex.set(id, playing);
		this.cursor.set(id, wasFollowing ? playing : clamp(cursor ?? playing, 0, total - 1));
		this.window.delete(id); // the up-next page shifted - refetch it
		this.lastFeedback.delete(id); // don't let dedup mask this forced refresh
	}

	/** Ensure the loaded page covers cursor-2 ... cursor+2; prefetch its covers. */
	private async ensureWindow(id: string, cur: number): Promise<void> {
		const total = this.total.get(id) ?? 0;
		const lo = Math.max(0, cur - 2);
		const hi = Math.min(total - 1, cur + 2);
		const w = this.window.get(id);
		if (w && w.offset <= lo && hi <= w.offset + w.items.length - 1) return;
		const offset = Math.max(0, cur - 4);
		try {
			const res = await this.client.getQueue(offset, PAGE);
			this.window.set(id, { offset, items: res.items });
			if (res.meta) this.total.set(id, res.meta.total);
			// Warm the whole page so scrolling finds covers already cached.
			for (const it of res.items) {
				const url = artUrl(it);
				if (url) void this.services.artwork.getDataUri(url);
			}
		} catch {
			/* leave the previous window in place on a transient failure */
		}
	}

	private buildModel(
		id: string,
		cur: number,
		total: number,
		bg: string,
		paused: boolean,
	): { model: CoverflowModel; missing: string[] } {
		const w = this.window.get(id);
		const at = (i: number): QueueItem | undefined => {
			if (!w) return undefined;
			const local = i - w.offset;
			return local >= 0 && local < w.items.length ? w.items[local] : undefined;
		};
		const missing: string[] = [];
		const artFor = (item: QueueItem | undefined): string | undefined => {
			const url = artUrl(item);
			if (!url) return undefined;
			const cached = this.services.artwork.peek(url);
			if (!cached) missing.push(url);
			return cached;
		};
		const playing = this.playingIndex.get(id);
		const isPlaying = (i: number): boolean => playing !== undefined && i === playing;

		const center = at(cur);
		// Now-playing track is outside the visible 5 slots -> edge arrow.
		const offscreen =
			playing !== undefined && playing >= 0 && playing < total && Math.abs(playing - cur) > 2
				? { side: (playing < cur ? "left" : "right") as "left" | "right", distance: Math.abs(playing - cur) }
				: undefined;

		const model: CoverflowModel = {
			farLeft: cur - 2 >= 0 ? { art: artFor(at(cur - 2)), playing: isPlaying(cur - 2) } : undefined,
			left: cur - 1 >= 0 ? { art: artFor(at(cur - 1)), playing: isPlaying(cur - 1) } : undefined,
			center: { art: artFor(center), playing: isPlaying(cur) },
			right: cur + 1 < total ? { art: artFor(at(cur + 1)), playing: isPlaying(cur + 1) } : undefined,
			farRight: cur + 2 < total ? { art: artFor(at(cur + 2)), playing: isPlaying(cur + 2) } : undefined,
			title: trackText(center, "name") || "Unknown",
			artist: trackText(center, "artistName"),
			position: cur + 1,
			total,
			bg,
			offscreen,
			paused,
		};
		return { model, missing };
	}

	/** Fetch missing covers in the background, then repaint once they land. */
	private warm(urls: string[]): void {
		for (const url of urls) {
			void this.services.artwork.getDataUri(url).then((d) => {
				if (d) this.scheduleRepaint();
			});
		}
	}

	protected override invalidateCaches(): void {
		// On (re)connect, drop the cached page + signature so reconcile re-reads the
		// live queue position and refetches - otherwise a restart resuming the same
		// song leaves the signature unchanged and the coverflow shows the dead state.
		this.lastFeedback.clear();
		this.queueSig.clear();
		this.window.clear();
	}

	private scheduleRepaint(): void {
		if (this.repaintTimer) return;
		this.repaintTimer = setTimeout(() => {
			this.repaintTimer = undefined;
			const state = this.store.snapshot;
			for (const a of this.actions) if (a.isDial()) void this.paint(a, state);
		}, REPAINT_DEBOUNCE_MS);
	}

	// --- interactions -----------------------------------------------------

	override async onDialRotate(ev: DialRotateEvent): Promise<void> {
		const id = ev.action.id;
		const total = this.total.get(id) ?? 0;
		if (total === 0) return;
		const cur = this.cursor.get(id) ?? 0;
		const next = clamp(cur + ev.payload.ticks, 0, total - 1);
		if (next === cur) return;
		this.cursor.set(id, next);
		if (ev.action.isDial()) await this.paint(ev.action, this.store.snapshot);
	}

	override async onDialDown(ev: DialDownEvent): Promise<void> {
		const id = ev.action.id;
		const cur = this.cursor.get(id);
		if (cur === undefined) return;
		await this.run(ev.action, async () => {
			await this.client.queueJump(cur);
			// Optimistically mark it now-playing so the red frame lands immediately;
			// the queueChanged event reconciles shortly after.
			this.playingIndex.set(id, cur);
			if (ev.action.isDial()) await this.paint(ev.action, this.store.snapshot);
		});
	}

	protected override onLastDisappear(): void {
		if (this.repaintTimer) {
			clearTimeout(this.repaintTimer);
			this.repaintTimer = undefined;
		}
		for (const map of [
			this.cursor,
			this.playingIndex,
			this.total,
			this.window,
			this.queueSig,
			this.seq,
			this.lastFeedback,
			this.settingsCache,
		]) {
			map.clear();
		}
	}
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, n));
}

function trackText(item: QueueItem | undefined, key: "name" | "artistName"): string {
	const attrs = item?.track?.attributes as Record<string, unknown> | undefined;
	const v = attrs?.[key];
	return typeof v === "string" ? v : "";
}

function artUrl(item: QueueItem | undefined): string | undefined {
	const attrs = item?.track?.attributes as Record<string, unknown> | undefined;
	const artwork = attrs?.artwork as { url?: string } | undefined;
	return resolveArtwork(artwork?.url, 120);
}
