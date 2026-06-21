/**
 * Base for Stream Deck + encoder (dial) actions. Renders via `setFeedback`
 * rather than key images. Shares the store-subscription lifecycle with the key
 * base by re-implementing the small repaint hooks against {@link DialAction}.
 */

import { type DialAction, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { PlayerState, StoreEvent } from "../../models/player-state";
import type { Services } from "../../services";

export abstract class CiderDialAction extends SingletonAction {
	protected readonly services: Services;
	private appeared = 0;
	private unsubscribers: Array<() => void> = [];

	constructor(services: Services) {
		super();
		this.services = services;
	}

	protected get store() {
		return this.services.store;
	}

	protected get client() {
		return this.services.client;
	}

	protected abstract slices(): StoreEvent[];

	/** Paint one dial instance (feedback) from the current state. */
	protected abstract paint(action: DialAction, state: Readonly<PlayerState>): void | Promise<void>;

	override onWillAppear(ev: WillAppearEvent): void {
		if (this.appeared++ === 0) {
			this.subscribe();
			this.onFirstAppear();
		}
		if (ev.action.isDial()) void this.paint(ev.action, this.store.snapshot);
	}

	override onWillDisappear(_ev: WillDisappearEvent): void {
		if (--this.appeared <= 0) {
			this.appeared = 0;
			this.unsubscribe();
			this.onLastDisappear();
		}
	}

	protected onFirstAppear(): void {}

	protected onLastDisappear(): void {}

	private subscribe(): void {
		const events = new Set<StoreEvent>(["connection", ...this.slices()]);
		for (const e of events) {
			this.unsubscribers.push(
				this.store.on(e, (s) => {
					if (e === "connection") this.invalidateCaches(); // force a fresh paint on (re)connect
					for (const a of this.actions) if (a.isDial()) void this.paint(a, s);
				}),
			);
		}
	}

	/** Clear per-instance dedup caches so a reconnect repaints past any dedup. */
	protected invalidateCaches(): void {}

	private unsubscribe(): void {
		for (const off of this.unsubscribers) off();
		this.unsubscribers = [];
	}

	protected async run(action: DialAction, fn: () => Promise<void>): Promise<void> {
		try {
			await fn();
		} catch (err) {
			this.services.handleError(err);
			void action.showAlert();
		}
	}
}
