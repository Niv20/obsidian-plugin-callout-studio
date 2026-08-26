/**
 * tests/calloutViewPlugin.test.ts — the Live Preview decoration builder.
 *
 * One ViewPlugin decides what a heading callout and an inline pill look like
 * while the note is being edited. Two halves are pinned here:
 *
 * **What it builds.** A heading line keeps its bar *and* its `data-callout`
 * even while the caret is on it (native callouts keep their frame during
 * editing too), and collapses only the `[!id]` token when the caret is
 * elsewhere. The class that hides the ATX `###` runs off that same predicate
 * on purpose: Obsidian hides the hashes on its own rebuild schedule, one that
 * skips while the mouse is held, while an IME composes, and while the syntax
 * tree sits behind the viewport — so leaving them to core lets a raw `###`
 * surface in front of an otherwise finished bar.
 *
 * **When it rebuilds.** The reveal is drawn from a *snapshot* of the selection
 * and focus, not a live read, and the snapshot is frozen while the left button
 * is held. That is what keeps this plugin's raw reveal in the same paint as
 * core's, and the exceptions are as load-bearing as the rule: a caret this
 * plugin dropped itself (a pill click) must not be frozen, or the reveal is
 * lost rather than delayed; and a fold made anywhere — Obsidian's own
 * pre-heading arrow included — has to rebuild, because on iOS a native fold tap
 * trips none of the other triggers and the in-bar chevron keeps a stale
 * direction.
 *
 * The `EditorView` is faked: the plugin reads `state`, `hasFocus`,
 * `visibleRanges`, `dom.ownerDocument` and `plugin()` off it, and nothing else.
 * `ViewUpdate` is faked for the same reason — `update()` reads nine fields, all
 * derivable from a real transaction. Everything below the view (the document,
 * transactions, fold state, the RangeSet the decorations live in) is the real
 * CodeMirror.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { EditorState, StateEffect } from "@codemirror/state";
import type { Extension, TransactionSpec } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import type { DecorationSet, EditorView } from "@codemirror/view";
import { codeFolding, foldEffect } from "@codemirror/language";
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import "./support/fakeDom";
import {
	lineAttrs,
	markClass,
	widgetOf,
	widgetPlacement,
} from "./support/decorations";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { createCalloutViewPlugin } from "../src/editor/livepreview/calloutViewPlugin";
import {
	calloutStudioCaretDrop,
	calloutStudioRefresh,
} from "../src/editor/livepreview/refresh";
import {
	CalloutContentPillWidget,
	CalloutTokenWidget,
	HeadingFoldArrowWidget,
} from "../src/editor/livepreview/widgets";
import {
	CSS_HEADING_HIDE_MARKS,
	CSS_HEADING_LINE,
	CSS_HEADING_TITLE,
	CSS_UNKNOWN,
} from "../src/editor/renderShared";
import { editorLivePreviewField, livePreviewState } from "obsidian";

type Registry = InstanceType<typeof CalloutRegistry>;
type Host = Parameters<typeof createCalloutViewPlugin>[0];

interface PluginInstance {
	decorations: DecorationSet;
	update(update: unknown): void;
	destroy(): void;
}

/* -------------------------------------------------------------------------- */
/* Fake view                                                                  */
/* -------------------------------------------------------------------------- */

class FakeView {
	hasFocus = true;
	mousedown = false;
	readonly dom: unknown;
	/** Mouseup listeners the plugin installed on the shared document. */
	readonly listeners: Array<() => void> = [];

	constructor(public state: EditorState) {
		const listeners = this.listeners;
		this.dom = {
			isConnected: true,
			ownerDocument: {
				addEventListener: (_type: string, fn: () => void) =>
					void listeners.push(fn),
				removeEventListener: (_type: string, fn: () => void) => {
					const at = listeners.indexOf(fn);
					if (at >= 0) listeners.splice(at, 1);
				},
			},
		};
	}

	get visibleRanges(): ReadonlyArray<{ from: number; to: number }> {
		return this.ranges ?? [{ from: 0, to: this.state.doc.length }];
	}

