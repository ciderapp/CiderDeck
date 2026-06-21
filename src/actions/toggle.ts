import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { CiderKeyAction } from "./base/cider-action";

/**
 * Play/Pause toggle. Reflects live playback state from the store.
 *
 * States: 0 = play icon (paused/stopped), 1 = pause icon (playing), 2 = offline.
 */
@action({ UUID: UUID.TOGGLE })
export class TogglePlaybackAction extends CiderKeyAction {
	protected slices(): ["playState"] {
		return ["playState"];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		if (!state.online) {
			void action.setState(2);
			return;
		}
		void action.setState(state.playing ? 1 : 0);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await this.run(ev.action, () => this.client.toggle());
	}
}
