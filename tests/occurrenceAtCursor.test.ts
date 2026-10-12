import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { linesOf } from "../src/editor/calloutExtent";
import { occurrenceAtCursor } from "../src/usage/occurrenceAtCursor";
import { scanCalloutOccurrences } from "../src/usage/scanCalloutOccurrences";
import type { CalloutOccurrence } from "../src/usage/occurrenceTypes";

function byLine(occurrences: readonly CalloutOccurrence[]): Map<number, CalloutOccurrence[]> {
	const lines = new Map<number, CalloutOccurrence[]>();
	for (const occurrence of occurrences) lines.set(occurrence.line, [...lines.get(occurrence.line) ?? [], occurrence]);
	return lines;
}

function at(content: string, line: number, ch: number, keep: (o: CalloutOccurrence) => boolean = () => true, live = content) {
	const found = occurrenceAtCursor(linesOf(live), { line, ch }, byLine(scanCalloutOccurrences("a.md", content).filter(keep)));
	return found && `${found.role}:${found.rawId}@${found.line}`;
}

const NESTED = "> [!note] Outer\n> body\n> > [!tip] Inner\n> > inner body\n> outer again\n\nafter";

describe("occurrence at the caret", () => {
	it("picks the innermost block callout that holds the caret's line", () => {
		assert.equal(at(NESTED, 0, 3), "regular:note@0");
		assert.equal(at(NESTED, 1, 0), "regular:note@0");
		assert.equal(at(NESTED, 3, 6), "regular:tip@2");
		assert.equal(at(NESTED, 4, 2), "regular:note@0", "back at the outer depth after the inner quote ends");
		assert.equal(at(NESTED, 5, 0), null, "a blank line ends the quote");
		assert.equal(at(NESTED, 6, 1), null);
	});
	it("falls through to the containing callout when the inner one is filtered out", () => {
		assert.equal(at(NESTED, 3, 6, (o) => o.rawId !== "tip"), "regular:note@0");
		assert.equal(at(NESTED, 3, 6, (o) => o.rawId !== "note"), "regular:tip@2");
		assert.equal(at(NESTED, 1, 0, (o) => o.rawId !== "note"), null);
	});
	it("prefers a pill the caret touches, payload included, then the heading on the line", () => {
		const content = "## [!note] Title with [!tip]{word}\n> [!info] Head\n> see [!warning] here";
		assert.equal(at(content, 0, 25), "inline:tip@0");
		assert.equal(at(content, 0, 33), "inline:tip@0", "the {word} payload belongs to the pill");
		assert.equal(at(content, 0, 15), "heading:note@0");
		assert.equal(at(content, 2, 9), "inline:warning@2", "a pill in a callout's body beats the callout");
		assert.equal(at(content, 2, 19), "regular:info@1");
	});
	it("matches nothing for a caret between pills on a plain line", () => {
		assert.equal(at("[!note] and [!tip]", 0, 9), null);
		assert.equal(at("[!note] and [!tip]", 0, 7), "inline:note@0", "the caret right after a pill still touches it");
	});
	it("finds a list item's callout from its body", () => {
		assert.equal(at("- > [!note] Listed\n  > body", 1, 5), "regular:note@0");
	});
	it("never matches a card whose line the index has not caught up with", () => {
		assert.equal(at(NESTED, 1, 0, () => true, NESTED.replace("Outer", "Outer!")), null);
		assert.equal(at("[!note]", 0, 2, () => true, "x[!note]"), null);
	});
});
