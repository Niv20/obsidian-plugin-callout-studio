/**
 * tests/contextMenuResolve.test.ts — turning a right-click into a callout.
 *
 * `resolveContext` is the whole context menu's input. Everything downstream —
 * which items appear, which line they edit, which callout they edit — is
 * decided here, and a wrong answer is not a missing menu but a menu that edits
 * the wrong block. Four things are pinned:
 *
 * - **Resolution order is most-specific-first**, and it is load-bearing rather
 *   than tidy: an inline pill sits *inside* a heading line, which sits inside an
 *   editor, so anything but "inline, then heading, then block" resolves a pill
 *   click to the heading around it.
 * - **The DOM class is never authoritative.** A `.cs-heading-callout` bar whose
 *   source line no longer carries a heading token yields nothing at all, because
 *   the menu would otherwise offer to edit a callout that isn't there.
 * - **Reading view matches in Obsidian's *attribute* space.** `> [!multi word]`
 *   renders as `data-callout="multi-word"`, so a resolver comparing the
 *   attribute against space-form source ids would never match — and the
 *   `id → depth → first` ladder decides which of several candidates wins.
 * - **Quote depth comes from the header prefix**, which is what keeps a click
 *   inside a nested callout from resolving to its parent.
 *
 * The DOM is `tests/support/fakeDom.ts`. The CodeMirror side is reached the way
 * `EditorView.findFromDOM` reaches it — `node.cmView.rootView.view`, which is
 * literally what CodeMirror reads — so the two live-preview branches
 * (`posAtDOM` for a heading, `posAtCoords` for a block) are exercised through
 * the real lookup rather than around it.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import { asEl, el, fakeDom, type FakeElement } from "./support/fakeDom";
import { asEditor, editor, FakeEditor } from "./support/fakeEditor";
import { MarkdownView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import {
	CALLOUT_FOLD_MARK_REGEX,
	CALLOUT_HEADER_REGEX,
	findMarkdownViewForTarget,
	resolveContext,
} from "../src/editor/contextmenu/resolve";

type Plugin = Parameters<typeof resolveContext>[0];
type Context = NonNullable<ReturnType<typeof resolveContext>>;

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

interface SectionInfo {
	lineStart: number;
	lineEnd: number;
	text: string;
}

interface ViewSpec {
	containerEl: FakeElement;
	editor: FakeEditor;
	/** The preview container `getSectionInfo` is allowed to answer within. */
	previewEl?: FakeElement;
	/** Section lookup, keyed by element — reading view's only source of truth. */
	sections?: Map<FakeElement, SectionInfo>;
}

/** A `MarkdownView` carrying exactly the four fields the resolver reads. */
function view(spec: ViewSpec): MarkdownView {
	const previewEl = spec.previewEl ?? spec.containerEl;
	const sections = spec.sections ?? new Map<FakeElement, SectionInfo>();
	// The leaf is never read; only `instanceof MarkdownView` is.
	return Object.assign(new MarkdownView(undefined as unknown as WorkspaceLeaf), {
		containerEl: spec.containerEl,
		editor: asEditor(spec.editor),
		previewMode: {
			containerEl: previewEl,
			getSectionInfo: (element: FakeElement) => sections.get(element) ?? null,
		},
	});
}

/** A plugin whose only workspace is the markdown leaves handed in. */
function plugin(...views: unknown[]): Plugin {
	return {
		app: {
			workspace: {
				getLeavesOfType: (type: string) => (type === "markdown" ? views.map((v) => ({ view: v })) : []),
			},
		},
	} as unknown as Plugin;
}

/** A pointer context over an element; coordinates default to the origin. */
function trigger(
	targetEl: FakeElement,
	coords: { x: number; y: number } = { x: 0, y: 0 },
): Parameters<typeof resolveContext>[1] {
	return {
		targetEl: asEl(targetEl),
		clientX: coords.x,
		clientY: coords.y,
		timestamp: 0,
		ownerDocument: fakeDom.document as unknown as Document,
	};
}

