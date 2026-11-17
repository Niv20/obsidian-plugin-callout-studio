/**
 * webPanel/webPanelFrame.ts — the parts the Publish to the web panel is drawn
 * from: a step, with its number and its name over a box, and what goes in the
 * box (a sentence, a line to copy, a button), each on a line of its own.
 *
 * Who calls it. `WebPanelView.ts`, which decides what to draw; this only
 * draws it.
 *
 * The main idea. Each step is drawn as Obsidian draws a group of settings: a
 * heading, and under it a rounded box of lines with a hairline between two
 * lines. The heading is the step's number and name. What the step says starts
 * at the box's own edge: a sidebar has no width to spare for an indent. Until
 * 2026-11-16 night the steps were rows in one box under a heading for each of
 * two groups (Set up once, Your site), with what each step said under its name
 * at one indent, and its smaller steps numbered 1, 2, 3 under that. The box's
 * colour, which Obsidian's own settings box would lose on a sidebar's grey, is
 * in `styles.css` (`--cs-web-box-background`).
 *
 * - **A step's heading starts with its number and a period**, 1., 2., 3., in
 *   the order they are done. That is how Obsidian draws a numbered list: its
 *   ordered lists are `list-style-type: decimal` (`--list-numbered-style`),
 *   which the browser draws as a figure and a period, and Markdown's own
 *   marker is `1.` too. Nothing else in Obsidian is numbered (read
 *   2026-11-16 in Obsidian 1.15.1: no counters in `app.css`, and no numbered
 *   steps among the text of its settings and dialogs), so a list is the only
 *   precedent there is. Until 2026-11-16 night the heading started with a
 *   sign of how the step stood (a tick, a ring, a grey ring, a triangle), and
 *   a step the plugin could not see ended with a checkbox for the user to
 *   tick ("I installed it"); the user found the signs and the boxes more to
 *   read than the steps, and asked for numbers instead
 *   (`manager/web/webChecklist.ts`).
 * - **A step does not fold.** Every box is always open, so a heading is plain
 *   text: no arrow, no button role, nothing to press, and no stop on the
 *   keyboard's way through the panel. Until 2026-11-16 night a heading folded
 *   its box away and opened it again, with a slide; the user asked for that to
 *   be removed altogether.
 * - **A line of configuration sits in a well with its Copy button** at the
 *   line's end (`.cs-web-code`), as it did on the page this panel replaced:
 *   beside the sentence above it, the button read as copying the sentence.
 *
 * Every control carries a `data-cs-key`. The panel is drawn whole each time
 * the vault changes, and the key is how the keyboard's place is found again
 * afterwards (`WebPanelView.draw`).
 */
import { ExtraButtonComponent, setIcon, setTooltip } from "obsidian";
import { HELP_ICON_ID } from "../constants";
import { t } from "../i18n";
import type { RowMark, Verdict } from "../manager/web/webChecklist";

/**
 * After a service's name in the list at the top: Obsidian's warning triangle
 * while something needs the user, and nothing otherwise. It says so in words
 * too, for a screen reader and when pointed at. A tick once a service was
 * all done stood here until 2026-11-16 night, with the steps' own signs.
 */
export function drawServiceBadge(parent: HTMLElement, verdict: Verdict): void {
	if (verdict !== "attention") return;
	const words = t("web.markWarning");
	const el = parent.createSpan({ cls: "cs-web-warning", attr: { role: "img", "aria-label": words } });
	setIcon(el, "alert-triangle");
	setTooltip(el, words);
}

/**
 * A "?" that says `words` when pointed at, and to a screen reader. It is not
 * a button: nothing happens when it is pressed. What it explains is for a
 * desktop (a terminal, a site's folder), where something can be pointed at.
 * It stood as a button that opened the sentence under the line for a day
 * (2026-11-17), for a phone nobody sets a Quartz site up from.
 */
export function drawHelpMark(parent: HTMLElement, words: string): void {
	const el = parent.createSpan({ cls: "cs-web-help", attr: { role: "img", "aria-label": words } });
	setIcon(el, HELP_ICON_ID);
	setTooltip(el, words, { delay: HELP_TOOLTIP_DELAY_MS });
}

/**
 * How long a "?" is pointed at before it speaks. Obsidian's own wait is a
 * full second, which on a mark whose whole job is to be read made it look
 * broken: the cursor turned to a "?" and nothing came (2026-11-17). Not
 * zero, so a pointer passing over it on its way elsewhere shows nothing.
 */
