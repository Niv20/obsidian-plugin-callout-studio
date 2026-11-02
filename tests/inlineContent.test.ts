/**
 * tests/inlineContent.test.ts — the `{…}` brace grammar in isolation.
 *
 * Kept separate from the tokenizer tests so a failure here points at the
 * matcher rather than at how the scanner calls it.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { blankInlineMath, matchContentParts, matchInlineContent, type ContentPart } from "../src/editor/inlineContent";

/** Convenience: match at the first `{` and return the payload text, or null. */
function payload(line: string): string | null {
	const open = line.indexOf("{");
	if (open === -1) return null;
	const m = matchInlineContent(line, open);
	return m.kind === "content" ? line.slice(m.from + 1, m.to - 1) : null;
}

describe("matchInlineContent", () => {
	it("matches a simple balanced payload", () => {
		assert.deepStrictEqual(matchInlineContent("{abc}", 0), {
			kind: "content",
			from: 0,
			to: 5,
		});
	});

	it("reports `none` when the offset is not a brace", () => {
		assert.deepStrictEqual(matchInlineContent(" {abc}", 0), { kind: "none" });
		assert.deepStrictEqual(matchInlineContent("", 0), { kind: "none" });
	});

	it("reports `open` for an unclosed payload", () => {
		assert.deepStrictEqual(matchInlineContent("{abc", 0), { kind: "open" });
		assert.deepStrictEqual(matchInlineContent("{a {b}", 0), { kind: "open" });
	});

	it("accepts an empty payload", () => {
		assert.deepStrictEqual(matchInlineContent("{}", 0), {
			kind: "content",
			from: 0,
			to: 2,
		});
		assert.strictEqual(payload("{}"), "");
	});

	it("nests braces by depth", () => {
		assert.strictEqual(payload("{text {with braces}}"), "text {with braces}");
		assert.strictEqual(payload("{a {b {c} d} e}"), "a {b {c} d} e");
	});

	it("closes at the first brace returning depth to zero", () => {
		// `[!warning]{text with } braces}` — the payload ends at the first `}`.
		assert.strictEqual(payload("{text with } braces}"), "text with ");
	});

	it("does not treat a backslash as an escape", () => {
		// Deliberate: Markdown eats the backslash before reading view sees it,
		// so honouring it here would desync the two render surfaces.
		assert.strictEqual(payload("{a \\} b}"), "a \\");
	});

	it("ignores a stray closing brace before the opener", () => {
		const line = "} {abc}";
		const open = line.indexOf("{");
		assert.deepStrictEqual(matchInlineContent(line, open), {
			kind: "content",
			from: 2,
			to: 7,
		});
	});

	it("returns offsets valid in the original line", () => {
		const line = "prefix{payload}suffix";
		const m = matchInlineContent(line, 6);
		assert.strictEqual(m.kind, "content");
		if (m.kind !== "content") return;
		assert.strictEqual(line.slice(m.from, m.to), "{payload}");
	});
});

describe("blankInlineMath", () => {
	it("leaves a line without `$` untouched", () => {
		assert.strictEqual(blankInlineMath("no math here"), "no math here");
	});

	it("blanks a math span, preserving length", () => {
		const line = "a $x_{1}$ b";
		const out = blankInlineMath(line);
		assert.strictEqual(out.length, line.length);
		assert.strictEqual(out, "a         b");
	});

	it("leaves currency amounts alone", () => {
		assert.strictEqual(blankInlineMath("$5 and $10"), "$5 and $10");
	});

	it("leaves an unclosed `$` alone", () => {
		assert.strictEqual(blankInlineMath("costs $5 total"), "costs $5 total");
	});

	it("hides braces inside math from the matcher", () => {
		// `{a $}$ b}` — the `}` inside math must not close the payload.
		const line = "{a $}$ b}";
		const m = matchInlineContent(blankInlineMath(line), 0);
		assert.strictEqual(m.kind, "content");
		if (m.kind !== "content") return;
		assert.strictEqual(line.slice(m.from + 1, m.to - 1), "a $}$ b");
	});
});

/**
 * The reading-view walk. By the time that post-processor runs, Markdown has
 * already turned `[!warning]{a **b** c}` into three DOM siblings, so these
 * segment sequences are what it actually has to match across. Every case here
 * is a parity rule with Live Preview — if one of them is wrong, the two
 * surfaces close a payload at different places.
 */
describe("matchContentParts", () => {
	/** `{a ` , <strong>b</strong> , ` c}` — the canonical bold case. */
	const boldRun: ContentPart[] = [{ text: "{a " }, { text: "b", nested: true }, { text: " c}" }];

	it("closes in a later sibling", () => {
		assert.deepStrictEqual(matchContentParts(boldRun, 0, 0), {
			part: 2,
			offset: 2,
		});
	});

	it("closes in the opening part when it can", () => {
		assert.deepStrictEqual(matchContentParts([{ text: "{ab}c" }], 0, 0), {
			part: 0,
			offset: 3,
		});
	});

	it("honours the start offset", () => {
		assert.deepStrictEqual(matchContentParts([{ text: "x [!a]{b}" }], 0, 6), { part: 0, offset: 8 });
	});

	it("returns null when the payload never closes", () => {
		assert.strictEqual(matchContentParts([{ text: "{abc" }], 0, 0), null);
	});

	it("ignores braces in an opaque segment", () => {
		// `{use `}` here}` — the code span must not close the payload.
		const parts: ContentPart[] = [{ text: "{use " }, { text: "}", opaque: true }, { text: " here}" }];
		assert.deepStrictEqual(matchContentParts(parts, 0, 0), {
			part: 2,
			offset: 5,
		});
	});

	it("counts braces in a nested segment but refuses to close there", () => {
		// `**[!a]{bold** text}` — interleaved markup stays literal text.
		const parts: ContentPart[] = [{ text: "{bold" }, { text: "} text", nested: true }];
		assert.strictEqual(matchContentParts(parts, 0, 0), null);
	});

	it("still counts an opening brace inside a nested segment", () => {
		// `{a <strong>{</strong> b}}` — the nested `{` raises the depth, so the
		// first `}` no longer closes.
		const parts: ContentPart[] = [{ text: "{a " }, { text: "{", nested: true }, { text: " b}}" }];
		assert.deepStrictEqual(matchContentParts(parts, 0, 0), {
			part: 2,
			offset: 3,
		});
	});

	it("aborts at a stop segment", () => {
		// A `<br>` between: Live Preview scans one line, so this can never match.
		const parts: ContentPart[] = [{ text: "{a" }, { text: "", stop: true }, { text: "b}" }];
		assert.strictEqual(matchContentParts(parts, 0, 0), null);
	});

	it("nests across segments", () => {
		const parts: ContentPart[] = [{ text: "{a {b" }, { text: "x", nested: true }, { text: "c} d}" }];
		assert.deepStrictEqual(matchContentParts(parts, 0, 0), {
			part: 2,
			offset: 4,
		});
	});
});
