/** Website scenes: production plugin components on the offline guide host. */
import { installDomHelpers, Menu, MarkdownView, setIcon } from "obsidian";
import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView, drawSelection } from "@codemirror/view";
import { setLocale, t } from "../../../src/i18n/index.ts";
import { getAllColorPalettes } from "../../../src/utils/colorPalettes.ts";
import { CalloutAutoComplete } from "../../../src/editor/AutoComplete.ts";
import { addItems } from "../../../src/editor/contextmenu/items.ts";
import { QuickInsertModal } from "../../../src/settings/QuickInsertModal.ts";
import { CalloutCombobox } from "../../../src/settings/calloutCombobox.ts";
import { createOccurrencesFrame } from "../../../src/usage/occurrencesViewFrame.ts";
import { OccurrenceResults } from "../../../src/usage/occurrenceResults.ts";
import { OccurrenceTypeChoices, occurrencePickerChoices, ALL_TYPES_ID } from "../../../src/usage/occurrenceTypeChoices.ts";
import { scanCalloutOccurrences } from "../../../src/usage/scanCalloutOccurrences.ts";
import { OutlineDecorator } from "../../../src/outline/OutlineDecorator.ts";
import { LinkSuggestDecorator } from "../../../src/editor/LinkSuggestDecorator.ts";
import { makeHost, renderMarkdown, seedExample } from "../../../scripts/user-guide/fixture-host.mjs";
import { mountScene as mountStoreScene } from "../../../scripts/store-screenshots/scenes.mjs";
import { mountScene as mountGuideScene } from "../../../scripts/user-guide/scenes.mjs";

const frames = (count = 2) => new Promise(resolve => {
	const step = left => left ? requestAnimationFrame(() => step(left - 1)) : resolve();
	step(count);
});
async function waitFor(predicate, label) {
	for (let frame = 0; frame < 240; frame++) {
		if (predicate()) return;
		await new Promise(resolve => setTimeout(resolve, 16));
	}
	throw new Error(`Scene did not finish rendering: ${label}`);
}

/** The storefront's own three callouts, with their production palettes. */
function seedStore(plugin) {
	for (const [id, displayName, icon, paletteId, alias] of [
		["idea", "Idea", "lightbulb", "purple", "spark"],
		["meeting", "Meeting", "messages-square", "plum", "sync"],
		["research", "Research", "telescope", "teal", "study"],
	]) {
		const palette = getAllColorPalettes().find(item => item.id === paletteId);
		if (!palette) throw new Error(`Missing production palette: ${paletteId}`);
		seedExample(plugin, {
			id, displayName, aliases: [alias], icon: { type: "lucide", value: icon }, paletteId,
			colorLight: palette.colorLight, colorDark: palette.colorDark,
			bgColorLight: palette.bgColorLight, bgColorDark: palette.bgColorDark,
		});
	}
}

function host() {
	installDomHelpers();
	setLocale("en");
	document.body.className = "theme-dark is-desktop mod-macos show-inline-title";
	const plugin = makeHost();
	seedStore(plugin);
	return plugin;
}

/** A note pane: optional inline title, then rendered Markdown. */
async function notePane(plugin, { id = "site-scene", title, markdown, width = 560, cls = "" }) {
	const pane = document.body.createDiv({ cls: `site-note markdown-preview-view ${cls}`, attr: { id } });
	pane.style.width = `${width}px`;
	if (title) pane.createDiv({ cls: "inline-title", text: title });
	const content = pane.createDiv({ cls: "markdown-rendered" });
	if (markdown) await renderMarkdown(plugin, content, markdown);
	return { pane, content };
}

/** One CodeMirror line block styled like Obsidian's editor text. */
function editorBlock(parent, doc, selection, cls = "") {
	const holder = parent.createDiv({ cls: `site-cm ${cls}` });
	const view = new EditorView({
		state: EditorState.create({ doc, selection, extensions: [drawSelection({ cursorBlinkRate: 0 })] }),
		parent: holder,
	});
	return { holder, view };
}

function suggestionShell(parent) {
	const shell = parent.createDiv({ cls: "suggestion-container" });
	return { shell, list: shell.createDiv({ cls: "suggestion" }) };
}

// ─── 1. One note, three formats ────────────────────────────────────────────
async function threeForms() {
	const plugin = host();
	await notePane(plugin, {
		title: "The Three Callout Types", width: 600,
		markdown: [
			"## [!idea] Heading Callout",
			"",
			"A section title that stands out, and still works as a real heading in the Outline and in links.",
			"",
			"Want an [!idea]{Inline Callout}? Drop it right into a sentence, without breaking the flow.",
			"",
			"> [!idea] Block Callout",
			"> The classic box, for an idea that deserves its own space.",
		].join("\n"),
	});
	return { selector: "#site-scene", title: "The same callout in three forms", description: "One note with the Idea callout as a heading, an inline pill and a block." };
}

