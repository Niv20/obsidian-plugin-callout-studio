/**
 * settings/sections/HotkeySection.ts — Keyboard shortcut settings section.
 *
 * One row, one button. Everything about commands — the built-in ones, the
 * user's own, and what each is bound to — lives in the window behind it, so
 * this section stays a door rather than a second place to read the same list.
 */
import { Setting } from "obsidian";
import { t } from "../../i18n";
import { CommandBuilderModal } from "../CommandBuilderModal";
import type { SettingsSectionContext } from "./types";

export function renderHotkeySection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	new Setting(containerEl)
		.setName(t("settings.keyboardShortcuts"))
		.setHeading();

	new Setting(containerEl)
		.setName(t("settings.customCommands"))
		.setDesc(t("settings.customCommandsDesc"))
		.addButton((btn) => {
			btn.setButtonText(t("settings.customCommandsButton")).onClick(() => {
				new CommandBuilderModal(ctx.app, ctx.plugin).open();
			});
			btn.buttonEl.addClass("cs-settings-neutral-btn");
		});
}
