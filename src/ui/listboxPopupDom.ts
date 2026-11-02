/**
 * ui/listboxPopupDom.ts — the markup and the ARIA of a picker, and nothing else.
 *
 * Split out of {@link ListboxPopup} because they answer different questions.
 * This file answers "what is on the page and what does a screen reader call
 * it"; the popup answers "what happens when you type". The ARIA in particular
 * is a shape that has to be got exactly right once and then left alone, and it
 * reads far better as one declaration than scattered through the event wiring
 * that maintains it.
 *
 * The shape is Obsidian's own combobox (Bases' pickers, the file pickers in
 * Settings): a field drawn as Obsidian's dropdown, and under it Obsidian's
 * popover (`.suggestion-container`) holding a search box above the list
 * (`.suggestion`). Obsidian's CSS draws the field, the popover's frame and the
 * search box; the rows are the plugin's.
 *
 * The ARIA is WAI-ARIA 1.2's. A searchable picker's search box is the
 * **editable combobox** (the roles on the `<input>` itself, not on a wrapper:
 * the older 1.0 shape is the one screen readers now mis-announce), and the
 * field is the button that opens it. A select-only picker has no search box,
 * so its field is the **select-only combobox** and keeps the focus.
 */
import { setIcon } from "obsidian";
import { DropdownField } from "./dropdownField";
import { setFieldAccessibleName } from "./fieldAccessibleName";
import { createSearchField } from "./searchField";
import { createSuggestionRow } from "./suggestionRow";

export interface ComboboxParts {
	root: HTMLElement;
	/** The field: Obsidian's dropdown, showing the committed choice. */
	field: DropdownField;
	/** Obsidian's popover: the search box, if any, above the list. */
	popup: HTMLElement;
	/** The search box, or `null` for a select-only picker. */
	input: HTMLInputElement | null;
	/** The list itself (`role="listbox"`), the part of the popover that scrolls. */
	menu: HTMLElement;
}

export interface ComboboxSkeletonOptions {
	ariaLabel: string;
	/** The search box's grey hint, such as "Search callouts…". */
	placeholder: string;
	/** Ties the combobox's `aria-controls` to the list it opens. */
	listboxId: string;
	/** False for a select-only picker: no search box. */
	searchable: boolean;
	/** The search box's text, after every keystroke and after its × empties it. */
	onQuery(query: string): void;
}

export function buildComboboxSkeleton(parent: HTMLElement, options: ComboboxSkeletonOptions): ComboboxParts {
	const root = parent.createDiv({ cls: "cs-combobox" });
	const field = new DropdownField(root, { accessibleName: options.ariaLabel, popup: "listbox" });
	field.el.setAttribute("aria-controls", options.listboxId);

	const popup = root.createDiv({ cls: "suggestion-container cs-combobox-popup cs-combobox-popup-hidden" });
	let input: HTMLInputElement | null = null;
	if (options.searchable) {
		// `combobox` is Obsidian's class for its combobox's popover: app.css then
		// draws the search box flat inside it, as in Bases.
		popup.addClass("combobox");
		input = createSearchField(popup, {
			placeholder: options.placeholder,
			fieldCls: "cs-combobox-search",
			inputCls: "cs-combobox-input",
			onChange: (query) => options.onQuery(query),
		}).inputEl;
		for (const [name, value] of Object.entries({
			role: "combobox",
			"aria-expanded": "false",
			"aria-controls": options.listboxId,
			"aria-autocomplete": "list",
			autocomplete: "off",
			spellcheck: "false",
			// Mobile: the keyboard's action key finishes the search rather than
			// offering to insert a newline into a field that holds one line.
			enterkeyhint: "done",
		}))
			input.setAttribute(name, value);
		setFieldAccessibleName(input, options.ariaLabel);
	} else {
		field.el.setAttribute("role", "combobox");
	}

	const menu = popup.createDiv({
		cls: "suggestion cs-combobox-menu",
		attr: { role: "listbox", id: options.listboxId },
	});

	return { root, field, popup, input, menu };
}

/**
 * What it takes to draw one item — shared with {@link ListboxPopupOptions},
 * which extends it, so the popup's contract and this renderer's cannot drift.
 */
export interface ComboboxRowContract<T> {
	/**
	 * Draw one row. The caller owns everything inside it; the row's own `role`,
	 * `id`, its `is-active`/`is-selected` classes and the ✓ at its end (see
	 * {@link appendComboboxCheck}) are not the caller's to set.
	 */
	renderRow(rowEl: HTMLElement, item: T, query: string): void;
	/** Stable identity, so a selection survives a rebuild of the list. */
	keyOf(item: T): string;
	/** Shown in place of the rows when there are none. */
	emptyText(query: string): string;
	/**
	 * Optional heading above `item`, when it opens a new run.
	 *
	 * Emitted on change of `key`, never from a fixed list of groups, which is
	 * what makes a filter free: a group whose every row was typed away simply
	 * never opens a run, so its heading cannot be left stranded over nothing.
	 * The caller must therefore hand items back already grouped.
	 */
	groupOf?(item: T): { key: string; label: string };
	/** Hide redundant headings when the displayed rows share a single group. */
	hideSingleGroup?: boolean;
	/** Keep this scope heading visible even when it is the only matching group. */
	showSingleGroupKey?: string;
}

export interface ComboboxRowsSpec<T> extends ComboboxRowContract<T> {
	items: readonly T[];
	query: string;
	/** Namespace for row ids, so `aria-activedescendant` can point at one. */
	listboxId: string;
	/** The committed item's key, or `undefined` — drawn as `is-selected`. */
	selectedKey: string | undefined;
	/** Both entering a row and moving inside it can take over from arrow keys. */
	onPointerRow(index: number): void;
	onLeaveRow(): void;
	onClickRow(index: number): void;
}

