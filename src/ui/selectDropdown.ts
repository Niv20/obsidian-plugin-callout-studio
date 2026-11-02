/**
 * ui/selectDropdown.ts — a plain choice: a field that shows the current value
 * and opens Obsidian's own menu of the options under it.
 *
 * What it is for. Every "pick one of a few" control in the plugin: a custom
 * command's format, heading level, action and fold state; a palette's
 * background style; the Find callouts format filter; Quick insert's source;
 * the icon picker's style and category filters; the id picker in "Update your
 * notes?"; the callout editor's fold state; and the interface language.
 * Pickers you type into to search (the callout, colour, icon-source and
 * skin-tone pickers) are `ListboxPopup`s instead, because a menu cannot hold a
 * search field.
 *
 * The main idea. Both halves are Obsidian's:
 *
 * - The field is Obsidian's dropdown (`DropdownField`: a `div` wearing app.css's
 *   `.dropdown`), so Obsidian draws it in every state. It is as wide as the
 *   current option's words, as Obsidian's own `<select>` is. (Given an `icon`,
 *   it is an icon button instead: no chevron, and the icon stands before the
 *   words when `showValue` is set, or alone, with the name as its tooltip, when
 *   it is not. The caller dresses it, as the settings page's footer does for
 *   the language.)
 * - The list is a real Obsidian `Menu`, opened under the field. So it looks,
 *   moves and answers the keyboard exactly as every other Obsidian menu does:
 *   a ✓ marks the current choice, an option can carry an icon, and on a phone
 *   it rises as Obsidian's bottom sheet. Niv decided on 2026-10-22 that every
 *   menu in the plugin should look the same as Obsidian's. A long one (the
 *   languages) is made to scroll with the wheel instead of by the mouse's
 *   position, as Obsidian's own does on a computer (ui/menuScroll.ts).
 *
 * Who calls it. The modules above create one with `new SelectDropdown(parent,
 * name)`, fill it with `addOption`/`setOptions`, and listen with `onChange`.
 * The methods return `this`, so the calls can be chained.
 */
import { Menu, setIcon, setTooltip } from "obsidian";
import { DropdownField } from "./dropdownField";
import { setFieldAccessibleName } from "./fieldAccessibleName";
import { closeOnAnchorScroll } from "./menuAnchorScroll";
import { findOpenMenu, scrollMenuWithWheel } from "./menuScroll";

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

/** How the field is drawn. */
export interface SelectDropdownOptions {
	/**
	 * A Lucide icon id. The field is then an icon button with no caret. Alone,
	 * it shows no words, and the accessible name is also its hover tooltip; the
	 * words stay in the page, hidden, so a screen reader still says the current
	 * choice.
	 */
	icon?: string;
	/**
	 * With an `icon`: show the current choice's words beside the icon, and no
	 * tooltip, because the words are the name. Ignored without an `icon`.
	 */
	showValue?: boolean;
}

/**
 * Gives every value element of an icon button its own id, so the button's
 * accessible name can point at it. (A field's ids come from `DropdownField`.)
 */
let valueIdSequence = 0;

