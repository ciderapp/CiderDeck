/**
 * Owns the apptoken + server connection settings (persisted in global settings),
 * the first-run `POST /api/v2/auth/request` flow, legacy `rpcKey` migration, and
 * reacting to settings changes from the property inspector.
 */

import streamDeck from "@elgato/streamdeck";
import { DEFAULT_SERVER, REQUESTED_SCOPES, type GlobalSettings } from "../models/settings";
import { CiderAuthError, type CiderClient } from "./cider-client";
import type { CiderSocket } from "./cider-socket";
import type { PlayerStore } from "./player-store";

export class AuthManager {
	private token: string | null = null;
	private host: string = DEFAULT_SERVER.host;
	private port: number = DEFAULT_SERVER.port;

	constructor(
		private readonly client: CiderClient,
		private readonly socket: CiderSocket,
		private readonly store: PlayerStore,
	) {}

	get hasToken(): boolean {
		return !!this.token;
	}

	/** Load persisted settings and subscribe to future changes. Call after streamDeck.connect(). */
	async init(): Promise<void> {
		const gs = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		await this.apply(gs, /* initial */ true);
		streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
			void this.apply(ev.settings, false);
		});
	}

	/** Apply settings to the client/socket; reconnect when connection-relevant values change. */
	private async apply(gs: GlobalSettings, initial: boolean): Promise<void> {
		let token = gs.token ?? null;

		// One-time migration from CiderDeck 3.x global settings shape.
		if (!token && gs.authorization?.rpcKey) {
			token = gs.authorization.rpcKey;
			streamDeck.logger.info("Migrated legacy rpcKey into token");
			await this.persist({ token });
		}

		const host = gs.host || DEFAULT_SERVER.host;
		const port = Number(gs.port) || DEFAULT_SERVER.port;

		const connectionChanged = host !== this.host || port !== this.port;
		const tokenChanged = token !== this.token;

		this.token = token;
		this.host = host;
		this.port = port;
		this.client.setConnection(host, port);
		this.client.setToken(token);

		streamDeck.logger.info(
			`Auth applied - host=${host} port=${port} token=${token ? `present(${token.length} chars)` : "MISSING"} (initial=${initial})`,
		);

		if (initial) return; // socket.connect() is driven by the caller on first init
		if (connectionChanged || (tokenChanged && token)) {
			this.socket.reconnect();
		}
	}

	/** First-run token request. Throws on denial/rate-limit; caller surfaces to PI. */
	async requestToken(appImage?: string): Promise<{ token: string; scopes: string[] }> {
		const result = await this.client.requestAuth({
			app_name: "CiderDeck",
			app_image: appImage,
			scopes: [...REQUESTED_SCOPES],
		});
		this.token = result.token;
		this.client.setToken(result.token);
		await this.persist({ token: result.token, scopes: result.scopes, grantedAt: new Date().toISOString() });
		this.socket.reconnect();
		return result;
	}

	/** Invoked when a request fails auth (401/403). */
	handleUnauthorized(err: CiderAuthError): void {
		streamDeck.logger.warn(
			`Cider rejected token - status=${err.status} code=${err.code ?? "?"} detail=${err.detail ?? "?"} (token present: ${this.hasToken})`,
		);
		this.store.setOffline();
		// Only delivered when a CiderDeck property inspector is currently visible.
		void streamDeck.ui.sendToPropertyInspector({ event: "authStatus", connected: false, error: err.friendly });
	}

	private async persist(patch: GlobalSettings): Promise<void> {
		const current = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		await streamDeck.settings.setGlobalSettings({ ...current, ...patch });
	}
}