/**
 * Attach a fake CodeMirror view to a `.cm-editor` element, exactly where
 * `EditorView.findFromDOM` looks for it (`ContentView.get(dom)` is
 * `node.cmView`, and it falls back to the element itself when there is no
 * `.cm-content` under it).
 */
function attachEditorView(
	cmEditor: FakeElement,
	impl: {
		posAtDOM?: (element: unknown) => number;
		posAtCoords?: (coords: { x: number; y: number }, precise?: false) => number | null;
	},
): void {
	(cmEditor as unknown as { cmView: unknown }).cmView = {
		rootView: { view: impl },
	};
}

/* -------------------------------------------------------------------------- */
/* 103 — the two header regexes                                               */
/* -------------------------------------------------------------------------- */

describe("CALLOUT_HEADER_REGEX", () => {
	const parse = (line: string): [string, string] | null => {
		const m = CALLOUT_HEADER_REGEX.exec(line);
		return m && m[1] !== undefined && m[2] !== undefined ? [m[1], m[2]] : null;
	};

	it("captures the quote prefix and the raw id at every nesting depth", () => {
		assert.deepStrictEqual(parse("> [!note]"), ["> ", "note"]);
		assert.deepStrictEqual(parse(">> [!note]"), [">> ", "note"]);
		assert.deepStrictEqual(parse("> > [!note]"), ["> > ", "note"]);
		assert.deepStrictEqual(parse(">>> [!note]"), [">>> ", "note"]);
	});

	it("tolerates a missing space after the marker", () => {
		assert.deepStrictEqual(parse(">[!note]"), [">", "note"]);
		assert.deepStrictEqual(parse(">>[!note]"), [">>", "note"]);
	});

	it("tolerates leading indentation, spaces or tabs", () => {
		assert.deepStrictEqual(parse("  > [!note]"), ["  > ", "note"]);
		assert.deepStrictEqual(parse("\t> [!note]"), ["\t> ", "note"]);
	});

	it("keeps the fold mark and the title out of the id", () => {
		assert.deepStrictEqual(parse("> [!note]- Folded"), ["> ", "note"]);
		assert.deepStrictEqual(parse("> [!note]+ Open"), ["> ", "note"]);
		assert.deepStrictEqual(parse("> [!note] A title"), ["> ", "note"]);
	});

	it("captures the metadata as part of the raw id, leaving the split to the caller", () => {
		// `normalizeCalloutId` is what drops it — one funnel, not one per site.
		assert.deepStrictEqual(parse("> [!note|purple]"), ["> ", "note|purple"]);
	});

	it("stops at the FIRST closing bracket", () => {
		assert.deepStrictEqual(parse("> [!a]b]"), ["> ", "a"]);
	});

	it("refuses a line that is not a blockquote header", () => {
		assert.strictEqual(parse("[!note]"), null, "no quote marker");
		assert.strictEqual(parse("text > [!note]"), null, "not anchored at start");
		assert.strictEqual(parse("> - [!note]"), null, "a list item, not a header");
		assert.strictEqual(parse("> []"), null, "no bang");
		assert.strictEqual(parse("> [!]"), null, "empty id");
		assert.strictEqual(parse("## [!note]"), null, "a heading callout");
		assert.strictEqual(parse("plain text"), null);
	});
});

describe("CALLOUT_FOLD_MARK_REGEX", () => {
	// items.ts reads group 3 as `match?.[3] ?? ""`, so "no mark" must be
	// undefined rather than an empty capture that swallows the `??`.
	const mark = (line: string): string | undefined => CALLOUT_FOLD_MARK_REGEX.exec(line)?.[3];

	it("reports the fold mark when there is one", () => {
		assert.strictEqual(mark("> [!note]-"), "-");
		assert.strictEqual(mark("> [!note]+"), "+");
		assert.strictEqual(mark("> [!note]- With a title"), "-");
		assert.strictEqual(mark("> [!note]+With no space"), "+");
		assert.strictEqual(mark(">> [!note]-"), "-");
	});

	it("reports undefined when there is none", () => {
		assert.strictEqual(mark("> [!note]"), undefined);
		assert.strictEqual(mark("> [!note] Title"), undefined);
		assert.strictEqual(mark("> [!note] - not a mark"), undefined);
	});

	it("matches the header half exactly as CALLOUT_HEADER_REGEX does", () => {
		// The two are used interchangeably on the same line; a divergence would
		// mean the fold toggle and the resolver disagreed about what a header is.
		for (const line of [
			"> [!note]",
			">> [!warning] Title",
			"  > [!tip]- Folded",
			"> [!note|purple]",
			"plain text",
			"> - [!note]",
		]) {
			const header = CALLOUT_HEADER_REGEX.exec(line);
			const fold = CALLOUT_FOLD_MARK_REGEX.exec(line);
			assert.strictEqual(!!header, !!fold, line);
			if (header && fold) {
				assert.strictEqual(fold[1], header[1], line);
				assert.strictEqual(fold[2], header[2], line);
			}
		}
	});
});

