/**
 * tests/headingGap.test.ts — the block spacer above a heading-callout bar.
 *
 * The gap is a block widget rather than a margin for a measured reason: CM6
 * builds its height map from each line's rendered box, margin sits outside that
 * box, and the mismatch desyncs the cursor. Padding is measured, but the bar
 * paints its background across the whole padding box, so it would only make the
 * bar taller. A block widget is a real sibling node CM6 lays out, carrying no
 * background — genuine empty space.
 *
 * Which forces it into a StateField: block decorations may not come from a view
 * plugin (the content-drawing code needs them before it lays out, and a plugin's
 * decorations are read afterwards). A StateField cannot be viewport-limited
 * either, so the set is computed over the whole document — which is why the cost
 * gating below is part of the contract rather than an optimization:
 *
 * - nothing is scanned unless the feature is actually on (`gap > 0` **and**
 *   heading callouts enabled) and the editor is really in Live Preview;
 * - the set is rebuilt only when the document changed, the plugin dispatched its
 *   refresh effect, or the parse worker advanced the syntax tree — never on a
 *   bare selection change.
 *
 * And where the gap goes: "wherever the bar goes". A heading whose callout was
 * handed to the theme renders as plain text, so a gap above it would be a blank
 * band with nothing under it; a native `> [!id]` header belongs to Obsidian's
 * own rendering and gets nothing at all.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { EditorState, StateEffect } from "@codemirror/state";
import type { Extension, StateField } from "@codemirror/state";
import type { Decoration, DecorationSet } from "@codemirror/view";
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import { fakeDom } from "./support/fakeDom";
import { widgetOf, widgetPlacement } from "./support/decorations";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { HeadingGapWidget } from "../src/editor/livepreview/headingGapWidget";
import { createHeadingGapField } from "../src/editor/livepreview/headingGapField";
import { calloutStudioRefresh } from "../src/editor/livepreview/refresh";
import { editorLivePreviewField } from "obsidian";

type Registry = InstanceType<typeof CalloutRegistry>;
type Host = Parameters<typeof createHeadingGapField>[0];
type GapField = StateField<DecorationSet>;

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

interface Harness {
	registry: Registry;
	field: GapField;
	state: EditorState;
	/** `[from, decoration]` for every gap currently in the set. */
	gaps(state?: EditorState): Array<[number, Decoration]>;
}

/** Whether `editorLivePreviewField` reports Live Preview to new states. */
function setLivePreview(on: boolean): void {
	(globalThis as { __CS_LIVE_PREVIEW__?: boolean }).__CS_LIVE_PREVIEW__ = on;
}

function harness(
	doc: string,
	options: { extensions?: Extension[] } = {},
): Harness {
	const registry = new CalloutRegistry();
	registry.load(null);
	// A clean install hands an unconfigured built-in to the theme, and this
	// suite is about what happens when the plugin IS painting. See
	// tests/styleMode.test.ts for the default itself.
	const host = {
		app: {},
		registry,
		settings: registry.settings,
	} as unknown as Host;

	const field = createHeadingGapField(host) as GapField;
	const state = EditorState.create({
		doc,
		extensions: options.extensions ?? [editorLivePreviewField, field],
	});

	const gaps = (s: EditorState = state): Array<[number, Decoration]> => {
		const out: Array<[number, Decoration]> = [];
		s.field(field).between(0, s.doc.length, (from, _to, deco) => {
			out.push([from, deco]);
		});
		return out;
	};

	return { registry, field, state, gaps };
}

function addCallout(
	registry: Registry,
	over: Partial<Parameters<Registry["add"]>[0]> = {},
): void {
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
		...over,
	});
}

/** The `HeadingGapWidget` behind the first gap in a set. */
function gapWidget(
	gaps: Array<[number, Decoration]>,
): InstanceType<typeof HeadingGapWidget> {
	const widget = widgetOf(gaps[0]?.[1] as Decoration);
	assert.ok(widget instanceof HeadingGapWidget);
	return widget;
}

/* -------------------------------------------------------------------------- */
/* The widget                                                                 */
/* -------------------------------------------------------------------------- */