/**
 * Draw the rows for one query, and hand back the elements in order.
 *
 * Returns them rather than storing them because *where the highlight is* is
 * state, and state belongs to the popup; this only puts things on the page.
 */
export function renderComboboxRows<T>(menuEl: HTMLElement, spec: ComboboxRowsSpec<T>): HTMLElement[] {
	menuEl.empty();
	const rowEls: HTMLElement[] = [];
	let openGroup: string | undefined;
	let hasGroups = false;
	let rowParent = menuEl;
	const groups = spec.items.map((item) => spec.groupOf?.(item));
	const showGroups =
		!spec.hideSingleGroup ||
		new Set(groups.map((group) => group?.key)).size > 1 ||
		groups[0]?.key === spec.showSingleGroupKey;

	spec.items.forEach((item, i) => {
		const group = showGroups ? groups[i] : undefined;
		if (group && group.key !== openGroup) {
			hasGroups = true;
			openGroup = group.key;
			const headingId = `${spec.listboxId}-group-${i}`;
			rowParent = menuEl.createDiv({
				cls: "cs-combobox-group",
				attr: { role: "group", "aria-labelledby": headingId },
			});
			rowParent.createDiv({
				cls: "cs-combobox-group-label",
				text: group.label,
				attr: { id: headingId },
			});
		} else if (!group) {
			openGroup = undefined;
			rowParent = menuEl;
		}
		const rowEl = rowParent.createDiv({
			cls: "cs-combobox-option",
			attr: { role: "option", id: `${spec.listboxId}-${i}` },
		});
		spec.renderRow(rowEl, item, spec.query);
		// `is-active` (where the keyboard is) and `aria-selected` (what is
		// committed) are different states and must not be folded together:
		// arrowing past a row has not chosen it.
		if (spec.selectedKey !== undefined && spec.keyOf(item) === spec.selectedKey) {
			rowEl.addClass("is-selected");
			rowEl.setAttribute("aria-selected", "true");
			// Appended after the caller's content, so it always lands last.
			appendComboboxCheck(rowEl);
		}
		// mouseenter rather than hover CSS alone, because the popup's
		// `onHighlight` live-previews and CSS cannot call it.
		rowEl.addEventListener("mouseenter", () => spec.onPointerRow(i));
		rowEl.addEventListener("mousemove", () => spec.onPointerRow(i));
		rowEl.addEventListener("mouseleave", () => spec.onLeaveRow());
		rowEl.addEventListener("click", () => spec.onClickRow(i));
		rowEls.push(rowEl);
	});
	// Match the rendered groups, including filtering and hidden single headings.
	menuEl.toggleClass("cs-combobox-menu-grouped", hasGroups);

	return rowEls;
}

/**
 * Put a ✓ at the end of a row, to mark it as the current choice.
 *
 * This is how Obsidian marks the current choice in its own menus: calling
 * `MenuItem.setChecked(true)` draws the same Lucide `check` icon at the end of
 * the item. It replaces the filled stripe these lists used to paint behind the
 * chosen row, so that a list looks like every other menu in Obsidian.
 *
 * Who calls it: {@link renderComboboxRows} for the committed row of every
 * shared dropdown, and the callout editor's hand-built Fold menu, which is not
 * a {@link ListboxPopup} but must mark its choice the same way.
 *
 * The icon is only decoration. A screen reader already hears "selected" from
 * the row's `aria-selected="true"`, so `aria-hidden` stops it from also reading
 * out the word "check".
 *
 * @param rowEl The row to mark. The check is appended as its last child.
 * @returns The new check element (`span.cs-combobox-check`).
 */
export function appendComboboxCheck(rowEl: HTMLElement): HTMLElement {
	const checkEl = rowEl.createSpan({
		cls: "cs-combobox-check",
		attr: { "aria-hidden": "true" },
	});
	setIcon(checkEl, "check");
	return checkEl;
}

/**
 * The row offered when a query matched nothing — "Create «warning»" rather than
 * "no matches".
 *
 * Deliberately the `[!` popover's own create-row markup, class for class
 * (both are built by {@link createSuggestionRow}), so the offer looks and
 * reads identically wherever the user meets it. It is a real row: the caller
 * appends it to the navigable list, so an arrow key reaches it and Enter takes
 * it, which an empty-state paragraph could never do.
 */
export function renderComboboxCreateRow(menuEl: HTMLElement, label: string, rowId: string): HTMLElement {
	const rowEl = menuEl.createDiv({
		cls: "cs-combobox-option callout-studio-suggestion-create-new",
		attr: { role: "option", id: rowId },
	});
	const { iconEl } = createSuggestionRow(rowEl, { title: label });
	setIcon(iconEl, "plus");
	return rowEl;
}

/** The dead end: no matches, and nothing to offer instead. */
export function renderComboboxEmptyState(menuEl: HTMLElement, text: string): void {
	menuEl.createDiv({ cls: "callout-studio-empty-state", text });
}

/**
 * The plain text that can close the list — see `footerNote`.
 *
 * It is not an action, so it has no role and no listeners: nothing highlights
 * it, the popup never counts it among its rows, and a press on it is swallowed
 * by the popover's own `mousedown`, which keeps focus where it was and the
 * list open.
 */
export function renderComboboxFooterNote(menuEl: HTMLElement, text: string): void {
	menuEl.createDiv({ cls: "cs-combobox-footer-note", text });
}
