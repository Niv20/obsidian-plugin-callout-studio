/**
 * settings/optionBox.ts — the answer card two kinds of window draw: the plugin
 * import window's two cards, and the answers of both "Update your notes?"
 * questions.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │ ( )  ▣  Title  (Recommended)          [ Upload… ] │
 *   │         One line on what this option holds.       │
 *   └──────────────────────────────────────────────────┘
 *
 * Who calls it. pluginImport/pluginImportViews.ts and settings/noteQuestion.ts
 * (the latter for NoteChangesModal and PaletteNotesModal).
 *
 * The main idea (findings S9-10 and S6-V2). A card is drawn like the radio
 * cards Obsidian asks with when you set up a vault on a phone: an outline, the
 * chosen card's outline in the accent colour, no fill and no hover. Its radio
 * is Obsidian's own round one (`input[type=radio]`) at the start of the card,
 * and the radios of one window share a `name`, so the group is one Tab stop and
 * the arrow keys move the choice, as in any radio group. A click anywhere on
 * the card chooses it too — except on a control of the card's own (a button, a
 * text box), which does what it says instead. Until 2026-10-24 a card was a
 * raised grey pill with an accent wash when chosen, and its "radio" was a
 * hand-made dot with a check mark at the far end.
 *
 * {@link renderOptionBox} draws the card alone (no role, no focus stop, no
 * listeners); {@link addOptionRadio} makes it one answer of a group;
 * {@link paintOptionRadio} shows which answer is chosen. Import's source
 * chooser and Export's format chooser drew their choices on this card too,
 * until 2026-10-24; they are rows of Obsidian's setting groups now
 * (settings/choiceRow.ts).
 */
import { setIcon } from "obsidian";
import { renderRecommendedBadge } from "./recommendedBadge";

let nextId = 0;

/** A document-unique id, for aria-labelledby and aria-describedby. */
export function optionBoxId(name: string): string {
	nextId += 1;
	return `callout-studio-option-${name}-${nextId}`;
}

export interface OptionBoxSpec {
	/** The tile at the leading edge. Left out, the box starts with its title. */
	icon?: string;
	title: string;
	desc: string;
	/** The grey Recommended pill on the title line. */
	recommended?: boolean;
}

export interface OptionBox {
	/** The box itself. */
	el: HTMLElement;
	/** Its title, for a window that rewrites it in place. */
	titleEl: HTMLElement;
	/** Its status line, likewise. */
	descEl: HTMLElement;
	/** Its title line and status line, as an `aria-describedby` value. */
	describedBy: string;
}

/** The column the boxes stack in; spacing is its gap, not each box's margin. */
export function renderOptionList(parent: HTMLElement): HTMLElement {
	return parent.createDiv({ cls: "cs-option-list" });
}

export function renderOptionBox(parent: HTMLElement, spec: OptionBoxSpec): OptionBox {
	const headId = optionBoxId("title");
	const descId = optionBoxId("status");
	const el = parent.createDiv({ cls: "cs-option-box" });
	if (spec.icon) setIcon(el.createDiv({ cls: "cs-option-box-icon" }), spec.icon);

	const text = el.createDiv({ cls: "cs-option-box-text" });
	const head = text.createDiv({ cls: "cs-option-box-head", attr: { id: headId } });
	const titleEl = head.createSpan({ cls: "cs-option-box-title", text: spec.title });
	if (spec.recommended) renderRecommendedBadge(head);
	const descEl = text.createDiv({
		cls: "cs-option-box-desc",
		text: spec.desc,
		attr: { id: descId },
	});

	return { el, titleEl, descEl, describedBy: `${headId} ${descId}` };
}

/** What each radio was last painted as, so a refused choice can be put back. */
const paintedChosen = new WeakMap<HTMLInputElement, boolean>();

/**
 * Make a card one answer of a radio group: Obsidian's own round radio at its
 * leading edge, unchecked until the window paints its card chosen.
 *
 * @param box The card.
 * @param group The `name` every radio of this window shares; it is what makes
 *   them one group (one Tab stop, arrow keys between them).
 * @param onChoose What choosing this answer does. The window either takes the
 *   choice and repaints every card ({@link paintOptionRadio}) before it
 *   returns, or refuses it (an empty card) and repaints nothing.
 * @param exempt A selector for the card's own controls: a click on one of them
 *   does what that control says instead of choosing. Left out, every click on
 *   the card chooses it, a click into its picker included.
 * @returns The radio.
 */
export function addOptionRadio(box: OptionBox, group: string, onChoose: () => void, exempt?: string): HTMLInputElement {
	const [headId, descId] = box.describedBy.split(" ");
	const radio = createEl("input", {
		cls: "cs-option-radio",
		type: "radio",
		attr: {
			name: group,
			// Named by the card's title line and described by its status line.
			// Never an `aria-label`, which Obsidian would pop up as a tooltip.
			"aria-labelledby": headId ?? "",
			"aria-describedby": descId ?? "",
		},
	});
	// First in the card, before its icon and text, as Obsidian puts a radio.
	box.el.insertBefore(radio, box.el.firstChild);

	// A click on the radio, Space on it, or an arrow key moving the choice
	// onto it: the browser has already checked it when `change` arrives.
	radio.addEventListener("change", () => {
		if (!radio.checked) return;
		onChoose();
		putBackRefusedChoice(radio);
	});
	box.el.addEventListener("click", (evt) => {
		const target = evt.target as Element | null;
		// The radio's own click becomes its `change`, above.
		if (target === radio) return;
		if (exempt && target?.closest(exempt)) return;
		onChoose();
	});
	return radio;
}

/**
 * Put every radio of `radio`'s group back to what it was last painted as. A
 * window that took the choice has just repainted them, so this changes
 * nothing; one that refused it has not, and the browser's check would
 * otherwise stay on the answer that was not taken.
 */
function putBackRefusedChoice(radio: HTMLInputElement): void {
	const list = radio.closest(".cs-option-list") ?? radio.parentElement;
	if (!list) return;
	for (const other of Array.from(list.querySelectorAll<HTMLInputElement>("input.cs-option-radio"))) {
		other.checked = paintedChosen.get(other) ?? false;
	}
}

/**
 * Show one answer's state: `chosen` checks its radio and outlines its card in
 * the accent colour; a card that is not `enabled` (it holds nothing yet) has
 * its radio disabled, so the arrow keys pass over it.
 */
export function paintOptionRadio(
	box: OptionBox,
	radio: HTMLInputElement,
	state: { chosen: boolean; enabled: boolean },
): void {
	box.el.toggleClass("is-selected", state.chosen);
	radio.checked = state.chosen;
	paintedChosen.set(radio, state.chosen);
	radio.disabled = !state.enabled;
}