	/** Overridable, for the split-range case CodeMirror can produce. */
	ranges: Array<{ from: number; to: number }> | null = null;

	plugin(key: unknown): { mousedown: boolean } | null {
		// Keyed on the real value the plugin passes, so a rebuild trigger that
		// asked for some other plugin would read `null` here, as it would in
		// Obsidian.
		return key === livePreviewState ? { mousedown: this.mousedown } : null;
	}

	dispatch(spec: TransactionSpec): void {
		this.state = this.state.update(spec).state;
	}

	get asView(): EditorView {
		return this as unknown as EditorView;
	}
}

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

interface Harness {
	registry: Registry;
	view: FakeView;
	instance: PluginInstance;
	/** `[from, to, decoration]` for every decoration currently emitted. */
	decorations(): Array<[number, number, Decoration]>;
	/** Classes on the line decoration at a line's start offset. */
	lineClasses(from: number): string[];
}

function harness(
	doc: string,
	options: {
		selection?: number;
		extensions?: Extension[];
		configure?: (registry: Registry) => void;
	} = {},
): Harness {
	const registry = new CalloutRegistry();
	registry.load(null);
	// A clean install hands an unconfigured built-in to the theme, and this
	// suite is about what happens when the plugin IS painting. See
	// tests/styleMode.test.ts for the default itself.
	options.configure?.(registry);

	const host = {
		app: {
			vault: {},
			workspace: { getLeavesOfType: () => [] },
		},
		registry,
		settings: registry.settings,
	} as unknown as Host;

	const state = EditorState.create({
		doc,
		selection: { anchor: options.selection ?? 0 },
		extensions: options.extensions ?? [editorLivePreviewField, codeFolding()],
	});
	const view = new FakeView(state);
	const plugin = createCalloutViewPlugin(host) as unknown as {
		create(view: EditorView): PluginInstance;
	};
	const instance = plugin.create(view.asView);

	const decorations = (): Array<[number, number, Decoration]> => {
		const out: Array<[number, number, Decoration]> = [];
		instance.decorations.between(
			0,
			view.state.doc.length,
			(from, to, deco) => {
				out.push([from, to, deco]);
			},
		);
		return out;
	};

	return {
		registry,
		view,
		instance,
		decorations,
		lineClasses: (from) => {
			const line = decorations().find(
				([f, t, deco]) =>
					f === from && t === from && lineAttrs(deco).class !== undefined,
			);
			return (line ? lineAttrs(line[2]).class ?? "" : "")
				.split(" ")
				.filter(Boolean);
		},
	};
}

/** Drive one `update()` with a real transaction behind it. */
function update(
	h: Harness,
	spec: {
		transaction?: TransactionSpec;
		mousedown?: boolean;
		hasFocus?: boolean;
		selectionSet?: boolean;
		focusChanged?: boolean;
		viewportChanged?: boolean;
	} = {},
): void {
	const startState = h.view.state;
	const tr = startState.update(spec.transaction ?? {});
	h.view.state = tr.state;
	if (spec.hasFocus !== undefined) h.view.hasFocus = spec.hasFocus;
	h.view.mousedown = spec.mousedown ?? false;

	h.instance.update({
		view: h.view,
		startState,
		state: tr.state,
		transactions: [tr],
		changes: tr.changes,
		docChanged: tr.docChanged,
		selectionSet: spec.selectionSet ?? spec.transaction?.selection !== undefined,
		focusChanged: spec.focusChanged ?? false,
		viewportChanged: spec.viewportChanged ?? false,
	});
}

const widgets = (h: Harness): unknown[] =>
	h.decorations()
		.map(([, , deco]) => widgetOf(deco))
		.filter(Boolean);

/* -------------------------------------------------------------------------- */
/* Heading callouts                                                            */
/* -------------------------------------------------------------------------- */

