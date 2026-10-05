/**
 * manager/settingsNotices.ts — what the user is told when `data.json` is not
 * usable, and what they can do about it.
 *
 * Notices announce a session that will not write. Recovered callouts may still
 * be visible, so they distinguish the missing/unusable shared file from the
 * displayed settings and direct the user to the available recovery actions.
 *
 * Separated from `settingsBoot.ts` because it is the only part of that module
 * that touches the DOM, and because the wording is the thing most likely to be
 * revised without the policy around it changing at all.
 */
import { Notice } from "obsidian";
import type { App, Plugin } from "obsidian";
import { t } from "../i18n";
import { settingsSaveMessage } from "./settingsSaveMessage";
import { en } from "../i18n/en";
import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import type { SettingsWriter } from "./SettingsWriter";
import type { SettingsSaveStatus } from "./settingsSaveStatus";
import { ConfirmModal } from "../utils/ConfirmModal";

/** Called after cached locale setup, once recovery has supplied the preference. */
export function registerMissingSettingsNotice(
	host: Pick<Plugin, "app" | "manifest" | "register"> & { settingsWriter: SettingsWriter },
): () => void {
	const writer = host.settingsWriter;
	if (writer.isDestroyed || !writer.isVisiblyPaused || writer.status.frozenReason !== "missing") return () => {};
	const notice = offerFreshStart(host.app, host.manifest.id, writer.status);
	host.register(notice.dispose);
	return notice.refresh;
}

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
 * **The notice navigates; it does not act.** Restoring creates a file from the
 * displayed configuration, which may come from a local recovery copy. The
 * sync service may propagate that choice to other devices. Keep the choice
 * beside the settings being restored, with an explanation and confirmation;
 * a transient notice is too easy to activate accidentally.
 *
 * **It is short, and it is not the explanation.** It says the one thing a
 * worried reader needs first — their notes are safe, saving is only paused —
 * and hands the rest to the banner, instead of printing the banner's whole
 * explanation twice.
 *
 * **It leaves when the pause does.** Given `status`, it hides itself once the
 * writer thaws: a file that syncs back in, or a restore from the banner, would
 * otherwise leave it announcing a missing file that is there again. A change
 * of reason alone does not hide it — saving is still paused, and on a phone
 * this may be the only thing still saying so.
 */
export function offerFreshStart(
	app: App,
	pluginId: string,
	status?: Pick<SettingsSaveStatus, "frozenReason" | "subscribe">,
): { refresh: () => void; dispose: () => void } {
	const frag = createFragment();
	const text = frag.appendChild(createEl("p", { text: t("saveStatus.missingNotice") }));
	const action = frag.appendChild(
		createEl("a", {
			text: t("saveStatus.openSettings"),
			cls: "cs-notice-action",
		}),
	);
	const notice = new Notice(frag, 0);
	const dispose = () => {
		unsubscribe?.();
		notice.hide();
	};
	const unsubscribe = status?.subscribe(() => {
		if (status.frozenReason !== null) return;
		dispose();
	});
	action.addEventListener("click", (event) => {
		event.preventDefault();
		// The notice stands if the pane could not be opened: the session is
		// still frozen, and this is still the only thing saying so.
		if (openPluginSettings(app, pluginId)) {
			dispose();
		}
	});
	return {
		// Update the existing nodes: a dismissed notice must never be reopened.
		refresh: () => {
			text.textContent = t("saveStatus.missingNotice");
			action.textContent = t("saveStatus.openSettings");
		},
		dispose,
	};
}

/**
 * `app.setting` is declared as always present (src/types.ts), which is a claim
 * about an internal rather than a contract — hence the structural guard, the
 * same one `settings/hotkeyLink.ts` makes for the hotkeys pane.
 */
export function openPluginSettings(app: App, pluginId: string): boolean {
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
	hasRecoveryState = false,
): Promise<boolean> {
	const ok = await new ConfirmModal(
		app,
		t(hasRecoveryState ? "confirm.titleRestoreSettings" : "confirm.titleCreateSettingsFile"),
		// Plain words for the last step of a worrying moment.
		t("confirm.saveDisplayedSettings"),
		t(hasRecoveryState ? "saveStatus.restoreSettings" : "saveStatus.createSettingsFile"),
		undefined,
		"mod-cta",
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
