import {
	action,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type WillAppearEvent,
} from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { CollectionType } from "../models/cider-api";
import type { PlayerState } from "../models/player-state";
import type { PinnedItemSettings } from "../models/settings";
import { renderPinnedArtwork, renderPinnedGlyph } from "../rendering/svg-glyphs";
import { assetDataUri } from "../util/asset";
import { resolveArtwork } from "../util/format";
import { CiderKeyAction } from "./base/cider-action";

const SHUFFLE_ICON = assetDataUri("actions/assets/app/shuffle.png");

/**
 * Plays a pinned playlist / album / station via `/playback/play-collection`.
 * The collection is chosen from the library dropdown (stored as "type:id") or
 * entered manually (stations, or pasting an id). The tile is a "play
 * collection" glyph; the user titles the key for its label.
 */
@action({ UUID: UUID.PINNED_ITEM })
export class PinnedItemAction extends CiderKeyAction {
	private readonly settings = new Map<string, PinnedItemSettings>();
	private readonly lastSvg = new Map<string, string>();

	protected slices(): [] {
		return [];
	}

	override onWillAppear(ev: WillAppearEvent): void {
		this.settings.set(ev.action.id, (ev.payload.settings ?? {}) as PinnedItemSettings);
		super.onWillAppear(ev);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		this.settings.set(ev.action.id, (ev.payload.settings ?? {}) as PinnedItemSettings);
		if (ev.action.isKey()) void this.paint(ev.action, this.store.snapshot);
	}

	protected async paint(action: KeyAction, state: Readonly<PlayerState>): Promise<void> {
		const s = this.settings.get(action.id);
		const configured = !!resolvePin(s);
		// Show the picked collection's artwork when available (Browse picks only -
		// manual entries get the glyph). Falls back to the glyph if art is missing.
		const artUrl =
			configured && state.online && !s?.collectionId && s?.pinArtworkUrl
				? resolveArtwork(s.pinArtworkUrl, 144)
				: undefined;
		let svg = renderPinnedGlyph({ configured, online: state.online });
		if (artUrl) {
			const art = await this.services.artwork.getDataUri(artUrl);
			if (art) svg = renderPinnedArtwork(art, !!s?.shuffle, SHUFFLE_ICON);
		}
		if (this.lastSvg.get(action.id) === svg) return;
		this.lastSvg.set(action.id, svg);
		void action.setImage(svg);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const settings = (await ev.action.getSettings()) as PinnedItemSettings;
		const pin = resolvePin(settings);
		if (!pin) {
			void ev.action.showAlert(); // not configured yet
			return;
		}
		await this.run(ev.action, async () => {
			await this.client.playCollection(pin.type as CollectionType, pin.id, !!settings.shuffle);
			void ev.action.showOk();
		});
	}

	protected override onLastDisappear(): void {
		this.settings.clear();
		this.lastSvg.clear();
	}

	protected override invalidateCaches(): void {
		this.lastSvg.clear();
	}
}

function resolvePin(s: PinnedItemSettings | undefined): { type: string; id: string } | null {
	if (!s) return null;
	// Manual entry takes priority (stations / pasting / beyond the first 100).
	if (s.collectionType && s.collectionId?.trim()) return { type: s.collectionType, id: s.collectionId.trim() };
	if (s.pin) {
		const i = s.pin.indexOf(":");
		if (i > 0 && i < s.pin.length - 1) return { type: s.pin.slice(0, i), id: s.pin.slice(i + 1) };
	}
	return null;
}
