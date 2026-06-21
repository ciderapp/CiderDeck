import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { CiderKeyAction } from "./base/cider-action";

/**
 * Dislike the current track (rating = -1; Cider also skips to the next track).
 * Reflects rating via `nowPlayingStatusDidChange`.
 * States: 0 = inactive, 1 = disliked, 2 = offline.
 */
@action({ UUID: UUID.DISLIKE })
export class DislikeAction extends CiderKeyAction {
	protected slices(): ["favorite"] {
		return ["favorite"];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		if (!state.online) {
			void action.setState(2);
			return;
		}
		void action.setState(state.rating === -1 ? 1 : 0);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const disliked = this.store.snapshot.rating === -1;
		await this.run(ev.action, () => (disliked ? this.client.setRating(0) : this.client.dislike()));
	}
}
