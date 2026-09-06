import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eachBlock, stripComments } from "../src/manager/theme/cssBlocks";

function blocks(css: string): Map<string, string> {
	const result = new Map<string, string>();
	eachBlock(stripComments(css), (selector, body) => result.set(selector.trim(), body.trim()));
	return result;
}

describe("CSS structural punctuation", () => {
	for (const value of ['"{"', '"}"', String.raw`"a\"{b"`, "'/* { */'", 'url("data:image/svg+xml,<svg>{}</svg>")']) {
		it(`keeps rules after a literal ${value}`, () => {
			const found = blocks(`.label { content:${value}; } .callout[data-callout=example] { color:red; }`);
			assert.equal(found.get(".label"), `content:${value};`);
			assert.equal(found.get(".callout[data-callout=example]"), "color:red;");
			assert.equal(found.size, 2);
		});
	}

	it("keeps braces inside attribute selectors and escaped selector names", () => {
		const found = blocks(String.raw`.a\{b[title="}"] { color:red; } .next { color:blue; }`);
		assert.equal(found.get(String.raw`.a\{b[title="}"]`), "color:red;");
		assert.equal(found.get(".next"), "color:blue;");
	});

	it("preserves quoted declarations on both sides of genuine nested rules", () => {
		const found = blocks('.callout { content:"{"; & .title { color:red; } --label:"}"; }');
		assert.equal(found.get(".callout .title"), "color:red;");
		assert.equal(found.get(".callout"), 'content:"{"; --label:"}";');
	});

	it("removes real comments without deleting quoted comment markers", () => {
		assert.equal(stripComments('.a { content:"/*keep*/"; } /* } */ .b{}'), '.a { content:"/*keep*/"; }  .b{}');
		assert.equal(stripComments('.a{} /* unfinished'), '.a{} ');
	});
});
