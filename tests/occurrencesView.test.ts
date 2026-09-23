import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setTimeout as scheduleTimer, clearTimeout as cancelTimer } from "node:timers";
import { MarkdownView, TFile, type App, type Command, type EditorPosition, type Plugin, type WorkspaceLeaf } from "obsidian";
import { CalloutOccurrencesView } from "../src/usage/CalloutOccurrencesView";
import { getCalloutOccurrenceIndex } from "../src/usage/CalloutOccurrenceIndex";
import { openCalloutOccurrences, registerOccurrencesView, refreshOccurrencesViewLocale } from "../src/usage/registerOccurrencesView";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutCombobox } from "../src/settings/calloutCombobox";
import { installFakeDom, type FakeElement } from "./support/fakeDom";

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
	const app = {
		vault: {
			getMarkdownFiles: () => files,
			getAbstractFileByPath: (path: string) => files.find((file) => file.path === path) ?? null,
			cachedRead: read ?? ((file: TFile) => Promise.resolve(contents[file.path]!)),
		},
		workspace: { requestSaveLayout: () => { layoutSaves++; } },
	} as unknown as App;
	const registry = new CalloutRegistry();
	registry.load({});
	const view = new CalloutOccurrencesView({ app } as unknown as WorkspaceLeaf, registry, busyStatusDelayMs);
	return { view, app, registry, contents, index: getCalloutOccurrenceIndex(app), savedLayouts: () => layoutSaves };
}

function action(view: CalloutOccurrencesView, name: string): HTMLButtonElement {
	const button = view.contentEl.querySelector<HTMLButtonElement>(`button[data-action="${name}"]`);
	assert.ok(button);
	return button;
}

