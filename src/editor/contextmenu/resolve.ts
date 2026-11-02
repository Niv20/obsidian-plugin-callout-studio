/**
 * editor/contextmenu/resolve.ts — Maps a right-click target to a callout
 * context, now role-aware.
 *
 * Resolution order (most specific first):
 *   1. inline callout (`.cs-inline-callout` — same DOM on both surfaces)
 *   2. heading callout (`.cs-heading-callout` line/hN or its `.cs-heading-token`)
 *   3. block callout (native widget → editor coords → reading DOM),
 *      unchanged from the pre-role implementation.
 */
import { EditorView } from "@codemirror/view";
import { Editor, type MarkdownSectionInformation, MarkdownView } from "obsidian";
import type CalloutStudioPlugin from "../../main";
import { normalizeCalloutId, obsidianCalloutAttrId } from "../../utils/calloutId";
import { scanLineForCalloutTokens } from "../calloutTokens";
import { CSS_HEADING_LINE, CSS_HEADING_TOKEN, CSS_INLINE_TOKEN } from "../renderShared";

// ─── Constants ───────────────────────────────────────────────────────────────

export const CALLOUT_HEADER_REGEX = /^(\s*>[\s>]*)\[!([^\]]+)\]/;
export const CALLOUT_FOLD_MARK_REGEX = /^(\s*>[\s>]*)\[!([^\]]+)\]([+-])?/;
const LIVE_PREVIEW_SELECTOR = ".markdown-source-view.is-live-preview";
const READING_CALLOUT_SELECTOR = ".callout[data-callout]";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CalloutInfo {
	id: string;
	headerLine: number;
	prefix: string;
	quoteDepth: number;
}

export interface PointerContext {
	targetEl: Element;
	clientX: number;
	clientY: number;
	timestamp: number;
	ownerDocument: Document;
}

interface BaseContext {
	/** Normalized callout id under the pointer. */
	id: string;
	editor: Editor;
	view: MarkdownView | null;
	surface: "source" | "live-preview" | "reading";
	targetEl: Element;
}

/** Discriminated by render role; menu items key off `role`. */
export type ResolvedCalloutContext =
	| (BaseContext & { role: "regular"; callout: CalloutInfo })
	| (BaseContext & {
			role: "heading";
			headingLine: number;
			headingLevel: number;
	  })
	| (BaseContext & { role: "inline" });

interface PreviewSectionLookup {
	getSectionInfo(el: HTMLElement): MarkdownSectionInformation | null;
}

interface CalloutWidgetElement extends HTMLElement {
	cmView?: {
		widget?: {
			editor?: { editor?: Editor };
			start?: number;
		};
	};
}

// ─── Top-level resolver ──────────────────────────────────────────────────────

export function resolveContext(plugin: CalloutStudioPlugin, trigger: PointerContext): ResolvedCalloutContext | null {
	return (
		resolveInlinePillContext(plugin, trigger.targetEl) ??
		resolveHeadingContext(plugin, trigger) ??
		resolveRegularContext(plugin, trigger)
	);
}

function resolveRegularContext(plugin: CalloutStudioPlugin, trigger: PointerContext): ResolvedCalloutContext | null {
	const widgetContext = resolveCalloutWidgetContext(plugin, trigger.targetEl);
	if (widgetContext) return widgetContext;

	const view = findMarkdownViewForTarget(plugin, trigger.targetEl);
	if (!view) return null;

	return resolveEditorContext(view, trigger) ?? resolveReadingContext(view, trigger.targetEl);
}

// ─── Inline callout ──────────────────────────────────────────────────────────

function resolveInlinePillContext(plugin: CalloutStudioPlugin, targetEl: Element): ResolvedCalloutContext | null {
	const pill = targetEl.closest(`.${CSS_INLINE_TOKEN}[data-callout]`);
	if (!pill) return null;
	// A content pill (`[!warning]{see [docs](url)}`) holds the user's own
	// markdown, links included. This resolver runs first, so without the guard a
	// right-click on such a link would open the callout menu instead of
	// Obsidian's link menu. The pill's own chrome and plain text still resolve.
	if (targetEl.closest("a") && pill.contains(targetEl.closest("a"))) {
		return null;
	}
	const id = normalizeCalloutId(pill.getAttribute("data-callout") ?? "");
	if (!id) return null;

	const view = findMarkdownViewForTarget(plugin, targetEl);
	if (!view) return null;

	return {
		role: "inline",
		id,
		editor: view.editor,
		view,
		surface: resolveSurface(targetEl),
		targetEl,
	};
}

// ─── Heading callout ─────────────────────────────────────────────────────────

