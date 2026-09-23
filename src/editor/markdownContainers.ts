/** Container prefixes shared by line classification and document exclusions. */
export interface MarkdownPrefix {
	from: number;
	indent: number;
	quoteDepth: number;
	listIndent: number;
	lastContainer: "quote" | "list" | null;
}

function whitespace(line: string, start: number, column = 0): { end: number; width: number } {
	let end = start, width = 0;
	while (line[end] === " " || line[end] === "\t") {
		width += line[end] === "\t" ? 4 - (column + width) % 4 : 1;
		end++;
	}
	return { end, width };
}

/** `continuationIndent` is the content column of an enclosing list item. */
export function markdownPrefix(line: string, continuationIndent = 0): MarkdownPrefix {
	let from = 0, quoteDepth = 0, column = 0, listIndent = 0, inheritedIndent = 0;
	let lastContainer: MarkdownPrefix["lastContainer"] = null;
	for (;;) {
		const ws = whitespace(line, from, column);
		const carried = lastContainer !== "list" && continuationIndent > 0 && ws.width >= continuationIndent
			? continuationIndent : 0;
		const indent = ws.width - carried;
		if (carried) { inheritedIndent = carried; continuationIndent = 0; }
		if (indent <= 3 && line[ws.end] === ">") {
			from = ws.end + 1;
			column += ws.width + 1;
			if (line[from] === " " || line[from] === "\t") { from++; column++; }
			quoteDepth++;
			lastContainer = "quote";
			continue;
		}
		const marker = indent <= 3 ? /^(?:[-+*]|\d{1,9}[.)])(?=[ \t]|$)/.exec(line.slice(ws.end)) : null;
		if (marker) {
			const markerEnd = ws.end + marker[0].length;
			const gap = whitespace(line, markerEnd, column + ws.width + marker[0].length);
			// More than four padding columns means one separator plus code indentation.
			const padding = gap.width > 4 ? 1 : Math.max(1, gap.width);
			from = gap.width > 4 ? markerEnd + 1 : gap.end;
			column += ws.width + marker[0].length + padding;
			listIndent = column;
			lastContainer = "list";
			continuationIndent = 0;
			continue;
		}
		return { from: ws.end, indent, quoteDepth, listIndent: listIndent || inheritedIndent, lastContainer };
	}
}
