/**
 * ui/settingError.ts — show a message under a setting's control the way
 * Obsidian shows a rejected value.
 *
 * Who calls it. The callout editor, for its IDs row (TagInput hands it every
 * error about the field through its `showFieldError` option).
 *
 * The main idea. Obsidian 1.13's `Setting.setErrorMessage(text)` draws a line
 * of warning-coloured text under the control (`div.setting-item-error`) and
 * marks the row `is-invalid`; `setErrorMessage(null)` takes it away. It takes
 * plain text only, but a message may be a renderer that fills the line itself
 * (a sentence with a link in it). The line it draws is public
 * (`Setting.errorEl`), so for such a message this asks Obsidian to show the
 * line and then draws the message into it — one place for every short error,
 * the same place Obsidian uses. (Long ones, which would wrap into a tall strip
 * in the field's narrow column, are drawn under the label by TagInput.)
 *
 * One change from Obsidian's. It builds the line INSIDE the control column,
 * which for the IDs row is only as wide as the field — a sentence like
 * "Maximum 10 IDs. Delete one to add another." broke into two lines there. So
 * the line is moved up to be a child of the row itself; the stylesheet gives
 * it a line of its own across the whole row (`.cs-callout-ids-setting >
 * .setting-item-error`).
 */
import type { Setting } from "obsidian";
import type { TagMessage } from "./TagInput";

/**
 * Show `message` under `setting`'s control, or clear the line on `null`.
 *
 * @param setting The row the message belongs to.
 * @param message Plain words, a renderer that fills the line itself (for a
 *   sentence with a link in it), or `null` to clear it.
 */
export function setSettingError(setting: Setting, message: TagMessage | null): void {
	if (message === null || message === "") {
		setting.setErrorMessage(null);
		return;
	}
	if (typeof message === "string") {
		setting.setErrorMessage(message);
		spanWholeRow(setting);
		return;
	}
	// A renderer. Any text that is not empty makes Obsidian create and show the
	// line and mark the row invalid; the renderer then replaces that text.
	setting.setErrorMessage(" ");
	spanWholeRow(setting);
	const lineEl = setting.errorEl;
	if (!lineEl) return;
	lineEl.empty();
	message(lineEl);
}

/**
 * Lift Obsidian's error line out of the control column and into the row, once.
 * Obsidian keeps reusing the same element for later messages, so after the
 * first move every call finds it already in place.
 */
function spanWholeRow(setting: Setting): void {
	const lineEl = setting.errorEl;
	if (lineEl && lineEl.parentElement !== setting.settingEl) setting.settingEl.appendChild(lineEl);
}