function resolveHeadingContext(plugin: CalloutStudioPlugin, trigger: PointerContext): ResolvedCalloutContext | null {
	const headingEl = trigger.targetEl.closest(`.${CSS_HEADING_LINE}, .${CSS_HEADING_TOKEN}`);
	if (!(headingEl instanceof HTMLElement)) return null;

	const view = findMarkdownViewForTarget(plugin, trigger.targetEl);
	if (!view) return null;

	// Locate the heading's source line: the matched element in LP, section info
	// in reading view.
	let headingLine: number | null = null;
	const cmRoot = trigger.targetEl.closest(".cm-editor");
	if (cmRoot instanceof HTMLElement) {
		const editorView = EditorView.findFromDOM(cmRoot);
		if (editorView) {
			// `headingEl` is the bar itself — a Decoration.line, so it IS the
			// .cm-line — or the token widget inside it. Either way its own
			// document position names the heading line exactly, with no
			// dependence on where in the row the pointer landed.
			//
			// posAtCoords cannot do that: the bar's vertical padding bands
			// (--cs-heading-pad-top/bottom) and the empty tail after the title
			// are inside the element but outside any text row, so it returns
			// null there and the `, false` fallback snaps to a NEIGHBOURING
			// line. The re-verify below then finds no heading token and the
			// whole menu disappears — which is why right-click only worked
			// when it landed exactly on the heading's text.
			try {
				headingLine = view.editor.offsetToPos(editorView.posAtDOM(headingEl)).line;
			} catch {
				// Element not part of this view's content (detached mid-menu):
				// fall back to the pointer, which is better than no menu.
				const coords = { x: trigger.clientX, y: trigger.clientY };
				const offset = editorView.posAtCoords(coords) ?? editorView.posAtCoords(coords, false);
				if (offset != null) {
					headingLine = view.editor.offsetToPos(offset).line;
				}
			}
		}
	} else {
		const sectionInfo = getSectionInfo(view, headingEl);
		if (sectionInfo) headingLine = sectionInfo.lineStart;
	}
	if (headingLine == null) return null;

	// Re-verify against the source — the DOM class alone is not authoritative.
	const token = scanLineForCalloutTokens(view.editor.getLine(headingLine)).find((tk) => tk.role === "heading");
	if (!token) return null;

	return {
		role: "heading",
		id: normalizeCalloutId(token.rawId),
		headingLine,
		headingLevel: token.headingLevel,
		editor: view.editor,
		view,
		surface: resolveSurface(trigger.targetEl),
		targetEl: trigger.targetEl,
	};
}

// ─── Block callout resolvers (pre-existing behavior) ────────────────────────

function resolveCalloutWidgetContext(plugin: CalloutStudioPlugin, targetEl: Element): ResolvedCalloutContext | null {
	const calloutEl = targetEl.closest<CalloutWidgetElement>(".cm-callout");
	const widget = calloutEl?.cmView?.widget;
	const editor = widget?.editor?.editor;
	if (!calloutEl || !editor || widget.start === undefined) return null;

	const headerLine = editor.offsetToPos(widget.start).line;
	const text = editor.getLine(headerLine);
	const match = CALLOUT_HEADER_REGEX.exec(text);
	if (!match || match[1] === undefined || match[2] === undefined) return null;

	const view = findMarkdownViewForTarget(plugin, targetEl);
	const prefix = match[1];
	const id = normalizeCalloutId(match[2]);
	return {
		role: "regular",
		id,
		callout: {
			id,
			headerLine,
			prefix,
			quoteDepth: countQuoteDepth(prefix),
		},
		editor,
		view,
		surface: targetEl.closest(LIVE_PREVIEW_SELECTOR) ? "live-preview" : "source",
		targetEl,
	};
}

// Source mode and Live Preview: use the official CM6 API to map click
// coordinates to a document position, then walk up to the callout header.
function resolveEditorContext(view: MarkdownView, trigger: PointerContext): ResolvedCalloutContext | null {
	const cmRoot = trigger.targetEl.closest(".cm-editor");
	if (!(cmRoot instanceof HTMLElement)) return null;

	const editorView = EditorView.findFromDOM(cmRoot);
	if (!editorView) return null;

	const coords = { x: trigger.clientX, y: trigger.clientY };
	const offset = editorView.posAtCoords(coords) ?? editorView.posAtCoords(coords, false);
	if (offset == null) return null;

	const position = view.editor.offsetToPos(offset);
	const callout = findCalloutAtLine(view.editor, position.line);
	if (!callout) return null;

	return {
		role: "regular",
		id: callout.id,
		callout,
		editor: view.editor,
		view,
		surface: trigger.targetEl.closest(LIVE_PREVIEW_SELECTOR) ? "live-preview" : "source",
		targetEl: trigger.targetEl,
	};
}

