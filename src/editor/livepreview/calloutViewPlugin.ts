/**
 * editor/livepreview/calloutViewPlugin.ts — Live Preview rendering for the
 * heading and inline callout roles.
 *
 * A single ViewPlugin recomputes decorations for the VISIBLE ranges only, on
 * doc/viewport/selection changes and on the explicit refresh effect. Per-line
 * cost is dominated by an indexOf("[!") bail, so typing stays cheap even in
 * huge notes.
 *
 * Decoration strategy:
 * - Heading line  → Decoration.line adds the bar class + data-callout (kept
 *   even while the caret is on the line, mirroring how native callouts keep
 *   their frame during editing) + a replace widget over the `[!id]` token
 *   when the caret is elsewhere.
 * - Inline token  → replace widget (pill) unless the selection touches it,
 *   in which case the raw text is revealed for editing. A pill carrying a
 *   `{…}` payload is replaced WHOLE, payload included, which is what keeps it a
 *   single indivisible element (see CalloutContentPillWidget).
 * - Native `> [!id]` headers, code, math and frontmatter are never touched.
 *
 * Active in Live Preview only (source mode shows raw markdown, matching how
 * Obsidian treats its own callouts).
 */
import {
	Decoration,
	ViewPlugin,
	type DecorationSet,
	type EditorView,
	type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder, type EditorSelection } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { editorLivePreviewField, livePreviewState } from "obsidian";
import type { App } from "obsidian";
import type { PluginSettings } from "../../types";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import {
	findWikilinkCalloutRefs,
	nestedInlineTokens,
	tokenEnd,
} from "../calloutTokens";
import {
	CSS_HEADING_HIDE_MARKS,
	CSS_HEADING_LINE,
	CSS_HEADING_TITLE,
	CSS_UNKNOWN,
	calloutDomId,
	resolveCalloutDef,
	shouldRenderToken,
} from "../renderShared";
import { editorLineCalloutTokens, excludedEditorRange } from "./sourceTokens";
import { isHeadingFoldEnabled, resolveMarkdownView } from "../headingFold";
import {
	CalloutContentPillWidget,
	CalloutTokenWidget,
	HeadingFoldArrowWidget,
	HeadingRefLinkWidget,
} from "./widgets";
import { getFoldedLines, foldsChanged } from "./fold";
import { registerCalloutContextClickGuard } from "./contextClick";
import {
	calloutStudioCaretDrop,
	calloutStudioRefresh,
	registerCalloutEditorView,
	unregisterCalloutEditorView,
} from "./refresh";

/** Narrow structural host type (avoids importing the concrete plugin class). */
export interface LivePreviewHost {
	app: App;
	registry: CalloutRegistry;
	settings: PluginSettings;
}

const NO_FOLDS: ReadonlySet<number> = new Set();

/** Syntax-tree node names whose content must never be decorated. */
const SKIP_NODE_RE = /codeblock|frontmatter|yaml|inline-code|math|comment/i;

/** True when `text[i]` is a space or tab (bounds-safe). */
function isSpaceAt(text: string, i: number): boolean {
	return text[i] === " " || text[i] === "\t";
}

