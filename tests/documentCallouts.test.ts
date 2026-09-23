import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { iterateDocumentCalloutLines, iterateDocumentCallouts } from "../src/editor/documentCallouts";
import { forEachCalloutToken, scanLineForCalloutTokens } from "../src/editor/calloutTokens";
import { isCalloutTokenInCode } from "../src/editor/calloutCodeContext";
import { calloutIdentity } from "../src/utils/calloutId";
import { scanStringForUnknownCallouts } from "../src/utils/vaultCalloutScanner";

const ids = (source: string) => Array.from(iterateDocumentCallouts(source), ({ token }) => token.rawId);
const roles = (source: string) => Array.from(iterateDocumentCallouts(source), ({ token }) => [token.rawId, token.role]);

const exclusions: Array<[string, string, string[]]> = [
	["backtick fence", "```md\n[!fake]\n```\n[!real]", ["real"]],
	["tilde fence", "~~~\n[!fake]\n~~~\n[!real]", ["real"]],
	["unclosed fence", "[!real]\n```\n[!fake]", ["real"]],
	["short closer", "````\n```\n[!fake]\n````\n[!real]", ["real"]],
	["wrong closer", "```\n~~~\n[!fake]\n```\n[!real]", ["real"]],
	["trailing closer text", "```\n``` not a closer\n[!fake]\n```\n[!real]", ["real"]],
	["backticks in info invalidate an opener", "```bad`info [!real]", ["real"]],
	["quoted fence", "> ```\n> [!fake]\n> ```\n[!real]", ["real"]],
	["quote container ends an unclosed fence", "> ```\n> [!fake]\n[!real]", ["real"]],
	["list fence", "- ```\n  [!fake]\n  ```\n[!real]", ["real"]],
	["a sibling list item ends an unclosed list fence", "- ```\n  [!fake]\n- [!real]", ["real"]],
	["list-looking text inside a list fence remains code", "- ```\n  - [!fake]\n  ```\n[!real]", ["real"]],
	["indented code", "    [!fake]\n\t[!also-fake]\n[!real]", ["real"]],
	["indented code after a blank", "paragraph\n\n    [!fake]\n[!real]", ["real"]],
	["code indentation cannot interrupt a paragraph", "paragraph\n    [!real]", ["real"]],
	["leading inline callout is still a paragraph", "[!first]{body}\n    [!second]", ["first", "second"]],
	["list content is not indented code", "- item\n    [!real]", ["real"]],
	["list nested code", "- item\n\n      [!fake]\n\n  [!real]", ["real"]],
	["code in a quote", ">     [!fake]\n> [!real]", ["real"]],
	["inline code", "`[!fake]` [!real]", ["real"]],
	["double backticks", "`` `[!fake]` `` [!real]", ["real"]],
	["triple code span", "x ``` ``[!fake]` ``` [!real]", ["real"]],
	["unequal unmatched runs remain literal", "`[!real]``", ["real"]],
	["multiline single code span", "text `code\n[!fake]\ncode` [!real]", ["real"]],
	["multiline double code span", "text ``code\n[!fake] ` x\ncode`` [!real]", ["real"]],
	["blank lines stop code spans", "text `[!first]\n\n[!second]`", ["first", "second"]],
	["headings stop code spans", "text `[!first]\n# [!second]`", ["first", "second"]],
	["quote starts a new block after an unmatched code delimiter", "text `[!first]\n> [!second]\n`", ["first", "second"]],
	["code spans do not leave their quote", "> text `[!first]\n[!second]`", ["first", "second"]],
	["multiline code spans within one quote", "> text `code\n> [!fake]\n> end` [!real]", ["real"]],
	["heading code cannot continue into another paragraph", "# text `[!first]\n[!second]`", ["first", "second"]],
	["escaping one tick leaves the following tick active", "\\``[!fake]` [!real]", ["real"]],
	["same-line comment", "[!first] %% [!fake] %% [!second]", ["first", "second"]],
	["several comments", "%%[!fake]%%[!first]%%[!fake]%%[!second]", ["first", "second"]],
	["multiline comment", "[!first] %%\n[!fake]\n%% [!second]", ["first", "second"]],
	["unclosed comment", "[!first] %% [!fake]\n[!also-fake]", ["first"]],
	["empty comment", "%%%%[!real]", ["real"]],
	["comment delimiter inside code", "`%% [!fake]` [!real]", ["real"]],
	["comment inside multiline code", "text ``%%\n[!fake]\n%%`` [!real]", ["real"]],
	["comment inside fence", "```\n%% [!fake]\n```\n[!real]", ["real"]],
	["comment inside indented code", "    %% [!fake]\n[!real]", ["real"]],
	["fence inside comment", "%%\n```\n[!fake]\n%%\n[!real]", ["real"]],
	["inline code inside comment", "%% `[!fake]\n%% [!real]", ["real"]],
	["comment ignores quotes and blank lines", "%%\n> ```\n\n# [!fake]\n%%\n[!real]", ["real"]],
	["frontmatter", "---\ntags: [!fake]\n---\n[!real]", ["real"]],
	["frontmatter terminator", "---\ntags: [!fake]\n...\n[!real]", ["real"]],
	["frontmatter BOM", "\uFEFF---\n[!fake]\n---\n[!real]", ["real"]],
	["later horizontal rule is not frontmatter", "text\n---\n[!real]", ["real"]],
	["mask cannot fabricate token bodies", "[!not%%hidden%%real] [!not`code`real] [!real]", ["real"]],
	["escapes respect odd/even backslash runs", "\\[!fake] \\\\[!real] \\\\\\[!fake]", ["real"]],
	["escaped code delimiter", "\\`[!real]", ["real"]],
	["wikilinks and links", "[[note#[!fake]]] [!fake](url) [!real]", ["real"]],
	["open wikilink", "[!real] [[note [!fake]", ["real"]],
	["unknown and registered spelling have identical syntax", "[!note][!new-unregistered-type]", ["note", "new-unregistered-type"]],
];

