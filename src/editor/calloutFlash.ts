/**
 * editor/calloutFlash.ts — The landing flash after a sidebar result is clicked.
 *
 * Navigation scrolls a callout into view and leaves the selection alone, since
 * a caret anywhere inside a callout makes Live Preview show its raw Markdown.
 * The callout lights up briefly instead, in its own colour (styles.css,
 * `cs-callout-flash`).
 *
 * The rendered callout is reached two ways, because CodeMirror owns one kind of
 * DOM and Obsidian the other:
 * - Lines and inline ranges get decorations from a StateField. Never a class
 *   added by hand to a `.cm-line`: CodeMirror rewrites line attributes it did
 *   not set itself. An inline token takes two marks: one wraps the pill's
 *   widget, the other tints the token's text when no pill covers it.
 * - A Live Preview block callout is Obsidian's own block widget
 *   (`.cm-embed-block.cm-callout`). Line decorations cannot reach it, so its
 *   `.callout` gets the class directly; CodeMirror ignores DOM changes inside
 *   a widget.
 */
import {
	EditorSelection,
	StateEffect,
	StateField,
	type EditorState,
	type Extension,
	type Range,
} from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	type DecorationSet,
	type ViewUpdate,
} from "@codemirror/view";
import { foldedRanges, unfoldEffect } from "@codemirror/language";
import type { Editor, EditorPosition } from "obsidian";
import { obsidianCalloutAttrId } from "../utils/calloutId";
import { scanLineForCalloutTokens } from "./calloutTokens";
import {
	blockCalloutEndLine,
	calloutExtentAt,
	headerQuoteDepth,
	isBlockHeaderLine,
	type CalloutExtent,
	type SourceLines,
} from "./calloutExtent";

/** Keep in step with the `cs-callout-flash` keyframes and delay in styles.css. */
export const FLASH_MS = 1400;
/** How long a phone's sidebar drawer takes to slide away before the flash. */
export const FLASH_DELAY_MS = 280;
/** Room kept above a callout too tall to centre, so its top is not flush. */
const SCROLL_MARGIN_PX = 48;
/** Frames to wait for a scrolled-to block widget to be drawn (about 1/3 s). */
const WIDGET_FRAMES = 20;

export const CSS_FLASH = "cs-callout-flash";
export const CSS_FLASH_LINE = "cs-callout-flash-line";
export const CSS_FLASH_MARK = "cs-callout-flash-mark";
export const CSS_FLASH_TEXT = "cs-callout-flash-text";
export const CSS_FLASH_DELAYED = "cs-callout-flash-delayed";

export interface CalloutFlash {
	extent: CalloutExtent;
	/** Start after a sidebar drawer has had time to close. */
	delayed: boolean;
}

/** Start a flash, or end the current one with `null`. */
export const setCalloutFlash = StateEffect.define<CalloutFlash | null>();

interface FlashState {
	flash: CalloutFlash | null;
	decorations: DecorationSet;
}

const docLines = (state: EditorState): SourceLines => ({
	getLine: (line) => state.doc.line(line + 1).text,
	lineCount: () => state.doc.lines,
});

function flashDecorations(state: EditorState, { extent, delayed }: CalloutFlash): DecorationSet {
	const doc = state.doc;
	if (extent.startLine >= doc.lines) return Decoration.none;
	const suffix = delayed ? ` ${CSS_FLASH_DELAYED}` : "";
	const ranges: Range<Decoration>[] = [];
	if (extent.kind === "inline" || extent.kind === "span") {
		const line = doc.line(extent.startLine + 1);
		const from = line.from + Math.min(extent.from, line.length);
		const to = line.from + Math.min(extent.to, line.length);
		if (to > from) {
			const inline = extent.kind === "inline";
			// Inclusive, so the mark opens before the pill's replace widget at the
			// same offset and wraps it; a plain mark starts after it and never shows.
			if (inline) ranges.push(Decoration.mark({ class: CSS_FLASH_MARK + suffix, inclusive: true }).range(from, to));
			// The tint. On an inline token it is that plain mark, so a drawn pill
			// hides it (the pill flashes itself) and the token's raw text keeps it:
			// styles.css never has to ask which one is showing. A span holds no
			// token, so it stays inclusive.
			ranges.push(Decoration.mark({ class: CSS_FLASH_TEXT + suffix, inclusive: !inline }).range(from, to));
		}
	} else {
		const deco = Decoration.line({ class: CSS_FLASH_LINE + suffix });
		const last = Math.min(extent.endLine, doc.lines - 1);
		for (let line = extent.startLine; line <= last; line++) ranges.push(deco.range(doc.line(line + 1).from));
	}
	return Decoration.set(ranges, true);
}

