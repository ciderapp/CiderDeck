/**
 * Manages the single Socket.IO connection to Cider's `API:Playback` channel,
 * with infinite reconnect. Forwards normalized events to the caller and reports
 * connection lifecycle so the store can flip online/offline.
 */

import { io, type Socket } from "socket.io-client";
import type { PlaybackChannelMessage } from "../models/cider-api";

export interface CiderSocketHandlers {
	/** Provides the current base URL (may change when the user edits server settings). */
	url: () => string;
	onEvent: (type: string, data: unknown) => void;
	onConnect: () => void;
	onDisconnect: () => void;
	log?: (msg: string, err?: unknown) => void;
}

export class CiderSocket {
	private socket?: Socket;

	constructor(private readonly handlers: CiderSocketHandlers) {}

	connect(): void {
		this.dispose();
		const url = this.handlers.url();
		this.handlers.log?.(`connecting to ${url}`);
		const socket = io(url, {
			transports: ["websocket", "polling"],
			reconnectionAttempts: Infinity,
			reconnectionDelay: 1000,
			timeout: 10000,
		});
		this.socket = socket;

		socket.on("connect", () => this.handlers.onConnect());
		socket.on("disconnect", () => this.handlers.onDisconnect());
		socket.on("connect_error", (err) => this.handlers.log?.("socket connect_error", err));
		socket.on("API:Playback", (msg: PlaybackChannelMessage) => {
			if (msg && typeof msg.type === "string") this.handlers.onEvent(msg.type, msg.data);
		});
	}

	/** Reconnect (e.g. after the server host/port changed). */
	reconnect(): void {
		this.connect();
	}

	get connected(): boolean {
		return !!this.socket?.connected;
	}

	dispose(): void {
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = undefined;
		}
	}
}
