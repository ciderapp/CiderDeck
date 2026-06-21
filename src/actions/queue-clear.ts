import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { UUID } from "../manifest-uuids";
import type { PlayerState } from "../models/player-state";
import { renderClearGlyph } from "../rendering/svg-glyphs";
import { CiderKeyAction } from "./base/cider-action";

const CONFIRM_MS = 5000;

/**
 * Clear the queue, with a confirm-on-second-press guard. First press arms the
 * key (trash turns red); a second press within {@link CONFIRM_MS} clears the
 * queue (`DELETE /queue`). If not confirmed in time it disarms itself.
 */
@action({ UUID: UUID.QUEUE_CLEAR })
export class QueueClearAction extends CiderKeyAction {
	private readonly armed = new Set<string>();
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly lastSvg = new Map<string, string>();

	protected slices(): [] {
		return [];
	}

	protected paint(action: KeyAction, state: Readonly<PlayerState>): void {
		const svg = renderClearGlyph({ armed: this.armed.has(action.id), online: state.online });
		if (this.lastSvg.get(action.id) === svg) return;
		this.lastSvg.set(action.id, svg);
		void action.setImage(svg);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const id = ev.action.id;
		if (!this.armed.has(id)) {
			this.arm(id, ev.action);
			return;
		}
		this.disarm(id);
		await this.run(ev.action, async () => {
			await this.client.queueClear();
			void ev.action.showOk();
		});
		this.paint(ev.action, this.store.snapshot);
	}

	private arm(id: string, action: KeyAction): void {
		this.armed.add(id);
		this.paint(action, this.store.snapshot);
		const existing = this.timers.get(id);
		if (existing) clearTimeout(existing);
		this.timers.set(
			id,
			setTimeout(() => {
				this.disarm(id);
				if (action.isKey()) this.paint(action, this.store.snapshot);
			}, CONFIRM_MS),
		);
	}

	private disarm(id: string): void {
		this.armed.delete(id);
		const t = this.timers.get(id);
		if (t) {
			clearTimeout(t);
			this.timers.delete(id);
		}
	}

	protected override onLastDisappear(): void {
		for (const t of this.timers.values()) clearTimeout(t);
		this.timers.clear();
		this.armed.clear();
		this.lastSvg.clear();
	}

	protected override invalidateCaches(): void {
		this.lastSvg.clear();
	}
}
