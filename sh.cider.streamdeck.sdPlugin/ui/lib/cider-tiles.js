/**
 * Tile settings schemas for the quick-editor.
 *
 * Field types: text | password | checkbox | select | range | color | static.
 */
const CIDER_TILE_SCHEMAS = {
	"sh.cider.streamdeck.songname": {
		name: "Song Display",
		fields: [
			{ key: "customFormat", label: "Format", type: "text", placeholder: "{title} - overrides options below" },
			{ key: "textPrefix", label: "Prefix", type: "text", placeholder: "(optional)" },
			{ key: "showArtist", label: "Artist", type: "checkbox", checkboxLabel: "Show artist", default: true },
			{ key: "showAlbum", label: "Album", type: "checkbox", checkboxLabel: "Show album", default: false },
			{ key: "maxLines", label: "Max lines", type: "select", valueType: "number", default: 3,
				options: [["1", "1"], ["2", "2"], ["3", "3"]] },
			{ key: "alignment", label: "Align", type: "select", default: "center",
				options: [["left", "Left"], ["center", "Center"], ["right", "Right"]] },
			{ key: "fontSize", label: "Font size", type: "range", min: 12, max: 24, step: 1, default: 18 },
			{ key: "textColor", label: "Text color", type: "color", default: "#ffffff" },
			{ key: "backgroundColor", label: "Background", type: "color", default: "#0b0b0f" },
		],
	},
	"sh.cider.streamdeck.playback": {
		name: "Playback Dial",
		fields: [
			{ key: "touchAction", label: "Tap", type: "select", default: "playpause",
				options: [["playpause", "Play / pause"], ["addtolibrary", "Add to library"], ["dislike", "Dislike"]] },
			{ key: "volumeStep", label: "Volume step", type: "range", min: 1, max: 10, step: 1, default: 2 },
			{ key: "seekStep", label: "Seek step (s)", type: "range", min: 1, max: 30, step: 1, default: 5 },
		],
	},
	"sh.cider.streamdeck.queuedial": {
		name: "Queue Coverflow",
		fields: [
			{ key: "background", label: "Background", type: "select", default: "album",
				options: [["album", "Match album art"], ["custom", "Custom color"], ["none", "Neutral dark"]] },
			{ key: "backgroundColor", label: "Custom color", type: "color", default: "#1c1c24" },
		],
	},
	"sh.cider.streamdeck.pinneditem": {
		name: "Pinned Item",
		fields: [
			{ key: "pinName", label: "Pinned", type: "static", empty: "(none - use Browse in the tile's inspector)" },
			{ key: "shuffle", label: "Shuffle", type: "checkbox", checkboxLabel: "Shuffle on play" },
			{ key: "collectionType", label: "Manual type", type: "select", default: "",
				options: [["", "- use Browse -"], ["playlists", "Playlist"], ["albums", "Album"], ["stations", "Station"]] },
			{ key: "collectionId", label: "Manual id", type: "text", placeholder: "pl.… / l.… / ra.…" },
		],
	},
	"sh.cider.streamdeck.previous": {
		name: "Previous",
		fields: [
			{ key: "alwaysGoToPrevious", label: "Previous", type: "checkbox", checkboxLabel: "Always go to previous track" },
		],
	},
	"sh.cider.streamdeck.like": {
		name: "Favorite",
		fields: [
			{ key: "alsoAddToLibrary", label: "Favorite", type: "checkbox", checkboxLabel: "Also add to library" },
		],
	},
};
