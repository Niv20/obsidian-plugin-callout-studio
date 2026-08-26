/**
 * settings/sections/CalloutRowRenderer.ts — Renders a single callout row in settings.
 *
 * Builds the DOM for one row in the callout lists: icon, display name, ID
 * badges, color circles, and action buttons. Calls back into CalloutRowActions
 * for the three-dot menu and into CalloutEditor for the edit flow.
 *
 * ## The `kind` decides the row, and it is not `def.builtIn`
 *
 * Which list a row is being drawn in is a *different* question from what the
 * callout is, and the two came apart when the theme group started meaning "the
 * theme paints this": a built-in handed to the theme is drawn as a theme row,
 * while an adopted theme callout is drawn as one of the user's. So `kind` says
 * where the row is and `def.builtIn` says what it is, and both are consulted.
 *
 * A theme row carries no pencil and no `⋯` — see `themeRowActions.ts` for why
 * each of those would be a lie — and nothing on any row labels who paints it,
 * because the group already did. Its icon and swatches are real, but they come
 * from `registry.themeAppearanceOf(def)` rather than from the row: what the
 * theme was measured drawing, never what the row stores.
 */
import { setIcon } from "obsidian";
import { getLocale, t } from "../../i18n";
import { getSortedCalloutIds } from "../../utils/sorting";
import {
	renderColorCircles,
	resolveCurrentModeColors,
} from "../../ui/ColorCircles";
import type { CalloutDefinition } from "../../types";
import { renderIconInto, renderNoIcon } from "../../icons/renderIcon";
import { createStatusIconResolver } from "../../icons/resolver";
import type { SettingsSectionContext } from "./types";
import type { RowKind } from "./rowOwnership";
import { renderThemeRowControls } from "./themeRowActions";
import { renderThemeIconInto } from "../../manager/theme/renderThemeIcon";

type RowRendererHandlers = {
	onEdit: (def: CalloutDefinition, isBuiltIn: boolean) => void;
	onOpenBuiltInMenu: (event: MouseEvent, def: CalloutDefinition) => void;
	onOpenUserMenu: (event: MouseEvent, def: CalloutDefinition) => void;
};

export function renderCalloutRow(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
	def: CalloutDefinition,
	kind: RowKind,
	handlers: RowRendererHandlers,
): void {
	const fromTheme = kind === "theme";
	// The user handed this one to their own snippet. Unlike a theme row there
	// is nothing to read back — a snippet can style the callout, or not, and
	// either way the plugin has no rendered element of its own to measure — so
	// the slot stays empty and the label carries the explanation.
	const ownCss = !fromTheme && def.externalStyle === true;
	const row = containerEl.createDiv({ cls: "callout-studio-row" });

	const iconEl = row.createDiv({ cls: "callout-studio-row-icon" });
	if (fromTheme) {
		// The theme's real icon, measured off a rendered callout. The stored
		// `def.icon` is still on disk but nothing draws it while the theme owns
		// the id, so showing it would advertise an appearance the reader will
		// never see. An unmeasured row gets the neutral dashed ring rather than
		// a guess.
		renderThemeIconInto(iconEl, ctx.plugin.registry.themeAppearanceOf(def).icon);
	} else if (!ownCss) {
		renderRowIcon(ctx, iconEl, def);
	}

	const infoEl = row.createDiv({ cls: "callout-studio-row-info" });
	const nameLine = infoEl.createDiv({
		cls: "callout-studio-row-name-line",
	});
	nameLine.createSpan({
		cls: "callout-studio-row-name",
		text: def.displayName,
		attr: { "aria-label": def.displayName },
	});
	// Both labels describe how Callout Studio would *style* the callout, so
	// neither says anything true under *Callouts from your theme*: the theme
	// styles those, and the fallback they refer to is never consulted for one.
	// The guard is more than tidying — a pre-existing discovered row the active
	// theme has temporarily taken over still carries `source: "fallback"`, and
	// so wore *Default fallback* while sitting in the theme's section.
	if (!fromTheme) {
		if (def.id === ctx.plugin.settings.fallbackCalloutId) {
			nameLine.createSpan({
				cls: "cs-fallback-tag",
				text: t("settings.fallbackTag"),
			});
		} else if (def.source === "fallback" && def.customized !== true) {
			nameLine.createSpan({
				cls: "cs-fallback-tag",
				text: t("settings.fallbackTagAuto"),
			});
		}
	}
	// The one label on any row, and the only state the list's own structure
	// cannot express. Theme ownership is spelled by the section a row is in;
	// this is a callout sitting among the user's own, in their own section,
	// that Callout Studio has nonetheless stopped painting — and unexplained,
	// that is the most confusing row in the tab.
	if (ownCss) {
		nameLine.createSpan({
			cls: "cs-fallback-tag cs-external-tag",
			text: t("settings.externalCssTag"),
		});
	}
	const syntaxLine = infoEl.createDiv({
		cls: "callout-studio-row-syntax-line",
	});
	const allIds = getSortedCalloutIds(def, getLocale());
	for (const id of allIds) {
		syntaxLine.createEl("code", {
			cls: "callout-studio-row-syntax",
			text: `[!${id}]`,
		});
	}

	// Three sources, three answers. A Studio row shows its own stored colours.
	// A theme row shows the two the probe actually measured off the rendered
	// callout — the accent and the surface behind it — which are real used
	// values rather than a reading of the theme's CSS, and so are right however
	// the theme arrived at them. A row the user handed to their own CSS shows
	// none: there is no rendered element of ours to measure, and the stored pair
	// would name colours that are not in effect.
	if (fromTheme) {
		const { accent, background } =
			ctx.plugin.registry.themeAppearanceOf(def);
		if (accent) {
			const colorsEl = row.createDiv({
				cls: "callout-studio-row-colors",
			});
			renderColorCircles(
				colorsEl,
				{ accent, bg: background ?? accent },
				{
					size: 18,
					ariaLabel: t("settings.colorSwatchAria", {
						accent,
						bg: background ?? accent,
					}),
				},
			);
		}
	} else if (!ownCss) {
		const colorsEl = row.createDiv({ cls: "callout-studio-row-colors" });
		const colors = resolveCurrentModeColors(def);
		renderColorCircles(colorsEl, colors, {
			size: 18,
			ariaLabel: t("settings.colorSwatchAria", {
				accent: colors.accent,
				bg: colors.bg,
			}),
		});
	}

	const buttonsEl = row.createDiv({ cls: "callout-studio-row-buttons" });

	if (fromTheme) {
		renderThemeRowControls(ctx, buttonsEl, def);
		return;
	}

	const editBtn = buttonsEl.createEl("button", {
		attr: {
			"aria-label": t("settings.editAria", { name: def.displayName }),
		},
	});
	setIcon(editBtn, "pencil");
	editBtn.addEventListener("click", () => {
		handlers.onEdit(def, def.builtIn);
	});

	const moreBtn = buttonsEl.createEl("button", {
		cls: "callout-studio-more-btn",
		attr: {
			"aria-label": t("settings.moreRowActionsAria", {
				name: def.displayName,
			}),
		},
	});
	setIcon(moreBtn, "more-horizontal");
	moreBtn.addEventListener("click", (event) => {
		if (def.builtIn) {
			handlers.onOpenBuiltInMenu(event, def);
			return;
		}
		handlers.onOpenUserMenu(event, def);
	});
}

function renderRowIcon(
	ctx: SettingsSectionContext,
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
