import { setIcon } from "obsidian";

/** Decoration only: the selection control remains the sole focus and click target. */
export function appendDropdownCaret(parent: HTMLElement): void {
	const caret = parent.createSpan({
		cls: "cs-dropdown-caret",
		attr: { "aria-hidden": "true" },
	});
	setIcon(caret, "chevrons-up-down");
}
