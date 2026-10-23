/**
 * ui/selectDropdown.ts — a plain choice: a field that shows the current value
 * and opens Obsidian's own menu of the options under it.
 *
 * What it is for. Every "pick one of a few" control in the plugin: a custom
 * command's format, heading level, action and fold state; a palette's
 * background style; the Find callouts format filter; Quick insert's source;
 * the icon picker's style and category filters; the id picker in "Update your
 * notes?"; and the interface language. Pickers you type into to search (the
 * callout, colour, icon-source and skin-tone pickers) are `ListboxPopup`s
 * instead, because a menu cannot hold a search field.
 *
 * The main idea. Two halves, each borrowed from Obsidian:
 *
 * - The field is a real `<button>` drawn like Obsidian's dropdown (the shared
 *   `.cs-dropdown-control` rules in styles.css). It shows the current option's
 *   words and a ⇕ caret.
 * - The list is a real Obsidian `Menu`, opened under the field. So it looks,
 *   moves and answers the keyboard exactly as every other Obsidian menu does:
 *   a ✓ marks the current choice, an option can carry an icon, and on a phone
 *   it rises as Obsidian's bottom sheet. Niv decided on 2026-10-22 that every
 *   menu in the plugin should look the same as Obsidian's.
 *
 * Who calls it. The modules above create one with `new SelectDropdown(parent,
 * name)`, fill it with `addOption`/`setOptions`, and listen with `onChange`.
 * The methods return `this`, so the calls can be chained.
 */
import { Menu } from "obsidian";
import { appendDropdownCaret } from "./dropdownControl";
import { setFieldAccessibleName } from "./fieldAccessibleName";

/** One choice in the menu. */
export interface SelectOption {
	/** What `onChange` reports and `setValue` accepts. Never shown. */
	value: string;
	/** The words shown for this option, in the field and in the menu. */
	label: string;
	/**
	 * A Lucide icon id drawn before the words in the menu, such as
	 * `"heading-1"`. A menu draws icons only when every option has one: a
	 * column of icons with gaps in it reads as a mistake.
	 */
	icon?: string;
}

/**
 * Gives every value element its own id, so the field's accessible name can
 * point at it. A plain counter is enough: the ids only need to be unique
 * within the page.
 */
let valueIdSequence = 0;

export class SelectDropdown {
	/** The outer element. Callers add their own layout classes to it. */
	readonly el: HTMLElement;
	/** The field itself: the one element that takes focus and clicks. */
	readonly buttonEl: HTMLButtonElement;
	/** The current option's words, inside the field. */
	private readonly valueEl: HTMLElement;
	/**
	 * A hidden copy of every option's words, stacked in one grid cell. The
	 * widest one sets the field's width, so the field does not change size
	 * when the value does. (The menu itself sizes to its longest option, as
	 * Obsidian's menus do.)
	 */
	private readonly widthSizer: HTMLElement;

	private options: SelectOption[] = [];
	private value = "";
	/** Called when the user picks a different option. */
	private change?: (value: string) => void;
	/** Called when the user picks any option, the current one included. */
	private pick?: (value: string) => void;
	/** The menu while it is open, or `null` while it is closed. */
	private menu: Menu | null = null;
	private disabled = false;
	private destroyed = false;

	/**
	 * @param parent Where the field is added, usually a setting's control area.
	 * @param accessibleName What a screen reader calls the field, such as
	 *   "Callout format". It is not shown: the setting's own name is beside it.
	 */
	constructor(parent: HTMLElement, accessibleName: string) {
		this.el = parent.createDiv({ cls: "cs-select-dropdown" });
		this.buttonEl = this.el.createEl("button", {
			cls: "cs-select-button cs-dropdown-control",
			attr: { type: "button", "aria-haspopup": "menu", "aria-expanded": "false" },
		});
		this.valueEl = this.buttonEl.createSpan({
			cls: "cs-select-value",
			attr: { id: `cs-select-value-${valueIdSequence++}` },
		});
		appendDropdownCaret(this.buttonEl);
		this.widthSizer = this.el.createDiv({
			cls: "cs-dropdown-width-sizer",
			attr: { "aria-hidden": "true" },
		});

		// The name goes through a hidden label rather than `aria-label`, which
		// Obsidian would also show as a tooltip. The value is added to the same
		// name, so a screen reader says "Callout format, Block" — a button has
		// no value of its own to announce.
		setFieldAccessibleName(this.buttonEl, accessibleName);
		const labelId = this.buttonEl.getAttribute("aria-labelledby") ?? "";
		this.buttonEl.setAttribute("aria-labelledby", `${labelId} ${this.valueEl.id}`.trim());

		this.buttonEl.addEventListener("click", () => this.toggleMenu());
		this.buttonEl.addEventListener("keydown", (event) => this.onKeyDown(event));
	}

	/** Add one option at the end, or relabel the option that has this value. */
	addOption(value: string, label: string, icon?: string): this {
		const others = this.options.filter((option) => option.value !== value);
		return this.setOptions([...others, { value, label, icon }]);
	}

	/** Add several options at once, from `{ value: label }`. */
	addOptions(options: Readonly<Record<string, string>>): this {
		for (const [value, label] of Object.entries(options)) this.addOption(value, label);
		return this;
	}

