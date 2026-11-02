/**
 * settings/command/hotkeyRow.ts — the shortcut half of a command row.
 *
 * Who calls it. The Commands and shortcuts settings page
 * (declarative/commandsPage.ts), for the user's own commands and the built-in
 * ones alike, so the two lists cannot disagree about what a command is bound
 * to or where ⊕ leads.
 *
 * The main idea. Both pieces are drawn the way Obsidian's own Hotkeys page
 * draws them ({@link addObsidianHotkeyChips}, {@link addHotkeyExtraButton}), so
 * app.css gives them Obsidian's look.
 */
import type { App, Setting } from "obsidian";
import { t } from "../../i18n";
import {
	fullCommandId,
	hotkeysForCommand,
	openHotkeySettings,
} from "../hotkeyLink";

/**
 * What a command is bound to, drawn as Obsidian's Hotkeys page draws it: one
 * `span.setting-hotkey` per shortcut in a `div.setting-command-hotkeys`, and
 * "Blank" (`mod-empty`) when there is none; app.css draws them. Without the ✕
 * each one has there: removing a shortcut is the Hotkeys page's job.
 */
export function addObsidianHotkeyChips(
	app: App,
	pluginId: string,
	parentEl: HTMLElement,
	shortId: string,
): HTMLElement {
	const listEl = parentEl.createDiv({ cls: "setting-command-hotkeys" });
	const shortcuts = hotkeysForCommand(app, fullCommandId(pluginId, shortId));
	for (const shortcut of shortcuts) listEl.createSpan({ cls: "setting-hotkey", text: shortcut });
	if (shortcuts.length === 0) {
		listEl.createSpan({ cls: "setting-hotkey mod-empty", text: t("commandBuilder.hotkeyBlank") });
	}
	return listEl;
}

/**
 * ⊕ at the end of a row, which opens Obsidian's Hotkeys page on this command,
 * as the rows of Obsidian's Core plugins page have it. `mod-hotkeys` is how
 * Obsidian hides it on a phone, where there is no keyboard to bind.
 */
export function addHotkeyExtraButton(setting: Setting, app: App, pluginName: string, name: string): void {
	setting.addExtraButton((button) => {
		button
			.setIcon("plus-circle")
			.setTooltip(t("commandBuilder.hotkeyAria", { name }))
			// Searched by the name the Hotkeys page shows, plugin first.
			.onClick(() => openHotkeySettings(app, `${pluginName}: ${name}`));
		button.extraSettingsEl.addClass("mod-hotkeys");
	});
}
