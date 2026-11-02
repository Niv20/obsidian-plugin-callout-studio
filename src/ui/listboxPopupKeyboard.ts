/**
 * Keyboard behavior of a picker: on its field, and in its search box.
 *
 * A searchable picker is driven from its search box once it is open; its field
 * only opens it (Enter, Space, ↓, ↑, or a letter, which also starts the
 * search, as in Obsidian's combobox). A select-only picker has no search box,
 * so its field does everything, as a `<select>` does.
 */
import { DropdownField } from "./dropdownField";
import type { PopupEventTarget } from "./listboxPopupEvents";

const TYPEAHEAD_TIMEOUT = 700;
const PAGE_ROWS = 10;

/** One character a user typed, rather than a key that does something. */
function isPrintable(key: string): boolean {
	return key !== " " && Array.from(key).length === 1;
}

/** Keys on the field. Each popup owns its typeahead buffer. */
export function createFieldKeyHandler(popup: PopupEventTarget): (ev: KeyboardEvent) => void {
	const selectOnly = createSelectOnlyKeyHandler(popup);
	return (ev) => {
		if (popup.isDisabled() || ev.isComposing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
		if (!popup.inputEl) {
			selectOnly(ev);
			return;
		}
		// Open, the search box has the keys.
		if (popup.isOpen()) return;
		if (DropdownField.isOpenKey(ev)) popup.open();
		else if (isPrintable(ev.key)) {
			popup.open();
			popup.seedQuery(ev.key);
		} else return;
		ev.preventDefault();
		ev.stopPropagation();
	};
}

/** Keys in a searchable picker's search box. Everything else edits the text. */
export function createSearchKeyHandler(popup: PopupEventTarget): (ev: KeyboardEvent) => void {
	return (ev) => {
		if (ev.isComposing) return;
		if (ev.key === "Tab") {
			// As Obsidian's combobox does: the focus goes back to the field, and
			// the browser's own Tab then moves on from there. Never commits.
			popup.dismiss();
			return;
		}
		if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
		if (ev.key === "Escape") popup.dismiss();
		else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") popup.moveActive(ev.key === "ArrowDown" ? 1 : -1);
		else if (ev.key === "Enter") popup.commitActive();
		else return;
		ev.preventDefault();
		ev.stopPropagation();
	};
}

/** A select-only picker's field, which works like a `<select>`. */
function createSelectOnlyKeyHandler(popup: PopupEventTarget): (ev: KeyboardEvent) => void {
	let typed = "";
	let lastTypedAt = 0;
	// Elapsed time resets the buffer, so there is no timer to clean up.
	const typeAhead = (key: string): void => {
		const now = Date.now();
		if (!popup.isOpen() || now - lastTypedAt > TYPEAHEAD_TIMEOUT) typed = "";
		lastTypedAt = now;
		typed += key.toLocaleLowerCase();
		popup.open();
		const letters = Array.from(typed);
		const cycling = letters.every((letter) => letter === letters[0]);
		const query = cycling ? letters[0]! : typed;
		if (cycling) typed = query;
		const labels = popup.labels();
		const active = popup.activeIndex();
		// A new letter cycles from the next row; a longer prefix can refine the
		// current match. Both searches wrap once and never change the selection.
		const start = Math.max(0, active + (cycling ? 1 : 0));
		for (let offset = 0; offset < labels.length; offset++) {
			const index = (start + offset) % labels.length;
			if (labels[index]!.trim().toLocaleLowerCase().startsWith(query)) {
				popup.moveActive(index - active);
				break;
			}
		}
	};

	return (ev) => {
		if (isPrintable(ev.key)) {
			ev.preventDefault();
			ev.stopPropagation();
			typeAhead(ev.key);
			return;
		}
		typed = "";
		if (ev.key === "Tab") {
			if (popup.isOpen()) {
				popup.close();
				ev.stopPropagation();
			}
			return; // Keep the browser's normal focus movement; never commit.
		}
		if (ev.key === "Escape") {
			if (!popup.isOpen()) return; // The next Escape belongs to the modal.
			popup.close();
		} else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
			if (!popup.isOpen()) popup.open();
			else popup.moveActive(ev.key === "ArrowDown" ? 1 : -1);
		} else if (ev.key === "Enter" || ev.key === " ") {
			if (!popup.isOpen()) popup.open();
			else popup.commitActive();
		} else if (ev.key === "Home" || ev.key === "End") {
			popup.open();
			popup.moveActive(ev.key === "Home" ? -Infinity : Infinity);
		} else if (ev.key === "PageDown" || ev.key === "PageUp") {
			popup.open();
			popup.moveActive(ev.key === "PageDown" ? PAGE_ROWS : -PAGE_ROWS);
		} else {
			return;
		}
		ev.preventDefault();
		ev.stopPropagation();
	};
}