	/**
	 * Replace every option. The current value is kept when it is still among
	 * them; otherwise the first option becomes the value. Neither case calls
	 * `onChange`, because the user did not choose anything.
	 */
	setOptions(options: readonly SelectOption[]): this {
		// An open menu keeps the options it was built with, so it would now
		// offer stale ones. Close it; the next click builds a fresh one.
		this.close();
		// `{ ...option }` copies each option, so a caller changing its array
		// afterwards cannot change this dropdown behind its back.
		this.options = options.map((option) => ({ ...option }));
		this.widthSizer.empty();
		for (const option of this.options) this.widthSizer.createSpan({ text: option.label });
		const keep = this.options.some((option) => option.value === this.value);
		return this.setValue(keep ? this.value : this.options[0]?.value ?? "");
	}

	/** Show `value` as chosen, without calling `onChange`. */
	setValue(value: string): this {
		const option = this.options.find((candidate) => candidate.value === value);
		this.value = option ? option.value : "";
		this.valueEl.setText(option?.label ?? "");
		return this;
	}

	getValue(): string {
		return this.value;
	}

	/** Grey the field out and close its menu, or bring it back. */
	setDisabled(disabled: boolean): this {
		// `||=` keeps a destroyed dropdown disabled: once it is gone, nothing
		// may reopen it.
		disabled ||= this.destroyed;
		this.disabled = disabled;
		this.buttonEl.disabled = disabled;
		this.buttonEl.toggleClass("cs-dropdown-disabled", disabled);
		if (disabled) this.close();
		return this;
	}

	/** Listen for the user picking a different option. */
	onChange(callback: (value: string) => void): this {
		this.change = callback;
		return this;
	}

	/**
	 * Listen for every pick, the current option included. For the rare caller
	 * for whom choosing the same thing again means something — the language
	 * picker retries a download that way.
	 */
	onPick(callback: (value: string) => void): this {
		this.pick = callback;
		return this;
	}

	/** Close the menu if it is open. */
	close(): void {
		this.menu?.hide();
	}

	/** Close the menu for good, when the window or section that owns it closes. */
	destroy(): void {
		this.destroyed = true;
		this.setDisabled(true);
	}

	/** A click on the field opens the menu, and a second click closes it. */
	private toggleMenu(): void {
		if (this.menu) this.close();
		else this.openMenu();
	}

	/**
	 * ↓ and ↑ open the menu as well, as on Obsidian's own dropdowns. (Enter and
	 * Space need nothing here: on a `<button>` they already fire `click`.) While
	 * the menu is open, Obsidian's menu owns the arrow keys, so they are left
	 * alone here.
	 */
	private onKeyDown(event: KeyboardEvent): void {
		if (this.menu || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
		event.preventDefault();
		this.openMenu();
	}

	/** Build Obsidian's menu from the options and show it under the field. */
	private openMenu(): void {
		if (this.disabled || this.options.length === 0) return;

		const menu = new Menu();
		// A menu drawn by the page rather than by the operating system: only
		// that kind can show icons, and it is the kind every Obsidian menu uses
		// on a phone anyway.
		menu.setUseNativeMenu(false);
		// Without icons, Obsidian keeps an empty icon slot before every title;
		// `setNoIcon` removes it, so the words start at the row's edge.
		const everyOptionHasIcon = this.options.every((option) => option.icon !== undefined);
		if (!everyOptionHasIcon) menu.setNoIcon();
		for (const option of this.options) {
			menu.addItem((item) => {
				item.setTitle(option.label)
					.setChecked(option.value === this.value)
					.onClick(() => this.choose(option.value));
				if (everyOptionHasIcon && option.icon) item.setIcon(option.icon);
			});
		}
		// Ties the menu to the field: Obsidian marks the field with
		// `has-active-menu` while the menu is open, ignores a press on the field
		// as a "click outside", and closes the menu if the field disappears.
		menu.setParentElement(this.buttonEl);

		const hadFocus = this.buttonEl.ownerDocument.activeElement === this.buttonEl;
		menu.onHide(() => {
			this.menu = null;
			this.buttonEl.removeClass("is-open");
			this.buttonEl.setAttribute("aria-expanded", "false");
			// A click on a menu row can leave focus on nothing at all. Give it
			// back to the field, so the keyboard carries on from where it was.
			const active = this.buttonEl.ownerDocument.activeElement;
			const focusLost = active === null || active === this.buttonEl.ownerDocument.body;
			if (hadFocus && focusLost && !this.destroyed) this.buttonEl.focus({ preventScroll: true });
		});

		this.menu = menu;
		this.buttonEl.addClass("is-open");
		this.buttonEl.setAttribute("aria-expanded", "true");

		// Under the field, as wide as it, as Obsidian opens its own menus under
		// a button. `left` asks for the menu's end to line up with the field's
		// end, which is the natural side in a right-to-left window.
		// (`?.` after `getComputedStyle` calls it only if the window has it,
		// which a test's stand-in window may not.)
		const rect = this.buttonEl.getBoundingClientRect();
		const view = this.buttonEl.ownerDocument.defaultView;
		const rightToLeft = view?.getComputedStyle?.(this.buttonEl).direction === "rtl";
		menu.showAtPosition(
			{ x: rect.x, y: rect.bottom, width: rect.width, overlap: true, left: rightToLeft },
			this.buttonEl.ownerDocument,
		);
	}

	/** The user picked `value` in the menu. */
	private choose(value: string): void {
		// Ignore a pick of an option that is no longer offered (the options
		// changed under a menu that was still closing).
		if (this.destroyed || !this.options.some((option) => option.value === value)) return;
		this.pick?.(value);
		if (value === this.value) return;
		this.setValue(value);
		this.change?.(value);
	}
}
