/**
 * settings/optionBox.ts — the option box every chooser window draws: Import's
 * source chooser, Export's format chooser, and the plugin import window's three
 * options.
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ ▣  Title  (👍 Recommended)                    │
 *   │    One line on what this option is or holds.  │
 *   └───────────────────────────────────────────────┘
 *
 * One builder and one set of rules (`.cs-option-box` in styles.css), so the
 * three windows cannot drift apart again: the same icon, title line, status
 * line and pill, the same pointer and keyboard handling, and the same hover,
 * focus ring and disabled look. The box is the whole control — nothing sits on
 * it — and what a click *means* stays the window's: a chooser's box acts at
 * once (`role="button"`), a plugin import box is chosen or filled
 * (`role="radio"`, whose `aria-checked` and `is-selected` its window flips in
 * place).
 */
import { setIcon } from "obsidian";
import { renderRecommendedBadge } from "./recommendedBadge";

let nextId = 0;

/** A document-unique id, for aria-labelledby and aria-describedby. */
export function optionBoxId(name: string): string {
	nextId += 1;
	return `callout-studio-option-${name}-${nextId}`;
}

/**
 * Whether a box answers the pointer and the keyboard.
 *
 * - `enabled` — a focus stop and a click target.
 * - `pending` — neither yet, and not greyed either: the plugin import window's
 *   vault box while its probe is still looking, which usually settles within a
 *   frame or two.
 * - `disabled` — neither, greyed out (`is-disabled`), with the not-allowed
 *   cursor: there is nothing behind it to choose.
 */
export type OptionBoxAvailability = "enabled" | "pending" | "disabled";

export interface OptionBoxSpec {
	/**
	 * `button`, the default, acts on a click. `radio` is chosen by one, and its
	 * window marks which box is chosen.
	 */
	role?: "button" | "radio";
	icon: string;
	title: string;
	/** The title is a file name: it breaks anywhere and keeps its own direction. */
	titleIsName?: boolean;
	desc: string;
	/** The status line reads as a warning. */
	warning?: boolean;
	/** The grey Recommended pill on the title line. */
	recommended?: boolean;
	/** `enabled` unless said otherwise. */
	availability?: OptionBoxAvailability;
	/** A click, Enter or Space on an enabled box. */
	onActivate: () => void;
}

export interface OptionBox {
	/** The box itself: its role, its focus stop and its click target. */
	el: HTMLElement;
	/** Its title line and status line, as an `aria-describedby` value. */
	describedBy: string;
}

/**
 * The column the boxes stack in; spacing is its gap, not each box's margin.
 * `attr` is for a list that is also a group — the plugin import window's
 * radiogroup.
 */
export function renderOptionList(
	parent: HTMLElement,
	attr: Record<string, string> = {},
): HTMLElement {
	return parent.createDiv({ cls: "cs-option-list", attr });
}

export function renderOptionBox(list: HTMLElement, spec: OptionBoxSpec): OptionBox {
	const headId = optionBoxId("title");
	const descId = optionBoxId("status");
	const role = spec.role ?? "button";
	// Named by its title line and described by its status line, rather than
	// named by everything in it — and never with an `aria-label`, which
	// Obsidian would pop up as a tooltip over the box.
	const el = list.createDiv({
		cls: "cs-option-box",
		attr: { role, "aria-labelledby": headId, "aria-describedby": descId },
	});
	if (role === "radio") el.setAttribute("aria-checked", "false");
	setIcon(el.createDiv({ cls: "cs-option-box-icon" }), spec.icon);

	const text = el.createDiv({ cls: "cs-option-box-text" });
	const head = text.createDiv({ cls: "cs-option-box-head", attr: { id: headId } });
	const title = head.createSpan({ cls: "cs-option-box-title", text: spec.title });
	if (spec.titleIsName) {
		title.addClass("cs-option-box-name");
		// An LTR file name keeps its order inside RTL text, and a Hebrew one
		// still reads correctly in an LTR window.
		title.setAttribute("dir", "auto");
	}
	if (spec.recommended) renderRecommendedBadge(head);
	const desc = text.createDiv({
		cls: "cs-option-box-desc",
		text: spec.desc,
		attr: { id: descId },
	});
	desc.toggleClass("is-warning", spec.warning === true);

	const describedBy = `${headId} ${descId}`;
	const availability = spec.availability ?? "enabled";
	if (availability !== "enabled") {
		el.setAttribute("aria-disabled", "true");
		el.toggleClass("is-disabled", availability === "disabled");
		return { el, describedBy };
	}

	el.setAttribute("tabindex", "0");
	// Only a double-click's first click, and a held key's first press, count:
	// the rest would act again on what the first already did — the file picker
	// a second time, or, in the plugin import window, a box the first click
	// chose filling itself again, a fresh clipboard read over the paste the
	// user was switching back to.
	el.addEventListener("click", (evt) => {
		if (evt.detail > 1) return;
		spec.onActivate();
	});
	el.addEventListener("keydown", (evt) => {
		if (evt.key !== "Enter" && evt.key !== " ") return;
		// Claimed even when repeated, so a held Space never scrolls the window.
		evt.preventDefault();
		if (evt.repeat) return;
		spec.onActivate();
	});
	return { el, describedBy };
}