export function createCalloutViewPlugin(host: LivePreviewHost) {
	const plugin = ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			/**
			 * Raw-syntax reveal is frozen while the left mouse button is held
			 * (Obsidian's livePreviewState.mousedown). Core defers its own
			 * `#`-mark reveal to mouseup; without the freeze our raw `[!id]`
			 * reveal lands a beat earlier, producing a two-stage flash.
			 * Freezing also keeps widgets stable during drag-selection and
			 * stops an already-revealed line from re-collapsing mid-click.
			 *
			 * On mobile this window is much wider than a physical click: core
			 * arms the same flag on EVERY caret move and clears it on a 700ms
			 * debounce, so almost any tap is followed by two-thirds of a second
			 * during which core will not re-render.
			 */
			private wasMousedown = false;
			/**
			 * The selection and focus the reveal is drawn from — a snapshot,
			 * not a live read. The freeze above only ever gated rebuilds
			 * TRIGGERED by a selection change; a rebuild triggered by anything
			 * else (a fold, a refresh effect, a viewport scroll mid-drag) read
			 * the live selection and revealed a line core was still holding
			 * closed, or collapsed one core was still holding open — which is
			 * how a raw `###` ends up in front of a finished bar. Snapshotting
			 * makes every rebuild agree with whatever core last acted on,
			 * whichever trigger fired it.
			 */
			private selection: EditorSelection;
			private focused: boolean;
			private destroyed = false;
			/** Handle of the pending safety-net timer, so destroy() can cancel it. */
			private mouseUpTimer: number | null = null;
			private readonly ownerDoc: Document;
			private readonly onDocMouseUp: () => void;
			private readonly removeContextClickGuard: () => void;

			constructor(private readonly view: EditorView) {
				this.selection = view.state.selection;
				this.focused = view.hasFocus;
				this.decorations = buildDecorations(
					view,
					host,
					this.selection,
					this.focused,
				);
				this.ownerDoc = view.dom.ownerDocument;
				this.removeContextClickGuard = registerCalloutContextClickGuard(view.dom);
				// Registry edits don't touch the document, so this view only
				// rebuilds when something dispatches the refresh effect into
				// it — which needs it to be findable. Leaf or not (table cell,
				// canvas card, editable transclusion, settings preview), it is
				// tracked from here until destroy() (see refresh.ts).
				registerCalloutEditorView(view);
				// Safety net for drags that end outside the editor (or over a
				// widget that swallowed the event): if no transaction cleared
				// the freeze by the next macrotask, force one via the no-op
				// refresh effect. When core already dispatched on mouseup this
				// is a no-op because wasMousedown is false by then.
				//
				// The listener sits on the shared document and one instance of
				// this plugin exists per EditorView (notes, table cells, canvas
				// cards, the settings preview), so a single physical mouseup
				// reaches every one of them. Three things keep that from turning
				// into a fan-out of dispatches into unrelated views: only an
				// ARMED view (one that saw the mousedown) acts, the timer always
				// disarms itself even when it bails — so a view that stopped
				// receiving updates cannot stay armed forever and re-fire on
				// every later mouseup — and destroy() cancels a timer still in
				// flight instead of letting it land in a torn-down editor.
				this.onDocMouseUp = () => {
					if (this.mouseUpTimer !== null) return;
					this.mouseUpTimer = window.setTimeout(() => {
						this.mouseUpTimer = null;
						const armed = this.wasMousedown;
						this.wasMousedown = false;
						if (
							this.destroyed ||
							!armed ||
							!this.view.dom.isConnected
						) {
							return;
						}
						try {
							this.view.dispatch({
								effects: calloutStudioRefresh.of(null),
							});
						} catch {
							// View torn down mid-flight — same contract as
							// refreshAllCalloutEditors.
						}
					}, 0);
				};
				this.ownerDoc.addEventListener("mouseup", this.onDocMouseUp);
			}

			update(update: ViewUpdate): void {
				const mousedown =
					update.view.plugin(livePreviewState)?.mousedown ?? false;
				const refreshed = update.transactions.some((tr) =>
					tr.effects.some((e) => e.is(calloutStudioRefresh)),
				);
				// A caret this plugin dropped itself: a click on an inline pill,
				// whose only editing affordance is the raw source it reveals.
				// The freeze below must not touch it — see calloutStudioCaretDrop
				// for why deferring this one can lose the reveal entirely rather
				// than merely delay it.
				const caretDrop = update.transactions.some((tr) =>
					tr.effects.some((e) => e.is(calloutStudioCaretDrop)),
				);
				const mouseReleased = this.wasMousedown && !mousedown;
				// A fold/unfold made anywhere — crucially including Obsidian's own
				// pre-heading fold arrow — changes the folded-range set but need
				// not touch the doc, viewport or selection. Rebuild so the in-bar
				// chevron rotates in lockstep with the native arrow (on iOS a
				// native fold tap trips none of the other triggers, leaving the
				// chevron stale). Cheap identity check; only meaningful when
				// heading callouts draw the chevron at all.
				const foldChanged =
					host.settings.headingCallouts.enabled &&
					foldsChanged(update.startState, update.state);
				// Not covered here: a change to CodeMirror's line gaps, which it
				// flags separately from `viewportChanged`. That would shrink or
				// grow `visibleRanges` without a rebuild. Unreachable in practice
				// — Obsidian only inserts a gap into a line of 20,000 characters
				// (4,000 with wrapping off) — and the watermark in
				// buildDecorations keeps the split harmless either way.
				//
				// The snapshot moves BEFORE the rebuild so an unfrozen rebuild
				// still sees the current selection. Frozen, it only maps through
				// the document changes, which keeps its offsets valid without
				// letting a caret core has not acted on yet reach the reveal.
				if (update.docChanged) {
					this.selection = this.selection.map(update.changes);
				}
				if (!mousedown || caretDrop) {
					this.selection = update.state.selection;
					this.focused = update.view.hasFocus;
				}
				if (
					update.docChanged ||
					update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state) ||
					refreshed ||
					caretDrop ||
					mouseReleased ||
					foldChanged ||
					((update.selectionSet || update.focusChanged) &&
						!mousedown)
				) {
					this.decorations = buildDecorations(
						update.view,
						host,
						this.selection,
						this.focused,
					);
				}
				this.wasMousedown = mousedown;
			}

			destroy(): void {
				this.destroyed = true;
				this.removeContextClickGuard();
				unregisterCalloutEditorView(this.view);
				if (this.mouseUpTimer !== null) {
					window.clearTimeout(this.mouseUpTimer);
					this.mouseUpTimer = null;
				}
				this.ownerDoc.removeEventListener(
					"mouseup",
					this.onDocMouseUp,
				);
			}
		},
		{ decorations: (v) => v.decorations },
	);
	return plugin;
}

