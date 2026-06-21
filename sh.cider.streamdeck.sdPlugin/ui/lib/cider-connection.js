/**
 * Shared property-inspector helper for the Cider connection.
 */
(function () {
	const client = SDPIComponents.streamDeckClient;
	const channel = "BroadcastChannel" in self ? new BroadcastChannel("cider-connection") : null;
	let connWin = null;
	let seq = 0;
	const seen = new Set();
	let lastStatus = { connected: false, hasToken: false };

	function setStatusLine(p) {
		const el = document.getElementById("cd-status");
		const dot = document.getElementById("cd-dot");
		let text = "Not authorized";
		let state = "";
		if (p.connected) { text = "Connected"; state = "on"; }
		else if (p.error) { text = "Connection error"; state = "off"; }
		else if (p.hasToken) { text = "Cider offline"; state = "off"; }
		if (el) { el.textContent = text; el.className = "cd-status" + (state ? " " + state : ""); }
		if (dot) dot.className = "cd-dot" + (state ? " " + state : "");
	}

	// PI -> window (both transports; the window dedupes by _id).
	function toWindow(m) {
		m._id = "p" + seq++;
		if (channel) channel.postMessage(m);
		try { if (connWin && !connWin.closed) connWin.postMessage({ __ciderConn: m }, "*"); } catch (e) {}
	}
	function sendSettingsToWindow() {
		client.getGlobalSettings().then(function (gs) {
			gs = gs || {};
			toWindow({ type: "settings", host: gs.host || "", port: gs.port != null ? gs.port : "", token: gs.token || "" });
		});
	}

	// window -> PI
	function fromWindow(m) {
		if (!m || (m._id && seen.has(m._id))) return;
		if (m._id) seen.add(m._id);
		if (m.type === "ready") {
			sendSettingsToWindow();
			toWindow(Object.assign({ type: "status" }, lastStatus));
			client.send("sendToPlugin", { event: "getStatus" });
		} else if (m.type === "setSetting") {
			// Read fresh + merge so a Request-Auth token write isn't clobbered.
			client.getGlobalSettings().then(function (gs) {
				const next = Object.assign({}, gs || {});
				next[m.key] = m.value;
				client.setGlobalSettings(next);
			});
		} else if (m.type === "requestAuth") {
			client.send("sendToPlugin", { event: "requestAuth" });
		} else if (m.type === "listTiles") {
			// Quick-editor: ask the plugin to enumerate every placed tile.
			client.send("sendToPlugin", { event: "listTiles" });
		} else if (m.type === "setTileSettings") {
			// Quick-editor: patch a specific tile's settings by context.
			client.send("sendToPlugin", { event: "setTileSettings", context: m.context, patch: m.patch });
		}
	}
	if (channel) channel.onmessage = (ev) => fromWindow(ev && ev.data);
	window.addEventListener("message", (ev) => {
		const d = ev && ev.data;
		if (d && d.__ciderConn) fromWindow(d.__ciderConn);
	});

	// plugin -> PI: connection status (status line + window) and the tile list.
	client.sendToPropertyInspector.subscribe(function (ev) {
		const p = (ev && ev.payload) || {};
		if (p.event === "authStatus") {
			lastStatus = { connected: !!p.connected, hasToken: !!p.hasToken, error: p.error };
			setStatusLine(p);
			toWindow({ type: "status", connected: !!p.connected, hasToken: !!p.hasToken, error: p.error });
		} else if (p.event === "tiles") {
			toWindow({ type: "tiles", tiles: p.tiles || [], activeContext: p.activeContext || "" });
		}
	});

	window.ciderOpenConnection = function () {
		connWin = window.open("connection-window.html", "ciderSettings", "width=400,height=520");
	};

	document.addEventListener("DOMContentLoaded", function () {
		client.send("sendToPlugin", { event: "getStatus" });
	});
})();
