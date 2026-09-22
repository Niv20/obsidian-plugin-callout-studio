/**
 * settings/sections/EditorFeaturesSection.ts — Context-menu settings.
 *
 * The context menu is always enabled and only exposes menu-item customization.
 */
import { Setting } from "obsidian";
import { t } from "../../i18n";
import { MenuCustomizationModal } from "../MenuCustomizationModal";
import type { SettingsSectionContext } from "./types";

export function renderContextMenuSettingsSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	new Setting(containerEl).setName(t("settings.contextMenu")).setHeading();

	new Setting(containerEl)
		.setName(t("settings.customizeMenu"))
		.setDesc(t("settings.customizeMenuDesc"))
		.addButton((btn) => {
			btn.setButtonText(t("settings.customizeMenuButton")).onClick(() => {
				new MenuCustomizationModal(ctx.app, ctx.plugin).open();
			});
			btn.buttonEl.addClass("cs-settings-neutral-btn");
		});
}
