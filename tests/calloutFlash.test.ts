import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EditorState, type Extension, type StateEffect, type TransactionSpec } from "@codemirror/state";
import { foldEffect, foldState, unfoldEffect } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import type { Editor } from "obsidian";
import {
	CSS_FLASH_DELAYED,
	CSS_FLASH_LINE,
	CSS_FLASH_MARK,
	calloutFlashField,
	renderedBlockCallout,
	revealCalloutInEditor,
	setCalloutFlash,
	type CalloutFlash,
} from "../src/editor/calloutFlash";
import { calloutExtentAt, linesOf } from "../src/editor/calloutExtent";
import { FakeElement, installFakeDom } from "./support/fakeDom";

const dom = installFakeDom();

const flashOf = (content: string, line: number, from: number, delayed = false): CalloutFlash =>
	({ extent: calloutExtentAt(linesOf(content), line, from)!, delayed });

function decorations(state: EditorState): Array<[number, number, string]> {
	const out: Array<[number, number, string]> = [];
	state.field(calloutFlashField).decorations.between(0, state.doc.length, (from, to, value) => {
		out.push([from, to, String((value.spec as { class?: string }).class)]);
	});
	return out;
}

/** A stand-in `editor.cm` that applies what navigation dispatches. */
function fakeEditor(content: string, extensions: Extension[] = [calloutFlashField]) {
	let state = EditorState.create({ doc: content, extensions });
	const dispatched: TransactionSpec[] = [];
	const cm = {
		get state() { return state; },
		dom: { isConnected: true },
		dispatch(spec: TransactionSpec) { dispatched.push(spec); state = state.update(spec).state; },
	};
	const editor = { cm, scrollIntoView: () => { throw new Error("must go through CodeMirror"); } } as unknown as Editor;
	const effects = (at: number): readonly StateEffect<unknown>[] => {
		const value: StateEffect<unknown> | readonly StateEffect<unknown>[] = dispatched[at]?.effects ?? [];
		return ([] as StateEffect<unknown>[]).concat(value);
	};
	return { editor, cm, dispatched, effects, state: () => state };
}

describe("landing flash decorations", () => {
	const BLOCK = "intro\n> [!note] Title\n> body\n\nafter";
	it("decorates every line of a block callout and nothing else", () => {
		const state = EditorState.create({ doc: BLOCK, extensions: [calloutFlashField] })
			.update({ effects: setCalloutFlash.of(flashOf(BLOCK, 1, 2)) }).state;
		assert.deepEqual(decorations(state), [[6, 6, CSS_FLASH_LINE], [22, 22, CSS_FLASH_LINE]]);
	});
	it("marks an inline pill with its payload, delayed on request, and follows edits above it", () => {
		const content = "Say [!tip]{word} now";
		let state = EditorState.create({ doc: content, extensions: [calloutFlashField] })
			.update({ effects: setCalloutFlash.of(flashOf(content, 0, 4, true)) }).state;
		assert.deepEqual(decorations(state), [[4, 16, `${CSS_FLASH_MARK} ${CSS_FLASH_DELAYED}`]]);
		// Found in the live app: a plain mark starts after the pill's replace
		// widget at the same offset, so it never wraps the pill and nothing flashes.
		state.field(calloutFlashField).decorations.between(0, state.doc.length, (_from, _to, value) => {
			assert.equal((value.spec as { inclusive?: boolean }).inclusive, true);
		});
		state = state.update({ changes: { from: 0, insert: ">> " } }).state;
		assert.deepEqual(decorations(state).map(([from, to]) => [from, to]), [[7, 19]]);
		state = state.update({ effects: setCalloutFlash.of(null) }).state;
		assert.deepEqual(decorations(state), []);
		assert.equal(state.field(calloutFlashField).flash, null);
	});
});

