/** Keyboard behavior shared by searchable and select-only popup controls. */
import type { PopupEventTarget } from "./listboxPopupEvents";

const TYPEAHEAD_TIMEOUT = 700;
const PAGE_ROWS = 10;

/** Each popup owns its buffer; elapsed time resets it without a timer to clean up. */
export function createPopupKeyHandler(popup: PopupEventTarget): (ev: KeyboardEvent) => void {
	let typed = "";
	let lastTypedAt = 0;
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
		if (popup.inputEl.disabled || ev.isComposing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
		const selectOnly = !popup.searchable();
		if (selectOnly && ev.key !== " " && Array.from(ev.key).length === 1) {
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
		} else if (ev.key === "Enter" || (selectOnly && ev.key === " ")) {
			if (!popup.isOpen()) popup.open();
			else popup.commitActive();
		} else if (selectOnly && (ev.key === "Home" || ev.key === "End")) {
			popup.open();
			popup.moveActive(ev.key === "Home" ? -Infinity : Infinity);
		} else if (selectOnly && (ev.key === "PageDown" || ev.key === "PageUp")) {
			popup.open();
			popup.moveActive(ev.key === "PageDown" ? PAGE_ROWS : -PAGE_ROWS);
		} else {
			return;
		}
		ev.preventDefault();
		ev.stopPropagation();
	};
}
