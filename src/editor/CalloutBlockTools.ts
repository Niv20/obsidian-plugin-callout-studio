/**
 * editor/CalloutBlockTools.ts — Low-level editor utilities for callout blocks.
 *
 * Contains pure functions that operate on an Obsidian Editor instance:
 * wrapping a text selection inside a new callout block, and unwrapping an
 * existing callout back to plain text. The structural questions it leans on
 * live next door — `wrapRange.ts` for which lines a wrap takes and how deep it
 * goes, `quotePrefix.ts` for the `>` arithmetic of a single line.
 * Used by editor/commands.ts (keyboard commands), the Quick insert window and
 * user-built block commands.
 */
import { Editor, Notice } from "obsidian";
import type { EditorPosition } from "obsidian";
import { t } from "../i18n";
import type { CalloutDefinition } from "../types";
import {
	buildBlockHeaderToken,
	buildHeadingToken,
	buildInlineContentToken,
	buildInlineToken,
} from "./calloutWriter";
import { HEADING_CALLOUT_RE } from "./calloutTokens";
import { splitFoldMark } from "./calloutWriter";
import { collectFenceBlocks, findFenceBlockAtLine } from "./fenceBlocks";
import type { FenceBlock } from "./fenceBlocks";
import {
	buildPrefix,
	countLeadingQuoteTokens,
	countQuoteMarkers,
	isBlankCalloutLine,
	opensCallout,
	splitQuoteMarkers,
	stripLeadingQuoteTokens,
} from "./quotePrefix";
import { appendAfterFrontmatter, findFrontmatterEnd } from "./frontmatter";
import { planWrap } from "./wrapRange";

interface CalloutBlockInfo {
	headerLine: number;
	lastLine: number;
	calloutLevel: number;
}

const arePositionsEqual = (a: EditorPosition, b: EditorPosition): boolean =>
	a.line === b.line && a.ch === b.ch;

/**
 * Whether `line` is a callout's header, the way unwrap reads a note: through
 * the lenient tokens, so a callout indented under a list item is reachable.
 * A `[!…]` further down a quote is a line of that callout's body, and a line
 * inside a fence is code — taking either for a header is what deleted it.
 */
const isHeaderAt = (
	editor: Editor,
	fences: FenceBlock[],
	line: number,
): boolean => {
	if (findFenceBlockAtLine(fences, line)) return false;
	const text = editor.getLine(line);
	return opensCallout(
		stripLeadingQuoteTokens(text).text,
		countQuoteMarkers(text),
		line > 0 ? countQuoteMarkers(editor.getLine(line - 1)) : 0,
	);
};

const findContainingCallout = (
	editor: Editor,
	fences: FenceBlock[],
	line: number,
): CalloutBlockInfo | null => {
	let deepestAllowedLevel = countLeadingQuoteTokens(editor.getLine(line));
	if (deepestAllowedLevel === 0) {
		return null;
	}

	let headerLine = -1;
	let calloutLevel = 0;

	for (let current = line; current >= 0; current--) {
		const text = editor.getLine(current);
		const currentLevel = countLeadingQuoteTokens(text);

		if (text.trim() === "" || currentLevel === 0) {
			return null;
		}

		if (currentLevel < deepestAllowedLevel) {
			deepestAllowedLevel = currentLevel;
		}

		if (
			currentLevel <= deepestAllowedLevel &&
			isHeaderAt(editor, fences, current)
		) {
			headerLine = current;
			calloutLevel = currentLevel;
			break;
		}
	}

	if (headerLine < 0 || calloutLevel === 0) {
		return null;
	}

	let lastLine = headerLine;
	for (
		let current = headerLine + 1;
		current < editor.lineCount();
		current++
	) {
		const text = editor.getLine(current);
		if (text.trim() === "") break;
		if (countLeadingQuoteTokens(text) < calloutLevel) break;
		lastLine = current;
	}

	return {
		headerLine,
		lastLine,
		calloutLevel,
	};
};