/* -------------------------------------------------------------------------- */
/* 105 — findMarkdownViewForTarget                                            */
/* -------------------------------------------------------------------------- */

describe("findMarkdownViewForTarget", () => {
	it("returns the view whose container holds the element", () => {
		const target = el({ tag: "span" });
		const container = el({ children: [target] });
		const v = view({ containerEl: container, editor: editor("") });

		assert.strictEqual(findMarkdownViewForTarget(plugin(v), asEl(target)), v);
	});

	it("picks the right one out of several open leaves", () => {
		const target = el({ tag: "span" });
		const other = view({ containerEl: el({}), editor: editor("") });
		const mine = view({
			containerEl: el({ children: [target] }),
			editor: editor(""),
		});

		assert.strictEqual(findMarkdownViewForTarget(plugin(other, mine), asEl(target)), mine);
	});

	it("ignores a leaf whose view is not a MarkdownView", () => {
		// A canvas or graph leaf can contain a right-clicked element too; it just
		// has no editor behind it.
		const target = el({ tag: "span" });
		const container = el({ children: [target] });
		const notMarkdown = { containerEl: container };

		assert.strictEqual(findMarkdownViewForTarget(plugin(notMarkdown), asEl(target)), null);
	});

	it("returns null for an element no open view contains", () => {
		const v = view({ containerEl: el({}), editor: editor("") });
		assert.strictEqual(findMarkdownViewForTarget(plugin(v), asEl(el({ tag: "span" }))), null);
	});

	it("counts the container itself as containing the element", () => {
		const container = el({});
		const v = view({ containerEl: container, editor: editor("") });
		assert.strictEqual(findMarkdownViewForTarget(plugin(v), asEl(container)), v);
	});
});

/* -------------------------------------------------------------------------- */
/* 102 — inline pills                                                          */
/* -------------------------------------------------------------------------- */

