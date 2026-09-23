import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { MarkdownView, type App, type Plugin, type TFile, type WorkspaceLeaf } from "obsidian";
import { getCalloutOccurrenceIndex } from "../src/usage/CalloutOccurrenceIndex";
import { registerOccurrenceIndex } from "../src/usage/registerOccurrenceIndex";
import { deferred, occurrenceVault } from "./occurrenceIndexHarness";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
before(() => { Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis }); });
after(() => {
	if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

function editorHarness(initial: Record<string, string>) {
	const h = occurrenceVault(initial);
	for (const file of h.files.values()) file.extension = "md";
	const views: MarkdownView[] = [];
	let active: MarkdownView | null = null;
	let bufferReads = 0;
	const events = new Map<string, (...args: unknown[]) => void>();
	const disposers: Array<() => void> = [];
	h.app.workspace = {
		getLeavesOfType: () => views.map((view) => ({ view })),
		getActiveViewOfType: () => active,
		on: (name: string, cb: (...args: unknown[]) => void) => { events.set(name, cb); return {}; },
	} as unknown as App["workspace"];
	h.app.vault.on = ((name: string, cb: (...args: unknown[]) => void) => {
		events.set(name, cb); return {};
	}) as typeof h.app.vault.on;
	function open(file: TFile, initialText: string) {
		let text = initialText;
		const view = Object.assign(new MarkdownView({} as WorkspaceLeaf), { file, editor: {
			getValue: () => { bufferReads++; return text; },
		} });
		views.push(view);
		active = view;
		return { view, edit: (next: string) => { text = next; }, close: () => {
			views.splice(views.indexOf(view), 1); if (active === view) active = null;
		} };
	}
	const plugin = { app: h.app, registerEvent() {}, register: (cb: () => void) => disposers.push(cb) } as unknown as Plugin;
	return { ...h, open, plugin, events, get bufferReads() { return bufferReads; },
		blur: () => { active = null; }, dispose: () => disposers.forEach((cb) => cb()) };
}

async function settle(): Promise<void> {
	for (let i = 0; i < 30; i++) await Promise.resolve();
}

describe("live editor occurrence source", () => {
	it("uses unsaved open text on first request, without writing source or registering types", async () => {
		const h = editorHarness({ "a.md": "[!saved]", "b.md": "[!closed]" });
		h.open(h.files.get("a.md")!, "[!unregistered] [!unregistered]");
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		assert.equal(index.query(["saved"]).totalCount, 0);
		assert.equal(index.query(["unregistered"]).totalCount, 2);
		assert.deepEqual(h.reads, ["b.md"]);
		assert.equal(h.contents.get("a.md"), "[!saved]");
		index.dispose();
	});

	it("keeps prior rows during typing and lets the editor override a delayed save event", async () => {
		const h = editorHarness({ "a.md": "[!saved]" });
		const editor = h.open(h.files.get("a.md")!, "[!first]");
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		editor.edit("[!latest] [!latest]");
		index.invalidateEditor("a.md");
		assert.equal(index.query(["first"]).totalCount, 1, "prior rows remain while updating");
		h.put("a.md", "[!first]");
		index.invalidate("a.md");
		await index.ensureFresh();
		assert.equal(index.query(["latest"]).totalCount, 2);
		assert.deepEqual(h.reads, []);
		index.dispose();
	});

	it("discards an earlier editor snapshot when another edit arrives during a later file read", async () => {
		const h = editorHarness({ "a.md": "[!disk]", "b.md": "[!b]" });
		const editor = h.open(h.files.get("a.md")!, "[!first]");
		const gate = deferred<string>();
		h.held.set("b.md", gate.promise);
		const index = getCalloutOccurrenceIndex(h.app);
		const first = index.ensureFresh();
		while (!h.reads.includes("b.md")) await Promise.resolve();
		editor.edit("[!latest]");
		index.invalidateEditor("a.md");
		gate.resolve("[!b]");
		await first;
		assert.equal(index.query(["first"]).totalCount, 0);
		await index.ensureFresh();
		assert.equal(index.query(["latest"]).totalCount, 1);
		index.dispose();
	});

	it("returns to saved text after closing and follows a reused leaf to another file", async () => {
		const h = editorHarness({ "a.md": "[!saved]", "b.md": "[!other]" });
		const editor = h.open(h.files.get("a.md")!, "[!buffer]");
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		editor.view.file = h.files.get("b.md")!;
		editor.edit("[!second-buffer]");
		index.editorsChanged();
		await index.ensureFresh();
		assert.equal(index.query(["buffer"]).totalCount, 0);
		assert.equal(index.query(["saved"]).totalCount, 1);
		assert.equal(index.query(["second-buffer"]).totalCount, 1);
		editor.close();
		index.editorsChanged();
		await index.ensureFresh();
		assert.equal(index.query(["second-buffer"]).totalCount, 0);
		assert.equal(index.query(["other"]).totalCount, 1);
		index.dispose();
	});

	it("uses the active editor if two leaves briefly have different text and avoids duplicate rows", async () => {
		const h = editorHarness({ "a.md": "[!saved]" });
		h.open(h.files.get("a.md")!, "[!older]");
		h.open(h.files.get("a.md")!, "[!active]");
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		assert.equal(index.query().totalCount, 1);
		assert.equal(index.query(["active"]).totalCount, 1);
		index.dispose();
	});
	it("keeps the last edited split authoritative after focus moves to the sidebar", async () => {
		const h = editorHarness({ "a.md": "[!saved]" });
		const first = h.open(h.files.get("a.md")!, "[!first]");
		h.open(h.files.get("a.md")!, "[!stale-other-view]");
		const index = getCalloutOccurrenceIndex(h.app);
		first.edit("[!latest]");
		index.trackEditorChange(first.view.file, first.view.editor);
		h.blur();
		await index.ensureFresh();
		assert.equal(index.query(["latest"]).totalCount, 1);
		assert.equal(index.query(["stale-other-view"]).totalCount, 0);
		index.dispose();
	});

	it("does not invalidate data or read buffers on unrelated workspace layout events", async () => {
		const h = editorHarness({ "a.md": "[!saved]" });
		h.open(h.files.get("a.md")!, "[!buffer]");
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		const revision = index.revision, dataRevision = index.dataRevision, reads = h.bufferReads;
		index.editorsChanged(); index.editorsChanged();
		assert.equal(index.revision, revision);
		assert.equal(h.bufferReads, reads);
		index.invalidateEditor("a.md"); index.invalidateEditor("a.md");
		assert.equal(index.dataRevision, dataRevision, "typing reuses query data until the next scan publishes");
		index.dispose();
	});

	it("keeps rows through a canceled live refresh and publishes the next complete buffer", async () => {
		const h = editorHarness({ "a.md": "[!disk]", "b.md": "[!b]" });
		const editor = h.open(h.files.get("a.md")!, "[!original]");
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		const gate = deferred<string>(); h.held.set("b.md", gate.promise);
		index.invalidate("b.md");
		editor.edit("[!middle]"); index.invalidateEditor("a.md");
		const pass = index.ensureFresh();
		while (h.reads.filter((path) => path === "b.md").length < 2) await Promise.resolve();
		editor.edit("[!latest] [!latest]"); index.invalidateEditor("a.md");
		gate.resolve("[!b]"); await pass;
		assert.equal(index.status, "stale");
		assert.equal(index.query(["original"]).totalCount, 1, "canceled replacement retains previous visible rows");
		h.held.clear(); await index.ensureFresh();
		assert.equal(index.query(["latest"]).totalCount, 2);
		assert.equal(index.query(["original"]).totalCount, 0);
		index.dispose();
	});

});

describe("automatic occurrence refresh lifecycle", () => {
	it("debounces buffer reads, automatically refreshes explicit invalidation, and cancels timers on unload", async (context) => {
		const callbacks = new Map<number, () => void>();
		let nextTimer = 0;
		context.mock.method(window, "setTimeout", (cb: () => void) => { callbacks.set(++nextTimer, cb); return nextTimer; });
		context.mock.method(window, "clearTimeout", (id: number) => { callbacks.delete(id); });
		const h = editorHarness({ "a.md": "[!disk]" });
		const editor = h.open(h.files.get("a.md")!, "[!initial]");
		registerOccurrenceIndex(h.plugin);
		const index = getCalloutOccurrenceIndex(h.app);
		assert.equal(h.bufferReads, 0);
		await index.ensureFresh();
		const reads = h.bufferReads;
		for (let n = 0; n < 5; n++) {
			editor.edit(`[!update-${n}]`);
			h.events.get("editor-change")!(editor.view.editor, editor.view);
		}
		assert.equal(h.bufferReads, reads, "keystrokes never read the entire buffer");
		assert.equal(callbacks.size, 1);
		let callback = [...callbacks.values()][0]!;
		callbacks.clear(); callback(); await settle();
		assert.equal(index.query(["update-4"]).totalCount, 1);
		editor.edit("[!navigation-refresh]");
		index.invalidate("a.md");
		assert.equal(callbacks.size, 1, "navigation invalidation schedules its own refresh");
		callback = [...callbacks.values()][0]!;
		callbacks.clear(); callback(); await settle();
		assert.equal(index.query(["navigation-refresh"]).totalCount, 1);
		h.events.get("editor-change")!(editor.view.editor, editor.view);
		h.dispose();
		assert.equal(callbacks.size, 0);
		assert.equal(index.status, "disposed");
	});

	it("does not keep retrying unreadable files without another source change", async (context) => {
		const callbacks = new Map<number, () => void>();
		let nextTimer = 0;
		context.mock.method(window, "setTimeout", (cb: () => void) => { callbacks.set(++nextTimer, cb); return nextTimer; });
		context.mock.method(window, "clearTimeout", (id: number) => { callbacks.delete(id); });
		const h = editorHarness({ "a.md": "[!a]" });
		registerOccurrenceIndex(h.plugin);
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		h.failures.add("a.md");
		index.invalidate("a.md");
		const callback = [...callbacks.values()][0]!;
		callbacks.clear(); callback(); await settle();
		assert.equal(index.status, "partial");
		assert.equal(callbacks.size, 0);
		h.dispose();
	});
	it("follows another change arriving during its retry without losing the newest source", async (context) => {
		const callbacks = new Map<number, () => void>();
		let nextTimer = 0;
		context.mock.method(window, "setTimeout", (cb: () => void) => { callbacks.set(++nextTimer, cb); return nextTimer; });
		context.mock.method(window, "clearTimeout", (id: number) => { callbacks.delete(id); });
		const h = editorHarness({ "a.md": "[!initial]" });
		registerOccurrenceIndex(h.plugin);
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		const gate = deferred<string>();
		h.held.set("a.md", gate.promise);
		index.invalidate("a.md");
		const runTimer = async (): Promise<void> => {
			const callback = [...callbacks.values()][0]!;
			callbacks.clear(); callback(); await settle();
		};
		await runTimer();
		h.put("a.md", "[!second]"); index.invalidate("a.md");
		await runTimer(); // The event joins the pending initial pass.
		gate.resolve("[!initial]"); await settle();
		const secondGate = deferred<string>(); h.held.set("a.md", secondGate.promise);
		await runTimer();
		h.put("a.md", "[!third]"); index.invalidate("a.md");
		await runTimer(); // Another event joins the retry while it is still reading.
		secondGate.resolve("[!second]"); await settle(); h.held.clear();
		await runTimer();
		assert.equal(index.status, "ready");
		assert.equal(index.query(["third"]).totalCount, 1);
		assert.equal(callbacks.size, 0);
		h.dispose();
	});

	it("keeps dormant editor tracking read-free and auto-save preserves the previous visible count", async () => {
		const h = editorHarness({ "a.md": "[!disk]" });
		const editor = h.open(h.files.get("a.md")!, "[!buffer]");
		registerOccurrenceIndex(h.plugin);
		const index = getCalloutOccurrenceIndex(h.app);
		h.events.get("editor-change")!(editor.view.editor, editor.view);
		editor.close(); h.events.get("layout-change")!();
		assert.equal(index.status, "idle");
		assert.equal(h.bufferReads, 0);
		assert.equal(h.reads.length, 0);
		await index.ensureFresh();
		h.put("a.md", "[!saved-later]");
		h.events.get("modify")!(h.files.get("a.md")!);
		assert.equal(index.query(["disk"]).totalCount, 1);
		assert.equal(index.status, "stale");
		h.dispose();
	});

});
