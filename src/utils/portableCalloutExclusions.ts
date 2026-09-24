import { isMarkdownEscaped, type MarkdownSourceLine } from "../editor/markdownExclusions";
import { stripWikilinks } from "../editor/calloutTokens";

type Range = { from: number; to: number };

function mask(source: string, ranges: Range[], character = "\0"): string {
	const pieces: string[] = [];
	let at = 0;
	for (const { from, to } of ranges.sort((a, b) => a.from - b.from)) {
		if (to <= at) continue;
		pieces.push(source.slice(at, Math.max(at, from)), source.slice(Math.max(at, from), to).replace(/[^\r\n]/g, character));
		at = to;
	}
	return pieces.join("") + source.slice(at);
}

function tagEnd(source: string, from: number): number {
	let quote = "";
	for (let at = from; at < source.length; at++) {
		const ch = source[at]!;
		if (quote) { if (ch === quote) quote = ""; }
		else if (ch === '"' || ch === "'") quote = ch;
		else if (ch === ">") return at + 1;
	}
	return source.length;
}

/** Preserve raw HTML and its contents; Markdown inside HTML is deliberately not guessed. */
function maskHtml(source: string): string {
	const ranges: Range[] = [];
	const voidTags = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
	for (let at = 0; at < source.length; at++) {
		if (source[at] !== "<" || isMarkdownEscaped(source, at)) continue;
		const start = at;
		const terminator = source.startsWith("<!--", at) ? "-->" : source.startsWith("<![CDATA[", at) ? "]]>" : source.startsWith("<?", at) ? "?>" : null;
		if (terminator) {
			const end = source.indexOf(terminator, at + 2);
			at = end < 0 ? source.length : end + terminator.length;
		} else {
			const tag = /^<\/?([a-z][a-z\d-]*)(?=[\s/>])/i.exec(source.slice(at));
			if (!tag) {
				const auto = /^<(?:[a-z][a-z\d+.-]*:[^\s<>]*|[^\s<>]+@[^\s<>]+)>/i.exec(source.slice(at));
				if (auto) at += auto[0].length;
				else if (/^<![A-Z]/.test(source.slice(at))) at = tagEnd(source, at + 2);
				else continue;
			} else {
				const name = tag[1]!;
				at = tagEnd(source, at + tag[0].length);
				if (source[start + 1] !== "/" && !voidTags.test(name) && !/\/\s*>$/.test(source.slice(start, at))) {
					let depth = 1, next = at;
					while ((next = source.indexOf("<", next)) >= 0) {
						if (source.startsWith("<!--", next)) {
							const end = source.indexOf("-->", next + 4);
							next = end < 0 ? source.length : end + 3; continue;
						}
						const nested = /^<(\/?)([a-z][a-z\d-]*)(?=[\s/>])/i.exec(source.slice(next));
						if (!nested) { next++; continue; }
						const end = tagEnd(source, next + nested[0].length);
						if (nested[2]!.toLowerCase() === name.toLowerCase()) {
							if (nested[1]) depth--;
							else if (!/\/\s*>$/.test(source.slice(next, end))) depth++;
						}
						next = end;
						if (!depth) { at = end; break; }
					}
					if (depth) {
						const blank = /\r?\n[ \t]*\r?\n/g;
						blank.lastIndex = at;
						at = /^(?:pre|script|style|textarea)$/i.test(name) ? source.length : blank.exec(source)?.index ?? source.length;
					}
				}
			}
		}
		ranges.push({ from: start, to: at });
		at--;
	}
	return mask(source, ranges);
}

function normalizeReference(label: string): string { return label.trim().replace(/\s+/g, " ").toLowerCase(); }

