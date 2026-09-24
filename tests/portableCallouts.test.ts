import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { convertPortableCallouts } from "../src/utils/portableCallouts";
import { applyPortableCalloutConversion, preparePortableCalloutConversion } from "../src/utils/portableCalloutVault";
import { portableVault } from "./support/portableVaultHarness";

const conversions: Array<[string, string, string]> = [
	["bare inline", "word [!type] word", "word type word"],
	["Hebrew bare inline", "מילה [!סוג] מילה", "מילה סוג מילה"],
	["Hebrew payload", "מילה [!סוג]{טקסט} מילה", "מילה טקסט מילה"],
	["metadata and source spelling", "[!  My TYPE |color|extra]", "My TYPE"],
	["unknown type", "[!not-registered]", "not-registered"],
	["adjacent bare pills", "[!one][!two]", "onetwo"],
	["adjacent payload pills", "[!one]{a}[!two]{b}", "ab"],
	["payload formatting", "Text [!note]{ **bold** and *italics* [link](https://example.com) } done", "Text  **bold** and *italics* [link](https://example.com)  done"],
	["empty payload", "A[!note]{}B", "AB"],
	["whitespace payload", "a [!note]{  } b", "a    b"],
	["nested literal braces", "[!note]{a {b} c}", "a {b} c"],
	["payload code braces", "[!note]{a `}` b}", "a `}` b"],
	["payload math braces", "[!note]{a $x_{1}$ b}", "a $x_{1}$ b"],
	["payload hidden tokens stay literal", "[!note]{`[!code]` $[!math]$ [[ref [!link]]]}", "`[!code]` $[!math]$ [[ref [!link]]]"],
	["payload spaces are not trimmed", "a [!note]{  inside  } z", "a   inside   z"],
	["spaced braces remain prose", "[!note] {text}", "note {text}"],
	["standalone heading", "# [!type]", "# type"],
	["leading heading decoration", "# [!type] Title", "# Title"],
	["trailing heading decoration", "# Title [!type]", "# Title"],
	["middle heading decoration", "# A [!type] B", "# A B"],
	["multiple heading decorations", "# [!one] A [!two] B [!three]", "# A B"],
	["heading IDs form title when alone", "# [!one] [!two]", "# one two"],
	["heading payload retains own text", "# Title [!type]{payload}", "# Title payload"],
	["heading empty payload retains type fallback", "# [!one] [!two]{}", "# one "],
	["heading whitespace payload retains type fallback", "# [!one] [!two]{  }", "# one   "],
	["heading comment payload retains type fallback", "# [!one] [!two]{<!-- hidden -->}", "# one <!-- hidden -->"],
	["heading title from trailing payload", "# [!one] [!two]{Title}", "# Title"],
	["heading leading braces are literal title", "# [!type]{Title}", "# {Title}"],
	["heading minus is literal title", "# [!type]- Title", "# - Title"],
	["heading plus is literal title", "# [!type]+", "# +"],
	["closing heading hashes alone", "# [!type] ###", "# type ###"],
	["closing heading hashes with title", "# [!type] Title ###", "# Title ###"],
	["heading with code title", "# [!type] `code`", "# `code`"],
	["heading with math title", "# [!type] $x$", "# $x$"],
	["heading comment-only title keeps type", "# [!type] <!-- hidden -->", "# type <!-- hidden -->"],
	["heading Obsidian comment-only title keeps type", "# [!type] %% hidden %%", "# type %% hidden %%"],
	["invalid heading remains prose", "#Title [!type]", "#Title type"],
	["seven hashes remain prose", "####### [!type]", "####### type"],
	["quoted heading uses inline role", "> # [!type] Title", "> # type Title"],
	["list heading", "- ## [!type] Title", "- ## Title"],
	["regular block body", "> [!note]+ Native [!title]\n> Text [!inline]{body}", "> [!note]+ Native [!title]\n> Text body"],
	["all native nesting depths", "> > [!note] Title\n> > body [!inline]", "> > [!note] Title\n> > body inline"],
	["hard breaks preserved", "Text [!note]  \nnext", "Text note  \nnext"],
	["BOM remains", "\uFEFF[!note]\ntext", "\uFEFFnote\ntext"],
	["escaped token with live sibling", "\\[!literal] [!live]", "\\[!literal] live"],
	["even backslashes leave token active", "\\\\[!live]", "\\\\live"],
	["literal ID formatting", "[!*bold*_&copy;|metadata]", "\\*bold\\*\\_&amp;copy;"],
	["payload cannot create heading", "[!note]{# Title}", "\\# Title"],
	["payload cannot create quote", "[!note]{> text}", "\\> text"],
	["payload cannot create list", "[!note]{- item}", "\\- item"],
	["payload cannot create numbered list", "[!note]{12. item}", "12\\. item"],
	["payload cannot create alternate numbered list", "[!note]{1) item}", "1\\) item"],
	["payload cannot create thematic break", "[!note]{---}", "\\---"],
	["payload cannot create setext heading", "previous\n[!note]{===}", "previous\n\\==="],
	["payload cannot create code indent", "[!note]{    code}", "&#32;   code"],
	["payload cannot create tab indent", "[!note]{\tcode}", "&#9;code"],
	["payload cannot create table row", "[!note]{| a | b |}", "\\| a | b |"],
	["empty payload cannot expose source marker", "[!note]{}# title", "\\# title"],
	["empty payload cannot create a reference definition", "[!note]{}[ref]: https://example.com\n[ref]", "\\[ref]: https://example.com\n[ref]"],
	["list payload cannot create nested heading", "- [!note]{# Title}", "- \\# Title"],
	["heading payload cannot create closing hashes", "# Title [!note]{###}", "# Title \\###"],
];

