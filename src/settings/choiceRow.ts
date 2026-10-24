/**
 * settings/choiceRow.ts — one choice in Import's source chooser or Export's
 * format chooser: a row of an Obsidian setting group, with a button that does it.
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ ▣  Callout Studio backup  RECOMMENDED                 │
 *   │    One line on what this option is.      [ Export… ]  │
 *   └──────────────────────────────────────────────────────┘
 *
 * Who calls it. ImportSourceModal and ExportFormatModal, once per choice.
 *
 * The main idea (finding S9-09). Each choice is drawn the way Obsidian's own
 * settings draw an action: the option's icon, its name and a line about it,
 * and a button at the end of the row. Only the button is pressed; the row
 * itself does not light up or take a click. Each choice used to be a raised
 * grey card with an icon tile and a chevron, the whole card one button.
 */
import { setIcon } from "obsidian";
import type { SettingGroup } from "obsidian";
import { renderRecommendedBadge } from "./recommendedBadge";

/** What one choice shows and does. */
export interface ChoiceRowSpec {
	/** The Lucide icon in front of the name. */
	icon: string;
	title: string;
	desc: string;
	/** Adds Obsidian's grey "Recommended" tag after the name. */
	recommended?: boolean;
	/** The button's words. */
	buttonText: string;
	/** What pressing the button does. */
	onActivate: () => void;
}

/** A counter for element ids that are unique in the document. */
let nextId = 0;

/**
 * Add one choice to `group` as a row with its own button.
 *
 * @param group The setting group the row goes in.
 * @param spec What the row shows and what its button does.
 */
export function addChoiceRow(group: SettingGroup, spec: ChoiceRowSpec): void {
	group.addSetting((row) => {
		row.setName(spec.title).setDesc(spec.desc);
		row.settingEl.addClass("cs-choice-row");

		// The option's emblem in front, in Obsidian's `setting-item-icon` (what
		// `Setting.setIcon` builds; that method is not in Obsidian's typings).
		const iconEl = createDiv({ cls: "setting-item-icon" });
		setIcon(iconEl, spec.icon);
		row.settingEl.insertBefore(iconEl, row.settingEl.firstChild);

		if (spec.recommended) renderRecommendedBadge(row.nameEl);

		row.addButton((button) => {
			button.setButtonText(spec.buttonText);
			// Read out as "Export…, Callout Studio backup": the button's words
			// alone would leave two "Import…" buttons a screen reader cannot
			// tell apart. `aria-labelledby` rather than `aria-label`, which
			// Obsidian would show as a tooltip.
			nextId += 1;
			const buttonId = `callout-studio-choice-${nextId}`;
			const nameId = `${buttonId}-name`;
			button.buttonEl.id = buttonId;
			row.nameEl.id = nameId;
			button.buttonEl.setAttribute("aria-labelledby", `${buttonId} ${nameId}`);
			button.buttonEl.addEventListener("click", (evt) => {
				// Only a double-click's first click counts: the second would do
				// again what the first already did (a second file picker, a
				// second export).
				if (evt.detail > 1) return;
				spec.onActivate();
			});
		});
	});
}
