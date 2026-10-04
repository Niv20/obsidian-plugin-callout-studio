/** Palette, icon, and geometry illustrations mounted by their production UI. */
import { PaletteEditorModal } from "../../src/settings/PaletteEditorModal.ts";
import { GlobalStyleModal } from "../../src/settings/GlobalStyleModal.ts";
import { IconPicker } from "../../src/settings/iconpicker/IconPickerModal.ts";
import { IconLibrariesModal } from "../../src/settings/iconpicker/IconLibrariesModal.ts";
import { ICON_SOURCE_IDS, getSource } from "../../src/icons/registry.ts";
import { derivePaletteFromColor } from "../../src/utils/colorUtils.ts";
import { openModal } from "./fixture-host.mjs";

async function waitFor(predicate, label) {
	for (let frame = 0; frame < 180; frame++) {
		if (predicate()) return;
		await new Promise(resolve => requestAnimationFrame(resolve));
	}
	throw new Error(`Documentation scene did not finish rendering: ${label}`);
}

function paletteSeed(baseColor, intensity = 0.18) {
	return {
		...derivePaletteFromColor(baseColor, intensity),
		baseColor, bgIntensity: intensity,
	};
}

function solidPalette(plugin) {
	const modal = new PaletteEditorModal(plugin, {
		seedName: "Ocean",
		seed: paletteSeed("#3db8d3"),
	});
	return openModal(modal, {
		title: "Create a saved color palette",
		description: "Callout Studio's production PaletteEditorModal derives Ocean's accent, background, and text from its base color. Its three previews are rendered by the real reading-view processors and generated CSS in the default dark theme.",
	});
}

function gradientPalette(plugin) {
	const base = paletteSeed("#ff7d63", 0.22);
	const second = paletteSeed("#bd72fa", 0.22);
	const modal = new PaletteEditorModal(plugin, {
		seedName: "Sunset",
		seed: {
			...base,
			bgGradient: {
				angleDeg: 90,
				toColorLight: second.bgColorLight,
				toColorDark: second.bgColorDark,
				textToColorLight: second.colorLight,
				textToColorDark: second.colorDark,
			},
		},
	});
	return openModal(modal, {
		title: "Create a gradient palette",
		description: "The actual palette editor opens on Sunset's two-stop gradient with the production direction controls and background intensity slider. Dark-mode previews show the palette applied to block, heading, and inline callouts.",
	});
}

async function iconPicker(plugin, icon, query, metadata) {
	const modal = new IconPicker(plugin, icon, { id: "project-note", name: "Project note" });
	const result = openModal(modal, metadata);
	await waitFor(() => modal.modalEl.querySelector(".icon-picker-grid.is-loaded .icon-picker-cell"), "icon grid");
	const input = modal.modalEl.querySelector(".icon-picker-search-input");
	if (!input) throw new Error("The production icon picker did not provide its search field");
	input.value = query;
	input.dispatchEvent(new Event("input", { bubbles: true }));
	await waitFor(() => modal.modalEl.querySelector(".icon-picker-cell.is-selected"), "selected icon search result");
	// Searching replaces the grid after the initial selection was scrolled into
	// view. Show the results from their start, as when the user scrolls back up.
	modal.modalEl.querySelector(".icon-picker-content").scrollTop = 0;
	return result;
}

async function iconLibraries(plugin) {
	const counts = new Map(await Promise.all(ICON_SOURCE_IDS.filter(id => id !== "image").map(async id => {
		const index = await getSource(id).loadIndex();
		return [id, index.entries.length];
	})));
	const modal = new IconLibrariesModal({
		app: plugin.app,
		settings: plugin.settings,
		saveSettings: () => plugin.saveSettings(),
		settingsWriter: plugin.settingsWriter,
		registry: plugin.registry,
		icons: plugin.icons,
		countFor: id => id === "image" ? plugin.registry.getUserImages().length : counts.get(id),
	});
	return openModal(modal, {
		title: "Manage icon libraries",
		description: "Callout Studio's actual IconLibrariesModal lists the available bundled sources and the downloadable libraries. Catalog counts come from the plugin's bundled indexes; this scene does not download any library or modify a vault.",
	});
}

function globalStyle(plugin, role, title, description) {
	return openModal(new GlobalStyleModal(plugin, role), { title, description });
}

export const scenes = {
	"palette-editor": solidPalette,
	"palette-gradient": gradientPalette,
	"icon-picker": plugin => iconPicker(plugin, { type: "lucide", value: "book-open" }, "book", {
		title: "Choose a Lucide icon",
		description: "The production IconPicker searches Obsidian's locally installed Lucide catalog for book and keeps Book open selected. Source selection, search, grid, attribution, and Confirm are all rendered by the plugin in dark mode.",
	}),
	"icon-emoji": plugin => iconPicker(plugin, { type: "emoji", value: "✋🏽" }, "hand", {
		title: "Choose an emoji and skin tone",
		description: "The production IconPicker searches the bundled Emoji catalog for hand. The current raised-hand emoji and medium skin-tone filter are real picker state, rendered with the system emoji font in dark mode.",
	}),
	"icon-libraries": iconLibraries,
	"global-heading": plugin => globalStyle(plugin, "heading", "Set heading callout geometry", "The actual GlobalStyleModal for Heading shows the production borders, shape, and spacing controls beside its real heading preview. The window's body scrolls within a bounded dark-mode modal."),
	"global-inline": plugin => globalStyle(plugin, "inline", "Set inline callout geometry", "The actual GlobalStyleModal for Inline shows the production border, text scale, and corner controls beside an inline pill rendered by the plugin's reading-view pipeline in dark mode."),
	"global-block": plugin => globalStyle(plugin, "regular", "Set block callout geometry", "The actual GlobalStyleModal for Block shows the production border, title and content scale, shape, and alignment controls beside its real block preview. The bounded dark-mode window retains its scrolling body."),
};
