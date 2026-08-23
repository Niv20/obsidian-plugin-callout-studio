/**
 * editor/CalloutBlockTools.ts — Low-level editor utilities for callout blocks.
 *
 * Contains pure functions that operate on an Obsidian Editor instance:
 * wrapping a text selection inside a new callout block, and unwrapping an
 * existing callout back to plain text. The two structural questions it leans on
 * live next door — `quotePrefix.ts` for nested quote depths, `fenceBlocks.ts`
 * for the code/math ranges an expansion must not cut through.
 * Used by editor/commands.ts (keyboard commands) and editor/ContextMenu.ts.
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
import { collectFenceBlocks, findFenceBlockAtLine } from "./fenceBlocks";
import type { FenceBlock } from "./fenceBlocks";
import {
	buildPrefix,
	countLeadingQuoteTokens,
	isBlankCalloutLine,
	stripLeadingQuoteTokens,
} from "./quotePrefix";
import type { QuoteStripResult } from "./quotePrefix";

interface CalloutBlockInfo {
	headerLine: number;
	lastLine: number;
	calloutLevel: number;
}

const CALLOUT_HEADER_REGEX = /^\[![^\]]*\]/;

const arePositionsEqual = (a: EditorPosition, b: EditorPosition): boolean =>
	a.line === b.line && a.ch === b.ch;

const findFrontmatterEnd = (editor: Editor): number => {
	if (editor.lineCount() === 0) return -1;
	if (editor.getLine(0).trim() !== "---") return -1;

	for (let line = 1; line < editor.lineCount(); line++) {
		if (editor.getLine(line).trim() === "---") {
			return line;
		}
	}

	return -1;
};

const expandStartLine = (
	editor: Editor,
	startLine: number,
	fenceBlocks: FenceBlock[],
	frontmatterEnd: number,
): number => {
	const minimumLine = frontmatterEnd >= 0 ? frontmatterEnd + 1 : 0;
	let current = startLine;
	let candidate = startLine - 1;

	while (candidate >= minimumLine) {
		const lineText = editor.getLine(candidate);
		if (isBlankCalloutLine(lineText)) break;

		const fenceBlock = findFenceBlockAtLine(fenceBlocks, candidate);
		if (fenceBlock) {
			current = fenceBlock.startLine;
			candidate = fenceBlock.startLine - 1;
			continue;
		}

		current = candidate;
		candidate -= 1;
	}

	return current;
};

const expandEndLine = (
	editor: Editor,
	endLine: number,
	fenceBlocks: FenceBlock[],
): number => {
	const maxLine = editor.lineCount() - 1;
	let current = endLine;
	let candidate = endLine + 1;

	while (candidate <= maxLine) {
		const lineText = editor.getLine(candidate);
		if (isBlankCalloutLine(lineText)) break;

		const fenceBlock = findFenceBlockAtLine(fenceBlocks, candidate);
		if (fenceBlock) {
			current = fenceBlock.endLine;
			candidate = fenceBlock.endLine + 1;
			continue;
		}

		current = candidate;
		candidate += 1;
	}

	return current;
};

const findFirstNonEmptyLine = (
	editor: Editor,
	startLine: number,
	endLine: number,
): number => {
	for (let line = startLine; line <= endLine; line++) {
		if (!isBlankCalloutLine(editor.getLine(line))) {
			return line;
		}
	}

	return -1;
};

const isCalloutHeaderLine = (line: string): boolean => {
	const stripped = stripLeadingQuoteTokens(line);
	return (
		stripped.removedUnits > 0 && CALLOUT_HEADER_REGEX.test(stripped.text)
	);
};

const findContainingCallout = (
	editor: Editor,
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

		if (isCalloutHeaderLine(text) && currentLevel <= deepestAllowedLevel) {
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
const openingHeaderToken = (def?: CalloutDefinition): string =>
	def ? buildBlockHeaderToken(def) : "[!";

/**
 * The blank quoted line a finished, empty block callout opens with — `> ` at
 * the callout's own depth — or `null` when the header itself is unfinished.
 *
 * A callout that already knows its type has nothing left to say on the header
 * line, so the next thing the user types is body text; writing the line for
 * them and landing the cursor after its `> ` is what makes the Quick insert
 * window and a user-built `Insert X callout` command leave the same thing
 * behind. With no type the header is still the bare `[!` that the autocomplete
 * is about to finish, so the cursor belongs up there and there is no body line
 * to write.
 */
