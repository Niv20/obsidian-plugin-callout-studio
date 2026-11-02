/**
 * tests/headingFold.test.ts — heading-callout folding, and the gate in front of it.
 *
 * `livepreview/fold.ts` folds through `@codemirror/language`, which Obsidian
 * supplies at runtime — so `foldable`/`foldEffect`/`foldedRanges` are the SAME
 * service and effect instances the native pre-heading arrow uses, and folds made
 * here are indistinguishable from native ones. That is the property these tests
 * are built on: everything below drives the real CodeMirror fold state, with
 * only the `EditorView` shell faked (the module reads `state`, `dispatch` and
 * `dom.ownerDocument.defaultView` off it, and nothing else).
 *
 * Three decisions:
 *
 * - **`foldsChanged` is an identity check, and that is enough.** The fold field
 *   reuses its RangeSet by reference while nothing fold-related happens, so `!==`
 *   catches every fold change *regardless of origin* — including one dispatched
 *   by Obsidian's own arrow, which on iOS trips none of the Live Preview
 *   plugin's other rebuild triggers and would otherwise leave the in-bar chevron
 *   pointing the wrong way.
 * - **`toggleHeadingFold` degrades twice, in order.** No fold service (the
 *   settings preview) → bound the section by scanning the text. No fold
 *   StateField either → the dispatched effect is silently dropped, so append
 *   `codeFolding()` and retry. Both fallbacks are what make the in-bar arrow
 *   work in an editor Obsidian did not build.
 * - **`isHeadingFoldEnabled` fails open.** `getConfig` is undocumented; when it
 *   is missing or throws, assuming Obsidian's default (on) shows an arrow that
 *   might do nothing, while assuming off hides a working feature.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { EditorState, StateEffect } from "@codemirror/state";
import type { Extension, TransactionSpec } from "@codemirror/state";
import { codeFolding, foldEffect, foldService, foldedRanges, unfoldEffect } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import { MarkdownView } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";
import { foldsChanged, getFoldedLines, toggleHeadingFold } from "../src/editor/livepreview/fold";
import { isHeadingFoldEnabled, resolveMarkdownView } from "../src/editor/headingFold";

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The three things `fold.ts` reads off an `EditorView`. `scheduleParseCatchUp`
 * is the only user of `dom` — it is a rendering optimization, never a
 * correctness step, so its timer is recorded rather than run.
 */
class FakeView {
	readonly scheduled: Array<() => void> = [];
	readonly dom: unknown;

	constructor(public state: EditorState) {
		const scheduled = this.scheduled;
		this.dom = {
			isConnected: true,
			ownerDocument: {
				defaultView: {
					setTimeout: (fn: () => void) => {
						scheduled.push(fn);
						return scheduled.length;
					},
				},
			},
		};
	}

	dispatch(spec: TransactionSpec): void {
		this.state = this.state.update(spec).state;
	}

	/** The code under test is typed against the real view. */
	get asView(): EditorView {
		return this as unknown as EditorView;
	}
}

const DOC = [
	"## [!tip] First", // 0
	"body of first", // 1
	"### deeper", // 2
	"still first", // 3
	"## [!note] Second", // 4
	"body of second", // 5
].join("\n");

function state(doc = DOC, extensions: Extension[] = []): EditorState {
	return EditorState.create({ doc, extensions });
}

/**
 * A fold service that answers exactly as Obsidian's heading folder does:
 * end-of-heading-line → end of the section.
 */