describe("HeadingGapWidget", () => {
	it("paints pure empty space — no class, no background, just a height", () => {
		const el = new HeadingGapWidget(0.5).toDOM();

		assert.strictEqual(
			(el as unknown as { classList: { toArray(): string[] } }).classList.toArray()
				.length,
			0,
		);
		assert.strictEqual(el.style.height, "0.5em");
	});

	it("is keyed on the em alone", () => {
		assert.strictEqual(new HeadingGapWidget(0.5).eq(new HeadingGapWidget(0.5)), true);
		assert.strictEqual(new HeadingGapWidget(0.5).eq(new HeadingGapWidget(1)), false);
	});

	it("swallows its own events — it is spacing, not content", () => {
		assert.strictEqual(new HeadingGapWidget(0.5).ignoreEvent(), true);
	});

	it("estimates its height against the editor's real font size", () => {
		// Hardcoding 16 left every unpainted gap short by (realPx - 16) x em, with
		// the same sign every time — so the scroll offset snapped whenever a fold
		// or a scroll finally brought those widgets in to be measured.
		fakeDom.document.body.setCssProp("--font-text-size", "20px");
		assert.strictEqual(new HeadingGapWidget(0.5).estimatedHeight, 10);
		assert.strictEqual(new HeadingGapWidget(2).estimatedHeight, 40);
	});

	it("falls back to Obsidian's own default when the size cannot be read", () => {
		fakeDom.document.body.setCssProp("--font-text-size", "");
		assert.strictEqual(new HeadingGapWidget(0.5).estimatedHeight, 8);

		fakeDom.document.body.setCssProp("--font-text-size", "nonsense");
		assert.strictEqual(new HeadingGapWidget(1).estimatedHeight, 16);

		fakeDom.document.body.setCssProp("--font-text-size", "0px");
		assert.strictEqual(new HeadingGapWidget(1).estimatedHeight, 16);
	});

	it("re-reads the size every time, because it can change under the user", () => {
		fakeDom.document.body.setCssProp("--font-text-size", "16px");
		const widget = new HeadingGapWidget(1);
		assert.strictEqual(widget.estimatedHeight, 16);

		fakeDom.document.body.setCssProp("--font-text-size", "24px");
		assert.strictEqual(widget.estimatedHeight, 24);

		// …but the identity does not move with it: CodeMirror replaces the
		// estimate with a real measurement the moment the widget is painted, so
		// letting a font-size change break widget identity would buy nothing.
		assert.strictEqual(widget.eq(new HeadingGapWidget(1)), true);
		fakeDom.document.body.setCssProp("--font-text-size", "");
	});
});

/* -------------------------------------------------------------------------- */
/* Which lines get one                                                         */
/* -------------------------------------------------------------------------- */

describe("createHeadingGapField — which lines get a gap", () => {
	it("puts one at the start of every heading-callout line", () => {
		setLivePreview(true);
		const h = harness("intro\n## [!note] Title\nbody\n### [!tip] Other");

		assert.deepStrictEqual(
			h.gaps().map(([from]) => from),
			[h.state.doc.line(2).from, h.state.doc.line(4).from],
		);
	});

	it("declares it a block widget on the leading side of the line", () => {
		setLivePreview(true);
		const h = harness("## [!note] Title");
		const [[, deco]] = h.gaps() as [[number, Decoration]];

		assert.deepStrictEqual(widgetPlacement(deco), { block: true, side: -1 });
		assert.ok(widgetOf(deco) instanceof HeadingGapWidget);
	});

	it("reuses one immutable decoration for every gap on the page", () => {
		setLivePreview(true);
		const h = harness("## [!note] A\n## [!tip] B\n## [!warning] C");
		const decos = h.gaps().map(([, deco]) => deco);

		assert.strictEqual(decos.length, 3);
		assert.strictEqual(decos[0], decos[1]);
		assert.strictEqual(decos[1], decos[2]);
	});

	it("leaves a native block callout to Obsidian", () => {
		setLivePreview(true);
		const h = harness("> [!note] Native\n> body");
		assert.deepStrictEqual(h.gaps(), []);
	});

	it("leaves a plain heading alone", () => {
		setLivePreview(true);
		const h = harness("## Just a heading\ntext");
		assert.deepStrictEqual(h.gaps(), []);
	});

	it("leaves an inline pill alone — the gap belongs to the bar", () => {
		setLivePreview(true);
		const h = harness("prose with [!note] a pill in it");
		assert.deepStrictEqual(h.gaps(), []);
	});

	it("gives none to a heading whose callout was handed to the theme", () => {
		// It renders as plain text, so a gap above it would be a blank band with
		// nothing under it.
		setLivePreview(true);
		const h = harness("## [!quiet] Title");
		addCallout(h.registry, { externalStyle: true });

		// Rebuilt from scratch so the registry change is visible.
		const rebuilt = h.state.update({
			effects: calloutStudioRefresh.of(null),
		}).state;
		assert.deepStrictEqual(h.gaps(rebuilt), []);
	});

	it("gives one to an unknown id, which still draws a bar", () => {
		setLivePreview(true);
		const h = harness("## [!never-heard-of-it] Title");
		assert.strictEqual(h.gaps().length, 1);
	});
});

