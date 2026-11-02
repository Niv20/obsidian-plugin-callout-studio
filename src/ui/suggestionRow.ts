/**
 * ui/suggestionRow.ts — one row of a list that offers something to pick (a
 * callout, a colour word, "Create …"), built the way Obsidian builds its own
 * rich suggestions.
 *
 * Who calls it. editor/AutoComplete.ts (the `> [!` popover in a note),
 * editor/CalloutMetadataSuggest.ts (the `|` popover after a callout's id),
 * settings/calloutComboboxRow.ts (a callout in a picker's popup, which the
 * `[!` popover reuses) and ui/listboxPopupDom.ts (a picker's "Create …" row).
 *
 * The main idea (finding S10-16). Obsidian draws a link, tag or property
 * suggestion as `.suggestion-item.mod-complex` with two parts side by side:
 *
 *   .suggestion-icon > .suggestion-flair    a small muted icon at the start
 *   .suggestion-content                     a column of words:
 *       .suggestion-title                     what the row offers
 *       .suggestion-note                      (optional) a small grey line under it
 *
 * Obsidian's stylesheet lays these parts out — the 12px inset, the icon's
 * margins, the note's size and colour — so a row that wears the same classes
 * sits among Obsidian's own popups with no layout CSS of ours. The part of the
 * title that matches what was typed is wrapped in `.suggestion-highlight`,
 * which Obsidian draws bold.
 *
 * Each part also keeps the plugin's older class (`callout-studio-suggestion-*`)
 * as a hook for tests, scripts and the few rules that are ours: the icon's
 * fixed box, and the callout's ids as one monospace line.
 *
 * Inside a picker's popup the row is a `.cs-combobox-option`, not a
 * `.suggestion-item`, so Obsidian's suggestion rules do not reach it and the
 * popup's own menu-row rules lay it out instead. Same markup, two lists.
 */

/** The parts of one row that the caller fills in. */
export interface SuggestionRowParts {
	/** The slot at the start of the row; it holds the icon, or colour circles. */
	iconEl: HTMLElement;
	/** The column of words: the title, then any line the caller adds under it. */
	contentEl: HTMLElement;
	/** The first line, already holding the title text. */
	titleEl: HTMLElement;
}

/** What {@link createSuggestionRow} draws. */
export interface SuggestionRowOptions {
	/** The first line: what the row offers. */
	title: string;
	/**
	 * What the user typed, as typed. Its first match in the title is drawn
	 * bold, as Obsidian marks a match. Leave it out when nothing was typed.
	 */
	query?: string;
	/**
	 * What the slot at the start holds.
	 * - `"icon"` (the default): a small icon in Obsidian's `.suggestion-flair`,
	 *   which Obsidian draws muted and slightly faded, unless the caller gives
	 *   it a colour of its own.
	 * - `"swatch"`: colours. They must not be faded, so this slot is not a
	 *   flair; it sits where Obsidian puts the swatch in its own
	 *   highlight-colour suggestions (`==text=={`).
	 */
	slot?: "icon" | "swatch";
}

/**
 * Turn `rowEl` into one suggestion row and return its parts.
 *
 * @param rowEl The row itself: the `.suggestion-item` Obsidian made for an
 *   editor popover, or a picker's `.cs-combobox-option`.
 */
export function createSuggestionRow(rowEl: HTMLElement, options: SuggestionRowOptions): SuggestionRowParts {
	rowEl.addClass("mod-complex", "callout-studio-suggestion");

	const slotEl = rowEl.createDiv({ cls: "suggestion-icon" });
	const iconEl =
		options.slot === "swatch"
			? slotEl.createDiv({ cls: "callout-studio-suggestion-icon cs-suggestion-swatch" })
			: slotEl.createSpan({ cls: "suggestion-flair callout-studio-suggestion-icon" });

	const contentEl = rowEl.createDiv({ cls: "suggestion-content callout-studio-suggestion-text" });
	const titleEl = contentEl.createDiv({ cls: "suggestion-title callout-studio-suggestion-name" });
	appendWithHighlight(titleEl, options.title, options.query ?? "");
	return { iconEl, contentEl, titleEl };
}

/**
 * Append `text` to `el`, with the first run that matches `rawQuery` (ignoring
 * case and the spaces around the query) wrapped in Obsidian's
 * `span.suggestion-highlight`. With no query, or no match, the text goes in
 * plain.
 *
 * Only the first match is marked: a callout's name or id is a word or two, and
 * the run that made the row appear is the one worth showing.
 */
export function appendWithHighlight(el: HTMLElement, text: string, rawQuery: string): void {
	const query = rawQuery.trim().toLowerCase();
	const at = query.length > 0 ? text.toLowerCase().indexOf(query) : -1;
	if (at < 0) {
		el.appendText(text);
		return;
	}
	const before = text.slice(0, at);
	const after = text.slice(at + query.length);
	if (before) el.appendText(before);
	el.createSpan({ cls: "suggestion-highlight", text: text.slice(at, at + query.length) });
	if (after) el.appendText(after);
}
