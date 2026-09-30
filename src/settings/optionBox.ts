/**
 * settings/optionBox.ts — the option box every import and export window draws:
 * Import's source chooser, Export's format chooser, and the plugin import
 * window's two cards.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │ ┌──┐  Title  (👍 Recommended)                     │
 *   │ │▣ │  One line on what this option is or holds. › │
 *   │ └──┘                                              │
 *   └──────────────────────────────────────────────────┘
 *
 * One builder and one set of rules (`.cs-option-box` in styles.css), so the
 * three windows cannot drift apart again: the same icon tile, title line and
 * status line, the same pointer and keyboard handling, and the same hover and
 * focus ring. It is drawn as the settings lists draw a callout row — a raised,
 * borderless pill — so a chooser reads as part of the same plugin rather than
 * as a dialog of its own.
 *
 * A box comes in two forms, told apart by whether it is given something to do:
 *
 * - **A choice** (`onActivate`) — the whole box is the control, `role="button"`,
 *   and nothing on it takes a click of its own. It acts at once, and the chevron
 *   at its trailing edge says so. What the click *means* stays the window's.
 * - **A card** (no `onActivate`) — the box alone: no role, no focus stop, no
 *   chevron, no listeners. The plugin import window builds its two options on
 *   it, and adds what is its own to say — a radio dot, a button, a text box
 *   (pluginImport/pluginImportViews.ts).
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
	icon: string;
	title: string;
	desc: string;
	/** The grey Recommended pill on the title line. */
	recommended?: boolean;
	/**
	 * A click, Enter or Space on the box. Left out, the box is a card: it takes
	 * no click and is not a focus stop.
	 */
	onActivate?: () => void;
}

export interface OptionBox {
	/** The box itself; on a choice, also its role, focus stop and click target. */
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

/**
 * A quiet caption over the boxes that follow it, for a list that holds two
 * kinds of choice — Import's own backup, then the other plugins.
 */
export function renderOptionGroupLabel(list: HTMLElement, text: string): HTMLElement {
	return list.createDiv({ cls: "cs-option-group-label", text });
}

export function renderOptionBox(parent: HTMLElement, spec: OptionBoxSpec): OptionBox {
	const headId = optionBoxId("title");
	const descId = optionBoxId("status");
	const el = parent.createDiv({ cls: "cs-option-box" });
	setIcon(el.createDiv({ cls: "cs-option-box-icon" }), spec.icon);

	const text = el.createDiv({ cls: "cs-option-box-text" });
	const head = text.createDiv({ cls: "cs-option-box-head", attr: { id: headId } });
	const titleEl = head.createSpan({ cls: "cs-option-box-title", text: spec.title });
	if (spec.recommended) renderRecommendedBadge(head);
	const descEl = text.createDiv({
		cls: "cs-option-box-desc",
		text: spec.desc,
		attr: { id: descId },
	});

	const box: OptionBox = { el, titleEl, descEl, describedBy: `${headId} ${descId}` };
	const { onActivate } = spec;
	if (!onActivate) return box;

	// Named by its title line and described by its status line, rather than
	// named by everything in it — and never with an `aria-label`, which
	// Obsidian would pop up as a tooltip over the box.
	el.setAttribute("role", "button");
	el.setAttribute("aria-labelledby", headId);
	el.setAttribute("aria-describedby", descId);
	el.setAttribute("tabindex", "0");

	// What a click does, shown rather than said. Decoration only — the box's
	// role already says it, so the chevron takes no role or focus stop.
	const mark = el.createDiv({
		cls: "cs-option-box-mark",
		attr: { "aria-hidden": "true" },
	});
	setIcon(mark, "chevron-right");

	// Only a double-click's first click, and a held key's first press, count:
	// the rest would act again on what the first already did — the file picker
	// a second time, a second export.
	el.addEventListener("click", (evt) => {
		if (evt.detail > 1) return;
		onActivate();
	});
	el.addEventListener("keydown", (evt) => {
		if (evt.key !== "Enter" && evt.key !== " ") return;
		// Claimed even when repeated, so a held Space never scrolls the window.
		evt.preventDefault();
		if (evt.repeat) return;
		onActivate();
	});
	return box;
}
