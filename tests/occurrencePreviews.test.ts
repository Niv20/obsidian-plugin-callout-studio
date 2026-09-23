import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scanCalloutOccurrences } from "../src/usage/scanCalloutOccurrences";

describe("occurrence previews", () => {
	it("shows raw header syntax and the first actual block body without changing source coordinates", () => {
		const source = "> [!note]+ A title\n>\n> %% hidden %%\n> Actual body\n> More content";
		const [entry] = scanCalloutOccurrences("a.md", source);
		assert.equal(entry?.excerpt, "> [!note]+ A title\n> Actual body");
		assert.equal(entry.lineText, "> [!note]+ A title");
		assert.deepEqual([entry.line, entry.from, entry.to], [0, 2, 9]);
	});

	it("keeps untitled block syntax and skips bodies made entirely of fenced code or comments", () => {
		const source = "> [!note]\n> ```\n> fake body\n> ```\n> %% hidden\n> still hidden %%\n> Visible body";
		assert.equal(scanCalloutOccurrences("a.md", source)[0]?.excerpt, "> [!note]\n> Visible body");
	});

	it("does not take text from outside the callout or a neighboring callout", () => {
		const source = "> [!one] Title\nOutside\n> [!two]\n> [!three] Third\n> Body";
		assert.deepEqual(scanCalloutOccurrences("a.md", source).map((entry) => entry.excerpt), [
			"> [!one] Title", "> [!two]", "> [!three] Third\n> Body",
		]);
	});

	it("does not attach a nested block body to its parent and keeps previews short", () => {
		const source = `> [!outer] Outer\n>> [!inner] ${"T".repeat(300)}\n>> ${"B".repeat(400)}`;
		const [outer, inner] = scanCalloutOccurrences("a.md", source);
		assert.equal(outer?.excerpt, "> [!outer] Outer");
		assert.deepEqual(inner?.excerpt.split("\n").map((line) => line.length), [90, 180]);
	});

	it("preserves multiple inline results and makes CRLF excerpts match editor text", () => {
		const source = "> [!note] Title\r\n> Body\r\nText [!one] [!two]";
		const entries = scanCalloutOccurrences("a.md", source);
		assert.equal(entries.length, 3);
		assert.equal(entries[0]?.excerpt, "> [!note] Title\n> Body");
		assert.ok(entries[1]?.excerpt.includes("[!one] [!two]"));
		assert.deepEqual(entries, scanCalloutOccurrences("a.md", source.replace(/\r/g, "")));
	});
	it("includes a list item used as the first visible inner content", () => {
		assert.equal(scanCalloutOccurrences("a.md", "> [!note] Title\n> - First item\n> - Second item")[0]?.excerpt,
			"> [!note] Title\n> - First item");
	});

	it("preserves raw metadata, spacing, formatting and list syntax on selected content lines", () => {
		const source = ">  [!note|purple]- **Title**\n>  - **Body** with `code` and [a link](target.md)";
		const [entry] = scanCalloutOccurrences("a.md", source);
		assert.equal(entry?.excerpt, source);
	});

	it("keeps heading and inline markers visible without rendering their Markdown", () => {
		const source = "## [!note] **Heading**\nText [!tip] `code` [!warning]";
		const entries = scanCalloutOccurrences("a.md", source);
		assert.deepEqual(entries.map((entry) => entry.excerpt), [
			"## [!note] **Heading**", "Text [!tip] `code` [!warning]", "Text [!tip] `code` [!warning]",
		]);
	});

	it("keeps one raw header line for blocks whose entire bodies are excluded", () => {
		const source = "> [!note] Title\n> %% comments with > [!fake] %%\n> ```\n> [!fake]\n> ```";
		assert.deepEqual(scanCalloutOccurrences("a.md", source).map((entry) => entry.excerpt), ["> [!note] Title"]);
	});
});
