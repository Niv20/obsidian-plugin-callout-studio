import { TestKeymap, TestScope } from "./support/fakeKeymap";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setTimeout as scheduleTimer, clearTimeout as cancelTimer } from "node:timers";
import { MarkdownView, TFile, type App, type Command, type EditorPosition, type Plugin, type WorkspaceLeaf } from "obsidian";
import { CalloutOccurrencesView } from "../src/usage/CalloutOccurrencesView";
import { getCalloutOccurrenceIndex } from "../src/usage/CalloutOccurrenceIndex";
import { openOccurrencesFromSettings } from "../src/usage/openFromSettings";
import { ensureOccurrencesSidebarTab, openCalloutOccurrences, registerOccurrencesView, refreshOccurrencesViewLocale } from "../src/usage/registerOccurrencesView";
import { registerQuickInsertRibbon } from "../src/icons/registerUiIcons";
import { QUICK_INSERT_ICON_ID, STATISTICS_ICON_ID } from "../src/icons/uiIcons";
import { getLocale, setLocale, t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutCombobox } from "../src/settings/calloutCombobox";
import { createFallbackPicker, setFallbackCallout } from "../src/settings/sections/fallbackPicker";
import { FakeElement, installFakeDom } from "./support/fakeDom";
import { notifySidebarEditorSelection } from "../src/ui/sidebarSelection";
import { createdMenus, type Menu } from "./support/obsidianStub";

const dom = installFakeDom();
// Index scans yield between chunks. Let only those timer APIs run normally;
// the fake DOM's animation frames and mutation observers remain deterministic.
dom.window.setTimeout = (callback, delay) => Number(scheduleTimer(callback, delay));
dom.window.clearTimeout = (id) => cancelTimer(id);

function harness(
	contents: Record<string, string>,
	read?: (file: TFile) => Promise<string>,
	busyStatusDelayMs?: number,
) {
	const files = Object.entries(contents).map(([path, content]) => Object.assign(new TFile(), {
		path, extension: "md", stat: { mtime: 1, ctime: 1, size: content.length },
	}));
	let layoutSaves = 0;
	const scope = new TestScope();
	const keymap = new TestKeymap();
	keymap.pushScope(scope);
	const rootSplit = {};
	const sidebarRoot = {};
	type WorkspaceListener = (value: unknown) => void;
	const listeners = new Map<string, Set<WorkspaceListener>>();
	const references = new Map<object, { name: string; listener: WorkspaceListener }>();
	const documentLeaves = new Map(files.map((file) => {
		const markdown = new MarkdownView({} as WorkspaceLeaf);
		markdown.file = file;
		return [file.path, { view: markdown, getRoot: () => rootSplit } as unknown as WorkspaceLeaf] as const;
	}));
	let activeLeaf: WorkspaceLeaf | null = null;
	let recentDocumentLeaf: WorkspaceLeaf | null = null;
	let sidebarLeaf: WorkspaceLeaf;
	const emitWorkspaceEvent = (name: string, value: unknown): void => {
		for (const listener of listeners.get(name) ?? []) listener(value);
	};
	const app = {
		scope, keymap,
		vault: {
			getMarkdownFiles: () => files,
			getAbstractFileByPath: (path: string) => files.find((file) => file.path === path) ?? null,
			cachedRead: read ?? ((file: TFile) => Promise.resolve(contents[file.path]!)),
		},
		workspace: {
			rootSplit,
			requestSaveLayout: () => { layoutSaves++; },
			on: (name: string, listener: WorkspaceListener) => {
				const reference = {};
				const entries = listeners.get(name) ?? new Set<WorkspaceListener>();
				entries.add(listener);
				listeners.set(name, entries);
				references.set(reference, { name, listener });
				return reference;
			},
			offref: (reference: object) => {
				const entry = references.get(reference);
				if (entry) listeners.get(entry.name)?.delete(entry.listener);
				references.delete(reference);
			},
			getLeavesOfType: (type: string) => type === "markdown" ? [...documentLeaves.values()]
				: type === "callout-studio-occurrences" ? [sidebarLeaf] : [],
			getActiveViewOfType: (type: typeof MarkdownView) => activeLeaf?.view instanceof type ? activeLeaf.view : null,
			getActiveFile: () => activeLeaf?.view instanceof MarkdownView ? activeLeaf.view.file : null,
			getMostRecentLeaf: () => recentDocumentLeaf,
			setActiveLeaf: () => {},
		},
	} as unknown as App;
	const registry = new CalloutRegistry();
	registry.load({});
	sidebarLeaf = { app, getRoot: () => sidebarRoot } as unknown as WorkspaceLeaf;
	const view = new CalloutOccurrencesView(sidebarLeaf, registry, busyStatusDelayMs);
	Object.assign(sidebarLeaf, { view });
	const activateFile = (path: string): void => {
		const leaf = documentLeaves.get(path);
		assert.ok(leaf, `No Markdown leaf for ${path}`);
		activeLeaf = leaf;
		recentDocumentLeaf = leaf;
		emitWorkspaceEvent("active-leaf-change", leaf);
		emitWorkspaceEvent("file-open", leaf.view instanceof MarkdownView ? leaf.view.file : null);
	};
	const focusSidebar = (): void => {
		activeLeaf = sidebarLeaf;
		emitWorkspaceEvent("active-leaf-change", sidebarLeaf);
	};
	const renameFile = (oldPath: string, newPath: string): void => {
		const file = files.find((entry) => entry.path === oldPath);
		const leaf = documentLeaves.get(oldPath);
		const content = contents[oldPath];
		assert.ok(file && leaf && content !== undefined);
		file.path = newPath;
		contents[newPath] = content;
		delete contents[oldPath];
		documentLeaves.delete(oldPath);
		documentLeaves.set(newPath, leaf);
	};
	return {
		view, app, scope, keymap, registry, contents, index: getCalloutOccurrenceIndex(app), savedLayouts: () => layoutSaves,
		activateFile, focusSidebar, renameFile, emitWorkspaceEvent,
		workspaceListenerCount: (name: string) => listeners.get(name)?.size ?? 0,
	};
}

function action(view: CalloutOccurrencesView, name: string): HTMLButtonElement {
	const button = view.contentEl.querySelector<HTMLButtonElement>(`button[data-action="${name}"]`);
	assert.ok(button);
	return button;
}

/** The format filter: the small icon button at the end of the type field's row (finding S10-05). */
function formatFilter(view: CalloutOccurrencesView): FakeElement {
	const button = (view.contentEl as unknown as FakeElement).querySelector(".search-row .cs-sidebar-icon-button");
	assert.ok(button, "the type field's row has the format filter");
	return button;
}

/** Press the format filter and return the menu it opened. */
function openFormatMenu(view: CalloutOccurrencesView): Menu {
	formatFilter(view).fire("click");
	const menu = createdMenus[createdMenus.length - 1];
	assert.ok(menu?.shown, "pressing the filter opened no menu");
	return menu;
}

/** The format shown now: the ✓ of a freshly opened format menu, which is then closed. */
function formatValue(view: CalloutOccurrencesView): string {
	const menu = openFormatMenu(view);
	const checked = menu.items.find((item) => item.checked);
	menu.hide();
	return typeof checked?.title === "string" ? checked.title : "";
}

/** Choose a format the way a user does: the filter, then the menu item. */
function pickFormat(view: CalloutOccurrencesView, label: string): void {
	openFormatMenu(view).clickItem(label);
}

/** Open the type picker whose search box is `input`: a click on its field. */
function openPicker(input: FakeElement): void {
	input.closest(".cs-combobox")!.querySelector(".cs-dropdown-field")!.fire("click");
}

/** The words the type picker's field shows: the committed type. */
function shownType(root: HTMLElement): string {
	return (root as unknown as FakeElement).querySelector(".cs-dropdown-field-label")?.textContent ?? "";
}

