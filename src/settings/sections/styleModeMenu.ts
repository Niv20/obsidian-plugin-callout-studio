/**
 * settings/sections/styleModeMenu.ts — who styles this callout, from a row's
 * ⋯ menu.
 *
 * Split out of `CalloutRowActions.ts` (frozen by CLAUDE.md's ~300-line rule)
 * because this is where the answer stops being a single checkbox: the plugin
 * loses a majority of specificity contests against a theme that escalates, so
 * "Callout Studio or the theme" is not the whole question. Keeping the control
 * in its own module is what leaves room for the rest of the answer.
 *
 * Behaviour here is unchanged from when it lived next door.
 */
import { Menu, Notice } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";

/**
 * The "External style" toggle, shared by both row menus — it applies to every
 * callout, built-in or user-made.
 *
 * Shown disabled rather than hidden on the active Default fallback callout, so
 * the reason is discoverable: that definition is what `generateFallbackCSS`
 * paints every *unknown* callout with, so it cannot also style nothing
 * (`CalloutRegistry.setExternalStyle` refuses it too).
 */
export function addExternalStyleMenuItem(
	menu: Menu,
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
	/** False when nothing was added since the last separator, so the divider
	 * this item sits under would land directly on another one. */
	separate: boolean,
): void {
	const external = def.externalStyle === true;
	const isFallbackTarget = def.id === ctx.plugin.settings.fallbackCalloutId;
	if (separate) menu.addSeparator();
	menu.addItem((item) => {
		item.setTitle(t("settings.externalStyleAction"))
			.setIcon("paintbrush")
			.setChecked(external)
			.onClick(() => {
				void handleToggleExternalStyle(ctx, def, !external);
			});
		if (isFallbackTarget && !external) {
			item.setDisabled(true).setTitle(
				`${t("settings.externalStyleAction")} — ${t("settings.externalStyleBlocked")}`,
			);
		}
	});
}

async function handleToggleExternalStyle(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
	on: boolean,
): Promise<void> {
	if (!ctx.plugin.registry.setExternalStyle(def.id, on)) return;
	await ctx.plugin.saveSettings();
	ctx.plugin.refreshCallouts();
	// And the reading view on top of it. refreshCallouts rebuilds Live
	// Preview's decorations, but a reading-view heading callout or inline callout is
	// baked DOM that only a post-processor pass adds or strips — without this
	// the `[!id]` the theme now owns keeps its bar until the note is reopened.
	// Same call, and the same reason, as a render-role toggle.
	ctx.plugin.refreshRenderModes();
	ctx.display();
	new Notice(
		t(on ? "notice.externalStyleOn" : "notice.externalStyleOff", {
			name: def.displayName,
		}),
	);
}