describe("revealing a sidebar result", () => {
	it("scrolls from the callout's end back to its start and flashes it, without a selection", () => {
		const content = "intro\n> [!note] Title\n> body\n\nafter";
		const h = fakeEditor(content);
		revealCalloutInEditor(h.editor, linesOf(content), { from: { line: 1, ch: 2 }, to: { line: 1, ch: 9 } });
		assert.equal(h.dispatched.length, 1);
		assert.equal(h.dispatched[0]!.selection, undefined);
		const scroll = h.effects(0).map((effect) => (effect.value as { range?: { anchor: number; head: number } }).range)
			.find(Boolean);
		assert.deepEqual(scroll && [scroll.head, scroll.anchor], [6, 28], "head at the start, anchor at the end of the body");
		assert.equal(h.state().field(calloutFlashField).flash?.extent.endLine, 2);
	});
	it("opens a fold hiding the callout but never the callout's own fold", () => {
		const content = "# Section\nintro\n## [!note] Folded heading\nits body";
		const extensions = [calloutFlashField, foldState];
		const hidden = fakeEditor(content, extensions);
		hidden.cm.dispatch({ effects: foldEffect.of({ from: 9, to: content.length }) });
		revealCalloutInEditor(hidden.editor, linesOf(content), { from: { line: 2, ch: 3 }, to: { line: 2, ch: 10 } });
		assert.ok(hidden.effects(1).some((effect) => effect.is(unfoldEffect)));
		const own = fakeEditor(content, extensions);
		const headingEnd = content.indexOf("\nits body");
		own.cm.dispatch({ effects: foldEffect.of({ from: headingEnd, to: content.length }) });
		revealCalloutInEditor(own.editor, linesOf(content), { from: { line: 2, ch: 3 }, to: { line: 2, ch: 10 } });
		assert.equal(own.effects(1).some((effect) => effect.is(unfoldEffect)), false);
	});
	it("paints a running flash off for a frame so a second click replays it", () => {
		const content = "[!note] and more";
		const h = fakeEditor(content);
		const range = { from: { line: 0, ch: 0 }, to: { line: 0, ch: 7 } };
		revealCalloutInEditor(h.editor, linesOf(content), range);
		revealCalloutInEditor(h.editor, linesOf(content), range);
		assert.equal(h.state().field(calloutFlashField).flash, null);
		dom.window.flushFrames();
		assert.equal(h.state().field(calloutFlashField).flash, null, "one frame is not enough to repaint");
		dom.window.flushFrames();
		assert.equal(h.state().field(calloutFlashField).flash?.extent.kind, "inline");
	});
	it("falls back to the editor's own scroll without a CodeMirror view", () => {
		const scrolled: unknown[] = [];
		const editor = { scrollIntoView: (range: unknown, center: unknown) => scrolled.push([range, center]) } as unknown as Editor;
		revealCalloutInEditor(editor, linesOf("## [!note] Title"), { from: { line: 0, ch: 3 }, to: { line: 0, ch: 10 } });
		assert.deepEqual(scrolled, [[{ from: { line: 0, ch: 16 }, to: { line: 0, ch: 0 } }, true]]);
	});
});

describe("the Live Preview block widget a flash lights", () => {
	const CONTENT = "> [!note] Outer\n> body\n> > [!tip] Inner\n> > text\n\n> [!info] Next";
	function view(widgets: Array<{ line: number; ids: string[] }>) {
		const state = EditorState.create({ doc: CONTENT });
		const contentDOM = dom.document.createElement("div") as unknown as FakeElement;
		const positions = new Map<unknown, number>();
		for (const widget of widgets) {
			const el = contentDOM.createDiv({ cls: ["cm-embed-block", "cm-callout"] });
			let host: FakeElement = el;
			for (const id of widget.ids) host = host.createDiv({ cls: "callout", attr: { "data-callout": id } });
			positions.set(el, state.doc.line(widget.line + 1).from);
		}
		return {
			state, contentDOM,
			posAtDOM: (node: unknown) => { const pos = positions.get(node); if (pos === undefined) throw new Error("not a widget"); return pos; },
		} as unknown as EditorView;
	}
	const extent = (line: number, from: number) => calloutExtentAt(linesOf(CONTENT), line, from)!;
	it("finds a nested callout inside its outer widget, and each top-level callout in its own", () => {
		const v = view([{ line: 0, ids: ["note", "tip"] }, { line: 5, ids: ["info"] }]);
		assert.equal(renderedBlockCallout(v, extent(0, 2))?.getAttribute("data-callout"), "note");
		assert.equal(renderedBlockCallout(v, extent(2, 4))?.getAttribute("data-callout"), "tip");
		assert.equal(renderedBlockCallout(v, extent(5, 2))?.getAttribute("data-callout"), "info");
	});
	it("waits while the target's widget is not drawn, and falls back to the outer callout on a mismatch", () => {
		assert.equal(renderedBlockCallout(view([{ line: 0, ids: ["note", "tip"] }]), extent(5, 2)), null,
			"the widget above ended before the target");
		assert.equal(renderedBlockCallout(view([{ line: 0, ids: ["note", "other"] }]), extent(2, 4))?.getAttribute("data-callout"), "note");
	});
});
