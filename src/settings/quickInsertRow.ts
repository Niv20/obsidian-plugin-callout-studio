/**
 * settings/quickInsertRow.ts — one row of the quick-insert window.
 *
 * Split from `QuickInsertModal` on the same line `CalloutRowRenderer` is split
 * from `CalloutListsSection`: the window owns the state — what is searched, what
 * is filtered, what the arrow keys are pointing at — and this owns what a single
 * callout looks like while that is going on.
 *
 * **The row is a real rendered callout with the controls beside it, never
 * inside it.** Buttons within the callout box would read as its content — as
 * something that would be inserted — so the row is a flex line: the preview
 * (see `quickInsertPreview.ts`) takes the space, the two actions sit outside it
 * and never shrink. Nothing here describes how a callout looks; if it did,
 * there would be a second appearance to keep in step with the first.
 */
import { setIcon } from "obsidian";
import { t } from "../i18n";
import type { CalloutDefinition } from "../types";

export interface QuickInsertRowHandlers {
	/** The rendered callout for this definition, if one is ready yet. */
	preview: (def: CalloutDefinition) => HTMLElement | null;
	onEdit: (def: CalloutDefinition) => void;
	onInsert: (def: CalloutDefinition) => void;
	onHover: (el: HTMLElement | null) => void;
	/** Whether an editor is available to insert into, for the button's state. */
	canInsert: boolean;
}

/** Draw `def` as a row inside `listEl` and return the row element. */
export function renderQuickInsertRow(
	listEl: HTMLElement,
	def: CalloutDefinition,
	handlers: QuickInsertRowHandlers,
): HTMLElement {
	const row = listEl.createDiv({ cls: "cs-qi-row" });
	const name = def.displayName;
	// Nothing on the row carries a `title`. It drew the OS tooltip, which is
	// inherited by every descendant — so the `[!id]` list set here appeared
	// beside the Insert button's own label, in a second style, on a second
	// delay. `aria-label` on the two buttons is the only hover text left.

	const slot = row.createDiv({ cls: "cs-qi-slot" });
	const preview = handlers.preview(def);
	if (preview) {
		slot.appendChild(preview);
	} else {
		// Only reachable for a callout created while the window is open, in the
		// frame before its render lands. The name keeps the row identifiable and
		// the height stable rather than letting the list jump when it arrives.
		slot.createDiv({ cls: "cs-qi-pending", text: name });
	}

	const buttonsEl = row.createDiv({ cls: "callout-studio-row-buttons" });

	const editBtn = buttonsEl.createEl("button", {
		attr: { "aria-label": t("quickInsert.editAria", { name }) },
	});
	setIcon(editBtn, "pencil");
	editBtn.addEventListener("click", () => handlers.onEdit(def));

	const insertBtn = buttonsEl.createEl("button", {
		attr: { "aria-label": t("quickInsert.insertAria", { name }) },
	});
	setIcon(insertBtn, "between-horizontal-start");
	// Dimmed but still clickable, the same bargain the editor's Save button
	// strikes: a disabled button cannot say why it is disabled.
	insertBtn.toggleClass("cs-btn-disabled", !handlers.canInsert);
	insertBtn.setAttribute("aria-disabled", String(!handlers.canInsert));
	insertBtn.addEventListener("click", () => handlers.onInsert(def));

	// Clicking the preview inserts it — the row is a picker, and the thing the
	// pointer is already on is the thing being picked. The buttons keep their
	// own meaning: a click that landed on one is that button's, not the row's.
	// This is a pointer affordance only; the keyboard uses the arrows and Enter,
	// and the two buttons remain the labelled controls.
	row.addEventListener("click", (ev) => {
		if ((ev.target as HTMLElement).closest("button")) return;
		handlers.onInsert(def);
	});

	// The pointer and the keyboard share one highlight rather than showing two
	// at once.
	row.addEventListener("mouseenter", () => handlers.onHover(row));
	row.addEventListener("mouseleave", () => handlers.onHover(null));
	return row;
}
