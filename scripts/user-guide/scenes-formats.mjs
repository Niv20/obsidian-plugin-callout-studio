/** Introductory formats and fallback controls rendered by production code. */
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { CalloutAutoComplete } from "../../src/editor/AutoComplete.ts";
import { createCalloutListsController } from "../../src/settings/sections/CalloutListsSection.ts";
import { renderCalloutRow } from "../../src/settings/sections/CalloutRowRenderer.ts";
import { freshPaging } from "../../src/settings/sections/calloutListsSignature.ts";
import { renderFallbackSection } from "../../src/settings/sections/FallbackSection.ts";
import { mountNote, mountSettings, seedExample } from "./fixture-host.mjs";

function listController(plugin, panel, ctx) {
	createCalloutListsController(ctx, {
		paging: freshPaging(), onAddNewCallout: async () => {},
		renderRow: (container, def, kind) => renderCalloutRow(ctx, container, def, kind, {
			onEdit() {}, onOpenBuiltInMenu() {}, onOpenUserMenu() {},
		}),
	}).render(panel);
}

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
		title: "Callout types saved through discovery",
		description: "The actual callout-list controller displays two synthetic scan-result definitions registered with source fallback. Production row rendering gives both the Default fallback label and Note's inherited appearance, beside the actual Scan for callouts button. No vault scan or file write is performed.",
		render(panel, ctx) { listController(plugin, panel, ctx); },
	});
}

async function fallbackPicker(plugin) {
	seedExample(plugin, { id: "project note", displayName: "Project note" });
	plugin.settings.fallbackCalloutId = "project note";
	const metadata = mountSettings(plugin, {
		title: "Choose a default fallback callout",
		description: "The production FallbackSection shows Project note as the synthetic saved fallback and its real Reset to default arrow. Its actual CalloutCombobox is opened to registered types, with production names, IDs, icons, and colors in dark mode. Nothing is selected or saved by the scene.",
		render(panel, ctx) {
			panel.style.height = "650px";
			renderFallbackSection(ctx, panel);
			panel.querySelector(".cs-combobox-control").click();
		},
	});
	await document.fonts.ready;
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	const panel = document.querySelector(metadata.selector);
	const bounds = panel.getBoundingClientRect();
	const heading = panel.querySelector(".setting-item-heading").getBoundingClientRect();
	const popup = panel.querySelector(".cs-combobox-menu").getBoundingClientRect();
	// Match the space above the section's rule below the open popup.
	panel.style.height = `${popup.bottom - bounds.top + heading.top - bounds.top}px`;
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
