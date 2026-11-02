/**
 * settings/paletteContrastLine.ts — the palette editor's low-contrast warning:
 * a triangle on each color that falls short, and one line of words under all of
 * them.
 *
 * Who calls it. `PaletteEditorModal`, once, for the Accent / Background / Text
 * rows of the advanced color grid.
 *
 * The main idea. Two things say it, because each is bad at the other's job.
 *
 * - The triangle ({@link contrastBadgeIn}) sits beside the swatch of the color
 *   that fails, so it answers *which one*. It cannot say *why*: a tooltip is
 *   all it has, and a phone has no hover.
 * - The line ({@link contrastLineAfter}) says why, in words anyone can read. It
 *   cannot say which one, because the sentence is the same for every color
 *   that fails and is shown once. That is also why it must not look like the
 *   caption of the last row above it: it did, under the Text row, and read as
 *   if the Text color were always the one at fault. It has a divider of its
 *   own, like a row, so it stands apart from the rows and below them.
 *
 * The line used to go through the row's `setErrorMessage`, which draws it in
 * the row's control column. A color row's control is a small swatch, so
 * Obsidian gave the line half the row and the sentence broke at nearly every
 * word. It is a full-width line of its own instead.
 */
import { setIcon } from "obsidian";
import type { Setting } from "obsidian";
import { t } from "../i18n";

/** The icon both the triangle and the line wear, so they read as one warning. */
const WARNING_ICON = "triangle-alert";

/**
 * Put a warning triangle beside the swatch in `row`, hidden until shown.
 *
 * It goes before the swatch, so the swatch stays where it was when the
 * triangle comes and goes: a row's control is aligned to its end, and what is
 * added at the start does not move what is already at the end.
 *
 * @returns A function that shows the triangle or hides it.
 */
export function contrastBadgeIn(row: Setting): (show: boolean) => void {
	const badge = createSpan({ cls: "cs-contrast-badge cs-hidden" });
	setIcon(badge, WARNING_ICON);
	// The tooltip is the same sentence the line says. `role="img"` is what
	// lets a screen reader announce a label on an element that is only a drawing.
	badge.setAttribute("role", "img");
	badge.setAttribute("aria-label", t("editor.contrastWarning"));
	row.controlEl.insertBefore(badge, row.controlEl.firstChild);
	return (show) => badge.toggleClass("cs-hidden", !show);
}

/**
 * Make the warning line for the color rows, not yet on the page.
 *
 * @param lastRow The last of the color rows the warning is about; the line
 *   sits right after it.
 * @param rows The list of elements the caller tears down when it rebuilds the
 *   card. The line is added to it, because a rebuild removes the row but not
 *   an element that merely sits after it.
 * @returns A function that shows the line under the rows, or takes it away.
 */
export function contrastLineAfter(lastRow: Setting, rows: HTMLElement[]): (show: boolean) => void {
	const lineEl = createDiv({ cls: "cs-palette-contrast-line" });
	setIcon(lineEl.createSpan({ cls: "cs-palette-contrast-icon" }), WARNING_ICON);
	lineEl.createSpan({ text: t("editor.contrastWarning") });
	rows.push(lineEl);
	return (show) => {
		if (!show) {
			lineEl.detach();
			return;
		}
		// Already under its row: it only ever sits there, and moving it again
		// on every pick would be a needless change to the page.
		if (lineEl.parentElement) return;
		const rowEl = lastRow.settingEl;
		rowEl.parentElement?.insertBefore(lineEl, rowEl.nextSibling);
	};
}
