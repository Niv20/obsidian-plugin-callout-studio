/**
 * settings/sections/CalloutRowRenderer.ts — one callout in the settings lists,
 * drawn as one of Obsidian's own setting rows.
 *
 * Who calls it. The settings pages that list callouts (declarative/
 * calloutPages.ts for every row of *My callout types*, and
 * declarative/calloutListPage.ts for *Built-in callouts* and *Callouts from
 * your theme*), through {@link drawCalloutRow}.
 *
 * The main idea (finding S2-14). A row is an Obsidian `Setting`
 * (`.setting-item`), filled like this:
 *
 *   [icon]  Name  DEFAULT                     ●●  ✎  ⋮
 *           [!id] [!alias]
 *
 * - the **name** is the callout's display name, with a `Default` flair after
 *   it when the callout is the fallback;
 * - the **description** is the callout's `[!id]` spellings, one grey line;
 * - the **controls** are the colour swatches, then ✎ (or 👁 on a theme's
 *   callout) and ⋮, made with `addExtraButton` as Obsidian makes a row's icon
 *   buttons;
 * - the **icon** is our own element at the start of the row. `Setting.setIcon`
 *   takes a Lucide name only, and a callout's icon can be an emoji, a picture
 *   or another library's glyph.
 *
 * ## What a narrow row gives up, and where the colour goes
 *
 * The row keeps all three parts, and each of its two text lines stays one
 * line. The name ends in "…" when it does not fit (its tag, one word in every
 * language, stays beside it). The ids are whole ids, as many as fit, and a
 * `+N` for the rest; one id is never shown cut in half (idsLineFit.ts).
 *
 * The colour is shown by device, not by width. On a computer, as the two
 * circles before the buttons. On a phone or an iPad they are gone, and the
 * icon (a tile in the callout's background, drawn in its accent) and the name
 * (in its accent) carry the colour. The CSS is in styles.css, under *Callout
 * List Rows*; the one thing this file adds for it is the row's
 * `--cs-row-accent` and `--cs-row-bg`, which {@link renderColors} sets.
 *
 * Being a real setting row is what gives Obsidian's keyboard navigation (↑/↓
 * or j/k from row to row, Enter into the row's first button), its inset focus
 * ring, and a row Obsidian can put in a box and find in its search. Until
 * 2026-10-24 the row was a `div.callout-studio-row` of the plugin's own, which
 * the arrow keys skipped.
 *
 * {@link drawCalloutRow} fills a `Setting` made elsewhere: Obsidian hands one
 * to a row of the settings tree, and may ask for the same row again.
 *
 * ## The `kind` decides the row, and it is not `def.builtIn`
 *
 * Which list a row is being drawn in is a *different* question from what the
 * callout is, and the two came apart when the theme group started meaning "the
 * theme paints this": a built-in handed to the theme is drawn as a theme row,
 * while an adopted theme callout is drawn as one of the user's. So `kind` says
 * where the row is and `def.builtIn` says what it is, and both are consulted.
 *
 * A theme row replaces the edit pencil with a read-only view action; its `⋮`
 * contains vault actions rather than appearance controls. Nothing on any row
 * labels who paints it, because the group already did. Its icon and swatches
 * are real, but they come from `registry.themeAppearanceOf(def)` rather than
 * from the row: what the theme was measured drawing, never what the row stores.
 */
import type { Setting } from "obsidian";
import { getLocale, t } from "../../i18n";
import { getSortedCalloutIds } from "../../utils/sorting";
import {
	renderColorCircles,
	resolveCurrentModeColors,
	type SwatchColors,
} from "../../ui/ColorCircles";
import type { CalloutDefinition } from "../../types";
import { renderIconInto, renderNoIcon } from "../../icons/renderIcon";
import { createStatusIconResolver } from "../../icons/resolver";
import type { SettingsContext } from "./types";
import type { RowKind } from "./rowOwnership";
import { addThemeRowControls, openThemeRowMenu } from "./themeRowActions";
import { addRowMenuButton, type RowMenuTrigger } from "./calloutRowMenu";
import { renderThemeIconInto } from "../../manager/theme/renderThemeIcon";
import { addBlockableIconButton } from "../../ui/blockedButton";
import { fitIdsLine } from "./idsLineFit";

/** What a row's buttons do; the lists pass these in. */
export type RowRendererHandlers = {
	onEdit: (def: CalloutDefinition, isBuiltIn: boolean) => void;
	/**
	 * Why ✎ cannot open the editor now (saving is paused), or null when it
	 * can. While there is a reason, ✎ is dimmed and a press says it.
	 */
	editBlockedReason?: () => string | null;
	/** Open a built-in row's menu; `trigger` says from where (⋮ or right-click). */
	onOpenBuiltInMenu: (trigger: RowMenuTrigger, def: CalloutDefinition) => void;
	/** Open one of the user's own rows' menu, the same way. */
	onOpenUserMenu: (trigger: RowMenuTrigger, def: CalloutDefinition) => void;
};

