/**
 * manager/settingsNotices.ts — what the user is told when `data.json` is not
 * usable, and what they can do about it.
 *
 * Both notices below announce a session that will not write. That is a strange
 * state to be in and an alarming one to discover late — the callouts are gone
 * from the settings list, and the natural reading is that the plugin threw them
 * away — so each one says the same three things: the file could not be used,
 * nothing has been written, and here is what to do next.
 *
 * Separated from `settingsBoot.ts` because it is the only part of that module
 * that touches the DOM, and because the wording is the thing most likely to be
 * revised without the policy around it changing at all.
 */
import { Notice } from "obsidian";
import { t } from "../i18n";

/**
 * A `data.json` that exists but could not be parsed.
 *
 * No escape hatch here, deliberately. The file is still on disk and still holds
 * whatever the user built; the right move is to reload once the sync or the
 * editor that was writing it has finished, and offering a "start fresh" button
 * next to a file that is probably fine would invite exactly the loss the freeze
 * just prevented.
 */
export function warnSettingsUnreadable(): void {
	new Notice(t("notice.settingsUnreadable"), 0);
}

/**
 * A `data.json` that has gone missing from a device that has run before.
 *
 * Unlike the unreadable case this one *does* carry a way out, because the
 * freeze behind it rests on an assumption that can be wrong. "The file is
 * coming back" is true of a sync client mid-swap and false of a user who
 * deleted `data.json` themselves to start over — and for that second user, a
 * freeze with no way out would mean every launch from here on silently
 * discarding everything they did. So the notice stays up until it is used or
 * dismissed, and clicking it is the only path in the codebase that reaches
 * `SettingsWriter.thaw()`.
 */
export function offerFreshStart(startFresh: () => void): void {
	const frag = createFragment();
	frag.createEl("p", { text: t("notice.settingsMissing") });
	const action = frag.createEl("a", {
		text: t("notice.settingsMissingAction"),
		href: "#",
		cls: "cs-notice-action",
	});
	const notice = new Notice(frag, 0);
	action.addEventListener("click", (event) => {
		event.preventDefault();
		startFresh();
		notice.hide();
	});
}
