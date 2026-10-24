/**
 * settings/sections/CustomPalettesSection.ts — "Saved color palettes" section.
 *
 * Lists the user's custom palettes (current-mode accent/background swatch +
 * name + edit/delete) with a "New palette" button opening PaletteEditorModal.
 * Palettes are stored in settings.customPalettes and surfaced in the callout
 * editor's palette dropdown under the "Custom" group. Colors are baked into
 * callouts at apply time; editing a palette here cascades the new colors onto
 * every callout still linked to it, while deleting a palette leaves existing
 * callouts as-is. Every change goes through the registry's palette writers
 * (`addPalette`, `updatePalette`, `removePalette`), which announce it even
 * when nothing links to the palette — its name is a metadata colour word the
 * stylesheet paints on its own. The first two also adopt the orphans whose
 * colours match.
 *
 * The heading folds, pages and *pins* exactly like the three callout lists
 * above it in the settings tab — `attachPersistedFold` for the chevron and the
 * settings-backed fold state, `renderPagedList` for the first-20-then-a-button
 * behavior, and `createStickySection` for the wrapper that parks the heading at
 * the top of the pane while its rows scroll under it — so this section is a
 * fourth member of that family rather than a parallel implementation of the
 * same thing.
 *
 * The flows (new, edit, delete), the A→Z order and the swatches are exported,
 * so the declarative settings page (declarative/palettesPage.ts) lists the
 * same palettes and changes them through the same code.
 */
import { setIcon } from "obsidian";
import { getLocale, t } from "../../i18n";
import type { CustomPalette } from "../../types";
import type { SettingsSectionContext, SettingsTabPlugin } from "./types";
import { generatePaletteId } from "../../utils/colorPalettes";
import {
	renderColorCircles,
	resolveCurrentModeColors,
} from "../../ui/ColorCircles";
import { PaletteEditorModal } from "../PaletteEditorModal";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { attachPersistedFold } from "./calloutListsFold";
import { keepScrollAnchored } from "./foldAnchor";
import { createStickySection } from "./stickySection";
import { focusFirstRevealed, renderPagedList } from "./listPaging";
import type { PagingState } from "./listPaging";
import { headingWithCount } from "../../ui/faintCount";
import {
	applyMetadataRename,
	askMetadataRename,
	isBuiltInColorWord,
	isStylingWord,
	ownedMetadataKey,
	renamedMetadataWords,
	type MetadataRename,
} from "./paletteMetadataRename";

