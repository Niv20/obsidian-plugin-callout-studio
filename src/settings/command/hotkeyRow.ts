/**
 * settings/command/hotkeyRow.ts — the shortcut half of a command row.
 *
 * Both lists in *Manage commands* carry it — the user's own commands and the
 * built-in ones — and they must not be able to disagree about what a command
 * is bound to or where the click leads, so there is one implementation.
 *
 * The declarative settings page draws it the way Obsidian's own Hotkeys page
 * does instead ({@link addObsidianHotkeyChips}, {@link addHotkeyExtraButton}).
 */
import { setIcon } from "obsidian";
import type { App, Setting } from "obsidian";
import { t } from "../../i18n";
import {
fullCommandId,
hotkeysForCommand,
openHotkeySettings,
} from "../hotkeyLink";

/**
 * What a command is bound to, beside its name — one pill per shortcut.
 *
 * Several, not one: Obsidian lets a command hold any number of bindings, and
 * showing only the first would have this window quietly disagree with the
 * pane it links to. They go in the name line, which already wraps, so a
 * command with a handful of shortcuts grows a second row rather than pushing
 * the buttons off the end.
 *
 * A command with none still gets a pill, reading "Blank" as the hotkeys pane
 * does — the alternative leaves the two states structurally different rows.
 *
 * These are `<span>`s and wear no Obsidian chrome (`.cs-hotkey-chip`, see
 * styles.css): a label, deliberately not something to click.
 */
export function addHotkeyChips(
	app: App,
	pluginId: string,
	nameLine: HTMLElement,
	shortId: string,
): HTMLElement[] {
	const shortcuts = hotkeysForCommand(app, fullCommandId(pluginId, shortId));
	const labels =
		shortcuts.length > 0 ? shortcuts : [t("commandBuilder.hotkeyBlank")];
	const chips: HTMLElement[] = [];
	for (const label of labels) {
		chips.push(nameLine.createSpan({ cls: "cs-hotkey-chip", text: label }));
	}
	return chips;
}

/**
 * The button that opens Obsidian's hotkeys pane on this command.
 *
 * Bound or blank it does the same thing, so there is one button rather than
 * an add/change pair. It is built bare on purpose: everything about how it
 * looks comes from `.callout-studio-row-buttons button`, which is what makes
 * it identical to the pencil and the bin beside it.
 *
 * `disabled` is for a fixed command the user switched off: with nothing
 * registered there is nowhere for the click to lead.
 */
export function addHotkeyButton(
	app: App,
	pluginName: string,
	close: () => void,
	buttonsEl: HTMLElement,
	name: string,
	disabled = false,
): HTMLButtonElement {
	const btn = buttonsEl.createEl("button", {
		attr: { "aria-label": t("commandBuilder.hotkeyAria", { name }) },
	});
	setIcon(btn, "circle-plus");
	btn.disabled = disabled;
	btn.addEventListener("click", () => {
		if (btn.disabled) return;
		// The pane opens in the settings window behind this one, so staying
		// open would leave the user looking at a modal over what they asked
		// for. Search by the rendered name, which is what the pane matches on.
		close();
		openHotkeySettings(app, `${pluginName}: ${name}`);
	});
	return btn;
}

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