describe("document callouts: context exclusions", () => {
	for (const [name, source, expected] of exclusions) {
		it(name, () => assert.deepEqual(ids(source), expected));
		it(`${name} (CRLF)`, () => assert.deepEqual(ids(source.replaceAll("\n", "\r\n")), expected));
	}

	it("every existing whole-document callback uses the same exclusions", () => {
		for (const [, source, expected] of exclusions) {
			const found: string[] = [];
			forEachCalloutToken(source, rawId => found.push(rawId));
			assert.deepEqual(found, expected, source);
		}
	});

	it("discovery reads unknown ids without mutating the known-id set", () => {
		const known = new Set(["note"]);
		assert.deepEqual(scanStringForUnknownCallouts("[!note] [!novel] %%[!fake]%%", known), ["novel"]);
		assert.deepEqual(Array.from(known), ["note"]);
	});
});

describe("document callouts: source roles, syntax and positions", () => {
	it("accepts one to six heading markers and repeated separator whitespace", () => {
		for (let count = 1; count <= 6; count++) {
			for (const indent of ["", " ", "  ", "   "]) {
				const [match] = Array.from(iterateDocumentCallouts(`${indent}${"#".repeat(count)} \t  [!note] title`));
				assert.equal(match?.token.role, "heading");
				assert.equal(match?.token.headingLevel, count);
			}
		}
	});

	it("does not invent headings from malformed markers or hashes in prose", () => {
		for (const source of ["####### [!note]", "#[!note]", "text # [!note]", "## title [!note]", "> # [!note]"]) {
			assert.deepEqual(roles(source), [["note", "inline"]], source);
		}
	});

	it("accepts irregular quote spacing at each nesting level and inside lists", () => {
		for (const source of [">[!note]", ">   [!note]", "  >  >   [!note]", "- >   [!note]", "- item\n    > [!note]"]) {
			assert.deepEqual(roles(source), [["note", "regular"]], source);
		}
	});

	it("keeps heading title pills, but native block titles stay native", () => {
		assert.deepEqual(roles("## [!heading] title [!inline]\n> [!block] title [!native]"), [
			["heading", "heading"], ["inline", "inline"], ["block", "regular"],
		]);
	});

	it("keeps original spelling and all metadata while identity ignores it", () => {
		const source = "😀 [!  Custom   TYPE |one|two] [!empty|]";
		const entries = Array.from(iterateDocumentCallouts(source));
		assert.equal(entries[0]?.token.rawId, "  Custom   TYPE ");
		assert.equal(calloutIdentity(entries[0].token.rawId), "custom-type");
		assert.equal(entries[0]?.token.metadata, "one|two");
		assert.equal(entries[0]?.token.from, 3);
		assert.equal(entries[1]?.token.hasMetadata, true);
		for (const { token } of entries) assert.equal(source.slice(token.from, token.to), `[!${token.rawId}|${token.metadata}]`);
	});

	it("returns absolute UTF-16 offsets through blank lines, CRLF and emoji", () => {
		const source = "😀\r\n\r\n  ## [!heading]\r\n[!one][!two]";
		const entries = Array.from(iterateDocumentCallouts(source));
		assert.deepEqual(entries.map(entry => [entry.lineIndex, entry.lineOffset]), [[2, 6], [3, 23], [3, 23]]);
		for (const { token, lineOffset } of entries) assert.equal(source.slice(lineOffset + token.from, lineOffset + token.to), `[!${token.rawId}]`);
		assert.equal(entries[0]?.token.role, "heading");
	});

	it("preserves open and nested payload usage semantics and literal payload bytes", () => {
		const source = "[!outer]{outer `}` %% } %% [!inner]{text}} [!open]{unfinished";
		const entries = Array.from(iterateDocumentCallouts(source));
		assert.deepEqual(entries.map(({ token }) => token.rawId), ["outer", "inner", "open"]);
		assert.equal(entries[0]?.token.content?.text, "outer `}` %% } %% [!inner]{text}");
		assert.equal(entries[2]?.token.contentOpen, true);
		assert.equal(Array.from(iterateDocumentCallouts(source, { inlineContent: false }))[0]?.token.content, undefined);
	});

	it("rejects empty ids, multiline tokens, and malformed nested brackets", () => {
		assert.deepEqual(ids("[!] [! ] [!|metadata] [!bad\nid] [!nested[bracket]] [!valid]"), ["valid"]);
	});

	it("malformed block headers do not hide a later valid inline reference", () => {
		assert.deepEqual(roles("> [!broken[nested]] and [!real]"), [["real", "inline"]]);
	});

	it("comments cannot turn a middle-of-line token into a heading or block", () => {
		assert.deepEqual(roles("# %%hidden%% [!note]\n> %%hidden%% [!note]"), [["note", "inline"], ["note", "inline"]]);
	});

	it("line parser uses the same inline exclusions", () => {
		for (const [, source, expected] of exclusions.filter(([, source]) => !source.includes("\n"))) {
			assert.deepEqual(scanLineForCalloutTokens(source).map(token => token.rawId), expected, source);
		}
	});

	it("handles deeply malformed token openings without repeated suffix scans", () => {
		assert.deepEqual(ids("[!".repeat(20000) + "valid]"), ["valid"]);
	});

	it("yields empty and excluded lines for cooperative scans and keeps generators independent", () => {
		const first = iterateDocumentCalloutLines("%%\n[!fake]\n%%\n[!real]");
		const initial = first.next();
		assert.equal(initial.done, false);
		if (initial.done) throw new Error("Missing first line");
		assert.equal(initial.value.lineIndex, 0);
		assert.deepEqual(ids("[!separate]"), ["separate"]);
		assert.deepEqual(Array.from(first).map(line => line.tokens.map(token => token.rawId)), [[], [], ["real"]]);
		assert.equal(Array.from(iterateDocumentCalloutLines("\n".repeat(10000))).length, 10001);
	});
});

describe("autocomplete context uses document exclusions even for unfinished tokens", () => {
	const hidden = (source: string, lineIndex: number) => {
		const lines = source.split("\n"), line = lines[lineIndex]!;
		return isCalloutTokenInCode({ line, tokenIndex: line.indexOf("[!"), lineIndex, lineAt: index => lines[index]!, lineCount: lines.length });
	};
	it("rejects a trigger inside a multiline comment", () => assert.equal(hidden("%%\n[!unclosed\n%%", 1), true));
	it("rejects a trigger inside a multiline code span closed below the cursor", () => assert.equal(hidden("text ``\n[!unclosed\n``", 1), true));
	it("rejects top-level indented code", () => assert.equal(hidden("    [!unclosed", 0), true));
	it("accepts list continuation indentation", () => assert.equal(hidden("- item\n    [!unclosed", 1), false));
});