// ─── 2. Callout editor (the store's production Create callout form) ────────
async function editor() {
	const metadata = await mountStoreScene("03-create");
	return metadata;
}

// ─── 3. Autocomplete on "> [!" ─────────────────────────────────────────────
async function autocomplete() {
	const plugin = host();
	const { pane } = await notePane(plugin, {
		title: "Weekly review", width: 540,
		markdown: "Three things went well this week. The pilot shipped on time, and the team agreed on the next milestone.",
	});
	const input = "> [!";
	const { holder, view } = editorBlock(pane, input, { anchor: input.length });
	const editorApi = {
		getLine: line => view.state.doc.line(line + 1).text,
		lineCount: () => view.state.doc.lines,
	};
	const suggest = new CalloutAutoComplete(plugin);
	const trigger = suggest.onTrigger({ line: 0, ch: input.length }, editorApi, null);
	if (!trigger) throw new Error("Autocomplete did not trigger on > [!");
	const context = { ...trigger, editor: editorApi, file: null };
	suggest.context = context;
	const { shell, list } = suggestionShell(holder);
	shell.classList.add("site-popover");
	const choices = suggest.getSuggestions(context);
	choices.forEach((choice, index) => suggest.renderSuggestion(choice, list.createDiv({ cls: `suggestion-item${index === 0 ? " is-selected" : ""}` })));
	view.focus();
	await frames();
	const rows = [...list.children];
	const visible = rows.slice(0, 8).reduce((sum, row) => sum + row.getBoundingClientRect().height, 0);
	const style = getComputedStyle(list);
	list.style.maxHeight = `${visible + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)}px`;
	list.style.overflow = "hidden";
	return { selector: "#site-scene", title: "Autocomplete", description: "Typing > [! opens the callout list with icons and colors.", names: choices.slice(0, 8).map(c => c.displayName) };
}

// ─── 4. Quick insert window ────────────────────────────────────────────────
function attachSyntheticEditor(plugin) {
	const view = new MarkdownView();
	const file = { path: "Weekly review.md", basename: "Weekly review" };
	const leaf = { view };
	Object.assign(view, { file, leaf, editor: { getCursor: () => ({ line: 0, ch: 0 }), getValue: () => "" }, getMode: () => "source" });
	plugin.app.workspace.getActiveViewOfType = type => view instanceof type ? view : null;
	plugin.app.workspace.getLeavesOfType = type => type === "markdown" ? [leaf] : [];
	plugin.app.workspace.getMostRecentLeaf = () => leaf;
}
async function quickInsert() {
	const plugin = host();
	attachSyntheticEditor(plugin);
	plugin.localState.quickInsertSource = "all";
	const modal = new QuickInsertModal(plugin);
	modal.open();
	modal.modalEl.setAttribute("id", "site-scene");
	await waitFor(() => modal.contentEl.querySelector(".cs-qi-preview .callout"), "quick insert previews");
	return { selector: "#site-scene", title: "Quick insert", description: "The Quick insert window with rendered block previews." };
}

