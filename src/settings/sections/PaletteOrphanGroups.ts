/**
 * settings/sections/PaletteOrphanGroups.ts — "Unlinked colors" sub-section of
 * Saved color palettes.
 *
 * The groups of callouts a deleted palette left behind, each offering to
 * rebuild it. Without this the only route back was inside the callout
 * editor's Color row, which meant finding a member of the group first. Split
 * out of CustomPalettesSection.ts, which owns the palette list itself and the
 * fold/paging it now shares with the three callout lists — this sub-section
 * neither folds nor pages, so keeping it separate is what let that file stay
 * under the repo's line-count ratchet instead of raising it.
 */
import { Setting } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition, CustomPalette } from "../../types";
import type { SettingsSectionContext } from "./types";
import {
	bakePaletteColors,
	customPaletteToColorPalette,
	findPaletteWithSameColors,
	generatePaletteId,
	paletteSeedFromDefinition,
} from "../../utils/colorPalettes";
import {
	renderColorCircles,
	resolveCurrentModeColors,
} from "../../ui/ColorCircles";
import { PaletteEditorModal } from "../PaletteEditorModal";

export type OrphanGroupsHost = {
	ctx: SettingsSectionContext;
	takenNamesExcept: (excludeId?: string) => string[];
	othersExcept: (excludeId?: string) => CustomPalette[];
	adoptOrphans: () => void;
	/** Re-render the palette list — a restore changes its membership. */
	onChange: () => void;
};

export function renderOrphanPaletteGroups(
	containerEl: HTMLElement,
	host: OrphanGroupsHost,
): void {
	const { ctx, takenNamesExcept, othersExcept, adoptOrphans, onChange } = host;
	const groups = ctx.plugin.registry.listOrphanPaletteGroups();
	if (groups.length === 0) return;

	/**
	 * Rebuild a deleted palette from the callouts it left behind, and re-link
	 * the whole group to it.
	 *
	 * Checks for an existing palette with the same colors FIRST. Under the
	 * no-duplicate-colors rule the editor would refuse to save a rebuild of one
	 * that already exists, so opening it on a seed that duplicates a live
	 * palette would be a dead end — and linking to the live palette is what the
	 * user wanted anyway.
	 */
	const restoreOrphanGroup = async (group: {
		paletteId: string;
		count: number;
		sample: CalloutDefinition;
	}): Promise<void> => {
		const seed = paletteSeedFromDefinition(group.sample);
		const existing = findPaletteWithSameColors(
			{ id: "", name: "", group: "custom", ...seed },
			ctx.plugin.settings.customPalettes,
		);
		let target = existing;
		if (!target) {
			const result = await new PaletteEditorModal(ctx.plugin, {
				seed,
				takenNames: takenNamesExcept(),
				takenColors: othersExcept(),
			}).openAndWait();
			if (!result) return;
			target = { id: generatePaletteId(), ...result };
			ctx.plugin.settings.customPalettes.push(target);
			// Another deletion may have left its own group on these exact
			// colors. One color is one palette now, so those callouts belong
			// here too rather than waiting for a restore that the duplicate
			// rule would refuse to save.
			adoptOrphans();
		}
		ctx.plugin.registry.relinkPalette(group.paletteId, target.id);
		ctx.plugin.registry.applyPaletteColors(
			target.id,
			bakePaletteColors(customPaletteToColorPalette(target)),
		);
		await ctx.plugin.saveSettings();
		onChange();
	};

	new Setting(containerEl)
		.setName(t("settings.unlinkedColors"))
		.setDesc(t("settings.unlinkedColorsDesc"))
		.setHeading();
	for (const group of groups) {
		const row = containerEl.createDiv({
			cls: "callout-studio-row cs-palette-list-row",
		});
		const colorsEl = row.createDiv({ cls: "callout-studio-row-colors" });
		const colors = resolveCurrentModeColors(group.sample);
		renderColorCircles(colorsEl, colors, {
			size: 18,
			ariaLabel: t("settings.colorSwatchAria", {
				accent: colors.accent,
				bg: colors.bg,
			}),
		});
		row.createSpan({
			cls: "cs-palette-list-name",
			text:
				group.count === 1 ?
					t("settings.unlinkedColorOne")
				:	t("settings.unlinkedColorCount", { count: group.count }),
		});
		const buttonsEl = row.createDiv({ cls: "callout-studio-row-buttons" });
		const restoreBtn = buttonsEl.createEl("button", {
			text: t("settings.restoreColor"),
		});
		restoreBtn.addEventListener("click", () => void restoreOrphanGroup(group));
	}
}
