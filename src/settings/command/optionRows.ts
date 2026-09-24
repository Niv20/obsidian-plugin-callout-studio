/**
 * settings/command/optionRows.ts — the command editor's two plain dropdowns.
 *
 * *Heading level* and *Action* are the rows with no rule of their own: a fixed
 * list of options, a value, a change. This module owns their controls while
 * `CommandEditorModal` coordinates the command being edited.
 *
 * Each returns its row and dropdown, because the modal's `syncVisibility()` is what
 * decides whether the row is shown for the current format.
 */
import { Setting } from "obsidian";
import { t } from "../../i18n";
import { SelectDropdown } from "../../ui/selectDropdown";
import { HEADING_LEVELS } from "../../utils/customCommands";
import type { CustomCommandAction } from "../../types";

export interface ChoiceRow { el: HTMLElement; dropdown: SelectDropdown; }

export function buildHeadingLevelRow(
	parent: HTMLElement,
	value: number,
	onChange: (level: number) => void,
): ChoiceRow {
	const setting = new Setting(parent)
		.setName(t("commandBuilder.headingLevel"))
		.setClass("cs-command-field")
		.setDesc(t("commandBuilder.headingLevelDesc"));
	const dropdown = new SelectDropdown(setting.controlEl, t("commandBuilder.headingLevel"));
	for (const level of HEADING_LEVELS) dropdown.addOption(String(level), `H${level}`);
	dropdown.setValue(String(value)).onChange((v) => onChange(Number(v)));
	return { el: setting.settingEl, dropdown };
}

export function buildActionRow(
	parent: HTMLElement,
	value: CustomCommandAction,
	onChange: (action: CustomCommandAction) => void,
): ChoiceRow {
	const setting = new Setting(parent)
		.setName(t("commandBuilder.action"))
		.setClass("cs-command-field")
		.setDesc(t("commandBuilder.actionDesc"));
	const dropdown = new SelectDropdown(setting.controlEl, t("commandBuilder.action"))
		.addOption("wrap", t("commandBuilder.actionWrap"))
		.addOption("insert", t("commandBuilder.actionInsert"))
		.setValue(value).onChange((v) => onChange(v as CustomCommandAction));
	return { el: setting.settingEl, dropdown };
}
