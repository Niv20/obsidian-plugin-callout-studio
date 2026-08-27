/**
 * tests/previewReadOnly.test.ts — what actually stops a preview being edited.
 *
 * The settings previews were "read-only" for a long time on the strength of
 * `EditorState.readOnly.of(true)` plus three DOM handlers, and neither half
 * was the guarantee it looked like:
 *
 * - `readOnly` is **advisory**. CodeMirror's own docs say it "is consulted by
 *   commands and extensions that implement editing functionality" — it does
 *   not reject `dispatch({changes})`. Anything calling the editor API directly
 *   sailed straight through.
 * - The `beforeinput` / `paste` / `drop` handlers only see browser-originated
 *   input, so they never fired for those calls either. The user got a silently
 *   mutated preview and no notice.
 *
 * That was not hypothetical. Obsidian's editor context menu — which an embedded
 * editor gets in full — offers Format, Paragraph and Insert submenus whose
 * items call `toggleBulletList()`, `setHeading()`, `toggleBlockquote()`,
 * `insertTable()`, `insertCallout()`, `insertCodeblock()` and `insertMathBlock()`
 * on the editor. All of them landed. So did this plugin's own fold-marker and
 * cut-section items, which write through `editor.replaceRange`.
 *
 * The fix is a `transactionFilter`, because that is the one point every route
 * converges on: they all end at `cm.dispatch`. This suite pins that it blocks
 * what it must, that it lets through what a preview still needs (selection
 * moves are what make Live Preview reveal raw markdown on click), and that the
 * plugin's own reseed can still get past it.
 *
 * Deliberately built on a bare `EditorState` rather than an Obsidian editor:
 * the rule is a CodeMirror rule, and testing it through the embed would test
 * the stub instead.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	EditorSelection,
	EditorState,
	StateEffect,
	type Extension,
	type TransactionSpec,
} from "@codemirror/state";
import { readOnlyPreviewExtensions } from "../src/settings/previewReadOnly";

const DOC = "> [!note] Note\n> body\n\ntail";

/** A state carrying the read-only extensions, plus what a case asserts on. */
function harness(): {
	state: EditorState;
	attempts: () => number;
	gate: ReturnType<typeof readOnlyPreviewExtensions>["gate"];
	/** Apply a transaction spec and hand back the resulting document. */
	apply: (spec: TransactionSpec) => string;
} {
	let attempts = 0;
	const { extensions, gate } = readOnlyPreviewExtensions({
		onEditAttempt: () => attempts++,
	});
	let state = EditorState.create({
		doc: DOC,
		extensions: extensions as Extension,
	});
	return {
		get state() {
			return state;
		},
		attempts: () => attempts,
		gate,
		apply: (spec) => {
			state = state.update(spec).state;
			return state.doc.toString();
		},
	};
}

/* -------------------------------------------------------------------------- */
/* What it blocks                                                             */
/* -------------------------------------------------------------------------- */

describe("the read-only preview filter blocks document changes", () => {
	// >>> REGRESSION: the context menu's Format/Paragraph/Insert commands <<<
	it("drops a programmatic change and reports the attempt", () => {
		// `Editor.replaceRange`, `replaceSelection`, `setHeading` and every
		// other editor-API write reaches CodeMirror exactly like this.
		const h = harness();
		assert.strictEqual(h.apply({ changes: { from: 0, insert: "x" } }), DOC);
		assert.strictEqual(h.attempts(), 1);
	});

	it("drops a deletion just as readily as an insertion", () => {
		const h = harness();
		assert.strictEqual(h.apply({ changes: { from: 0, to: 5 } }), DOC);
		assert.strictEqual(h.attempts(), 1);
	});

	it("drops a change even when it is bundled with a selection move", () => {
		// A single transaction carrying both is the shape most editor commands
		// dispatch. Keeping the selection half would leave the caret claiming
		// an edit happened.
		const h = harness();
		assert.strictEqual(
			h.apply({
				changes: { from: 0, insert: "x" },
				selection: EditorSelection.cursor(1),
			}),
			DOC,
		);
		assert.strictEqual(h.attempts(), 1);
	});

	it("reports once per attempt, so the notice throttle sees each one", () => {
		const h = harness();
		h.apply({ changes: { from: 0, insert: "a" } });
		h.apply({ changes: { from: 0, insert: "b" } });
		assert.strictEqual(h.attempts(), 2);
	});

	it("still sets EditorState.readOnly, so commands decline first", () => {
		// Not the guarantee, but worth keeping: a well-behaved command checks
		// this and never dispatches, which is cheaper than filtering it and
		// avoids a notice for something the user did not really try to do.
		assert.strictEqual(harness().state.readOnly, true);
	});
});

