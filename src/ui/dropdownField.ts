/**
 * ui/dropdownField.ts — the field of every dropdown and picker: Obsidian's own
 * dropdown, worn by a `div`.
 *
 * What it is for. A plain choice (`SelectDropdown`) and a picker
 * (`ListboxPopup`) both show their current value in this field. It is the one
 * element that takes focus and clicks; what opens under it is the caller's.
 *
 * The main idea. Obsidian draws its dropdown with one class, `dropdown`, on a
 * `<select>`: the face, the ⇕ chevron (a background image), the round badge
 * behind it in the macOS settings window, the padding that leaves the chevron
 * its room, the hover face, the focus ring and the dimmed disabled state all
 * come from app.css, read from `--dropdown-*` and `--interactive-*`. This field
 * wears that class and draws none of it itself, so it matches Obsidian, and
 * the active theme, in every state and on every platform. (Until 2026-11-01 a
 * block in styles.css copied those rules by hand, and the copy had drifted: a
 * smaller badge, other padding, a ring left behind by a mouse click.)
 *
 * Why a `div`. Obsidian's `<select>` opens the operating system's list, which
 * cannot hold icons or a search box. A `<button>` cannot wear the class:
 * Obsidian's `button`, `button:not(.clickable-icon)` and `button:hover` rules
 * outrank `.dropdown` and repaint the face and the padding. Obsidian's own
 * combobox (Bases, the file pickers in Settings) is a `div` for the same reason.
 *
 * Two behaviours are copied from Obsidian's `DropdownComponent`, because
 * app.css reads them:
 * - `mouse-focus` while a mouse press gave the field its focus, so no ring is
 *   drawn after a click; Tab still draws it.
 * - `mod-disabled`: app.css dims the field to half and drops its hover face.
 */
import { setFieldAccessibleName } from "./fieldAccessibleName";

export interface DropdownFieldOptions {
	/**
	 * What a screen reader calls the field, such as "Callout format". It is not
	 * shown: the setting's own name is beside it.
	 */
	accessibleName: string;
	/** What the field opens: Obsidian's menu, or a picker's list. */
	popup: "menu" | "listbox";
}

/** Gives every label its own id, so the field's accessible name can point at it. */
let labelIdSequence = 0;

export class DropdownField {
	/** `div.dropdown`: the one element that takes focus and clicks. */
	readonly el: HTMLElement;
	/**
	 * The slot before the words, for a picker's icon or swatch. CSS hides it
	 * while it is empty, so a field without one has no gap before its words.
	 */
	readonly iconEl: HTMLElement;
	/** The current choice's words. */
	readonly labelEl: HTMLElement;
	private disabled = false;

	constructor(parent: HTMLElement, options: DropdownFieldOptions) {
		this.el = parent.createDiv({
			cls: "dropdown cs-dropdown-field",
			attr: {
				tabindex: "0",
				role: "button",
				"aria-haspopup": options.popup,
				"aria-expanded": "false",
			},
		});
		this.iconEl = this.el.createSpan({ cls: "cs-dropdown-field-icon", attr: { "aria-hidden": "true" } });
		this.labelEl = this.el.createSpan({
			cls: "cs-dropdown-field-label",
			attr: { id: `cs-dropdown-value-${labelIdSequence++}` },
		});

		// The name goes through a hidden label rather than `aria-label`, which
		// Obsidian would also show as a tooltip. The value joins the same name,
		// so a screen reader says "Callout format, Block".
		setFieldAccessibleName(this.el, options.accessibleName);
		const nameId = this.el.getAttribute("aria-labelledby") ?? "";
		this.el.setAttribute("aria-labelledby", `${nameId} ${this.labelEl.id}`.trim());

		// Obsidian's `DropdownComponent` does exactly this.
		this.el.addEventListener("mousedown", () => this.el.addClass("mouse-focus"));
		this.el.addEventListener("blur", () => this.el.removeClass("mouse-focus"));
	}

	/** Show `text` as the current choice. */
	setText(text: string): void {
		this.labelEl.setText(text);
	}

	/** Tell a screen reader whether the field's list is open. */
	setExpanded(open: boolean): void {
		this.el.setAttribute("aria-expanded", String(open));
	}

	/** Grey the field out and take it out of the Tab order, or bring it back. */
	setDisabled(disabled: boolean): void {
		this.disabled = disabled;
		this.el.toggleClass("mod-disabled", disabled);
		this.el.setAttribute("tabindex", disabled ? "-1" : "0");
		if (disabled) this.el.setAttribute("aria-disabled", "true");
		else this.el.removeAttribute("aria-disabled");
	}

	isDisabled(): boolean {
		return this.disabled;
	}

	/**
	 * Give the field the focus. `byPointer` when a mouse press put it there
	 * (a click on a picker's row moves the focus back from the search box):
	 * the browser would otherwise draw the keyboard's ring, as the focus comes
	 * from a text box, and Obsidian draws none after a mouse press.
	 */
	focus(byPointer = false): void {
		if (byPointer) this.el.addClass("mouse-focus");
		this.el.focus({ preventScroll: true });
	}

	/** Enter, Space, ↓ and ↑ open a closed field, as they open Obsidian's `<select>`. */
	static isOpenKey(event: KeyboardEvent): boolean {
		return event.key === "Enter" || event.key === " " || event.key === "ArrowDown" || event.key === "ArrowUp";
	}
}