describe("resolveContext — inline pill", () => {
	/** A pill in a reading-view container, plus the plugin around it. */
	function inlineCase(calloutId: string, extra: FakeElement[] = []) {
		const label = el({ tag: "span", text: "Tip" });
		const pill = el({
			tag: "span",
			cls: "cs-inline-callout",
			attrs: { "data-callout": calloutId },
			children: [label, ...extra],
		});
		const container = el({ children: [el({ children: [pill] })] });
		const v = view({ containerEl: container, editor: editor("text") });
		return { label, pill, container, plugin: plugin(v), view: v };
	}

	it("resolves the pill under the pointer, in reading view", () => {
		const c = inlineCase("tip");
		const result = resolveContext(c.plugin, trigger(c.label));

		assert.ok(result);
		assert.strictEqual(result.role, "inline");
		assert.strictEqual(result.id, "tip");
		assert.strictEqual(result.surface, "reading");
		assert.strictEqual(result.view, c.view);
	});

	it("normalizes the attribute it reads", () => {
		const c = inlineCase("  Multi   Word  ");
		const result = resolveContext(c.plugin, trigger(c.pill));

		assert.strictEqual(result?.id, "multi word");
	});

	it("drops the metadata half of a piped attribute", () => {
		const c = inlineCase("note|purple");
		assert.strictEqual(resolveContext(c.plugin, trigger(c.pill))?.id, "note");
	});

	it("refuses a pill whose attribute names nothing", () => {
		const c = inlineCase("   ");
		assert.strictEqual(resolveContext(c.plugin, trigger(c.pill)), null);
	});

	it("leaves a link inside a content pill to Obsidian's own link menu", () => {
		// `[!warning]{see [docs](url)}` holds the user's markdown. This resolver
		// runs first, so without the guard a right-click on that link would open
		// the callout menu instead.
		const linkText = el({ tag: "span", text: "docs" });
		const link = el({ tag: "a", children: [linkText] });
		const c = inlineCase("warning", [link]);

		assert.strictEqual(resolveContext(c.plugin, trigger(link)), null);
		assert.strictEqual(resolveContext(c.plugin, trigger(linkText)), null);
		// …while the pill's own chrome still resolves.
		assert.strictEqual(resolveContext(c.plugin, trigger(c.label))?.role, "inline");
	});

	it("returns nothing when no open view contains the pill", () => {
		const c = inlineCase("tip");
		assert.strictEqual(resolveContext(plugin(), trigger(c.label)), null);
	});

	it("reports the surface it was clicked on", () => {
		const pill = el({
			tag: "span",
			cls: "cs-inline-callout",
			attrs: { "data-callout": "tip" },
		});
		const cmEditor = el({ cls: "cm-editor", children: [pill] });

		const sourceContainer = el({
			children: [el({ cls: "markdown-source-view", children: [cmEditor] })],
		});
		const sourceView = view({
			containerEl: sourceContainer,
			editor: editor(""),
		});
		assert.strictEqual(resolveContext(plugin(sourceView), trigger(pill))?.surface, "source");

		const lpPill = el({
			tag: "span",
			cls: "cs-inline-callout",
			attrs: { "data-callout": "tip" },
		});
		const lpContainer = el({
			children: [
				el({
					cls: "markdown-source-view is-live-preview",
					children: [el({ cls: "cm-editor", children: [lpPill] })],
				}),
			],
		});
		const lpView = view({ containerEl: lpContainer, editor: editor("") });
		assert.strictEqual(resolveContext(plugin(lpView), trigger(lpPill))?.surface, "live-preview");
	});
});

/* -------------------------------------------------------------------------- */
/* 102 — heading callouts                                                      */
/* -------------------------------------------------------------------------- */