const hasSelection = (editor: Editor): boolean => {
	const anchor = editor.getCursor("anchor");
	const head = editor.getCursor("head");
	return !arePositionsEqual(anchor, head);
};

const getOrderedCursorLines = (
	editor: Editor,
): {
	anchor: EditorPosition;
	head: EditorPosition;
	startLine: number;
	endLine: number;
} => {
	const anchor = editor.getCursor("anchor");
	const head = editor.getCursor("head");

	return {
		anchor,
		head,
		startLine: Math.min(anchor.line, head.line),
		endLine: Math.max(anchor.line, head.line),
	};
};
/**
 * The header text that opens a new block callout.
 *
 * With no definition this is the deliberately unfinished `[!`, which is what
 * lets the generic commands park the cursor there and open the type
 * autocomplete. A user-built command already knows its type, so it gets the
 * finished header and no popover.
 */
const openingHeaderToken = (def?: CalloutDefinition, foldMark?: "" | "+" | "-"): string =>
	def ? buildBlockHeaderToken(def, { foldMark }) : "[!";

/**
 * The blank quoted line a finished, empty block callout opens with — `> ` at
 * the callout's own depth — or `null` when the header itself is unfinished.
 *
 * A callout that already knows its type has nothing left to say on the header
 * line, so the next thing the user types is body text; writing the line for
 * them and landing the cursor after its `> ` is what makes the Quick insert
 * window and a user-built `Insert X block callout` command leave the same
 * thing behind. With no type the header is still the bare `[!` that the
 * autocomplete is about to finish, so the cursor belongs up there and there is
 * no body line to write.
 */
const emptyBodyLine = (prefix: string, def?: CalloutDefinition): string | null =>
	def ? `${prefix}> ` : null;

/**
 * A wrapped line, moved one level below `level`: the depth the new callout
 * opens at. A blank line keeps any deeper quoting it had, so a paragraph break
 * inside a nested callout stays inside it.
 */
const requoteLine = (line: string, level: number): string => {
	const { depth, text } = splitQuoteMarkers(line);
	if (text.trim() === "") return `${buildPrefix(Math.max(depth, level))}>`;
	return `${buildPrefix(level)}> ${splitQuoteMarkers(line, level).text}`;
};

/**
 * Wrap the selection — or, with none, the paragraph under the cursor — in a
 * new block callout. `planWrap` decides which lines that is and how deep the
 * callout goes; this writes it as one `replaceRange`, so one Undo takes it
 * back.
 */
export const wrapSelectionInCallout = (
	editor: Editor,
	options?: { requireSelection?: boolean; def?: CalloutDefinition; foldMark?: "" | "+" | "-" },
): boolean => {
	if (editor.lineCount() === 0) {
		new Notice(t("notice.nothingToWrap"));
		return false;
	}

	const selectionPresent = hasSelection(editor);
	if (options?.requireSelection && !selectionPresent) {
		return false;
	}

	const anchor = editor.getCursor("anchor");
	const head = editor.getCursor("head");
	const anchorFirst =
		anchor.line < head.line ||
		(anchor.line === head.line && anchor.ch <= head.ch);
	const plan = planWrap(
		editor,
		anchorFirst ? anchor : head,
		anchorFirst ? head : anchor,
		selectionPresent,
	);
	if (!plan) {
		new Notice(t("notice.nothingToWrap"));
		return false;
	}

	const prefix = buildPrefix(plan.level);
	const headerLine = `${prefix}> ${openingHeaderToken(options?.def, options?.foldMark)}`;
	// Nothing was found to wrap, so the callout is born empty and its body is
	// the one line the user is about to type into rather than a requoting of
	// what was there. Every other case keeps the cursor on the header, where
	// the title is.
	const emptyBody = plan.empty ? emptyBodyLine(prefix, options?.def) : null;
	// A blank line at the container's own depth: `>` inside a callout, an
	// empty line in the note itself.
	const separator = prefix.trimEnd();

	const replacementLines: string[] = plan.separateAbove
		? [separator, headerLine]
		: [headerLine];
	if (emptyBody !== null) {
		replacementLines.push(emptyBody);
	} else {
		for (let line = plan.startLine; line <= plan.endLine; line++) {
			replacementLines.push(requoteLine(editor.getLine(line), plan.level));
		}
	}
	if (plan.separateBelow) replacementLines.push(separator);

	editor.replaceRange(
		replacementLines.join("\n"),
		{ line: plan.startLine, ch: 0 },
		{ line: plan.endLine, ch: editor.getLine(plan.endLine).length },
	);
	const headerIndex = plan.startLine + (plan.separateAbove ? 1 : 0);
	editor.setCursor(
		emptyBody === null
			? { line: headerIndex, ch: headerLine.length }
			: { line: headerIndex + 1, ch: emptyBody.length },
	);

	return true;
};

