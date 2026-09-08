/**
 * settings/command/foldStateRow.ts — the *Fold state* control, and the rule
 * about which formats may show it.
 *
 * Three states, one for each header a block command can write: `[!note]`,
 * `[!note]+` and `[!note]-`. Both block actions offer it, because Wrap
 * selection and Insert new write the same header line and differ only in what
 * goes under it.
 *
 * Heading and inline are not narrower versions of the same choice — they have
 * no fold syntax at all. `### [!tip]- Title` is the `tip` callout titled
 * `- Title`, and `[!tip]-` inline is a pill followed by a dash, so a mark
 * written for either is a stray character in output that looks correct. That is
 * why the row hides rather than greying out, and why the gate lives here beside
 * the control instead of in `CommandEditorModal`: the option shown and the
 * format allowed to show it are one answer, the same argument
 * `commandRoles.ts` makes for its own row.
 */
import { Setting } from "obsidian";
import { t } from "../../i18n";
import type { CalloutRenderRole, CustomCommandFold } from "../../types";

/** Fold options in the order the user is shown them. */
const FOLD_ORDER: readonly CustomCommandFold[] = [
	"none",
	"expanded",
	"collapsed",
];

const FOLD_LABEL_KEY: Record<CustomCommandFold, string> = {
	none: "commandBuilder.foldNone",
	expanded: "commandBuilder.foldExpanded",
	collapsed: "commandBuilder.foldCollapsed",
};

export interface FoldStateRow {
	/** Show the row only for the one format that has fold syntax. */
	sync(role: CalloutRenderRole): void;
}

export function buildFoldStateRow(
	parent: HTMLElement,
	initial: CustomCommandFold,
	onPick: (fold: CustomCommandFold) => void,
): FoldStateRow {
	const setting = new Setting(parent)
		.setName(t("commandBuilder.foldState"))
		.setDesc(t("commandBuilder.foldStateDesc"))
		.addDropdown((dd) => {
			for (const fold of FOLD_ORDER) {
				dd.addOption(fold, t(FOLD_LABEL_KEY[fold]));
			}
			dd.setValue(initial).onChange((raw) =>
				onPick(raw as CustomCommandFold),
			);
		});

	return {
		sync(role) {
			setting.settingEl.toggleClass("cs-row-hidden", role !== "regular");
		},
	};
}
