/**
 * Service container + factory. Constructs the shared singletons and wires the
 * socket -> store priming and error -> auth handling.
 */

import streamDeck from "@elgato/streamdeck";
import { AnimationTicker } from "../rendering/animation-ticker";
import { ArtworkService } from "./artwork-service";
import { AuthManager } from "./auth-manager";
import { CiderAuthError, CiderClient } from "./cider-client";
import { CiderSocket } from "./cider-socket";
import { PlayerStore } from "./player-store";

export interface Services {
	store: PlayerStore;
	client: CiderClient;
	socket: CiderSocket;
	auth: AuthManager;
	artwork: ArtworkService;
	ticker: AnimationTicker;
	/** Centralized command-error handling (auth -> re-auth prompt, else log). */
	handleError: (err: unknown) => void;
}

export function createServices(): Services {
	const store = new PlayerStore();
	const client = new CiderClient();
	const artwork = new ArtworkService();
	const ticker = new AnimationTicker();

	// `auth` is referenced inside the socket handlers but constructed after the
	// socket; assigned before any handler can fire (handlers run post-connect).
	let auth!: AuthManager;

	// The now-playing events don't reliably carry favorite/library status sometimes due to fetch delays, so poll a few times after a track change to get the latest status.
	let statusFetchSeq = 0;
	const refreshLibraryStatus = (): void => {
		const mySeq = ++statusFetchSeq;
		const fetchOnce = async (): Promise<void> => {
			if (mySeq !== statusFetchSeq) return; // superseded by a newer track change
			try {
				const status = await client.getLibraryStatus();
				if (mySeq !== statusFetchSeq) return;
				streamDeck.logger.debug(
					`[lib-status] rating=${status.rating} inLibrary=${status.inLibrary} track=${store.snapshot.nowPlaying?.title ?? "-"}`,
				);
				store.primeLibraryStatus(status);
			} catch {
				/* leave whatever the events delivered */
			}
		};
		// Cider resolves the now-playing library/favorite status asynchronously
		// (~1s after a track change), so poll a few times.
		void fetchOnce();
		setTimeout(() => void fetchOnce(), 1200);
		setTimeout(() => void fetchOnce(), 2600);
	};
	store.on("track", () => refreshLibraryStatus());

	// The queue is often (re)built asynchronously, so poll a few times after a track change to get the latest position.
	let queueFetchSeq = 0;
	const refreshQueue = (): void => {
		const mySeq = ++queueFetchSeq;
		const fetchOnce = async (): Promise<void> => {
			if (mySeq !== queueFetchSeq) return; // superseded by a newer track change
			try {
				const q = await client.getQueuePosition();
				if (mySeq !== queueFetchSeq) return;
				store.primeQueue(q.position, q.total);
			} catch {
				/* leave whatever the events delivered */
			}
		};
		void fetchOnce();
		setTimeout(() => void fetchOnce(), 1200);
		setTimeout(() => void fetchOnce(), 2600);
	};
	store.on("track", () => refreshQueue());

	const socket = new CiderSocket({
		url: () => client.baseUrl,
		onEvent: (type, data) => store.ingest(type, data),
		onConnect: async () => {
			streamDeck.logger.info(`Cider socket connected at ${client.baseUrl} (token present: ${client.hasToken}).`);
			try {
				const snap = await client.getPlaybackSnapshot();
				store.primeFromSnapshot(snap);
				store.setOnline();
				const np = snap.nowPlaying as { attributes?: { name?: string }; name?: string } | undefined;
				streamDeck.logger.info(
					`Cider online - primed. state=${snap.state ?? "?"} nowPlaying=${np?.attributes?.name ?? np?.name ?? "none"}`,
				);
				// Audio-setting states aren't in the snapshot; fetch them separately.
				void primeAudioStates(client, store);
			} catch (err) {
				if (err instanceof CiderAuthError) auth.handleUnauthorized(err);
				else {
					streamDeck.logger.warn(`Initial snapshot failed (non-auth): ${String(err)}`);
					store.setOnline(); // socket is up even if the snapshot call failed
				}
			}
		},
		onDisconnect: () => {
			streamDeck.logger.info("Cider socket disconnected.");
			store.setOffline();
		},
		log: (msg, err) => streamDeck.logger.debug(`[socket] ${msg}`, err),
	});

	auth = new AuthManager(client, socket, store);

	const handleError = (err: unknown): void => {
		if (err instanceof CiderAuthError) auth.handleUnauthorized(err);
		else streamDeck.logger.error("Cider command failed", err);
	};

	return { store, client, socket, auth, artwork, ticker, handleError };
}

/** Fetch the audio-setting toggle states (not part of the playback snapshot). */
async function primeAudioStates(client: CiderClient, store: PlayerStore): Promise<void> {
	const [atmos, crossfade, automix, listening, smart] = await Promise.allSettled([
		client.getAtmos(),
		client.getCrossfade(),
		client.getAutomix(),
		client.getListeningMode(),
		client.getSmartOptimizer(),
	]);
	store.primeAudio({
		atmos: atmos.status === "fulfilled" ? atmos.value.enabled : undefined,
		crossfade: crossfade.status === "fulfilled" ? crossfade.value.enabled : undefined,
		automix: automix.status === "fulfilled" ? automix.value.enabled : undefined,
		listeningMode: listening.status === "fulfilled" ? listening.value.mode : undefined,
	});
	if (smart.status === "fulfilled") {
		store.primeSmartQueue({ enabled: smart.value.enabled, busy: smart.value.busy });
	}
}