/**
 * Write an empty block callout at the cursor.
 *
 * On a blank line the callout takes that line's place; on a line with content
 * it goes below it. Either way a blank line keeps it apart from a neighbour it
 * would otherwise touch — the line below would be swallowed into the callout
 * as a lazy continuation of its header, and a callout written straight after
 * a line of its own depth would become a line of that line's quote. The same
 * rule `planWrap` uses for Wrap in callout's empty case; depth is read
 * strictly for the same reason (`splitQuoteMarkers`).
 */
export const insertEmptyCallout = (
	editor: Editor,
	options?: { def?: CalloutDefinition; foldMark?: "" | "+" | "-" },
): boolean => {
	const lineCount = editor.lineCount();
	const top = findFrontmatterEnd(editor) + 1;
	const read = (line: number) => splitQuoteMarkers(editor.getLine(line));
	const hasContent = (line: number): boolean =>
		line >= top && line < lineCount && read(line).text.trim() !== "";

	const head = editor.getCursor("head");
	// Properties are never written into. From inside them, the callout goes
	// on the first line after them — onto it when it is blank, above it
	// when it is not.
	const inProperties = head.line < top;
	const targetLine = inProperties ? top : head.line;
	const replacesLine = targetLine < lineCount && !hasContent(targetLine);
	/** The blank line the callout replaces, or the line it goes below. */
	const line = replacesLine ? targetLine : inProperties ? top - 1 : head.line;
	const level = inProperties && !replacesLine ? 0 : read(line).depth;

	/** The header of the callout this one is written into, right above it. */
	const opensContainer = (above: number): boolean =>
		read(above).depth === level &&
		opensCallout(
			read(above).text,
			level,
			above > 0 ? read(above - 1).depth : 0,
		);
	const separateAbove = replacesLine
		? hasContent(line - 1) &&
			read(line - 1).depth >= level &&
			!opensContainer(line - 1)
		: !inProperties;
	// Any line of content below counts, however shallow: a header-only
	// callout has nothing between the two for a lazy continuation to stop at.
	const separateBelow = hasContent(line + 1);

	const prefix = buildPrefix(level);
	const header = `${prefix}> ${openingHeaderToken(options?.def, options?.foldMark)}`;
	const body = emptyBodyLine(prefix, options?.def);
	const separator = prefix.trimEnd();
	const lines = [
		...(separateAbove ? [separator] : []),
		header,
		...(body === null ? [] : [body]),
		...(separateBelow ? [separator] : []),
	].join("\n");

	if (replacesLine) {
		editor.replaceRange(
			lines,
			{ line, ch: 0 },
			{ line, ch: editor.getLine(line).length },
		);
	} else {
		editor.replaceRange(`\n${lines}`, {
			line,
			ch: editor.getLine(line).length,
		});
	}
	const headerLine =
		(replacesLine ? line : line + 1) + (separateAbove ? 1 : 0);
	editor.setCursor(
		body === null
			? { line: headerLine, ch: header.length }
			: { line: headerLine + 1, ch: body.length },
	);

	return true;
};

