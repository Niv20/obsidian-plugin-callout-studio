/**
 * tests/calloutTokens.test.ts — the shared callout grammar.
 *
 * Two halves, and the second is the important one:
 *
 * 1. `[!id]{content}` — every case from the feature's edge-case table.
 * 2. Regression cover for the grammar that already shipped. Six subsystems read
 *    this one function (Live Preview, reading view, discovery, statistics, the
 *    vault rewriters, the context menu), so a silent shift in what it returns
 *    is the expensive kind of bug. These assertions exist to make that loud.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { scanLineForCalloutTokens, tokenEnd, type LineCalloutToken } from "../src/editor/calloutTokens";

/** The inline tokens of a line, which is what the pill surfaces render. */
function inlineTokens(line: string): LineCalloutToken[] {
	return scanLineForCalloutTokens(line).filter((t) => t.role === "inline");
}

/** `[rawId, contentText | null]` for each inline token — the common assertion. */
function inlineShape(line: string): Array<[string, string | null]> {
	return inlineTokens(line).map((t) => [t.rawId, t.content?.text ?? null]);
}

describe("inline callout content — the documented grammar", () => {
	it("parses a bare content pill", () => {
		assert.deepStrictEqual(inlineShape("[!warning]{text}"), [["warning", "text"]]);
	});

	it("parses one mid-paragraph, leaving the surrounding text alone", () => {
		const line = "Text before [!warning]{text} text after.";
		const [token] = inlineTokens(line);
		assert.ok(token);
		assert.strictEqual(token.rawId, "warning");
		assert.strictEqual(token.content?.text, "text");
		// `from`/`to` still span ONLY the bracket — the vault rewriters rely on it.
		assert.strictEqual(line.slice(token.from, token.to), "[!warning]");
		assert.strictEqual(line.slice(token.from, tokenEnd(token)), "[!warning]{text}");
	});

	it("keeps multiple words", () => {
		assert.deepStrictEqual(inlineShape("[!warning]{multiple words inside}"), [
			["warning", "multiple words inside"],
		]);
	});

	it("accepts empty content and consumes the braces", () => {
		const [token] = inlineTokens("[!warning]{}");
		assert.ok(token);
		assert.strictEqual(token.content?.text, "");
		assert.strictEqual(tokenEnd(token), 12);
	});

	it("requires the brace to touch the bracket", () => {
		// `[!warning] {}` is a plain pill plus literal text.
		const [token] = inlineTokens("[!warning] {}");
		assert.ok(token);
		assert.strictEqual(token.content, undefined);
		assert.strictEqual(token.contentOpen, undefined);
	});

	it("keeps inline markup in the payload verbatim", () => {
		assert.deepStrictEqual(inlineShape("[!warning]{text with **bold**}"), [["warning", "text with **bold**"]]);
		assert.deepStrictEqual(inlineShape("[!warning]{text with *italic*}"), [["warning", "text with *italic*"]]);
		assert.deepStrictEqual(inlineShape("[!warning]{text with [links](https://example.com)}"), [
			["warning", "text with [links](https://example.com)"],
		]);
	});

	it("keeps inline code in the payload as real text, not blanks", () => {
		// The braces are matched on a blanked copy; the text must come from the
		// original line or the backticked span would return as spaces.
		assert.deepStrictEqual(inlineShape("[!warning]{text with `code`}"), [["warning", "text with `code`"]]);
	});

	it("does not let a brace inside inline code close the payload", () => {
		assert.deepStrictEqual(inlineShape("[!warning]{use `}` here}"), [["warning", "use `}` here"]]);
	});

	it("nests braces", () => {
		assert.deepStrictEqual(inlineShape("[!warning]{text {with braces}}"), [["warning", "text {with braces}"]]);
	});

	it("closes at the first balancing brace", () => {
		assert.deepStrictEqual(inlineShape("[!warning]{text with } braces}"), [["warning", "text with "]]);
	});

	it("flags an unclosed payload without dropping the token", () => {
		// Renderers skip it; discovery, statistics and the reading-view escape
		// pairing must still see the token.
		const [token] = inlineTokens("[!warning]{unclosed");
		assert.ok(token, "the token must still be reported");
		assert.strictEqual(token.rawId, "warning");
		assert.strictEqual(token.contentOpen, true);
		assert.strictEqual(token.content, undefined);
	});

	it("parses two pills, spaced or adjacent", () => {
		assert.deepStrictEqual(inlineShape("[!warning]{first} [!note]{second}"), [
			["warning", "first"],
			["note", "second"],
		]);
		assert.deepStrictEqual(inlineShape("[!warning]{first}[!note]{second}"), [
			["warning", "first"],
			["note", "second"],
		]);
	});

	it("parses unknown and custom ids the same as known ones", () => {
		assert.deepStrictEqual(inlineShape("[!unknown-type]{text}"), [["unknown-type", "text"]]);
		assert.deepStrictEqual(inlineShape("[!my-custom-callout]{text}"), [["my-custom-callout", "text"]]);
	});

	it("keeps metadata and content separate", () => {
		const [token] = inlineTokens("[!note|purple]{text}");
		assert.ok(token);
		assert.strictEqual(token.rawId, "note");
		assert.strictEqual(token.metadata, "purple");
		assert.strictEqual(token.hasMetadata, true);
		assert.strictEqual(token.content?.text, "text");
	});

	it("reports a nested token so both render surfaces see the same list", () => {
		// Nesting is refused by the renderers, not here: the reading-view escape
		// pairing matches source and DOM occurrences by ordinal position.
		assert.deepStrictEqual(inlineShape("[!warning]{outer [!note]{inner}}"), [
			["warning", "outer [!note]{inner}"],
			["note", "inner"],
		]);
	});

	it("does not parse content when the option is off", () => {
		const tokens = scanLineForCalloutTokens("[!warning]{text}", {
			inlineContent: false,
		});
		assert.strictEqual(tokens.length, 1);
		assert.strictEqual(tokens[0]?.content, undefined);
		assert.strictEqual(tokens[0]?.contentOpen, undefined);
		assert.strictEqual(tokenEnd(tokens[0]!), 10);
	});

	it("ignores an escaped token and its payload", () => {
		assert.deepStrictEqual(inlineShape("\\[!warning]{text}"), []);
	});

	it("ignores a token inside inline code", () => {
		assert.deepStrictEqual(inlineShape("a `[!warning]{text}` b"), []);
	});

	it("ignores a token inside a wikilink", () => {
		assert.deepStrictEqual(inlineShape("[[note#[!warning]{text}]]"), []);
	});
});

