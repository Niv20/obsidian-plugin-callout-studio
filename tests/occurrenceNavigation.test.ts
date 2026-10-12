import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setTimeout as scheduleTimer } from "node:timers";
import { MarkdownView, Platform, TFile, type App, type EditorPosition, type WorkspaceLeaf } from "obsidian";
import { scanCalloutOccurrences } from "../src/usage/scanCalloutOccurrences";
import { navigateToCalloutOccurrence, resolveOccurrencePosition } from "../src/usage/navigation";
import { t } from "../src/i18n";
import { navigateToSidebarFile } from "../src/ui/sidebarNavigation";

Object.assign(globalThis, { window: {
	setTimeout: (callback: () => void, delay: number) => Number(scheduleTimer(callback, delay)),
} });

const original = "Before [!warning|orange] and [!warning] after";
const saved = () => scanCalloutOccurrences("note.md", original)[1]!;

describe("occurrence position validation", () => {
	it("selects the right inline occurrence and preserves metadata widths", () => {
		const occurrence = saved();
		const found = resolveOccurrencePosition(occurrence, original);
		assert.equal(found?.from, original.lastIndexOf("[!warning]"));
		const first = scanCalloutOccurrences("note.md", original)[0]!;
		assert.equal(first.lineText.slice(first.from, first.to), "[!warning|orange]");
	});
	it("remaps a unique unchanged line while retaining its exact column", () => {
		const found = resolveOccurrencePosition(saved(), `Added\nAnother\n${original}`);
		assert.equal(found?.line, 2);
		assert.equal(found?.from, saved().from);
	});
	it("rejects ambiguous moved lines, edited lines and deleted occurrences", () => {
		assert.equal(resolveOccurrencePosition(saved(), `Added\n${original}\n${original}`), null);
		assert.equal(resolveOccurrencePosition(saved(), `${original}!`), null);
		assert.equal(resolveOccurrencePosition(saved(), "No callout"), null);
	});
	it("rejects an inserted duplicate even when it occupies the old coordinates", () => {
		assert.equal(resolveOccurrencePosition(saved(), `${original}\n${original}`), null);
	});
	it("retains exact coordinates for repeated lines in an unchanged source snapshot", () => {
		const content = `${original}\n${original}`;
		for (const occurrence of scanCalloutOccurrences("note.md", content)) {
			const found = resolveOccurrencePosition(occurrence, content);
			assert.equal(found?.line, occurrence.line);
			assert.equal(found?.from, occurrence.from);
		}
	});
	it("rechecks whole-document exclusion context even if the source line is unchanged", () => {
		assert.equal(resolveOccurrencePosition(saved(), `%%\n${original}\n%%`), null);
		assert.equal(resolveOccurrencePosition(saved(), `\`\`\`\n${original}\n\`\`\``), null);
	});
});

function navigationHarness(content = original, mode: "source" | "preview" = "source") {
	const file = Object.assign(new TFile(), { path: "note.md" });
	const root = {};
	const side = {};
	const selections: Array<[EditorPosition, EditorPosition | undefined]> = [];
	const scrolled: Array<{ from: EditorPosition; to: EditorPosition }> = [];
	const scrolledTo: Array<[number | null | undefined, number | null | undefined]> = [];
	const activations: unknown[] = [];
	const collapsed: string[] = [];
	const requestedLeaves: unknown[] = [];
	const opened: unknown[] = [];
	const ephemeral: unknown[] = [];
	let focus = 0;
	let deferredLoaded = false;
	const view = Object.assign(new MarkdownView({} as WorkspaceLeaf), {
		file,
		getMode: () => mode,
		editor: {
			getValue: () => content,
			setSelection: (from: EditorPosition, to?: EditorPosition) => { selections.push([from, to]); },
			scrollIntoView: (range: { from: EditorPosition; to: EditorPosition }) => { scrolled.push(range); },
			scrollTo: (x?: number | null, y?: number | null) => { scrolledTo.push([x, y]); },
			focus: () => { focus++; },
		},
	});
	const documentLeaf = {
		view, getRoot: () => root,
		openFile: (_file: TFile, state: unknown) => { opened.push(state); return Promise.resolve(); },
		loadIfDeferred: () => { deferredLoaded = true; return Promise.resolve(); },
		setEphemeralState: (state: unknown) => { ephemeral.push(state); },
	};
	const sidebarLeaf = { getRoot: () => side, openFile: () => { throw new Error("Must not replace sidebar"); } };
	let activeView: MarkdownView | null = view;
	let recentLeaf: WorkspaceLeaf | null = documentLeaf as unknown as WorkspaceLeaf;
	const drawer = (name: string) => ({ collapsed: false, collapse() { collapsed.push(name); this.collapsed = true; } });
	const app = {
		vault: { getAbstractFileByPath: () => file },
		workspace: {
			rootSplit: root,
			leftSplit: drawer("left"),
			rightSplit: drawer("right"),
			setActiveLeaf: (_leaf: unknown, params: unknown) => { activations.push(params); },
			getLeavesOfType: () => [],
			getActiveViewOfType: () => activeView,
			getMostRecentLeaf: () => recentLeaf,
			getLeaf: (mode: unknown) => { requestedLeaves.push(mode); return mode === "tab" ? documentLeaf : sidebarLeaf; },
		},
	} as unknown as App;
	return { app, view, documentLeaf, selections, opened, requestedLeaves, ephemeral, scrolled, scrolledTo, activations, collapsed,
		activate: (active: MarkdownView | null, leaf?: WorkspaceLeaf | null) => {
			activeView = active;
			if (leaf !== undefined) recentLeaf = leaf;
		},
		focused: () => focus, loaded: () => deferredLoaded };
}