describe("resolveContext — heading callout, reading view", () => {
	function headingCase(source: string, lineStart: number) {
		const token = el({ tag: "span", cls: "cs-heading-token" });
		const title = el({ tag: "span", text: "Title" });
		const bar = el({
			tag: "h2",
			cls: "cs-heading-callout",
			children: [token, title],
		});
		const preview = el({ children: [bar] });
		const container = el({ children: [preview] });
		const sections = new Map([[bar, { lineStart, lineEnd: lineStart, text: source.split("\n")[lineStart] ?? "" }]]);
		const v = view({
			containerEl: container,
			editor: editor(source),
			previewEl: preview,
			sections,
		});
		return { token, title, bar, plugin: plugin(v), view: v };
	}

	it("resolves the heading line, level and id from the source", () => {
		const c = headingCase("intro\n## [!tip] Title\nbody", 1);
		const result = resolveContext(c.plugin, trigger(c.token));

		assert.ok(result);
		assert.strictEqual(result.role, "heading");
		if (result.role !== "heading") return;
		assert.strictEqual(result.id, "tip");
		assert.strictEqual(result.headingLine, 1);
		assert.strictEqual(result.headingLevel, 2);
		assert.strictEqual(result.surface, "reading");
	});

	it("matches the bar itself as well as the token inside it", () => {
		const c = headingCase("## [!tip] Title", 0);
		assert.strictEqual(resolveContext(c.plugin, trigger(c.bar))?.role, "heading");
		assert.strictEqual(resolveContext(c.plugin, trigger(c.title))?.role, "heading");
	});

	it("reads the level off the source, not off the tag name", () => {
		const c = headingCase("###### [!tip] Deep", 0);
		const result = resolveContext(c.plugin, trigger(c.token));

		assert.strictEqual(result?.role === "heading" && result.headingLevel, 6);
	});

	it("re-verifies against the source: a stale bar resolves to nothing", () => {
		// The DOM class alone is not authoritative — the line may have been
		// edited out from under a bar that has not been repainted yet.
		const c = headingCase("just a plain paragraph", 0);
		assert.strictEqual(resolveContext(c.plugin, trigger(c.token)), null);
	});

	it("refuses a line whose only token is a block callout", () => {
		const c = headingCase("> [!tip] Not a heading", 0);
		assert.strictEqual(resolveContext(c.plugin, trigger(c.token)), null);
	});

	it("walks up until some ancestor answers with a section", () => {
		// Obsidian answers `getSectionInfo` for the rendered *block*, which may
		// be several levels above the element under the pointer.
		const token = el({ tag: "span", cls: "cs-heading-token" });
		const bar = el({ tag: "h2", cls: "cs-heading-callout", children: [token] });
		const block = el({ children: [bar] });
		const preview = el({ children: [block] });
		const container = el({ children: [preview] });
		const v = view({
			containerEl: container,
			editor: editor("## [!tip] Title"),
			previewEl: preview,
			sections: new Map([[block, { lineStart: 0, lineEnd: 0, text: "" }]]),
		});

		assert.strictEqual(resolveContext(plugin(v), trigger(token))?.role, "heading");
	});

	it("gives up when nothing up the chain knows the section", () => {
		const c = headingCase("## [!tip] Title", 0);
		// A view whose lookup answers for nothing at all.
		const blind = view({
			containerEl: c.bar.parentElement!.parentElement!,
			editor: editor("## [!tip] Title"),
			previewEl: c.bar.parentElement!,
		});
		assert.strictEqual(resolveContext(plugin(blind), trigger(c.token)), null);
	});

	it("drops the metadata from the resolved id", () => {
		const c = headingCase("## [!tip|purple] Title", 0);
		assert.strictEqual(resolveContext(c.plugin, trigger(c.token))?.id, "tip");
	});
});

describe("resolveContext — heading callout, live preview", () => {
	function lpHeadingCase(source: string, posAt: { atDOM?: number; atCoords?: number | null }) {
		const token = el({ tag: "span", cls: "cs-heading-token" });
		const bar = el({ cls: "cs-heading-callout cm-line", children: [token] });
		const cmEditor = el({ cls: "cm-editor", children: [bar] });
		const container = el({
			children: [
				el({
					cls: "markdown-source-view is-live-preview",
					children: [cmEditor],
				}),
			],
		});
		attachEditorView(cmEditor, {
			posAtDOM: () => {
				if (posAt.atDOM === undefined) throw new Error("detached");
				return posAt.atDOM;
			},
			posAtCoords: () => posAt.atCoords ?? null,
		});
		const v = view({ containerEl: container, editor: editor(source) });
		return { token, bar, plugin: plugin(v) };
	}

	it("names the heading line from the element's own position, not the pointer's", () => {
		// The bar's padding bands and its empty tail are inside the element but
		// outside any text row, where posAtCoords answers null and the `, false`
		// fallback snaps to a NEIGHBOURING line — which is why right-click only
		// ever worked when it landed exactly on the heading's text.
		const source = "intro\n## [!tip] Title\nbody";
		const c = lpHeadingCase(source, {
			atDOM: source.indexOf("## [!tip]"),
			atCoords: 0,
		});
		const result = resolveContext(c.plugin, trigger(c.token, { x: 5, y: 5 }));

		assert.ok(result);
		assert.strictEqual(result.role, "heading");
		if (result.role !== "heading") return;
		assert.strictEqual(result.headingLine, 1);
		assert.strictEqual(result.surface, "live-preview");
	});

	it("falls back to the pointer when the element has left the view", () => {
		const source = "intro\n## [!tip] Title";
		const c = lpHeadingCase(source, {
			atDOM: undefined, // posAtDOM throws
			atCoords: source.indexOf("## [!tip]"),
		});
		const result = resolveContext(c.plugin, trigger(c.token, { x: 5, y: 5 }));

		assert.strictEqual(result?.role === "heading" && result.headingLine, 1);
	});

	it("gives up when neither lookup can place the element", () => {
		const c = lpHeadingCase("## [!tip] Title", {
			atDOM: undefined,
			atCoords: null,
		});
		assert.strictEqual(resolveContext(c.plugin, trigger(c.token)), null);
	});
});

