import { scanLineForCalloutTokens, tokenEnd, type LineCalloutToken } from "../editor/calloutTokens";
import { iterateDocumentCalloutLines } from "../editor/documentCallouts";
import { portableCalloutMasks } from "./portableCalloutExclusions";

export interface PortableCalloutConversion {
	content: string;
	count: number;
	headings: number;
	inline: number;
	/** Recognized tokens in unsupported open/nested payloads, left untouched. */
	skipped: number;
}

export interface PortableCalloutLineChange {
	/** One-based source line, with its original line ending preserved. */
	line: number;
	before: string;
	after: string;
	count: number;
	headings: number;
	inline: number;
	/** Approved, non-overlapping source ranges before block-syntax escaping. */
	edits: readonly Edit[];
}

export interface Edit { from: number; to: number; text: string }

/** The label used to be literal text, so it must not acquire Markdown formatting. */
function literalLabel(text: string): string {
	return text.trim().replace(/&/g, "&amp;").replace(/[\\`*_[\]<>|]/g, "\\$&");
}

export function applyPortableEdits(line: string, edits: Edit[]): string {
	let result = "", from = 0;
	for (const edit of edits.sort((a, b) => a.from - b.from)) {
		result += line.slice(from, edit.from) + edit.text;
		from = edit.to;
	}
	return result + line.slice(from);
}

/** Removing a pill must not turn prose into a heading, list, quote, code or table. */
export function preservePortableBlockMeaning(original: string, changed: string, from: number, heading: boolean): string {
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

function unsupportedTokens(tokens: LineCalloutToken[], visible: string): Set<LineCalloutToken> {
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

/**
 * Convert plugin-only heading/inline syntax using original-source offsets.
 * Native block headers, protected examples and ambiguous payloads remain intact.
 * This deliberately does not consult the registry or display settings: a portable
 * note retains the type spelling written in its source even for unknown types.
 */
export function convertPortableCallouts(source: string, onChange?: (change: PortableCalloutLineChange) => void): PortableCalloutConversion {
	const result: PortableCalloutConversion = { content: source, count: 0, headings: 0, inline: 0, skipped: 0 };
	if (!source.includes("[!")) return result;
	const lines = Array.from(iterateDocumentCalloutLines(source));
	const masks = portableCalloutMasks(lines);
	const output = lines.map(({ lineText: line, prefix, lineIndex, tokens: originalTokens }) => {
		const visible = masks[lineIndex]!;
		const rescanned = scanLineForCalloutTokens(line, { visibleLine: visible, contentFrom: prefix.from, blockQuote: prefix.lastContainer === "quote" });
		const tokens = originalTokens.filter(token => visible.slice(token.from, token.to) === line.slice(token.from, token.to));
		if (!tokens.length || tokens[0]?.role === "regular") return line;
		const unsupported = unsupportedTokens(tokens, visible);
		const reparsedByFrom = new Map(rescanned.map(token => [token.from, token]));
		for (const token of tokens) {
			const reparsed = reparsedByFrom.get(token.from);
			// A new exclusion must never silently change which braces a pill owns.
			if (!reparsed || tokenEnd(reparsed) !== tokenEnd(token) || reparsed.contentOpen !== token.contentOpen) {
				unsupported.add(token);
				for (const child of tokens) if (child.from > token.from && child.from < Math.max(tokenEnd(token), reparsed ? tokenEnd(reparsed) : token.to)) unsupported.add(child);
			}
		}
		result.skipped += unsupported.size;
		const active = tokens.filter(token => !unsupported.has(token));
		if (!active.length) return line;
		const headingPrefix = prefix.quoteDepth === 0 ? /^#{1,6}[ \t]+/.exec(line.slice(prefix.from)) : null;
		const titleFrom = headingPrefix ? prefix.from + headingPrefix[0].length : -1;
		const closing = headingPrefix ? /[ \t]+#+[ \t\r]*$/.exec(line.slice(titleFrom)) : null;
		const titleTo = closing ? titleFrom + closing.index : line.length - (line.endsWith("\r") ? 1 : 0);
		// Only tokens with their own source title can be removed as decoration.
		// Code/math are still visible title content even though their tokens are masked.
		const titleWithoutTokens = headingPrefix ? applyPortableEdits(line, active.map(token => ({ from: token.from, to: tokenEnd(token), text: token.content?.text ?? "" }))).slice(titleFrom) : "";
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
			else edits.push({ from, to, text: decoration ? "" : token.content?.text ?? literalLabel(token.rawId) });
			counts.count++;
			if (token.role === "heading" || decoration) counts.headings++;
			else counts.inline++;
		}
		const after = preservePortableBlockMeaning(line, applyPortableEdits(line, edits), prefix.from, headingPrefix !== null);
		if (exposesHtmlBlock(line, after, prefix.from)) { result.skipped += active.length; return line; }
		result.count += counts.count;
		result.headings += counts.headings;
		result.inline += counts.inline;
		onChange?.({ line: lineIndex + 1, before: line, after, ...counts, edits: edits.map(edit => ({ ...edit })) });
		return after;
	});
	result.content = output.join("\n");
	return result;
}