function headingFoldService(): Extension {
	return foldService.of((s, lineStart, lineEnd) => {
		const line = s.doc.lineAt(lineStart);
		const level = /^(#{1,6})\s/.exec(line.text)?.[1]?.length;
		if (!level) return null;
		for (let n = line.number + 1; n <= s.doc.lines; n++) {
			const next = s.doc.line(n);
			const m = /^(#{1,6})\s/.exec(next.text);
			if (m?.[1] && m[1].length <= level) {
				return { from: lineEnd, to: s.doc.line(n - 1).to };
			}
		}
		return { from: lineEnd, to: s.doc.length };
	});
}

/** The folded ranges as `[from, to]` pairs. */
function ranges(s: EditorState): Array<[number, number]> {
	const out: Array<[number, number]> = [];
	foldedRanges(s).between(0, s.doc.length, (from, to) => {
		out.push([from, to]);
	});
	return out;
}

/* -------------------------------------------------------------------------- */
/* foldsChanged                                                                */
/* -------------------------------------------------------------------------- */

describe("foldsChanged", () => {
	it("reports no change for the same state", () => {
		const s = state(DOC, [codeFolding()]);
		assert.strictEqual(foldsChanged(s, s), false);
	});

	it("reports no change across a transaction that touched no fold", () => {
		// The identity check only works because the field reuses its RangeSet by
		// reference while nothing fold-related happens.
		const s = state(DOC, [codeFolding()]);
		const next = s.update({ selection: { anchor: 3 } }).state;
		assert.strictEqual(foldsChanged(s, next), false);
	});

	it("reports a change when something folds", () => {
		const s = state(DOC, [codeFolding()]);
		const next = s.update({ effects: foldEffect.of({ from: 15, to: 45 }) }).state;

		assert.strictEqual(foldsChanged(s, next), true);
	});

	it("reports a change when something unfolds", () => {
		const s = state(DOC, [codeFolding()]).update({
			effects: foldEffect.of({ from: 15, to: 45 }),
		}).state;
		const next = s.update({ effects: unfoldEffect.of({ from: 15, to: 45 }) }).state;

		assert.strictEqual(foldsChanged(s, next), true);
	});

	it("sees a fold whoever dispatched it — the native arrow included", () => {
		// Nothing about the effect names this plugin; the check is on the field.
		const s = state(DOC, [codeFolding()]);
		const native = s.update({ effects: foldEffect.of({ from: 15, to: 45 }) }).state;

		assert.strictEqual(foldsChanged(s, native), true);
	});

	it("reports no change in an editor that cannot fold at all", () => {
		// Both sides answer with the same empty singleton.
		const s = state();
		const next = s.update({ selection: { anchor: 2 } }).state;
		assert.strictEqual(foldsChanged(s, next), false);
	});
});

/* -------------------------------------------------------------------------- */
/* getFoldedLines                                                              */
/* -------------------------------------------------------------------------- */

describe("getFoldedLines", () => {
	it("is empty when nothing is folded", () => {
		const view = new FakeView(state(DOC, [codeFolding()]));
		assert.deepStrictEqual([...getFoldedLines(view.asView)], []);
	});

	it("is empty in an editor with no fold field", () => {
		const view = new FakeView(state());
		assert.deepStrictEqual([...getFoldedLines(view.asView)], []);
	});

	it("reports the 0-based line a fold starts on", () => {
		// A heading fold starts at the END of the heading line, so the line it
		// belongs to is the one that offset falls in — not the one after it.
		const s = state(DOC, [codeFolding()]);
		const heading = s.doc.line(1);
		const view = new FakeView(
			s.update({ effects: foldEffect.of({ from: heading.to, to: s.doc.line(4).to }) }).state,
		);

		assert.deepStrictEqual([...getFoldedLines(view.asView)], [0]);
	});

	it("reports every folded heading", () => {
		const s = state(DOC, [codeFolding()]);
		const view = new FakeView(
			s.update({
				effects: [
					foldEffect.of({ from: s.doc.line(1).to, to: s.doc.line(4).to }),
					foldEffect.of({ from: s.doc.line(5).to, to: s.doc.line(6).to }),
				],
			}).state,
		);

		assert.deepStrictEqual([...getFoldedLines(view.asView)].sort(), [0, 4]);
	});
});

/* -------------------------------------------------------------------------- */
/* toggleHeadingFold                                                           */
/* -------------------------------------------------------------------------- */

describe("toggleHeadingFold — with Obsidian's fold service", () => {
	const withService = () => new FakeView(state(DOC, [codeFolding(), headingFoldService()]));

	it("folds exactly the range the service names", () => {
		const view = withService();
		toggleHeadingFold(view.asView, 0);

		const doc = view.state.doc;
		assert.deepStrictEqual(ranges(view.state), [[doc.line(1).to, doc.line(4).to]]);
		assert.deepStrictEqual([...getFoldedLines(view.asView)], [0]);
	});

	it("unfolds the same range on a second toggle", () => {
		const view = withService();
		toggleHeadingFold(view.asView, 0);
		toggleHeadingFold(view.asView, 0);

		assert.deepStrictEqual(ranges(view.state), []);
	});

	it("folds a deeper heading without touching its parent", () => {
		const view = withService();
		toggleHeadingFold(view.asView, 2);

		assert.deepStrictEqual([...getFoldedLines(view.asView)], [2]);
	});

	it("folds a section that runs to end-of-document", () => {
		const view = withService();
		toggleHeadingFold(view.asView, 4);

		const doc = view.state.doc;
		assert.deepStrictEqual(ranges(view.state), [[doc.line(5).to, doc.length]]);
	});

	it("lets the parser catch up with the viewport the fold just moved", () => {
		// Deferred by a task, because `viewport` only reflects the fold after
		// CodeMirror has re-measured.
		const view = withService();
		toggleHeadingFold(view.asView, 0);
		assert.strictEqual(view.scheduled.length, 1);

		toggleHeadingFold(view.asView, 0);
		assert.strictEqual(view.scheduled.length, 2, "on the unfold too");
	});
});

describe("toggleHeadingFold — no fold service (the settings preview)", () => {
	const noService = (doc = DOC) => new FakeView(state(doc, [codeFolding()]));

	it("bounds the section by scanning the document text instead", () => {
		const view = noService();
		toggleHeadingFold(view.asView, 0);

		const doc = view.state.doc;
		assert.deepStrictEqual(ranges(view.state), [[doc.line(1).to, doc.line(4).to]]);
	});

	it("stops the scan at the next heading of the same or a higher level", () => {
		const view = noService(["### [!tip] Sub", "body", "# Top", "after"].join("\n"));
		toggleHeadingFold(view.asView, 0);

		const doc = view.state.doc;
		assert.deepStrictEqual(ranges(view.state), [[doc.line(1).to, doc.line(2).to]]);
	});

	it("runs to the last line when nothing closes the section", () => {
		const view = noService(["## [!tip] Only", "a", "b"].join("\n"));
		toggleHeadingFold(view.asView, 0);

		assert.deepStrictEqual(ranges(view.state), [[view.state.doc.line(1).to, view.state.doc.length]]);
	});

	it("folds nothing for a heading with an empty section", () => {
		const view = noService(["intro", "## [!tip] Last"].join("\n"));
		toggleHeadingFold(view.asView, 1);

		assert.deepStrictEqual(ranges(view.state), []);
	});

	it("still unfolds a range that is already folded", () => {
		const view = noService();
		toggleHeadingFold(view.asView, 0);
		toggleHeadingFold(view.asView, 0);

		assert.deepStrictEqual(ranges(view.state), []);
	});
});

describe("toggleHeadingFold — no fold StateField at all", () => {
	it("appends the folding extension and retries, rather than silently doing nothing", () => {
		// The first dispatch is dropped: an effect for a field that is not in the
		// config goes nowhere. Two more dispatches follow — a field appended
		// mid-transaction does not see that transaction's own effects.
		const view = new FakeView(state());
		assert.deepStrictEqual(ranges(view.state), []);

		toggleHeadingFold(view.asView, 0);

		assert.deepStrictEqual(ranges(view.state), [[view.state.doc.line(1).to, view.state.doc.line(4).to]]);
		assert.deepStrictEqual([...getFoldedLines(view.asView)], [0]);
	});

	it("is a deduped no-op in an editor that already folds", () => {
		// `codeFolding()`'s parts are module-level singletons, so a second
		// append changes nothing — which is what makes the retry path safe to
		// take unconditionally.
		const view = new FakeView(state(DOC, [codeFolding()]));
		view.dispatch({ effects: StateEffect.appendConfig.of(codeFolding()) });
		toggleHeadingFold(view.asView, 0);

		assert.deepStrictEqual([...getFoldedLines(view.asView)], [0]);
	});
});

/* -------------------------------------------------------------------------- */
/* 112 — isHeadingFoldEnabled                                                  */
/* -------------------------------------------------------------------------- */

describe("isHeadingFoldEnabled", () => {
	const app = (getConfig?: unknown): App =>
		({ vault: getConfig === undefined ? {} : { getConfig } }) as unknown as App;

	it("is on when Obsidian says the setting is on", () => {
		assert.strictEqual(isHeadingFoldEnabled(app(() => true)), true);
	});

	it("is off only for an explicit false", () => {
		assert.strictEqual(isHeadingFoldEnabled(app(() => false)), false);
	});

	it("assumes Obsidian's default when the key is unset", () => {
		assert.strictEqual(isHeadingFoldEnabled(app(() => undefined)), true);
		assert.strictEqual(isHeadingFoldEnabled(app(() => null)), true);
	});

	it("assumes the default when the undocumented API is absent", () => {
		// Hiding the whole feature because a private method moved would be worse
		// than drawing an arrow that turns out to do nothing.
		assert.strictEqual(isHeadingFoldEnabled(app()), true);
		assert.strictEqual(isHeadingFoldEnabled(app("not a function")), true);
	});

	it("assumes the default when reading it throws", () => {
		assert.strictEqual(
			isHeadingFoldEnabled(
				app(() => {
					throw new Error("nope");
				}),
			),
			true,
		);
	});

	it("asks for the key Obsidian actually stores it under", () => {
		const asked: unknown[] = [];
		isHeadingFoldEnabled(app((key: string) => void asked.push(key)));
		assert.deepStrictEqual(asked, ["foldHeading"]);
	});
});

/* -------------------------------------------------------------------------- */
/* resolveMarkdownView                                                         */
/* -------------------------------------------------------------------------- */

describe("resolveMarkdownView", () => {
	const app = (...views: unknown[]): App =>
		({
			workspace: {
				getLeavesOfType: (type: string) => (type === "markdown" ? views.map((view) => ({ view })) : []),
			},
		}) as unknown as App;

	// The leaf is never read; only `instanceof MarkdownView` is.
	const viewFor = (cm: unknown): unknown =>
		Object.assign(new MarkdownView(undefined as unknown as WorkspaceLeaf), {
			editor: { cm },
		});

	it("finds the view whose editor hosts this CodeMirror instance", () => {
		const cm = {} as EditorView;
		const mine = viewFor(cm);

		assert.strictEqual(resolveMarkdownView(app(viewFor({}), mine), cm), mine);
	});

	it("returns null for a CodeMirror instance no leaf owns", () => {
		// A settings preview, a canvas card, an editable transclusion: all real
		// editors, none of them a workspace leaf.
		assert.strictEqual(resolveMarkdownView(app(viewFor({})), {} as EditorView), null);
	});

	it("ignores a leaf that is not a MarkdownView", () => {
		const cm = {} as EditorView;
		assert.strictEqual(resolveMarkdownView(app({ editor: { cm } }), cm), null);
	});
});
