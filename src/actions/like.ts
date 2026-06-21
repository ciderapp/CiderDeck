import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import type { LikeSettings } from "../models/settings";
import { CiderKeyAction } from "./base/cider-action";

/**
 * Favorite (love) the current track; toggles off when already favorited.
 * Optionally also adds to library. Reflects `nowPlayingStatusDidChange`.
 * States: 0 = not favorited, 1 = favorited, 2 = offline.
 */
@action({ UUID: UUID.LIKE })
export class LikeAction extends CiderKeyAction {
	protected slices(): ["favorite"] {
		return ["favorite"];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		if (!state.online) {
			void action.setState(2);
			return;
		}
		void action.setState(state.inFavorites ? 1 : 0);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const settings = ev.payload.settings as LikeSettings;
		const snap = this.store.snapshot;
		await this.run(ev.action, async () => {
			if (snap.inFavorites) {
				await this.client.setRating(0);
			} else {
				await this.client.love();
				if (settings.alsoAddToLibrary && !snap.inLibrary) await this.client.addToLibrary();
			}
		});
	}
}
