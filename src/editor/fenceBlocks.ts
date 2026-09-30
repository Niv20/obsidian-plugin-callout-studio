/**
 * editor/fenceBlocks.ts — Where fenced code and math blocks start and end.
 *
 * Wrapping a callout decides what to take by paragraphs and blank lines, and a
 * fence is the one place that rule has to be suspended: a blank line inside
 * ```…``` or $$…$$ is content, not a paragraph break, and the fence's own
 * markers must move as one unit or the block stops being a block. Scanning for
 * those ranges is a self-contained pass over the buffer, so it lives here
 * rather than inside the transforms that consult it.
 *
 * Fences are recognised at any quote depth (the markers are read through
 * `stripLeadingQuoteTokens`), but a fence belongs to the quote it opened in:
 * only a closing marker at that same depth closes it, and it ends anyway where
 * that quote does. Without that last rule, a ``` left open inside a callout
 * would swallow the rest of the note. An unterminated fence at the top level
 * still runs to the end of the note — which is what the editor shows while it
 * is being typed.
 */
import type { Editor } from "obsidian";
import { splitQuoteMarkers, stripLeadingQuoteTokens } from "./quotePrefix";

export interface FenceBlock {
	startLine: number;
	endLine: number;
	kind: "code" | "math";
	marker?: "```" | "~~~";
	/** Quote depth of the opening line, which every line of the fence shares. */
	depth: number;
}

const getFenceToken = (
	line: string,
): { kind: "code"; marker: "```" | "~~~" } | { kind: "math" } | null => {
	const normalized = stripLeadingQuoteTokens(line).text.trimStart();
	if (normalized.trim() === "$$") {
		return { kind: "math" };
	}
	if (normalized.startsWith("```")) {
		return { kind: "code", marker: "```" };
	}
	if (normalized.startsWith("~~~")) {
		return { kind: "code", marker: "~~~" };
	}

	return null;
};

/** Every fenced block in the buffer, in the order they open. */
export const collectFenceBlocks = (editor: Editor): FenceBlock[] => {
	const fenceBlocks: FenceBlock[] = [];
	const lineCount = editor.lineCount();
	let openFence: Omit<FenceBlock, "endLine"> | null = null;
	const close = (endLine: number): void => {
		if (openFence) fenceBlocks.push({ ...openFence, endLine });
		openFence = null;
	};

	for (let line = 0; line < lineCount; line++) {
		const text = editor.getLine(line);
		const { depth } = splitQuoteMarkers(text);
		// The quote holding the fence ended on the line above, and the fence
		// with it.
		if (openFence && depth < openFence.depth) close(line - 1);

		const token = getFenceToken(text);
		if (!token) continue;

		if (!openFence) {
			openFence = {
				startLine: line,
				kind: token.kind,
				...(token.kind === "code" ? { marker: token.marker } : {}),
				depth,
			};
			continue;
		}

		// A marker quoted deeper than the fence is a line of its content.
		if (depth !== openFence.depth) continue;

		if (
			(openFence.kind === "math" && token.kind === "math") ||
			(openFence.kind === "code" &&
				token.kind === "code" &&
				openFence.marker === token.marker)
		) {
			close(line);
		}
	}

	if (lineCount > 0) close(lineCount - 1);

	return fenceBlocks;
};

/** The fenced block containing `line`, if any. */
export const findFenceBlockAtLine = (
	fenceBlocks: FenceBlock[],
	line: number,
): FenceBlock | null => {
	for (const block of fenceBlocks) {
		if (line >= block.startLine && line <= block.endLine) {
			return block;
		}
	}

	return null;
};
