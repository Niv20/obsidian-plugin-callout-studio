/**
 * settings/sections/IgnoredCalloutsList.ts — the ids this vault has told
 * automatic discovery to leave alone, and the way back.
 *
 * "Never detect this callout" is reached from a row's menu, and once used, the
 * row is gone. Without somewhere to see the list, that action is a one-way door
 * with no sign on it: a user who ignored the wrong id has no way to find out
 * what they did, let alone undo it — and no way to answer "why is this callout
 * not showing up any more" six months later.
 *
 * So the list is drawn wherever it is not empty, and every entry carries its
 * own undo. Hidden entirely when nothing is ignored, because a permanent empty
 * section on a page this long is noise for the overwhelming majority of vaults.
 *
 * Its own module rather than another block inside `DataManagementSection.ts`,
 * which is already the largest section file: it is a list with per-row actions,
 * which is a different shape from the settings-plus-buttons around it.
 */
import { Setting } from "obsidian";
import { t } from "../../i18n";
import { removeIgnoredCalloutId } from "../../manager/ignoredCallouts";
import type { SettingsSectionContext } from "./types";

/**
 * Draw the ignored-callout list, or nothing when there is none.
 *
 * Removing an entry deliberately does **not** re-create the row: the id is
 * simply detectable again, and the next scan of a note that uses it puts the
 * row back the same way it arrived the first time. Minting one here would
 * create a row for an id that may not be in the vault at all any more.
 */
export function renderIgnoredCalloutsList(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	const ignored = ctx.plugin.settings.ignoredCalloutIds;
	if (ignored.length === 0) return;

	new Setting(containerEl)
		.setName(t("settings.ignoredHeading"))
		.setDesc(t("settings.ignoredHint"))
		.setHeading();

	for (const id of ignored) {
		new Setting(containerEl)
			.setName(`[!${id}]`)
			.addButton((btn) => {
				btn.setButtonText(t("settings.ignoredRemove")).onClick(() => {
					void detectAgain(ctx, id);
				});
				btn.buttonEl.addClass("cs-settings-neutral-btn");
			});
	}
}

async function detectAgain(
	ctx: SettingsSectionContext,
	id: string,
): Promise<void> {
	const settings = ctx.plugin.settings;
	settings.ignoredCalloutIds = removeIgnoredCalloutId(
		settings.ignoredCalloutIds,
		id,
	);
	await ctx.plugin.saveSettings();
	ctx.display();
}