function buildDecorations(
	view: EditorView,
	host: LivePreviewHost,
	/** Frozen snapshot, not `view.state.selection` — see the plugin class. */
	selection: EditorSelection,
	/** Frozen snapshot of `view.hasFocus`, for the same reason. */
	focused: boolean,
): DecorationSet {
	const headingEnabled = host.settings.headingCallouts.enabled;
	const inlineEnabled = host.settings.inlineCallouts.enabled;
	if (!headingEnabled && !inlineEnabled) return Decoration.none;
	// Live Preview only. The `false` default matters: nested sub-editors
	// (e.g. table cells) may lack the field entirely, and field() would
	// throw without it.
	if (!view.state.field(editorLivePreviewField, false)) {
		return Decoration.none;
	}
	const builder = new RangeSetBuilder<Decoration>();
	const doc = view.state.doc;
	const tree = syntaxTree(view.state);
	// Owning file, for resolving links and embeds inside a content pill's
	// payload. Resolved once per rebuild rather than per pill (it walks the open
	// markdown leaves), and "" is a fine answer: an unowned editor — a settings
	// preview, a detached sub-editor — just resolves links relative to the vault
	// root, which is what reading view does there too.
	const contentSourcePath =
		inlineEnabled && host.settings.inlineCallouts.allowContent
			? (resolveMarkdownView(host.app, view)?.file?.path ?? "")
			: "";
	// Heading fold state: only relevant when heading callouts render, the user
	// wants our trailing chevron, AND the core "Fold heading" setting is on
	// (native folding is otherwise absent, so we draw no chevron). Resolved
	// once per rebuild.
	const foldEnabled =
		headingEnabled &&
		host.settings.headingCallouts.showFoldArrow &&
		isHeadingFoldEnabled(host.app);
	const foldedLines: ReadonlySet<number> = foldEnabled
		? getFoldedLines(view)
		: NO_FOLDS;
	// `visibleRanges` is NOT the viewport: CodeMirror subtracts every state-level
	// point decoration of 20 chars or more from it, so one line can be split
	// across two spans (a fold ending at end-of-line, or a line gap inside a very
	// long line). `pos = line.to + 1` then leaves the first span, and the next
	// span's start resolves back to the SAME line — decorating it twice. Two
	// tokens on such a line make RangeSetBuilder throw "Ranges must be added
	// sorted", which costs the whole editor its decorations; one token lands a
	// silent duplicate in a second layer. The ranges are ordered, so a single
	// high-water mark of the last line handled is enough to rule both out.
	let lastLineFrom = -1;
	for (const range of view.visibleRanges) {
		let pos = range.from;
		while (pos <= range.to) {
			const line = doc.lineAt(pos);
			if (line.from <= lastLineFrom) {
				pos = line.to + 1;
				continue;
			}
			lastLineFrom = line.from;
			if (line.text.indexOf("[!") !== -1) {
				decorateLine(
					builder,
					view,
					host,
					tree,
					selection,
					focused,
					line.from,
					line.to,
					line.text,
					headingEnabled,
					inlineEnabled,
					foldEnabled,
					foldedLines,
					contentSourcePath,
				);
			}
			pos = line.to + 1;
		}
	}
	return builder.finish();
}

