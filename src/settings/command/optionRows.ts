/**
 * settings/command/optionRows.ts — the command editor's two plain dropdowns.
 *
 * *Heading level* and *Action* are the rows with no rule of their own: a fixed
 * list of options, a value, a change. They live here for the reason the other
 * `settings/command/` modules do — `CommandEditorModal` sits against the repo's
 * 300-line ratchet, and rows that carry nothing interesting are the cheapest
 * thing to move out of it.
 *
 * Each returns its `settingEl`, because the modal's `syncVisibility()` is what
 * decides whether the row is shown for the current format.
 */
import { Setting } from "obsidian";
import { t } from "../../i18n";
import { HEADING_LEVELS } from "../../utils/customCommands";
import type { CustomCommandAction } from "../../types";

export function buildHeadingLevelRow(
	parent: HTMLElement,
	value: number,
	onChange: (level: number) => void,
): HTMLElement {
	return new Setting(parent)
		.setName(t("commandBuilder.headingLevel"))
		.setDesc(t("commandBuilder.headingLevelDesc"))
		.addDropdown((dd) => {
			for (const level of HEADING_LEVELS) {
				dd.addOption(String(level), `H${level}`);
			}
			dd.setValue(String(value)).onChange((v) => onChange(Number(v)));
		}).settingEl;
}

export function buildActionRow(
	parent: HTMLElement,
	value: CustomCommandAction,
	onChange: (action: CustomCommandAction) => void,
): HTMLElement {
	return new Setting(parent)
		.setName(t("commandBuilder.action"))
		.setDesc(t("commandBuilder.actionDesc"))
		.addDropdown((dd) => {
			dd.addOption("wrap", t("commandBuilder.actionWrap"));
			dd.addOption("insert", t("commandBuilder.actionInsert"));
			dd.setValue(value).onChange((v) => onChange(v as CustomCommandAction));
		}).settingEl;
}