/* -------------------------------------------------------------------------- */
/* What it must NOT block                                                     */
/* -------------------------------------------------------------------------- */

describe("the read-only preview filter leaves everything else alone", () => {
	it("lets a selection-only transaction through", () => {
		// This is the one that matters most: Live Preview reveals a line's raw
		// markdown by cursor position, so blocking selection would turn the
		// preview into a static render with extra steps.
		const h = harness();
		h.apply({ selection: EditorSelection.cursor(3) });
		assert.strictEqual(h.state.selection.main.head, 3);
		assert.strictEqual(h.attempts(), 0);
	});

	it("lets an effect-only transaction through", () => {
		// `calloutStudioRefresh` is dispatched on every form change to rebuild
		// the heading/inline decorations. It changes no text and must not be
		// mistaken for an edit.
		const marker = StateEffect.define<null>();
		const h = harness();
		const tr = h.state.update({ effects: marker.of(null) });
		assert.ok(tr.effects.some((e) => e.is(marker)));
		assert.strictEqual(h.attempts(), 0);
	});

	it("needs no callbacks at all to build", () => {
		// The blur hook and the attempt hook are both optional: the module is
		// the rule, and an editor that wants neither notice nor caret parking
		// still gets the immutability.
		const { extensions, gate } = readOnlyPreviewExtensions();
		const state = EditorState.create({
			doc: DOC,
			extensions: extensions as Extension,
		});
		assert.strictEqual(state.readOnly, true);
		assert.strictEqual(gate.isOpen, false);
		assert.strictEqual(
			state
				.update({ changes: { from: 0, insert: "x" } })
				.state.doc.toString(),
			DOC,
		);
	});
});

/* -------------------------------------------------------------------------- */
/* The gate                                                                   */
/* -------------------------------------------------------------------------- */

describe("the write gate", () => {
	it("lets the plugin's own reseed land", () => {
		// `setValue()` replaces the whole sample when the form it mirrors
		// changes. Without a way through, the filter would freeze the preview
		// on its first sample forever.
		const h = harness();
		const next = h.gate.allow(() =>
			h.apply({ changes: { from: 0, to: DOC.length, insert: "new" } }),
		);
		assert.strictEqual(next, "new");
		assert.strictEqual(h.attempts(), 0);
	});

	it("closes again afterwards", () => {
		const h = harness();
		h.gate.allow(() => h.apply({ changes: { from: 0, insert: "ok " } }));
		const after = h.state.doc.toString();
		assert.strictEqual(
			h.apply({ changes: { from: 0, insert: "x" } }),
			after,
		);
		assert.strictEqual(h.attempts(), 1);
	});

	it("closes even when the write throws", () => {
		// A `finally`, not a trailing assignment. A reseed that throws halfway
		// must not leave the preview permanently writable.
		const h = harness();
		assert.throws(() =>
			h.gate.allow(() => {
				throw new Error("boom");
			}),
		);
		assert.strictEqual(h.gate.isOpen, false);
		assert.strictEqual(h.apply({ changes: { from: 0, insert: "x" } }), DOC);
	});

	it("is closed to begin with", () => {
		assert.strictEqual(harness().gate.isOpen, false);
	});
});
