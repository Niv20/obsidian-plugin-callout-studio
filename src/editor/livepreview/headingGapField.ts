/**
 * editor/livepreview/headingGapField.ts — Live Preview "gap above the bar"
 * (Callout types → Heading → Global callout style → Spacing between headers).
 *
 * The gap is a block-level spacer above each heading-callout line. In CM6,
 * block decorations (block widgets, and replacing decorations spanning line
 * breaks) MAY NOT be supplied by a view plugin — the content-drawing code
 * needs them before it lays out, whereas a plugin's decorations are read
 * afterwards. Supplying one via the ViewPlugin throws
 * "Block decorations may not be specified via plugins". So the gap lives in a
 * StateField instead (the bar itself, a plain line decoration, stays in the
 * ViewPlugin — line decorations are fine from a plugin).
 *
 * Unlike the ViewPlugin, a StateField can't be viewport-limited: block
 * widgets affect the whole document's height map, so the set is computed over
 * the entire doc. Cost is gated hard — nothing is scanned unless the feature
 * is actually on (gap > 0 and heading callouts enabled) — and each line bails
 * on a cheap indexOf before any real parsing.
 */
import { RangeSetBuilder, StateField } from "@codemirror/state";
import type { EditorState, Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { editorLivePreviewField } from "obsidian";
import { editorLineCalloutTokens } from "./sourceTokens";
import { resolveCalloutDef, shouldRenderToken } from "../renderShared";
import { HeadingGapWidget } from "./headingGapWidget";
import { calloutStudioRefresh } from "./refresh";
import type { LivePreviewHost } from "./calloutViewPlugin";

/** Syntax-tree node names whose content must never be treated as a callout. */
const SKIP_NODE_RE = /codeblock|frontmatter|yaml|inline-code|math|comment/i;

/** Build the block-gap decoration set for the whole document. */
function buildGaps(state: EditorState, host: LivePreviewHost): DecorationSet {
	const gapEm = host.settings.globalStyle.heading.marginTop;
	if (!host.settings.headingCallouts.enabled || gapEm <= 0) {
		return Decoration.none;
	}
	// Live Preview only (source mode shows raw markdown). The `false` default
	// matters: nested sub-editors may lack the field entirely.
	if (!state.field(editorLivePreviewField, false)) {
		return Decoration.none;
	}

	const builder = new RangeSetBuilder<Decoration>();
	const tree = syntaxTree(state);
	const doc = state.doc;
	// One immutable decoration reused for every gap: same em, so identical.
	const gap = Decoration.widget({
		widget: new HeadingGapWidget(gapEm),
		block: true,
		side: -1,
	});

	// Lezer parses incrementally under a time budget, so on a large note the
	// tree routinely stops short of the end. Past that frontier resolveInner()
	// answers with the top node, whose name matches nothing in SKIP_NODE_RE —
	// the code-block / frontmatter skip below would silently pass, and a
	// `## [!id]` written inside a fence would get a gap it must not have. Stop
	// at the frontier instead; it is monotonic, so everything after the first
	// unparsed line is unparsed too. The tail is not lost: the field rebuilds
	// when the parse worker advances the tree (see the update() below).
	// A zero-length tree means there is no tree to consult at all (a surface
	// without the markdown language), where the old whole-document scan is
	// still the better answer.
	const frontier = tree.length > 0 ? tree.length : doc.length;

	for (let n = 1; n <= doc.lines; n++) {
		const line = doc.line(n);
		if (line.from >= frontier) break;
		if (line.text.indexOf("[!") === -1) continue;
		// Skip fenced code / frontmatter, exactly as the bar decoration does.
		if (SKIP_NODE_RE.test(tree.resolveInner(line.from, 1).name)) continue;
		const tokens = editorLineCalloutTokens(state, line.from, line.text);
		// Native `> [!id]` block callouts belong to Obsidian's rendering.
		if (tokens.some((tk) => tk.role === "regular")) continue;
		// The gap belongs to the bar, so it goes wherever the bar goes: a
		// heading whose callout was handed to the theme renders as plain text
		// and would otherwise sit under a blank band with nothing above it.
		const drawsBar = tokens.some(
			(tk) =>
				tk.role === "heading" &&
				shouldRenderToken(resolveCalloutDef(host.registry, tk.rawId)),
		);
		if (drawsBar) {
			builder.add(line.from, line.from, gap);
		}
	}
	return builder.finish();
}

/**
 * The StateField providing the heading-gap block widgets. Rebuilds on document
 * changes and on the plugin's refresh effect (dispatched when settings change,
 * so moving the slider takes effect without reopening the note); otherwise the
 * widget positions are unchanged and the existing set is reused.
 */
export function createHeadingGapField(host: LivePreviewHost): Extension {
	return StateField.define<DecorationSet>({
		create: (state) => buildGaps(state, host),
		update(value, tr) {
			const refreshed = tr.effects.some((e) =>
				e.is(calloutStudioRefresh),
			);
			// buildGaps stops at the syntax tree's parse frontier, so the set it
			// produced on a large note covers only the parsed head. CodeMirror's
			// parse worker dispatches a transaction every time it advances that
			// frontier, which is this rebuild's cue: identity is enough, since
			// the tree object is replaced wholesale on each advance and shared
			// by reference on every other transaction (a selection change costs
			// one field read and nothing more).
			const treeAdvanced =
				syntaxTree(tr.startState) !== syntaxTree(tr.state);
			if (tr.docChanged || refreshed || treeAdvanced) {
				return buildGaps(tr.state, host);
			}
			return value;
		},
		provide: (f) => EditorView.decorations.from(f),
	});
}
