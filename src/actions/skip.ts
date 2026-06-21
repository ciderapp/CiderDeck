import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { CiderKeyAction } from "./base/cider-action";

/** Skip to the next track. States: 0 = active, 1 = offline. */
@action({ UUID: UUID.SKIP })
export class SkipAction extends CiderKeyAction {
	protected slices(): [] {
		return [];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		void action.setState(state.online ? 0 : 1);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await this.run(ev.action, () => this.client.next());
	}
}