describe("portable callouts: source-preserving conversion", () => {
	it("preserves every recognized output through selectable unit planning and CRLF application", async () => {
		for (const [name, source, expected] of conversions) for (const newline of ["\n", "\r\n"]) {
			const h = portableVault({ "a.md": source.replaceAll("\n", newline) });
			const plan = await preparePortableCalloutConversion(h.app);
			assert.equal((await applyPortableCalloutConversion(h.app, plan)).status, "complete", name);
			assert.equal(h.contents.get("a.md"), expected.replaceAll("\n", newline), name);
		}
	});
	for (const [name, source, expected] of conversions) {
		it(name, () => assert.equal(convertPortableCallouts(source).content, expected));
		it(`${name} (CRLF and idempotence)`, () => {
			const result = convertPortableCallouts(source.replaceAll("\n", "\r\n"));
			assert.equal(result.content, expected.replaceAll("\n", "\r\n"));
			assert.equal(convertPortableCallouts(result.content).content, result.content);
			assert.equal(convertPortableCallouts(result.content).count, 0);
		});
	}
	it("reports converted roles", () => {
		assert.deepEqual(convertPortableCallouts("# [!a]\n# Title [!b]\nText [!c]{body}"), {
			content: "# a\n# Title\nText body", count: 3, headings: 2, inline: 1, skipped: 0,
		});
	});
	it("covers every heading level and legal indent", () => {
		for (let level = 1; level <= 6; level++) for (let indent = 0; indent <= 3; indent++) {
			const prefix = " ".repeat(indent) + "#".repeat(level) + " \t ";
			assert.equal(convertPortableCallouts(prefix + "[!type] Title").content, prefix + "Title");
		}
	});
});

