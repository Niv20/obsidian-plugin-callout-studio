import { isMarkdownEscaped, iterateMarkdownSourceLines } from "../editor/markdownExclusions";
import { portableHeadingLinkMask } from "./portableCalloutExclusions";

export interface PortableHeadingDestination {
	/** Exact destination range; labels, titles and surrounding syntax stay outside. */
	from: number;
	to: number;
	wiki: boolean;
}

interface DestinationEnd { from: number; to: number; end: number }

function markdownDestination(source: string, from: number, definition: boolean): DestinationEnd | null {
	let breaks = 0;
	while (/[ \t\r\n]/.test(source[from] ?? "")) {
		if (source[from] === "\n" && ++breaks > 1) return null;
		from++;
	}
	if (source[from] === "<") {
		for (let at = from + 1; at < source.length; at++) {
			if (source[at] === "\n" || source[at] === "\0") return null;
			if (source[at] === "<" && !isMarkdownEscaped(source, at)) return null;
			if (source[at] === ">" && !isMarkdownEscaped(source, at)) return { from: from + 1, to: at, end: at + 1 };
		}
		return null;
	}
	let depth = 0;
	for (let at = from; at <= source.length; at++) {
		const ch = source[at];
		if (ch === "\0") return null;
		if (ch === undefined || (!isMarkdownEscaped(source, at) && /\s/.test(ch))) {
			return depth === 0 && at > from ? { from, to: at, end: at } : null;
		}
		if (isMarkdownEscaped(source, at)) continue;
		if (ch === "<" || ch === ">") return null;
		if (ch === "(") depth++;
		if (ch === ")") {
			if (depth === 0) return definition ? null : { from, to: at, end: at };
			depth--;
		}
	}
	return null;
}

function linkEnd(source: string, from: number): number | null {
	let at = from, breaks = 0;
	while (/[ \t\r\n]/.test(source[at] ?? "")) {
		if (source[at] === "\n" && ++breaks > 1) return null;
		at++;
	}
	if (source[at] === ")") return at + 1;
	if (at === from) return null;
	const quote = source[at];
	if (quote !== '"' && quote !== "'" && quote !== "(") return null;
	const close = quote === "(" ? ")" : quote;
	for (at++; at < source.length; at++) {
		if (source[at] === "\0" || (source[at] === "\n" && /^\n[ \t\r]*\n/.test(source.slice(at)))) return null;
		if (quote === "(" && source[at] === "(" && !isMarkdownEscaped(source, at)) return null;
		if (source[at] === close && !isMarkdownEscaped(source, at)) {
			at++;
			breaks = 0;
			while (/[ \t\r\n]/.test(source[at] ?? "")) {
				if (source[at] === "\n" && ++breaks > 1) return null;
				at++;
			}
			return source[at] === ")" ? at + 1 : null;
		}
	}
	return null;
}

/** A definition ends after its destination or a complete, whitespace-separated title. */
function referenceEnd(source: string, from: number): number | null {
	let at = from;
	while (/[ \t\r]/.test(source[at] ?? "")) at++;
	if (at === source.length) return at;
	const nextLine = source[at] === "\n";
	const destinationEnd = at;
	if (nextLine) {
		at++;
		while (/[ \t\r]/.test(source[at] ?? "")) at++;
	} else if (at === from) return null;
	const quote = source[at], close = quote === "(" ? ")" : quote;
	if (quote !== '"' && quote !== "'" && quote !== "(") return nextLine ? destinationEnd : null;
	for (at++; at < source.length; at++) {
		if (source[at] === "\0" || (source[at] === "\n" && /^\n[ \t\r]*\n/.test(source.slice(at)))) break;
		if (isMarkdownEscaped(source, at)) continue;
		if (quote === "(" && source[at] === "(") break;
		if (source[at] !== close) continue;
		at++;
		while (/[ \t\r]/.test(source[at] ?? "")) at++;
		if (at === source.length || source[at] === "\n") return at;
		break;
	}
	// A malformed next-line title does not invalidate the completed destination.
	return nextLine ? destinationEnd : null;
}

/** Parse only actual internal-link destinations; no replacements inside prose labels. */
export function portableHeadingDestinations(content: string): PortableHeadingDestination[] {
	const lines = [...iterateMarkdownSourceLines(content)];
	const visible = portableHeadingLinkMask(lines);
	const destinations: PortableHeadingDestination[] = [];
	const labels: { from: number; to: number }[] = [];
	const definitions = new Map<number, number>();
	let definitionThrough = -1;
	for (const line of lines) {
		if (line.lineOffset <= definitionThrough) continue;
		const text = visible.slice(line.lineOffset + line.prefix.from, line.lineOffset + line.lineText.length);
		const match = /^\[(?!\^)(?:\\.|[^\]\n])+\]:[ \t]*/.exec(text);
		if (!match) continue;
		const start = line.lineOffset + line.prefix.from;
		const destination = markdownDestination(visible, start + match[0].length, true);
		const end = destination ? referenceEnd(visible, destination.end) : null;
		if (destination && end !== null) {
			destinations.push({ from: destination.from, to: destination.to, wiki: false });
			definitions.set(start, end);
			definitionThrough = end;
		}
	}
	const opens: number[] = [];
	for (let at = 0; at < visible.length; at++) {
		if (isMarkdownEscaped(visible, at)) continue;
		if (visible[at] === "\n" && visible[at + 1] === "\n") opens.length = 0;
		if (definitions.has(at)) {
			at = definitions.get(at)!;
			continue;
		}
		if (visible.startsWith("[[", at)) {
			let end = visible.indexOf("]]", at + 2);
			if (end < 0) continue;
			// A heading may itself end in a single bracket, e.g. [[Note#[!note]]].
			let brackets = 0;
			for (let inside = at + 2; inside < end; inside++) {
				if (visible[inside] === "[") brackets++;
				else if (visible[inside] === "]") brackets--;
			}
			while (brackets > 0 && visible[end + 2] === "]") { end++; brackets--; }
			const inside = visible.slice(at + 2, end);
			if (/[\n\0]/.test(inside)) continue;
			const alias = inside.indexOf("|");
			let to = alias < 0 ? end : at + 2 + alias;
			if (alias >= 0 && visible[to - 1] === "\\") to--;
			destinations.push({ from: at + 2, to, wiki: true });
			at = end + 1;
			continue;
		}
		if (visible[at] === "[") { opens.push(at); continue; }
		if (visible[at] !== "]") continue;
		const labelStart = opens.pop();
		if (labelStart === undefined || visible[at + 1] !== "(") continue;
		const destination = markdownDestination(visible, at + 2, false);
		if (!destination) continue;
		const end = linkEnd(visible, destination.end);
		if (end === null) continue;
		labels.push({ from: labelStart, to: at + 1 });
		destinations.push({ from: destination.from, to: destination.to, wiki: false });
		at = end - 1;
	}
	return destinations.filter(destination => !labels.some(label => destination.from >= label.from && destination.to <= label.to))
		.sort((a, b) => a.from - b.from);
}