/* -------------------------------------------------------------------------- */
/* 102 — block callouts, live preview widget                                   */
/* -------------------------------------------------------------------------- */

describe("resolveContext — native callout widget", () => {
	function widgetCase(source: string, start: number, live = true) {
		const target = el({ tag: "span", text: "body" });
		const widgetEl = el({ cls: "cm-callout", children: [target] });
		const ed = editor(source);
		(widgetEl as unknown as { cmView: unknown }).cmView = {
			widget: { editor: { editor: asEditor(ed) }, start },
		};
		const cmEditor = el({ cls: "cm-editor", children: [widgetEl] });
		const surfaceEl = el({
			cls: live ? "markdown-source-view is-live-preview" : "markdown-source-view",
			children: [cmEditor],
		});
		const container = el({ children: [surfaceEl] });
		const v = view({ containerEl: container, editor: ed });
		return { target, widgetEl, editor: ed, plugin: plugin(v), view: v };
	}

	it("reads the header line straight off the widget's own offset", () => {
		const source = "intro\n> [!warning] Careful\n> body";
		const c = widgetCase(source, source.indexOf("> [!warning]"));
		const result = resolveContext(c.plugin, trigger(c.target));

		assert.ok(result);
		assert.strictEqual(result.role, "regular");
		if (result.role !== "regular") return;
		assert.strictEqual(result.id, "warning");
		assert.strictEqual(result.callout.headerLine, 1);
		assert.strictEqual(result.callout.prefix, "> ");
		assert.strictEqual(result.callout.quoteDepth, 1);
		assert.strictEqual(result.surface, "live-preview");
	});

	it("counts every quote marker in the prefix, so a nested callout is not its parent", () => {
		const source = "> [!note] Outer\n> > [!warning] Inner";
		const c = widgetCase(source, source.indexOf("> > [!warning]"));
		const result = resolveContext(c.plugin, trigger(c.target));

		assert.strictEqual(result?.role === "regular" && result.callout.quoteDepth, 2);
		assert.strictEqual(result?.id, "warning");
	});

	it("reports source mode when the editor is not in Live Preview", () => {
		const c = widgetCase("> [!note] N", 0, false);
		assert.strictEqual(resolveContext(c.plugin, trigger(c.target))?.surface, "source");
	});

	it("resolves even when no markdown leaf holds the element", () => {
		// The widget carries its own editor, so a detached one (a canvas card,
		// an editable transclusion) still resolves — with `view: null`.
		const c = widgetCase("> [!note] N", 0);
		const result = resolveContext(plugin(), trigger(c.target));

		assert.ok(result);
		assert.strictEqual(result.view, null);
		assert.strictEqual(result.id, "note");
	});

	it("stands down when the widget carries no editor or no start offset", () => {
		const c = widgetCase("> [!note] N", 0);
		(c.widgetEl as unknown as { cmView: unknown }).cmView = { widget: {} };
		assert.strictEqual(resolveContext(plugin(), trigger(c.target)), null);
	});

	it("stands down when the line at the offset is not a header", () => {
		const c = widgetCase("plain paragraph", 0);
		assert.strictEqual(resolveContext(plugin(), trigger(c.target)), null);
	});
});

/* -------------------------------------------------------------------------- */
/* 102 — block callouts, editor coordinates                                    */
/* -------------------------------------------------------------------------- */