describe("heading callouts", () => {
	// The caret sits on line 2, so line 1 is collapsed.
	const DOC = "## [!note] Title\nbody";
	const AWAY = DOC.length;

	it("puts the bar on the line, with the callout id on it", () => {
		const h = harness(DOC, { selection: AWAY });

		assert.deepStrictEqual(h.lineClasses(0), [
			CSS_HEADING_LINE,
			CSS_HEADING_HIDE_MARKS,
		]);
		const line = h.decorations()[0]?.[2];
		assert.ok(line);
		assert.strictEqual(lineAttrs(line)["data-callout"], "note");
	});

	it("collapses the `[!id]` token behind a widget while the caret is elsewhere", () => {
		const h = harness(DOC, { selection: AWAY });
		const token = h
			.decorations()
			.find(([from, to]) => from === 3 && to === 10);

		assert.ok(token);
		assert.ok(widgetOf(token[2]) instanceof CalloutTokenWidget);
	});

	it("keeps the bar but reveals the raw token while the caret is on the line", () => {
		const h = harness(DOC, { selection: 5 });

		// The bar survives — native callouts keep their frame during editing too.
		assert.deepStrictEqual(h.lineClasses(0), [CSS_HEADING_LINE]);
		// …and the hashes go back to Obsidian, along with the raw `[!id]`.
		assert.ok(!widgets(h).some((w) => w instanceof CalloutTokenWidget));
	});

	it("stays collapsed while the editor is not focused", () => {
		// An embedded settings preview parks its caret at position 0, which
		// would otherwise permanently reveal a token on the first line.
		const h = harness(DOC, { selection: 5 });
		h.view.hasFocus = false;
		update(h, { focusChanged: true });

		assert.deepStrictEqual(h.lineClasses(0), [
			CSS_HEADING_LINE,
			CSS_HEADING_HIDE_MARKS,
		]);
	});

	it("marks the title text so a gradient sweep can end on the last letter", () => {
		const h = harness(DOC, { selection: AWAY });
		const mark = h
			.decorations()
			.find(([, , deco]) => markClass(deco) === CSS_HEADING_TITLE);

		assert.deepStrictEqual(mark?.slice(0, 2), [11, 16]);
	});

	it("keeps the title mark while the caret is on the line", () => {
		// The sweep should not blink off when the line is being edited.
		const h = harness(DOC, { selection: 5 });
		assert.ok(
			h.decorations().some(([, , deco]) => markClass(deco) === CSS_HEADING_TITLE),
		);
	});

	it("leaves surrounding whitespace out of the title mark", () => {
		const doc = "##   [!note]    Title   \nbody";
		const h = harness(doc, { selection: doc.length });
		const mark = h
			.decorations()
			.find(([, , deco]) => markClass(deco) === CSS_HEADING_TITLE);

		assert.deepStrictEqual(mark?.slice(0, 2), [16, 21]);
	});

	it("marks no title on a title-less heading", () => {
		const h = harness("## [!note]\nbody", { selection: 12 });
		assert.ok(
			!h.decorations().some(([, , deco]) => markClass(deco) === CSS_HEADING_TITLE),
		);
	});

	it("marks an unknown id on the bar", () => {
		const h = harness("## [!never-heard] Title\nbody", { selection: 25 });
		assert.ok(h.lineClasses(0).includes(CSS_UNKNOWN));
	});

	it("mirrors the metadata Obsidian stamps on a block callout", () => {
		const h = harness("## [!note|purple] Title\nbody", { selection: 25 });
		const line = h.decorations()[0]?.[2];
		assert.ok(line);
		assert.strictEqual(lineAttrs(line)["data-callout-metadata"], "purple");
	});

	it("omits the metadata attribute when there is none — empty still matches", () => {
		const h = harness(DOC, { selection: AWAY });
		const line = h.decorations()[0]?.[2];
		assert.ok(line);
		assert.strictEqual(lineAttrs(line)["data-callout-metadata"], undefined);
	});
});

/* -------------------------------------------------------------------------- */
/* The fold chevron                                                            */
/* -------------------------------------------------------------------------- */

