/**
 * settings/optionBox.ts — the answer card two kinds of window draw: the plugin
 * import window's two cards, and the answers of both "Update your notes?"
 * questions.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │ ┌──┐  Title  (Recommended)                    ( ) │
 *   │ │▣ │  One line on what this option is or holds.   │
 *   │ └──┘                                              │
 *   └──────────────────────────────────────────────────┘
 *
 * One builder and one set of rules (`.cs-option-box` in styles.css), so the
 * windows cannot drift apart: the same icon tile, title line and status line.
 * The box alone has no role, no focus stop and no listeners; a window adds
 * what is its own to say — a radio dot, a button, a text box
 * (pluginImport/pluginImportViews.ts). Both "Update your notes?" questions
 * build their answers the same way, without the icon tile
 * (settings/noteQuestion.ts); the callout editor's adds an id picker to one
 * (settings/editor/NoteChangesModal.ts). {@link addOptionRadio} is the dot
 * both of them use and {@link paintOptionRadio} how both of them show which
 * card is chosen. A card's own control — the import's Upload button, the
 * question's picker — sits at its trailing edge, just before the dot.
 *
 * Import's source chooser and Export's format chooser drew their choices on
 * this box too, until 2026-10-24; they are rows of Obsidian's setting groups
 * now (settings/choiceRow.ts).
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

/**
 * Make a card one answer of a radio group: a dot at its trailing edge, empty
 * until the window paints its card `is-selected` and sets `aria-checked`.
 *
 * The dot is the radio — named by the card's title line, described by its
 * status line — and the card around it is one large pointer target for the
 * same thing. The card cannot be the radio itself: a radio may hold no control
 * of its own, and a card can hold a button, a text box or a picker. A click on
 * one matching `exempt` does what that control says instead of choosing; left
 * out, every click on the card chooses it, a click into its picker included.
 */
export function addOptionRadio(box: OptionBox, onChoose: () => void, exempt?: string): HTMLElement {
	const [headId, descId] = box.describedBy.split(" ");
	const radio = box.el.createDiv({
		cls: "cs-option-radio",
		attr: {
			role: "radio",
			"aria-checked": "false",
			"aria-labelledby": headId ?? "",
			"aria-describedby": descId ?? "",
		},
	});
	setIcon(radio, "check");
	radio.addEventListener("keydown", (evt) => {
		if (evt.key !== "Enter" && evt.key !== " ") return;
		// Claimed even when repeated, so a held Space never scrolls the window.
		evt.preventDefault();
		if (!evt.repeat) onChoose();
	});
	box.el.addEventListener("click", (evt) => {
		if (exempt && (evt.target as Element | null)?.closest(exempt)) return;
		onChoose();
	});
	return radio;
}

/**
 * Show one radio card's state: `chosen` wears the accent ring and fills the
 * dot; `choosable` says a click would choose it (it has something to choose,
 * and is not chosen already); a card that is not `enabled` keeps its dot out
 * of the tab order and faded.
 */
export function paintOptionRadio(
	box: OptionBox,
	radio: HTMLElement,
	state: { chosen: boolean; choosable: boolean; enabled: boolean },
): void {
	box.el.toggleClass("is-selected", state.chosen);
	box.el.toggleClass("is-choosable", state.choosable);
	radio.setAttribute("aria-checked", state.chosen ? "true" : "false");
	if (state.enabled) {
		radio.setAttribute("tabindex", "0");
		radio.removeAttribute("aria-disabled");
	} else {
		radio.removeAttribute("tabindex");
		radio.setAttribute("aria-disabled", "true");
	}
}