/**
 * Fill `setting`, an empty Obsidian setting row, with one callout.
 *
 * Returns what undoes the things it adds outside the row's controls (the
 * right-click listener and the watch on the ids line), which drawing the same
 * row again would otherwise add a second time. Obsidian empties the controls,
 * the name and the description by itself, and the icon element is reused by the
 * next draw ({@link rowIconElement}), so nothing here takes it off.
 *
 * @param kind Which list the row is in (see the module comment): a theme's
 *   row gets 👁 instead of ✎, the theme's measured colours, and no tag.
 */
export function drawCalloutRow(
	ctx: SettingsContext,
	setting: Setting,
	def: CalloutDefinition,
	kind: RowKind,
	handlers: RowRendererHandlers,
): () => void {
	const fromTheme = kind === "theme";
	const rowEl = setting.settingEl;
	setting.setClass("cs-callout-row");

	const iconEl = rowIconElement(rowEl);
	if (fromTheme) {
		// The theme's real icon, measured off a rendered callout. The stored
		// `def.icon` is still on disk but nothing draws it while the theme owns
		// the id, so showing it would advertise an appearance the reader will
		// never see. An unmeasured row gets the neutral dashed ring rather than
		// a guess.
		renderThemeIconInto(iconEl, ctx.plugin.registry.themeAppearanceOf(def).icon);
	} else {
		renderRowIcon(ctx, iconEl, def);
	}

	// The name is one line and ends in "…" when it is too long, with its tag
	// beside it (styles.css). Its words are a span of their own, because only
	// a box can end in "…" and a flex row wraps loose text in a box that
	// cannot be styled.
	const nameWords = createFragment((fragment) => fragment.createSpan({ cls: "cs-row-name", text: def.displayName }));
	setting.setName(nameWords);
	const tag = rowTag(ctx, def, fromTheme);
	if (tag) {
		setting.nameEl.createSpan({ cls: "flair mod-flat cs-fallback-tag", text: tag });
	}

	renderIdLine(setting.descEl, def);
	const stopFittingIds = fitIdsLine(setting.descEl);
	renderColors(ctx, setting, def, fromTheme);

	// The row's menu, whichever way it is asked for: the ⋮ button below, or a
	// right-click (two-finger click) anywhere on the row, which opens the same
	// menu at the pointer — as a right-click on a row of Obsidian's Community
	// plugins does. `preventDefault` keeps the browser's own menu away.
	const openMenu = (trigger: RowMenuTrigger): void => {
		if (fromTheme) void openThemeRowMenu(ctx, trigger, def);
		else if (def.builtIn) handlers.onOpenBuiltInMenu(trigger, def);
		else handlers.onOpenUserMenu(trigger, def);
	};
	const onContextMenu = (event: MouseEvent): void => {
		event.preventDefault();
		openMenu({ kind: "pointer", row: rowEl, x: event.clientX, y: event.clientY });
	};
	rowEl.addEventListener("contextmenu", onContextMenu);
	// The icon is not taken off here: see rowIconElement.
	const undo = (): void => {
		rowEl.removeEventListener("contextmenu", onContextMenu);
		stopFittingIds();
	};

	if (fromTheme) {
		addThemeRowControls(ctx, setting, def);
		return undo;
	}

	addBlockableIconButton(setting, {
		icon: "pencil",
		label: t("settings.editAria", { name: def.displayName }),
		blockedReason: handlers.editBlockedReason,
		onClick: () => handlers.onEdit(def, def.builtIn),
	});
	addRowMenuButton(setting, def.displayName, openMenu);
	return undo;
}

/**
 * The row's icon element, at the start of the row, where Obsidian puts a row's
 * icon: the one an earlier draw of this row left, emptied, or else a new one.
 *
 * Why it is reused and not removed by the row's cleanup. Obsidian runs every
 * row's cleanup both when it draws the row again and when the reader leaves
 * the page (`closePage`), and in the second case it runs them *before* the
 * page slides away, while all of it is still on screen. A cleanup that removed
 * the icon made every icon vanish for the length of the slide, which with
 * hundreds of callouts is a long, ugly moment. Leaving the page needs no
 * cleanup of the icon at all (the page takes the row with it), and drawing the
 * row again only has to avoid adding a second one.
 */
