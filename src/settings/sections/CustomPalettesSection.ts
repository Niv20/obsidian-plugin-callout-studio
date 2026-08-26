/**
 * settings/sections/CustomPalettesSection.ts — "Saved color palettes" section.
 *
 * Lists the user's custom palettes (current-mode accent/background swatch +
 * name + edit/delete) with a "New palette" button opening PaletteEditorModal.
 * Palettes are stored in settings.customPalettes and surfaced in the callout
 * editor's palette dropdown under the "Custom" group. Colors are baked into
 * callouts at apply time; editing a palette here cascades the new colors onto
 * every callout still linked to it (registry.applyPaletteColors), while
 * deleting a palette leaves existing callouts as-is.
 *
 * The heading folds and pages exactly like the three callout lists above it
 * in the settings tab — `attachPersistedFold` for the chevron and the
 * settings-backed fold state, `renderPagedList` for the first-20-then-a-button
 * behavior — so this section is a fourth member of that family rather than a
 * parallel implementation of the same thing.
 */
import { Setting, setIcon } from "obsidian";
import { t } from "../../i18n";
import type { CustomPalette } from "../../types";
import type { SettingsSectionContext } from "./types";
import {
	bakePaletteColors,
	customPaletteToColorPalette,
	generatePaletteId,
} from "../../utils/colorPalettes";
import {
	renderColorCircles,
	resolveCurrentModeColors,
} from "../../ui/ColorCircles";
import { PaletteEditorModal } from "../PaletteEditorModal";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { attachPersistedFold } from "./calloutListsFold";
import {
	focusFirstRevealed,
	headingWithCount,
	renderPagedList,
} from "./listPaging";
import type { PagingState } from "./listPaging";
import { renderOrphanPaletteGroups } from "./PaletteOrphanGroups";

