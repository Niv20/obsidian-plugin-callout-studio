/** Introductory formats and fallback controls rendered by production code. */
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { CalloutAutoComplete } from "../../src/editor/AutoComplete.ts";
import { CALLOUT_PAGES } from "../../src/settings/declarative/calloutPages.ts";
import { GENERAL_ROWS } from "../../src/settings/declarative/generalRows.ts";
import { mountNote, mountSettings, seedExample } from "./fixture-host.mjs";
import { rowById } from "./settingsPage.mjs";

function autocomplete(plugin) {
	const text = "# Research notes\n\n> [!note";
	const panel = document.body.createDiv({ cls: "guide-autocomplete", attr: { id: "guide-scene" } });
	const view = new EditorView({
		state: EditorState.create({ doc: text, selection: { anchor: text.length } }),
		parent: panel,
	});
	const editor = {
		getLine: line => view.state.doc.line(line + 1).text,
		lineCount: () => view.state.doc.lines,
	};
	const suggest = new CalloutAutoComplete(plugin);
	const trigger = suggest.onTrigger({ line: 2, ch: editor.getLine(2).length }, editor, null);
	if (!trigger) throw new Error("The production autocomplete did not recognize the Note token");
	const context = { ...trigger, editor, file: null };
	suggest.context = context;
	const list = panel.createDiv({ cls: "suggestion-container" }).createDiv({ cls: "suggestion" });
	const choices = suggest.getSuggestions(context);
	if (!choices.some(choice => choice.id === "note")) throw new Error("The production suggestion list needs Note");
	choices.forEach((choice, index) => suggest.renderSuggestion(choice, list.createDiv({
		cls: `suggestion-item${index === 0 ? " is-selected" : ""}`,
	})));
	return {
		selector: "#guide-scene", title: "Pick Note from autocomplete",
		description: "A real CodeMirror editor contains the typed block-callout token. CalloutAutoComplete recognizes it, filters the committed registry, and renders the actual Note suggestion with its icon and ID. The documentation host positions Obsidian's suggestion shell below the line.",
	};
}

function discovery(plugin) {
	const note = plugin.registry.getReal("note");
	for (const [id, displayName] of [["research", "Research"], ["meeting", "Meeting"]]) {
		plugin.registry.add({ ...note, id, displayName, aliases: [], builtIn: false, source: "fallback" });
	}
	plugin.cssInjector.inject(false);
	return mountSettings(plugin, {
		path: [CALLOUT_PAGES.mine],
		title: "Callout types saved through discovery",
		description: "The My callout types page lists two synthetic scan-result definitions registered with source fallback. Production row rendering gives both the Default fallback label and Note's inherited appearance, above the actual Scan for callouts row. No vault scan or file write is performed.",
	});
}

async function fallbackPicker(plugin) {
	seedExample(plugin, { id: "project note", displayName: "Project note" });
	plugin.settings.fallbackCalloutId = "project note";
	let fallbackRow = null;
	const metadata = mountSettings(plugin, {
		height: 650,
		title: "Choose a default fallback callout",
		description: "The settings' Default fallback callout row shows Project note as the synthetic saved fallback and its real Reset to default arrow. Its actual CalloutCombobox is opened to registered types, with production names, IDs, icons, and colors in dark mode. Nothing is selected or saved by the scene.",
		after(harness) {
			fallbackRow = rowById(harness, GENERAL_ROWS.fallback);
			fallbackRow.querySelector(".cs-combobox .cs-dropdown-field").click();
		},
	});
	await document.fonts.ready;
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	const frame = document.querySelector(metadata.selector);
	const bounds = frame.getBoundingClientRect();
	const popup = frame.querySelector(".cs-combobox-menu").getBoundingClientRect();
	// Crop just under the open list, leaving the same space below it as the
	// page leaves above the fallback row's box.
	const box = fallbackRow.closest(".setting-group").getBoundingClientRect();
	frame.style.height = `${popup.bottom - bounds.top + box.top - bounds.top}px`;
	return metadata;
}

export const scenes = {
	"formats-block": plugin => mountNote(plugin, [
		"> [!note] My custom title", "> First paragraph.", ">", "> Second paragraph.", "",
		"> [!tip] A useful next step", "> Keep a standalone idea in a block callout.",
	].join("\n"), {
		title: "Block callouts with titles and paragraphs",
		description: "Obsidian's reading-view Markdown shell supplies the documented block-callout structure; the plugin's production postprocessor, generated CSS, and icon painter render Note and Tip in the default dark theme. Titles and content come from the example Markdown.",
	}),
	"formats-heading-inline": plugin => mountNote(plugin, [
		"## [!tip] My heading title", "", "A heading callout introduces a section while keeping its heading level.", "",
		"Remember to check the settings [!warning] before you continue.", "",
		"Want an [!note]{inline callout}? Add it inside a sentence.",
	].join("\n"), {
		title: "Heading and inline callouts in a note",
		description: "The plugin's actual reading-view processors transform the Markdown heading token and both inline tokens. The colored Tip heading remains an h2 element, Warning uses its registered name, and Note displays the custom inline text, all styled through the production CSS in dark mode.",
	}),
	"formats-autocomplete": autocomplete,
	"fallback-discovery": discovery,
	"fallback-picker": fallbackPicker,
};
