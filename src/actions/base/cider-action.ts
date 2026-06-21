/**
 * Base classes shared by all CiderDeck actions: subscribe to the
 * {@link PlayerStore} once while any instance is visible, and repaint every
 * visible instance on the relevant slice change.
 */

import { type KeyAction, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { PlayerState, StoreEvent } from "../../models/player-state";
import type { Services } from "../../services";

/** Common subscription/lifecycle plumbing for key and dial actions. */
abstract class CiderActionBase extends SingletonAction {
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

	/** Slices, besides `connection`, that should trigger a repaint. */
	protected abstract slices(): StoreEvent[];

	/** Repaint every currently-visible instance of this action. */
	protected abstract repaintAll(state: Readonly<PlayerState>): void;

	/** Paint the single instance that just appeared. */
	protected abstract paintInstance(ev: WillAppearEvent, state: Readonly<PlayerState>): void;

	override onWillAppear(ev: WillAppearEvent): void {
		if (this.appeared++ === 0) {
			this.subscribe();
			this.onFirstAppear();
		}
		this.paintInstance(ev, this.store.snapshot);
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
			const handler =
				e === "connection"
					? (s: Readonly<PlayerState>) => {
							this.invalidateCaches(); // a (re)connect must force a fresh paint past any dedup
							this.repaintAll(s);
						}
					: (s: Readonly<PlayerState>) => this.repaintAll(s);
			this.unsubscribers.push(this.store.on(e, handler));
		}
	}

	/** Clear per-instance dedup caches so a reconnect repaints even if the
	 *  recomputed frame is byte-identical to the stale one on the device. */
	protected invalidateCaches(): void {}

	private unsubscribe(): void {
		for (const off of this.unsubscribers) off();
		this.unsubscribers = [];
	}
}

/** Base for keypad actions. */
export abstract class CiderKeyAction extends CiderActionBase {
	/** Paint one key instance from the current state (handle online + offline). */
	protected abstract paint(action: KeyAction, state: Readonly<PlayerState>): void | Promise<void>;

	protected override repaintAll(state: Readonly<PlayerState>): void {
		for (const a of this.actions) {
			if (a.isKey()) void this.paint(a, state);
		}
	}

	protected override paintInstance(ev: WillAppearEvent, state: Readonly<PlayerState>): void {
		if (ev.action.isKey()) void this.paint(ev.action, state);
	}

	/** Run a Cider command, flashing an alert on the pressed key if it fails. */
	protected async run(action: KeyAction, fn: () => Promise<void>): Promise<void> {
		try {
			await fn();
		} catch (err) {
			this.services.handleError(err);
			void action.showAlert();
		}
	}
}
