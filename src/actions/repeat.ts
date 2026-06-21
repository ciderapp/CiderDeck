import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { CiderKeyAction } from "./base/cider-action";

/**
 * Cycle repeat mode (none -> one -> all). Reflects `repeatModeDidChange`.
 * States: 0 = off, 1 = repeat-one, 2 = repeat-all, 3 = offline.
 */
@action({ UUID: UUID.REPEAT })
export class RepeatAction extends CiderKeyAction {
	protected slices(): ["repeat"] {
		return ["repeat"];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		if (!state.online) {
			void action.setState(3);
			return;
		}
		void action.setState(state.repeatMode === "one" ? 1 : state.repeatMode === "all" ? 2 : 0);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await this.run(ev.action, () => this.client.toggleRepeat());
	}
}
