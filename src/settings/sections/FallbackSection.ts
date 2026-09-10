/**
 * settings/sections/FallbackSection.ts — Fallback callout selector.
 *
 * Renders a single picker that lets the user choose which callout type is used
 * as the fallback for unknown/unrecognized callout IDs in the vault. Changing
 * the selection immediately re-styles uncustomized fallback rows and triggers a
 * CSS refresh.
 *
 * The control is the shared {@link CalloutCombobox}, not a `<select>`: with a
 * few dozen callouts in a vault, scrolling a native dropdown to find one by
 * name — with no icon and no colour to aim at — is the worst way to ask this
 * question, and the `[!` popover in the editor had already answered it better.
 */
import { Setting } from "obsidian";
import { t } from "../../i18n";
import { CalloutCombobox } from "../calloutCombobox";
import { CalloutEditor } from "../CalloutEditor";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";

export function renderFallbackSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	new Setting(containerEl)
		.setName(t("settings.fallbackCallout"))
		.setHeading();

	const setting = new Setting(containerEl)
		.setName(t("settings.fallbackCallout"))
		.setClass("cs-fallback-setting")
		.setDesc(t("settings.fallbackCalloutDesc"));

	// Re-read on every open, so a callout created from the picker itself is
	// already in the list. `fallbackCalloutId` is persisted, so only a row that
	// exists on every device may be offered: a theme overlay row exists on this
	// one for as long as this theme is active, and choosing it would put
	// machine-local state into the synced settings file (issue #41).
	const choices = (): CalloutDefinition[] =>
		ctx.plugin.registry.getAll().filter((c) => c.source !== "theme");

	const picker = new CalloutCombobox(setting.controlEl, {
		registry: ctx.plugin.registry,
		choices,
		value: ctx.plugin.settings.fallbackCalloutId,
		ariaLabel: t("settings.fallbackCallout"),
		onCreate: (name) =>
			new CalloutEditor(ctx.plugin, undefined, {
				seedDisplayName: name,
			}).openAndWait(),
		onChange: async (id) => {
			ctx.plugin.settings.fallbackCalloutId = id;
			ctx.plugin.restyleUncustomizedFallbackRows();
			await ctx.plugin.saveSettings();
			ctx.plugin.refreshCallouts();
		},
	});
	// The picker holds a document-level click listener; the tab owns its
	// lifetime and clears these on `hide()` and before every re-`display()`.
	ctx.registerDisposer(() => picker.destroy());
}