// ─── 5. Wrap: selected table + command palette ─────────────────────────────
async function wrap() {
	const plugin = host();
	const { pane } = await notePane(plugin, {
		title: "Sprint plan", width: 600,
		markdown: [
			"Friday's demo is the only deadline this week. Everything else, from the roadmap review to the new onboarding guide, can wait until the retro on Monday morning.",
			"",
			"Keep the slides short: one idea per slide, and a clear ask at the end. Send the final version to the whole team by Thursday at noon, so there is time for one last round of comments.",
			"",
			"Who owns what before then:",
		].join("\n"),
	});
	const doc = [
		"| Task | Owner | Status |",
		"| --- | --- | --- |",
		"| Draft the outline | Dana | Done |",
		"| Review the slides | Sam | In progress |",
		"| Book the room | Lee | To do |",
	].join("\n");
	const { holder, view } = editorBlock(pane, doc, EditorSelection.single(0, doc.length), "site-table");
	view.focus();
	pane.style.position = "relative";
	pane.createDiv({ cls: "site-cover" });
	// Obsidian's command palette, built with its own classes (app.js 1.14.4).
	const prompt = pane.createDiv({ cls: "prompt site-prompt" });
	const inputRow = prompt.createDiv({ cls: "prompt-input-container mod-raised" });
	const input = inputRow.createEl("input", { cls: "prompt-input", type: "text" });
	input.value = "wrap";
	input.setAttribute("value", "wrap");
	inputRow.createDiv({ cls: "prompt-input-cta" });
	const results = prompt.createDiv({ cls: "prompt-results" });
	const commands = [
		{ name: t("cmd.calloutWrap"), match: [0, 4] },
		{ name: t("cmd.customWrapBlockCollapsed", { name: "Idea" }), match: [0, 4], hotkey: "⌘ ⇧ C" },
		{ name: t("cmd.calloutUnwrap"), match: [2, 6] },
	];
	commands.forEach((command, index) => {
		const item = results.createDiv({ cls: `suggestion-item mod-complex${index === 0 ? " is-selected" : ""}` });
		const content = item.createDiv({ cls: "suggestion-content" });
		const aux = item.createDiv({ cls: "suggestion-aux" });
		const titleEl = content.createDiv({ cls: "suggestion-title" });
		// Obsidian writes the ": " with .suggestion-prefix::after; keep it as text.
		titleEl.createSpan({ cls: "suggestion-prefix site-prefix", text: "Callout Studio: " });
		const nameEl = titleEl.createSpan();
		const [from, to] = command.match;
		nameEl.appendText(command.name.slice(0, from));
		nameEl.createSpan({ cls: "suggestion-highlight", text: command.name.slice(from, to) });
		nameEl.appendText(command.name.slice(to));
		if (command.hotkey) aux.createEl("kbd", { cls: "suggestion-hotkey", text: command.hotkey });
	});
	const instructions = prompt.createDiv({ cls: "prompt-instructions" });
	for (const [command, purpose] of [["↑↓", "to navigate"], ["↵", "to use"], ["esc", "to dismiss"]]) {
		const row = instructions.createDiv({ cls: "prompt-instruction" });
		row.createSpan({ cls: "prompt-instruction-command", text: command });
		row.createSpan({ text: purpose });
	}
	await frames();
	// Keep the whole selected table clear of the palette.
	const paneTop = pane.getBoundingClientRect().top;
	const tableTop = holder.getBoundingClientRect().top - paneTop;
	const lead = [...pane.querySelectorAll(".markdown-rendered > p")].at(-1).getBoundingClientRect().top - paneTop;
	const promptHeight = prompt.getBoundingClientRect().height;
	const top = Math.round(lead - promptHeight - 14);
	if (top < 12) console.warn(`Palette would cover the table (top ${top}, table ${tableTop}, prompt ${promptHeight})`);
	prompt.style.top = `${top}px`;
	await frames();
	return { selector: "#site-scene", title: "Wrap in callout", description: "A selected table and the Wrap in callout command.", promptTop: top, tableTop, promptHeight };
}

// ─── 6. Right-click menus ──────────────────────────────────────────────────
async function menuFor(plugin, pane, targetEl, context, offset) {
	const menu = new Menu();
	addItems(plugin, menu, { ...context, view: null, surface: "reading", targetEl });
	menu.showAtPosition({ x: 0, y: 0 });
	const menuEl = document.querySelector("body > .menu");
	pane.style.position = "relative";
	pane.appendChild(menuEl);
	Object.assign(menuEl.style, { position: "absolute", left: `${offset.x}px`, top: `${offset.y}px` });
	return menuEl;
}
async function menuBlock() {
	const plugin = host();
	const markdown = "> [!idea]+ Idea\n> Give your ideas room to grow. Keep the next steps together.";
	const { pane } = await notePane(plugin, { id: "site-scene", width: 520, markdown });
	const targetEl = pane.querySelector('.callout[data-callout="idea"]');
	const editorApi = { getLine: () => markdown.split("\n")[0], lineCount: () => 2 };
	const menuEl = await menuFor(plugin, pane, targetEl, { id: "idea", role: "regular", editor: editorApi, callout: { id: "idea", headerLine: 0, prefix: "> ", quoteDepth: 1 } }, { x: 250, y: 74 });
	const bottom = menuEl.getBoundingClientRect().bottom - pane.getBoundingClientRect().top;
	pane.style.setProperty("height", `${bottom + 20}px`, "important");
	pane.style.boxSizing = "border-box";
	await frames();
	return { selector: "#site-scene", title: "Block callout menu", description: "The right-click menu on a block callout.", items: [...menuEl.querySelectorAll(".menu-item-title")].map(el => el.textContent) };
}
async function menuHeading() {
	const plugin = host();
	const markdown = "## [!meeting] Weekly sync\n\nDecisions, owners and dates from Monday's call.";
	const { pane } = await notePane(plugin, { id: "site-scene", width: 520, markdown });
	const targetEl = pane.querySelector("h2");
	const lines = markdown.split("\n");
	const editorApi = { getLine: line => lines[line] ?? "", lineCount: () => lines.length, getValue: () => markdown };
	const menuEl = await menuFor(plugin, pane, targetEl, { id: "meeting", role: "heading", editor: editorApi, headingLine: 0, headingLevel: 2 }, { x: 250, y: 46 });
	const bottom = menuEl.getBoundingClientRect().bottom - pane.getBoundingClientRect().top;
	pane.style.setProperty("height", `${bottom + 20}px`, "important");
	pane.style.boxSizing = "border-box";
	await frames();
	return { selector: "#site-scene", title: "Heading callout menu", description: "The right-click menu on a heading callout.", items: [...menuEl.querySelectorAll(".menu-item-title")].map(el => el.textContent) };
}

