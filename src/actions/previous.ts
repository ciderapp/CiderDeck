import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import type { PreviousSettings } from "../models/settings";
import { CiderKeyAction } from "./base/cider-action";

/**
 * Previous track. By default the server seeks to 0 when >3s into the track,
 * otherwise goes to the previous track. `alwaysGoToPrevious` forces previous.
 * States: 0 = active, 1 = offline.
 */
@action({ UUID: UUID.PREVIOUS })
export class PreviousAction extends CiderKeyAction {
	protected slices(): [] {
		return [];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		void action.setState(state.online ? 0 : 1);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const settings = ev.payload.settings as PreviousSettings;
		await this.run(ev.action, () => this.client.previous(!!settings.alwaysGoToPrevious));
	}
}
