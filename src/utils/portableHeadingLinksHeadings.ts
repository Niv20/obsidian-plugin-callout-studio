import { stripHeading } from "obsidian";
import { iterateMarkdownSourceLines } from "../editor/markdownExclusions";
import { portableHeadingLinkMask } from "./portableCalloutExclusions";

export interface PortableHeading {
	line: number;
	endLine: number;
	level: number;
	title: string;
	key: string;
}

export const portableHeadingKey = (title: string): string => stripHeading(title).toLowerCase();

/** Obsidian indexes only document-root ATX/setext headings, excluding containers. */
export function portableHeadings(content: string): PortableHeading[] {
	const lines = [...iterateMarkdownSourceLines(content)];
	const masks = portableHeadingLinkMask(lines, true).split("\n");
	const result: PortableHeading[] = [];
	let paragraph: number | null = null;
	for (const line of lines) {
		const visible = masks[line.lineIndex]!;
		if (line.prefix.quoteDepth || line.prefix.listIndent || line.prefix.indent >= 4) { paragraph = null; continue; }
		const atx = /^ {0,3}(#{1,6})(?:[ \t]+|$)/.exec(visible);
		if (atx) {
			const title = line.lineText.slice(atx[0].length).replace(/[ \t]+#+[ \t\r]*$/, "").trim();
			result.push({ line: line.lineIndex + 1, endLine: line.lineIndex + 1, level: atx[1]!.length, title, key: portableHeadingKey(title) });
			paragraph = null;
			continue;
		}
		const setext = /^ {0,3}(=+|-+)[ \t\r]*$/.exec(visible);
		if (setext && paragraph !== null) {
			const title = lines.slice(paragraph, line.lineIndex).map(part => part.lineText).join("\n").trim();
			result.push({ line: paragraph + 1, endLine: line.lineIndex, level: setext[1]![0] === "=" ? 1 : 2, title, key: portableHeadingKey(title) });
			paragraph = null;
			continue;
		}
		if ((!visible.replace(/\0/g, "").trim() && !line.hasInlineCode) || /^ {0,3}(?:<|(?:\*\s*){3,}|(?:_\s*){3,}|`{3,}|~{3,}|[-+*]\s|\d+[.)]\s)/.test(visible)) paragraph = null;
		else if (paragraph === null) paragraph = line.lineIndex;
	}
	return result;
}

/** Match native resolveSubpath's ordered, increasing-level heading path semantics. */
export function portableHeadingChain(headings: readonly PortableHeading[], parts: readonly string[]): PortableHeading[] | null {
	const chain: PortableHeading[] = [];
	let level = 0;
	for (const heading of headings) {
		if (heading.level <= level || heading.key !== portableHeadingKey(parts[chain.length]!)) continue;
		chain.push(heading); level = heading.level;
		if (chain.length === parts.length) return chain;
	}
	return null;
}