// ─── Workspace: a note pane beside a right sidebar ─────────────────────────
const FIND_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon callout-studio-statistics"><path d="M8.802 16.31L3.942 14.984"/><path d="M11.582 10.575L8.354 7.348C8.159 7.153 8.159 6.836 8.354 6.641L9.298 5.697C10.239 4.756 11.765 4.756 12.706 5.697L13.65 6.641C13.845 6.836 14.162 6.836 14.357 6.641L18.376 2.622C18.912 2.086 19.694 1.876 20.426 2.073C21.159 2.269 21.731 2.841 21.927 3.574C22.124 4.306 21.914 5.088 21.378 5.624L18.046 8.957"/><path d="M9 8C7.196 10.71 5.03 11.46 2.417 11.948C2.241 11.98 2.094 12.103 2.032 12.271C1.97 12.44 2.002 12.628 2.115 12.767L9.435 21.65C9.74 21.974 10.224 22.058 10.62 21.854C10.688 21.807 10.757 21.758 10.828 21.707"/><circle cx="16.5" cy="16.5" r="4"/><path d="m19.3 19.3 2.7 2.7"/></svg>';
function workspace({ sideWidth, height, tabs, active }) {
	const root = document.body.createDiv({ cls: "site-workspace", attr: { id: "site-scene" } });
	root.style.height = `${height}px`;
	const main = root.createDiv({ cls: "site-main" });
	const side = root.createDiv({ cls: "site-side" });
	side.style.width = `${sideWidth}px`;
	const header = side.createDiv({ cls: "site-side-tabs" });
	tabs.forEach((icon, index) => {
		const tab = header.createDiv({ cls: `clickable-icon${index === active ? " is-active" : ""}` });
		if (icon === "find") tab.innerHTML = FIND_ICON;
		else setIcon(tab, icon);
	});
	const body = side.createDiv({ cls: "site-side-body" });
	return { root, main, body };
}
async function renderNoteInto(plugin, parent, title, markdown) {
	const pane = parent.createDiv({ cls: "site-note markdown-preview-view" });
	if (title) pane.createDiv({ cls: "inline-title", text: title });
	const content = pane.createDiv({ cls: "markdown-rendered" });
	await renderMarkdown(plugin, content, markdown);
	return pane;
}

// ─── 7. Find callouts sidebar ──────────────────────────────────────────────
const vault = {
	"Weekly review.md": "# Weekly review\n\n## [!idea] Ideas for next week\n\nStart with [!idea]{a smaller pilot} before the full launch.\n\n> [!meeting] Monday sync\n> Agree on the first milestone.\n",
	"Launch plan.md": "# Launch plan\n\n> [!idea] Keep it simple\n> One goal per week is easier to finish.\n",
	"Reading notes.md": "# Reading notes\n\n## [!research] Sources to check\n\nThe [!idea]{second chapter} has the best examples.\n",
};
async function find() {
	const plugin = host();
	const { main, body } = workspace({ sideWidth: 312, height: 560, tabs: ["bookmark", "tags", "list", "find"], active: 3 });
	await renderNoteInto(plugin, main, "Weekly review", "## [!idea] Ideas for next week\n\nStart with [!idea]{a smaller pilot} before the full launch.\n\n> [!meeting] Monday sync\n> Agree on the first milestone.");
	const occurrences = Object.entries(vault).flatMap(([path, source]) => scanCalloutOccurrences(path, source));
	const fileCount = Object.keys(vault).length;
	const index = { dataRevision: 1, query: () => ({ occurrences, fileCount }) };
	const types = new OccurrenceTypeChoices(plugin.registry, index);
	const panel = body.createDiv({ cls: "view-content cs-occurrences-view" });
	const frame = createOccurrencesFrame(panel);
	new CalloutCombobox(frame.pickerHost, {
		registry: plugin.registry, choices: () => occurrencePickerChoices(types, ALL_TYPES_ID), value: ALL_TYPES_ID,
		ariaLabel: t("vaultStats.columnType"), labelOf: def => def.id === ALL_TYPES_ID ? t("usage.allTypes") : def.id,
		iconlessOptionId: ALL_TYPES_ID, hideSingleGroup: true, showSingleGroupKey: "browse", onChange() {},
	});
	frame.summary.textContent = t("usage.summary", { count: occurrences.length, files: fileCount });
	new OccurrenceResults(100).render(frame.results, occurrences, 100, true, () => {}, () => {});
	for (const heading of frame.results.querySelectorAll(".cs-sidebar-file-heading")) heading.style.background = "transparent";
	await frames();
	return { selector: "#site-scene", title: "Find callouts", description: "Every callout occurrence across the vault, beside the note it came from.", count: occurrences.length };
}