/* -------------------------------------------------------------------------- */
/* When it does not run at all                                                 */
/* -------------------------------------------------------------------------- */

describe("createHeadingGapField — the cost gate", () => {
	it("produces nothing while the spacing is zero", () => {
		setLivePreview(true);
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.settings.globalStyle.heading.marginTop = 0;
		const host = { app: {}, registry, settings: registry.settings } as unknown as Host;
		const field = createHeadingGapField(host) as GapField;
		const state = EditorState.create({
			doc: "## [!note] Title",
			extensions: [editorLivePreviewField, field],
		});

		assert.strictEqual(state.field(field).size, 0);
	});

	it("produces nothing while heading callouts are off", () => {
		setLivePreview(true);
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.settings.headingCallouts.enabled = false;
		const host = { app: {}, registry, settings: registry.settings } as unknown as Host;
		const field = createHeadingGapField(host) as GapField;
		const state = EditorState.create({
			doc: "## [!note] Title",
			extensions: [editorLivePreviewField, field],
		});

		assert.strictEqual(state.field(field).size, 0);
	});

	it("produces nothing in source mode", () => {
		setLivePreview(false);
		const h = harness("## [!note] Title");
		assert.deepStrictEqual(h.gaps(), []);
		setLivePreview(true);
	});

	it("produces nothing in a sub-editor that lacks the field entirely", () => {
		// A table cell or a detached preview: `field(f, false)` answers undefined
		// rather than throwing, which is exactly why the `false` default is passed.
		setLivePreview(true);
		const registry = new CalloutRegistry();
		registry.load(null);
		const host = { app: {}, registry, settings: registry.settings } as unknown as Host;
		const field = createHeadingGapField(host) as GapField;
		const state = EditorState.create({
			doc: "## [!note] Title",
			extensions: [field],
		});

		assert.strictEqual(state.field(field).size, 0);
	});
});

/* -------------------------------------------------------------------------- */
/* When it rebuilds                                                            */
/* -------------------------------------------------------------------------- */

describe("createHeadingGapField — when it rebuilds", () => {
	it("keeps the very same set across a bare selection change", () => {
		// The whole document is scanned on every rebuild, so this is the check
		// that typing and clicking stay cheap in a long note.
		setLivePreview(true);
		const h = harness("## [!note] Title\nbody");
		const before = h.state.field(h.field);
		const after = h.state.update({ selection: { anchor: 3 } }).state.field(h.field);

		assert.strictEqual(after, before);
	});

	it("rebuilds when the document changes", () => {
		setLivePreview(true);
		const h = harness("body");
		assert.deepStrictEqual(h.gaps(), []);

		const typed = h.state.update({
			changes: { from: 0, insert: "## [!note] Title\n" },
		}).state;
		assert.strictEqual(h.gaps(typed).length, 1);
	});

	it("rebuilds on the plugin's refresh effect, so moving the slider takes effect", () => {
		setLivePreview(true);
		const h = harness("## [!note] Title");
		assert.strictEqual(h.gaps().length, 1);

		h.registry.settings.globalStyle.heading.marginTop = 0;
		const refreshed = h.state.update({
			effects: calloutStudioRefresh.of(null),
		}).state;

		assert.deepStrictEqual(h.gaps(refreshed), []);
	});

	it("ignores an unrelated effect", () => {
		setLivePreview(true);
		const h = harness("## [!note] Title");
		const unrelated = StateEffect.define<null>();
		const after = h.state.update({ effects: unrelated.of(null) }).state;

		assert.strictEqual(after.field(h.field), h.state.field(h.field));
	});

	it("tracks the gap size the settings actually hold", () => {
		setLivePreview(true);
		const h = harness("## [!note] Title");
		assert.strictEqual(gapWidget(h.gaps()).eq(new HeadingGapWidget(0.5)), true);

		h.registry.settings.globalStyle.heading.marginTop = 1.25;
		const refreshed = h.state.update({
			effects: calloutStudioRefresh.of(null),
		}).state;
		assert.strictEqual(
			gapWidget(h.gaps(refreshed)).eq(new HeadingGapWidget(1.25)),
			true,
		);
	});
});
