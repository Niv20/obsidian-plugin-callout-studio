import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blockCalloutEndLine, calloutExtentAt, isBlockHeaderLine, linesOf } from "../src/editor/calloutExtent";

describe("callout extent", () => {
	it("runs a block callout to its last quoted line, nested callouts included", () => {
		const lines = linesOf("> [!note] Outer\n> body\n> > [!tip] Inner\n> > inner body\n> outer again\n\nafter");
		assert.deepEqual(calloutExtentAt(lines, 0, 2, 9),
			{ kind: "regular", startLine: 0, endLine: 4, from: 2, to: 9 });
		assert.deepEqual(calloutExtentAt(lines, 2, 4),
			{ kind: "regular", startLine: 2, endLine: 3, from: 4, to: 10 }, "a nested callout ends where its quote gets shallower");
	});
	it("ends a block at a blank or unquoted line and keeps a list item's callout", () => {
		assert.equal(blockCalloutEndLine(linesOf("> [!note]\n> a\n\n> b"), 0, 1), 1);
		assert.equal(blockCalloutEndLine(linesOf("> [!note]\n> a\nlazy"), 0, 1), 1);
		const listed = linesOf("- > [!note] In a list\n  > body\n- next");
		assert.deepEqual(calloutExtentAt(listed, 0, 4), { kind: "regular", startLine: 0, endLine: 1, from: 4, to: 11 });
	});
	it("covers an inline pill's payload and a heading callout's line alone", () => {
		const lines = linesOf("A [!tip]{word} here\n## [!note] Title\nbody");
		assert.deepEqual(calloutExtentAt(lines, 0, 2, 8), { kind: "inline", startLine: 0, endLine: 0, from: 2, to: 14 });
		assert.deepEqual(calloutExtentAt(lines, 1, 3), { kind: "heading", startLine: 1, endLine: 1, from: 3, to: 10 });
	});
	it("finds the token a wider or narrower range overlaps, and falls back to the range itself", () => {
		const lines = linesOf("## [!note] Title\n[[a#Report note]]\n# Report [!tip]");
		assert.equal(calloutExtentAt(lines, 0, 0, 16)?.kind, "heading");
		assert.equal(calloutExtentAt(lines, 2, 9)?.kind, "inline", "a token after heading text is a pill in it");
		assert.deepEqual(calloutExtentAt(lines, 1, 0, 17), { kind: "span", startLine: 1, endLine: 1, from: 0, to: 17 });
		assert.equal(calloutExtentAt(lines, 9, 0), null);
	});
	it("treats [! as a header only on the first line of its quote", () => {
		const lines = linesOf("> [!note]\n> [!tip] text\n> > [!info]\n> body");
		assert.deepEqual([0, 1, 2, 3].map((line) => isBlockHeaderLine(lines, line)), [true, false, true, false]);
	});
});