const HELP_TOOLTIP_DELAY_MS = 200;

export interface RowOptions {
	/** Its place in the list, from 1. */
	number: number;
	/** How it stands, as a class on the step (`is-warning`, …), which the tests read; nothing is drawn from it. */
	mark: RowMark;
	title: string;
}

/** The list the steps are drawn in, one after the other. */
export function drawRows(parent: HTMLElement): HTMLElement {
	return parent.createDiv({ cls: "cs-web-rows", attr: { role: "list" } });
}

/**
 * One step: its heading, which is its number and its name and does nothing,
 * and the box of lines under it, which is returned. The number has a period
 * after it, as a numbered list's has in Obsidian.
 */
export function drawRow(rows: HTMLElement, options: RowOptions): HTMLElement {
	const row = rows.createDiv({ cls: `cs-web-row is-${options.mark}`, attr: { role: "listitem" } });
	const head = row.createDiv({ cls: "cs-web-row-head" });
	head.createSpan({ cls: "cs-web-row-number", text: `${options.number}.` });
	head.createSpan({ cls: "cs-web-row-title", text: options.title });
	return row.createDiv({ cls: "cs-web-row-box" });
}

/**
 * What comes before step 1, with no number: the heading and box of a step,
 * but not one of the list's items, so the numbers under it never move. The
 * box is returned.
 */
export function drawPrerequisite(rows: HTMLElement, title: string): HTMLElement {
	const block = rows.createDiv({ cls: "cs-web-prereq" });
	const head = block.createDiv({ cls: "cs-web-row-head" });
	head.createSpan({ cls: "cs-web-row-title", text: title });
	return block.createDiv({ cls: "cs-web-row-box" });
}

/**
 * A line in a step's box, with a hairline above it after the first. `step`
 * marks a smaller step, done in order; the other lines say what the step is,
 * or what is good to know. All of them are in the normal text colour.
 */
export function addLine(box: HTMLElement, step = false): HTMLElement {
	return box.createDiv({ cls: step ? "cs-web-line is-step" : "cs-web-line" });
}

/** A sentence in a step's box. `help` puts a "?" after it that says more when pointed at (`drawHelpMark`). */
export function addText(body: HTMLElement, text: string, tone?: "warning", help?: string): HTMLElement {
	const cls = tone ? `cs-web-row-text is-${tone}` : "cs-web-row-text";
	if (help === undefined) return body.createDiv({ cls, text });
	const line = body.createDiv({ cls: "cs-web-row-text-help" });
	line.createDiv({ cls, text });
	drawHelpMark(line, help);
	return line;
}

/**
 * A line to paste into a site's configuration, with the button that copies
 * it. It can always be copied: until 2026-11-16 night the button was off
 * while its step waited for the files, which the user found one more lock
 * on a panel that no longer counts steps.
 */
export function addCode(
	body: HTMLElement,
	options: { code: string; key: string; onCopy: (code: string) => void },
): void {
	const { code } = options;
	const well = body.createDiv({ cls: "cs-web-code" });
	well.createEl("pre").createEl("code", { text: code });
	const copy = new ExtraButtonComponent(well)
		.setIcon("copy")
		.setTooltip(t("web.copy"))
		.onClick(() => options.onCopy(code));
	copy.extraSettingsEl.dataset.csKey = options.key;
}

/** The line the buttons of a step's line are on: the last thing in it if that is one, else a new one. */
function buttonsOf(body: HTMLElement): HTMLElement {
	const last = body.lastElementChild;
	return last instanceof HTMLElement && last.hasClass("cs-web-row-actions")
		? last
		: body.createDiv({ cls: "cs-web-row-actions" });
}

/**
 * A button in a step's box. `primary` is the one that writes the service's
 * files, in the accent: the one thing on the panel that changes the vault.
 * The others lead somewhere else (`siteActions.ts`) and are Obsidian's plain
 * buttons. Buttons that follow one another sit side by side, and wrap where
 * the panel is narrow.
 */
export function addAction(
	body: HTMLElement,
	options: { text: string; key: string; primary?: boolean; onClick: (button: HTMLButtonElement) => void },
): HTMLButtonElement {
	const button = buttonsOf(body).createEl("button", { text: options.text });
	if (options.primary) button.addClass("mod-cta");
	button.dataset.csKey = options.key;
	button.addEventListener("click", () => options.onClick(button));
	return button;
}
