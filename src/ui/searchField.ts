/**
 * ui/searchField.ts — Obsidian's search field, for the plugin's search boxes.
 *
 * Who calls it. Quick insert, Replace in vault, and the icon picker's library
 * and picture searches.
 *
 * The main idea. Obsidian's public `SearchComponent` builds the field exactly
 * as Obsidian's own settings search looks: a `div.search-input-container`
 * holding an `input[type=search]` and a clear button. app.css adds the
 * magnifier, the × (shown only once something is typed) and, on macOS, the
 * pill shape (finding S6-15). This wraps it for two things the plain component
 * does not give:
 *
 * - the outer `div` — the element a toolbar has to size — which is not in
 *   Obsidian's typings but is simply the input's parent;
 * - one callback for both typing and the ×. Pressing the × empties the field
 *   without an `input` event, so a listener on `input` alone would never hear
 *   it; `onChange` hears both.
 */
import { SearchComponent } from "obsidian";

/** A built search field and the parts its callers need. */
export interface SearchField {
	/** Obsidian's component (`setValue`, `setDisabled`, …). */
	search: SearchComponent;
	/** The text box itself: keys, focus, its accessible name. */
	inputEl: HTMLInputElement;
	/** The `div.search-input-container` around it: the element to lay out. */
	containerEl: HTMLElement;
}

/**
 * Add Obsidian's search field to `parent`.
 *
 * @param parent Where the field goes.
 * @param options.placeholder The grey hint shown while the field is empty.
 * @param options.fieldCls A class for the outer `div`, for the caller's layout.
 * @param options.inputCls A class for the text box, by which tests and the
 *   screenshot scripts find it.
 * @param options.value The text to start with, if any.
 * @param options.onChange Called with the text after every keystroke and
 *   after the × empties the field.
 */
export function createSearchField(
	parent: HTMLElement,
	options: {
		placeholder: string;
		fieldCls: string;
		inputCls: string;
		value?: string;
		onChange: (query: string) => void;
	},
): SearchField {
	const search = new SearchComponent(parent).setPlaceholder(options.placeholder);
	if (options.value) search.setValue(options.value);
	search.onChange(options.onChange);
	const inputEl = search.inputEl;
	inputEl.addClass(options.inputCls);
	// `??`: should Obsidian ever build the field without a wrapper, the input
	// is the element left to lay out.
	const containerEl = inputEl.parentElement ?? inputEl;
	containerEl.addClass(options.fieldCls);
	return { search, inputEl, containerEl };
}
