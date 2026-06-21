import streamDeck from "@elgato/streamdeck";

import { AddToLibraryAction } from "./actions/add-to-library";
import { AlbumArtAction } from "./actions/album-art";
import { AlbumArtGridAction } from "./actions/album-art-grid";
import { AtmosAction, AutomixAction, CrossfadeAction } from "./actions/audio-toggle";
import { CiderLogoAction } from "./actions/cider-logo";
import { DislikeAction } from "./actions/dislike";
import { LikeAction } from "./actions/like";
import { ListeningModeAction } from "./actions/listening-mode";
import { PlaybackDialAction } from "./actions/playback-dial";
import { PinnedItemAction } from "./actions/pinned-item";
import { PreviousAction } from "./actions/previous";
import { QueueClearAction } from "./actions/queue-clear";
import { QueueDialAction } from "./actions/queue-dial";
import { RepeatAction } from "./actions/repeat";
import { ShuffleAction } from "./actions/shuffle";
import { SkipAction } from "./actions/skip";
import { SmartQueueAction } from "./actions/smart-queue";
import { SongDisplayAction } from "./actions/song-display";
import { TogglePlaybackAction } from "./actions/toggle";
import { VolumeDownAction } from "./actions/volume-down";
import { VolumeUpAction } from "./actions/volume-up";
import { createServices } from "./services";
import { resolveArtwork } from "./util/format";

streamDeck.logger.setLevel("info");

// Shared singletons (API client, socket, store, auth).
const services = createServices();

// Push live connection status to an open property inspector.
services.store.on("connection", (s) => {
	void streamDeck.ui.sendToPropertyInspector({
		event: "authStatus",
		connected: s.online,
		hasToken: services.auth.hasToken,
	});
});

// Property-inspector messages (e.g. the "Request Authorization" button).
streamDeck.ui.onSendToPlugin(async (ev) => {
	const payload = ev.payload as { event?: string } | undefined;
	if (payload?.event === "requestAuth") {
		try {
			const res = await services.auth.requestToken();
			await streamDeck.ui.sendToPropertyInspector({ event: "authStatus", connected: true, scopes: res.scopes });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await streamDeck.ui.sendToPropertyInspector({ event: "authStatus", connected: false, error: message });
		}
	} else if (payload?.event === "getStatus") {
		await streamDeck.ui.sendToPropertyInspector({
			event: "authStatus",
			connected: services.store.snapshot.online,
			hasToken: services.auth.hasToken,
		});
	} else if (payload?.event === "browseLibrary") {
		// Paginated feed for the external Library Browser window (relayed by the PI).
		const p = payload as { source?: string; offset?: number; limit?: number };
		const source = p.source === "albums" ? "albums" : "playlists";
		const offset = Math.max(0, Number(p.offset) || 0);
		const limit = Math.min(Math.max(1, Number(p.limit) || 100), 100); // Apple caps library at 100
		let items: { value: string; name: string; sub: string; artworkUrl: string }[] = [];
		let total = 0;
		try {
			const res = source === "albums"
				? await services.client.getAlbums(offset, limit)
				: await services.client.getPlaylists(offset, limit);
			total = res.meta?.total ?? res.items.length;
			items = res.items.map((c) => ({
				value: `${source}:${c.id}`,
				name: c.name,
				sub: c.artistName ?? "",
				artworkUrl: resolveArtwork(c.artwork?.url, 160) ?? "",
			}));
		} catch (err) {
			streamDeck.logger.warn(`browseLibrary(${source}) failed: ${String(err)}`);
		}
		await streamDeck.ui.sendToPropertyInspector({ event: "browseLibrary", source, offset, total, items });
	} else if (payload?.event === "listTiles") {
		// Enumerate every placed CiderDeck tile for the quick-editor (the tabbed
		// settings window). The plugin can see all visible action instances; a PI
		// only sees its own, so the window asks the plugin via this relay.
		const tiles: Array<{
			context: string;
			uuid: string;
			controller: string;
			coordinates: { column: number; row: number } | null;
			settings: Record<string, string | number | boolean>;
		}> = [];
		for (const a of streamDeck.actions) {
			try {
				tiles.push({
					context: a.id,
					uuid: a.manifestId,
					controller: a.controllerType,
					coordinates: a.coordinates ? { column: a.coordinates.column, row: a.coordinates.row } : null,
					settings: (await a.getSettings()) as Record<string, string | number | boolean>,
				});
			} catch (err) {
				streamDeck.logger.warn(`listTiles: failed to read ${a.id}: ${String(err)}`);
			}
		}
		await streamDeck.ui.sendToPropertyInspector({ event: "tiles", tiles, activeContext: ev.action.id });
	} else if (payload?.event === "setTileSettings") {
		// Patch a specific tile's settings by context (merge so we never drop other
		// keys). Plugin-initiated writes are echoed to that tile's own PI too.
		const p = payload as { context?: string; patch?: Record<string, string | number | boolean> };
		const target = p.context ? streamDeck.actions.getActionById(p.context) : undefined;
		if (target && p.patch && typeof p.patch === "object") {
			const current = (await target.getSettings()) as Record<string, string | number | boolean>;
			await target.setSettings({ ...current, ...p.patch });
		}
	} else if (payload?.event === "pinCollection") {
		// Persist a Browse pick through the action (plugin-initiated settings
		// changes ARE echoed to the PI, so sdpi's store stays in sync and a later
		// shuffle/checkbox write can't clobber the pin).
		const p = payload as { value?: string; name?: string; artworkUrl?: string };
		const current = (await ev.action.getSettings()) as Record<string, unknown>;
		await ev.action.setSettings({
			...current,
			pin: p.value ?? "",
			pinName: p.name ?? "",
			pinArtworkUrl: p.artworkUrl ?? "",
			collectionType: "",
			collectionId: "",
		});
	}
});

for (const Action of [
	CiderLogoAction,
	TogglePlaybackAction,
	SkipAction,
	PreviousAction,
	RepeatAction,
	ShuffleAction,
	VolumeUpAction,
	VolumeDownAction,
	LikeAction,
	DislikeAction,
	AddToLibraryAction,
	AlbumArtAction,
	SongDisplayAction,
	PlaybackDialAction,
	AtmosAction,
	CrossfadeAction,
	AutomixAction,
	ListeningModeAction,
	QueueClearAction,
	SmartQueueAction,
	QueueDialAction,
	PinnedItemAction,
	AlbumArtGridAction,
]) {
	streamDeck.actions.registerAction(new Action(services));
}

// Connect to Stream Deck first (settings require the connection), then load
// auth/server settings, then open the Cider socket.
streamDeck
	.connect()
	.then(() => services.auth.init())
	.then(() => services.socket.connect())
	.catch((err) => streamDeck.logger.error("CiderDeck startup failed", err));
