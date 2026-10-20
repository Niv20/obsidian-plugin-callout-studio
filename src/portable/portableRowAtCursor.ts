/**
 * portable/portableRowAtCursor.ts — Which Review conversion card the caret is in.
 *
 * The Review conversion counterpart of usage/occurrenceAtCursor.ts. Every card
 * stands for one source line (there are no block callouts to walk up), so only
 * the caret's own line is read. Only cards the sidebar has drawn are
 * candidates: a card behind Show more never matches.
 */
import type { EditorPosition } from "obsidian";
import type { SourceLines } from "../editor/calloutExtent";
import type { PortableCalloutConversionChange } from "../utils/portableCalloutPlan";
import type { PortableConversionRow } from "./portableConversionRows";

const sourceOf = (row: PortableConversionRow): PortableCalloutConversionChange | undefined =>
	row.linkOnly ? undefined : row.change as PortableCalloutConversionChange;

/**
 * Innermost first: an inline callout the caret touches (its `{…}` payload
 * included), the heading callout on the caret's line, then the line's heading
 * link repair. A card whose line no longer reads as it was scanned (the rescan
 * has not caught up with typing yet) never matches; the next render asks again.
 */
export function portableRowAtCursor(
	lines: SourceLines,
	cursor: EditorPosition,
	rows: readonly PortableConversionRow[],
): PortableConversionRow | null {
	if (cursor.line < 0 || cursor.line >= lines.lineCount()) return null;
	const text = lines.getLine(cursor.line);
	const here = rows.filter(row => row.change.line - 1 === cursor.line
		&& (sourceOf(row)?.sourceLine ?? row.change.before) === text);
	return here.find(row => {
		const source = sourceOf(row);
		return source && !source.headingLine && source.from <= cursor.ch && cursor.ch <= source.to;
	}) ?? here.find(row => sourceOf(row)?.headingLine) ?? here.find(row => row.linkOnly) ?? null;
}
