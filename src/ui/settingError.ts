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
 * plain text only, but some of the editor's messages carry a link ("…is an ID
 * of Abstract. You can move it here."). The line it draws is public
 * (`Setting.errorEl`), so for such a message this asks Obsidian to show the
 * line and then draws the message into it — one place for every error, the
 * same place Obsidian uses.
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
		return;
	}
	// A renderer. Any text that is not empty makes Obsidian create and show the
	// line and mark the row invalid; the renderer then replaces that text.
	setting.setErrorMessage(" ");
	const lineEl = setting.errorEl;
	if (!lineEl) return;
	lineEl.empty();
	message(lineEl);
}