describe("the fold chevron", () => {
	const DOC = "## [!note] Title\nbody";

	it("trails the whole heading, at end of line", () => {
		const h = harness(DOC, { selection: DOC.length });
		const arrow = h
			.decorations()
			.find(([, , deco]) => widgetOf(deco) instanceof HeadingFoldArrowWidget);

		assert.ok(arrow);
		assert.deepStrictEqual(arrow.slice(0, 2), [16, 16]);
		assert.strictEqual(widgetPlacement(arrow[2]).side, 1);
	});

	it("is not drawn while the user turned it off", () => {
		const h = harness(DOC, {
			selection: DOC.length,
			configure: (registry) => {
				registry.settings.headingCallouts.showFoldArrow = false;
			},
		});

		assert.ok(!widgets(h).some((w) => w instanceof HeadingFoldArrowWidget));
	});

	it("is not drawn while the token is revealed for editing", () => {
		const h = harness(DOC, { selection: 5 });
		assert.ok(!widgets(h).some((w) => w instanceof HeadingFoldArrowWidget));
	});

	it("reflects whether the section is folded", () => {
		const h = harness(DOC, { selection: DOC.length });
		const before = widgets(h).find(
			(w) => w instanceof HeadingFoldArrowWidget,
		) as InstanceType<typeof HeadingFoldArrowWidget>;

		update(h, {
			transaction: {
				effects: foldEffect.of({ from: 16, to: h.view.state.doc.length }),
			},
		});

		const after = widgets(h).find(
			(w) => w instanceof HeadingFoldArrowWidget,
		) as InstanceType<typeof HeadingFoldArrowWidget>;
		assert.strictEqual(before.eq(after), false, "the chevron must rotate");
	});
});

/* -------------------------------------------------------------------------- */
/* Inline pills                                                                */
/* -------------------------------------------------------------------------- */

describe("inline pills", () => {
	it("replaces the token with a pill widget", () => {
		const h = harness("text [!note] more", { selection: 0 });
		const pill = h.decorations().find(([from]) => from === 5);

		assert.ok(pill);
		assert.ok(widgetOf(pill[2]) instanceof CalloutTokenWidget);
		assert.strictEqual(pill[1], 12);
	});

	it("reveals the raw source while the selection touches it", () => {
		// That reveal is the pill's only editing affordance.
		const h = harness("text [!note] more", { selection: 7 });
		assert.deepStrictEqual(h.decorations(), []);
	});

	it("replaces a content pill whole — token, braces and payload", () => {
		const h = harness("a [!note]{be careful} b", { selection: 0 });
		const pill = h.decorations().find(([from]) => from === 2);

		assert.ok(pill);
		assert.ok(widgetOf(pill[2]) instanceof CalloutContentPillWidget);
		assert.strictEqual(pill[1], 21);
	});

	it("falls back to the plain widget for an empty payload", () => {
		const h = harness("a [!note]{} b", { selection: 0 });
		const pill = h.decorations().find(([from]) => from === 2);

		assert.ok(pill);
		assert.ok(widgetOf(pill[2]) instanceof CalloutTokenWidget);
	});

	it("draws nothing for a payload still being typed", () => {
		// Flashing a pill in front of half-written text would be noise.
		const h = harness("a [!note]{unfinished", { selection: 0 });
		assert.deepStrictEqual(h.decorations(), []);
	});

	it("leaves the braces literal while inline content is switched off", () => {
		const h = harness("a [!note]{be careful} b", {
			selection: 0,
			configure: (registry) => {
				registry.settings.inlineCallouts.allowContent = false;
			},
		});
		const pill = h.decorations().find(([from]) => from === 2);

		assert.ok(pill);
		assert.ok(widgetOf(pill[2]) instanceof CalloutTokenWidget);
		assert.strictEqual(pill[1], 9, "only the token itself is replaced");
	});

	it("refuses a token nested inside another token's payload", () => {
		const h = harness("a [!note]{see [!tip] here} b", { selection: 0 });
		const replaced = h.decorations().filter(([, , deco]) => widgetOf(deco));

		assert.strictEqual(replaced.length, 1);
		assert.ok(
			widgetOf(replaced[0]?.[2] as Decoration) instanceof
				CalloutContentPillWidget,
		);
	});
});

