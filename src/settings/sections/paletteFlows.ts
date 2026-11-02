/**
 * settings/sections/paletteFlows.ts — what the user does to their
 * saved colour palettes: make one, change one, delete one.
 *
 * Who calls it. The Saved color palettes settings page
 * (declarative/palettesPage.ts).
 *
 * The main idea. Each flow opens the palette editor (or asks before a
 * delete) and changes the palettes through the registry's palette writers
 * (`addPalette`, `updatePalette`, `removePalette`), which announce the change
 * even when nothing links to the palette, since its name is a metadata colour
 * word the stylesheet paints on its own. Editing a palette carries its new
 * colours onto every callout still linked to it; deleting one leaves those
 * callouts as they are. The A→Z order and the colour circles a row shows are
 * here too.
 */
import { t } from "../../i18n";
import type { CustomPalette } from "../../types";
import type { SettingsContext, SettingsTabPlugin } from "./types";
import { generatePaletteId } from "../../utils/colorPalettes";
import {
	renderColorCircles,
	resolveCurrentModeColors,
} from "../../ui/ColorCircles";
import { PaletteEditorModal } from "../PaletteEditorModal";
import { ConfirmModal } from "../../utils/ConfirmModal";
import {
	applyMetadataRename,
	askMetadataRename,
	isBuiltInColorWord,
	isStylingWord,
	ownedMetadataKey,
	renamedMetadataWords,
	type MetadataRename,
} from "./paletteMetadataRename";

/** The saved palettes other than `excludeId` (all of them without one). */
function othersExcept(plugin: SettingsTabPlugin, excludeId?: string): CustomPalette[] {
	return plugin.settings.customPalettes.filter((p) => p.id !== excludeId);
}

/** The names a new or renamed palette may not take. */
function takenNamesExcept(plugin: SettingsTabPlugin, excludeId?: string): string[] {
	return othersExcept(plugin, excludeId).map((p) => p.name);
}

/** The metadata words the user's own snippets keep for themselves. */
function reservedWords(plugin: SettingsTabPlugin): ReadonlySet<string> {
	return plugin.cssInjector.metadataCatalog.snippetWords();
}

/**
 * The saved palettes, A→Z by name: the order both settings pages list them
 * in. Sorted for display only; the settings keep the order they were added.
 */
export function sortedPalettes(plugin: SettingsTabPlugin): CustomPalette[] {
	return [...plugin.settings.customPalettes].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Draw `palette`'s colours into `parent` as two or three circles, in the
 * light or dark mode on screen now. Returns the circles' element.
 */
export function renderPaletteSwatches(parent: HTMLElement, palette: CustomPalette): HTMLElement {
	const colors = resolveCurrentModeColors(palette);
	return renderColorCircles(parent, colors, {
		size: 18,
		ariaLabel: t("settings.colorSwatchAria", {
			accent: colors.accent,
			bg: colors.bg,
		}),
	});
}

/**
 * New palette: open the palette editor and save what it returns.
 * `redraw` draws the list again once the palette is saved.
 */
export async function createPalette(ctx: SettingsContext, redraw: () => void): Promise<void> {
	const result = await new PaletteEditorModal(ctx.plugin, {
		takenNames: takenNamesExcept(ctx.plugin),
		takenColors: othersExcept(ctx.plugin),
	}).openAndWait();
	if (!result) return;
	// Through the registry, which announces it: the new name is a
	// metadata colour word, and only an inject puts it in the sheet.
	ctx.plugin.registry.addPalette({ id: generatePaletteId(), ...result });
	await ctx.plugin.saveSettings();
	redraw();
}

/**
 * Edit `palette` in the palette editor and save the result, rewriting the
 * notes that use its old name when the user asked for that.
 * `redraw` draws the list again once the palette is saved.
 */
export async function editPalette(
	ctx: SettingsContext,
	palette: CustomPalette,
	redraw: () => void,
): Promise<void> {
	// A new name is a new metadata word. What the notes still using the old
	// one should do is asked by the editor's Save, before anything is saved,
	// so the question's Cancel goes back to the editor.
	const asked: { rename: MetadataRename | null } = { rename: null };
	const result = await new PaletteEditorModal(ctx.plugin, {
		existing: palette,
		takenNames: takenNamesExcept(ctx.plugin, palette.id),
		takenColors: othersExcept(ctx.plugin, palette.id),
		beforeSave: async (draft, stillOpen) => {
			const answer = await askMetadataRename({
				app: ctx.app,
				name: { from: palette.name, to: draft.name },
				word: renamedMetadataWords(ctx.plugin.settings.customPalettes, palette.id, draft.name, reservedWords(ctx.plugin)),
				sharedWord: (word) =>
					isBuiltInColorWord(word) ||
					isStylingWord(word, ctx.plugin.cssInjector.metadataCatalog.sourcesNow()),
				stillWanted: stillOpen,
			});
			asked.rename = answer?.rewrite ?? null;
			return answer !== null;
		},
	}).openAndWait();
	if (!result) return;
	// One round for the linked callouts and the palette's own colour word —
	// announced even when nothing links to it, and before a rename rewrites
	// the notes, so the new word is in the sheet when they change.
	ctx.plugin.registry.updatePalette(palette.id, result);
	await ctx.plugin.saveSettings();
	redraw();
	if (asked.rename) await applyMetadataRename(ctx.app, asked.rename);
}

/**
 * Delete `palette` once the user confirms, saying first how many callouts
 * link to it. `redraw` draws the list again once it is gone.
 */
export async function deletePalette(
	ctx: SettingsContext,
	palette: CustomPalette,
	redraw: () => void,
): Promise<void> {
	const ok = await new ConfirmModal(
		ctx.app,
		t("settings.deletePaletteTitle"),
		deletePaletteQuestion(ctx.plugin, palette),
	).withMascot(t("confirm.subtitleName", { name: palette.name })).confirm();
	if (!ok) return;
	ctx.plugin.registry.removePalette(palette.id);
	await ctx.plugin.saveSettings();
	redraw();
}

/**
 * What the delete window says under its heading (`Delete palette`, with the
 * palette's name in quotes on the line below) about `palette`.
 */
function deletePaletteQuestion(plugin: SettingsTabPlugin, palette: CustomPalette): string {
	// The callouts keep their colors either way — what deletion costs them
	// is the link, so the count is the honest thing to put in front of the
	// user before they confirm.
	const linked = plugin.registry.countPaletteLinks(palette.id);
	const base =
		linked === 0 ? t("settings.deletePaletteBody")
		: linked === 1 ? t("settings.deletePaletteBodyLinkedOne")
		: t("settings.deletePaletteBodyLinked", { count: linked });
	// What happens to `[!type|its-word]` in notes: nothing, by design.
	// Only the case that is not obvious is said: a palette named "Pink"
	// was holding the word of a built-in colour, which takes over again.
	const key = ownedMetadataKey(plugin.settings.customPalettes, palette.id, reservedWords(plugin));
	const note = !key ? ""
		: isBuiltInColorWord(key) ? t("settings.deletePaletteMetadataNoteBuiltIn", { key })
		: "";
	return note ? `${base}\n${note}` : base;
}
