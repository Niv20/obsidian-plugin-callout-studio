/** A focused capture of the production autocomplete in the offline guide host. */
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection } from "@codemirror/view";
import { installDomHelpers } from "obsidian";
import { CalloutAutoComplete } from "../../src/editor/AutoComplete.ts";
import { setLocale } from "../../src/i18n/index.ts";
import { getAllColorPalettes } from "../../src/utils/colorPalettes.ts";
import { makeHost, seedExample } from "../user-guide/fixture-host.mjs";

function seedStoreExamples(plugin) {
	for (const [id, displayName, glyph, paletteId, alias] of [
		["idea", "Idea", "lightbulb", "violet", "spark"],
		["meeting", "Meeting", "messages-square", "plum", "sync"],
		["research", "Research", "telescope", "teal", "study"],
	]) {
		const palette = getAllColorPalettes().find(item => item.id === paletteId);
		if (!palette) throw new Error(`Missing production palette: ${paletteId}`);
		seedExample(plugin, {
			id, displayName, aliases: [alias], icon: { type: "lucide", value: glyph },
			paletteId, colorLight: palette.colorLight, colorDark: palette.colorDark,
			bgColorLight: palette.bgColorLight, bgColorDark: palette.bgColorDark,
		});
	}
}

export async function mountAutocomplete() {
	installDomHelpers();
	setLocale("en");
	document.body.className = "theme-dark is-desktop";
	const plugin = makeHost();
	seedStoreExamples(plugin);
	const panel = document.body.createDiv({ attr: { id: "bento-autocomplete" } });
	const input = "> [!i";
	const view = new EditorView({
		state: EditorState.create({
			doc: input, selection: { anchor: input.length },
			extensions: [drawSelection({ cursorBlinkRate: 0 })],
		}),
		parent: panel,
	});
	const editor = {
		getLine: line => view.state.doc.line(line + 1).text,
		lineCount: () => view.state.doc.lines,
		replaceRange(value, from, to = from) {
			const start = view.state.doc.line(from.line + 1).from + from.ch;
			const end = view.state.doc.line(to.line + 1).from + to.ch;
			view.dispatch({ changes: { from: start, to: end, insert: value } });
		},
		setCursor(position) {
			view.dispatch({ selection: { anchor: view.state.doc.line(position.line + 1).from + position.ch } });
		},
	};
	const suggest = new CalloutAutoComplete(plugin);
	const trigger = suggest.onTrigger({ line: 0, ch: input.length }, editor, null);
	if (!trigger || trigger.query !== "i") throw new Error("The production trigger did not recognize the partial token");
	const context = { ...trigger, editor, file: null };
	suggest.context = context;
	// Obsidian owns this positioned shell. Its native CSS paints the shell;
	// every row and its contents are rendered by production CalloutAutoComplete.
	const shell = panel.createDiv({ cls: "suggestion-container" });
	const list = shell.createDiv({ cls: "suggestion" });
	const choices = suggest.getSuggestions(context);
	const selected = choices.find(item => item.id === "idea");
	if (!selected) throw new Error("The actual suggestions must contain the saved Idea callout");
	for (const choice of choices) {
		const row = list.createDiv({ cls: `suggestion-item${choice === selected ? " is-selected" : ""}` });
		suggest.renderSuggestion(choice, row);
	}
	view.focus();
	await document.fonts.ready;
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	const rows = [...list.children];
	const visibleHeight = rows.slice(0, 7).reduce((sum, row) => sum + row.getBoundingClientRect().height, 0);
	const listStyle = getComputedStyle(list);
	list.style.maxHeight = `${visibleHeight + parseFloat(listStyle.paddingTop) + parseFloat(listStyle.paddingBottom)}px`;
	const listBounds = list.getBoundingClientRect();
	const visibleNames = rows.flatMap((row, index) => {
		const bounds = row.getBoundingClientRect();
		return bounds.top >= listBounds.top && bounds.bottom <= listBounds.bottom ? [choices[index].displayName] : [];
	});
	globalThis.__BENTO_AUTOCOMPLETE_VERIFY__ = async () => {
		suggest.selectSuggestion(selected, new KeyboardEvent("keydown", { key: "Enter" }));
		await new Promise(resolve => setTimeout(resolve, 100));
		return { text: view.state.doc.toString(), cursor: view.state.selection.main.anchor };
	};
	return {
		selector: "#bento-autocomplete", title: "Autocomplete while you type",
		description: "Production CalloutAutoComplete renders the real matching names, IDs and icons for > [!i over a CodeMirror editor, using installed Obsidian styles. Seven complete matching rows appear in their production order. Idea is selected. The remaining actual rows are cropped by the native scrollable suggestion list.",
		visibleNames,
		names: choices.filter(item => !item.__createNew).map(item => item.displayName),
	};
}