const exclusions: Array<[string, string]> = [
	["fenced code", "```md\n[!type]\n```"],
	["tilde code", "~~~md\n[!type]\n~~~"],
	["quoted fenced code", "> ```\n> [!type]\n> ```"],
	["list fenced code", "- ```\n  [!type]\n  ```"],
	["indented code", "    [!type]"],
	["list indented code", "- item\n\n      [!type]"],
	["inline code", "`[!type]` ``[!type]``"],
	["multiline code", "text `code\n[!type]\ncode`"],
	["frontmatter", "---\nvalue: '[!type]'\n---"],
	["BOM frontmatter", "\uFEFF---\nvalue: '[!type]'\n..."],
	["Obsidian comment", "%% [!type] %%"],
	["multiline Obsidian comment", "%%\n[!type]\n%%"],
	["HTML comment", "<!-- [!type] -->"],
	["multiline HTML comment", "<!--\n[!type]\n-->"],
	["HTML attributes", '<img alt="[!type]" src="[!type]">'],
	["quoted HTML tag ending", '<img alt="a > [!type]">'],
	["HTML block", "<div>\n[!type]\n</div>"],
	["nested HTML block", "<div><div>[!a]</div>[!b]</div>"],
	["inline HTML contents", "<span>[!type]</span>"],
	["HTML close inside a comment", "<div><!-- </div> -->[!hidden]</div>"],
	["HTML close inside another tag attribute", '<div><span title="</div>">[!hidden]</span></div>'],
	["unclosed inline HTML", "<span>[!type]"],
	["raw script", "<script>\n[!type]\n</script>"],
	["inline math", "$x+[!type]$"],
	["numeric inline math", "$1+[!type]$"],
	["multiline inline math", "$x+\n[!type]\n+y$"],
	["display math", "$$[!type]$$"],
	["multiline display math", "$$\n[!type]\n$$"],
	["wikilink", "[[#[!type] Title]] [[file#[!type]|alias]]"],
	["direct callout-shaped link", "[!type](url)"],
	["link destination", "[label](file.md#[!type])"],
	["link title", '[label](file.md "[!type]")'],
	["link title closing parenthesis", '[label](file.md "text ) [!type]")'],
	["link nested parentheses", "[label](path(a)[!type])"],
	["nested link label", "[label [!type]](url)"],
	["image label", "![label [!type]](url)"],
	["explicit reference link", "[!type][ref]"],
	["collapsed reference link", "[!type][]"],
	["reference definition", '[ref]: file.md#[!type] "[!type]"'],
	["multiline reference definition", '[ref]:\n  file.md#[!type]\n  "[!type]"'],
	["shortcut reference", "[!type]\n\n[!type]: url"],
	["autolink", "<https://example.com/[!type]>"],
	["escaped syntax", "\\[!type]"],
	["native block header and title", "> [!native]- Title [!type]"],
	["invalid token", "[!] [! ] [!|metadata] [!bad\nid] [!bad[bracket]]"],
];

describe("portable callouts: protected contexts", () => {
	for (const [name, source] of exclusions) {
		it(name, () => {
			const result = convertPortableCallouts(source);
			assert.equal(result.content, source);
			assert.equal(result.count, 0);
			assert.equal(result.skipped, 0);
		});
		it(`${name} (CRLF)`, () => {
			const crlf = source.replaceAll("\n", "\r\n");
			assert.equal(convertPortableCallouts(crlf).content, crlf);
		});
	}
	it("conversion resumes after math, HTML and links", () => {
		assert.equal(convertPortableCallouts("$[!math]$ [!a] <span>[!html]</span> [!b] [x]([!link]) [!c]").content,
			"$[!math]$ a <span>[!html]</span> b [x]([!link]) c");
	});
	it("code and comments cannot begin math or HTML masks", () => {
		assert.equal(convertPortableCallouts('`$$ <div>` %% $$ <div> %% [!note]').content, '`$$ <div>` %% $$ <div> %% note');
	});
	it("unclosed raw HTML scanning remains bounded", () => {
		const source = "<span>".repeat(16000) + " [!note]";
		assert.equal(convertPortableCallouts(source).content, source);
	});
	it("unmatched price markers do not suppress prose", () => {
		assert.equal(convertPortableCallouts("$5 and $10 [!note]").content, "$5 and $10 note");
	});
	it("escaped math delimiters leave real tokens active", () => {
		assert.equal(convertPortableCallouts("\\$[!note]\\$").content, "\\$note\\$");
	});
	it("leaves an empty payload untouched when removal would create a raw HTML block", () => {
		const source = "[!note]{}<div>\nThis remains Markdown\n</div>";
		const result = convertPortableCallouts(source);
		assert.equal(result.content, source);
		assert.equal(result.count, 0);
		assert.equal(result.skipped, 1);
	});
});

describe("portable callouts: ambiguous syntax is never partially rewritten", () => {
	for (const source of ["[!outer]{unfinished", "[!outer]{text [!inner]", "[!outer]{text [!inner]{payload}}", "[!outer]{[!inner]}", "[!outer]{before <span>}</span> after}", "[!broken[!inner]]"]) {
		it(source, () => {
			const result = convertPortableCallouts(source);
			assert.equal(result.content, source);
			assert.equal(result.count, 0);
			assert.ok(result.skipped > 0);
		});
	}
	it("independent safe tokens still convert", () => {
		const result = convertPortableCallouts("[!safe] [!open]{unfinished [!inner]");
		assert.equal(result.content, "safe [!open]{unfinished [!inner]");
		assert.equal(result.count, 1);
		assert.equal(result.skipped, 2);
	});
	it("a malformed token does not destroy a later safe occurrence", () => {
		assert.equal(convertPortableCallouts("[!broken[nested]] [!safe]").content, "[!broken[nested]] safe");
	});
});
