/**
 * settings/sections/FallbackSection.ts — Fallback callout selector.
 *
 * Renders a single dropdown that lets the user choose which callout type is
 * used as the fallback for unknown/unrecognized callout IDs in the vault.
 * Changing the selection immediately re-styles uncustomized fallback rows and
 * triggers a CSS refresh.
 */
import { Setting } from "obsidian";
import { getLocale, t } from "../../i18n";
import { sortCalloutsById } from "../../utils/sorting";
import type { SettingsSectionContext } from "./types";

export function renderFallbackSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	new Setting(containerEl)
		.setName(t("settings.fallbackCallout"))
		.setHeading();

	new Setting(containerEl)
		.setName(t("settings.fallbackCallout"))
		.setDesc(t("settings.fallbackCalloutDesc"))
		.addDropdown((dd) => {
			// `fallbackCalloutId` is persisted, so only a row that exists on
			// every device may be offered. A theme overlay row exists on this
			// one, for as long as this theme is active — choosing it would put
			// machine-local state into the synced settings file (issue #41).
			const allCallouts = sortCalloutsById(
				ctx.plugin.registry.getAll().filter((c) => c.source !== "theme"),
				getLocale(),
			);
			for (const c of allCallouts) {
				dd.addOption(c.id, c.displayName);
			}
			dd.setValue(ctx.plugin.settings.fallbackCalloutId).onChange(
				async (val) => {
					ctx.plugin.settings.fallbackCalloutId = val;
					ctx.plugin.restyleUncustomizedFallbackRows();
					await ctx.plugin.saveSettings();
					ctx.plugin.refreshCallouts();
				},
			);
		});
}
