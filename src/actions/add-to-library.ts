import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { CiderKeyAction } from "./base/cider-action";

/**
 * Add/remove the current track to/from the library. Reflects `inLibrary` via
 * `nowPlayingStatusDidChange`.
 * States: 0 = not in library, 1 = in library, 2 = offline.
 */
@action({ UUID: UUID.ADD_TO_LIBRARY })
export class AddToLibraryAction extends CiderKeyAction {
	protected slices(): ["library"] {
		return ["library"];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		if (!state.online) {
			void action.setState(2);
			return;
		}
		void action.setState(state.inLibrary ? 1 : 0);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const inLibrary = this.store.snapshot.inLibrary;
		await this.run(ev.action, () => (inLibrary ? this.client.removeFromLibrary() : this.client.addToLibrary()));
	}
}
