/**
 * editor/wrapRange.ts — Which lines "Wrap in callout" takes, and how deep the
 * new callout goes.
 *
 * `CalloutBlockTools.wrapSelectionInCallout` writes the callout; this decides
 * what it goes around. The rules, in the order they apply (the internals doc's
 * editor-integrations chapter walks through each with examples):
 *
 * 1. The target is the lines a selection touches, or the paragraph under a bare
 *    cursor. Blank lines at a selection's edges are not part of it.
 * 2. The callout opens inside the innermost quote that holds every target line.
 *    A callout's header line counts as the level above it, so pointing at the
 *    header means the whole callout.
 * 3. Nothing is cut through. A nested callout or quote, a fence, a table, an
 *    HTML block and a list item's indented lines each move as one. Only a
 *    selection splits a paragraph, and only between two plain lines.
 * 4. Where the callout would touch a neighbour, a blank line keeps them apart.
 *    Without it the two merge: the neighbour's lines slide into the callout,
 *    or the callout's header becomes a line of the neighbour's quote.
 *
 * Depth is measured by `splitQuoteMarkers`, the strict reading: an indented `>`
 * belongs to the list item above it, so it travels as content.
 */
import type { Editor, EditorPosition } from "obsidian";
import { collectFenceBlocks } from "./fenceBlocks";
import type { FenceBlock } from "./fenceBlocks";
import { findFrontmatterEnd } from "./frontmatter";
import { opensCallout, splitQuoteMarkers } from "./quotePrefix";

export interface WrapPlan {
	/** First and last line the callout replaces. */
	startLine: number;
	endLine: number;
	/** Quote depth the callout opens inside; 0 is the note itself. */
	level: number;
	/** Nothing to wrap: the callout is written empty, over one blank line. */
	empty: boolean;
	/** A blank line has to keep the callout off the line above it. */
	separateAbove: boolean;
	/** A blank line has to keep the callout off the line below it. */
	separateBelow: boolean;
}

interface LineShape {
	/** `>` depth — for a line inside a fence, the fence's own depth. */
	depth: number;
	/** Nothing past the markers. Never true in a fence: its blank lines are code. */
	blank: boolean;
	/** `[!…]` on the first line of its quote: a header, not an inline pill. */
	header: boolean;
	fence: FenceBlock | null;
}

const HEADING_REGEX = /^#{1,6}(?:[ \t]|$)/;
/** An underline that turns the line above it into a heading. */
const SETEXT_UNDERLINE_REGEX = /^(?:=+|-+)[ \t]*$/;
const HTML_BLOCK_REGEX = /^<[A-Za-z/!]/;

const isTableDelimiter = (text: string): boolean =>
	/^[ \t|:-]+$/.test(text) && text.includes("|") && text.includes("-");

const readShapes = (editor: Editor): LineShape[] => {
	const fences = collectFenceBlocks(editor);
	const shapes: LineShape[] = [];
	let next = 0;
	for (let line = 0; line < editor.lineCount(); line++) {
		while (next < fences.length && fences[next]!.endLine < line) next++;
		const candidate = fences[next];
		const fence = candidate && candidate.startLine <= line ? candidate : null;
		if (fence) {
			shapes.push({ depth: fence.depth, blank: false, header: false, fence });
			continue;
		}
		const { depth, text } = splitQuoteMarkers(editor.getLine(line));
		shapes.push({
			depth,
			blank: text.trim() === "",
			header: opensCallout(text, depth, shapes[line - 1]?.depth ?? 0),
			fence: null,
		});
	}
	return shapes;
};

/**
 * Plan a wrap of `from`–`to`. `selection` is false for a bare cursor, which
 * asks for the paragraph under it. Returns null when there is no line to put a
 * callout on (the note is only frontmatter).
 */
