/**
 * settings/calloutComboboxRow.ts — one callout in a list that offers callouts:
 * a picker's popup, and the `> [!` popover in a note.
 *
 * Who calls it. settings/calloutCombobox.ts (every callout picker: the
 * fallback, the command editor, Find callouts' type field) and
 * editor/AutoComplete.ts, which draws its popover rows with this very function:
 * the two lists offer the same choice and must be the same thing to look at.
 *
 * The main idea. The row is Obsidian's suggestion anatomy
 * ({@link createSuggestionRow}): the callout's icon at the start, in the
 * callout's own colour; its name in the list's normal text colour; and under
 * the name, small and grey, its id and aliases ({@link renderCalloutIdLine}),
 * with the part that was typed in bold. Until 2026-10-24 the name wore the
 * callout's colour too and the untyped part of the ids was faded; Obsidian's
 * link and tag suggestions colour neither, so neither do these (S10-16).
 */
import { getLocale } from "../i18n";
import { paintCalloutListIcon } from "../manager/theme/calloutListIcon";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { CalloutDefinition } from "../types";
import { appendWithHighlight, createSuggestionRow } from "../ui/suggestionRow";
import { getSortedCalloutIds } from "../utils/sorting";

/** What {@link renderCalloutComboboxRow} needs besides the callout. */
export interface CalloutComboboxRowOptions {
	/** Whether Obsidian is in dark mode: a callout has a colour for each. */
	isDark: boolean;
	/** Raw query as typed; lowercased here. */
	query: string;
}

/** What follows every id but the last on the id line. */
const ID_SEPARATOR = ", ";

/**
 * Draw `def` into `rowEl`: its icon in its colour, its name, and its ids.
 *
 * @param rowEl The row, already in the list (a picker's option, or the
 *   `.suggestion-item` Obsidian made for the `[!` popover).
 * @param registry Asked who paints the callout now, so a callout the theme
 *   owns shows the theme's icon and colour.
 */
export function renderCalloutComboboxRow(
	rowEl: HTMLElement,
	def: CalloutDefinition,
	registry: CalloutRegistry,
	options: CalloutComboboxRowOptions,
): void {
	const { iconEl, contentEl } = createSuggestionRow(rowEl, {
		title: def.displayName,
		query: options.query,
	});

	// Icon and accent both come from whoever actually paints this callout — the
	// theme's measured pair when the theme owns the id, a neutral placeholder
	// when a user snippet does. Naming an appearance the callout will not have
	// is the one thing a list must not do. The colour goes on the icon only.
	const color = paintCalloutListIcon(iconEl, def, registry, options.isDark);
	iconEl.style.color = color;

	renderCalloutIdLine(contentEl, def, options.query);
}

/**
 * The second line: the callout's id and its aliases, in Obsidian's small grey
 * `.suggestion-note`.
 *
 * Always drawn, which is the point — the ids are how you find a callout you
 * only half remember, and a line that appears and disappears depending on what
 * you typed is a line you cannot rely on. When a query is present, only the
 * ids/aliases containing it are listed, each with the typed run in bold
 * (`.suggestion-highlight`); with no query, all of them show.
 *
 * Shared by every list that offers callouts, so the lists cannot say
 * different things about the same callout.
 *
 * @param contentEl The row's column of words; the line goes under the name.
 */
export function renderCalloutIdLine(
	contentEl: HTMLElement,
	def: CalloutDefinition,
	rawQuery: string,
): void {
	const query = rawQuery.trim().toLowerCase();
	const allIds = getSortedCalloutIds(def, getLocale());
	const matches =
		query.length > 0
			? allIds.filter((id) => id.toLowerCase().includes(query))
			: [];
	const toShow = matches.length > 0 ? matches : allIds;
	if (toShow.length === 0) return;

	const idEl = contentEl.createDiv({ cls: "suggestion-note callout-studio-suggestion-id" });

	// One element per id, each carrying its own trailing ", ". The line is cut by
	// the browser (`text-overflow: ellipsis` in styles.css), which drops whole
	// elements rather than characters, so the cut always falls between ids and
	// the mark always follows a comma and a space. Nothing here measures
	// anything: the width is only known once the row is laid out, inside a list
	// whose scrollbar arrives after its rows are built, and a count worked out
	// beforehand disagreed with the final layout by exactly that scrollbar.
	toShow.forEach((id, index) => {
		const itemEl = idEl.createSpan({ cls: "callout-studio-suggestion-id-item" });
		// With no match in this list the query is "" here, so nothing is bold.
		appendWithHighlight(itemEl, id, matches.length > 0 ? query : "");
		if (index < toShow.length - 1) itemEl.appendText(ID_SEPARATOR);
	});
}