/** Protect complete links, destinations, titles and defined shortcut references. */
function maskLinks(source: string, lines: readonly MarkdownSourceLine[]): string {
	const ranges: Range[] = [], references = new Set<string>();
	let continuation = false;
	for (const line of lines) {
		const text = source.slice(line.lineOffset, line.lineOffset + line.lineText.length);
		const definition = /^\[([^\]\n]+)\]:/.exec(text.slice(line.prefix.from));
		if (definition) {
			references.add(normalizeReference(definition[1]!));
			ranges.push({ from: line.lineOffset, to: line.lineOffset + text.length });
			continuation = true;
		} else if (continuation && text.trim() && (/^[ \t]+/.test(text) || /^["'(]/.test(text.slice(line.prefix.from)))) {
			ranges.push({ from: line.lineOffset, to: line.lineOffset + text.length });
		} else continuation = false;
	}
	source = mask(source, ranges);
	ranges.length = 0;
	const opens: number[] = [];
	for (let at = 0; at < source.length; at++) {
		if (isMarkdownEscaped(source, at)) continue;
		if (source[at] === "\n" && source[at + 1] === "\n") opens.length = 0;
		if (source[at] === "[") { opens.push(at); continue; }
		if (source[at] !== "]") continue;
		const from = opens.pop();
		if (from === undefined) continue;
		let to = at + 1;
		if (source[to] === "(") {
			let depth = 1, quote = "";
			for (to++; to < source.length; to++) {
				if (isMarkdownEscaped(source, to)) continue;
				if (quote) { if (source[to] === quote) quote = ""; continue; }
				if ((source[to] === '"' || source[to] === "'") && /\s/.test(source[to - 1]!)) { quote = source[to]!; continue; }
				if (source[to] === "\n" && source[to + 1] === "\n") break;
				if (source[to] === "(") depth++;
				if (source[to] === ")" && --depth === 0) { to++; break; }
			}
		} else if (source[to] === "[") {
			const end = source.indexOf("]", to + 1);
			const label = end < 0 ? null : source.slice(to + 1, end);
			// Adjacent callout pills are not unresolved reference links.
			if (label !== null && !label.includes("\n") && (!label.startsWith("!") || references.has(normalizeReference(label)))) to = end + 1;
		} else if (!references.has(normalizeReference(source.slice(from + 1, at)))) continue;
		if (to === at + 1 && source[to] === "[") continue;
		ranges.push({ from, to });
		at = to - 1;
	}
	return mask(source, ranges);
}

/** Math delimiters inside existing excluded contexts cannot begin another mask. */
function maskMath(source: string, preserveInlineContent = false): string {
	const ranges: Range[] = [], inline: Range[] = [];
	for (let at = 0; at < source.length; at++) {
		if (source[at] !== "$" || isMarkdownEscaped(source, at)) continue;
		const start = at, display = source[at + 1] === "$", width = display ? 2 : 1;
		if (!display && /[\s\0]/.test(source[at + 1] ?? " ")) continue;
		let end = at + width, found = false;
		while ((end = source.indexOf(display ? "$$" : "$", end)) >= 0) {
			if (!isMarkdownEscaped(source, end) && (display || (!/[\s$]/.test(source[end - 1] ?? " ") && !/[\d$]/.test(source[end + 1] ?? "")))) {
				end += width; found = true; break;
			}
			end += width;
		}
		if (!found) {
			// A lone price/currency marker must not suppress the rest of a note.
			if (!display) continue;
			end = source.length;
		}
		(preserveInlineContent && !display ? inline : ranges).push({ from: start, to: end }); at = end - 1;
	}
	return mask(mask(source, ranges), inline, "\u0002");
}

/** Extra-conservative export exclusions layered on the shared document lexer. */
export function portableCalloutMasks(lines: readonly MarkdownSourceLine[]): string[] {
	const source = lines.map(line => stripWikilinks(line.visible)).join("\n");
	return maskMath(maskLinks(maskHtml(source), lines)).split("\n");
}

/** Link repair scans destinations, while preserving code, comments, HTML and math. */
export function portableHeadingLinkMask(lines: readonly MarkdownSourceLine[], preserveInlineMath = false): string {
	const source = lines.map(line => line.visible).join("\n");
	// Angle-delimited Markdown destinations are not HTML elements/autolinks.
	const angles: number[] = [];
	const protectedAngles = source.replace(/(\]\([ \t]*(?:\r?\n[ \t]*)?|\]:[ \t]*(?:\r?\n[ \t]*)?)<([^>\n]*)>/g, (match: string, prefix: string, body: string, offset: number) => {
		angles.push(offset + prefix.length, offset + match.length - 1);
		return `${prefix}\u0001${body}\u0001`;
	});
	const visible = maskMath(maskHtml(protectedAngles), preserveInlineMath).split("");
	for (const at of angles) if (visible[at] === "\u0001") visible[at] = source[at]!;
	return visible.join("");
}