// Reading view: find the rendered callout element, look up its source section,
// then match back to the raw markdown line.
function resolveReadingContext(view: MarkdownView, targetEl: Element): ResolvedCalloutContext | null {
	const calloutEl = targetEl.closest(READING_CALLOUT_SELECTOR);
	if (!(calloutEl instanceof HTMLElement)) return null;

	const sectionInfo = getSectionInfo(view, calloutEl);
	if (!sectionInfo) return null;

	// Obsidian writes the DASH form here (`> [!multi word callout]` becomes
	// `data-callout="multi-word-callout"`), so match the source lines in that
	// same space rather than against the space-form normalized id.
	const calloutAttrId = obsidianCalloutAttrId(calloutEl.getAttribute("data-callout") ?? "");
	if (!calloutAttrId) return null;

	const callout = findCalloutInSection(sectionInfo, calloutAttrId, getCalloutDomDepth(calloutEl));
	if (!callout) return null;

	return {
		role: "regular",
		id: callout.id,
		callout,
		editor: view.editor,
		view,
		surface: "reading",
		targetEl,
	};
}

// ─── Callout finders ─────────────────────────────────────────────────────────

// Walk up from startLine until we hit a callout header or a non-quote line.
function findCalloutAtLine(editor: Editor, startLine: number): CalloutInfo | null {
	for (let line = startLine; line >= 0; line--) {
		const text = editor.getLine(line);
		const match = CALLOUT_HEADER_REGEX.exec(text);
		if (match && match[1] !== undefined && match[2] !== undefined) {
			return {
				id: normalizeCalloutId(match[2]),
				headerLine: line,
				prefix: match[1],
				quoteDepth: countQuoteDepth(match[1]),
			};
		}
		if (!/^\s*>/.test(text)) return null;
	}
	return null;
}

// Scan a rendered section's source text for a callout header matching the
// given id and quote depth. Falls back: same id → same depth → first callout.
//
// The id match runs in Obsidian's *attribute* space (see obsidianCalloutAttrId)
// because that projection is all the rendered DOM preserves: `> [!multi word
// callout]` renders as `data-callout="multi-word-callout"`, so comparing the
// caller's attribute against the space-form source ids would never match. For
// ids that legitimately contain dashes the projection is the identity.
function findCalloutInSection(
	sectionInfo: MarkdownSectionInformation,
	calloutAttrId: string,
	quoteDepth: number,
): CalloutInfo | null {
	let sameIdMatch: CalloutInfo | null = null;
	let sameDepthMatch: CalloutInfo | null = null;
	let firstCallout: CalloutInfo | null = null;

	for (const [index, lineText] of sectionInfo.text.split("\n").entries()) {
		const match = CALLOUT_HEADER_REGEX.exec(lineText);
		if (!match || match[1] === undefined || match[2] === undefined) {
			continue;
		}

		const callout: CalloutInfo = {
			id: normalizeCalloutId(match[2]),
			headerLine: sectionInfo.lineStart + index,
			prefix: match[1],
			quoteDepth: countQuoteDepth(match[1]),
		};

		if (!firstCallout) firstCallout = callout;

		// `callout.id` stays space-form for the caller; only the comparison
		// moves into attribute space.
		const attrId = obsidianCalloutAttrId(callout.id);

		if (attrId === calloutAttrId && callout.quoteDepth === quoteDepth) {
			return callout;
		}

		if (!sameIdMatch && attrId === calloutAttrId) sameIdMatch = callout;
		if (!sameDepthMatch && callout.quoteDepth === quoteDepth) sameDepthMatch = callout;
	}

	return sameIdMatch ?? sameDepthMatch ?? firstCallout;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function resolveSurface(targetEl: Element): "source" | "live-preview" | "reading" {
	if (!targetEl.closest(".cm-editor")) return "reading";
	return targetEl.closest(LIVE_PREVIEW_SELECTOR) ? "live-preview" : "source";
}

export function findMarkdownViewForTarget(plugin: CalloutStudioPlugin, targetEl: Element): MarkdownView | null {
	for (const leaf of plugin.app.workspace.getLeavesOfType("markdown")) {
		const { view } = leaf;
		if (view instanceof MarkdownView && view.containerEl.contains(targetEl)) {
			return view;
		}
	}
	return null;
}

function getSectionInfo(view: MarkdownView, targetEl: HTMLElement): MarkdownSectionInformation | null {
	const previewMode = view.previewMode as MarkdownView["previewMode"] & Partial<PreviewSectionLookup>;
	let current: HTMLElement | null = targetEl;

	while (current && view.previewMode.containerEl.contains(current)) {
		const info = previewMode.getSectionInfo?.(current) ?? null;
		if (info) return info;
		current = current.parentElement;
	}

	return null;
}

function getCalloutDomDepth(calloutEl: HTMLElement): number {
	let depth = 0;
	let current: HTMLElement | null = calloutEl;

	while (current) {
		if (current.matches(READING_CALLOUT_SELECTOR)) depth += 1;
		current = current.parentElement?.closest(READING_CALLOUT_SELECTOR) ?? null;
	}

	return depth;
}

function countQuoteDepth(prefix: string): number {
	return prefix.match(/>/g)?.length ?? 0;
}