/**
 * Turn the cursor's line into a heading callout: `## [!note] Title`.
 *
 * The line's own text becomes the title, so nothing is lost — running this on
 * a plain line titles the heading with it, and running it on a line that is
 * already a heading (callout or not) re-levels and re-types it in place rather
 * than nesting a second token. A blank line gets an untitled heading, which is
 * what the autocomplete writes too: the rendered widget already shows the
 * callout's display name.
 *
 * Heading callouts must start at column 0 (`HEADING_CALLOUT_RE` is anchored),
 * so a quoted line is never rewritten — the heading goes below the blockquote
 * instead, which is the only place it could render.
 */
export const insertHeadingCallout = (
	editor: Editor,
	def: CalloutDefinition,
	level: number,
	options?: { isKnownDisplayName?: (title: string) => boolean },
): boolean => {
	if (editor.lineCount() === 0) return false;

	const hashes = "#".repeat(Math.min(Math.max(Math.round(level), 1), 6));
	const frontmatterEnd = findFrontmatterEnd(editor);
	if (appendAfterFrontmatter(editor, frontmatterEnd, `${hashes} ${buildHeadingToken(def)}`)) return true;
	const head = editor.getCursor("head");
	const targetLine = Math.min(
		Math.max(head.line, frontmatterEnd + 1),
		editor.lineCount() - 1,
	);
	const lineText = editor.getLine(targetLine);

	if (countLeadingQuoteTokens(lineText) > 0) {
		const token = buildHeadingToken(def);
		const insertion = `\n\n${hashes} ${token}`;
		const lineEnd = { line: targetLine, ch: lineText.length };
		editor.replaceRange(insertion, lineEnd);
		const headingLine = targetLine + 2;
		editor.setCursor({
			line: headingLine,
			ch: editor.getLine(headingLine).length,
		});
		return true;
	}

	// Re-typing an existing heading keeps its title; a plain line donates its
	// whole text. Both go through the same builder so the "title is only a
	// known display name" rule applies either way.
	const headingMatch = HEADING_CALLOUT_RE.exec(lineText);
	const plainHeading = /^#{1,6}[ \t]+(.*)$/.exec(lineText);
	const existingTitle = headingMatch
		? (headingMatch[3] ?? "")
		: (plainHeading?.[1] ?? lineText);

	const token = buildHeadingToken(def, {
		existingTitle,
		...(options?.isKnownDisplayName
			? { isKnownDisplayName: options.isKnownDisplayName }
			: {}),
	});
	const replacement = `${hashes} ${token}`;
	editor.replaceRange(
		replacement,
		{ line: targetLine, ch: 0 },
		{ line: targetLine, ch: lineText.length },
	);
	editor.setCursor({ line: targetLine, ch: replacement.length });

	return true;
};

/** Whether `{`/`}` pair up in order, so wrapping the text can't run away. */
const hasBalancedBraces = (text: string): boolean => {
	let depth = 0;
	for (const char of text) {
		if (char === "{") depth += 1;
		else if (char === "}" && --depth < 0) return false;
	}
	return depth === 0;
};

/**
 * Write an inline callout pill at the cursor: `[!important] `.
 *
 * With text selected on a single line and content pills enabled, the selection
 * becomes the pill's label (`[!important]{selected}`) — the documented brace
 * syntax. Otherwise the pill is inserted at the start of the selection and the
 * text is left alone, so the command never eats what the user had. Either way
 * the cursor lands after the pill on the SAME line, because pressing Enter on
 * an inline pill must not break the paragraph.
 */
