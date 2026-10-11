/**
 * utils/calloutPlainTextLine.ts — what heading and inline callout tokens become
 * once they are plain text.
 *
 * Both conversions that write this into notes go through here, so they cannot
 * disagree about the result: **Convert uses to plain text** (calloutPlainText.ts,
 * one callout type, block callouts unwrapped as well) and **Review conversion**
 * (portableCallouts.ts, every type, block callouts left alone because Obsidian
 * draws them without this plugin).
 *
 * - A pill with a payload becomes its payload, exactly as written. The pill
 *   showed its icon and that text, never the callout's name.
 * - A token without one becomes its type as written in the note, escaped so it
 *   stays literal. That is the only text it has.
 * - A heading token beside a title of its own was decoration, and goes with
 *   the space around it.
 *
 * Every rule works on original-source offsets, and nothing a conversion inserts
 * is scanned again.
 */
import { tokenEnd, type LineCalloutToken } from "../editor/calloutTokens";
import type { MarkdownPrefix } from "../editor/markdownContainers";

export interface Edit { from: number; to: number; text: string }

/** The label used to be literal text, so it must not acquire Markdown formatting. */
export function plainTextLabel(rawId: string): string {
	return rawId.trim().replace(/&/g, "&amp;").replace(/[\\`*_[\]<>|]/g, "\\$&");
}

export function applyLineEdits(line: string, edits: Edit[]): string {
	let result = "", from = 0;
	for (const edit of edits.sort((a, b) => a.from - b.from)) {
		result += line.slice(from, edit.from) + edit.text;
		from = edit.to;
	}
	return result + line.slice(from);
}

/** Removing a pill must not turn prose into a heading, list, quote, code or table. */
export function preserveBlockMeaning(original: string, changed: string, from: number, heading: boolean): string {
	const before = original.slice(from), after = changed.slice(from);
	if (heading) {
		const closing = /[ \t](#+)[ \t\r]*$/;
		const match = closing.exec(after);
		if (match && !closing.test(before)) {
			const at = from + match.index + 1;
			return changed.slice(0, at) + "\\" + changed.slice(at);
		}
		return changed;
	}
	if (/^(?: {4}|\t)/.test(after) && !/^(?: {4}|\t)/.test(before)) {
		return changed.slice(0, from) + (after[0] === "\t" ? "&#9;" : "&#32;") + after.slice(1);
	}
	const marker = /^[ \t]*(?:#{1,6}(?=[ \t\r]|$)|>|[-+*](?=[ \t])|\d{1,9}[.)](?=[ \t])|`{3,}|~{3,}|(?:[-*_][ \t]*){3,}(?=\r?$)|[=-]+[ \t]*(?=\r?$)|\||\[(?:\\.|[^\]\\\r\n])+\]:)/;
	const match = marker.exec(after);
	if (!match || marker.test(before)) return changed;
	const number = /^[ \t]*\d{1,9}([.)])/.exec(after);
	const offset = number ? number[0].length - 1 : /^[ \t]*/.exec(after)![0].length;
	return changed.slice(0, from + offset) + "\\" + changed.slice(from + offset);
}

/** Moving a raw tag to the start of a line can make following Markdown part of an HTML block. */
function exposesHtmlBlock(before: string, after: string, from: number): boolean {
	const tag = /^[ \t]{0,3}<(?:!--|!\[CDATA\[|[!?]|\/?[a-z][a-z\d-]*(?=[\s/>]))/i;
	return tag.test(after.slice(from)) && !tag.test(before.slice(from));
}

function unsupportedTokens(tokens: readonly LineCalloutToken[], visible: string): Set<LineCalloutToken> {
	const unsupported = new Set<LineCalloutToken>();
	let until = -1;
	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index]!;
		const end = token.contentOpen ? visible.length : tokenEnd(token);
		if (token.from < until || token.contentOpen || (token.content && (tokens[index + 1]?.from ?? Infinity) < end)) {
			unsupported.add(token); until = Math.max(until, end);
		}
	}
	// The shared scanner can recover a valid-looking inner token from a broken
	// outer bracket. A destructive conversion must leave the whole example alone.
	let from = 0, close = -1, index = 0;
	while ((from = visible.indexOf("[!", from)) >= 0) {
		if (close < from) close = visible.indexOf("]", from + 2);
		if (close < 0) break;
		const nested = visible.indexOf("[", from + 2);
		if (nested >= 0 && nested < close) {
			while (index < tokens.length && tokens[index]!.from < close) {
				if (tokens[index]!.from >= from) unsupported.add(tokens[index]!);
				index++;
			}
		}
		from = close + 1;
	}
	return unsupported;
}

