import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { renderSmartQueueGlyph } from "../rendering/svg-glyphs";
import { CiderKeyAction } from "./base/cider-action";

/**
 * Smart Queue Optimizer toggle (`POST /queue/smart-optimizer/toggle`). Requires
 * Automix to be enabled; renders an unavailable look ("Automix off") otherwise.
 * Reflects `queueStatus.smartQueueChanged` and Automix availability.
 */
@action({ UUID: UUID.SMART_QUEUE })
export class SmartQueueAction extends CiderKeyAction {
	private readonly lastSvg = new Map<string, string>();

	protected slices(): ["smartqueue", "audio"] {
		return ["smartqueue", "audio"];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		const available = state.audio.automix === true;
		const svg = renderSmartQueueGlyph({
			enabled: state.smartQueue.enabled,
			available,
			online: state.online,
		});
		if (this.lastSvg.get(action.id) === svg) return;
		this.lastSvg.set(action.id, svg);
		void action.setImage(svg);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const state = this.store.snapshot;
		if (!state.online || state.audio.automix !== true) {
			void ev.action.showAlert(); // can't toggle without Automix
			return;
		}
		const next = !state.smartQueue.enabled;
		try {
			await this.client.toggleSmartOptimizer();
			// The change event reconciles; update optimistically for snappy feedback.
			this.store.primeSmartQueue({ enabled: next });
		} catch (err) {
			this.services.handleError(err);
			void ev.action.showAlert();
		}
	}

	protected override onLastDisappear(): void {
		this.lastSvg.clear();
	}

	protected override invalidateCaches(): void {
		this.lastSvg.clear();
	}
}
