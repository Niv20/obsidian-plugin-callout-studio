import { iterateMarkdownSourceLines } from "../editor/markdownExclusions";
import { portableCalloutMasks } from "./portableCalloutExclusions";
import { portableHeadings } from "./portableHeadingLinksHeadings";

export interface PortableInlineCustomEdit { readonly from: number; readonly to: number; readonly source: string; readonly text: string }
export interface PortableCustomText { readonly text: string; readonly inline?: readonly PortableInlineCustomEdit[] }
export type PortableReplacement = string | PortableCustomText;
export type PortableReplacements = ReadonlyMap<string, PortableReplacement>;
export const portableReplacementText = (value: PortableReplacement): string => typeof value === "string" ? value : value.text;
export function copyPortableReplacements(values: PortableReplacements): Map<string, PortableReplacement> {
	return new Map([...values].map(([id, value]) => [id, typeof value === "string" ? value : Object.freeze({
		text: value.text, inline: value.inline && Object.freeze(value.inline.map(edit => Object.freeze({ ...edit }))),
	})]));
}

export class PortableCustomReplacementError extends Error {
	constructor() { super("Custom replacement changes surrounding Markdown structure"); }
}

/** Overrides replace approved source units; they must not reinterpret neighbouring text. */
export function assertPortableCustomStructure(before: string, after: string, editedLines: ReadonlySet<number>,
	ranges?: readonly { before: { from: number; to: number }; after: { from: number; to: number } }[],
): void {
	if (before === after) return;
	const source = [...iterateMarkdownSourceLines(before)], proposed = [...iterateMarkdownSourceLines(after)];
	if (source.length !== proposed.length) throw new PortableCustomReplacementError();
	// A token-level text override must not make its untouched neighbours part of
	// a quote, list, nested container or indented code block.
	const container = (line: typeof source[number]): string => JSON.stringify([
		line.prefix.quoteDepth, line.prefix.lastContainer, line.prefix.listIndent, line.prefix.indent >= 4,
	]);
	for (let index = 0; index < source.length; index++) {
		if (container(source[index]!) !== container(proposed[index]!)) throw new PortableCustomReplacementError();
	}
	const oldMask = portableCalloutMasks(source), newMask = portableCalloutMasks(proposed);
	for (let index = 0; index < source.length; index++) {
		if (!editedLines.has(index + 1) && oldMask[index] !== newMask[index]) throw new PortableCustomReplacementError();
	}
	if (ranges) {
		const originalMask = oldMask.join("\n"), proposedMask = newMask.join("\n");
		let oldOffset = 0, newOffset = 0;
		for (const range of [...ranges].sort((a, b) => a.before.from - b.before.from)) {
			if (originalMask.slice(oldOffset, range.before.from) !== proposedMask.slice(newOffset, range.after.from)) throw new PortableCustomReplacementError();
			oldOffset = range.before.to; newOffset = range.after.to;
		}
		if (originalMask.slice(oldOffset) !== proposedMask.slice(newOffset)) throw new PortableCustomReplacementError();
	}
	// A replacement may rename a heading, but must retain its position, extent and
	// level. Otherwise links to an unchanged child or a newly duplicated heading
	// could change meaning without being represented by a heading rename.
	const structure = (content: string): string => JSON.stringify(portableHeadings(content)
		.map(({ line, endLine, level }) => [line, endLine, level]));
	if (structure(before) !== structure(after)) throw new PortableCustomReplacementError();
}

export function assertPortableCustomLine(text: string): void {
	if (/[\r\n\0\u2028\u2029]/.test(text)) throw new PortableCustomReplacementError();
}
