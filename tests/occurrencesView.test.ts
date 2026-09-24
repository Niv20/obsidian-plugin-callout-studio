import { dropdownOptions, pickDropdown } from "./support/selectDropdown";
import { TestKeymap, TestScope } from "./support/fakeKeymap";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setTimeout as scheduleTimer, clearTimeout as cancelTimer } from "node:timers";
import { MarkdownView, TFile, type App, type Command, type EditorPosition, type Plugin, type WorkspaceLeaf } from "obsidian";
import { CalloutOccurrencesView } from "../src/usage/CalloutOccurrencesView";
import { getCalloutOccurrenceIndex } from "../src/usage/CalloutOccurrenceIndex";
import { openOccurrencesFromSettings } from "../src/usage/openFromSettings";
import { openCalloutOccurrences, registerOccurrencesView, refreshOccurrencesViewLocale } from "../src/usage/registerOccurrencesView";
import { registerQuickInsertRibbon } from "../src/icons/registerUiIcons";
import { QUICK_INSERT_ICON_ID, STATISTICS_ICON_ID } from "../src/icons/uiIcons";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutCombobox } from "../src/settings/calloutCombobox";
import { FakeElement, installFakeDom } from "./support/fakeDom";

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

function fileSection(view: CalloutOccurrencesView, path: string): FakeElement | null {
	return (view.contentEl.querySelectorAll(".cs-occurrences-file") as unknown as FakeElement[])
		.find((section) => section.querySelector("h3")?.textContent?.includes(path)) ?? null;
}

