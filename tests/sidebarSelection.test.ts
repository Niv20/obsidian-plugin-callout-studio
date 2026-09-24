import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Editor, EditorSelection } from "obsidian";
import { notifySidebarEditorSelection, SidebarSourceSelection } from "../src/ui/sidebarSelection";

const range = { from: { line: 2, ch: 4 }, to: { line: 2, ch: 12 } };
function harness() {
	let selections: EditorSelection[] = [{ anchor: range.from, head: range.to }];
	const editor = { listSelections: () => selections } as Editor;
	return { editor, change: (next: EditorSelection[], documentChanged = false) => {
		selections = next; notifySidebarEditorSelection(editor, documentChanged);
	} };
}

describe("sidebar source selection", () => {
	it("keeps the result for the same selection and clears it once its caret moves", () => {
		const h = harness(), selection = new SidebarSourceSelection();
		let cleared = 0;
		selection.watch(h.editor, range, () => cleared++);
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
			selection.watch(h.editor, range, () => { cleared = true; });
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
		occurrences.watch(h.editor, range, () => first++);
		conversion.watch(h.editor, range, () => second++);
		other.change([]);
		assert.deepEqual([first, second], [0, 0]);
		occurrences.clear();
		h.change([]);
		assert.deepEqual([first, second], [0, 1]);
		conversion.watch(h.editor, range, () => second++);
		conversion.watch(other.editor, range, () => second++);
		h.change([]);
		assert.equal(second, 1);
		conversion.clear(); other.change([]);
		assert.equal(second, 1);
	});
});
