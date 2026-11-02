/**
 * settings/resetEverything.ts — Danger zone › Reset everything: what it asks,
 * and what it does.
 *
 * Who calls it. The Reset everything button in the settings' Danger zone
 * (declarative/mainPageGroups.ts).
 *
 * The main idea. A reset deletes the user's callouts and palettes and puts
 * every setting back, so it asks first, listing exactly what would go, and it
 * backs the setup up first: the reset also replaces this device's recovery
 * copy, so the backup is the only way back. No verified backup, no reset. And
 * nothing at all happens while saving is paused, because a reset that cannot
 * be saved would only look done.
 */
import { t } from "../i18n";
import { ConfirmModal } from "../utils/ConfirmModal";
import { countCalloutUsages } from "../utils/vaultCalloutScanner";
import { writeSettingsBackup } from "../manager/settingsBackup";
import { blockedWhilePaused } from "./pausedGuard";
import { isResetInventoryEmpty, resetInventory, type ResetInventory, type ResetInventoryRow } from "./resetInventory";
import type { SettingsContext } from "./sections/types";
import { showNotice } from "../ui/mascot/mascotNotices";

/** Ask, then reset everything if the user agrees. */
export async function confirmAndResetEverything(ctx: SettingsContext): Promise<void> {
	if (blockedWhilePaused(ctx.plugin.settingsWriter)) return;
	const inventory = resetInventory(ctx.plugin.registry);
	// A second reset in a row, or one on a fresh install: say so rather than
	// ask for a tick and back up an empty setup.
	if (isResetInventoryEmpty(inventory)) {
		showNotice("upToDate", t("settings.resetNothing"));
		return;
	}
	await addUsesInNotes(ctx, inventory);
	const confirmed = await new ConfirmModal(
		ctx.app,
		t("confirm.titleResetEverything"),
		resetQuestion(inventory),
		t("settings.resetAllButton"),
		undefined,
		undefined,
		t("confirm.acknowledge"),
	).withMascot(
		// Something to lose: the reminder; only settings going back: what happens to them.
		inventory.deleted.length > 0 ? t("settings.resetIntro") : t("settings.resetSubtitleDefaults"),
	).confirm();
	// Saving may have paused while the question was open.
	if (!confirmed || blockedWhilePaused(ctx.plugin.settingsWriter)) return;
	await resetAfterBackup(ctx);
}

/**
 * Uses of the user's own callouts in notes are one more line of what goes:
 * last in the list and in the same colour, not a paragraph above it.
 */
async function addUsesInNotes(ctx: SettingsContext, inventory: ResetInventory): Promise<void> {
	const registry = ctx.plugin.registry;
	const userIds = registry.getUserDefined().flatMap((def) => registry.vaultIdFormsFor(def));
	if (userIds.length === 0) return;
	const { totalCount } = await countCalloutUsages(ctx.app, userIds);
	if (totalCount > 0) {
		inventory.deleted.push({ labelKey: "settings.resetItemReferences", count: totalCount });
	}
}

/** The confirmation's text: what is deleted, what goes back to its default, and what follows. */
function resetQuestion(inventory: ResetInventory): DocumentFragment {
	const question = createFragment();
	// "All of it" needs an it: with nothing to delete, only the list of
	// settings going back to their defaults is drawn. The reminder that used to
	// open the message is the heading's second line now (see the caller).
	appendInventoryList(question, "settings.resetDeletes", inventory.deleted);
	appendInventoryList(question, "settings.resetRestores", inventory.restored);
	for (const paragraph of t("settings.resetAllConfirmAfter").split(/\n+/)) {
		question.createEl("p", { text: paragraph });
	}
	return question;
}

/** One lead-in sentence and its list in the confirmation; nothing when the list is empty. */
function appendInventoryList(parent: DocumentFragment, headingKey: string, rows: ResetInventoryRow[]): void {
	if (rows.length === 0) return;
	parent.createEl("p", { text: t(headingKey), cls: "cs-reset-inventory-heading" });
	const list = parent.createEl("ul", { cls: "cs-reset-inventory" });
	for (const row of rows) {
		list.createEl("li", { text: t(row.labelKey, { count: row.count ?? 0 }) });
	}
}

/** Back the setup up, then reset, paint, save, and say how it went. */
async function resetAfterBackup(ctx: SettingsContext): Promise<void> {
	const { plugin } = ctx;
	if (!await writeSettingsBackup(plugin, plugin.registry.toSaveData(), { reason: "before-reset" })) {
		showNotice("problem", t("settings.resetBackupFailed"));
		return;
	}
	plugin.registry.resetAll();
	plugin.cssInjector.inject();
	await plugin.saveSettings();
	// `?.(…)`: a host without the check (`persists`) counts as saved.
	if (plugin.settingsWriter.persists?.(plugin.registry.toSaveData()) === false) {
		showNotice("problem", t("settings.resetNotSaved"));
	} else {
		showNotice("celebrate", t("notice.resetAllDone"));
	}
	ctx.redraw();
}
