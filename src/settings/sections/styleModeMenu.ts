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
import type { LocaleKey } from "../../i18n";
import {
	type CalloutStyleMode,
	styleModeOf,
} from "../../manager/styleMode";
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
	const mode = styleModeOf(def);
	const isFallbackTarget = def.id === ctx.plugin.settings.fallbackCalloutId;
	if (separate) menu.addSeparator();

	// Two checkable items rather than a three-way submenu: `MenuItem.setSubmenu`
	// is absent from the pinned typings and this plugin's minAppVersion is
	// 1.7.2, so the portable shape is flat. Neither one checked *is* the third
	// state (normal), which reads correctly without having to be listed, and
	// this stays a strictly additive change to a menu people already know.
	menu.addItem((item) => {
		item.setTitle(t("settings.externalStyleAction"))
			.setIcon("paintbrush")
			.setChecked(mode === "theme")
			.onClick(() => {
				void applyMode(ctx, def, mode === "theme" ? "standard" : "theme");
			});
		if (isFallbackTarget && mode !== "theme") {
			item.setDisabled(true).setTitle(
				`${t("settings.externalStyleAction")} — ${t("settings.externalStyleBlocked")}`,
			);
		}
	});

	menu.addItem((item) =>
		item
			.setTitle(t("settings.forceStyleAction"))
			.setIcon("shield")
			.setChecked(mode === "force")
			.onClick(() => {
				void applyMode(ctx, def, mode === "force" ? "standard" : "force");
			}),
	);
}

/**
 * Which notice each landing state gets. `"standard"` is reachable from either
 * direction, so the key is chosen by the mode arrived *at*, not the one left.
 */
const NOTICE_KEY: Record<CalloutStyleMode, LocaleKey> = {
	theme: "notice.externalStyleOn",
	standard: "notice.externalStyleOff",
	force: "notice.forceStyleOn",
};

/**
 * The write, and everything that has to be repainted after it. Shared by both
 * items so they cannot fall out of step — the mutual exclusion itself is
 * `CalloutRegistry.setStyleMode`'s job, not this one's.
 */
async function applyMode(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
	mode: CalloutStyleMode,
): Promise<void> {
	if (!ctx.plugin.registry.setStyleMode(def.id, mode)) return;
	await ctx.plugin.saveSettings();
	ctx.plugin.refreshCallouts();
	// And the reading view on top of it. refreshCallouts rebuilds Live
	// Preview's decorations, but a reading-view heading callout or inline callout is
	// baked DOM that only a post-processor pass adds or strips — without this
	// the `[!id]` the theme now owns keeps its bar until the note is reopened.
	// Same call, and the same reason, as a render-role toggle.
	ctx.plugin.refreshRenderModes();
	ctx.display();
	new Notice(t(NOTICE_KEY[mode], { name: def.displayName }));
}