/* -------------------------------------------------------------------------- */
/* What it never touches                                                       */
/* -------------------------------------------------------------------------- */

describe("what it leaves alone", () => {
	it("a native block callout header", () => {
		const h = harness("> [!note] Native\n> body", { selection: 23 });
		assert.deepStrictEqual(h.decorations(), []);
	});

	it("everything, while both roles are off", () => {
		const h = harness("## [!note] Title\ntext [!tip] more", {
			selection: 0,
			configure: (registry) => {
				registry.settings.headingCallouts.enabled = false;
				registry.settings.inlineCallouts.enabled = false;
			},
		});

		assert.strictEqual(h.instance.decorations, Decoration.none);
	});

	it("only the role that is off", () => {
		const h = harness("## [!note] Title\ntext [!tip] more", {
			selection: 0,
			configure: (registry) => {
				registry.settings.headingCallouts.enabled = false;
			},
		});

		assert.deepStrictEqual(h.lineClasses(0), []);
		assert.ok(h.decorations().some(([from]) => from === 22));
	});

	it("everything, in source mode", () => {
		const h = harness("## [!note] Title", {
			selection: 0,
			extensions: [codeFolding()], // no editorLivePreviewField at all
		});

		assert.strictEqual(h.instance.decorations, Decoration.none);
	});

	it("a callout the theme owns — the `[!id]` stays literal text", () => {
		const h = harness("## [!quiet] Title\nbody", {
			selection: 22,
			configure: (registry) => {
				registry.add({
					id: "quiet",
					displayName: "Quiet",
					icon: { type: "lucide", value: "pencil" },
					colorLight: "#336699",
					colorDark: "#88bbee",
					foldable: false,
					defaultFolded: false,
					builtIn: false,
					source: "user",
					externalStyle: true,
				});
			},
		});

		// No bar, no title mark, no token widget, no chevron.
		assert.deepStrictEqual(h.decorations(), []);
	});

	it("a line the same document already handed it once", () => {
		// `visibleRanges` is not the viewport: CodeMirror subtracts large point
		// decorations from it, so one line can arrive in two spans. Two tokens on
		// such a line would make RangeSetBuilder throw "Ranges must be added
		// sorted" — which costs the whole editor its decorations.
		const doc = "text [!note] and [!tip] more";
		const h = harness(doc, { selection: 0 });
		h.view.ranges = [
			{ from: 0, to: 12 },
			{ from: 12, to: doc.length },
		];

		assert.doesNotThrow(() => update(h, { viewportChanged: true }));
		assert.strictEqual(
			h.decorations().filter(([, , deco]) => widgetOf(deco)).length,
			2,
		);
	});
});

/* -------------------------------------------------------------------------- */
/* When it rebuilds                                                            */
/* -------------------------------------------------------------------------- */