export interface CalloutLineInput {
	line: string;
	/** Every token on the line, taken or not, in source order. */
	tokens: readonly LineCalloutToken[];
	/** The masked line those tokens were scanned on. */
	visible: string;
	prefix: Pick<MarkdownPrefix, "from" | "quoteDepth">;
	/** The tokens to convert. Every other token stays exactly as written. */
	take?: (token: LineCalloutToken) => boolean;
	/** Tokens the caller already knows cannot be converted safely. */
	unsupported?: ReadonlySet<LineCalloutToken>;
}

export interface CalloutLineConversion {
	/** The converted line, or the line itself when nothing was converted. */
	after: string;
	/** Converted source ranges in source order, before block-syntax escaping. */
	edits: Edit[];
	count: number;
	headings: number;
	inline: number;
	/** Taken tokens left as written: an ambiguous payload, or a line that would open an HTML block. */
	skipped: number;
}

/**
 * Convert the taken heading and inline tokens on one line. A line led by a
 * native block header is left whole: its title is Obsidian's, not tokens.
 */
export function convertCalloutLine(input: CalloutLineInput): CalloutLineConversion {
	const { line, tokens, visible, prefix, take = () => true } = input;
	const unchanged = (skipped: number): CalloutLineConversion =>
		({ after: line, edits: [], count: 0, headings: 0, inline: 0, skipped });
	if (!tokens.length || tokens[0]?.role === "regular") return unchanged(0);
	const unsupported = unsupportedTokens(tokens, visible);
	for (const token of input.unsupported ?? []) unsupported.add(token);
	const taken = tokens.filter(take);
	const active = taken.filter(token => !unsupported.has(token));
	const skipped = taken.length - active.length;
	if (!active.length) return unchanged(skipped);
	const headingPrefix = prefix.quoteDepth === 0 ? /^#{1,6}[ \t]+/.exec(line.slice(prefix.from)) : null;
	const titleFrom = headingPrefix ? prefix.from + headingPrefix[0].length : -1;
	const closing = headingPrefix ? /[ \t]+#+[ \t\r]*$/.exec(line.slice(titleFrom)) : null;
	const titleTo = closing ? titleFrom + closing.index : line.length - (line.endsWith("\r") ? 1 : 0);
	// Only tokens with their own source title can be removed as decoration.
	// Code/math are still visible title content even though their tokens are masked.
	const titleWithoutTokens = headingPrefix ? applyLineEdits(line, active.map(token => ({ from: token.from, to: tokenEnd(token), text: token.content?.text ?? "" }))).slice(titleFrom) : "";
	const hasTitle = Boolean(titleWithoutTokens.replace(/<!--.*?(?:-->|$)|%%.*?(?:%%|$)/g, "").replace(/[ \t]+#+[ \t\r]*$/, "").trim());
	const edits: Edit[] = [];
	const counts = { count: 0, headings: 0, inline: 0 };
	for (const token of active) {
		const decoration = Boolean(headingPrefix && hasTitle && !token.content);
		let from = token.from, to = tokenEnd(token);
		if (decoration) {
			if (from === titleFrom || /[ \t]/.test(line[from - 1] ?? "")) {
				while (to < titleTo && /[ \t]/.test(line[to]!)) to++;
				if (to === titleTo && from > titleFrom) while (from > titleFrom && /[ \t]/.test(line[from - 1]!)) from--;
			}
		}
		// Adjacent decoration whitespace may overlap; merge only removed bytes.
		const previous = edits[edits.length - 1];
		if (decoration && previous?.text === "" && from <= previous.to) previous.to = Math.max(previous.to, to);
		else edits.push({ from, to, text: decoration ? "" : token.content?.text ?? plainTextLabel(token.rawId) });
		counts.count++;
		if (token.role === "heading" || decoration) counts.headings++;
		else counts.inline++;
	}
	const after = preserveBlockMeaning(line, applyLineEdits(line, edits), prefix.from, headingPrefix !== null);
	if (exposesHtmlBlock(line, after, prefix.from)) return unchanged(skipped + active.length);
	return { after, edits, ...counts, skipped };
}
