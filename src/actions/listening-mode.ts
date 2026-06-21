import streamDeck, { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { renderListeningModeSvg } from "../rendering/svg-listening-mode";
import { CiderKeyAction } from "./base/cider-action";

const MODES = ["off", "game", "antifatigue"] as const;
type Mode = (typeof MODES)[number];

const LABELS: Record<Mode, string> = {
	off: "Off",
	game: "Gaming",
	antifatigue: "Unwind",
};

/**
 * Listening Mode (Occlusion DSP) tile. Press cycles Off -> Gaming -> Unwind.
 * Rendered as a Cider-native "Wordmark" SVG: the current mode word + a
 * "LISTENING MODE" caption + a thin status bar. Reflects
 * `audioStatus.listeningModeChanged`. Requires the Citadel
 * `/api/v2/audio/listening-mode` endpoint.
 */
@action({ UUID: UUID.LISTENING_MODE })
export class ListeningModeAction extends CiderKeyAction {
	private readonly lastSvg = new Map<string, string>();

	protected slices(): ["audio"] {
		return ["audio"];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		const mode = normalize(state.audio.listeningMode);
		const svg = renderListeningModeSvg({
			label: LABELS[mode],
			active: mode !== "off",
			online: state.online,
		});
		if (this.lastSvg.get(action.id) === svg) return; // skip redundant frames
		this.lastSvg.set(action.id, svg);
		streamDeck.logger.debug(`[listening-mode] setImage mode=${mode} online=${state.online} len=${svg.length}`);
		void action.setImage(svg);
	}

	protected override onLastDisappear(): void {
		this.lastSvg.clear();
	}

	protected override invalidateCaches(): void {
		this.lastSvg.clear();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const current = normalize(this.store.snapshot.audio.listeningMode);
		const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];
		try {
			const result = await this.client.setListeningMode(next);
			// Update immediately from the authoritative PATCH result (the change event
			// also arrives shortly after and reconciles to the same value).
			this.store.primeAudio({ listeningMode: result?.mode ?? next });
		} catch (err) {
			this.services.handleError(err);
			void ev.action.showAlert();
		}
	}
}

function normalize(mode: string | undefined): Mode {
	return MODES.includes(mode as Mode) ? (mode as Mode) : "off";
}
