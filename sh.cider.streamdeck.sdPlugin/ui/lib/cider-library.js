/**
 * Property-inspector glue for the external Library Browser window.
 */
(function () {
	const client = SDPIComponents.streamDeckClient;
	const channel = "BroadcastChannel" in self ? new BroadcastChannel("cider-library") : null;
	let browserWin = null;
	let seq = 0;
	const seen = new Set();

	function showPinned(name) {
		const el = document.getElementById("cd-pin-name");
		if (el) el.textContent = name && name.trim() ? name : "(none)";
	}

	// PI -> browser window (both transports; the window dedupes by _id).
	function toBrowser(m) {
		m._id = "p" + seq++;
		if (channel) channel.postMessage(m);
		try { if (browserWin && !browserWin.closed) browserWin.postMessage({ __ciderLib: m }, "*"); } catch (e) {}
	}

	// Browser window -> PI
	function fromBrowser(m) {
		if (!m || (m._id && seen.has(m._id))) return;
		if (m._id) seen.add(m._id);
		if (m.type === "fetch") {
			client.send("sendToPlugin", { event: "browseLibrary", source: m.source, offset: m.offset, limit: m.limit });
		} else if (m.type === "pick") {
			// Persist through the plugin so sdpi's settings store stays in sync
			// (a PI's own setSettings isn't echoed back, which let a later shuffle
			// toggle clobber the pin).
			client.send("sendToPlugin", { event: "pinCollection", value: m.value, name: m.label || "", artworkUrl: m.artworkUrl || "" });
			showPinned(m.label);
		}
	}

	if (channel) channel.onmessage = (ev) => fromBrowser(ev && ev.data);
	window.addEventListener("message", (ev) => {
		const d = ev && ev.data;
		if (d && d.__ciderLib) fromBrowser(d.__ciderLib);
	});

	// Plugin -> PI -> browser window
	client.sendToPropertyInspector.subscribe(function (ev) {
		const p = (ev && ev.payload) || {};
		if (p.event !== "browseLibrary") return;
		toBrowser({ type: "items", source: p.source, items: p.items || [], total: p.total });
	});

	window.ciderBrowseLibrary = function () {
		browserWin = window.open("library-browser.html", "ciderLibrary", "width=920,height=660");
	};

	document.addEventListener("DOMContentLoaded", function () {
		client.getSettings().then(function (s) {
			showPinned(s && s.pinName);
		});
	});
})();