describe("callout occurrence sidebar", () => {
	it("gives an open format menu the first Escape and restores the host scope on rebuild and close", async () => {
		const h = harness({ "a.md": "[!note]" });
		let hostEscapes = 0;
		h.scope.register([], "Escape", () => { hostEscapes++; return false; });
		await h.view.onOpen();
		const dropdown = (): HTMLElement => h.view.contentEl.querySelector<HTMLElement>(".cs-select-dropdown")!;
		const escape = () => h.keymap.handle({ key: "Escape", preventDefault: () => {}, stopPropagation: () => {} } as KeyboardEvent);
		dropdownOptions(dropdown());
		assert.equal(h.keymap.scopes.length, 2);
		escape();
		assert.equal(hostEscapes, 0);
		assert.equal(dropdown().querySelector("input")?.getAttribute("aria-expanded"), "false");
		assert.equal(h.keymap.scopes.length, 1);
		escape();
		assert.equal(hostEscapes, 1);
		dropdownOptions(dropdown());
		h.view.refreshLabels();
		assert.equal(h.keymap.scopes.length, 1);
		dropdownOptions(dropdown());
		await h.view.onClose();
		assert.equal(h.keymap.scopes.length, 1);
		h.index.dispose();
	});
	it("ignores locale refresh before registration without reading the host", () => {
		const plugin = new Proxy({}, {
			get: (_target, property) => { throw new Error(`Premature host access: ${String(property)}`); },
		}) as Plugin;
		assert.doesNotThrow(() => refreshOccurrencesViewLocale(plugin));
	});
	it("opens general browsing with all types and formats, and Find usages with its type and all formats", async () => {
		const commands: Command[] = [];
		const states: unknown[] = [];
		const sides: string[] = [];
		const leaf = {
			loadIfDeferred: () => Promise.resolve(),
			setViewState: (state: unknown) => { states.push(state); return Promise.resolve(); },
		};
		const app = { setting: { close: () => {} }, workspace: {
			getLeavesOfType: () => [],
			ensureSideLeaf: (_type: string, side: string) => { sides.push(side); return Promise.resolve(leaf); },
			revealLeaf: () => Promise.resolve(),
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
		assert.deepEqual(states, [
			{ type: "callout-studio-occurrences", active: true, state: { ids: ["warning"], role: "inline" } },
			{ type: "callout-studio-occurrences", active: true, state: { allTypes: true, role: undefined } },
			{ type: "callout-studio-occurrences", active: true, state: { ids: ["note"], role: undefined } },
			{ type: "callout-studio-occurrences", active: true, state: { allTypes: true, role: undefined } },
		]);
	});
	it("keeps the native right sidebar tab as the only occurrences toggle", () => {
		const h = harness({ "a.md": "[!note]" });
		const ribbonIcons: string[] = [];
		const plugin = {
			app: h.app,
			openQuickInsert: () => {},
			addRibbonIcon: (icon: string) => { ribbonIcons.push(icon); },
		} as unknown as Plugin & { openQuickInsert(): void };
		registerQuickInsertRibbon(plugin);
		assert.deepEqual(ribbonIcons, [QUICK_INSERT_ICON_ID]);
		assert.equal(h.view.getIcon(), STATISTICS_ICON_ID, "the occurrences tab keeps its own native icon");
		h.index.dispose();
	});
	it("keeps quick scans quiet without showing an authoritative zero", async () => {
		let release: (text: string) => void = () => {};
		const wait = new Promise<string>((resolve) => { release = resolve; });
		const h = harness({ "a.md": "[!note]" }, () => wait);
		const opened = h.view.onOpen();
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent, "");
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-status")?.textContent, "");
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-metric-value")?.textContent, "—");
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
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-file h3")?.textContent,
			t("usage.fileCount", { path: "a.md", count: 105 }), "file count covers unloaded results too");
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
			t("usage.summary", { count: 107, files: 2 }));
		(h.view.contentEl as unknown as FakeElement).fire("click", { target: action(h.view, "more") });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 107);
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-file").length, 2);
		assert.deepEqual(Array.from(h.view.contentEl.querySelectorAll(".cs-occurrences-file h3"), (node) => node.textContent), [
			t("usage.fileCount", { path: "a.md", count: 105 }), t("usage.fileCount", { path: "b.md", count: 2 }),
		]);
		const formatInput = h.view.contentEl.querySelector(".cs-select-dropdown .cs-combobox-input") as unknown as FakeElement;
		assert.ok(formatInput);
		assert.equal(formatInput.readOnly, true);
		assert.equal(formatInput.value, t("usage.allRoles"));
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-controls select"), null);
		formatInput.focus();
		const formatRows = dropdownOptions(h.view.contentEl.querySelector<HTMLElement>(".cs-select-dropdown")!);
		assert.deepEqual(formatRows.map((row) => row.textContent), [
			t("usage.allRoles"), t("vaultStats.roleBlock"), t("vaultStats.roleHeading"), t("vaultStats.roleInline"),
		]);
		formatRows[2]!.fire("mouseenter");
		assert.ok(formatRows[2]!.classList.contains("is-active"));
		formatRows[2]!.fire("click");
		assert.equal(formatInput.value, t("vaultStats.roleHeading"));
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		assert.deepEqual(h.view.getState(), { ids: [], role: "heading", allTypes: true });
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
			t("usage.summary", { count: 1, files: 1 }));
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-file h3")?.textContent,
			t("usage.fileCount", { path: "b.md", count: 1 }));
		assert.equal(h.savedLayouts(), 1);
		assert.equal(h.view.contentEl.ownerDocument.activeElement, formatInput);
		h.view.contentEl.scrollTop = 180;
		await h.view.setState({ ids: ["note", "note"], role: "regular", occurrences: ["never persist"], totalCount: 999 }, { history: false });
		assert.deepEqual(h.view.getState(), { ids: ["note"], role: "regular" });
		assert.equal(h.view.contentEl.scrollTop, 0, "opening another view state begins at the top");
		assert.equal(formatInput.value, t("vaultStats.roleBlock"));
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
		assert.equal(input.value, t("usage.allTypes"));
		assert.equal((h.view.contentEl.querySelector(".cs-select-dropdown .cs-combobox-input") as HTMLInputElement).value,
			t("usage.allRoles"));
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 4);
		input.fire("focus");
		const allTypes = h.view.contentEl.querySelector(".cs-combobox-iconless-option") as unknown as FakeElement;
		assert.ok(allTypes);
		assert.equal(allTypes.textContent, t("usage.allTypes"));
		assert.equal(allTypes.querySelector(".callout-studio-suggestion-icon"), null);
		assert.equal(h.view.contentEl.querySelector(".cs-combobox-group-label")?.textContent, t("usage.browse"));
		allTypes.fire("click");
		assert.deepEqual(h.view.getState(), { ids: [], role: undefined, allTypes: true });
		assert.equal(input.value, t("usage.allTypes"));
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 4);
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-file").length, 3);
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
			t("usage.summary", { count: 4, files: 3 }));

		const formatInput = h.view.contentEl.querySelector(".cs-select-dropdown .cs-combobox-input") as unknown as FakeElement;
		pickDropdown(h.view.contentEl.querySelector<HTMLElement>(".cs-select-dropdown")!, t("vaultStats.roleHeading"));
		assert.deepEqual(h.view.getState(), { ids: [], role: "heading", allTypes: true });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		await h.view.setState({ ids: ["warning"], role: undefined }, { history: false });
		assert.deepEqual(h.view.getState(), { ids: h.registry.vaultIdFormsFor(h.registry.get("warning")!), role: undefined });
		assert.equal(input.value, "warning");
		assert.equal(formatInput.value, t("usage.allRoles"), "Find usages clears a previous format filter");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		await h.view.setState({ ids: [], role: undefined, allTypes: true }, { history: false });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 4);
		assert.equal(input.value, t("usage.allTypes"), "restoring the scope keeps its visible selection");

		input.fire("focus");
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
			input.fire("focus");
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
			assert.equal(h.view.contentEl.scrollTop, 0);
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
			h.view.contentEl.scrollTop = 240;
			typeInput.fire("focus");
			typeInput.value = "note";
			typeInput.fire("input");
			const note = h.view.contentEl.querySelector(".cs-occurrences-picker .cs-combobox-option") as unknown as FakeElement;
			assert.ok(note);
			note.fire("click");
			assert.deepEqual(h.view.getState(), { ids: ["note"], role: undefined });
			assert.equal(h.view.contentEl.scrollTop, 240, "choosing a type keeps the sidebar near the choice");
			assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 100);
			assert.equal(fileSection(h.view, "z.md"), null);
			assert.deepEqual(scrolled, []);

			h.view.contentEl.scrollTop = 300;
			pickDropdown(h.view.contentEl.querySelector<HTMLElement>(".cs-select-dropdown")!, t("vaultStats.roleBlock"));
			assert.deepEqual(h.view.getState(), { ids: ["note"], role: "regular" });
			assert.equal(h.view.contentEl.scrollTop, 300, "choosing a format keeps the sidebar near the choice");
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
	it("clicking results navigates files and inline columns without moving their sidebar cards", async () => {
		const contents = { "a.md": "[!note] and [!note]", "b.md": "# [!note]" };
		const h = harness(contents);
		h.activateFile("a.md");
		const root = h.app.workspace.rootSplit;
		const selected: Array<{ path: string; from: EditorPosition }> = [];
		const opened: string[] = [];
		const view = new MarkdownView({} as WorkspaceLeaf);
		Object.assign(view, {
			editor: {
				getValue: () => contents[view.file!.path as keyof typeof contents],
				setSelection: (from: EditorPosition) => { selected.push({ path: view.file!.path, from }); },
				scrollIntoView: () => {}, focus: () => {},
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
				h.view.contentEl.scrollTop = 999;
			}
		};
		try {
			await h.view.onOpen();
			assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
				t("usage.summary", { count: 3, files: 2 }));
			h.view.contentEl.scrollTop = 240;
			for (const position of [0, 1, 0, 2]) {
				const button = h.view.contentEl.querySelector(`[data-action="result"][data-result="${position}"]`)!;
				(h.view.contentEl as unknown as FakeElement).fire("click", { target: button });
				await new Promise((resolve) => window.setTimeout(resolve, 0));
				assert.equal(h.view.contentEl.querySelector(`[data-result="${position}"]`), button,
					"selecting a result updates its existing card without rebuilding the list");
				assert.equal(h.view.contentEl.scrollTop, 240, `result ${position} stays at its original scroll offset`);
				assert.deepEqual(scrolled, [], "result navigation must not reveal its file heading");
			}
			assert.deepEqual(opened, ["a.md", "a.md", "a.md", "b.md"]);
			assert.deepEqual(selected.map((item) => item.from.ch), [0, 12, 0, 2]);
			assert.equal(h.view.contentEl.querySelectorAll('[aria-current="true"]').length, 1);
			assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
				t("usage.summary", { count: 3, files: 2 }));
			h.activateFile("b.md");
			assert.equal(h.view.contentEl.scrollTop, 240, "a delayed activation of the clicked file keeps the card in place");
			assert.deepEqual(scrolled, []);
			const file = h.app.vault.getAbstractFileByPath("a.md");
			assert.ok(file instanceof TFile);
			view.file = file;
			h.activateFile("a.md");
			assert.deepEqual(scrolled, [fileSection(h.view, "a.md")], "a later direct tab switch still reveals its file");
			assert.equal(h.view.contentEl.querySelector('[aria-current="true"]'), null,
				"the previous file's card must not remain selected beneath the new active heading");
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
			Object.assign(editorView, { editor: {
				getValue: () => "[!note]", setSelection: () => { selected = true; },
				scrollIntoView: () => {}, focus: () => {},
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
	it("offers registered and observed types locally, unions aliases, and keeps global metrics independent", async () => {
		const h = harness({ "a.md": "[!note] [!warning] [!caution] [!unregistered]" });
		const before = JSON.stringify(h.registry.toSaveData());
		await h.view.onOpen();
		const input = h.view.contentEl.querySelector(".cs-combobox-input") as unknown as FakeElement;
		assert.equal(input.value, t("usage.allTypes"));
		assert.equal(input.getAttribute("aria-label"), null);
		const labelId = input.getAttribute("aria-labelledby");
		assert.equal(h.view.contentEl.querySelector(`#${labelId}`)?.textContent, t("usage.selectType"));
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 4);
		assert.deepEqual(Array.from(h.view.contentEl.querySelectorAll(".cs-occurrences-metric-value"), (node) => node.textContent), ["4", "4", "1", "1"]);
		input.fire("focus");
		input.value = "caution";
		input.fire("input");
		const row = h.view.contentEl.querySelector(".cs-combobox-option") as unknown as FakeElement;
		assert.ok(row);
		row.fire("click");
		assert.equal(input.value, "warning");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 2);
		assert.deepEqual(h.view.getState(), { ids: h.registry.vaultIdFormsFor(h.registry.get("warning")!), role: undefined });
		assert.equal(h.savedLayouts(), 1);
		input.fire("focus");
		input.value = "unregistered";
		input.fire("input");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-combobox-option").length, 1);
		(h.view.contentEl.querySelector(".cs-combobox-option") as unknown as FakeElement).fire("click");
		assert.equal(input.value, "unregistered");
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
		settingsInput.fire("focus");
		assert.equal(settingsHost.querySelectorAll(".cs-combobox-group-label").length, 0, "ordinary callout pickers keep their ungrouped presentation");
		settingsInput.value = "unregistered";
		settingsInput.fire("input");
		assert.equal(settingsHost.querySelectorAll(".cs-combobox-option").length, 0, "shared settings choices remain registry-only");
		settingsPicker.destroy();
		settingsHost.remove();
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-id"), null);
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-query"), null);
		assert.equal(h.view.contentEl.querySelector('button[data-action="refresh"]'), null);
		assert.ok(h.view.contentEl.querySelector("hr"));
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
		input.fire("focus");
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
		input.fire("focus");
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
			input.fire("focus");
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
		Object.assign(editorView, { editor: {
			getValue: () => text,
			setSelection: (from: EditorPosition) => { selectedLines.push(from.line); },
			scrollIntoView: () => {}, focus: () => {},
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
		input.fire("focus");
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
		assert.equal(listenerCount(), before + 2, "both stable pickers retain one outside-click listener");
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 3);
		await h.view.onClose();
		assert.equal(listenerCount(), before);
		await h.view.onOpen();
		assert.equal(listenerCount(), before + 2);
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
		assert.equal((h.view.contentEl.querySelector(".cs-combobox-input") as HTMLInputElement).value, "warning");
		await h.view.setState({ ids: ["custom"] }, { history: false });
		assert.equal((h.view.contentEl.querySelector(".cs-combobox-input") as HTMLInputElement).value, "custom");
		h.registry.remove("custom");
		assert.equal((h.view.contentEl.querySelector(".cs-combobox-input") as HTMLInputElement).value, "custom");
		assert.deepEqual(h.view.getState(), { ids: ["custom"], role: undefined });
		h.contents["a.md"] = "[!note] [!warning]";
		h.index.invalidate("a.md");
		await h.index.ensureFresh();
		assert.equal((h.view.contentEl.querySelector(".cs-combobox-input") as HTMLInputElement).value, "custom");
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
		assert.equal((h.view.contentEl.querySelector(".cs-combobox-input") as HTMLInputElement).value, "unknown type");
		release(text);
		await opened;
		const select = h.view.contentEl.querySelector<HTMLElement>(".cs-select-dropdown")!;
		for (const [role, count] of [["heading", 1], ["regular", 1], ["inline", 1], ["", 3]] as const) {
			pickDropdown(select, t({ "": "usage.allRoles", regular: "vaultStats.roleBlock", heading: "vaultStats.roleHeading", inline: "vaultStats.roleInline" }[role]));
			assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, count);
			assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
				t("usage.summary", { count, files: 1 }));
		}
		assert.equal(changes, 0);
		assert.equal(JSON.stringify(h.registry.toSaveData()), before);
		await h.view.onClose();
		h.index.dispose();
	});
	it("refreshes an unknown selection's appearance and aliases when it is registered without losing a typed query", async () => {
		const h = harness({ "a.md": "[!unknown] [!legacy]" });
		await h.view.setState({ ids: ["unknown"] }, { history: false });
		await h.view.onOpen();
		const input = h.view.contentEl.querySelector(".cs-combobox-input") as unknown as FakeElement;
		input.fire("focus");
		input.value = "lea";
		input.fire("input");
		h.registry.add({ ...h.registry.get("note")!, id: "unknown", displayName: "Unknown", builtIn: false, source: "user", aliases: ["legacy"], colorLight: "#123456", colorDark: "#123456" });
		assert.equal(input.value, "lea");
		assert.equal(input.getAttribute("aria-expanded"), "true");
		assert.equal(h.view.contentEl.querySelector<HTMLElement>(".cs-combobox-lead")?.style.color, "#123456");
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
