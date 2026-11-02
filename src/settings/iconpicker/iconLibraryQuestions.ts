/**
 * settings/iconpicker/iconLibraryQuestions.ts — the two questions Manage icon
 * libraries asks before it deletes files.
 *
 * Who calls it. IconLibrariesModal: before deleting a library that callouts
 * use, and before its reset arrow deletes every downloaded library.
 *
 * The main idea. Each question names what goes — the callouts that use the
 * library, or the libraries themselves — and says what stays: the callouts
 * keep their icons (IconService.deleteLibrary keeps a copy of every drawing
 * they need). Split out of the window because they read nothing of its state.
 */
import type { App } from "obsidian";
import type { IconSourceId } from "../../types";
import { getSource } from "../../icons/registry";
import { t } from "../../i18n";
import { ConfirmModal } from "../../utils/ConfirmModal";

/** Names listed in the delete question before the rest are summed up as "and N more". */
const MAX_LISTED_CALLOUTS = 10;

/**
 * Ask before deleting library `id`, which the callouts named in `users` use.
 * Resolves true when the person chooses to delete.
 */
export function askDeleteLibrary(app: App, id: IconSourceId, users: readonly string[]): Promise<boolean> {
	const name = t(getSource(id).labelKey);
	const message = createFragment();
	message.createEl("p", {
		text:
			users.length === 1
				? t("iconLibraries.inUseOne", { name })
				: t("iconLibraries.inUse", { name, count: String(users.length) }),
	});
	const list = message.createEl("ul", { cls: "cs-icon-library-users" });
	for (const callout of users.slice(0, MAX_LISTED_CALLOUTS)) {
		list.createEl("li", { text: callout });
	}
	if (users.length > MAX_LISTED_CALLOUTS) {
		list.createEl("li", {
			text: t("iconLibraries.inUseMore", { count: String(users.length - MAX_LISTED_CALLOUTS) }),
		});
	}
	message.createEl("p", { text: t("iconLibraries.inUseKeeps", { name }) });
	return new ConfirmModal(app, t("confirm.titleDeleteLibrary"), message)
		.withMascot(t("confirm.subtitleName", { name }))
		.confirm();
}

/**
 * Ask before a reset deletes the downloaded libraries in `doomed`, naming
 * them. Resolves true when the person chooses to reset.
 */
export function askResetLibraries(app: App, doomed: readonly IconSourceId[]): Promise<boolean> {
	const message = createFragment();
	message.createEl("p", { text: t("iconLibraries.resetConfirm") });
	const list = message.createEl("ul", { cls: "cs-icon-library-users" });
	for (const id of doomed) list.createEl("li", { text: t(getSource(id).labelKey) });
	message.createEl("p", { text: t("iconLibraries.resetKeeps") });
	return new ConfirmModal(app, t("confirm.titleResetLibraries"), message, t("iconLibraries.resetButton"))
		.withMascot(t("iconLibraries.resetSubtitle"))
		.confirm();
}
