/**
 * tests/unwrapAnyCallout.test.ts — "Unwrap from callout" for all three formats.
 *
 * One command, innermost first: the pill the cursor touches, then the heading
 * callout on its line, then the block callout around it. What a pill or a
 * heading token leaves behind is `convertCalloutLine`'s — the text **Convert
 * uses to plain text** writes — so these pin where the command looks and where
 * the cursor lands, not the conversion rules themselves.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { Notice } from "obsidian";
import { unwrapCalloutAtCursor } from "../src/editor/unwrapAnyCallout";
import { t } from "../src/i18n";
import { asEditor, selectionEditor } from "./support/selectionEditor";

/** Unwrap; return the buffer with `⎸` at the cursor. */
const unwrap = (source: string): string => {
	const ed = selectionEditor(source);
	unwrapCalloutAtCursor(asEditor(ed));
	return ed.valueWithCursor();
};

const lastNotice = (): string => String((Notice as unknown as { last?: { message: unknown } }).last?.message);

describe("Unwrap from callout: an inline pill", () => {
	it("keeps a pill's own text, and the cursor's place in it", () => {
		assert.strictEqual(unwrap("a [!tip]{so⎸me text} b"), "a so⎸me text b");
		assert.strictEqual(unwrap("a [!tip|red]{x⎸} b"), "a x⎸ b");
	});

	it("leaves a bare pill's type as text", () => {
		assert.strictEqual(unwrap("a [!ti⎸p] b"), "a ⎸tip b");
	});

	it("counts a cursor touching either end as on the pill", () => {
		assert.strictEqual(unwrap("a [!tip]{x}⎸ b"), "a x⎸ b");
		assert.strictEqual(unwrap("a ⎸[!tip]{x} b"), "a ⎸x b");
	});

	it("takes the pill a selection on one line reaches", () => {
		// The cursor stays at the selection's head, past what was the pill.
		assert.strictEqual(unwrap("a «b [!tip]{x}» c"), "a b x⎸ c");
	});

	it("takes the pill, not the block callout it is written in", () => {
		assert.strictEqual(unwrap("> [!note]\n> a [!tip]{⎸x} b"), "> [!note]\n> a ⎸x b");
	});

	it("takes the pill, not the heading callout it is written in", () => {
		assert.strictEqual(unwrap("## [!tip] My [!note]{wo⎸rd}"), "## [!tip] My wo⎸rd");
	});

	it("is one edit, so one Undo puts it back", () => {
		const ed = selectionEditor("a [!tip]{⎸x} b");
		unwrapCalloutAtCursor(asEditor(ed));
		assert.strictEqual(ed.edits, 1);
	});

	it("leaves a pill nested in another's text alone, and says so", () => {
		const source = "a [!tip]{x [!note]{⎸y}} b";
		assert.strictEqual(unwrap(source), source);
		assert.strictEqual(lastNotice(), t("notice.unwrapLeftAsIs"));
	});
});

describe("Unwrap from callout: a heading callout", () => {
	it("keeps the heading and its title, from anywhere on the line", () => {
		assert.strictEqual(unwrap("## [!tip] My ti⎸tle"), "## My ti⎸tle");
		assert.strictEqual(unwrap("#⎸# [!tip] My title"), "#⎸# My title");
		assert.strictEqual(unwrap("## [!tip|red] My ⎸title"), "## My ⎸title");
	});

	it("titles a heading that had none with its type", () => {
		assert.strictEqual(unwrap("## [!tip]⎸"), "## tip⎸");
	});

	it("keeps closing # marks", () => {
		assert.strictEqual(unwrap("## [!tip] Title ##⎸"), "## Title ##⎸");
	});

	it("is taken off before the pills in its title when the cursor is not on one", () => {
		assert.strictEqual(unwrap("## [!tip] My⎸ [!note]{word}"), "## My⎸ [!note]{word}");
	});
});

describe("Unwrap from callout: a block callout, as before", () => {
	it("takes the block off when the cursor is not on a pill", () => {
		assert.strictEqual(unwrap("> [!note] Title\n> a [!tip]{x} b⎸"), "Title\na [!tip]{x} b⎸");
	});

	it("says the cursor is not in a callout when it is not", () => {
		for (const source of ["just ⎸text", "a `[!tip]{x}` ⎸b", "```\n[!tip]{⎸x}\n```", "a \\[!tip] ⎸b"]) {
			assert.strictEqual(unwrap(source).replace("⎸", ""), source.replace("⎸", ""), source);
			assert.strictEqual(lastNotice(), t("notice.cursorNotInsideCallout"), source);
		}
	});
});