// ─── 8. Outline + link suggestions ─────────────────────────────────────────
const outlineNote = "# Launch plan\n\n## [!idea] Start with a small pilot\n\nTwo teams first, then everyone.\n\n## [!meeting] Kickoff agenda\n\nWho owns what, and by when.\n\n### [!research] Open questions\n\nWhat do users expect on day one?";
async function outline() {
	const plugin = host();
	const file = plugin.seedNote("Launch plan.md", outlineNote);
	const { main, body } = workspace({ sideWidth: 272, height: 560, tabs: ["bookmark", "tags", "list"], active: 2 });
	const pane = await renderNoteInto(plugin, main, "Launch plan", outlineNote.replace(/^# Launch plan\n\n/, ""));
	// A wikilink being typed, decorated by the production heading-suggestion decorator.
	const { holder } = editorBlock(pane, "See [[#", { anchor: 7 });
	const coreSuggest = { renderSuggestion(value, element) {
		element.addClass("mod-complex");
		const content = element.createDiv({ cls: "suggestion-content" });
		content.createDiv({ cls: "suggestion-title", text: value.heading });
		content.createDiv({ cls: "suggestion-note", text: "Launch plan" });
	} };
	plugin.app.workspace.editorSuggest = { suggests: [coreSuggest] };
	new LinkSuggestDecorator(plugin).install([]);
	const { shell, list } = suggestionShell(holder);
	shell.classList.add("site-popover");
	for (const [index, heading] of ["[!idea] Start with a small pilot", "[!meeting] Kickoff agenda", "[!research] Open questions"].entries()) {
		coreSuggest.renderSuggestion({ type: "heading", heading }, list.createDiv({ cls: `suggestion-item${index === 0 ? " is-selected" : ""}` }));
	}
	// Obsidian's Outline view: the plugin cleans the native tree in place.
	const sidebar = body.createDiv({ cls: "outline site-outline" });
	const tree = sidebar.createDiv({ cls: "tree-item-children" });
	for (const heading of plugin.app.metadataCache.getFileCache(file).headings) {
		const item = tree.createDiv({ cls: "tree-item" });
		item.style.paddingLeft = `${(heading.level - 1) * 16}px`;
		item.createDiv({ cls: "tree-item-self is-clickable" }).createDiv({ cls: "tree-item-inner", text: heading.heading });
	}
	plugin.app.workspace.getLeavesOfType = type => type === "outline" ? [{ view: { containerEl: sidebar, file } }] : [];
	new OutlineDecorator(plugin).attachAll();
	await frames();
	if (sidebar.textContent.includes("[!")) throw new Error("Outline still shows raw tokens");
	if (list.textContent.includes("[!")) throw new Error("Link suggestions still show raw tokens");
	return { selector: "#site-scene", title: "Outline and link suggestions", description: "Heading callouts keep their icon and color in the Outline and in link suggestions." };
}

// ─── 9. Version history (the guide's production scene) ─────────────────────
async function history() {
	return mountGuideScene("version-history");
}

const mounts = {
	"three-forms": threeForms, editor, autocomplete, "quick-insert": quickInsert, wrap,
	"menu-block": menuBlock, "menu-heading": menuHeading, find, outline, history,
};
export const sceneNames = Object.keys(mounts);
export async function mountScene(name) {
	const mount = mounts[name];
	if (!mount) throw new Error(`Unknown site scene: ${name}`);
	const metadata = await mount();
	await frames();
	await document.fonts.ready;
	return metadata;
}