describe("callout occurrence sidebar", () => {
	it("ignores locale refresh before registration without reading the host", () => {
		const plugin = new Proxy({}, {
			get: (_target, property) => { throw new Error(`Premature host access: ${String(property)}`); },
		}) as Plugin;
		assert.doesNotThrow(() => refreshOccurrencesViewLocale(plugin));
	});
	it("registers the view and reapplies filters when reusing the sidebar", async () => {
		const commands: Command[] = [];
		const states: unknown[] = [];
		const sides: string[] = [];
		const leaf = {
			loadIfDeferred: () => Promise.resolve(),
			setViewState: (state: unknown) => { states.push(state); return Promise.resolve(); },
		};
		const app = { workspace: {
			getLeavesOfType: () => [],
			ensureSideLeaf: (_type: string, side: string) => { sides.push(side); return Promise.resolve(leaf); },
			revealLeaf: () => Promise.resolve(),
		} } as unknown as App;
		const plugin = { app, registry: new CalloutRegistry(), registerView: () => {}, addCommand: (command: Command) => { commands.push(command); } } as unknown as Plugin & { registry: CalloutRegistry };
		registerOccurrencesView(plugin);
		refreshOccurrencesViewLocale(plugin);
		assert.deepEqual(commands, [], "the static command is owned by the built-in command registry");
		await openCalloutOccurrences(app, ["warning"], "inline");
		await openCalloutOccurrences(app, ["note"]);
		assert.deepEqual(sides, ["right", "right"]);
		assert.deepEqual(states, [
			{ type: "callout-studio-occurrences", active: true, state: { ids: ["warning"], role: "inline" } },
			{ type: "callout-studio-occurrences", active: true, state: { ids: ["note"], role: undefined } },
		]);
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
		const select = h.view.contentEl.querySelector<HTMLSelectElement>("select")!;
		select.value = "heading";
		select.focus();
		(h.view.contentEl as unknown as FakeElement).fire("change", { target: select });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
		assert.deepEqual(h.view.getState(), { ids: ["note"], role: "heading" });
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
			t("usage.summary", { count: 1, files: 1 }));
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-file h3")?.textContent,
			t("usage.fileCount", { path: "b.md", count: 1 }));
		assert.equal(h.savedLayouts(), 1);
		assert.equal(h.view.contentEl.ownerDocument.activeElement, h.view.contentEl.querySelector("select"));
		await h.view.setState({ ids: ["note", "note"], role: "regular", occurrences: ["never persist"], totalCount: 999 }, { history: false });
		assert.deepEqual(h.view.getState(), { ids: ["note"], role: "regular" });
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 100);
		await h.view.onClose();
		h.index.dispose();
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
	it("clicking results navigates files and inline columns without changing the summary", async () => {
		const contents = { "a.md": "[!note] and [!note]", "b.md": "# [!note]" };
		const h = harness(contents);
		const root = {};
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
			openFile: (file: TFile) => { view.file = file; opened.push(file.path); return Promise.resolve(); },
			loadIfDeferred: () => Promise.resolve(), setEphemeralState: () => {},
		};
		Object.assign(h.app.workspace, { rootSplit: root, getLeavesOfType: () => [], getLeaf: () => leaf });
		await h.view.onOpen();
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
			t("usage.summary", { count: 3, files: 2 }));
		for (const position of [0, 1, 0, 2]) {
			const button = h.view.contentEl.querySelector(`[data-action="result"][data-result="${position}"]`)!;
			(h.view.contentEl as unknown as FakeElement).fire("click", { target: button });
			await new Promise((resolve) => window.setTimeout(resolve, 0));
		}
		assert.deepEqual(opened, ["a.md", "a.md", "a.md", "b.md"]);
		assert.deepEqual(selected.map((item) => item.from.ch), [0, 12, 0, 2]);
		assert.equal(h.view.contentEl.querySelectorAll('[aria-current="true"]').length, 1);
		assert.equal(h.view.contentEl.querySelector(".cs-occurrences-summary")?.textContent,
			t("usage.summary", { count: 3, files: 2 }));
		await h.view.onClose();
		h.index.dispose();
	});
	it("offers registered and observed types locally, unions aliases, and keeps global metrics independent", async () => {
		const h = harness({ "a.md": "[!note] [!warning] [!caution] [!unregistered]" });
		const before = JSON.stringify(h.registry.toSaveData());
		await h.view.onOpen();
		const input = h.view.contentEl.querySelector(".cs-combobox-input") as unknown as FakeElement;
		assert.equal(input.value, "note");
		assert.equal(input.getAttribute("aria-label"), t("usage.selectType"));
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 1);
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
		assert.deepEqual(headings(), [t("usage.registeredCallouts"), t("usage.unregisteredCallouts")]);
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
		assert.deepEqual(headings(), [t("usage.registeredCallouts")]);
		search("aaa");
		assert.deepEqual(names(), ["aaa-needle"]);
		assert.deepEqual(headings(), [t("usage.unregisteredCallouts")]);
		search("no matching callout");
		assert.deepEqual(names(), []);
		assert.deepEqual(headings(), [], "empty searches leave no stranded section headings");
		await h.view.onClose();
		h.index.dispose();
	});
	it("preserves global result indices after an explicit expansion of a large result set", async () => {
		const text = Array.from({ length: 1_005 }, (_, i) => `> [!note] ${i}`).join("\n");
		const h = harness({ "a.md": text });
		const root = {};
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
		Object.assign(h.app.workspace, { rootSplit: root, getLeavesOfType: () => [], getLeaf: () => leaf });
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
		assert.equal(listenerCount(), before + 1);
		assert.equal(h.view.contentEl.querySelectorAll(".cs-occurrences-result").length, 2);
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
		const select = h.view.contentEl.querySelector<HTMLSelectElement>("select")!;
		for (const [role, count] of [["heading", 1], ["regular", 1], ["inline", 1], ["", 3]] as const) {
			select.value = role;
			(h.view.contentEl as unknown as FakeElement).fire("change", { target: select });
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
