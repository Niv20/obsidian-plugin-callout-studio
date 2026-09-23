/** Autocomplete shares the document lexer's code/comment exclusions. */
import { iterateMarkdownSourceLines } from "./markdownExclusions";

export interface CalloutCodeContextQuery {
	line: string;
	tokenIndex: number;
	lineIndex: number;
	lineAt: (index: number) => string;
	/** Includes following lines so a multiline code span can find its closer. */
	lineCount?: number;
}

/** Ask only after a trigger is found; incomplete `[!` tokens are supported. */
export function isCalloutTokenInCode(query: CalloutCodeContextQuery): boolean {
	const lines: string[] = [];
	for (let i = 0; i < (query.lineCount ?? query.lineIndex + 1); i++) lines.push(query.lineAt(i));
	for (const line of iterateMarkdownSourceLines(lines.join("\n"))) {
		if (line.lineIndex === query.lineIndex) return line.visible[query.tokenIndex] !== "[";
	}
	return false;
}