export function renderCustomPalettesSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	const othersExcept = (excludeId?: string): CustomPalette[] =>
		ctx.plugin.settings.customPalettes.filter((p) => p.id !== excludeId);
	const takenNamesExcept = (excludeId?: string): string[] =>
		othersExcept(excludeId).map((p) => p.name);

	/**
	 * Pick up any callouts left behind by an earlier deletion whose colors match
	 * what was just saved. Without it those callouts would sit orphaned until the
	 * next launch, when the load migration would adopt them anyway — the same
	 * pass, just hours later.
	 */
	const adoptOrphans = (): void => {
		ctx.plugin.registry.adoptOrphansMatchingPalettes();
	};

	const heading = new Setting(containerEl)
		.setName(t("settings.customPalettes"))
		.setHeading();
	heading.addButton((btn) =>
		btn
			.setButtonText(t("settings.newPalette"))
			.setCta()
			.onClick(async () => {
				const result = await new PaletteEditorModal(ctx.plugin, {
					takenNames: takenNamesExcept(),
					takenColors: othersExcept(),
				}).openAndWait();
				if (!result) return;
				ctx.plugin.settings.customPalettes.push({
					id: generatePaletteId(),
					...result,
				});
				adoptOrphans();
				await ctx.plugin.saveSettings();
				renderList();
			}),
	);
	const bodyEl = containerEl.createDiv();
	const fold = attachPersistedFold(heading, bodyEl, "palettes", ctx.plugin);
	const paging: PagingState = { expanded: false };

	const editPalette = async (palette: CustomPalette): Promise<void> => {
		const result = await new PaletteEditorModal(ctx.plugin, {
			existing: palette,
			takenNames: takenNamesExcept(palette.id),
			takenColors: othersExcept(palette.id),
		}).openAndWait();
		if (!result) return;
		Object.assign(palette, result);
		// Object.assign never removes keys: when the edit switched the palette
		// to another background style, the absent bgGradient must still clear
		// the stored one (and cascade as an explicit undefined below). Same
		// reasoning for transparentBg — an edit from the "None" style back to
		// Solid has to actually un-transparent the palette — and for colorMode:
		// toggling back to simple and saving must actually clear a stale
		// "advanced" flag, not leave the editor auto-expanded next time.
		palette.bgGradient = result.bgGradient;
		palette.transparentBg = result.transparentBg;
		palette.colorMode = result.colorMode;
		// Baked through the same function the import path uses, so "what this
		// palette means as callout colors" is decided in exactly one place — and
		// every field comes back set (undefined included), which is what lets the
		// cascade clear a background the previous style had left behind.
		// Before the cascade: an orphan the edit just brought into range has to
		// be carrying the palette's id by the time applyPaletteColors walks the
		// map, or it gets adopted now and repainted only on the next edit.
		adoptOrphans();
		ctx.plugin.registry.applyPaletteColors(
			palette.id,
			bakePaletteColors(customPaletteToColorPalette(palette)),
		);
		await ctx.plugin.saveSettings();
		renderList();
	};

	const deletePalette = async (palette: CustomPalette): Promise<void> => {
		// The callouts keep their colors either way — what deletion costs them
		// is the link, so the count is the honest thing to put in front of the
		// user before they confirm.
		const linked = ctx.plugin.registry.countPaletteLinks(palette.id);
		const message =
			linked === 0 ? t("settings.deletePaletteConfirm", { name: palette.name })
			: linked === 1 ?
				t("settings.deletePaletteConfirmLinkedOne", { name: palette.name })
			:	t("settings.deletePaletteConfirmLinked", {
					name: palette.name,
					count: linked,
				});
		const ok = await new ConfirmModal(
			ctx.app,
			t("confirm.titleDeletePalette"),
			message,
		).confirm();
		if (!ok) return;
		const list = ctx.plugin.settings.customPalettes;
		const idx = list.findIndex((p) => p.id === palette.id);
		if (idx >= 0) list.splice(idx, 1);
		await ctx.plugin.saveSettings();
		renderList();
	};

	const renderOrphanGroups = (): void =>
		renderOrphanPaletteGroups(bodyEl, {
			ctx,
			takenNamesExcept,
			othersExcept,
			adoptOrphans,
			onChange: renderList,
		});

	const renderPaletteRow = (listEl: HTMLElement, palette: CustomPalette): void => {
		const row = listEl.createDiv({
			cls: "callout-studio-row cs-palette-list-row",
		});
		const colorsEl = row.createDiv({
			cls: "callout-studio-row-colors",
		});
		const colors = resolveCurrentModeColors(palette);
		renderColorCircles(colorsEl, colors, {
			size: 18,
			ariaLabel: t("settings.colorSwatchAria", {
				accent: colors.accent,
				bg: colors.bg,
			}),
		});
		row.createSpan({
			cls: "cs-palette-list-name",
			text: palette.name,
			attr: { "aria-label": palette.name },
		});

		const buttonsEl = row.createDiv({
			cls: "callout-studio-row-buttons",
		});
		const editBtn = buttonsEl.createEl("button", {
			attr: {
				"aria-label": t("settings.editPaletteAria", {
					name: palette.name,
				}),
			},
		});
		setIcon(editBtn, "pencil");
		editBtn.addEventListener("click", () => void editPalette(palette));
		const deleteBtn = buttonsEl.createEl("button", {
			attr: {
				"aria-label": t("settings.deletePaletteAria", {
					name: palette.name,
				}),
			},
		});
		setIcon(deleteBtn, "trash-2");
		deleteBtn.addEventListener("click", () => void deletePalette(palette));
	};

	const renderList = (): void => {
		bodyEl.empty();
		// Sorted A→Z for display only; the underlying settings array keeps
		// insertion order.
		const palettes = [...ctx.plugin.settings.customPalettes].sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		// The total, never the visible slice — same rule the three callout
		// lists follow for their own "(N)".
		fold.setName(
			headingWithCount(t("settings.customPalettes"), palettes.length),
		);
		if (palettes.length === 0) {
			bodyEl.createDiv({
				cls: "callout-studio-empty-state",
				text: t("settings.customPalettesEmpty"),
			});
			renderOrphanGroups();
			return;
		}
		renderPagedList(bodyEl, palettes, paging, renderPaletteRow, () => {
			renderList();
			focusFirstRevealed(bodyEl);
		});
		renderOrphanGroups();
	};

	// The swatches show the CURRENT theme mode, so re-render on a live theme
	// flip. Debounced: CSSInjector fires "css-change" after every inject.
	let refreshTimer: number | null = null;
	const cssRef = ctx.app.workspace.on("css-change", () => {
		if (!bodyEl.isConnected) return;
		if (refreshTimer !== null) window.clearTimeout(refreshTimer);
		refreshTimer = window.setTimeout(() => {
			refreshTimer = null;
			if (bodyEl.isConnected) renderList();
		}, 60);
	});
	ctx.registerDisposer(() => {
		ctx.app.workspace.offref(cssRef);
		if (refreshTimer !== null) window.clearTimeout(refreshTimer);
	});

	renderList();
}