const emptyBodyLine = (prefix: string, def?: CalloutDefinition): string | null =>
	def ? `${prefix}> ` : null;

export const wrapSelectionInCallout = (
	editor: Editor,
	options?: { requireSelection?: boolean; def?: CalloutDefinition },
): boolean => {
	const lineCount = editor.lineCount();
	if (lineCount === 0) {
		new Notice(t("notice.nothingToWrap"));
		return false;
	}

	const selectionPresent = hasSelection(editor);
	if (options?.requireSelection && !selectionPresent) {
		return false;
	}

	const {
		head,
		startLine: rawStartLine,
		endLine: rawEndLine,
	} = getOrderedCursorLines(editor);
	let startLine = selectionPresent ? rawStartLine : head.line;
	let endLine = selectionPresent ? rawEndLine : head.line;

	const frontmatterEnd = findFrontmatterEnd(editor);
	if (frontmatterEnd >= 0 && startLine <= frontmatterEnd) {
		startLine = frontmatterEnd + 1;
		endLine = Math.max(endLine, startLine);
	}

	if (startLine >= lineCount) {
		new Notice(t("notice.nothingToWrap"));
		return false;
	}

	const fenceBlocks = collectFenceBlocks(editor);
	const startFence = findFenceBlockAtLine(fenceBlocks, startLine);
	if (startFence) {
		startLine = startFence.startLine;
	}
	const endFence = findFenceBlockAtLine(fenceBlocks, endLine);
	if (endFence) {
		endLine = endFence.endLine;
	}

	startLine = expandStartLine(editor, startLine, fenceBlocks, frontmatterEnd);
	endLine = expandEndLine(editor, endLine, fenceBlocks);

	const foundContentLine = findFirstNonEmptyLine(editor, startLine, endLine);
	// On a blank line (nothing to expand into) fall back to the cursor line and
	// build an empty callout there, so the user can type inside it right away.
	const firstContentLine = foundContentLine >= 0 ? foundContentLine : startLine;

	const contentStartLine = firstContentLine;
	const nestLevel = countLeadingQuoteTokens(editor.getLine(firstContentLine));
	const prefix = buildPrefix(nestLevel);
	const wrappingExistingCallout = isCalloutHeaderLine(
		editor.getLine(firstContentLine),
	);
	const headerPrefix = buildPrefix(
		Math.max(nestLevel - (wrappingExistingCallout ? 1 : 0), 0),
	);
	const headerLine = `${headerPrefix}> ${openingHeaderToken(options?.def)}`;
	const replacementLines: string[] = [headerLine];

	// Nothing was found to wrap, so the callout is born empty and its body is
	// the one line the user is about to type into rather than a requoting of
	// what was there. Every other case keeps the cursor on the header, where
	// the title is.
	const emptyBody =
		foundContentLine < 0 ? emptyBodyLine(prefix, options?.def) : null;

	if (emptyBody !== null) {
		replacementLines.push(emptyBody);
	} else {
		for (let line = contentStartLine; line <= endLine; line++) {
			const current = editor.getLine(line);
			if (isBlankCalloutLine(current)) {
				const existingRelativeDepth = Math.max(
					countLeadingQuoteTokens(current) - nestLevel,
					0,
				);
				replacementLines.push(
					`${buildPrefix(nestLevel + existingRelativeDepth)}>`,
				);
				continue;
			}

			const stripped = stripLeadingQuoteTokens(current, nestLevel);
			replacementLines.push(`${prefix}> ${stripped.text}`);
		}
	}

	const replacement = replacementLines.join("\n");
	editor.replaceRange(
		replacement,
		{ line: startLine, ch: 0 },
		{ line: endLine, ch: editor.getLine(endLine).length },
	);
	editor.setCursor(
		emptyBody === null
			? { line: startLine, ch: headerLine.length }
			: { line: startLine + 1, ch: emptyBody.length },
	);

	return true;
};

