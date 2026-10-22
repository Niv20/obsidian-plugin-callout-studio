/**
 * editor/smartCallout.ts — "Wrap in callout" and "Insert empty callout" for
 * all three formats.
 *
 * Neither command asks which format the user wants; where the cursor is
 * answers it. A heading is wrapped as a heading callout, part of a line as an
 * inline pill, and everything else — whole lines, paragraphs, blank lines — as
 * the block callout both commands have always written. Insert never takes text
 * in: it adds an empty callout of whichever form fits at the cursor.
 *
 * The heading and inline forms leave the type unfinished (`[!]`) with the
 * cursor inside it, for the autocomplete to finish — the same way the block
 * form leaves `> [!`. A pill is only written where it will read back as one,
 * which `pillFits` checks by scanning the line it would produce: the shape
 * that parses is the shape that renders.
 */
import { Notice, type Editor } from "obsidian";
import { t } from "../i18n";
import type { PluginSettings } from "../types";
import { insertEmptyCallout, wrapSelectionInCallout } from "./CalloutBlockTools";
import { readCalloutTrigger } from "./calloutTriggerContext";
import { scanLineForCalloutTokens, tokenEnd } from "./calloutTokens";
import { documentCalloutLineAt, type DocumentCalloutLine } from "./documentCallouts";
import { normalizeSelection } from "./wrapRange";

export type FormSettings = Pick<PluginSettings, "headingCallouts" | "inlineCallouts">;

/** What a command writes: the type is still to be picked in every form. */
export type CalloutForm =
	| { kind: "block" }
	| { kind: "heading"; line: number }
	| { kind: "inline"; line: number; from: number; to: number }
	| { kind: "headingAlreadyCallout" };

const BLOCK: CalloutForm = { kind: "block" };

