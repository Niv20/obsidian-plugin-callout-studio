/**
 * The garden's data note, written by the plugin's own Digital Garden export
 * (`exportWebTarget`) on the documentation host, with the store's Idea callout.
 * Bundled by note.mjs against the guide's offline Obsidian and run in Chromium,
 * where `crypto.subtle` (the note's fingerprint) and Obsidian's Lucide table
 * (the icons baked into the note) are at hand.
 */
import { installDomHelpers } from "obsidian";
import { setLocale } from "../../../src/i18n/index.ts";
import { exportWebTarget } from "../../../src/manager/web/writeTarget.ts";
import { getAllColorPalettes } from "../../../src/utils/colorPalettes.ts";
import { makeHost, seedExample } from "../../../scripts/user-guide/fixture-host.mjs";

export async function writeGardenNote() {
	installDomHelpers();
	setLocale("en");
	const plugin = makeHost();
	// The store's own Idea: seedPersonalCallouts in scripts/store-screenshots/scenes.mjs.
	const palette = getAllColorPalettes().find((item) => item.id === "purple");
	seedExample(plugin, {
		id: "idea",
		aliases: ["spark"],
		displayName: "Idea",
		icon: { type: "lucide", value: "lightbulb" },
		paletteId: "purple",
		colorLight: palette.colorLight,
		colorDark: palette.colorDark,
		bgColorLight: palette.bgColorLight,
		bgColorDark: palette.bgColorDark,
	});

	// An empty vault the export may write into; the host's own refuses writes.
	const written = new Map();
	Object.assign(plugin.app.vault.adapter, {
		exists: async (path) => written.has(path),
		read: async (path) => written.get(path) ?? "",
		write: async (path, text) => void written.set(path, text),
		mkdir: async () => {},
	});

	// The export says why it failed only in a console warning.
	const warnings = [];
	const warn = console.warn;
	console.warn = (...args) => {
		warnings.push(args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(" "));
		warn(...args);
	};
	try {
		const outcome = await exportWebTarget(plugin.app, plugin, "garden", { confirmOverwrite: async () => true });
		if (outcome.status !== "written") {
			throw new Error(`The Digital Garden export ended "${outcome.status}"\n${warnings.join("\n")}`);
		}
	} finally {
		console.warn = warn;
	}

	const notes = [...written].filter(([path]) => path.endsWith(".md"));
	if (notes.length !== 1) throw new Error(`Expected one garden note, got: ${notes.map(([path]) => path).join(", ") || "none"}`);
	const [path, text] = notes[0];
	return { path, text };
}
