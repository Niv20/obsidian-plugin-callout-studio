/**
 * settings/command/calloutRow.ts — the command editor's "Callout type" row.
 *
 * A third module beside `commandRoles.ts` and `foldStateRow.ts`, for the reason
 * they give: `CommandEditorModal` sits against the repo's 300-line ratchet, so
 * a row that grows goes in a sibling rather than into the modal.
 *
 * This row used to be a `<select>` whose every option read `Abstract
 * (abstract)` — the display name with the id welded on in parentheses. For a
 * built-in the id is just the lowercased name, so the suffix said nothing; and
 * where it did differ it read like the first of several aliases rather than the
 * id. The ids are still searchable through {@link CalloutCombobox}; they are
 * simply shown on the row that needed them, rather than on all of them.
 */
import { Setting } from "obsidian";
import { t } from "../../i18n";
import { CalloutCombobox } from "../calloutCombobox";
import { CalloutEditor } from "../CalloutEditor";
import type { CalloutEditorPlugin } from "../editor/types";
import type { CalloutDefinition } from "../../types";

export interface CalloutRow {
	/** The picker holds a document listener; the modal releases it on close. */
	destroy(): void;
}

export function buildCalloutRow(
	parent: HTMLElement,
	host: CalloutEditorPlugin,
	choices: () => readonly CalloutDefinition[],
	value: string,
	onChange: (id: string) => void,
): CalloutRow {
	const setting = new Setting(parent)
		.setName(t("commandBuilder.callout"))
		.setClass("cs-command-callout-setting")
		.setDesc(t("commandBuilder.calloutDesc"));

	const picker = new CalloutCombobox(setting.controlEl, {
		registry: host.registry,
		choices,
		value,
		ariaLabel: t("commandBuilder.callout"),
		// A command for a callout that does not exist yet is a perfectly
		// ordinary thing to want, and this is where the user finds out it is
		// missing — so make it here rather than sending them to another window.
		onCreate: (name) =>
			new CalloutEditor(host, undefined, {
				seedDisplayName: name,
			}).openAndWait(),
		onChange,
	});

	return { destroy: () => picker.destroy() };
}
