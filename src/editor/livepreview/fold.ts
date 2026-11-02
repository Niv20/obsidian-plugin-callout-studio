/**
 * editor/livepreview/fold.ts — heading-callout folding.
 *
 * The single fold path for every editor the in-bar fold arrow appears in:
 * real notes and the embedded settings preview alike. The section range comes
 * from `foldable()` of `@codemirror/language`, which queries the fold service
 * Obsidian registers for headings — so the arrow folds EXACTLY the range
 * Obsidian's own pre-heading fold arrow would fold.
 *
 * `@codemirror/language` is an esbuild external supplied by Obsidian at
 * runtime, so `foldable`/`foldEffect`/`foldedRanges` are the SAME service and
 * effect/field instances the native arrow uses: folds made here are
 * indistinguishable from native ones (persisted and restored the same way),
 * and reading `foldedRanges` reflects native-arrow folds too.
 *
 * The settings preview editor may lack Obsidian's fold service and even the
 * fold StateField. When `foldable()` returns null the range falls back to a
 * document-text scan, and if a dispatched fold effect is dropped because the
 * field is missing, `codeFolding()` is appended on demand; its parts are
 * module-level singletons, so re-adding is a deduped no-op in editors that
 * already fold.
 */
import {
	codeFolding,
	foldable,
	foldEffect,
	foldedRanges,
	forceParsing,
	language,
	syntaxTree,
	unfoldEffect,
} from "@codemirror/language";
import { StateEffect } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

interface FoldRange {
	from: number;
	to: number;
}

/**
 * Whether the folded-range set differs between two editor states. The fold
 * StateField reuses its RangeSet by reference while nothing fold-related
 * happens (no effect, no doc change), so an identity check is enough — and it
 * catches EVERY fold change regardless of origin, including ones dispatched by
 * Obsidian's own pre-heading fold arrow. Used by the Live Preview ViewPlugin to
 * rebuild the in-bar chevron in lockstep with the native arrow: on iOS a native
 * fold tap doesn't otherwise trip any of the plugin's rebuild triggers, so the
 * chevron would keep its stale direction.
 */
export function foldsChanged(a: EditorState, b: EditorState): boolean {
	return foldedRanges(a) !== foldedRanges(b);
}

/** The folded range that starts on the given 0-based line, if any. */
function foldStartingAt(view: EditorView, headingLine: number): FoldRange | null {
	let found: FoldRange | null = null;
	const doc = view.state.doc;
	foldedRanges(view.state).between(0, doc.length, (from, to) => {
		if (doc.lineAt(from).number - 1 === headingLine) {
			found = { from, to };
			return false; // stop iterating
		}
		return undefined;
	});
	return found;
}

/** The set of heading start-lines (0-based) currently folded in this editor. */
export function getFoldedLines(view: EditorView): ReadonlySet<number> {
	const lines = new Set<number>();
	const doc = view.state.doc;
	foldedRanges(view.state).between(0, doc.length, (from) => {
		lines.add(doc.lineAt(from).number - 1);
	});
	return lines;
}

/** Time budget for the post-toggle parse catch-up below, in milliseconds. */
const PARSE_CATCHUP_MS = 30;

/**
 * Let the parser catch up with the viewport a fold just moved.
 *
 * Obsidian's own Live Preview plugin — the one that hides `#` marks, list
 * bullets and the rest of the markdown syntax — declines to rebuild ANY of its
 * decorations while the syntax tree stops short of the viewport:
 *
 *     syntaxTree(state).length < view.viewport.to || view.composing ||
 *         view.plugin(livePreviewState)?.mousedown
 *             ? this.decorations = this.decorations.map(update.changes)   // skip
 *             : (treeChanged || viewportChanged || selectionSet || …) && rebuild
 *
 * A fold or an unfold is exactly what pushes `viewport.to` past that frontier:
 * hiding a section means CodeMirror has to reach further down the document to
 * fill the same screen. So on a note big enough for Lezer's incremental parse to
 * be behind, toggling a heading leaves every plain `#### Title` that came into
 * view showing its raw hashes until the idle parse worker happens to catch up.
 * (Heading callouts never show this: their hashes are hidden by this plugin's
 * own CSS_HEADING_HIDE_MARKS, which has none of core's brakes.)
 *
 * Nudging the parser past the viewport ourselves ends it in the same frame:
 * forceParsing dispatches an empty transaction whenever the tree advances, and
 * a changed tree is precisely the trigger core rebuilds on. Time-boxed, and
 * gated on the condition core actually skips for — so a note whose tree already
 * covers the viewport (the common case) pays one field read and nothing else.
 *
 * Deferred by a task because `viewport` only reflects the fold after CodeMirror
 * has re-measured.
 */
function scheduleParseCatchUp(view: EditorView): void {
	const win = view.dom.ownerDocument.defaultView;
	if (!win) return;
	win.setTimeout(() => {
		if (!view.dom.isConnected) return; // torn down while we waited
		try {
			// No parser in this surface — and forceParsing would still cost a
			// dispatch: ensureSyntaxTree answers null without one, which never
			// equals the empty tree it compares against.
			if (!view.state.facet(language)) return;
			if (syntaxTree(view.state).length >= view.viewport.to) return;
			forceParsing(view, view.viewport.to, PARSE_CATCHUP_MS);
		} catch {
			// A surface without a language parser, or an editor mid-teardown:
			// the catch-up is an optimization, never a correctness step.
		}
	}, 0);
}

/** Toggle the fold of the heading section starting on the given 0-based line. */
export function toggleHeadingFold(view: EditorView, headingLine: number): void {
	const existing = foldStartingAt(view, headingLine);
	if (existing) {
		view.dispatch({ effects: unfoldEffect.of(existing) });
		scheduleParseCatchUp(view);
		return;
	}

	const doc = view.state.doc;
	const line = doc.line(headingLine + 1);
	let range = foldable(view.state, line.from, line.to);
	if (!range) {
		// No fold service in this editor (settings preview) — bound the
		// section by scanning the document text instead.
		const endLine = scanSectionEnd(view, headingLine);
		if (endLine <= headingLine) return; // empty section — nothing to fold
		range = {
			from: line.to,
			to: doc.line(Math.min(endLine, doc.lines - 1) + 1).to,
		};
	}
	if (range.to <= range.from) return;

	view.dispatch({ effects: foldEffect.of(range) });
	if (!foldStartingAt(view, headingLine)) {
		// The fold StateField wasn't in this editor's config, so the effect
		// was dropped. Add the folding extension and retry (two dispatches:
		// a field appended mid-transaction doesn't see that transaction's
		// own effects).
		view.dispatch({ effects: StateEffect.appendConfig.of(codeFolding()) });
		view.dispatch({ effects: foldEffect.of(range) });
	}
	scheduleParseCatchUp(view);
}

/**
 * Last line (0-based) of a heading's section within the editor document: the
 * line before the next heading of the same or a higher level, else the last
 * line. Regex fallback for editors without Obsidian's fold service.
 */
function scanSectionEnd(view: EditorView, headingLine: number): number {
	const doc = view.state.doc;
	const headText = doc.line(headingLine + 1).text;
	const level = headText.match(/^(#{1,6})\s/)?.[1]?.length ?? 6;
	for (let ln = headingLine + 1; ln < doc.lines; ln++) {
		const m = doc.line(ln + 1).text.match(/^(#{1,6})\s/);
		if (m?.[1] && m[1].length <= level) return ln - 1;
	}
	return doc.lines - 1;
}