export const planWrap = (
	editor: Editor,
	from: EditorPosition,
	to: EditorPosition,
	selection: boolean,
): WrapPlan | null => {
	const lineCount = editor.lineCount();
	let first = from.line;
	let last = to.line;
	// A selection that ends at the very start of a line took nothing from it,
	// and one that starts at the very end of a line took nothing from that one:
	// both are what dragging or Shift+Down over whole lines leaves behind.
	if (selection && last > first && to.ch === 0) last -= 1;
	if (selection && last > first && from.ch >= editor.getLine(first).length) {
		first += 1;
	}

	// Properties are never wrapped: a target that starts inside them starts
	// after them.
	const top = findFrontmatterEnd(editor) + 1;
	if (first < top) {
		first = top;
		last = Math.max(last, top);
	}
	if (first >= lineCount) return null;

	const shapes = readShapes(editor);
	const shape = (line: number): LineShape => shapes[line]!;
	const within = (line: number): boolean => line >= top && line < lineCount;
	first = Math.max(shape(first).fence?.startLine ?? first, top);
	last = shape(last).fence?.endLine ?? last;

	const plan = (start: number, end: number, level: number, empty: boolean): WrapPlan => {
		const above = start - 1;
		const below = end + 1;
		return {
			startLine: start,
			endLine: end,
			level,
			empty,
			separateAbove:
				within(above) &&
				!shape(above).blank &&
				shape(above).depth >= level &&
				// The header of the callout being written into sits right
				// above its own body, where a nested callout may start.
				!(shape(above).header && shape(above).depth === level),
			separateBelow:
				within(below) && !shape(below).blank && shape(below).depth >= level,
		};
	};

	let content = first;
	while (content <= last && shape(content).blank) content++;
	if (content > last) return plan(first, first, shape(first).depth, true);
	first = content;
	while (shape(last).blank) last--;

	let level = Number.POSITIVE_INFINITY;
	for (let line = first; line <= last; line++) {
		const { depth, header } = shape(line);
		level = Math.min(level, header ? depth - 1 : depth);
	}

	const textOf = (line: number): string =>
		splitQuoteMarkers(editor.getLine(line), level).text;
	/** Inside a quote nested in the container: it moves whole. */
	const nested = (line: number): boolean =>
		within(line) && shape(line).depth > level;
	/** Text of the container itself. Its own header belongs to the level above. */
	const inText = (line: number): boolean =>
		within(line) &&
		!shape(line).blank &&
		shape(line).depth === level &&
		!shape(line).header;
	/** A heading is a block of its own, never part of a paragraph under it. */
	const isHeading = (line: number): boolean =>
		!shape(line).fence && HEADING_REGEX.test(textOf(line));
	const paragraphEdge = (line: number, step: 1 | -1): number => {
		while (inText(line + step) && !isHeading(line) && !isHeading(line + step)) {
			line += step;
		}
		return line;
	};
	const runEdge = (line: number, step: 1 | -1): number => {
		while (nested(line + step)) line += step;
		return line;
	};
	const textRun = (line: number): [number, number] => {
		let start = line;
		let end = line;
		while (inText(start - 1)) start--;
		while (inText(end + 1)) end++;
		return [start, end];
	};
	/**
	 * The first line of a text run that must stay with the line above it: a
	 * table runs from its header row, and an HTML block from its opening tag,
	 * to the end of the run.
	 */
	const uncuttableFrom = (start: number, end: number): number => {
		for (let line = start; line <= end; line++) {
			if (shape(line).fence) continue;
			const text = textOf(line);
			if (line > start && isTableDelimiter(text)) return line;
			if (HTML_BLOCK_REGEX.test(text)) return line + 1;
		}
		return Number.POSITIVE_INFINITY;
	};
	/** Whether a selection may start a part of a text run at `line`. */
	const cutsBefore = (line: number, uncuttable: number): boolean => {
		if (line >= uncuttable) return false;
		const fence = shape(line).fence;
		if (fence && line > fence.startLine) return false;
		const text = textOf(line);
		// An indented line continues the one above it (a list item's
		// sub-items, a footnote's second paragraph).
		return !/^[ \t]/.test(text) && !SETEXT_UNDERLINE_REGEX.test(text);
	};
	const cutEdge = (line: number, step: 1 | -1): number => {
		const [start, end] = textRun(line);
		const uncuttable = uncuttableFrom(start, end);
		if (step < 0) {
			while (line > start && !cutsBefore(line, uncuttable)) line--;
		} else {
			while (line < end && !cutsBefore(line + 1, uncuttable)) line++;
		}
		return line;
	};
	const edge = (line: number, step: 1 | -1): number => {
		if (nested(line)) return runEdge(line, step);
		return selection ? cutEdge(line, step) : paragraphEdge(line, step);
	};

	return plan(edge(first, -1), edge(last, 1), level, false);
};
