/**
 * settings/sections/CalloutRowRenderer.ts — Renders a single callout row in settings.
 *
 * Builds the DOM for one row in the callout lists: icon, display name, ID
 * badges, color circles, and action buttons. Calls back into CalloutRowActions
 * for the three-dot menu and into CalloutEditor for the edit flow.
 * Used by CalloutListsSection for both the user list and the built-in list.
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

type RowRendererHandlers = {
	onEdit: (def: CalloutDefinition, isBuiltIn: boolean) => void;
	onOpenBuiltInMenu: (event: MouseEvent, def: CalloutDefinition) => void;
	onOpenUserMenu: (event: MouseEvent, def: CalloutDefinition) => void;
};

export function renderCalloutRow(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
	def: CalloutDefinition,
	isBuiltIn: boolean,
	handlers: RowRendererHandlers,
): void {
	const external = def.externalStyle === true;
	const row = containerEl.createDiv({ cls: "callout-studio-row" });
	if (external) row.addClass("is-external-style");

	const iconEl = row.createDiv({ cls: "callout-studio-row-icon" });
	if (external) {
		// The stored icon and colours are still on disk, but nothing renders
		// them while the theme owns the callout — showing them would advertise
		// an appearance the reader will never see. Left empty rather than
		// standing in with a placeholder glyph; the slot's fixed width/height
		// (see styles.css) keeps the row lined up with its neighbours either way.
	} else {
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
	if (external) {
		// First branch on purpose: it outranks every badge below, because
		// "the theme styles this" is the only one that says the plugin is not
		// painting the callout at all.
		nameLine.createSpan({
			cls: "cs-fallback-tag",
			text: t("settings.externalStyleTag"),
		});
	} else if (def.styleMode === "force") {
		// Second, and above the fallback badges for the same reason in reverse:
		// this row is the one place the user can see that a callout is being
		// pushed harder than the rest, which is what they will look for when a
		// theme conflict turns out to be fixed on some rows and not others.
		nameLine.createSpan({
			cls: "cs-fallback-tag",
			text: t("settings.forceStyleTag"),
		});
	} else if (def.id === ctx.plugin.settings.fallbackCalloutId) {
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

	// Swatches are omitted entirely for an external row rather than dimmed: the
	// theme's real colours can't be read back honestly (a nested `.theme-dark`
	// wrapper misses a theme that writes `body.theme-dark …`, so only the
	// current mode could ever be probed), and showing the stored pair would
	// name two colours that are not in effect.
	if (!external) {
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

	const editBtn = buttonsEl.createEl("button", {
		attr: {
			"aria-label": t("settings.editAria", { name: def.displayName }),
		},
	});
	setIcon(editBtn, "pencil");
	editBtn.addEventListener("click", () => {
		handlers.onEdit(def, isBuiltIn);
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
		if (isBuiltIn) {
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
