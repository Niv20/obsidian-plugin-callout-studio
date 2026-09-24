import { markdownPrefix, type MarkdownPrefix } from "./markdownContainers";

export interface MarkdownSourceLine {
	lineIndex: number;
	lineOffset: number;
	lineText: string;
	/** Null characters mask excluded bytes without forming whitespace or tokens. */
	visible: string;
	/** Inline code remains meaningful title content, unlike excluded blocks/comments. */
	hasInlineCode?: boolean;
	prefix: MarkdownPrefix;
}

/** Odd backslashes escape syntax; an even run leaves it active. */
export function isMarkdownEscaped(source: string, at: number): boolean {
	let slashes = 0;
	while (at > 0 && source[--at] === "\\") slashes++;
	return slashes % 2 === 1;
}

/** Index exact backtick-run matches once: unmatched runs never cause quadratic searches. */
function backtickPairs(source: string): Map<number, number> {
	const runs = Array.from(source.matchAll(/`+/g));
	const pairs = new Map<number, number>(), next = new Map<number, number>();
	for (let n = runs.length - 1; n >= 0; n--) {
		const run = runs[n]!;
		const close = next.get(run[0].length);
		if (close !== undefined) pairs.set(run.index, close + run[0].length);
		next.set(run[0].length, run.index);
	}
	return pairs;
}

/** A code span cannot consume another block or pass a blank paragraph boundary. */
function inlineBoundary(line: string): boolean {
	const p = markdownPrefix(line);
	const text = line.slice(p.from).replace(/\r$/, "");
	return !text.trim() || p.indent >= 4 || p.lastContainer === "list" ||
		/^(?:#{1,6}(?:[ \t]|$)|`{3,}|~{3,}|(?:[-*_][ \t]*){3,}$)/.test(text);
}

/** Stateful Markdown exclusions with null preparation checkpoints for large files. */
export function* iterateMarkdownSourceSteps(content: string): Generator<MarkdownSourceLine | null> {
	const lines = content.split("\n"), offsets: number[] = [], quoteDepths: number[] = [];
	let offset = 0;
	for (let n = 0; n < lines.length; n++) {
		offsets.push(offset); offset += lines[n]!.length + 1;
		quoteDepths.push(markdownPrefix(lines[n]!).quoteDepth);
		if (n % 512 === 0) yield null;
	}
	const boundaries: number[] = [];
	let boundary = content.length;
	for (let n = lines.length - 1; n >= 0; n--) {
		if (n + 1 < lines.length && quoteDepths[n] !== quoteDepths[n + 1]) boundary = offsets[n + 1]!;
		boundaries[n] = boundary;
		if (inlineBoundary(lines[n]!)) boundary = offsets[n]!;
		if (n % 512 === 0) yield null;
	}
	const pairs = new Map<number, number>(), previous = new Map<number, number[]>();
	const runPattern = /`+/g;
	let run: RegExpExecArray | null, runs = 0;
	while ((run = runPattern.exec(content)) !== null) {
		const width = run[0].length;
		for (const opener of previous.get(width) ?? []) pairs.set(opener, run.index + width);
		previous.set(width, [run.index]);
		// Escaping the first backtick leaves any following backticks active.
		if (width > 1 && isMarkdownEscaped(content, run.index)) {
			const partial = previous.get(width - 1) ?? [];
			partial.push(run.index + 1); previous.set(width - 1, partial);
		}
		if (++runs % 512 === 0) yield null;
	}

	let frontmatter = /^\uFEFF?---[ \t\r]*$/.test(lines[0] ?? "");
	let comment = false, codeEnd = -1, listIndent = 0, previousQuote = 0;
	let paragraph = false, indented = false;
	let fence: { marker: string; quoteDepth: number; listIndent: number } | null = null;
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const lineText = lines[lineIndex]!, lineOffset = offsets[lineIndex]!;
		const prefix = markdownPrefix(lineText, listIndent);
		if (prefix.quoteDepth !== previousQuote) { paragraph = false; indented = false; }
		previousQuote = prefix.quoteDepth;
		if (lineText.trim() && !fence && !comment && codeEnd <= lineOffset) listIndent = prefix.listIndent;
		let whole = false;
		if (frontmatter) {
			if (lineIndex > 0 && /^(?:---|\.\.\.)[ \t\r]*$/.test(lineText)) frontmatter = false;
			whole = true;
		} else if (!comment && codeEnd <= lineOffset) {
			const text = lineText.slice(prefix.from).replace(/\r$/, "");
			if (fence && (prefix.quoteDepth < fence.quoteDepth || prefix.listIndent < fence.listIndent ||
				(prefix.lastContainer === "list" && prefix.listIndent <= fence.listIndent))) {
				fence = null; listIndent = prefix.listIndent;
			}
			const marker = prefix.indent < 4 ? /^(`{3,}|~{3,})(.*)$/.exec(text) : null;
			if (fence) {
				if (prefix.listIndent === fence.listIndent && prefix.quoteDepth === fence.quoteDepth &&
					marker?.[1] && marker[1][0] === fence.marker[0] && marker[1].length >= fence.marker.length && !marker[2]?.trim()) fence = null;
				whole = true;
			} else if (marker?.[1] && (marker[1][0] !== "`" || !marker[2]?.includes("`"))) {
				fence = { marker: marker[1], quoteDepth: prefix.quoteDepth, listIndent: prefix.listIndent };
				whole = true;
			} else if (prefix.indent >= 4 && (!paragraph || indented)) {
				indented = true;
				whole = true;
			} else if (lineText.trim()) indented = false;
		}
		let visible = "", hasInlineCode = false;
		if (whole) {
			visible = "\0".repeat(lineText.length);
			paragraph = false;
		} else {
			let at = 0, checkpoint = 4096;
			const parts: string[] = [], delimiter = /%%|`+/g;
			let nextDelimiter: RegExpExecArray | null | undefined;
			while (at < lineText.length) {
				if (at >= checkpoint) { checkpoint = at + 4096; yield null; }
				const absolute = lineOffset + at;
				if (codeEnd > absolute) {
					hasInlineCode = true;
					const to = Math.min(lineText.length, codeEnd - lineOffset);
					parts.push("\0".repeat(to - at)); at = to; continue;
				}
				if (comment) {
					const close = lineText.indexOf("%%", at);
					const to = close < 0 ? lineText.length : close + 2;
					parts.push("\0".repeat(to - at)); at = to;
					if (close >= 0) comment = false;
					continue;
				}
				if (nextDelimiter === undefined || (nextDelimiter !== null && nextDelimiter.index < at)) {
					delimiter.lastIndex = at; nextDelimiter = delimiter.exec(lineText);
				}
				if (!nextDelimiter || nextDelimiter.index > at) {
					const to = Math.min(nextDelimiter?.index ?? lineText.length, at + 4096);
					parts.push(lineText.slice(at, to)); at = to; continue;
				}
				if (lineText.startsWith("%%", at) && !isMarkdownEscaped(lineText, at)) {
					parts.push("\0\0"); at += 2; comment = true; continue;
				}
				if (lineText[at] === "`" && !isMarkdownEscaped(lineText, at)) {
					const end = pairs.get(absolute);
					const limit = /^#{1,6}(?:[ \t]|$)/.test(lineText.slice(prefix.from))
						? lineOffset + lineText.length : boundaries[lineIndex] ?? content.length;
					if (end !== undefined && end <= limit) { codeEnd = end; continue; }
					let to = at + 1;
					while (lineText[to] === "`") to++;
					parts.push(lineText.slice(at, to)); at = to; continue;
				}
				parts.push(lineText[at]!); at++;
			}
			visible = parts.join("");
			const text = visible.slice(prefix.from);
			paragraph = Boolean(visible.replace(/\0/g, "").trim()) && !/^#{1,6}(?:[ \t]|$)/.test(text) &&
				!(prefix.lastContainer === "quote" && /^\[!/.test(text));
		}
		yield { lineIndex, lineOffset, lineText, visible, prefix, hasInlineCode };
	}
}

/** Synchronous callers receive source lines only. */
export function* iterateMarkdownSourceLines(content: string): Generator<MarkdownSourceLine> {
	for (const line of iterateMarkdownSourceSteps(content)) if (line) yield line;
}

/** Line-only helper; document consumers must use iterateMarkdownSourceLines. */
export function maskInlineCode(line: string): string {
	const pairs = backtickPairs(line);
	let out = "", start = 0;
	for (let at = 0; at < line.length; at++) {
		if (line[at] !== "`" || line[at - 1] === "`" || isMarkdownEscaped(line, at)) continue;
		const end = pairs.get(at);
		if (end === undefined) continue;
		out += line.slice(start, at) + " ".repeat(end - at);
		start = end; at = end - 1;
	}
	return out + line.slice(start);
}
