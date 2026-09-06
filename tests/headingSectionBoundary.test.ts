import assert from "node:assert";
import { describe, it } from "node:test";
import { EditorState } from "@codemirror/state";
import { foldService } from "@codemirror/language";
import { getHeadingSectionRange, deleteHeadingSection } from "../src/editor/contextmenu/sectionOps";
import { asEditor, editor } from "./support/fakeEditor";

describe("heading section Markdown boundaries", () => {
	for (const body of [
		"```sh\n# shell comment\necho hello\n```",
		"````md\n```\n## still code\n```\n````",
		"~~~md\n```\n## still code\n~~~",
		"<!--\n```\n# comment heading\n-->",
		"$$\n## math\n```\n$$",
		"<div>\n## raw HTML\n</div>\n",
		"<script>\n# script comment\n</script>",
		"> ```\n> ## quoted example",
	]) {
		it(`keeps excluded content whole: ${JSON.stringify(body)}`, () => {
			const e = editor(`## [!note] First\n${body}\n## Next\nKeep me`);
			deleteHeadingSection(asEditor(e), getHeadingSectionRange(asEditor(e), 0, 2));
			assert.strictEqual(e.getValue(), "## Next\nKeep me");
		});
	}
	for (const next of ["   ## Indented", "##", "Setext\n---", "Setext\n==="]) {
		it(`preserves the following heading: ${JSON.stringify(next)}`, () => {
			const e = editor(`## [!note] First\nbody\n\n${next}\nKeep me`);
			deleteHeadingSection(asEditor(e), getHeadingSectionRange(asEditor(e), 0, 2));
			assert.strictEqual(e.getValue(), `${next}\nKeep me`);
		});
	}
	it("does not promote four-space indented code to a heading", () => {
		const e = editor("## [!note] First\n    ## code\n## Next");
		assert.strictEqual(getHeadingSectionRange(asEditor(e), 0, 2).text, "## [!note] First\n    ## code\n");
	});
	it("keeps an unterminated long fence through EOF", () => {
		const text = "## [!note] First\n````\n```\n## still code";
		const e = editor(text);
		assert.strictEqual(getHeadingSectionRange(asEditor(e), 0, 2).text, text);
	});
	it("does not open an HTML comment from inline code", () => {
		const e = editor("## [!note] First\n`<!--` example\n## Next");
		assert.strictEqual(getHeadingSectionRange(asEditor(e), 0, 2).text, "## [!note] First\n`<!--` example\n");
	});
	it("uses the current native fold service for richer Markdown structure", () => {
		const text = "## [!note] First\n<div>\n## not a heading\n</div>\n\n## Next";
		const e = editor(text);
		const state = EditorState.create({ doc: text, extensions: [foldService.of((_state, _from, to) => ({ from: to, to: text.indexOf("\n## Next") }))] });
		Object.assign(e, { cm: { state } });
		deleteHeadingSection(asEditor(e), getHeadingSectionRange(asEditor(e), 0, 2));
		assert.strictEqual(e.getValue(), "## Next");
	});
});