export const insertInlineCallout = (
	editor: Editor,
	def: CalloutDefinition,
	options?: { allowContent?: boolean },
): boolean => {
	if (editor.lineCount() === 0) return false;

	const from = editor.getCursor("from");
	const to = editor.getCursor("to");
	const selected = editor.getSelection();

	// Braces cannot span lines and nest by depth with no escape (see
	// inlineContent.ts), so a multi-line selection — or one whose own braces
	// don't balance, which would swallow the rest of the line — falls through
	// to the plain-pill path instead of producing a broken pill.
	if (
		options?.allowContent === true &&
		selected.trim() !== "" &&
		from.line === to.line &&
		hasBalancedBraces(selected)
	) {
		const token = buildInlineContentToken(def, selected.trim());
		editor.replaceRange(token, from, to);
		editor.setCursor({ line: from.line, ch: from.ch + token.length });
		return true;
	}

	const token = buildInlineToken(def);
	editor.replaceRange(token, from, from);

	const afterCh = from.ch + token.length;
	const newLine = editor.getLine(from.line);
	if (newLine[afterCh] !== " ") {
		editor.replaceRange(" ", { line: from.line, ch: afterCh });
	}
	editor.setCursor({ line: from.line, ch: afterCh + 1 });

	return true;
};

/**
 * A line with one quote level taken off. Whatever indents its first `>` stays,
 * so a callout indented under a list item is still inside that item after it.
 */
const removeQuoteLevel = (line: string): string =>
	line.replace(/^([ \t]*)> ?/, "$1");

/**
 * Take one callout level off the innermost callout around the cursor.
 *
 * The header's title stays, as a line of its own where the header was — the
 * same thing deleting a callout type (convert to plain text) leaves in notes.
 * Only the `[!type]` token and its fold mark go. When the line above is text
 * of the same container, a blank line is written first: the callout was a
 * block of its own there, and without it its first line would join that
 * paragraph.
 */
export const unwrapCalloutAtSelection = (editor: Editor): boolean => {
	const { head, startLine } = getOrderedCursorLines(editor);
	const currentLine = hasSelection(editor) ? startLine : head.line;
	const fences = collectFenceBlocks(editor);
	const block = findContainingCallout(editor, fences, currentLine);
	if (!block) {
		new Notice(t("notice.cursorNotInsideCallout"));
		return false;
	}

	const headerText = editor.getLine(block.headerLine);
	const opened = removeQuoteLevel(headerText);
	const tokenStart = opened.indexOf("[!");
	/** What quotes (or indents) the container the callout sat in. */
	const containerPrefix = opened.slice(0, tokenStart);
	const title = splitFoldMark(
		opened.slice(opened.indexOf("]", tokenStart) + 1),
		"regular",
	).title.trim();

	const containerDepth = countQuoteMarkers(headerText) - 1;
	const above = block.headerLine - 1;
	const aboveText = above >= 0 ? editor.getLine(above) : "";
	const joinsAbove =
		above > findFrontmatterEnd(editor) &&
		!isBlankCalloutLine(aboveText) &&
		countQuoteMarkers(aboveText) === containerDepth &&
		!isHeaderAt(editor, fences, above);
	const lead = [
		...(joinsAbove ? [containerPrefix.trimEnd()] : []),
		...(title ? [`${containerPrefix}${title}`] : []),
	];

	const bodyLines: string[] = [];
	const removedLengths: number[] = [];
	for (let line = block.headerLine + 1; line <= block.lastLine; line++) {
		const text = editor.getLine(line);
		const stripped = removeQuoteLevel(text);
		bodyLines.push(stripped);
		removedLengths.push(text.length - stripped.length);
	}

	editor.replaceRange(
		[...lead, ...bodyLines].join("\n"),
		{ line: block.headerLine, ch: 0 },
		{
			line: block.lastLine,
			ch: editor.getLine(block.lastLine).length,
		},
	);

	const bodyStart = block.headerLine + lead.length;
	if (bodyLines.length === 0 || head.line <= block.headerLine) {
		editor.setCursor({ line: block.headerLine + (joinsAbove ? 1 : 0), ch: 0 });
		return true;
	}

	const bodyIndex = Math.min(
		Math.max(Math.min(head.line, block.lastLine) - block.headerLine - 1, 0),
		bodyLines.length - 1,
	);
	editor.setCursor({
		line: bodyStart + bodyIndex,
		ch: Math.min(
			Math.max(head.ch - (removedLengths[bodyIndex] ?? 0), 0),
			bodyLines[bodyIndex]?.length ?? 0,
		),
	});

	return true;
};
