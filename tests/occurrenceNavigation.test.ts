import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setTimeout as scheduleTimer } from "node:timers";
import { MarkdownView, TFile, type App, type EditorPosition, type WorkspaceLeaf } from "obsidian";
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

function navigationHarness(content = original) {
	const file = Object.assign(new TFile(), { path: "note.md" });
	const root = {};
	const side = {};
	const selections: Array<[EditorPosition, EditorPosition | undefined]> = [];
	const scrolled: unknown[] = [];
	const requestedLeaves: unknown[] = [];
	const opened: unknown[] = [];
	const ephemeral: unknown[] = [];
	let focus = 0;
	let deferredLoaded = false;
	const view = Object.assign(new MarkdownView({} as WorkspaceLeaf), {
		file,
		editor: {
			getValue: () => content,
			setSelection: (from: EditorPosition, to?: EditorPosition) => { selections.push([from, to]); },
			scrollIntoView: (range: unknown) => { scrolled.push(range); },
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
	const app = {
		vault: { getAbstractFileByPath: () => file },
		workspace: {
			rootSplit: root,
			getLeavesOfType: () => [],
			getActiveViewOfType: () => activeView,
			getMostRecentLeaf: () => recentLeaf,
			getLeaf: (mode: unknown) => { requestedLeaves.push(mode); return mode === "tab" ? documentLeaf : sidebarLeaf; },
		},
	} as unknown as App;
	return { app, view, documentLeaf, selections, opened, requestedLeaves, ephemeral, scrolled,
		activate: (active: MarkdownView | null, leaf?: WorkspaceLeaf | null) => {
			activeView = active;
			if (leaf !== undefined) recentLeaf = leaf;
		},
		focused: () => focus, loaded: () => deferredLoaded };
}

describe("occurrence navigation", () => {
	it("opens file headings at the top without selecting text and honors a new tab", async () => {
		const h = navigationHarness();
		assert.equal(await navigateToSidebarFile(h.app, "note.md", true), true);
		assert.deepEqual(h.selections, [[{ line: 0, ch: 0 }, { line: 0, ch: 0 }]]);
		assert.deepEqual(h.requestedLeaves, ["tab"]);
		assert.deepEqual(h.ephemeral, [{ line: 0, focus: true }]);
	});
	it("opens a document leaf and resolves against the current editor buffer", async () => {
		const h = navigationHarness(`Unsaved line\n${original}`);
		h.activate(h.view, null);
		assert.equal(await navigateToCalloutOccurrence(h.app, saved()), true);
		assert.deepEqual(h.requestedLeaves, [false, "tab"]);
		assert.deepEqual(h.opened, [{ active: true, state: { mode: "source" } }]);
		assert.equal(h.loaded(), true);
		assert.deepEqual(h.selections, [[{ line: 1, ch: saved().from }, { line: 1, ch: saved().to }]]);
		assert.deepEqual(h.ephemeral, [{ line: 1, focus: true }]);
		assert.equal(h.scrolled.length, 1);
		assert.equal(h.focused(), 1);
	});
	it("honors a new-tab request", async () => {
		const h = navigationHarness();
		assert.equal(await navigateToCalloutOccurrence(h.app, saved(), true), true);
		assert.deepEqual(h.requestedLeaves, ["tab"]);
	});
	it("rejects edits that land while an asynchronous scan is in progress", async () => {
		const h = navigationHarness(original);
		let reads = 0;
		h.view.editor.getValue = () => ++reads === 1 ? original : `${original}\nchanged`;
		assert.equal(await navigateToCalloutOccurrence(h.app, saved()), false);
		assert.deepEqual(h.selections, []);
	});
	it("yields during navigation in a large note instead of blocking until selection", async () => {
		const content = `${"plain text\n".repeat(1500)}${original}`;
		const occurrences = scanCalloutOccurrences("note.md", content);
		const occurrence = occurrences[occurrences.length - 1]!;
		const h = navigationHarness(content);
		let yieldedBeforeSelection = false;
		const checkpoint = new Promise<void>((resolve) => window.setTimeout(() => {
			yieldedBeforeSelection = h.selections.length === 0;
			resolve();
		}, 0));
		assert.equal(await navigateToCalloutOccurrence(h.app, occurrence), true);
		await checkpoint;
		assert.equal(yieldedBeforeSelection, true);
		assert.equal(h.selections[0]?.[0].line, 1500);
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
		assert.deepEqual(h.selections, []);
		assert.deepEqual(h.ephemeral, []);
		assert.equal(h.focused(), 0);
	});
	it("keeps navigation valid when focus returns to the sidebar", async () => {
		const h = navigationHarness();
		h.activate(null);
		assert.equal(await navigateToCalloutOccurrence(h.app, saved()), true);
		assert.equal(h.selections.length, 1);
	});
	it("cancels a request before opening or after its sidebar context changes", async () => {
		const content = `${"plain text\n".repeat(1500)}${original}`;
		const occurrence = scanCalloutOccurrences("note.md", content).at(-1)!;
		const h = navigationHarness(content);
		assert.equal(await navigateToCalloutOccurrence(h.app, occurrence, false, () => false), false);
		assert.deepEqual(h.opened, []);
		let current = true;
		const cancelled = new Promise<void>((resolve) => window.setTimeout(() => {
			current = false;
			resolve();
		}, 0));
		assert.equal(await navigateToCalloutOccurrence(h.app, occurrence, false, () => current), false);
		await cancelled;
		assert.deepEqual(h.selections, []);
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
		assert.equal(h.selections[0]?.[0].line, 1);
	});
	it("reports missing or stale results and never selects a guessed location", async () => {
		const notices: string[] = [];
		const globals = globalThis as unknown as { __CS_NOTICES__?: string[] };
		globals.__CS_NOTICES__ = notices;
		try {
			const h = navigationHarness("changed");
			assert.equal(await navigateToCalloutOccurrence(h.app, saved()), false);
			assert.deepEqual(h.selections, []);
			assert.deepEqual(notices, [t("usage.changed")]);
			h.app.vault.getAbstractFileByPath = () => null;
			assert.equal(await navigateToCalloutOccurrence(h.app, saved()), false);
			assert.equal(notices[1], t("usage.missing"));
		} finally { delete globals.__CS_NOTICES__; }
	});
});
