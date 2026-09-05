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
import type { App } from "obsidian";
import { t } from "../i18n";
import { ConfirmModal } from "../utils/ConfirmModal";

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
 *
 * **It asks first.** That link is the single most destructive control this
 * plugin has: it publishes an empty configuration to every device on the vault,
 * it is offered at the exact moment the real file is most likely still in
 * flight, and it appears inside a notice — a surface nothing else here uses for
 * an irreversible action, and one people dismiss by clicking at. The
 * confirmation is not ceremony; it is the difference between "the file is gone"
 * and "the file is gone *and so are the copies on my other devices*".
 */
export function offerFreshStart(app: App, startFresh: () => void): void {
	const frag = createFragment();
	frag.appendChild(createEl("p", { text: t("notice.settingsMissing") }));
	const action = frag.appendChild(
		createEl("a", {
			text: t("notice.settingsMissingAction"),
			cls: "cs-notice-action",
		}),
	);
	const notice = new Notice(frag, 0);
	action.addEventListener("click", (event) => {
		event.preventDefault();
		void confirmFreshStart(app, notice, startFresh);
	});
}

/**
 * Kept apart from the listener so the listener stays synchronous — an async
 * handler on a click swallows its own rejections, and this one ends in a write
 * nobody can take back.
 *
 * The notice is hidden only once the user has committed. Backing out of the
 * dialog leaves it standing, because the session is still frozen and still
 * needs to say so.
 */
async function confirmFreshStart(
	app: App,
	notice: Notice,
	startFresh: () => void,
): Promise<void> {
	const ok = await new ConfirmModal(
		app,
		t("confirm.titleStartFresh"),
		t("confirm.startFresh"),
		t("confirm.startFreshOk"),
	).confirm();
	if (!ok) return;
	startFresh();
	notice.hide();
}

/**
 * A `data.json` written by a newer version of this plugin.
 *
 * No escape hatch, for the same reason `warnSettingsUnreadable` has none: the
 * file is intact and the fix is to update the plugin, not to overwrite it with
 * an older build's understanding of it.
 */
export function warnSettingsFromNewerVersion(): void {
	new Notice(t("notice.settingsNewerVersion"), 0);
}
