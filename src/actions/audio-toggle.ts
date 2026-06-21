import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { AudioState, PlayerState } from "../models/player-state";
import { CiderKeyAction } from "./base/cider-action";

type AudioKey = "atmos" | "crossfade" | "automix";

/**
 * Base for the on/off audio-setting toggles. Reflects `audioStatus.*Changed`.
 * States: 0 = off (also shown when offline), 1 = on.
 */
abstract class AudioToggleAction extends CiderKeyAction {
	protected abstract readonly key: AudioKey;
	protected abstract setEnabled(enabled: boolean): Promise<void>;

	protected slices(): ["audio"] {
		return ["audio"];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		const on = state.online && (state.audio as AudioState)[this.key] === true;
		void action.setState(on ? 1 : 0);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const enabled = (this.store.snapshot.audio as AudioState)[this.key] === true;
		try {
			await this.setEnabled(!enabled);
			// The change event isn't reliably broadcast, so update from the PATCH success.
			this.store.primeAudio({ [this.key]: !enabled });
		} catch (err) {
			this.services.handleError(err);
			void ev.action.showAlert();
		}
	}
}

/** Dolby Atmos / spatial audio. */
@action({ UUID: UUID.ATMOS })
export class AtmosAction extends AudioToggleAction {
	protected readonly key = "atmos" as const;
	protected setEnabled(enabled: boolean): Promise<void> {
		return this.client.setAtmos({ enabled });
	}
}

/** Crossfade between tracks. */
@action({ UUID: UUID.CROSSFADE })
export class CrossfadeAction extends AudioToggleAction {
	protected readonly key = "crossfade" as const;
	protected setEnabled(enabled: boolean): Promise<void> {
		return this.client.setCrossfade({ enabled });
	}
}

/** Automix (AI transitions). */
@action({ UUID: UUID.AUTOMIX })
export class AutomixAction extends AudioToggleAction {
	protected readonly key = "automix" as const;
	protected setEnabled(enabled: boolean): Promise<void> {
		return this.client.setAutomix({ enabled });
	}
}
