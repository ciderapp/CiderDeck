import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { DEFAULTS, type VolumeStepSettings } from "../models/settings";
import { CiderKeyAction } from "./base/cider-action";

/** Raise volume by the configured step. States: 0 = active, 1 = offline. */
@action({ UUID: UUID.VOLUME_UP })
export class VolumeUpAction extends CiderKeyAction {
	protected slices(): [] {
		return [];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		void action.setState(state.online ? 0 : 1);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const step = ((ev.payload.settings as VolumeStepSettings).step ?? DEFAULTS.volume.step!) / 100;
		const next = Math.min(1, this.store.snapshot.volume + step);
		await this.run(ev.action, () => this.client.setVolume(next));
	}
}
