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
 * Returns what undoes the two things it adds outside the row's controls (the
 * icon at its start, and the right-click listener), which drawing the same
 * row again would otherwise add a second time. Obsidian empties the controls,
 * the name and the description by itself.
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

	// The icon goes first in the row, where Obsidian puts a row's icon. It is
	// made at the end of the row and then moved to the front (`insertBefore`
	// with the first child), because `createDiv` always appends.
	const iconEl = rowEl.createDiv({ cls: "callout-studio-row-icon" });
	rowEl.insertBefore(iconEl, rowEl.firstChild);
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

	// A long name wraps onto a second line, as any setting's name does.
	setting.setName(def.displayName);
	const tag = rowTag(ctx, def, fromTheme);
	if (tag) {
		setting.nameEl.createSpan({ cls: "flair mod-flat cs-fallback-tag", text: tag });
	}

	renderIdLine(setting.descEl, def);
	renderSwatches(ctx, setting.controlEl, def, fromTheme);

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
	const undo = (): void => {
		iconEl.remove();
		rowEl.removeEventListener("contextmenu", onContextMenu);
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
 * One line: a row with more ids than fit is cut by the browser at the end
 * (styles.css), and because each id is one unbreakable box, the cut always
 * falls between ids. A space separates them, so the line still reads (and
 * copies) as words.
 */
function renderIdLine(descEl: HTMLElement, def: CalloutDefinition): void {
	const ids = getSortedCalloutIds(def, getLocale());
	ids.forEach((id, index) => {
		if (index > 0) descEl.appendText(" ");
		descEl.createEl("code", { cls: "callout-studio-row-syntax", text: `[!${id}]` });
	});
}

/**
 * The two colour circles before the buttons.
 *
 * Two sources, two answers. A Studio row shows its own stored colours. A theme
 * row shows the two the probe actually measured off the rendered callout — the
 * accent and the surface behind it — which are real used values rather than a
 * reading of the theme's CSS, and so are right however the theme arrived at
 * them. A theme row that has not been measured shows none: better an empty slot
 * than a confident wrong colour.
 */
function renderSwatches(
	ctx: SettingsContext,
	controlEl: HTMLElement,
	def: CalloutDefinition,
	fromTheme: boolean,
): void {
	let colors: SwatchColors;
	if (fromTheme) {
		const { accent, background } = ctx.plugin.registry.themeAppearanceOf(def);
		if (!accent) return;
		colors = { accent, bg: background ?? accent };
	} else {
		colors = resolveCurrentModeColors(def);
	}
	const colorsEl = controlEl.createDiv({ cls: "callout-studio-row-colors" });
	renderColorCircles(colorsEl, colors, {
		size: 18,
		ariaLabel: t("settings.colorSwatchAria", { accent: colors.accent, bg: colors.bg }),
	});
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