describe("resolveContext — editor coordinates", () => {
	function coordCase(source: string, offset: number | null, precise = true) {
		const target = el({ tag: "span", cls: "cm-line" });
		const cmEditor = el({ cls: "cm-editor", children: [target] });
		const container = el({
			children: [el({ cls: "markdown-source-view", children: [cmEditor] })],
		});
		attachEditorView(cmEditor, {
			posAtCoords: (_coords, exact) => (exact === false ? offset : precise ? offset : null),
		});
		const v = view({ containerEl: container, editor: editor(source) });
		return { target, plugin: plugin(v) };
	}

	it("walks up from the clicked line to the callout header above it", () => {
		const source = "> [!warning] Careful\n> body\n> more";
		const c = coordCase(source, source.indexOf("> more"));
		const result = resolveContext(c.plugin, trigger(c.target));

		assert.ok(result);
		assert.strictEqual(result.role, "regular");
		if (result.role !== "regular") return;
		assert.strictEqual(result.id, "warning");
		assert.strictEqual(result.callout.headerLine, 0);
		assert.strictEqual(result.callout.quoteDepth, 1);
	});

	it("stops at the first non-quote line above the click", () => {
		const source = "> [!warning] Careful\nplain\n> orphan quote";
		const c = coordCase(source, source.indexOf("> orphan"));
		assert.strictEqual(resolveContext(c.plugin, trigger(c.target)), null);
	});

	it("stops at the innermost header, not the outermost", () => {
		const source = "> [!note] Outer\n> > [!warning] Inner\n> > body";
		const c = coordCase(source, source.indexOf("> > body"));
		const result = resolveContext(c.plugin, trigger(c.target));

		assert.strictEqual(result?.id, "warning");
		assert.strictEqual(result?.role === "regular" && result.callout.quoteDepth, 2);
	});

	it("falls back to the imprecise lookup when the exact one misses", () => {
		const source = "> [!warning] Careful";
		const c = coordCase(source, 0, false);
		assert.strictEqual(resolveContext(c.plugin, trigger(c.target))?.id, "warning");
	});

	it("gives up when neither lookup places the pointer", () => {
		const c = coordCase("> [!warning] Careful", null);
		assert.strictEqual(resolveContext(c.plugin, trigger(c.target)), null);
	});
});

/* -------------------------------------------------------------------------- */
/* 102 — block callouts, reading view                                          */
/* -------------------------------------------------------------------------- */

describe("resolveContext — reading view", () => {
	function readingCase(attrId: string, section: SectionInfo, nesting: string[] = []) {
		const target = el({ tag: "p", text: "body" });
		let node = el({
			cls: "callout",
			attrs: { "data-callout": attrId },
			children: [target],
		});
		const innermost = node;
		for (const outerId of nesting) {
			node = el({
				cls: "callout",
				attrs: { "data-callout": outerId },
				children: [node],
			});
		}
		const preview = el({ children: [node] });
		const container = el({ children: [preview] });
		const v = view({
			containerEl: container,
			editor: editor(section.text),
			previewEl: preview,
			sections: new Map([[innermost, section]]),
		});
		return { target, plugin: plugin(v) };
	}

	it("matches id and quote depth together", () => {
		const text = "> [!note] Outer\n> > [!warning] Inner\n> > body";
		const c = readingCase("warning", { lineStart: 4, lineEnd: 6, text }, ["note"]);
		const result = resolveContext(c.plugin, trigger(c.target));

		assert.ok(result);
		assert.strictEqual(result.role, "regular");
		if (result.role !== "regular") return;
		assert.strictEqual(result.id, "warning");
		assert.strictEqual(result.callout.headerLine, 5);
		assert.strictEqual(result.callout.quoteDepth, 2);
	});

	it("matches in Obsidian's attribute space, not in the id's own spelling", () => {
		// `> [!multi word]` renders as `data-callout="multi-word"`; comparing the
		// attribute against the space-form source id would never match.
		const text = "> [!multi word] Title\n> body";
		const c = readingCase("multi-word", { lineStart: 0, lineEnd: 1, text });
		const result = resolveContext(c.plugin, trigger(c.target));

		// The caller still gets the space form back.
		assert.strictEqual(result?.id, "multi word");
	});

	it("falls back to the same id at another depth", () => {
		const text = "> > [!warning] Nested only";
		const c = readingCase("warning", { lineStart: 0, lineEnd: 0, text });
		const result = resolveContext(c.plugin, trigger(c.target));

		assert.strictEqual(result?.id, "warning");
		assert.strictEqual(result?.role === "regular" && result.callout.quoteDepth, 2);
	});

	it("falls back to another callout at the same depth", () => {
		const text = "> [!note] Something else";
		const c = readingCase("warning", { lineStart: 0, lineEnd: 0, text });
		assert.strictEqual(resolveContext(c.plugin, trigger(c.target))?.id, "note");
	});

	it("falls back to the first callout in the section as a last resort", () => {
		const text = "> > [!note] Deep\n> > body";
		const c = readingCase("warning", { lineStart: 0, lineEnd: 1, text });
		assert.strictEqual(resolveContext(c.plugin, trigger(c.target))?.id, "note");
	});

	it("resolves nothing when the section holds no callout header at all", () => {
		const c = readingCase("warning", {
			lineStart: 0,
			lineEnd: 0,
			text: "plain paragraph",
		});
		assert.strictEqual(resolveContext(c.plugin, trigger(c.target)), null);
	});

	it("refuses a rendered callout carrying no id", () => {
		const c = readingCase("", {
			lineStart: 0,
			lineEnd: 0,
			text: "> [!note] N",
		});
		assert.strictEqual(resolveContext(c.plugin, trigger(c.target)), null);
	});
});

