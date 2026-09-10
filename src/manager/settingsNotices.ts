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
import { settingsSaveMessage } from "./settingsSaveMessage";
import { en } from "../i18n/en";
import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import type { SettingsWriter } from "./SettingsWriter";
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
export function warnSettingsUnreadable(writer?: SettingsWriter): void {
	reportSettingsSaveFailure(writer ?? {}, undefined, settingsSaveMessage(writer?.status.reason ?? "unreadable"));
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
 * dismissed, and the way out is where the decision belongs: the settings
 * banner, which states the situation and offers both actions side by side.
 *
 * **The notice navigates; it does not act.** Creating a replacement file is the
 * single most destructive control this plugin has — it publishes an empty
 * configuration to every device on the vault, and it is offered at the exact
 * moment the real file is most likely still in flight. A notice is the wrong
 * surface for that: it is transient, it is a corner of the screen rather than
 * the page the settings live on, and it is one people dismiss by clicking at.
 * So this link only opens Callout Studio's settings. The confirmed action is
 * still one click away in the banner there, next to the retry that is far more
 * often the right answer.
 */
export function offerFreshStart(app: App, pluginId: string): void {
	const frag = createFragment();
	frag.appendChild(createEl("p", { text: settingsSaveMessage("missing") }));
	const action = frag.appendChild(
		createEl("a", {
			text: t("saveStatus.openSettings"),
			cls: "cs-notice-action",
		}),
	);
	const notice = new Notice(frag, 0);
	action.addEventListener("click", (event) => {
		event.preventDefault();
		// The notice stands if the pane could not be opened: the session is
		// still frozen, and this is still the only thing saying so.
		if (openPluginSettings(app, pluginId)) notice.hide();
	});
}

/**
 * `app.setting` is declared as always present (src/types.ts), which is a claim
 * about an internal rather than a contract — hence the structural guard, the
 * same one `settings/hotkeyLink.ts` makes for the hotkeys pane.
 */
function openPluginSettings(app: App, pluginId: string): boolean {
	const pane: App["setting"] | undefined = app.setting;
	if (pane?.openTabById) {
		try {
			pane.open?.();
			pane.openTabById(pluginId);
			return true;
		} catch (error) {
			console.error("[callout-studio] settings tab could not be opened", error);
		}
	}
	new Notice(t("notice.openSettingsFailed"));
	return false;
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
export async function confirmFreshStart(
	app: App,
	notice: Notice | null,
	startFresh: () => Promise<boolean>,
): Promise<boolean> {
	const ok = await new ConfirmModal(
		app,
		t("confirm.titleStartFresh"),
		t("confirm.startFresh"),
		t("confirm.startFreshOk"),
	).confirm();
	if (!ok) return false;
	try {
		const saved = await startFresh();
		if (saved) notice?.hide();
		return saved;
	} catch (error) {
		console.error("[callout-studio] fresh start failed", error);
		const message = en["saveStatus.retryFailed"]!;
		new Notice(message, 10000);
		return false;
	}
}

/**
 * A `data.json` written by a newer version of this plugin.
 *
 * No escape hatch, for the same reason `warnSettingsUnreadable` has none: the
 * file is intact and the fix is to update the plugin, not to overwrite it with
 * an older build's understanding of it.
 */
export function warnSettingsFromNewerVersion(writer?: SettingsWriter): void {
	reportSettingsSaveFailure(writer ?? {}, undefined, settingsSaveMessage("newer-version"));
}
