import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Editor, MarkdownView } from "obsidian";
import { linesOf } from "../src/editor/calloutExtent";
import { notifySidebarEditorSelection } from "../src/ui/sidebarSelection";
import { OccurrenceCursorSync } from "../src/usage/occurrenceCursorSync";
import { OccurrenceResults } from "../src/usage/occurrenceResults";
import { scanCalloutOccurrences } from "../src/usage/scanCalloutOccurrences";
import { installFakeDom } from "./support/fakeDom";

const dom = installFakeDom();
const CONTENT = "> [!note] One\n> body\n\n> [!tip] Two\n> body";

function harness() {
	const cards = new OccurrenceResults(100);
	const host = dom.document.createElement("div") as unknown as HTMLElement;
	cards.render(host, scanCalloutOccurrences("a.md", CONTENT), 100, true, () => {}, () => {});
	let caret = { line: 0, ch: 0 };
	let reads = 0, selects = 0;
	const select = cards.select.bind(cards);
	cards.select = (occurrence) => { selects++; select(occurrence); };
	const lines = linesOf(CONTENT);
	const makeEditor = (): Editor => ({
		getCursor: () => { reads++; return caret; },
		getLine: (line: number) => lines.getLine(line), lineCount: () => lines.lineCount(),
		listSelections: () => [{ anchor: caret, head: caret }],
	}) as unknown as Editor;
	const editor = makeEditor();
	const view = { file: { path: "a.md" }, editor } as unknown as MarkdownView;
	const sync = new OccurrenceCursorSync(() => view, cards, () => null);
	return {
		sync, cards, editor, other: makeEditor(),
		move: (line: number, ch = 0, on = editor): void => { caret = { line, ch }; notifySidebarEditorSelection(on); },
		current: () => host.querySelector('[aria-current="true"]')?.getAttribute("data-result") ?? null,
		reads: () => reads, selects: () => selects,
	};
}

describe("Find callouts following the caret", () => {
	it("coalesces a burst of caret moves into one lookup on the next frame", () => {
		const h = harness();
		h.sync.open();
		try {
			for (const line of [0, 1, 3, 4, 1]) h.move(line);
			assert.equal(h.reads(), 0, "nothing is read during the burst");
			dom.window.flushFrames();
			assert.equal(h.reads(), 1);
			assert.equal(h.current(), "0");
			h.move(4); dom.window.flushFrames();
			assert.equal(h.current(), "1");
			h.move(2); dom.window.flushFrames();
			assert.equal(h.current(), null, "the blank line between them is in neither");
		} finally { h.sync.close(); }
	});
	it("writes to the list only when the caret's card changes", () => {
		const h = harness();
		h.sync.open();
		try {
			h.move(0); dom.window.flushFrames();
			h.move(1, 3); dom.window.flushFrames();
			h.move(0, 5); dom.window.flushFrames();
			assert.equal(h.selects(), 1);
		} finally { h.sync.close(); }
	});
	it("ignores other editors, and every editor once closed", () => {
		const h = harness();
		h.sync.open();
		h.move(0, 0, h.other);
		assert.equal(dom.window.pendingFrames(), 0);
		h.sync.close();
		h.move(0);
		assert.equal(dom.window.pendingFrames(), 0);
		assert.equal(h.reads(), 0);
	});
	it("lets a clicked card hold the mark until the user moves the caret", () => {
		const h = harness();
		h.sync.open();
		try {
			h.sync.hold();
			h.move(0);
			assert.equal(dom.window.pendingFrames(), 0, "a result being opened is not overridden");
			h.sync.landedIn(h.editor);
			h.cards.select(scanCalloutOccurrences("a.md", CONTENT)[1]!);
			h.move(0);
			dom.window.flushFrames();
			assert.equal(h.current(), "1", "a restore onto the same caret leaves the clicked card");
			h.move(1);
			dom.window.flushFrames();
			assert.equal(h.current(), "0", "the first real move hands the mark back to the caret");
		} finally { h.sync.close(); }
	});
});