describe("occurrence navigation", () => {
	it("opens file headings at the top without moving the caret and honors a new tab", async () => {
		const h = navigationHarness();
		assert.equal(await navigateToSidebarFile(h.app, "note.md", { newTab: true }), true);
		assert.deepEqual(h.scrolledTo, [[null, 0]]);
		assert.deepEqual(h.selections, []);
		assert.deepEqual(h.requestedLeaves, ["tab"]);
		assert.deepEqual(h.ephemeral, []);
		assert.equal(h.focused(), 0);
	});
	it("opens a document leaf, resolves against the current buffer and scrolls without selecting", async () => {
		const h = navigationHarness(`Unsaved line\n${original}`);
		h.activate(h.view, null);
		assert.equal(await navigateToCalloutOccurrence(h.app, saved()), true);
		assert.deepEqual(h.requestedLeaves, [false, "tab"]);
		assert.deepEqual(h.opened, [{ active: false, state: { mode: "source" } }]);
		assert.deepEqual(h.activations, [{ focus: false }], "activated without core's focusLeaf");
		assert.equal(h.loaded(), true);
		// Head before anchor, so a callout taller than the editor aligns by its top.
		assert.deepEqual(h.scrolled, [{ from: { line: 1, ch: saved().to }, to: { line: 1, ch: saved().from } }]);
		assert.deepEqual(h.selections, [], "a caret in the callout would show its raw Markdown");
		assert.deepEqual(h.ephemeral, [], "setEphemeralState({ line }) moves the caret too");
		assert.equal(h.focused(), 0, "focusing the editor raises the iOS keyboard");
		assert.deepEqual(h.collapsed, []);
	});
	it("opens a pane in Reading view in the vault's default editing mode, and leaves an editing pane as it is", async () => {
		const reading = navigationHarness(original, "preview");
		assert.equal(await navigateToCalloutOccurrence(reading.app, saved()), true);
		assert.deepEqual(reading.opened, [{ active: false, state: { mode: "source", source: false } }],
			"without `source`, core restores whatever the pane last edited in");
		const sourceDefault = navigationHarness(original, "preview");
		Object.assign(sourceDefault.app.vault, { getConfig: (key: string) => key === "livePreview" ? false : undefined });
		assert.equal(await navigateToCalloutOccurrence(sourceDefault.app, saved()), true);
		assert.deepEqual(sourceDefault.opened, [{ active: false, state: { mode: "source", source: true } }]);
		const editing = navigationHarness(original, "source");
		Object.assign(editing.app.vault, { getConfig: () => false });
		assert.equal(await navigateToCalloutOccurrence(editing.app, saved()), true);
		assert.deepEqual(editing.opened, [{ active: false, state: { mode: "source" } }]);
	});
	it("honors a new-tab request", async () => {
		const h = navigationHarness();
		assert.equal(await navigateToCalloutOccurrence(h.app, saved(), { newTab: true }), true);
		assert.deepEqual(h.requestedLeaves, ["tab"]);
	});
	it("closes the sidebar's own drawer on a phone or tablet, and nothing else", async () => {
		const mobile = Platform.isMobile;
		try {
			Platform.isMobile = true;
			for (const side of ["left", "right", "main"] as const) {
				const h = navigationHarness();
				const workspace = h.app.workspace as unknown as Record<string, unknown>;
				const origin = { getRoot: () => side === "main" ? workspace.rootSplit : workspace[`${side}Split`] } as unknown as WorkspaceLeaf;
				assert.equal(await navigateToCalloutOccurrence(h.app, saved(), { origin }), true);
				assert.deepEqual(h.collapsed, side === "main" ? [] : [side]);
			}
			Platform.isMobile = false;
			const h = navigationHarness();
			const origin = { getRoot: () => h.app.workspace.rightSplit } as unknown as WorkspaceLeaf;
			assert.equal(await navigateToCalloutOccurrence(h.app, saved(), { origin }), true);
			assert.deepEqual(h.collapsed, [], "a desktop sidebar stays open");
		} finally { Platform.isMobile = mobile; }
	});
	it("rejects edits that land while an asynchronous scan is in progress", async () => {
		const h = navigationHarness(original);
		let reads = 0;
		h.view.editor.getValue = () => ++reads === 1 ? original : `${original}\nchanged`;
		assert.equal(await navigateToCalloutOccurrence(h.app, saved()), false);
		assert.deepEqual(h.scrolled, []);
	});
	it("yields during navigation in a large note instead of blocking until it scrolls", async () => {
		const content = `${"plain text\n".repeat(1500)}${original}`;
		const occurrences = scanCalloutOccurrences("note.md", content);
		const occurrence = occurrences[occurrences.length - 1]!;
		const h = navigationHarness(content);
		let yieldedBeforeSelection = false;
		const checkpoint = new Promise<void>((resolve) => window.setTimeout(() => {
			yieldedBeforeSelection = h.scrolled.length === 0;
			resolve();
		}, 0));
		assert.equal(await navigateToCalloutOccurrence(h.app, occurrence), true);
		await checkpoint;
		assert.equal(yieldedBeforeSelection, true);
		assert.equal(h.scrolled[0]?.to.line, 1500);
	});
	it("does not steal focus back after the user switches editor tabs during a scan", async () => {
		const content = `${"plain text\n".repeat(1500)}${original}`;
		const occurrence = scanCalloutOccurrences("note.md", content).at(-1)!;
		const h = navigationHarness(content);
		const other = Object.assign(new MarkdownView({} as WorkspaceLeaf), {
			file: Object.assign(new TFile(), { path: "other.md" }),
		});
		const switched = new Promise<void>((resolve) => window.setTimeout(() => {
			h.activate(other);
			resolve();
		}, 0));
		assert.equal(await navigateToCalloutOccurrence(h.app, occurrence), false);
		await switched;
		assert.deepEqual(h.scrolled, []);
		assert.deepEqual(h.ephemeral, []);
		assert.equal(h.focused(), 0);
	});
	it("keeps navigation valid when focus returns to the sidebar", async () => {
		const h = navigationHarness();
		h.activate(null);
		assert.equal(await navigateToCalloutOccurrence(h.app, saved()), true);
		assert.equal(h.scrolled.length, 1);
	});
	it("cancels a request before opening or after its sidebar context changes", async () => {
		const content = `${"plain text\n".repeat(1500)}${original}`;
		const occurrence = scanCalloutOccurrences("note.md", content).at(-1)!;
		const h = navigationHarness(content);
		assert.equal(await navigateToCalloutOccurrence(h.app, occurrence, { isCurrent: () => false }), false);
		assert.deepEqual(h.opened, []);
		let current = true;
		const cancelled = new Promise<void>((resolve) => window.setTimeout(() => {
			current = false;
			resolve();
		}, 0));
		assert.equal(await navigateToCalloutOccurrence(h.app, occurrence, { isCurrent: () => current }), false);
		await cancelled;
		assert.deepEqual(h.scrolled, []);
		assert.equal(h.focused(), 0);
	});
	it("uses the most recent matching editor when a note has duplicate tabs", async () => {
		const h = navigationHarness(`Unsaved line\n${original}`);
		const stale = new MarkdownView({} as WorkspaceLeaf);
		stale.file = h.view.file;
		const staleLeaf = {
			view: stale, getRoot: h.documentLeaf.getRoot,
			openFile: () => { throw new Error("Must not reopen a stale duplicate"); },
		} as unknown as WorkspaceLeaf;
		h.app.workspace.getLeavesOfType = () => [staleLeaf, h.documentLeaf as unknown as WorkspaceLeaf];
		assert.equal(await navigateToCalloutOccurrence(h.app, saved()), true);
		assert.deepEqual(h.requestedLeaves, []);
		assert.equal(h.scrolled[0]?.to.line, 1);
	});
	it("reports missing or stale results and never selects a guessed location", async () => {
		const notices: string[] = [];
		const globals = globalThis as unknown as { __CS_NOTICES__?: string[] };
		globals.__CS_NOTICES__ = notices;
		try {
			const h = navigationHarness("changed");
			assert.equal(await navigateToCalloutOccurrence(h.app, saved()), false);
			assert.deepEqual(h.scrolled, []);
			assert.deepEqual(notices, [t("usage.changed")]);
			h.app.vault.getAbstractFileByPath = () => null;
			assert.equal(await navigateToCalloutOccurrence(h.app, saved()), false);
			assert.equal(notices[1], t("usage.missing"));
		} finally { delete globals.__CS_NOTICES__; }
	});
});