describe("existing grammar — regressions", () => {
	it("still treats a blockquote header as one regular token", () => {
		const tokens = scanLineForCalloutTokens("> [!warning] Title");
		assert.strictEqual(tokens.length, 1);
		assert.strictEqual(tokens[0]?.role, "regular");
		assert.strictEqual(tokens[0]?.rawId, "warning");
	});

	it("does not give a blockquote header a payload", () => {
		// The whole line after the header is Obsidian's title; braces in it are
		// ordinary text.
		const tokens = scanLineForCalloutTokens("> [!warning]{Title}");
		assert.strictEqual(tokens.length, 1);
		assert.strictEqual(tokens[0]?.role, "regular");
		assert.strictEqual(tokens[0]?.content, undefined);
	});

	it("still parses a heading callout with its title and level", () => {
		const tokens = scanLineForCalloutTokens("### [!warning] Title");
		assert.strictEqual(tokens.length, 1);
		assert.strictEqual(tokens[0]?.role, "heading");
		assert.strictEqual(tokens[0]?.headingLevel, 3);
		assert.strictEqual(tokens[0]?.hasTitle, true);
	});

	it("does not give a heading token a payload", () => {
		const [heading] = scanLineForCalloutTokens("### [!warning]{Title}");
		assert.strictEqual(heading?.role, "heading");
		assert.strictEqual(heading?.content, undefined);
	});

	it("still finds inline pills inside a heading's title", () => {
		const tokens = scanLineForCalloutTokens("## [!info] see [!tip]{here}");
		assert.deepStrictEqual(
			tokens.map((t) => [t.role, t.rawId]),
			[
				["heading", "info"],
				["inline", "tip"],
			],
		);
	});

	it("still rejects a markdown link whose text starts with `!`", () => {
		assert.deepStrictEqual(inlineShape("[!name](https://example.com)"), []);
	});

	it("still rejects a blank type", () => {
		assert.deepStrictEqual(inlineShape("[!]{x}"), []);
		assert.deepStrictEqual(inlineShape("[! ]{x}"), []);
	});

	it("still spans the whole bracket including metadata", () => {
		const line = "x [!note|purple] y";
		const [token] = inlineTokens(line);
		assert.ok(token);
		assert.strictEqual(line.slice(token.from, token.to), "[!note|purple]");
	});

	it("still distinguishes `[!x|]` from `[!x]`", () => {
		assert.strictEqual(inlineTokens("[!x|]")[0]?.hasMetadata, true);
		assert.strictEqual(inlineTokens("[!x]")[0]?.hasMetadata, false);
	});

	it("still bails cheaply on a line with no token", () => {
		assert.deepStrictEqual(scanLineForCalloutTokens("plain {text} here"), []);
	});
});