export const insertEmptyCallout = (
	editor: Editor,
	options?: { def?: CalloutDefinition },
): boolean => {
	const head = editor.getCursor("head");
	const lineText = editor.getLine(head.line);
	const nestLevel = countLeadingQuoteTokens(lineText);
	const prefix = buildPrefix(nestLevel);
	const header = `${prefix}> ${openingHeaderToken(options?.def)}`;
	const body = emptyBodyLine(prefix, options?.def);
	const block = body === null ? header : `${header}\n${body}`;
	/** Where the cursor goes, given the line the header landed on. */
	const cursorFor = (headerLine: number): EditorPosition =>
		body === null
			? { line: headerLine, ch: header.length }
			: { line: headerLine + 1, ch: body.length };

	if (isBlankCalloutLine(lineText)) {
		// Blank line (or blank callout line): drop the callout in place. With no
		// type chosen that lands the user right after `[!`, where the
		// autocomplete opens; with one, it lands in the empty body below the
		// finished title.
		editor.replaceRange(
			block,
			{ line: head.line, ch: 0 },
			{ line: head.line, ch: lineText.length },
		);
		editor.setCursor(cursorFor(head.line));
		return true;
	}

	// Line has content: append the callout below, separated by a blank line so
	// it renders as its own block. The separator keeps the current quote depth
	// when inserting inside an existing blockquote/callout. Guard the trailing
	// side too when the next line has content — otherwise it would be swallowed
	// into the empty callout as a lazy blockquote continuation.
	const separator = nestLevel > 0 ? prefix.trimEnd() : "";
	const nextLine = head.line + 1;
	const nextHasContent =
		nextLine < editor.lineCount() &&
		editor.getLine(nextLine).trim() !== "";
	const trailing = nextHasContent ? `\n${separator}` : "";
	const lineEnd = { line: head.line, ch: lineText.length };
	editor.replaceRange(`\n${separator}\n${block}${trailing}`, lineEnd);
	editor.setCursor(cursorFor(head.line + 2));

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

export const unwrapCalloutAtSelection = (editor: Editor): boolean => {
	const { head, startLine } = getOrderedCursorLines(editor);
	const currentLine = hasSelection(editor) ? startLine : head.line;
	const block = findContainingCallout(editor, currentLine);
	if (!block) {
		new Notice(t("notice.cursorNotInsideCallout"));
		return false;
	}

	const bodyLines: string[] = [];
	const strippedLines: QuoteStripResult[] = [];
	for (let line = block.headerLine + 1; line <= block.lastLine; line++) {
		const stripped = stripLeadingQuoteTokens(editor.getLine(line), 1);
		bodyLines.push(stripped.text);
		strippedLines.push(stripped);
	}

	const replacement = bodyLines.join("\n");
	editor.replaceRange(
		replacement,
		{ line: block.headerLine, ch: 0 },
		{
			line: block.lastLine,
			ch: editor.getLine(block.lastLine).length,
		},
	);

	if (bodyLines.length === 0) {
		editor.setCursor({ line: block.headerLine, ch: 0 });
		return true;
	}

	if (head.line <= block.headerLine) {
		editor.setCursor({ line: block.headerLine, ch: 0 });
		return true;
	}

	const originalLine = Math.min(head.line, block.lastLine);
	const bodyIndex = Math.min(
		Math.max(originalLine - block.headerLine - 1, 0),
		bodyLines.length - 1,
	);
	const stripped = strippedLines[bodyIndex] ?? {
		text: bodyLines[bodyIndex] ?? "",
		removedLength: 0,
		removedUnits: 0,
	};
	const targetLine = block.headerLine + bodyIndex;
	const targetCh = Math.min(
		Math.max(head.ch - stripped.removedLength, 0),
		bodyLines[bodyIndex]?.length ?? 0,
	);
	editor.setCursor({ line: targetLine, ch: targetCh });

	return true;
};
