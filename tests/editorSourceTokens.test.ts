import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EditorState } from "@codemirror/state";
import { StreamLanguage, syntaxTree } from "@codemirror/language";
import { editorLineCalloutTokens, excludedEditorRange } from "../src/editor/livepreview/sourceTokens";

/** Real CodeMirror language tree with multiline comment state. */
const comments = StreamLanguage.define({
	startState: () => ({ comment: false }),
	token(stream, state) {
		if (stream.match("%%")) { state.comment = !state.comment; return "comment"; }
		if (state.comment) { stream.next(); return "comment"; }
		stream.next(); return null;
	},
});

function found(state: EditorState): string[] {
	const ids: string[] = [];
	for (let n = 1; n <= state.doc.lines; n++) {
		const line = state.doc.line(n);
		ids.push(...editorLineCalloutTokens(state, line.from, line.text).map(token => token.rawId));
	}
	return ids;
}

describe("render surfaces share complete source exclusions", () => {
	it("uses CodeMirror comment nodes, including a heading at a later comment line", () => {
		const state = EditorState.create({ doc: "%%\n## [!fake]\ntext [!also-fake]\n%%\n## [!real]", extensions: [comments] });
		assert.match(syntaxTree(state).resolveInner(state.doc.toString().indexOf("[!fake]") + 2, 1).name, /Comment/i);
		assert.deepEqual(found(state), ["real"]);
	});

	it("keeps genuine tokens on each side of a comment", () => {
		const state = EditorState.create({ doc: "[!first] %% [!fake] %% [!second]", extensions: [comments] });
		assert.deepEqual(found(state), ["first", "second"]);
	});

	it("never allows comments to create a token across an excluded range", () => {
		const state = EditorState.create({ doc: "[!not%%hidden%%real] [!real]", extensions: [comments] });
		assert.deepEqual(found(state), ["real"]);
	});

	it("uses the source lexer for embedded previews without a Markdown language", () => {
		const state = EditorState.create({ doc: "%%\n## [!fake]\n%%\n```\n[!fake]\n```\n\n    [!fake]\n\ntext ``\n[!fake]\n`` [!real]" });
		assert.deepEqual(found(state), ["real"]);
		assert.deepEqual(found(state), ["real"], "cached reads agree");
	});

	it("invalidates cached preview context with the document identity", () => {
		const state = EditorState.create({ doc: "%%\n[!fake]\n%%\n[!real]" });
		assert.deepEqual(found(state), ["real"]);
		const edited = state.update({ changes: { from: 0, to: 2 } }).state;
		assert.deepEqual(found(edited), ["fake"]);
	});

	it("keeps a list's continuation headers eligible in previews", () => {
		const state = EditorState.create({ doc: "- item\n    > [!real]" });
		const line = state.doc.line(2);
		assert.equal(editorLineCalloutTokens(state, line.from, line.text)[0]?.role, "regular");
	});

	it("excludes wikilink-reference ranges in multiline preview comments", () => {
		const state = EditorState.create({ doc: "%%\n[[note#[!fake]]]\n%%" });
		const line = state.doc.line(2);
		assert.equal(excludedEditorRange(state, line.from + 7, line.from + 14), true);
	});
});
