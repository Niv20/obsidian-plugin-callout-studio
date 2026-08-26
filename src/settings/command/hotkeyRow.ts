/**
 * settings/command/hotkeyRow.ts — the shortcut half of a command row.
 *
 * Both lists in *Manage commands* carry it — the user's own commands and the
 * six fixed ones — and they must not be able to disagree about what a command
 * is bound to or where the click leads, so there is one implementation.
 */
import { setIcon } from "obsidian";
import type { App } from "obsidian";
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
 * These are `<span>`s and wear no Obsidian chrome. The pill is the same one
 * the callout list uses for "Default" / "Default fallback" (`.cs-fallback-tag`,
 * see styles.css): a label, deliberately not something to click.
 */
export function addHotkeyChips(
	app: App,
	pluginId: string,
	nameLine: HTMLElement,
	shortId: string,
): void {
	const shortcuts = hotkeysForCommand(app, fullCommandId(pluginId, shortId));
	const labels =
		shortcuts.length > 0 ? shortcuts : [t("commandBuilder.hotkeyBlank")];
	for (const label of labels) {
		nameLine.createSpan({ cls: "cs-hotkey-chip", text: label });
	}
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
 * registered there is nowhere for the click to lead. The pills stay.
 */
export function addHotkeyButton(
	app: App,
	pluginName: string,
	close: () => void,
	buttonsEl: HTMLElement,
	name: string,
	disabled = false,
): void {
	const btn = buttonsEl.createEl("button", {
		attr: { "aria-label": t("commandBuilder.hotkeyAria", { name }) },
	});
	setIcon(btn, "circle-plus");
	if (disabled) {
		btn.disabled = true;
		return;
	}
	btn.addEventListener("click", () => {
		// The pane opens in the settings window behind this one, so staying
		// open would leave the user looking at a modal over what they asked
		// for. Search by the rendered name, which is what the pane matches on.
		close();
		openHotkeySettings(app, `${pluginName}: ${name}`);
	});
}