function decorateLine(
	builder: RangeSetBuilder<Decoration>,
	view: EditorView,
	host: LivePreviewHost,
	tree: ReturnType<typeof syntaxTree>,
	selection: EditorSelection,
	focused: boolean,
	lineFrom: number,
	lineTo: number,
	lineText: string,
	headingEnabled: boolean,
	inlineEnabled: boolean,
	foldEnabled: boolean,
	foldedLines: ReadonlySet<number>,
	/** Owning file path, for links inside a content pill's payload. */
	contentSourcePath: string,
): void {
	// Skip whole lines inside fenced code / frontmatter.
	if (SKIP_NODE_RE.test(tree.resolveInner(lineFrom, 1).name)) return;

	const tokens = editorLineCalloutTokens(view.state, lineFrom, lineText, {
		inlineContent: host.settings.inlineCallouts.allowContent,
	});
	// Tokens sitting inside another token's payload; skipped below (see
	// nestedInlineTokens for why the scanner still reports them).
	const nested = nestedInlineTokens(tokens);
	// Heading-callout refs inside wikilinks (`[[#[!id] Title]]`): never
	// callouts, but their token is hidden (optionally behind the callout's
	// icon) so the displayed link reads `#Title`.
	const refSettings = host.settings.headingCallouts;
	const refs =
		headingEnabled && refSettings.refCleanTitles
			? findWikilinkCalloutRefs(lineText)
			: [];
	if (tokens.length === 0 && refs.length === 0) return;

	// Native block callouts belong to Obsidian's own rendering.
	if (tokens.some((t) => t.role === "regular")) return;

	// Raw-syntax reveal follows the caret only while the editor is focused —
	// the same predicate core uses (`view.hasFocus ? state.selection.ranges :
	// []`). It also keeps unfocused embedded previews (settings cards) fully
	// rendered: their caret parks at position 0, which would otherwise
	// permanently reveal a token on the first line.
	//
	// Both values are the frozen snapshot, never a live read: core does not
	// rebuild on focusChanged at all, so on blur it keeps whatever it last
	// drew while this plugin would otherwise collapse immediately — and a
	// heading whose `[!id]` collapsed under a `###` core is still showing is
	// exactly the half-rendered bar this pairing exists to prevent.
	const selectionTouches = (from: number, to: number): boolean =>
		focused && selection.ranges.some((r) => r.from <= to && r.to >= from);

	// The heading fold chevron sits at the end of the line, but the same line
	// can carry inline tokens after the heading token (e.g. a pill in the
	// title). RangeSetBuilder needs sorted insertion, so we remember the
	// chevron here and add it once, last, below the token loop.
	let pendingFoldArrow: HeadingFoldArrowWidget | null = null;

	// Mid-line decorations. Pills, wikilink refs and the heading-title mark
	// interleave in arbitrary order, so they are collected first and added
	// sorted — RangeSetBuilder requires sorted insertion.
	const midLine: Array<{ from: number; to: number; deco: Decoration }> = [];

	for (const token of tokens) {
		const from = lineFrom + token.from;
		const to = lineFrom + token.to;

		// The theme owns this callout: no bar, no title mark, no token widget,
		// no fold chevron, no pill — the `[!id]` stays as the literal text the
		// user typed. One guard here rather than five below, because every
		// decoration in this loop is keyed off the same token.
		if (!shouldRenderToken(resolveCalloutDef(host.registry, token.rawId))) {
			continue;
		}

		if (token.role === "heading") {
			if (!headingEnabled) continue;
			const resolved = resolveCalloutDef(host.registry, token.rawId);
			// One predicate for the whole heading: it decides the token widget
			// below AND the class that hides the ATX `###`. Obsidian owns the
			// hashes on a rebuild schedule that is allowed to stall (see
			// CSS_HEADING_HIDE_MARKS), so leaving them to it lets a raw `###`
			// surface in front of an otherwise finished bar.
			const collapsed = !selectionTouches(lineFrom, lineTo);
			const cls =
				CSS_HEADING_LINE +
				(resolved.unknown ? ` ${CSS_UNKNOWN}` : "") +
				(collapsed ? ` ${CSS_HEADING_HIDE_MARKS}` : "");
			// The bar stays on the line even while editing it…
			builder.add(
				lineFrom,
				lineFrom,
				Decoration.line({
					attributes: {
						class: cls,
						"data-callout": calloutDomId(token.rawId, resolved),
						// Mirrors what Obsidian stamps on a block callout,
						// so a theme can hook this role the same way. Omitted
						// when absent — an empty attribute is a selector match.
						...(token.metadata
							? { "data-callout-metadata": token.metadata }
							: {}),
					},
				}),
			);
			// The title gets its own inline box, hugging the words, so a
			// gradient title sweep can end on the last letter instead of at
			// the far edge of the full-width bar (see CSS_HEADING_TITLE).
			// Marked in both editing states — the sweep should not blink off
			// when the caret lands on the line. Surrounding whitespace is left
			// out so it never pads the swept box, and the mark stops short of
			// the end-of-line fold chevron (its side beats the mark's endSide).
			if (token.hasTitle) {
				let titleFrom = token.to;
				while (isSpaceAt(lineText, titleFrom)) titleFrom++;
				let titleTo = lineText.length;
				while (titleTo > titleFrom && isSpaceAt(lineText, titleTo - 1)) {
					titleTo--;
				}
				if (titleFrom < titleTo) {
					midLine.push({
						from: lineFrom + titleFrom,
						to: lineFrom + titleTo,
						deco: Decoration.mark({ class: CSS_HEADING_TITLE }),
					});
				}
			}
			// …but the token collapses to icon(+name) only while the caret
			// is elsewhere, so the raw syntax is editable in place.
			if (collapsed) {
				const headingLine = view.state.doc.lineAt(lineFrom).number - 1;
				midLine.push({
					from,
					to,
					deco: Decoration.replace({
						widget: new CalloutTokenWidget(
							host.app,
							token.rawId,
							host.registry,
							"heading",
							!token.hasTitle,
							token.metadata,
							token.to - token.from,
						),
					}),
				});
				// The fold chevron trails the whole heading (after the title
				// text), so it is a separate end-of-line widget rather than part
				// of the token. Only drawn when native "Fold heading" is on;
				// added after the loop to keep builder insertion sorted.
				if (foldEnabled) {
					pendingFoldArrow = new HeadingFoldArrowWidget(
						token.rawId,
						foldedLines.has(headingLine),
					);
				}
			}
			continue;
		}

		// Inline pill.
		if (!inlineEnabled) continue;
		// A payload the user has not finished typing (`[!warning]{…`): the token
		// is still reported so counters and discovery see it, but flashing a
		// pill in front of half-written text would be noise.
		if (token.contentOpen) continue;
		// A token inside another token's payload. Refused here rather than in
		// the scanner, which must keep reporting it so this surface and reading
		// view agree on the token list (see scanLineForCalloutTokens).
		if (nested.has(token)) continue;

		const end = lineFrom + tokenEnd(token);
		// Per-token guard for constructs the line-level check can't see
		// (inline code via multi-backtick spans, inline math, …).
		if (excludedEditorRange(view.state, from, to)) continue;

		// Both kinds of pill reveal their raw source whole while the selection
		// touches them — that is the only editing affordance either one has.
		if (selectionTouches(from, end)) continue;

		// Content pill: the token, the braces and the payload, all replaced by
		// ONE widget, which is what makes it a single indivisible element (see
		// CalloutContentPillWidget for why a mark around live document text
		// cannot be).
		//
		// Empty content takes the plain path below instead: a pill with nothing
		// to render is just the token, and the plain widget draws that better.
		if (token.content && token.content.to > token.content.from + 2) {
			midLine.push({
				from,
				to: end,
				deco: Decoration.replace({
					widget: new CalloutContentPillWidget(
						host.app,
						token.rawId,
						token.metadata,
						host.registry,
						token.content.text,
						contentSourcePath,
						end - from,
					),
				}),
			});
			continue;
		}

		midLine.push({
			from,
			to: end,
			deco: Decoration.replace({
				widget: new CalloutTokenWidget(
					host.app,
					token.rawId,
					host.registry,
					"inline",
					true,
					token.metadata,
					end - from,
				),
			}),
		});
	}

	// Index into `midLine` where the current link's ref entries begin; a
	// whole-link replacement drops that link's earlier token entries, since
	// overlapping replace decorations are illegal in one RangeSet.
	let curLinkFrom = -1;
	let curLinkStartIdx = 0;

	for (const ref of refs) {
		if (ref.linkFrom !== curLinkFrom) {
			curLinkFrom = ref.linkFrom;
			curLinkStartIdx = midLine.length;
		}
		// Aliased links display only the alias — Obsidian hides the target,
		// so target-side tokens stay skipped; alias-side tokens (TOC-plugin
		// links) render like their target-side counterparts.
		if (ref.hasAlias && !ref.inAlias) continue;
		// Same hand-off as the token loop above: the link keeps its plain text.
		if (!shouldRenderToken(resolveCalloutDef(host.registry, ref.rawId))) {
			continue;
		}
		// The whole link reveals raw while the selection touches it (matching
		// Obsidian revealing the `[[`/`]]` brackets), so no token decoration.
		if (
			selectionTouches(lineFrom + ref.linkFrom, lineFrom + ref.linkTo)
		) {
			continue;
		}
		// Same-file reference (`[[#[!id] …]]`): the token opens the target, so
		// the leading `#` is swallowed into the replacement and the link
		// displays as just the title. `Note#` and nested-path `#` separators
		// stay visible.
		const hideHash = !ref.inAlias && ref.from === ref.linkFrom + 3 ? 1 : 0;
		const from = lineFrom + ref.from - hideHash;
		const to = lineFrom + ref.to;
		if (excludedEditorRange(view.state, from, to)) continue;

		// Title-less reference closing the target (`[[#[!id]]]`): the `]]]`
		// run confuses Obsidian's own parsers (link cut at the first `]]`),
		// so the ENTIRE link is replaced with a link-styled icon + display
		// name — the same output reading view produces.
		if (!ref.hasTitle && ref.to === ref.linkTo - 2) {
			// Same-file `#` prefix is dropped from the display (`Note#` stays),
			// matching the titled-ref hash hiding below. An alias token shows
			// nothing before itself.
			const rawPrefix = ref.inAlias
				? ""
				: lineText.slice(ref.linkFrom + 2, ref.from);
			// Navigation target is the inner up to the alias pipe — untruncated
			// even for `]]]` runs and nested `#[!a]#[!b]` paths.
			const inner = lineText.slice(ref.linkFrom + 2, ref.linkTo - 2);
			const pipeIdx = inner.indexOf("|");
			midLine.length = curLinkStartIdx;
			midLine.push({
				from: lineFrom + ref.linkFrom,
				to: lineFrom + ref.linkTo,
				deco: Decoration.replace({
					widget: new HeadingRefLinkWidget(
						host.app,
						ref.rawId,
						host.registry,
						rawPrefix === "#" ? "" : rawPrefix,
						pipeIdx === -1 ? inner : inner.slice(0, pipeIdx),
						refSettings.refShowIcon,
					),
				}),
			});
			continue;
		}

		// Icon (plus display name when the heading has no title of its own),
		// or a bare hide when reference icons are off.
		midLine.push({
			from,
			to,
			deco: refSettings.refShowIcon
				? Decoration.replace({
						widget: new CalloutTokenWidget(
							host.app,
							ref.rawId,
							host.registry,
							"ref",
							!ref.hasTitle,
						),
					})
				: Decoration.replace({}),
		});
	}

	// startSide breaks `from` ties: a mark and a replace can legally open at the
	// same offset — a heading title mark right after its token widget on
	// `## [!info][!tip] …`. This comparator is deliberately the exact key
	// RangeSetBuilder.addInner throws on, so a tie can never be an error, and the
	// order it produces is the one the title mark needs: a non-inclusive mark
	// (startSide 500000000) sorts AFTER a replace (499999999).
	midLine.sort((a, b) => a.from - b.from || a.deco.startSide - b.deco.startSide);
	for (const r of midLine) builder.add(r.from, r.to, r.deco);

	// End-of-line fold chevron, added last so it never precedes an inline token
	// that also sits on this heading line.
	if (pendingFoldArrow) {
		builder.add(
			lineTo,
			lineTo,
			Decoration.widget({ side: 1, widget: pendingFoldArrow }),
		);
	}
}