export class SelectDropdown {
	/**
	 * The outer element. Callers add their own layout classes to it. For a
	 * field this is the field itself; an icon button sits in a wrapper.
	 */
	readonly el: HTMLElement;
	/** The one element that takes focus and clicks: the field, or the icon button. */
	readonly controlEl: HTMLElement;
	/** The current option's words, inside the control. */
	private readonly valueEl: HTMLElement;
	/** The field, or `null` for an icon button. */
	private readonly field: DropdownField | null;

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
	 *   (An icon button shows it as its tooltip.)
	 */
	constructor(parent: HTMLElement, accessibleName: string, options: SelectDropdownOptions = {}) {
		if (options.icon === undefined) {
			this.field = new DropdownField(parent, { accessibleName, popup: "menu" });
			this.el = this.controlEl = this.field.el;
			this.el.addClass("cs-select-dropdown");
			this.valueEl = this.field.labelEl;
		} else {
			this.field = null;
			// An icon button hides the words unless it is asked to show them.
			const hidesValue = !options.showValue;
			this.el = parent.createDiv({ cls: "cs-select-dropdown" });
			const button = this.el.createEl("button", {
				cls: "cs-select-button",
				attr: { type: "button", "aria-haspopup": "menu", "aria-expanded": "false" },
			});
			this.controlEl = button;
			// `setIcon` empties what it draws into, so the icon gets a span of its own.
			setIcon(button.createSpan({ cls: "cs-select-icon" }), options.icon);
			this.valueEl = button.createSpan({
				cls: hidesValue ? "cs-select-value cs-visually-hidden" : "cs-select-value",
				attr: { id: `cs-select-value-${valueIdSequence++}` },
			});
			// The same naming as the field's (ui/dropdownField.ts): a hidden label
			// and the value, so a screen reader says "Language, English".
			setFieldAccessibleName(button, accessibleName);
			const labelId = button.getAttribute("aria-labelledby") ?? "";
			button.setAttribute("aria-labelledby", `${labelId} ${this.valueEl.id}`.trim());
			// An icon alone has no words to read, so its name is what hovering shows.
			if (hidesValue) setTooltip(button, accessibleName);
		}

		this.controlEl.addEventListener("click", () => this.toggleMenu());
		this.controlEl.addEventListener("keydown", (event) => this.onKeyDown(event));
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
		const keep = this.options.some((option) => option.value === this.value);
		return this.setValue(keep ? this.value : (this.options[0]?.value ?? ""));
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
		if (this.field) this.field.setDisabled(disabled);
		else (this.controlEl as HTMLButtonElement).disabled = disabled;
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
	 * The keys that open the menu, as on Obsidian's own dropdowns: Enter,
	 * Space, ↓ and ↑. (An icon button is a `<button>`, where Enter and Space
	 * already fire `click`, so it needs only the arrows.) While the menu is
	 * open, Obsidian's menu owns the keys, so they are left alone here.
	 */
	private onKeyDown(event: KeyboardEvent): void {
		if (this.menu || this.disabled) return;
		const opens = this.field
			? DropdownField.isOpenKey(event)
			: event.key === "ArrowDown" || event.key === "ArrowUp";
		if (!opens) return;
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
		menu.setParentElement(this.controlEl);

		const control = this.controlEl;
		const hadFocus = control.ownerDocument.activeElement === control;
		let stopWatchingScroll: (() => void) | undefined;
		menu.onHide(() => {
			stopWatchingScroll?.();
			this.menu = null;
			this.setOpen(false);
			// A click on a menu row can leave focus on nothing at all. Give it
			// back to the field, so the keyboard carries on from where it was.
			const active = control.ownerDocument.activeElement;
			const focusLost = active === null || active === control.ownerDocument.body;
			if (hadFocus && focusLost && !this.destroyed) control.focus({ preventScroll: true });
		});

		this.menu = menu;
		this.setOpen(true);

		// Under the field, as wide as it, as Obsidian opens its own menus under
		// a button. `left` asks for the menu's end to line up with the field's
		// end, which is the natural side in a right-to-left window.
		// (`?.` after `getComputedStyle` calls it only if the window has it,
		// which a test's stand-in window may not.)
		const rect = control.getBoundingClientRect();
		const view = control.ownerDocument.defaultView;
		const rightToLeft = view?.getComputedStyle?.(control).direction === "rtl";
		menu.showAtPosition(
			{ x: rect.x, y: rect.bottom, width: rect.width, overlap: true, left: rightToLeft },
			control.ownerDocument,
		);

		// A long list (the languages) scrolls with the wheel rather than by where
		// the mouse is, and opens on the current choice (ui/menuScroll.ts).
		const menuEl = findOpenMenu(control.ownerDocument);
		if (menuEl)
			scrollMenuWithWheel(
				menuEl,
				this.options.findIndex((option) => option.value === this.value),
			);

		// The menu is placed once, so it must not outlive a scroll of the page
		// behind it (ui/menuAnchorScroll.ts). Read after the menu is shown, so a
		// scroll the opening itself causes is not mistaken for the user's.
		stopWatchingScroll = closeOnAnchorScroll(control, () => this.close());
	}

	/**
	 * Say whether the menu is open. The field shows nothing for it, as
	 * Obsidian's `<select>` shows nothing; an icon button keeps its ring while
	 * its menu is open (`.cs-footer-tile.is-open` in styles.css).
	 */
	private setOpen(open: boolean): void {
		if (this.field) {
			this.field.setExpanded(open);
			return;
		}
		this.controlEl.toggleClass("is-open", open);
		this.controlEl.setAttribute("aria-expanded", String(open));
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
