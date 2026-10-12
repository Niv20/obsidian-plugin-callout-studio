import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Editor, EditorSelection } from "obsidian";
import { notifySidebarEditorSelection, onSidebarEditorSelection, SidebarSourceSelection } from "../src/ui/sidebarSelection";

const range = { from: { line: 2, ch: 4 }, to: { line: 2, ch: 12 } };
function harness() {
	let selections: EditorSelection[] = [{ anchor: range.from, head: range.to }];
	const editor = { listSelections: () => selections } as Editor;
	return { editor, change: (next: EditorSelection[], documentChanged = false) => {
		selections = next; notifySidebarEditorSelection(editor, documentChanged);
	} };
}

describe("sidebar source selection", () => {
	it("keeps the result while the landing selection stands and clears it once the caret moves", () => {
		const h = harness(), selection = new SidebarSourceSelection();
		let cleared = 0;
		selection.watch(h.editor, () => cleared++);
		h.change([{ anchor: range.from, head: range.to }]);
		h.change([{ anchor: range.to, head: range.from }]);
		assert.equal(cleared, 0);
		h.change([{ anchor: range.from, head: range.from }]);
		assert.equal(cleared, 1);
		h.change([]);
		assert.equal(cleared, 1, "the completed subscription is removed");
	});
	it("clears an expanded selection, multiple selections and edits even at unchanged coordinates", () => {
		for (const kind of ["expanded", "multiple", "edited"] as const) {
			const h = harness(), selection = new SidebarSourceSelection();
			let cleared = false;
			selection.watch(h.editor, () => { cleared = true; });
			h.change(kind === "expanded" ? [{ anchor: range.from, head: { line: 3, ch: 0 } }]
				: kind === "multiple" ? [{ anchor: range.from, head: range.to }, { anchor: range.from, head: range.from }]
				: [{ anchor: range.from, head: range.to }], kind === "edited");
			assert.equal(cleared, true, kind);
		}
	});
	it("keeps independent sidebar subscriptions, ignores other editors and cleans up on close", () => {
		const h = harness(), other = harness();
		const occurrences = new SidebarSourceSelection(), conversion = new SidebarSourceSelection();
		let first = 0, second = 0;
		occurrences.watch(h.editor, () => first++);
		conversion.watch(h.editor, () => second++);
		other.change([]);
		assert.deepEqual([first, second], [0, 0]);
		occurrences.clear();
		h.change([]);
		assert.deepEqual([first, second], [0, 1]);
		conversion.watch(h.editor, () => second++);
		conversion.watch(other.editor, () => second++);
		h.change([]);
		assert.equal(second, 1);
		conversion.clear(); other.change([]);
		assert.equal(second, 1);
	});
	it("compares against whatever selection the editor held when the result landed", () => {
		const h = harness(), selection = new SidebarSourceSelection();
		const caret = { anchor: { line: 7, ch: 1 }, head: { line: 7, ch: 1 } };
		h.change([caret]);
		let cleared = 0;
		selection.watch(h.editor, () => cleared++);
		h.change([caret]);
		assert.equal(cleared, 0, "a restore that lands on the same caret is not the user acting");
		h.change([{ anchor: range.from, head: range.to }]);
		assert.equal(cleared, 1);
	});
	it("tells any-editor listeners about every editor until they unsubscribe", () => {
		const h = harness(), other = harness();
		const heard: Array<[Editor, boolean]> = [];
		const stop = onSidebarEditorSelection((editor, edited) => heard.push([editor, edited]));
		h.change([], true);
		other.change([]);
		stop();
		h.change([]);
		assert.deepEqual(heard, [[h.editor, true], [other.editor, false]]);
	});
});
