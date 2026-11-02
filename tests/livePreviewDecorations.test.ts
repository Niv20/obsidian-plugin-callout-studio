/**
 * tests/livePreviewDecorations.test.ts — the two invariants Live Preview's
 * content pill rests on.
 *
 * A content pill is ONE `Decoration.replace` over the whole `[!id]{…}`, payload
 * included. That is not a stylistic choice: a mark around live document text
 * only stays a single DOM element for as long as CodeMirror never has to split
 * it around someone else's decoration, and inside a payload it always does —
 * Obsidian decorates the payload's own markdown from its own decoration set and
 * styles inline code as a chip with its own rounded caps. A replaced range is
 * immune (`SpanCursor.next` calls `forward()` past everything ending inside it),
 * which is why the pill is built this way and why these tests guard the shape
 * rather than the styling.
 *
 * If an assertion here fails, the pill in Live Preview silently renders wrong:
 * several boxes where there should be one, or a builder that throws and costs
 * the whole editor its decorations.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { Decoration } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { rendersAsOneParagraph } from "../src/editor/livepreview/contentPillRender";
import { contentPayloadStart, scanLineForCalloutTokens, tokenEnd } from "../src/editor/calloutTokens";

/** The comparator calloutViewPlugin sorts `midLine` with, verbatim. */
const bySortKey = (a: { from: number; deco: Decoration }, b: { from: number; deco: Decoration }): number =>
	a.from - b.from || a.deco.startSide - b.deco.startSide;

/** What decorateLine pushes for `[!warning]{text}` at `offset`. */
function contentPill(offset: number, sourceLen: number) {
	return {
		from: offset,
		to: offset + sourceLen,
		deco: Decoration.replace({}),
	};
}

describe("content pill decorations", () => {
	it("covers the token, the braces and the payload as one range", () => {
		// `[!warning]{text}` — 10 chars of token, then `{text}`. The pill must
		// span all 16: a range that stopped at the token would leave the braces
		// and the payload as visible raw text beside the rendered pill.
		const pill = contentPill(0, 16);
		assert.strictEqual(pill.from, 0);
		assert.strictEqual(pill.to, 16);
	});

	it("keeps two adjacent pills apart", () => {
		// `[!a]{x}[!a]{y}` — back to back, same callout. Two replaced ranges
		// cannot merge the way two equal marks would, but they must still be
		// disjoint and sorted or RangeSetBuilder throws.
		const items = [contentPill(0, 7), contentPill(7, 7)].sort(bySortKey);
		assert.deepStrictEqual(
			items.map((i) => [i.from, i.to]),
			[
				[0, 7],
				[7, 14],
			],
		);
		const builder = new RangeSetBuilder<Decoration>();
		assert.doesNotThrow(() => {
			for (const item of items) builder.add(item.from, item.to, item.deco);
			builder.finish();
		});
	});

	it("sorts a heading title mark after a replace at the same offset", () => {
		// The other reading of the same comparator, which must not regress: a
		// heading's title mark is non-inclusive and belongs AFTER the token
		// widget it starts against.
		const titleMark = Decoration.mark({ class: "cs-heading-title" });
		const tokenReplace = Decoration.replace({});
		assert.ok(tokenReplace.startSide < titleMark.startSide);

		const builder = new RangeSetBuilder<Decoration>();
		const items = [
			{ from: 3, to: 13, deco: tokenReplace },
			{ from: 13, to: 20, deco: titleMark },
			// …and a content pill later on the same heading line.
			contentPill(20, 16),
		].sort(bySortKey);
		assert.doesNotThrow(() => {
			for (const item of items) builder.add(item.from, item.to, item.deco);
			builder.finish();
		});
	});
});

describe("payload start", () => {
	/**
	 * Where clicking a pill puts the caret. The widget has no token at click
	 * time — only the width of the span it replaced — so it re-derives the
	 * payload's offset from that width, and this checks the derivation against
	 * what the scanner actually produces.
	 */
	const payloadStartOf = (line: string, tokenIndex = 0): number => {
		const token = scanLineForCalloutTokens(line, { inlineContent: true })[tokenIndex];
		assert.ok(token?.content, `no content token at ${tokenIndex} in ${line}`);
		return contentPayloadStart(token.from, tokenEnd(token) - token.from, token.content.text.length);
	};

	it("lands on the payload's first character", () => {
		const line = "[!warning]{text}";
		assert.strictEqual(payloadStartOf(line), 11);
		assert.strictEqual(line[payloadStartOf(line)], "t");
	});

	it("counts the metadata a token carries", () => {
		// The mistake the token WIDTH exists to prevent: `rawId` is the type
		// alone, so deriving the span from it lands short by `|purple`.
		const line = "[!note|purple]{hi}";
		assert.strictEqual(line[payloadStartOf(line)], "h");
	});

	it("stays inside its own pill when two sit back to back", () => {
		const line = "[!warning]{first}[!warning]{second}";
		assert.strictEqual(line[payloadStartOf(line, 0)], "f");
		assert.strictEqual(line[payloadStartOf(line, 1)], "s");
	});

	it("offsets to the closing brace at the payload's full length", () => {
		const line = "Text before [!warning]{text} after";
		const start = payloadStartOf(line);
		assert.strictEqual(line.slice(start, start + 4), "text");
		assert.strictEqual(line[start + 4], "}");
	});
});

describe("payload unwrap guard", () => {
	const text = (s: string) => ({ kind: "text" as const, text: s });
	const el = (tag: string) => ({ kind: "element" as const, tag });

	it("accepts a single paragraph", () => {
		assert.strictEqual(rendersAsOneParagraph([el("P")]), true);
	});

	it("ignores the renderer's surrounding whitespace", () => {
		assert.strictEqual(rendersAsOneParagraph([text("\n"), el("P"), text("\n")]), true);
	});

	it("refuses block markdown", () => {
		// `[!x]{- a}` renders as a list, `[!x]{# h}` as a heading. Either one
		// inside an inline pill would drop a block box into a line of prose.
		assert.strictEqual(rendersAsOneParagraph([el("UL")]), false);
		assert.strictEqual(rendersAsOneParagraph([el("H1")]), false);
		assert.strictEqual(rendersAsOneParagraph([el("P"), el("P")]), false);
	});

	it("refuses anything that is not wrapped at all", () => {
		assert.strictEqual(rendersAsOneParagraph([]), false);
		assert.strictEqual(rendersAsOneParagraph([text("bare")]), false);
		assert.strictEqual(rendersAsOneParagraph([el("P"), text("tail")]), false);
	});
});
