/**
 * ui/listboxPopupDom.ts — the markup and the ARIA of a combobox, and nothing else.
 *
 * Split out of {@link ListboxPopup} because they answer different questions.
 * This file answers "what is on the page and what does a screen reader call
 * it"; the popup answers "what happens when you type". The ARIA in particular
 * is a shape that has to be got exactly right once and then left alone, and it
 * reads far better as one declaration than scattered through the event wiring
 * that maintains it.
 *
 * The pattern is WAI-ARIA 1.2's **editable combobox with listbox popup**: the
 * roles sit on the `<input>` itself, not on a wrapper around it. The older 1.0
 * shape — `role="combobox"` on a containing div — is the one screen readers now
 * mis-announce, so it is worth being explicit that the modern one is deliberate.
 */
import { setIcon } from "obsidian";

export interface ComboboxParts {
	root: HTMLElement;
	control: HTMLElement;
	/** The slot left of the input, for the caller's icon or swatch. */
	lead: HTMLElement;
	input: HTMLInputElement;
	menu: HTMLElement;
}

export interface ComboboxSkeletonOptions {
	ariaLabel: string;
	placeholder: string;
	/** Ties the input's `aria-controls` to the menu it opens. */
	listboxId: string;
}

export function buildComboboxSkeleton(
	parent: HTMLElement,
	options: ComboboxSkeletonOptions,
): ComboboxParts {
	const root = parent.createDiv({ cls: "cs-combobox" });
	const control = root.createDiv({ cls: "cs-combobox-control" });
	const lead = control.createDiv({ cls: "cs-combobox-lead" });

	const input = control.createEl("input", {
		cls: "cs-combobox-input",
		attr: {
			type: "text",
			role: "combobox",
			"aria-label": options.ariaLabel,
			"aria-expanded": "false",
			"aria-controls": options.listboxId,
			"aria-haspopup": "listbox",
			"aria-autocomplete": "list",
			placeholder: options.placeholder,
			autocomplete: "off",
			spellcheck: "false",
			// Mobile: the keyboard's action key finishes the edit rather than
			// offering to insert a newline into a field that holds one line.
			enterkeyhint: "done",
		},
	});

	// Up/down chevron, matching standard selects. Decoration only — the control
	// control it sits on is already operable, so making this focusable would
	// just add a Tab stop on the way past.
	const caret = control.createDiv({
		cls: "cs-combobox-caret",
		attr: { "aria-hidden": "true" },
	});
	setIcon(caret, "chevrons-up-down");

	const menu = root.createDiv({
		cls: "cs-combobox-menu cs-combobox-menu-hidden",
		attr: { role: "listbox", id: options.listboxId },
	});

	return { root, control, lead, input, menu };
}

/**
 * What it takes to draw one item — shared with {@link ListboxPopupOptions},
 * which extends it, so the popup's contract and this renderer's cannot drift.
 */
export interface ComboboxRowContract<T> {
	/**
	 * Draw one row. The caller owns everything inside it; the row's own `role`,
	 * `id` and `is-active`/`is-selected` classes are not the caller's to set.
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
}

export interface ComboboxRowsSpec<T> extends ComboboxRowContract<T> {
	items: readonly T[];
	query: string;
	/** Namespace for row ids, so `aria-activedescendant` can point at one. */
	listboxId: string;
	/** The committed item's key, or `undefined` — drawn as `is-selected`. */
	selectedKey: string | undefined;
	onEnterRow(index: number): void;
	onClickRow(index: number): void;
}

/**
 * Draw the rows for one query, and hand back the elements in order.
 *
 * Returns them rather than storing them because *where the highlight is* is
 * state, and state belongs to the popup; this only puts things on the page.
 */
export function renderComboboxRows<T>(
	menuEl: HTMLElement,
	spec: ComboboxRowsSpec<T>,
): HTMLElement[] {
	menuEl.empty();
	const rowEls: HTMLElement[] = [];
	let openGroup: string | undefined;

	spec.items.forEach((item, i) => {
		const group = spec.groupOf?.(item);
		if (group && group.key !== openGroup) {
			openGroup = group.key;
			menuEl.createDiv({
				cls: "cs-combobox-group-label",
				text: group.label,
			});
		}
		const rowEl = menuEl.createDiv({
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
		}
		// mouseenter rather than hover CSS alone, because the popup's
		// `onHighlight` live-previews and CSS cannot call it.
		rowEl.addEventListener("mouseenter", () => spec.onEnterRow(i));
		rowEl.addEventListener("click", () => spec.onClickRow(i));
		rowEls.push(rowEl);
	});

	return rowEls;
}

/**
 * The row offered when a query matched nothing — "Create «warning»" rather than
 * "no matches".
 *
 * Deliberately the `[!` popover's own create-row markup, class for class
 * (`editor/AutoComplete.ts` renders the same thing), so the offer looks and
 * reads identically wherever the user meets it. It is a real row: the caller
 * appends it to the navigable list, so an arrow key reaches it and Enter takes
 * it, which an empty-state paragraph could never do.
 */
export function renderComboboxCreateRow(
	menuEl: HTMLElement,
	label: string,
	rowId: string,
): HTMLElement {
	const rowEl = menuEl.createDiv({
		cls: "cs-combobox-option callout-studio-suggestion callout-studio-suggestion-create-new",
		attr: { role: "option", id: rowId },
	});
	const iconEl = rowEl.createDiv({ cls: "callout-studio-suggestion-icon" });
	setIcon(iconEl, "plus");
	rowEl
		.createDiv({ cls: "callout-studio-suggestion-text" })
		.createDiv({ cls: "callout-studio-suggestion-name", text: label });
	return rowEl;
}

/** The dead end: no matches, and nothing to offer instead. */
export function renderComboboxEmptyState(
	menuEl: HTMLElement,
	text: string,
): void {
	menuEl.createDiv({ cls: "callout-studio-empty-state", text });
}

export interface FooterRowSpec {
	/** Lucide id. */
	icon: string;
	label: string;
	onClick(): void;
}

/**
 * The optional row pinned below the list — the palette picker's "+ New color…".
 *
 * It is an action, not an item, which is why it is built here rather than
 * through the caller's `renderRow` and why the popup keeps it out of the array
 * the arrow keys walk: Enter must never land on it.
 */
export function renderComboboxFooterRow(
	menuEl: HTMLElement,
	footer: FooterRowSpec,
	onEnter: () => void,
): void {
	const rowEl = menuEl.createDiv({
		cls: "cs-combobox-footer-row",
		attr: { role: "option" },
	});
	const iconEl = rowEl.createSpan({ cls: "cs-combobox-footer-row-icon" });
	setIcon(iconEl, footer.icon);
	rowEl.createSpan({
		cls: "cs-combobox-footer-row-label",
		text: footer.label,
	});
	// Moving onto this row leaves the real ones, which also ends whatever they
	// were previewing.
	rowEl.addEventListener("mouseenter", onEnter);
	rowEl.addEventListener("click", () => footer.onClick());
}
