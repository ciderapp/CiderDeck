import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { CiderKeyAction } from "./base/cider-action";

/**
 * Toggle shuffle. Reflects `shuffleModeDidChange`.
 * States: 0 = off, 1 = on, 2 = offline.
 */
@action({ UUID: UUID.SHUFFLE })
export class ShuffleAction extends CiderKeyAction {
	protected slices(): ["shuffle"] {
		return ["shuffle"];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		if (!state.online) {
			void action.setState(2);
			return;
		}
		void action.setState(state.shuffle ? 1 : 0);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await this.run(ev.action, () => this.client.toggleShuffle());
	}
}