/** A heading's hashes and the whitespace after them. Column 0, as everywhere. */
const HEADING_START_RE = /^(#{1,6})(?:[ \t]+|$)/;
/** An optional closing sequence, which is not part of the title. */
const CLOSING_HASHES_RE = /[ \t]+#+[ \t]*$/;
/** A task's checkbox, which belongs to the list item, not to its text. */
const TASK_BOX_RE = /^\[.\](?:[ \t]+|$)/;

interface HeadingLine {
	/** Past the hashes, and past the heading callout's token when it has one. */
	markupEnd: number;
	/** Where the title's own words start and end — no closing hashes. */
	titleStart: number;
	titleEnd: number;
	/** Whether it is a heading callout already. */
	isCallout: boolean;
}

/** The line as a heading, or null when it is not one a heading callout can be. */
const readHeading = (lexed: DocumentCalloutLine): HeadingLine | null => {
	const { lineText: line, visible, prefix } = lexed;
	if (prefix.quoteDepth !== 0 || prefix.from !== 0 || visible[0] !== "#") return null;
	const start = HEADING_START_RE.exec(line);
	if (!start) return null;
	const token = lexed.tokens.find((each) => each.role === "heading");
	const markupEnd = token ? token.to : start[0].length;
	const title = line.slice(markupEnd).replace(CLOSING_HASHES_RE, "");
	const titleStart = markupEnd + (title.length - title.trimStart().length);
	return {
		markupEnd,
		titleStart,
		titleEnd: Math.max(titleStart, markupEnd + title.trimEnd().length),
		isCallout: token !== undefined,
	};
};

/** Where a line's own text starts and ends, past its `>`, list marker and checkbox. */
const contentRange = (lexed: DocumentCalloutLine): [number, number] => {
	const { lineText: line, prefix } = lexed;
	const box = TASK_BOX_RE.exec(line.slice(prefix.from));
	return [prefix.from + (box ? box[0].length : 0), line.trimEnd().length];
};

/**
 * Whether a pill — `[!]{text}` over `from`–`to`, or a bare `[!]` at `from` —
 * would be a pill there, and one the autocomplete would finish as a pill.
 */
const pillFits = (
	lexed: DocumentCalloutLine,
	from: number,
	to: number,
	settings: FormSettings,
): boolean => {
	const { lineText: line, visible, prefix, tokens } = lexed;
	// Not in the `>`, the list marker or a task's checkbox, which it would break.
	if (from < contentRange(lexed)[0]) return false;
	// Code, a comment, the properties: a line the lexer masked whole, or an
	// end inside a masked span. An end with only one masked neighbour is at the
	// span's edge, so a pill can go right after a code span — or around it.
	const masked = (at: number): boolean => at >= 0 && at < line.length && visible[at] === "\0";
	const inside = (at: number): boolean => masked(at - 1) && masked(at);
	if (line.length > 0 && !/[^\0]/.test(visible)) return false;
	if (inside(from) || inside(to)) return false;
	if (tokens.some((token) => token.role === "regular")) return false;
	// Over a pill, or inside one: nesting is not a syntax.
	const overlaps = (start: number, end: number): boolean =>
		from === to ? start < from && from < end : from < end && start < to;
	if (tokens.some((token) => overlaps(token.from, tokenEnd(token)))) return false;
	const selected = line.slice(from, to);
	// A `|` would split the table cell the pill sits in.
	if (selected.includes("|") && (line.slice(0, from) + line.slice(to)).includes("|")) return false;

	const pill = from === to ? "[!x]" : `[!x]{${selected}}`;
	const candidate = line.slice(0, from) + pill + line.slice(to);
	const found = scanLineForCalloutTokens(candidate, {
		visibleLine: visible.slice(0, from) + pill + visible.slice(to),
		contentFrom: prefix.from,
		blockQuote: prefix.lastContainer === "quote",
	}).find((token) => token.from === from);
	if (found?.role !== "inline") return false;
	if (from === to ? found.content || found.contentOpen : found.content?.text !== selected) return false;
	// The popover reads the role from the text before `[!`, not from the
	// lexer — `>  [!` is a block header to it, and a header is not a pill.
	const empty = line.slice(0, from) + (from === to ? "[!]" : `[!]{${selected}}`) + line.slice(to);
	return readCalloutTrigger(empty, from + 2, settings)?.role === "inline";
};

/** The heading callout a line becomes, or the notice that it already is one. */
const headingForm = (line: number, heading: HeadingLine): CalloutForm =>
	heading.isCallout ? { kind: "headingAlreadyCallout" } : { kind: "heading", line };

/** Whether pills may carry text here: the inline role and its `{…}` are both on. */
const contentPills = (settings: FormSettings): boolean =>
	settings.inlineCallouts.enabled && settings.inlineCallouts.allowContent;

/** What "Wrap in callout" writes for the current selection, or cursor. */
export const chooseWrapForm = (editor: Editor, settings: FormSettings): CalloutForm => {
	const { from, to } = normalizeSelection(editor, editor.getCursor("from"), editor.getCursor("to"));
	if (from.line !== to.line) return BLOCK;
	const lexed = documentCalloutLineAt(editor.getValue(), from.line);
	if (!lexed) return BLOCK;
	const line = lexed.lineText;

	// Space at either end was not meant: a double-click often takes one.
	let start = from.ch;
	let end = to.ch;
	while (start < end && /\s/.test(line[start]!)) start++;
	while (end > start && /\s/.test(line[end - 1]!)) end--;

	// Gated on the role, so with heading callouts off a heading is read the way
	// it always was: a line like any other.
	const heading = settings.headingCallouts.enabled ? readHeading(lexed) : null;
	if (heading) {
		// Its hashes, its token, or every word of it: the heading itself.
		const whole = start === end || start < heading.markupEnd ||
			(start <= heading.titleStart && end >= heading.titleEnd);
		if (!whole && contentPills(settings) && pillFits(lexed, start, end, settings)) {
			return { kind: "inline", line: from.line, from: start, to: end };
		}
		return headingForm(from.line, heading);
	}

	if (start === end) return BLOCK;
	const [contentStart, contentEnd] = contentRange(lexed);
	if (start <= contentStart && end >= contentEnd) return BLOCK;
	return contentPills(settings) && pillFits(lexed, start, end, settings)
		? { kind: "inline", line: from.line, from: start, to: end }
		: BLOCK;
};

/** What "Insert empty callout" writes at the cursor. A selection is not read. */
export const chooseInsertForm = (editor: Editor, settings: FormSettings): CalloutForm => {
	const head = editor.getCursor("head");
	const lexed = documentCalloutLineAt(editor.getValue(), head.line);
	// A blank line — `> ` with nothing after it is one too — takes a block.
	if (!lexed || lexed.lineText.slice(lexed.prefix.from).trim() === "") return BLOCK;

	const heading = settings.headingCallouts.enabled ? readHeading(lexed) : null;
	if (heading && head.ch <= heading.markupEnd) return headingForm(head.line, heading);
	if (settings.inlineCallouts.enabled && pillFits(lexed, head.ch, head.ch, settings)) {
		return { kind: "inline", line: head.line, from: head.ch, to: head.ch };
	}
	return BLOCK;
};

/**
 * Write the unfinished form and park the cursor in its type. Returns whether
 * the autocomplete should be opened there.
 */
const writeForm = (editor: Editor, form: CalloutForm, block: () => boolean): boolean => {
	if (form.kind === "block") return block();
	if (form.kind === "headingAlreadyCallout") {
		new Notice(t("notice.headingAlreadyCallout"));
		return false;
	}
	const text = editor.getLine(form.line);
	if (form.kind === "heading") {
		const start = HEADING_START_RE.exec(text)!;
		const hashes = start[1]!;
		// The space the heading already had, or one when it had none (`##`).
		const gap = start[0].slice(hashes.length) || " ";
		const title = text.slice(start[0].length);
		const opened = `${hashes}${gap}[!]${title ? ` ${title}` : ""}`;
		editor.replaceRange(opened, { line: form.line, ch: 0 }, { line: form.line, ch: text.length });
		editor.setCursor({ line: form.line, ch: hashes.length + gap.length + 2 });
		return true;
	}
	const pill = form.from === form.to ? "[!]" : `[!]{${text.slice(form.from, form.to)}}`;
	editor.replaceRange(pill, { line: form.line, ch: form.from }, { line: form.line, ch: form.to });
	editor.setCursor({ line: form.line, ch: form.from + 2 });
	return true;
};

/** "Wrap in callout". Returns whether to open the type autocomplete. */
export const wrapAtCursor = (editor: Editor, settings: FormSettings): boolean =>
	writeForm(editor, chooseWrapForm(editor, settings), () => wrapSelectionInCallout(editor));

/** "Insert empty callout". Returns whether to open the type autocomplete. */
export const insertAtCursor = (editor: Editor, settings: FormSettings): boolean =>
	writeForm(editor, chooseInsertForm(editor, settings), () => insertEmptyCallout(editor));