function rowIconElement(rowEl: HTMLElement): HTMLElement {
	const existing = rowEl.querySelector<HTMLElement>(".callout-studio-row-icon");
	if (existing) {
		// Back to how a new element starts; the painters add what the icon needs.
		existing.empty();
		existing.removeAttribute("aria-label");
		return existing;
	}
	// Made at the end of the row and then moved to the front (`insertBefore`
	// with the first child), because `createDiv` always appends.
	const iconEl = rowEl.createDiv({ cls: "callout-studio-row-icon" });
	rowEl.insertBefore(iconEl, rowEl.firstChild);
	return iconEl;
}

/**
 * The flair after the name, or null for none.
 *
 * Both labels describe how Callout Studio would *style* the callout, so
 * neither says anything true under *Callouts from your theme*: the theme
 * styles those, and the fallback they refer to is never consulted for one.
 * The guard is more than tidying — a pre-existing discovered row the active
 * theme has temporarily taken over still carries `source: "fallback"`, and so
 * wore *Default fallback* while sitting in the theme's section.
 */
function rowTag(ctx: SettingsContext, def: CalloutDefinition, fromTheme: boolean): string | null {
	if (fromTheme) return null;
	if (def.id === ctx.plugin.settings.fallbackCalloutId) return t("settings.fallbackTag");
	if (def.source === "fallback" && def.customized !== true) return t("settings.fallbackTagAuto");
	return null;
}

/**
 * The row's description: every spelling of the callout, `[!id]`, as code.
 *
 * One line: each id is one unbreakable box, and a space separates them, so the
 * line reads (and copies) as words. A row with more ids than fit shows the ones
 * that fit and a `+N` for the rest, with the hidden ids in the line's tooltip
 * ({@link fitIdsLine}); the browser's own "…" would say neither.
 */
export function renderIdLine(descEl: HTMLElement, def: CalloutDefinition): void {
	const ids = getSortedCalloutIds(def, getLocale());
	ids.forEach((id, index) => {
		if (index > 0) descEl.appendText(" ");
		descEl.createEl("code", { cls: "callout-studio-row-syntax", text: `[!${id}]` });
	});
}

/**
 * The row's colours, shown two ways: the colour circles before the buttons,
 * and the same colours handed to the style sheet as the row's `--cs-row-accent`
 * and `--cs-row-bg`, which a row on a phone or an iPad paints its icon and its
 * name with instead of the circles (styles.css, the `.is-mobile` rules).
 *
 * Two sources, two answers. A Studio row shows its own stored colours. A theme
 * row shows the two the probe actually measured off the rendered callout — the
 * accent and the surface behind it — which are real used values rather than a
 * reading of the theme's CSS, and so are right however the theme arrived at
 * them. A theme row that has not been measured shows none: better an empty slot
 * than a confident wrong colour.
 *
 * The variables are set or cleared on every draw, because the same row element
 * is drawn again and a colour from the last draw must not outlive its callout's
 * change. A callout with no background paints no tile, so it has no `--cs-row-bg`.
 */
function renderColors(
	ctx: SettingsContext,
	setting: Setting,
	def: CalloutDefinition,
	fromTheme: boolean,
): void {
	const colors = rowColors(ctx, def, fromTheme);
	setRowVariable(setting.settingEl, "--cs-row-accent", colors?.accent);
	setRowVariable(setting.settingEl, "--cs-row-bg", colors && !colors.transparent ? colors.bg : undefined);
	if (!colors) return;

	const colorsEl = setting.controlEl.createDiv({ cls: "callout-studio-row-colors" });
	renderColorCircles(colorsEl, colors, {
		size: 18,
		ariaLabel: t("settings.colorSwatchAria", { accent: colors.accent, bg: colors.bg }),
	});
}

/** The colours `def`'s row shows, or null when there are none to show. */
function rowColors(ctx: SettingsContext, def: CalloutDefinition, fromTheme: boolean): SwatchColors | null {
	if (!fromTheme) return resolveCurrentModeColors(def);
	const { accent, background } = ctx.plugin.registry.themeAppearanceOf(def);
	return accent ? { accent, bg: background ?? accent } : null;
}

/** Set a CSS variable on the row, or take it off when there is no value. */
function setRowVariable(rowEl: HTMLElement, name: string, value: string | undefined): void {
	if (value) rowEl.style.setProperty(name, value);
	else rowEl.style.removeProperty(name);
}

function renderRowIcon(
	ctx: SettingsContext,
	container: HTMLElement,
	def: CalloutDefinition,
): void {
	if (def.hideIcon === true) {
		renderNoIcon(container);
		return;
	}
	renderIconInto(container, def.icon, createStatusIconResolver(ctx.plugin), {
		role: "regular",
		fill: "currentColor",
		// The settings list is where a stalled download has to be visible, so
		// it shows real progress state rather than a stand-in glyph.
		missing: { kind: "status" },
		errorText: "?",
		errorAriaLabel: t("notice.iconDownloadFailed", { name: def.icon.value }),
	});
}
