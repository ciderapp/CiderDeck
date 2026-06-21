import { action, type KeyAction } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { CiderKeyAction } from "./base/cider-action";

/**
 * Decorative Cider logo tile. Reflects connection state only (online / offline).
 * States: 0 = logo, 1 = offline.
 */
@action({ UUID: UUID.CIDER_LOGO })
export class CiderLogoAction extends CiderKeyAction {
	protected slices(): [] {
		return [];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		void action.setState(state.online ? 0 : 1);
	}
}