export function renderCustomPalettesSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	// A fourth pinned section, built exactly like "My callout types" above it —
	// same wrapper, same `cs-subheader-row` heading box (tight, no border, and
	// the layout its CTA button needs). The three wrapper classes are the only
	// difference: `cs-section-divider` for the hairline a wrapped heading no
	// longer gets from the generic rule; `cs-sticky-section-last` because
	// nothing sticky follows, so the band lets go with its own last row rather
	// than hang over "Global settings"; `cs-palettes-section` for the one thing
	// styles.css must special-case — the section above it is not itself pinned,
	// so no body carries a --cs-section-gap down to this divider.
	const { wrapEl, setting: heading } = createStickySection(
		containerEl,
		t("settings.customPalettes"),
	);
	heading.settingEl.addClass("cs-subheader-row");
	wrapEl.addClass(
		"cs-section-divider",
		"cs-sticky-section-last",
		"cs-palettes-section",
	);
	heading.addButton((btn) =>
		btn
			.setButtonText(t("settings.newPalette"))
			.setCta()
			.onClick(() => createPalette(ctx, renderList)),
	);
	const bodyEl = wrapEl.createDiv();
	const fold = attachPersistedFold(heading, bodyEl, "palettes", ctx.plugin);
	const paging: PagingState = { expanded: false };

	const renderPaletteRow = (listEl: HTMLElement, palette: CustomPalette): void => {
		const row = listEl.createDiv({
			cls: "callout-studio-row cs-palette-list-row",
		});
		renderPaletteSwatches(row.createDiv({ cls: "callout-studio-row-colors" }), palette);
		// A long name wraps instead of being cut, so no tooltip repeats it.
		row.createSpan({
			cls: "cs-palette-list-name",
			text: palette.name,
		});

		const buttonsEl = row.createDiv({
			cls: "callout-studio-row-buttons",
		});
		const editBtn = buttonsEl.createEl("button", {
			cls: "clickable-icon",
			attr: {
				"aria-label": t("settings.editPaletteAria", {
					name: palette.name,
				}),
			},
		});
		setIcon(editBtn, "pencil");
		editBtn.addEventListener("click", () => void editPalette(ctx, palette, renderList));
		const deleteBtn = buttonsEl.createEl("button", {
			cls: "clickable-icon",
			attr: {
				"aria-label": t("settings.deletePaletteAria", {
					name: palette.name,
				}),
			},
		});
		setIcon(deleteBtn, "trash-2");
		deleteBtn.addEventListener("click", () => void deletePalette(ctx, palette, renderList));
	};

	/**
	 * What this section would draw, as one comparable string.
	 *
	 * Declared above `renderList` because that is where it is *recorded* — every
	 * path that redraws goes through there, so recording it at the source is
	 * what keeps the `css-change` comparison below honest. Storing it only at
	 * the comparison would leave the stamp describing a page two renders old.
	 */
	const paletteSignature = (): string =>
		JSON.stringify([
			activeDocument.body.classList.contains("theme-dark"),
			getLocale(),
			paging.expanded,
			ctx.plugin.settings.customPalettes,
		]);
	let lastSignature: string | null = null;

	const renderList = (): void => {
		lastSignature = paletteSignature();
		bodyEl.empty();
		const palettes = sortedPalettes(ctx.plugin);
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
			return;
		}
		renderPagedList(bodyEl, palettes, paging, renderPaletteRow, () => {
			renderList();
			focusFirstRevealed(bodyEl);
		});
	};

	// The swatches show the CURRENT theme mode, so re-render on a live theme
	// flip. Debounced: CSSInjector fires "css-change" after every inject.
	//
	// Two guards around that, for the same reason the callout lists have them —
	// this section sits above the eight below it, so a repaint here moves all of
	// them under whoever is reading one. The signature drops the repaints that
	// would have drawn the identical thing (which is most of them: `css-change`
	// fires for any theme, snippet or other plugin, and the palettes themselves
	// rarely move), and the anchor makes the ones that survive it invisible.
	let refreshTimer: number | null = null;
	const cssRef = ctx.app.workspace.on("css-change", () => {
		if (!bodyEl.isConnected) return;
		if (refreshTimer !== null) window.clearTimeout(refreshTimer);
		refreshTimer = window.setTimeout(() => {
			refreshTimer = null;
			if (!bodyEl.isConnected) return;
			if (paletteSignature() === lastSignature) return;
			keepScrollAnchored(containerEl, renderList);
		}, 60);
	});
	ctx.registerDisposer(() => {
		ctx.app.workspace.offref(cssRef);
		if (refreshTimer !== null) window.clearTimeout(refreshTimer);
	});

	renderList();
}

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
export async function createPalette(ctx: SettingsSectionContext, redraw: () => void): Promise<void> {
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
	ctx: SettingsSectionContext,
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
	ctx: SettingsSectionContext,
	palette: CustomPalette,
	redraw: () => void,
): Promise<void> {
	const ok = await new ConfirmModal(
		ctx.app,
		t("confirm.titleDeletePalette"),
		deletePaletteQuestion(ctx.plugin, palette),
	).confirm();
	if (!ok) return;
	ctx.plugin.registry.removePalette(palette.id);
	await ctx.plugin.saveSettings();
	redraw();
}

/** What the delete question says about `palette`. */
function deletePaletteQuestion(plugin: SettingsTabPlugin, palette: CustomPalette): string {
	// The callouts keep their colors either way — what deletion costs them
	// is the link, so the count is the honest thing to put in front of the
	// user before they confirm.
	const linked = plugin.registry.countPaletteLinks(palette.id);
	const base =
		linked === 0 ? t("settings.deletePaletteConfirm", { name: palette.name })
		: linked === 1 ?
			t("settings.deletePaletteConfirmLinkedOne", { name: palette.name })
		:	t("settings.deletePaletteConfirmLinked", {
				name: palette.name,
				count: linked,
			});
	// What happens to `[!type|its-word]` in notes: nothing, by design.
	// Only the case that is not obvious is said: a palette named "Pink"
	// was holding the word of a built-in colour, which takes over again.
	const key = ownedMetadataKey(plugin.settings.customPalettes, palette.id, reservedWords(plugin));
	const note = !key ? ""
		: isBuiltInColorWord(key) ? t("settings.deletePaletteMetadataNoteBuiltIn", { key })
		: "";
	return note ? `${base}\n${note}` : base;
}
