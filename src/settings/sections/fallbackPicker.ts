/**
 * settings/sections/fallbackPicker.ts — the Default fallback callout's picker.
 *
 * Who calls it. The settings page's Default fallback callout row
 * (declarative/generalRows.ts).
 *
 * The main idea. One picker chooses which callout type styles the callouts
 * the vault uses but no one defined. Changing it re-styles the callouts that
 * follow the fallback and refreshes the stylesheet at once.
 *
 * The control is the shared {@link CalloutCombobox}, not a `<select>`: with a
 * few dozen callouts in a vault, scrolling a native dropdown to find one by
 * name — with no icon and no colour to aim at — is the worst way to ask this
 * question, and the `[!` popover in the editor had already answered it better.
 *
 * The steps (the picker, its reset arrow, choosing a fallback) are exported
 * one by one, for the row to put together.
 */
import type { Setting } from "obsidian";
import { t } from "../../i18n";
import { DEFAULT_SETTINGS } from "../../constants";
import { addFieldResetButton } from "../editor/fieldResetButton";
import { CalloutCombobox } from "../calloutCombobox";
import { CalloutEditor } from "../CalloutEditor";
import { refreshOccurrencesViewAppearance } from "../../usage/registerOccurrencesView";
import type { CalloutDefinition } from "../../types";
import type { SettingsTabPlugin } from "./types";

/**
 * The callouts the fallback may be. Re-read on every open, so a callout
 * created from the picker itself is already in the list. `fallbackCalloutId`
 * is persisted, so only a row that exists on every device may be offered: a
 * theme overlay row exists on this one for as long as this theme is active,
 * and choosing it would put machine-local state into the synced settings file
 * (issue #41).
 */
export function fallbackChoices(plugin: SettingsTabPlugin): CalloutDefinition[] {
	return plugin.registry.getAll().filter((c) => c.source !== "theme");
}

/**
 * The fallback picker, built into `parent` and showing the saved fallback.
 * `onChange` runs with the id the user picked (or created from the picker).
 */
export function createFallbackPicker(
	plugin: SettingsTabPlugin,
	parent: HTMLElement,
	onChange: (id: string) => void | Promise<void>,
): CalloutCombobox {
	return new CalloutCombobox(parent, {
		registry: plugin.registry,
		choices: () => fallbackChoices(plugin),
		value: plugin.settings.fallbackCalloutId,
		ariaLabel: t("settings.fallbackCallout"),
		onCreate: (name) =>
			new CalloutEditor(plugin, undefined, {
				seedDisplayName: name,
			}).openAndWait(),
		onChange,
	});
}

/**
 * Make `id` the fallback callout: rows and notes repaint at once, then the
 * setting is saved. Painted before the save, never after it: a save can queue
 * behind another or fail, and the notes should not wait on the disk.
 */
export async function setFallbackCallout(plugin: SettingsTabPlugin, id: string): Promise<void> {
	plugin.settings.fallbackCalloutId = id;
	plugin.restyleUncustomizedFallbackRows();
	plugin.refreshCallouts();
	refreshOccurrencesViewAppearance(plugin);
	await plugin.saveSettings();
}

/**
 * The reset arrow beside the picker: back to the default fallback. Shown only
 * while another fallback is chosen. Returns the function that shows or hides
 * it again, for after a pick.
 */
export function addFallbackReset(
	setting: Setting,
	plugin: SettingsTabPlugin,
	picker: CalloutCombobox,
): () => void {
	const fallbackDefault = DEFAULT_SETTINGS.fallbackCalloutId;
	return addFieldResetButton(
		setting,
		`${t("settings.resetAction")}: ${t("settings.fallbackCallout")}`,
		() => plugin.settings.fallbackCalloutId === fallbackDefault,
		() => {
			picker.setValue(fallbackDefault);
			void setFallbackCallout(plugin, fallbackDefault);
		},
	);
}