export const calloutFlashField = StateField.define<FlashState>({
	create: () => ({ flash: null, decorations: Decoration.none }),
	update(value, tr) {
		let next = tr.docChanged ? { ...value, decorations: value.decorations.map(tr.changes) } : value;
		for (const effect of tr.effects) {
			if (!effect.is(setCalloutFlash)) continue;
			next = effect.value
				? { flash: effect.value, decorations: flashDecorations(tr.state, effect.value) }
				: { flash: null, decorations: Decoration.none };
		}
		return next;
	},
	provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

/**
 * The `.callout` element a Live Preview block widget draws for `extent`: the
 * widget itself for a top-level callout, the matching nested `.callout` inside
 * it for a nested one. Null while the widget is not drawn yet.
 */
export function renderedBlockCallout(view: EditorView, extent: CalloutExtent): HTMLElement | null {
	const doc = view.state.doc;
	const lines = docLines(view.state);
	let outer: { widget: HTMLElement; line: number } | null = null;
	for (const widget of Array.from(view.contentDOM.querySelectorAll<HTMLElement>(".cm-embed-block.cm-callout"))) {
		let line: number;
		try { line = doc.lineAt(view.posAtDOM(widget)).number - 1; } catch { continue; }
		if (line <= extent.startLine && (!outer || line > outer.line)) outer = { widget, line };
	}
	if (!outer) return null;
	const outerText = lines.getLine(outer.line);
	const outerToken = scanLineForCalloutTokens(outerText).find((token) => token.role === "regular");
	const outerDepth = Math.max(1, outerToken ? headerQuoteDepth(outerText, outerToken.from) : 1);
	// The nearest widget above can be a different callout that ended earlier.
	if (blockCalloutEndLine(lines, outer.line, outerDepth) < extent.startLine) return null;
	const callouts = Array.from(outer.widget.querySelectorAll<HTMLElement>(".callout"));
	// Nested callouts render inside the outer widget in source order.
	let index = 0;
	for (let line = outer.line + 1; line <= extent.startLine; line++) if (isBlockHeaderLine(lines, line)) index++;
	const rawId = scanLineForCalloutTokens(lines.getLine(extent.startLine))
		.find((token) => token.from === extent.from)?.rawId;
	const nested = callouts[index];
	if (nested && rawId !== undefined && nested.getAttribute("data-callout") === obsidianCalloutAttrId(rawId)) return nested;
	return callouts[0] ?? null;
}

/** Ends each flash on time, and lights up the one thing decorations cannot reach. */
class CalloutFlashPlugin {
	private timer: number | null = null;
	private frame: number | null = null;
	private lit: HTMLElement | null = null;

	constructor(private readonly view: EditorView) {}

	update(update: ViewUpdate): void {
		for (const tr of update.transactions) {
			for (const effect of tr.effects) {
				if (!effect.is(setCalloutFlash)) continue;
				this.stop();
				if (effect.value) this.start(effect.value);
			}
		}
	}

	destroy(): void { this.stop(); }

	private start(flash: CalloutFlash): void {
		this.timer = window.setTimeout(() => {
			this.timer = null;
			if (!this.view.dom.isConnected) return;
			this.view.dispatch({ effects: setCalloutFlash.of(null) });
		}, FLASH_MS + (flash.delayed ? FLASH_DELAY_MS : 0));
		if (flash.extent.kind === "regular") this.lightWidget(flash, 0);
	}

	/** The scroll that brought the widget into view is drawn a frame or two later. */
	private lightWidget(flash: CalloutFlash, attempt: number): void {
		this.frame = window.requestAnimationFrame(() => {
			this.frame = null;
			const target = renderedBlockCallout(this.view, flash.extent);
			if (!target) {
				if (attempt < WIDGET_FRAMES) this.lightWidget(flash, attempt + 1);
				return;
			}
			target.classList.add(CSS_FLASH);
			if (flash.delayed) target.classList.add(CSS_FLASH_DELAYED);
			this.lit = target;
		});
	}

	private stop(): void {
		if (this.timer !== null) window.clearTimeout(this.timer);
		if (this.frame !== null) window.cancelAnimationFrame(this.frame);
		this.timer = this.frame = null;
		this.lit?.classList.remove(CSS_FLASH, CSS_FLASH_DELAYED);
		this.lit = null;
	}
}

/** Register once, with `registerEditorExtension`, for every Markdown editor. */
export function createCalloutFlashExtension(): Extension {
	return [calloutFlashField, ViewPlugin.fromClass(CalloutFlashPlugin)];
}

/**
 * Bring the callout a sidebar result points at into view and flash it, leaving
 * the selection and focus where they were. `range` is the result's token (or
 * span); `lines` is the buffer it was validated against.
 */
export function revealCalloutInEditor(
	editor: Editor,
	lines: SourceLines,
	range: { from: EditorPosition; to: EditorPosition },
	delayed = false,
): void {
	const extent = calloutExtentAt(lines, range.from.line, range.from.ch,
		range.to.line === range.from.line ? range.to.ch : range.from.ch);
	if (!extent) return;
	const wholeLines = extent.kind === "regular" || extent.kind === "heading";
	const start = { line: extent.startLine, ch: wholeLines ? 0 : extent.from };
	const end = { line: extent.endLine, ch: wholeLines ? lines.getLine(extent.endLine).length : extent.to };
	// `editor.cm` is undocumented but stable (see headingFold.ts).
	const view = (editor as unknown as { cm?: EditorView }).cm;
	if (!view) {
		editor.scrollIntoView({ from: end, to: start }, true);
		return;
	}
	const doc = view.state.doc;
	if (extent.endLine >= doc.lines) return;
	const from = doc.line(start.line + 1).from + start.ch;
	const to = doc.line(end.line + 1).from + end.ch;
	const effects: StateEffect<unknown>[] = [];
	// A callout inside a folded section is hidden; open only the folds hiding
	// it, never the target's own fold (a folded heading callout stays folded).
	foldedRanges(view.state).between(from, to, (foldFrom, foldTo) => {
		if (foldFrom < from && foldTo >= from) effects.push(unfoldEffect.of({ from: foldFrom, to: foldTo }));
	});
	// Head before anchor, as core's own search highlight does: a callout that
	// fits is centred, one taller than the editor is aligned by its top.
	effects.push(EditorView.scrollIntoView(EditorSelection.range(to, from), { y: "center", yMargin: SCROLL_MARGIN_PX }));
	const flash: CalloutFlash = { extent, delayed };
	if (!view.state.field(calloutFlashField, false)?.flash) {
		view.dispatch({ effects: [...effects, setCalloutFlash.of(flash)] });
		return;
	}
	// A flash still showing has to be painted off for one frame first, or a
	// second click on the same callout would not replay the animation.
	view.dispatch({ effects: [...effects, setCalloutFlash.of(null)] });
	window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
		if (!view.dom.isConnected) return;
		view.dispatch({ effects: setCalloutFlash.of(flash) });
	}));
}
