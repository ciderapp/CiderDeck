import { action, type KeyAction } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { resolveArtwork } from "../util/format";
import { CiderKeyAction } from "./base/cider-action";

/**
 * Displays the current track's album artwork. Fetches the artwork URL once per
 * track (cached) and pushes it via `setImage`.
 *
 * States: 0 = artwork/placeholder, 1 = offline.
 */
@action({ UUID: UUID.ALBUMART })
export class AlbumArtAction extends CiderKeyAction {
	protected slices(): ["track"] {
		return ["track"];
	}

	protected async paint(action: KeyAction, state: Readonly<PlayerState>): Promise<void> {
		if (!state.online) {
			void action.setState(1);
			return;
		}
		const url = resolveArtwork(state.nowPlaying?.artworkUrl, 288);
		if (!url) {
			void action.setState(0);
			void action.setImage(undefined);
			return;
		}
		const dataUri = await this.services.artwork.getDataUri(url);
		void action.setState(0);
		void action.setImage(dataUri ?? undefined);
	}
}
