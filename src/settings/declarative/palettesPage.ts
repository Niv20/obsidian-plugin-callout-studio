/**
 * settings/declarative/palettesPage.ts — the Saved color palettes page.
 *
 * Who calls it. The settings tab, for the row that opens the page (the first
 * row of the Colors and icons box of the main page, settingsTree.ts).
 *
 * The main idea. The page is one of Obsidian's lists (`type: "list"`), which
 * gives every palette Obsidian's ✕ (and the Delete key), a + that adds one,
 * and a grey row when there is none. A palette's row starts with its colours,
 * because a palette is its colours, then its name and ✎. Every change goes
 * through the palette flows (sections/paletteFlows.ts), so ✕ asks first and
 * says how many callouts link to the palette.
 *
 * While saving is paused nothing changes: + and ✕ (and the Delete key) say
 * why and do nothing, and ✎ is dimmed and says why when pressed.
 */
import { t } from "../../i18n";
import { emptyListState } from "../../ui/mascot/mascotPlaces";
import type { CustomPalette } from "../../types";
import {
	createPalette,
	deletePalette,
	editPalette,
	renderPaletteSwatches,
	sortedPalettes,
} from "../sections/paletteFlows";
import { addBlockableIconButton } from "../../ui/blockedButton";
import { refuseWhilePaused } from "./pausedGuards";
import { countValue, pausedReason } from "./rowParts";
import { guardRender } from "./safeTree";
import type { CsList, CsPage, CsRender, TreeContext } from "./types";

/** The ids of the page and its list: they key them, and name them in a page path. */
export const PALETTES_PAGE = { page: "palettes", list: "palette-list" } as const;

/** The row that opens the page, with how many palettes there are at its end. */
export function palettesPage(ctx: TreeContext): CsPage {
	const palettes = sortedPalettes(ctx.plugin);
	return {
		type: "page",
		id: PALETTES_PAGE.page,
		name: t("settings.customPalettes"),
		displayValue: countValue(palettes.length, { one: "settings.paletteCountOne", many: "settings.paletteCount" }),
		items: [paletteList(ctx, palettes)],
	};
}

/** The list of palettes, A→Z, with Obsidian's +, ✕ and empty row. */
function paletteList(ctx: TreeContext, palettes: readonly CustomPalette[]): CsList {
	const writer = ctx.plugin.settingsWriter;
	const redraw = (): void => ctx.redraw();
	return {
		type: "list",
		id: PALETTES_PAGE.list,
		emptyState: emptyListState(t("settings.customPalettesEmpty"), t("settings.newPalette")),
		addItem: {
			name: t("settings.newPalette"),
			action: refuseWhilePaused(writer, () => { void createPalette(ctx, redraw); }),
		},
		// The rows are drawn in the order of `palettes`, so an index is a place in it.
		onDelete: refuseWhilePaused(writer, (index: number) => {
			const palette = palettes[index];
			if (palette) void deletePalette(ctx, palette, redraw);
		}),
		items: palettes.map((palette) => paletteRow(ctx, palette)),
	};
}

/** One palette: its colours, its name, and ✎ (Obsidian adds ✕). */
function paletteRow(ctx: TreeContext, palette: CustomPalette): CsRender {
	return {
		// Keyed by the palette's id, which a rename does not change.
		id: `palette-${palette.id}`,
		name: palette.name,
		render: guardRender(palette.name, (setting) => {
			const rowEl = setting.settingEl;
			// First in the row, where a list row's icon goes. Drawn at the end and
			// then moved to the front (`insertBefore` the first child), because
			// `createDiv` always appends.
			const swatches = renderPaletteSwatches(rowEl, palette);
			rowEl.insertBefore(swatches, rowEl.firstChild);
			addBlockableIconButton(setting, {
				icon: "pencil",
				label: t("settings.editPaletteAria", { name: palette.name }),
				blockedReason: () => pausedReason(ctx.plugin.settingsWriter),
				onClick: () => { void editPalette(ctx, palette, () => ctx.redraw()); },
			});
			// The colours sit outside the controls, which a redraw empties, so
			// the row's cleanup takes them away before the next draw.
			return () => swatches.remove();
		}),
	};
}