/* -------------------------------------------------------------------------- */
/* 102 — resolution order                                                      */
/* -------------------------------------------------------------------------- */

describe("resolveContext — resolution order", () => {
	it("prefers the pill over the heading bar it sits inside", () => {
		// A pill in a heading title is inside `.cs-heading-callout`; without the
		// most-specific-first order every pill click would edit the heading.
		const pill = el({
			tag: "span",
			cls: "cs-inline-callout",
			attrs: { "data-callout": "tip" },
		});
		const bar = el({ tag: "h2", cls: "cs-heading-callout", children: [pill] });
		const preview = el({ children: [bar] });
		const container = el({ children: [preview] });
		const v = view({
			containerEl: container,
			editor: editor("## [!note] Title"),
			previewEl: preview,
			sections: new Map([[bar, { lineStart: 0, lineEnd: 0, text: "" }]]),
		});

		const result = resolveContext(plugin(v), trigger(pill));
		assert.strictEqual(result?.role, "inline");
		assert.strictEqual(result?.id, "tip");
	});

	it("prefers the heading bar over the block resolvers below it", () => {
		const token = el({ tag: "span", cls: "cs-heading-token" });
		const bar = el({ tag: "h2", cls: "cs-heading-callout", children: [token] });
		// …wrapped in a rendered block callout, which the third resolver matches.
		const block = el({
			cls: "callout",
			attrs: { "data-callout": "note" },
			children: [bar],
		});
		const preview = el({ children: [block] });
		const container = el({ children: [preview] });
		const v = view({
			containerEl: container,
			editor: editor("## [!tip] Title"),
			previewEl: preview,
			sections: new Map([
				[bar, { lineStart: 0, lineEnd: 0, text: "## [!tip] Title" }],
				[block, { lineStart: 0, lineEnd: 0, text: "> [!note] N" }],
			]),
		});

		const result = resolveContext(plugin(v), trigger(token));
		assert.strictEqual(result?.role, "heading");
		assert.strictEqual(result?.id, "tip");
	});

	it("falls through every resolver to null on an unrelated element", () => {
		const target = el({ tag: "p", text: "just prose" });
		const container = el({ children: [target] });
		const v = view({ containerEl: container, editor: editor("just prose") });

		assert.strictEqual(resolveContext(plugin(v), trigger(target)), null);
	});

	it("carries the clicked element through on every role", () => {
		// The menu items read `targetEl` back for their own DOM work.
		const label = el({ tag: "span", text: "Tip" });
		const pill = el({
			tag: "span",
			cls: "cs-inline-callout",
			attrs: { "data-callout": "tip" },
			children: [label],
		});
		const container = el({ children: [pill] });
		const v = view({ containerEl: container, editor: editor("") });

		const result = resolveContext(plugin(v), trigger(label)) as Context;
		assert.strictEqual(result.targetEl, asEl(label));
	});
});
