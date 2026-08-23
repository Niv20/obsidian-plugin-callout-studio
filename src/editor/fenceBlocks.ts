/**
 * editor/fenceBlocks.ts — Where fenced code and math blocks start and end.
 *
 * Wrapping or unwrapping a callout expands outwards from the cursor until it
 * hits a blank line, and a fence is the one place that rule has to be
 * suspended: a blank line inside ```…``` or $$…$$ is content, not a paragraph
 * break, and the fence's own markers must move as one unit or the block stops
 * being a block. Scanning for those ranges is a self-contained pass over the
 * buffer, so it lives here rather than inside the transforms that consult it.
 *
 * Fences are recognised at any quote depth (the markers are read through
 * `stripLeadingQuoteTokens`), and an unterminated one is taken to run to the
 * end of the note — which is what the editor shows while it is being typed.
 */
import type { Editor } from "obsidian";
import { stripLeadingQuoteTokens } from "./quotePrefix";

export interface FenceBlock {
	startLine: number;
	endLine: number;
	kind: "code" | "math";
	marker?: "```" | "~~~";
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
	let openFence: {
		startLine: number;
		kind: "code" | "math";
		marker?: "```" | "~~~";
	} | null = null;

	for (let line = 0; line < lineCount; line++) {
		const token = getFenceToken(editor.getLine(line));
		if (!token) continue;

		if (!openFence) {
			openFence = {
				startLine: line,
				kind: token.kind,
				...(token.kind === "code" ? { marker: token.marker } : {}),
			};
			continue;
		}

		if (openFence.kind === "math" && token.kind === "math") {
			fenceBlocks.push({
				startLine: openFence.startLine,
				endLine: line,
				kind: "math",
			});
			openFence = null;
			continue;
		}

		if (
			openFence.kind === "code" &&
			token.kind === "code" &&
			openFence.marker === token.marker
		) {
			fenceBlocks.push({
				startLine: openFence.startLine,
				endLine: line,
				kind: "code",
				marker: openFence.marker,
			});
			openFence = null;
		}
	}

	if (openFence && lineCount > 0) {
		fenceBlocks.push({
			startLine: openFence.startLine,
			endLine: lineCount - 1,
			kind: openFence.kind,
			...(openFence.kind === "code" && openFence.marker
				? { marker: openFence.marker }
				: {}),
		});
	}

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