function fileSection(view: CalloutOccurrencesView, path: string): FakeElement | null {
	return (view.contentEl.querySelectorAll(".cs-occurrences-file") as unknown as FakeElement[])
		.find((section) => section.dataset.path === path) ?? null;
}

describe("callout occurrence sidebar", () => {
	it("creates its right sidebar tab without activating or revealing it", async () => {
		const calls: unknown[][] = [];
		const app = { workspace: {
			ensureSideLeaf: async (...args: unknown[]) => { calls.push(args); return {
				loadIfDeferred: () => { throw new Error("The background tab must remain deferred"); },
				setViewState: () => { throw new Error("The background tab must keep its saved state"); },
			}; },
			revealLeaf: () => { throw new Error("The sidebar must remain hidden"); },
		} } as unknown as App;
		await ensureOccurrencesSidebarTab(app);
		assert.deepEqual(calls, [["callout-studio-occurrences", "right", { active: false, reveal: false }]]);
	});
	it("leaves the format menu's Escape to Obsidian, and closes the menu with the view", async () => {
		// The format filter opens Obsidian's own menu, which brings its own key
		// scope (Escape and the arrows) in the app. The view must not push one
		// of its own on top, and must not leave a menu open behind a closed view.
		const h = harness({ "a.md": "[!note]" });
		await h.view.onOpen();
		const first = openFormatMenu(h.view);
		assert.equal(h.keymap.scopes.length, 1, "no scope of the plugin's own for a plain choice");
		const second = openFormatMenu(h.view);
		assert.equal(first.shown, false, "a second press replaces the first menu");
		h.view.refreshLabels();
		assert.equal(formatFilter(h.view).getAttribute("aria-label"), t("usage.filterFormat"), "the filter button is drawn again with its label");
		assert.equal((h.view.containerEl as unknown as FakeElement).querySelector(".nav-header"), null, "no row of its own for the icon");
		await h.view.onClose();
		assert.equal(second.shown, false, "closing the view closes the menu");
		assert.equal((h.view.contentEl as unknown as FakeElement).querySelector(".cs-sidebar-icon-button"), null, "and takes the filter button with it");
		assert.equal(h.keymap.scopes.length, 1);
		h.index.dispose();
	});
	it("ignores locale refresh before registration without reading the host", () => {
		const plugin = new Proxy({}, {
			get: (_target, property) => { throw new Error(`Premature host access: ${String(property)}`); },
		}) as Plugin;
		assert.doesNotThrow(() => refreshOccurrencesViewLocale(plugin));
	});
	it("opens general browsing with all types and formats, and Find callouts with its type and all formats", async () => {
		const commands: Command[] = [];
		const states: unknown[] = [];
		const sides: string[] = [];
		const options: unknown[] = [];
		let reveals = 0;
		const leaf = {
			loadIfDeferred: () => Promise.resolve(),
			setViewState: (state: unknown) => { states.push(state); return Promise.resolve(); },
		};
		const app = { setting: { close: () => {} }, workspace: {
			getLeavesOfType: () => [],
			ensureSideLeaf: (_type: string, side: string, option: unknown) => {
				sides.push(side); options.push(option); return Promise.resolve(leaf);
			},
			revealLeaf: () => { reveals++; return Promise.resolve(); },
		} } as unknown as App;
		const plugin = { app, registry: new CalloutRegistry(), registerView: () => {}, addCommand: (command: Command) => { commands.push(command); } } as unknown as Plugin & { registry: CalloutRegistry };
		registerOccurrencesView(plugin);
		refreshOccurrencesViewLocale(plugin);
		assert.deepEqual(commands, [], "the static command is owned by the built-in command registry");
		await openCalloutOccurrences(app, ["warning"], "inline");
		await openCalloutOccurrences(app);
		await openOccurrencesFromSettings(app, ["note"]);
		await openCalloutOccurrences(app);
		assert.deepEqual(sides, ["right", "right", "right", "right"]);
		assert.deepEqual(options, [
			{ active: true, reveal: true, state: { ids: ["warning"], role: "inline" } },
			{ active: true, reveal: true, state: { allTypes: true, role: undefined } },
			{ active: true, reveal: true, state: { ids: ["note"], role: undefined } },
			{ active: true, reveal: true, state: { allTypes: true, role: undefined } },
		]);
		assert.equal(reveals, 4);
		assert.deepEqual(states, [
			{ type: "callout-studio-occurrences", active: true, state: { ids: ["warning"], role: "inline" } },
			{ type: "callout-studio-occurrences", active: true, state: { allTypes: true, role: undefined } },
			{ type: "callout-studio-occurrences", active: true, state: { ids: ["note"], role: undefined } },
			{ type: "callout-studio-occurrences", active: true, state: { allTypes: true, role: undefined } },
		]);
	});
	it("keeps the native right sidebar tab as the only occurrences toggle", () => {
		const h = harness({ "a.md": "[!note]" });
		const previousLocale = getLocale();
		const ribbonIcons: string[] = [];
		const plugin = {
			app: h.app,
			openQuickInsert: () => {},
			addRibbonIcon: (icon: string) => { ribbonIcons.push(icon); },
		} as unknown as Plugin & { openQuickInsert(): void };
		try {
			setLocale("en");
			registerQuickInsertRibbon(plugin);
			assert.deepEqual(ribbonIcons, [QUICK_INSERT_ICON_ID]);
			assert.equal(h.view.getIcon(), STATISTICS_ICON_ID, "the occurrences tab keeps its own native icon");
			assert.equal(h.view.getDisplayText(), "Find callouts");
		} finally { setLocale(previousLocale); h.index.dispose(); }
	});
	it("keeps quick scans quiet without showing an authoritative zero", async () => {
		let release: (text: string) => void = () => {};
		const wait = new Promise<string>((resolve) => { release = resolve; });
		const h = harness({ "a.md": "[!note]" }, () => wait);
		const opened = h.view.onOpen();
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent, "");
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, "");
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-metrics"), null);
		release("[!note]");
		await opened;
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, "");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-id"), null);
		await h.view.onClose();
		h.index.dispose();
	});
	it("announces a scan only after it stays busy past the delay", async () => {
		let release: (text: string) => void = () => {};
		const wait = new Promise<string>((resolve) => { release = resolve; });
		const h = harness({ "a.md": "[!note]" }, () => wait, 10);
		const opened = h.view.onOpen();
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, "");
		await new Promise((resolve) => scheduleTimer(resolve, 30));
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, t("usage.loading"));
		// A long scan is Obsidian's thin bar; its words are only read out.
		assert.ok(h.view.contentEl.querySelector(".cs-occurrences-scroll")?.classList.contains("is-loading"));
		assert.ok(h.view.contentEl.querySelector(".cs-occurrences-status")?.classList.contains("cs-visually-hidden"));
		release("[!note]");
		await opened;
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, "");
		await h.view.onClose();
		h.index.dispose();
	});
	it("groups results by file, paginates, filters all three roles and persists only filters", async () => {
		const h = harness({
			"b.md": "# [!note]\nText [!note]",
			"a.md": Array.from({ length: 105 }, (_, i) => `> [!note] ${i}`).join("\n"),
		});
		await h.view.onOpen();
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 100);
		assert.equal(h.view.contentEl.querySelector(".cs-sidebar-file-link")?.textContent,
			"a 105", "file count covers unloaded results too");
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
			t("usage.summary", { count: 107, files: 2 }));
		(h.view.contentEl as unknown as FakeElement).fire("click", { target: action(h.view, "more") });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 107);
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-file").length, 2);
		assert.deepEqual(Array.from(h.view.contentEl.querySelectorAll(".cs-sidebar-file-link"), (node) => node.textContent),
			["a 105", "b 2"]);
		const formatButton = formatFilter(h.view);
		assert.equal(formatValue(h.view), t("usage.allRoles"));
		assert.equal(formatButton.hasClass("is-active"), false, "unlit while every format shows");
		formatButton.focus();
		const formatMenu = openFormatMenu(h.view);
		assert.deepEqual(formatMenu.items.map((item) => item.title), [
			t("usage.allRoles"), t("vaultStats.roleHeading"), t("vaultStats.roleInline"), t("vaultStats.roleBlock"),
		]);
		assert.deepEqual(formatMenu.items.map((item) => item.checked), [true, false, false, false]);
		formatMenu.clickItem(t("vaultStats.roleHeading"));
		assert.equal(formatValue(h.view), t("vaultStats.roleHeading"));
		assert.equal(formatButton.hasClass("is-active"), true, "lit while one format is chosen");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		assert.deepEqual(h.view.getState(), { ids: [], role: "heading", allTypes: true });
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
			t("usage.summary", { count: 1, files: 1 }));
		assert.equal(h.view.contentEl.querySelector(".cs-sidebar-file-link")?.textContent, "b 1");
		assert.equal(h.savedLayouts(), 1);
		assert.equal(h.view.contentEl.ownerDocument.activeElement, formatButton);
		h.view.contentEl.querySelector<HTMLElement>(".cs-occurrences-scroll")!.scrollTop = 180;
		await h.view.setState({ ids: ["note", "note"], role: "regular", occurrences: ["never persist"], totalCount: 999 }, { history: false });
		assert.deepEqual(h.view.getState(), { ids: ["note"], role: "regular" });
		assert.equal(h.view.contentEl.querySelector<HTMLElement>(".cs-occurrences-scroll")!.scrollTop, 0, "opening another view state begins at the top");
		assert.equal(formatValue(h.view), t("vaultStats.roleBlock"));
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 100);
		await h.view.onClose();
		h.index.dispose();
	});
	it("offers an iconless All types choice and queries every callout identity across files", async () => {
		const h = harness({
			"a.md": "[!note] [!warning]",
			"b.md": "# [!unknown]",
			"c.md": "[!note]",
		});
		await h.view.onOpen();
		const input = h.view.contentEl.querySelector(".cs-occurrences-picker .cs-combobox-input") as unknown as FakeElement;
		assert.deepEqual(h.view.getState(), { ids: [], role: undefined, allTypes: true });
		assert.equal(shownType(h.view.contentEl), t("usage.allTypes"));
		assert.equal(formatValue(h.view), t("usage.allRoles"));
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 4);
		openPicker(input);
		const allTypes = h.view.contentEl.querySelector(".cs-combobox-iconless-option") as unknown as FakeElement;
		assert.ok(allTypes);
		assert.equal(allTypes.textContent, t("usage.allTypes"));
		assert.equal(allTypes.querySelector(".callout-studio-suggestion-icon"), null);
		assert.equal(h.view.contentEl.querySelector(".cs-combobox-group-label")?.textContent, t("usage.browse"));
		allTypes.fire("click");
		assert.deepEqual(h.view.getState(), { ids: [], role: undefined, allTypes: true });
		assert.equal(shownType(h.view.contentEl), t("usage.allTypes"));
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 4);
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-file").length, 3);
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
			t("usage.summary", { count: 4, files: 3 }));

		pickFormat(h.view, t("vaultStats.roleHeading"));
		assert.deepEqual(h.view.getState(), { ids: [], role: "heading", allTypes: true });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		await h.view.setState({ ids: ["warning"], role: undefined }, { history: false });
		assert.deepEqual(h.view.getState(), { ids: h.registry.vaultIdFormsFor(h.registry.get("warning")!), role: undefined });
		assert.equal(shownType(h.view.contentEl), "warning");
		assert.equal(formatValue(h.view), t("usage.allRoles"), "Find callouts clears a previous format filter");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		await h.view.setState({ ids: [], role: undefined, allTypes: true }, { history: false });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 4);
		assert.equal(shownType(h.view.contentEl), t("usage.allTypes"), "restoring the scope keeps its visible selection");

		openPicker(input);
		input.value = "note";
		input.fire("input");
		const note = h.view.contentEl.querySelector(".cs-combobox-option") as unknown as FakeElement;
		assert.ok(note);
		note.fire("click");
		assert.deepEqual(h.view.getState(), { ids: ["note"], role: undefined });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 2);
		await h.view.onClose();
		h.index.dispose();
	});
	it("keeps the Browse heading when search leaves only All types", async () => {
		const h = harness({ "a.md": "[!note]" });
		await h.view.onOpen();
		try {
			const input = h.view.contentEl.querySelector(".cs-occurrences-picker .cs-combobox-input") as unknown as FakeElement;
			openPicker(input);
			input.value = t("usage.allTypes");
			input.fire("input");
			assert.deepEqual(Array.from(h.view.contentEl.querySelectorAll(".cs-combobox-group-label"), (node) => node.textContent),
				[t("usage.browse")]);
			const choices = h.view.contentEl.querySelectorAll(".cs-combobox-option");
			assert.equal(choices.length, 1);
			assert.equal(choices[0]?.textContent, t("usage.allTypes"));
		} finally {
			await h.view.onClose();
			h.index.dispose();
		}
	});
	it("highlights the active Markdown file and follows tab changes without losing sidebar context", async () => {
		const h = harness({ "a.md": "[!note]", "b.md": "[!note]", "empty.md": "" });
		h.activateFile("b.md");
		await h.view.onOpen();
		assert.equal(fileSection(h.view, "b.md")?.classList.contains("is-active-file"), true);
		assert.equal(fileSection(h.view, "a.md")?.classList.contains("is-active-file"), false);

		h.activateFile("a.md");
		assert.equal(fileSection(h.view, "a.md")?.classList.contains("is-active-file"), true);
		assert.equal(fileSection(h.view, "b.md")?.classList.contains("is-active-file"), false);
		h.focusSidebar();
		h.emitWorkspaceEvent("file-open", null);
		assert.equal(fileSection(h.view, "a.md")?.classList.contains("is-active-file"), true,
			"focusing the sidebar does not forget the last active note");

		h.activateFile("empty.md");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-file.is-active-file").length, 0,
			"a Markdown file without matching callouts has no highlighted section");
		await h.view.onClose();
		assert.equal(h.workspaceListenerCount("active-leaf-change"), 0);
		assert.equal(h.workspaceListenerCount("file-open"), 0);
		h.index.dispose();
	});
	it("ignores a background Markdown embed's file-open event while a different note is active", async () => {
		const h = harness({ "main.md": "[!note]", "embed.md": "[!note]" });
		h.activateFile("main.md");
		await h.view.onOpen();
		try {
			const embed = h.app.vault.getAbstractFileByPath("embed.md");
			assert.ok(embed instanceof TFile);
			h.emitWorkspaceEvent("file-open", embed);
			assert.equal(fileSection(h.view, "main.md")?.classList.contains("is-active-file"), true);
			assert.equal(fileSection(h.view, "embed.md")?.classList.contains("is-active-file"), false);
			h.focusSidebar();
			h.emitWorkspaceEvent("file-open", embed);
			assert.equal(fileSection(h.view, "main.md")?.classList.contains("is-active-file"), true,
				"the last main editor remains the context when the sidebar has focus");
		} finally {
			await h.view.onClose();
			h.index.dispose();
		}
	});
	it("keeps main-editor context when a Markdown note in a sidebar receives focus", async () => {
		const h = harness({ "main.md": "[!note]", "side.md": "[!note]" });
		h.activateFile("main.md");
		await h.view.onOpen();
		const side = new MarkdownView({} as WorkspaceLeaf);
		const sideFile = h.app.vault.getAbstractFileByPath("side.md");
		assert.ok(sideFile instanceof TFile);
		side.file = sideFile;
		h.app.workspace.getActiveViewOfType = (() => side) as App["workspace"]["getActiveViewOfType"];
		h.emitWorkspaceEvent("active-leaf-change", { view: side, getRoot: () => ({}) });
		h.emitWorkspaceEvent("file-open", side.file);
		assert.equal(fileSection(h.view, "main.md")?.classList.contains("is-active-file"), true);
		assert.equal(fileSection(h.view, "side.md")?.classList.contains("is-active-file"), false);
		await h.view.onClose();
		h.index.dispose();
	});
	it("clears Markdown context when the main pane switches to a non-Markdown view", async () => {
		const h = harness({ "main.md": "[!note]" });
		h.activateFile("main.md");
		await h.view.onOpen();
		const other = { view: {}, getRoot: () => h.app.workspace.rootSplit } as unknown as WorkspaceLeaf;
		h.app.workspace.getMostRecentLeaf = () => other;
		h.app.workspace.getActiveViewOfType = () => null;
		h.emitWorkspaceEvent("active-leaf-change", other);
		h.emitWorkspaceEvent("file-open", null);
		assert.equal(h.view.contentEl.querySelector(".is-active-file"), null);
		await h.view.onClose();
		h.index.dispose();
	});
	it("opens at the top without revealing an active file beyond the first results page", async () => {
		const h = harness({
			"a.md": Array.from({ length: 105 }, (_, i) => `> [!note] ${i}`).join("\n"),
			"z.md": "[!note] active",
		});
		h.activateFile("z.md");
		const originalScrollIntoView = Object.getOwnPropertyDescriptor(FakeElement.prototype, "scrollIntoView");
		assert.ok(originalScrollIntoView);
		const scrolled: FakeElement[] = [];
		FakeElement.prototype.scrollIntoView = function (this: FakeElement): void {
			if (this.classList.contains("cs-occurrences-file")) scrolled.push(this);
		};
		try {
			await h.view.onOpen();
			assert.equal(h.view.contentEl.querySelector<HTMLElement>(".cs-occurrences-scroll")!.scrollTop, 0);
			assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 100);
			assert.equal(fileSection(h.view, "z.md"), null, "initial opening does not expand to the active file");
			assert.deepEqual(scrolled, [], "initial opening does not scroll to the active file");
			(h.view.contentEl as unknown as FakeElement).fire("click", { target: action(h.view, "more") });
			assert.equal(fileSection(h.view, "z.md")?.classList.contains("is-active-file"), true);
			assert.deepEqual(scrolled, [], "revealing more manually does not revive an initial scroll request");
		} finally {
			Object.defineProperty(FakeElement.prototype, "scrollIntoView", originalScrollIntoView);
			await h.view.onClose();
			h.index.dispose();
		}
	});
	it("preserves the sidebar position after either filter changes without revealing the active file", async () => {
		const h = harness({
			"a.md": [
				...Array.from({ length: 105 }, (_, i) => `> [!note] ${i}`),
				"# [!note] Heading", "> [!warning] Another type",
			].join("\n"),
			"z.md": "> [!note] Active",
		});
		h.activateFile("z.md");
		const originalScrollIntoView = Object.getOwnPropertyDescriptor(FakeElement.prototype, "scrollIntoView");
		assert.ok(originalScrollIntoView);
		const scrolled: FakeElement[] = [];
		FakeElement.prototype.scrollIntoView = function (this: FakeElement): void {
			if (this.classList.contains("cs-occurrences-file")) scrolled.push(this);
		};
		try {
			await h.view.onOpen();
			const typeInput = h.view.contentEl.querySelector(".cs-occurrences-picker .cs-combobox-input") as unknown as FakeElement;
			h.view.contentEl.querySelector<HTMLElement>(".cs-occurrences-scroll")!.scrollTop = 240;
			openPicker(typeInput);
			typeInput.value = "note";
			typeInput.fire("input");
			const note = h.view.contentEl.querySelector(".cs-occurrences-picker .cs-combobox-option") as unknown as FakeElement;
			assert.ok(note);
			note.fire("click");
			assert.deepEqual(h.view.getState(), { ids: ["note"], role: undefined });
			assert.equal(h.view.contentEl.querySelector<HTMLElement>(".cs-occurrences-scroll")!.scrollTop, 240, "choosing a type keeps the sidebar near the choice");
			assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 100);
			assert.equal(fileSection(h.view, "z.md"), null);
			assert.deepEqual(scrolled, []);

			h.view.contentEl.querySelector<HTMLElement>(".cs-occurrences-scroll")!.scrollTop = 300;
			pickFormat(h.view, t("vaultStats.roleBlock"));
			assert.deepEqual(h.view.getState(), { ids: ["note"], role: "regular" });
			assert.equal(h.view.contentEl.querySelector<HTMLElement>(".cs-occurrences-scroll")!.scrollTop, 300, "choosing a format keeps the sidebar near the choice");
			assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 100);
			assert.equal(fileSection(h.view, "z.md"), null);
			assert.deepEqual(scrolled, []);
		} finally {
			Object.defineProperty(FakeElement.prototype, "scrollIntoView", originalScrollIntoView);
			await h.view.onClose();
			h.index.dispose();
		}
	});
	it("expands a later page and scrolls directly to the newly active file section", async () => {
		const h = harness({
			"a.md": Array.from({ length: 105 }, (_, i) => `> [!note] ${i}`).join("\n"),
			"z.md": "[!note] target",
		});
		const originalScrollIntoView = Object.getOwnPropertyDescriptor(FakeElement.prototype, "scrollIntoView");
		assert.ok(originalScrollIntoView);
		const scrolled: Array<{ element: FakeElement; options?: ScrollIntoViewOptions }> = [];
		FakeElement.prototype.scrollIntoView = function (this: FakeElement, options?: ScrollIntoViewOptions): void {
			if (this.classList.contains("cs-occurrences-file")) scrolled.push({ element: this, options });
		};
		try {
			await h.view.onOpen();
			assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 100);
			assert.equal(fileSection(h.view, "z.md"), null);
			h.activateFile("z.md");
			const target = fileSection(h.view, "z.md");
			assert.ok(target);
			assert.equal(target.classList.contains("is-active-file"), true);
			assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 106);
			assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
				t("usage.summary", { count: 106, files: 2 }));
			assert.deepEqual(scrolled.at(-1), { element: target, options: { block: "start" } });
		} finally {
			Object.defineProperty(FakeElement.prototype, "scrollIntoView", originalScrollIntoView);
			await h.view.onClose();
			h.index.dispose();
		}
	});
	it("follows an active file rename into its new indexed path and reveals its later section", async () => {
		const h = harness({
			"a.md": "[!note] active",
			"m.md": Array.from({ length: 105 }, (_, i) => `> [!note] ${i}`).join("\n"),
		});
		h.activateFile("a.md");
		const originalScrollIntoView = Object.getOwnPropertyDescriptor(FakeElement.prototype, "scrollIntoView");
		assert.ok(originalScrollIntoView);
		const scrolled: FakeElement[] = [];
		FakeElement.prototype.scrollIntoView = function (this: FakeElement): void {
			if (this.classList.contains("cs-occurrences-file")) scrolled.push(this);
		};
		try {
			await h.view.onOpen();
			assert.equal(fileSection(h.view, "a.md")?.classList.contains("is-active-file"), true);
			h.renameFile("a.md", "z.md");
			h.index.invalidate("a.md");
			await h.index.ensureFresh();
			assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
				t("usage.summary", { count: 106, files: 2 }));
			const renamed = fileSection(h.view, "z.md");
			assert.ok(renamed, "the renamed file is included beyond the first results page");
			assert.equal(fileSection(h.view, "a.md"), null);
			assert.equal(renamed.classList.contains("is-active-file"), true);
			assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 106);
			assert.equal(scrolled.at(-1), renamed);
		} finally {
			Object.defineProperty(FakeElement.prototype, "scrollIntoView", originalScrollIntoView);
			await h.view.onClose();
			h.index.dispose();
		}
	});
	it("highlights an active file after a slow initial scan without scrolling to it", async () => {
		let release: (text: string) => void = () => {};
		const wait = new Promise<string>((resolve) => { release = resolve; });
		const h = harness({ "a.md": "[!note]" }, () => wait);
		h.activateFile("a.md");
		const originalScrollIntoView = Object.getOwnPropertyDescriptor(FakeElement.prototype, "scrollIntoView");
		assert.ok(originalScrollIntoView);
		const scrolled: FakeElement[] = [];
		FakeElement.prototype.scrollIntoView = function (this: FakeElement): void {
			if (this.classList.contains("cs-occurrences-file")) scrolled.push(this);
		};
		try {
			const opened = h.view.onOpen();
			assert.equal(fileSection(h.view, "a.md"), null);
			release("[!note]");
			await opened;
			const target = fileSection(h.view, "a.md");
			assert.ok(target);
			assert.equal(target.classList.contains("is-active-file"), true);
			assert.deepEqual(scrolled, []);
		} finally {
			Object.defineProperty(FakeElement.prototype, "scrollIntoView", originalScrollIntoView);
			await h.view.onClose();
			h.index.dispose();
		}
	});
	it("labels partial reads immediately but delays stale progress", async () => {
		const h = harness({ "broken.md": "[!warning]" }, () => Promise.reject(new Error("Unreadable")), 10);
		await h.view.onOpen();
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, t("usage.partial", { count: 1 }));
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.classList.contains("cs-visually-hidden"), false, "a problem is drawn");
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent, "");
		assert.ok(h.view.contentEl.querySelector(".cs-occurrences-failures")?.textContent?.includes("broken.md"));
		h.index.invalidate("broken.md");
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, "");
		await new Promise((resolve) => scheduleTimer(resolve, 30));
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, t("usage.stale"));
		await h.view.onClose();
		h.index.dispose();
		assert.equal(h.view.contentEl.textContent, "");
	});
	it("keeps existing results while a slow background update waits to announce itself", async () => {
		let reads = 0;
		let release: (text: string) => void = () => {};
		const wait = new Promise<string>((resolve) => { release = resolve; });
		const h = harness({ "a.md": "[!note]" }, () => ++reads === 1 ? Promise.resolve("[!note]") : wait, 10);
		await h.view.onOpen();
		const firstCard = action(h.view, "result");
		h.index.invalidateEditor("a.md");
		const refreshing = h.index.ensureFresh();
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, "");
		assert.equal(action(h.view, "result"), firstCard);
		await new Promise((resolve) => scheduleTimer(resolve, 30));
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, t("usage.stale"));
		assert.equal(action(h.view, "result"), firstCard);
		release("[!note]");
		await refreshing;
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, "");
		await h.view.onClose();
		h.index.dispose();
	});
	it("cannot revive a delayed status after a quick completion or close", async () => {
		const originalSetTimeout = dom.window.setTimeout.bind(dom.window);
		const originalClearTimeout = dom.window.clearTimeout.bind(dom.window);
		let delayed: (() => void) | undefined;
		let cleared = false;
		dom.window.setTimeout = (callback, delay) => {
			assert.equal(delay, 2_000);
			delayed = callback as () => void;
			return 42;
		};
		dom.window.clearTimeout = (id) => { if (id === 42) cleared = true; };
		try {
			let release: (text: string) => void = () => {};
			const wait = new Promise<string>((resolve) => { release = resolve; });
			const h = harness({ "a.md": "[!note]" }, () => wait);
			const opened = h.view.onOpen();
			assert.ok(delayed);
			release("[!note]");
			await opened;
			assert.equal(cleared, true);
			delayed();
			assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, "");
			await h.view.onClose();
			delayed();
			assert.equal(h.view.contentEl.textContent, "");
			h.index.dispose();
		} finally {
			dom.window.setTimeout = originalSetTimeout;
			dom.window.clearTimeout = originalClearTimeout;
		}
	});
	it("uses native buttons for keyboard activation and exposes the exact role and line", async () => {
		const h = harness({ "a.md": "before\n# [!note] title" });
		await h.view.onOpen();
		const result = action(h.view, "result");
		assert.equal(result.tagName, "BUTTON");
		assert.equal(result.getAttribute("type"), "button");
		assert.equal(result.querySelector(".cs-occurrences-location")?.textContent,
			t("usage.location", { line: 2, role: t("vaultStats.roleHeading") }));
		assert.equal(h.view.contentEl.querySelector('[data-action="next"]'), null);
		assert.equal(h.view.contentEl.querySelector('[data-action="previous"]'), null);
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-navigation"), null);
		await h.view.onClose();
		h.index.dispose();
	});
	it("clicking results scrolls to them without selecting, and the caret takes the mark back", async () => {
		const contents = { "a.md": "[!note] and [!note]", "b.md": "# [!note]" };
		const h = harness(contents);
		h.activateFile("a.md");
		const root = h.app.workspace.rootSplit;
		const scrolledTo: Array<{ path: string; from: EditorPosition; to: EditorPosition }> = [];
		let liveSelection = { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } };
		const opened: string[] = [];
		const view = new MarkdownView({} as WorkspaceLeaf);
		const text = (): string => contents[view.file!.path as keyof typeof contents];
		Object.assign(view, {
			getMode: () => "source",
			editor: {
				getValue: text,
				getLine: (line: number) => text().split("\n")[line] ?? "",
				lineCount: () => text().split("\n").length,
				getCursor: () => liveSelection.head,
				setSelection: () => { throw new Error("navigation must not select"); },
				listSelections: () => [liveSelection],
				scrollIntoView: (range: { from: EditorPosition; to: EditorPosition }) => {
					scrolledTo.push({ path: view.file!.path, ...range });
				},
				scrollTo: () => {},
				focus: () => { throw new Error("navigation must not focus the editor"); },
			},
		});
		const leaf = {
			view, getRoot: () => root,
			openFile: (file: TFile) => {
				view.file = file;
				opened.push(file.path);
				h.activateFile(file.path);
				return Promise.resolve();
			},
			loadIfDeferred: () => Promise.resolve(), setEphemeralState: () => {},
		};
		Object.assign(h.app.workspace, { rootSplit: root, getLeavesOfType: () => [], getLeaf: () => leaf,
			getActiveViewOfType: () => view, getMostRecentLeaf: () => leaf });
		const originalScrollIntoView = Object.getOwnPropertyDescriptor(FakeElement.prototype, "scrollIntoView");
		assert.ok(originalScrollIntoView);
		const scrolled: FakeElement[] = [];
		FakeElement.prototype.scrollIntoView = function (this: FakeElement): void {
			if (this.classList.contains("cs-occurrences-file")) {
				scrolled.push(this);
				h.view.contentEl.querySelector<HTMLElement>(".cs-occurrences-scroll")!.scrollTop = 999;
			}
		};
		const current = (): string | null =>
			h.view.contentEl.querySelector('[aria-current="true"]')?.getAttribute("data-result") ?? null;
		const moveCaret = (line: number, ch: number): void => {
			liveSelection = { anchor: { line, ch }, head: { line, ch } };
			notifySidebarEditorSelection(view.editor);
			dom.window.flushFrames();
		};
		try {
			await h.view.onOpen();
			assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
				t("usage.summary", { count: 3, files: 2 }));
			h.view.contentEl.querySelector<HTMLElement>(".cs-occurrences-scroll")!.scrollTop = 240;
			for (const position of [0, 1, 0, 2]) {
				const button = h.view.contentEl.querySelector(`[data-action="result"][data-result="${position}"]`)!;
				(h.view.contentEl as unknown as FakeElement).fire("click", { target: button });
				await new Promise((resolve) => window.setTimeout(resolve, 0));
				dom.window.flushFrames();
				assert.equal(h.view.contentEl.querySelector(`[data-result="${position}"]`), button,
					"selecting a result updates its existing card without rebuilding the list");
				assert.equal(h.view.contentEl.querySelector<HTMLElement>(".cs-occurrences-scroll")!.scrollTop, 240, `result ${position} stays at its original scroll offset`);
				assert.deepEqual(scrolled, [], "result navigation must not reveal its file heading");
				assert.equal(current(), String(position), "the clicked card holds the mark over the unmoved caret");
			}
			assert.deepEqual(opened, ["a.md", "a.md", "a.md", "b.md"]);
			// Inline pills are scrolled to by their token; a heading callout by its whole line.
			assert.deepEqual(scrolledTo.map((item) => [item.path, item.to.ch, item.from.ch]),
				[["a.md", 0, 7], ["a.md", 12, 19], ["a.md", 0, 7], ["b.md", 0, 9]]);
			assert.equal(h.view.contentEl.querySelectorAll('[aria-current="true"]').length, 1);
			h.activateFile("b.md");
			assert.equal(h.view.contentEl.querySelector<HTMLElement>(".cs-occurrences-scroll")!.scrollTop, 240, "a delayed activation of the clicked file keeps the card in place");
			assert.deepEqual(scrolled, []);
			moveCaret(0, 4);
			assert.equal(current(), "2", "the caret on the heading callout's line marks its card");
			const fileButton = h.view.contentEl.querySelector('button[data-action="file"][data-path="b.md"]')!;
			(h.view.contentEl as unknown as FakeElement).fire("click", { target: fileButton, ctrlKey: true });
			await new Promise(resolve => window.setTimeout(resolve, 0));
			dom.window.flushFrames();
			assert.equal(opened.at(-1), "b.md");
			assert.deepEqual(liveSelection, { anchor: { line: 0, ch: 4 }, head: { line: 0, ch: 4 } }, "a file heading leaves the caret alone");
			assert.equal(current(), "2", "after a file heading the caret keeps leading");
			const file = h.app.vault.getAbstractFileByPath("a.md");
			assert.ok(file instanceof TFile);
			view.file = file;
			liveSelection = { anchor: { line: 0, ch: 14 }, head: { line: 0, ch: 14 } };
			h.activateFile("a.md");
			dom.window.flushFrames();
			assert.deepEqual(scrolled, [fileSection(h.view, "a.md")], "a later direct tab switch still reveals its file");
			assert.equal(current(), "1", "a note switch hands the mark to that note's caret, not the previous file's card");
			moveCaret(0, 9);
			assert.equal(current(), null, "a caret between two pills is in no callout");
		} finally {
			Object.defineProperty(FakeElement.prototype, "scrollIntoView", originalScrollIntoView);
			await h.view.onClose();
			h.index.dispose();
		}
	});
	for (const change of ["filter", "close", "reopen"] as const) {
		it(`cancels pending result selection after ${change}`, async () => {
			const h = harness({ "a.md": "[!note]" });
			const editorView = new MarkdownView({} as WorkspaceLeaf);
			let selected = false;
			let release = (): void => {};
			const deferred = new Promise<void>((resolve) => { release = resolve; });
			Object.assign(editorView, { getMode: () => "source", editor: {
				getValue: () => "[!note]", scrollIntoView: () => { selected = true; }, focus: () => {},
			} });
			const leaf = {
				view: editorView, getRoot: () => h.app.workspace.rootSplit,
				openFile: (file: TFile) => { editorView.file = file; return deferred; },
				loadIfDeferred: () => Promise.resolve(), setEphemeralState: () => {},
			};
			Object.assign(h.app.workspace, { getLeavesOfType: () => [], getLeaf: () => leaf,
				getActiveViewOfType: () => editorView, getMostRecentLeaf: () => leaf });
			await h.view.onOpen();
			(h.view.contentEl as unknown as FakeElement).fire("click", { target: action(h.view, "result") });
			if (change === "filter") await h.view.setState({ ids: ["note"] }, { history: false });
			else {
				await h.view.onClose();
				if (change === "reopen") await h.view.onOpen();
			}
			release();
			await new Promise((resolve) => window.setTimeout(resolve, 0));
			assert.equal(selected, false);
			assert.equal(h.view.contentEl.querySelector('[aria-current="true"]'), null);
			if (change === "close") assert.equal(h.view.contentEl.children.length, 0);
			await h.view.onClose();
			h.index.dispose();
		});
	}
	it("offers registered and observed types locally and unions aliases without showing global metrics", async () => {
		const h = harness({ "a.md": "[!note] [!warning] [!caution] [!unregistered]" });
		const before = JSON.stringify(h.registry.toSaveData());
		await h.view.onOpen();
		const input = h.view.contentEl.querySelector(".cs-combobox-input") as unknown as FakeElement;
		const field = h.view.contentEl.querySelector(".cs-dropdown-field") as unknown as FakeElement;
		assert.equal(shownType(h.view.contentEl), t("usage.allTypes"));
		assert.equal(field.getAttribute("aria-label"), null);
		const labelId = field.getAttribute("aria-labelledby")?.split(" ")[0];
		assert.equal(h.view.contentEl.querySelector(`#${labelId}`)?.textContent, t("vaultStats.columnType"));
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 4);
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-metrics"), null);
		openPicker(input);
		input.value = "caution";
		input.fire("input");
		const row = h.view.contentEl.querySelector(".cs-combobox-option") as unknown as FakeElement;
		assert.ok(row);
		row.fire("click");
		assert.equal(shownType(h.view.contentEl), "warning");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 2);
		assert.deepEqual(h.view.getState(), { ids: h.registry.vaultIdFormsFor(h.registry.get("warning")!), role: undefined });
		assert.equal(h.savedLayouts(), 1);
		openPicker(input);
		input.value = "unregistered";
		input.fire("input");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-combobox-option").length, 1);
		(h.view.contentEl.querySelector(".cs-combobox-option") as unknown as FakeElement).fire("click");
		assert.equal(shownType(h.view.contentEl), "unregistered");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		assert.deepEqual(h.view.getState(), { ids: ["unregistered"], role: undefined });
		assert.equal(JSON.stringify(h.registry.toSaveData()), before, "browsing and filtering never register definitions");
		assert.equal(h.registry.get("unregistered"), undefined);
		const settingsHost = h.view.contentEl.createDiv();
		const settingsPicker = new CalloutCombobox(settingsHost, {
			registry: h.registry, choices: () => h.registry.getAll().filter((def) => def.source !== "theme"),
			value: "note", ariaLabel: t("settings.fallbackCallout"), onChange: () => assert.fail("Sidebar browsing changed a settings picker"),
		});
		const settingsInput = settingsHost.querySelector(".cs-combobox-input") as unknown as FakeElement;
		openPicker(settingsInput);
		assert.equal(settingsHost.querySelectorAll(".cs-combobox-group-label").length, 0, "ordinary callout pickers keep their ungrouped presentation");
		settingsInput.value = "unregistered";
		settingsInput.fire("input");
		assert.equal(settingsHost.querySelectorAll(".cs-combobox-option").length, 0, "shared settings choices remain registry-only");
		settingsPicker.destroy();
		settingsHost.remove();
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-id"), null);
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-query"), null);
		assert.equal(h.view.contentEl.querySelector('button[data-action="refresh"]'), null);
		assert.ok(h.view.contentEl.querySelector(".cs-sidebar-toolbar .search-row .cs-occurrences-picker"), "the type field in Search's field row");
		assert.equal(h.view.contentEl.querySelector(".cs-sidebar-subtitle"), null, "no sentence of its own over the pane");
		await h.view.onClose();
		h.index.dispose();
	});
	it("keeps registered choices above observed types across sorting, filtering, and keyboard selection", async () => {
		const h = harness({ "a.md": "[!note] [!aaa-needle] [!needle]" });
		h.registry.add({ ...h.registry.get("note")!, id: "registered-needle", displayName: "Zebra needle", builtIn: false, source: "user" });
		await h.view.onOpen();
		const input = h.view.contentEl.querySelector(".cs-combobox-input") as unknown as FakeElement;
		const headings = (): Array<string | null> => Array.from(h.view.contentEl.querySelectorAll(".cs-combobox-group-label"), (node) => node.textContent);
		const names = (): Array<string | null | undefined> => Array.from(h.view.contentEl.querySelectorAll(".cs-combobox-option"), (row) => row.querySelector(".callout-studio-suggestion-name")?.textContent);
		const search = (query: string): void => { input.value = query; input.fire("input"); };
		const key = (value: string): void => { input.fire("keydown", { key: value, preventDefault: () => {}, stopPropagation: () => {} }); };
		openPicker(input);
		assert.deepEqual(headings(), [t("usage.browse"), t("usage.registeredCallouts"), t("usage.unregisteredCallouts")]);
		const allNames = names();
		assert.deepEqual(allNames.slice(-2), ["aaa-needle", "needle"], "unknown rows stay after every registered row even when alphabetically earlier");
		assert.ok(allNames.indexOf("Zebra needle") < allNames.indexOf("aaa-needle"));
		search("needle");
		assert.deepEqual(names(), ["Zebra needle", "needle", "aaa-needle"], "registration takes priority over match rank, while each group keeps ranked search");
		assert.deepEqual(headings(), [t("usage.registeredCallouts"), t("usage.unregisteredCallouts")]);
		key("ArrowDown");
		const active = h.view.contentEl.querySelector(".cs-combobox-option.is-active");
		assert.equal(active?.querySelector(".callout-studio-suggestion-name")?.textContent, "needle");
		assert.equal(input.getAttribute("aria-activedescendant"), active?.id, "keyboard focus skips the group heading");
		key("Enter");
		assert.deepEqual(h.view.getState(), { ids: ["needle"], role: undefined });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		assert.equal(h.registry.get("needle"), undefined);
		openPicker(input);
		search("Zebra");
		assert.deepEqual(names(), ["Zebra needle"]);
		assert.deepEqual(headings(), [], "one matching registered group needs no heading");
		search("aaa");
		assert.deepEqual(names(), ["aaa-needle"]);
		assert.deepEqual(headings(), [], "one matching unregistered group needs no heading");
		search("no matching callout");
		assert.deepEqual(names(), []);
		assert.deepEqual(headings(), [], "empty searches leave no stranded section headings");
		await h.view.onClose();
		h.index.dispose();
	});
	it("omits a lone callout heading when search leaves one registration group", async () => {
		for (const registered of [true, false]) {
			const h = harness({ "a.md": registered ? "[!note]" : "[!unknown]" });
			if (!registered) h.registry.getBuiltIn = () => [];
			await h.view.onOpen();
			const input = h.view.contentEl.querySelector(".cs-combobox-input") as unknown as FakeElement;
			openPicker(input);
			assert.ok(h.view.contentEl.querySelectorAll(".cs-combobox-option").length > 0);
			assert.deepEqual(Array.from(h.view.contentEl.querySelectorAll(".cs-combobox-group-label"), (node) => node.textContent), [
				t("usage.browse"), t(registered ? "usage.registeredCallouts" : "usage.unregisteredCallouts"),
			]);
			input.value = registered ? "note" : "unknown";
			input.fire("input");
			assert.equal(h.view.contentEl.querySelectorAll(".cs-combobox-group-label").length, 0);
			await h.view.onClose();
			h.index.dispose();
		}
	});
	it("preserves global result indices after an explicit expansion of a large result set", async () => {
		const text = Array.from({ length: 1_005 }, (_, i) => `> [!note] ${i}`).join("\n");
		const h = harness({ "a.md": text });
		const root = h.app.workspace.rootSplit;
		const editorView = new MarkdownView({} as WorkspaceLeaf);
		const selectedLines: number[] = [];
		Object.assign(editorView, { getMode: () => "source", editor: {
			getValue: () => text,
			listSelections: () => [{ anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } }],
			scrollIntoView: (range: { to: EditorPosition }) => { selectedLines.push(range.to.line); }, focus: () => {},
		} });
		const leaf = {
			view: editorView, getRoot: () => root,
			openFile: (file: TFile) => { editorView.file = file; return Promise.resolve(); },
			loadIfDeferred: () => Promise.resolve(), setEphemeralState: () => {},
		};
		Object.assign(h.app.workspace, { rootSplit: root, getLeavesOfType: () => [], getLeaf: () => leaf,
			getActiveViewOfType: () => editorView, getMostRecentLeaf: () => leaf });
		await h.view.onOpen();
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 100);
		(h.view.contentEl as unknown as FakeElement).fire("click", { target: action(h.view, "more") });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 200);
		const button = h.view.contentEl.querySelector('[data-action="result"][data-result="199"]')!;
		(h.view.contentEl as unknown as FakeElement).fire("click", { target: button });
		for (let i = 0; i < 50 && !h.view.contentEl.querySelector('[aria-current="true"]'); i++) {
			await new Promise((resolve) => window.setTimeout(resolve, 0));
		}
		assert.deepEqual(selectedLines, [199]);
		assert.equal(h.view.contentEl.querySelector('[aria-current="true"]')?.getAttribute("data-result"), "199");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 200);
		await h.view.onClose();
		h.index.dispose();
	});
	it("keeps a typed picker search and its listeners stable through index updates", async () => {
		const h = harness({ "a.md": "[!note]" });
		const listenerCount = (): number => dom.document.listeners.get("click")?.length ?? 0;
		const before = listenerCount();
		await h.view.onOpen();
		const input = h.view.contentEl.querySelector(".cs-combobox-input") as unknown as FakeElement;
		openPicker(input);
		input.value = "emergent";
		input.fire("input");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-combobox-option").length, 0);
		h.contents["a.md"] = "[!note] [!note] [!emergent]";
		h.index.invalidate("a.md");
		await h.index.ensureFresh();
		assert.equal(h.view.contentEl.querySelector(".cs-combobox-input"), input);
		assert.equal(input.value, "emergent");
		assert.equal(input.getAttribute("aria-expanded"), "true");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-combobox-option").length, 1, "newly observed types appear in an open search");
		// The type picker keeps one outside-click listener of its own. The
		// format filter has none: its list is Obsidian's menu, which listens
		// for itself only while it is open.
		assert.equal(listenerCount(), before + 1, "the stable type picker retains one outside-click listener");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 3);
		await h.view.onClose();
		assert.equal(listenerCount(), before);
		await h.view.onOpen();
		assert.equal(listenerCount(), before + 1);
		await h.view.onClose();
		assert.equal(listenerCount(), before);
		h.index.dispose();
	});
	it("does not requery or rebuild cards for every keystroke before a fresh snapshot", async () => {
		const h = harness({ "a.md": "[!note]" });
		await h.view.onOpen();
		const firstCard = action(h.view, "result");
		const query = h.index.query.bind(h.index);
		let queries = 0;
		h.index.query = (...args) => { queries++; return query(...args); };
		for (let i = 0; i < 50; i++) h.index.invalidateEditor("a.md");
		assert.equal(queries, 0);
		assert.equal(action(h.view, "result"), firstCard);
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, "");
		await h.view.onClose();
		h.index.dispose();
	});
	it("resolves aliases and keeps a removed definition selectable while its Markdown usages remain", async () => {
		const h = harness({ "a.md": "[!note] [!warning] [!custom]" });
		h.registry.add({ ...h.registry.get("note")!, id: "custom", displayName: "Custom", builtIn: false, source: "user" });
		await h.view.setState({ ids: ["caution"] }, { history: false });
		await h.view.onOpen();
		assert.equal(shownType(h.view.contentEl), "warning");
		await h.view.setState({ ids: ["custom"] }, { history: false });
		assert.equal(shownType(h.view.contentEl), "custom");
		h.registry.remove("custom");
		assert.equal(shownType(h.view.contentEl), "custom");
		assert.deepEqual(h.view.getState(), { ids: ["custom"], role: undefined });
		h.contents["a.md"] = "[!note] [!warning]";
		h.index.invalidate("a.md");
		await h.index.ensureFresh();
		assert.equal(shownType(h.view.contentEl), "custom");
		assert.deepEqual(h.view.getState(), { ids: ["custom"], role: undefined });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 0);
		await h.view.setState({ ids: ["not-a-registered-type"] }, { history: false });
		assert.deepEqual(h.view.getState(), { ids: ["not-a-registered-type"], role: undefined });
		await h.view.onClose();
		h.index.dispose();
	});
	it("restores an unknown type before the initial scan and applies all format filters without registering it", async () => {
		let release: (text: string) => void = () => {};
		const text = "> [!unknown type] Block\n# [!Unknown-Type] Heading\n[!unknown   type|meta] Inline";
		const wait = new Promise<string>((resolve) => { release = resolve; });
		const h = harness({ "a.md": text }, () => wait);
		const before = JSON.stringify(h.registry.toSaveData());
		let changes = 0;
		h.registry.onChange(() => { changes++; });
		await h.view.setState({ ids: ["unknown type"], role: "heading" }, { history: false });
		const opened = h.view.onOpen();
		assert.deepEqual(h.view.getState(), { ids: ["unknown type"], role: "heading" });
		assert.equal(shownType(h.view.contentEl), "unknown type");
		release(text);
		await opened;
		for (const [role, count] of [["heading", 1], ["regular", 1], ["inline", 1], ["", 3]] as const) {
			pickFormat(h.view, t({ "": "usage.allRoles", regular: "vaultStats.roleBlock", heading: "vaultStats.roleHeading", inline: "vaultStats.roleInline" }[role]));
			assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, count);
			assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
				t("usage.summary", { count, files: 1 }));
		}
		assert.equal(changes, 0);
		assert.equal(JSON.stringify(h.registry.toSaveData()), before);
		await h.view.onClose();
		h.index.dispose();
	});
	it("repaints unknown options and the selected icon when the fallback changes without saved fallback rows", async () => {
		const h = harness({ "a.md": "[!unknown]" });
		h.registry.add({ ...h.registry.get("note")!, id: "template", displayName: "Template", builtIn: false,
			source: "user", icon: { type: "emoji", value: "⭐" }, colorLight: "#123456", colorDark: "#123456" });
		await h.view.setState({ ids: ["unknown"] }, { history: false });
		await h.view.onOpen();
		const input = h.view.contentEl.querySelector(".cs-combobox-input") as unknown as FakeElement;
		openPicker(input);
		input.value = "unk";
		input.fire("input");
		const lead = h.view.contentEl.querySelector<HTMLElement>(".cs-dropdown-field-icon")!;
		const optionIcon = (): HTMLElement => h.view.contentEl.querySelector(".callout-studio-suggestion-icon")!;
		const plugin = { app: h.app, registry: h.registry, settings: h.registry.settings, registerView: () => {},
			restyleUncustomizedFallbackRows: () => h.registry.restyleUncustomizedFallbackRows(),
			saveSettings: () => Promise.resolve(), refreshCallouts: () => {},
		} as unknown as Parameters<typeof createFallbackPicker>[0];
		registerOccurrencesView(plugin);
		const settingsHost = createDiv();
		// The settings page's Default fallback callout picker.
		const settingsPicker = createFallbackPicker(plugin, settingsHost, (id) => setFallbackCallout(plugin, id));
		const settingsInput = settingsHost.querySelector(".cs-combobox-input") as unknown as FakeElement;
		openPicker(settingsInput);
		settingsInput.value = "template";
		settingsInput.fire("input");
		(settingsHost.querySelector(".cs-combobox-option") as unknown as FakeElement).fire("click");
		assert.equal(h.registry.settings.fallbackCalloutId, "template");
		assert.equal(input.value, "unk");
		assert.equal(input.getAttribute("aria-expanded"), "true");
		assert.equal(lead.textContent, "⭐");
		assert.equal(lead.style.color, "#123456");
		assert.equal(optionIcon().textContent, "⭐");
		assert.equal(optionIcon().style.color, "#123456");
		h.registry.update("template", { hideIcon: true });
		assert.ok(lead.hasClass("cs-icon-none"));
		assert.ok(optionIcon().hasClass("cs-icon-none"));
		assert.equal(lead.textContent, "");
		assert.deepEqual(h.view.getState(), { ids: ["unknown"], role: undefined });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		assert.equal(h.registry.get("unknown"), undefined);
		settingsPicker.destroy();
		await h.view.onClose();
		h.index.dispose();
	});
	it("keeps the theme's measured appearance for an unregistered type with fallback artwork", async () => {
		const h = harness({ "a.md": "[!theme-only]" });
		h.registry.setThemeOwnedIds(new Set(["theme-only"]));
		h.registry.setThemeAppearances(new Map([["theme-only", {
			accent: "rgb(1, 2, 3)", background: null, icon: { kind: "glyph", text: "☀", fontFamily: "serif" },
		}]]));
		await h.view.setState({ ids: ["theme-only"] }, { history: false });
		await h.view.onOpen();
		const lead = h.view.contentEl.querySelector<HTMLElement>(".cs-dropdown-field-icon")!;
		assert.equal(lead.style.color, "rgb(1, 2, 3)");
		assert.equal(lead.textContent, "☀");
		assert.equal(h.registry.get("theme-only"), undefined);
		await h.view.onClose();
		h.index.dispose();
	});
	it("refreshes an unknown selection's appearance and aliases when it is registered without losing a typed query", async () => {
		const h = harness({ "a.md": "[!unknown] [!legacy]" });
		await h.view.setState({ ids: ["unknown"] }, { history: false });
		await h.view.onOpen();
		const input = h.view.contentEl.querySelector(".cs-combobox-input") as unknown as FakeElement;
		openPicker(input);
		input.value = "lea";
		input.fire("input");
		h.registry.add({ ...h.registry.get("note")!, id: "unknown", displayName: "Unknown", builtIn: false, source: "user", aliases: ["legacy"], colorLight: "#123456", colorDark: "#123456" });
		assert.equal(input.value, "lea");
		assert.equal(input.getAttribute("aria-expanded"), "true");
		assert.equal(h.view.contentEl.querySelector<HTMLElement>(".cs-dropdown-field-icon")?.style.color, "#123456");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 2);
		assert.deepEqual(h.view.getState(), { ids: h.registry.vaultIdFormsFor(h.registry.get("unknown")!), role: undefined });
		await h.view.onClose();
		h.index.dispose();
	});
	it("refreshes registered choices and selected aliases after changes made while the sidebar was closed", async () => {
		const h = harness({ "a.md": "[!unknown] [!legacy]" });
		await h.view.setState({ ids: ["unknown"] }, { history: false });
		await h.view.onOpen();
		await h.view.onClose();
		h.registry.add({ ...h.registry.get("note")!, id: "unknown", displayName: "Unknown", builtIn: false, source: "user", aliases: ["legacy"] });
		await h.view.onOpen();
		assert.deepEqual(h.view.getState(), { ids: h.registry.vaultIdFormsFor(h.registry.get("unknown")!), role: undefined });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 2);
		await h.view.onClose();
		h.registry.remove("unknown");
		await h.view.onOpen();
		assert.deepEqual(h.view.getState(), { ids: ["unknown"], role: undefined });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		await h.view.onClose();
		h.index.dispose();
	});
	it("reserves one preview line for the block body when its title is long", async () => {
		const h = harness({ "a.md": `> [!note] ${"Long title ".repeat(30)}\n> Visible inner content\n> More content` });
		await h.view.onOpen();
		const lines = h.view.contentEl.querySelectorAll(".cs-occurrences-excerpt-line");
		assert.equal(lines.length, 2);
		assert.match(lines[0]!.textContent ?? "", /Long title/);
		assert.equal(lines[1]!.textContent, "> Visible inner content");
		await h.view.onClose();
		h.index.dispose();
	});
	it("does not revive or rescan a disposed index while the sidebar is still open", async () => {
		let reads = 0;
		const h = harness({ "a.md": "[!note]" }, () => { reads++; return Promise.resolve("[!note]"); });
		await h.view.onOpen();
		h.index.dispose();
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, t("usage.failed"));
		assert.equal(h.view.contentEl.querySelector('button[data-action="refresh"]'), null);
		await new Promise((resolve) => window.setTimeout(resolve, 0));
		assert.equal(reads, 1);
		assert.equal(h.index.status, "disposed");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 0);
		await h.view.onClose();
	});
});