describe("rebuild triggers", () => {
	const DOC = "## [!note] Title\ntext [!tip] more";

	it("rebuilds on a selection change", () => {
		const h = harness(DOC, { selection: 0 });
		const before = h.instance.decorations;

		update(h, { transaction: { selection: { anchor: 25 } } });
		assert.notStrictEqual(h.instance.decorations, before);
	});

	it("does NOT rebuild while the left button is held", () => {
		// Core defers its own `#`-mark reveal to mouseup; without the freeze this
		// plugin's raw reveal lands a beat earlier and the user sees two stages.
		const h = harness(DOC, { selection: 0 });
		const before = h.instance.decorations;

		update(h, {
			transaction: { selection: { anchor: 25 } },
			mousedown: true,
		});
		assert.strictEqual(h.instance.decorations, before);
	});

	it("rebuilds on the release, catching up with what core just did", () => {
		const h = harness(DOC, { selection: 0 });
		update(h, { transaction: { selection: { anchor: 25 } }, mousedown: true });
		const frozen = h.instance.decorations;

		update(h, { mousedown: false });
		assert.notStrictEqual(h.instance.decorations, frozen);
	});

	it("rebuilds for a caret THIS plugin dropped, freeze or no freeze", () => {
		// A pill click has no core-owned syntax to wait for, and deferring it can
		// lose the reveal outright rather than merely delay it.
		const h = harness(DOC, { selection: 0 });
		const before = h.instance.decorations;

		update(h, {
			transaction: {
				selection: { anchor: 25 },
				effects: calloutStudioCaretDrop.of(null),
			},
			mousedown: true,
		});
		assert.notStrictEqual(h.instance.decorations, before);
	});

	it("rebuilds on the refresh effect, which is how a registry edit reaches it", () => {
		// Registry changes touch no document, so CodeMirror would never rebuild.
		const h = harness(DOC, { selection: 0 });
		const before = h.instance.decorations;

		update(h, { transaction: { effects: calloutStudioRefresh.of(null) } });
		assert.notStrictEqual(h.instance.decorations, before);
	});

	it("rebuilds when a fold changes, whoever made it", () => {
		const h = harness(DOC, { selection: 0 });
		const before = h.instance.decorations;

		update(h, {
			transaction: { effects: foldEffect.of({ from: 16, to: DOC.length }) },
		});
		assert.notStrictEqual(h.instance.decorations, before);
	});

	it("does not rebuild for a fold while heading callouts are off", () => {
		const h = harness(DOC, {
			selection: 0,
			configure: (registry) => {
				registry.settings.headingCallouts.enabled = false;
			},
		});
		const before = h.instance.decorations;

		update(h, {
			transaction: { effects: foldEffect.of({ from: 16, to: DOC.length }) },
		});
		assert.strictEqual(h.instance.decorations, before);
	});

	it("rebuilds on a document change", () => {
		const h = harness(DOC, { selection: 0 });
		const before = h.instance.decorations;

		update(h, { transaction: { changes: { from: 0, insert: "x" } } });
		assert.notStrictEqual(h.instance.decorations, before);
	});

	it("rebuilds on a viewport change", () => {
		const h = harness(DOC, { selection: 0 });
		const before = h.instance.decorations;

		update(h, { viewportChanged: true });
		assert.notStrictEqual(h.instance.decorations, before);
	});

	it("does nothing at all for a transaction with none of those", () => {
		const h = harness(DOC, { selection: 0 });
		const before = h.instance.decorations;

		update(h, { transaction: { effects: StateEffect.define<null>().of(null) } });
		assert.strictEqual(h.instance.decorations, before);
	});

	it("maps the frozen selection through document changes it did not act on", () => {
		// Frozen, the snapshot still has to stay valid: an unmapped offset would
		// point into text that has moved.
		const h = harness("text [!note] more", { selection: 7 });
		assert.deepStrictEqual(h.decorations(), [], "revealed to start with");

		update(h, {
			transaction: { changes: { from: 0, insert: "12345" } },
			mousedown: true,
		});
		// The caret moved with the text, so the pill is still revealed.
		assert.deepStrictEqual(h.decorations(), []);
	});
});

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                   */
/* -------------------------------------------------------------------------- */

describe("lifecycle", () => {
	it("listens for a mouseup on the shared document", () => {
		// A drag can end outside the editor, or over a widget that swallowed the
		// event, leaving the freeze armed with no transaction to clear it.
		const h = harness("## [!note] Title", { selection: 0 });
		assert.strictEqual(h.view.listeners.length, 1);
	});

	it("takes that listener back off on destroy", () => {
		const h = harness("## [!note] Title", { selection: 0 });
		h.instance.destroy();

		assert.strictEqual(h.view.listeners.length, 0);
	});

	it("is safe to destroy twice", () => {
		const h = harness("## [!note] Title", { selection: 0 });
		h.instance.destroy();
		assert.doesNotThrow(() => h.instance.destroy());
	});
});
