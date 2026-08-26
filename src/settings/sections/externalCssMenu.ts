/**
 * settings/sections/externalCssMenu.ts — handing a callout to the user's own
 * CSS, from a row's ⋯ menu.
 *
 * The one styling decision still left to the user, and it is deliberately not
 * about the theme. Whether the *theme* paints a callout is derived from the
 * theme's own stylesheet — the user cannot set it and does not need to, because
 * the section the row sits in reports it. What this item says is narrower and
 * genuinely the user's to say: *I style this one myself, in a snippet.*
 *
 * So a row that has taken it stays exactly where it was, in the user's own
 * section, and wears an **External CSS** label. It is the only label on any
 * row, and it earns its place: unlike theme ownership, nothing about the row's
 * position spells this out, and a callout the plugin silently stopped painting
 * with no explanation is the most confusing state available.
 *
 * Its own module because `CalloutRowActions.ts` sits at the repo's line cap,
 * and because the *sequence* after the flag changes is the fiddly part: three
 * refreshes in a particular order, and a notice. That belongs in one place, not
 * duplicated across the built-in and user menus.
 */
import { Menu, Notice } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";

/**
 * Offer to hand this callout to the user's own CSS, or to take it back.
 *
 * Omitted, rather than shown disabled, on the active Default fallback callout:
 * that definition is what `generateFallbackCSS` paints every *unknown* callout
 * with, so it cannot also style nothing, and a permanently greyed row explains
 * less than its absence costs.
 *
 * Never reached for a theme-owned callout — those rows have their own menu
 * (`themeRowActions.ts`), which carries no styling actions at all, because the
 * plugin already emits nothing for them and offering to stop would be a control
 * that changes nothing.
 */
export function addExternalCssMenuItem(
	menu: Menu,
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
	/** False when nothing was added since the last separator, so the divider
	 * this item sits under would land directly on another one. */
	separate: boolean,
): void {
	if (def.id === ctx.plugin.settings.fallbackCalloutId) return;
	if (separate) menu.addSeparator();

	const external = def.externalStyle === true;
	menu.addItem((item) => {
		item.setTitle(
			external
				? t("settings.externalCssStopAction")
				: t("settings.externalCssAction"),
		)
			.setIcon(external ? "paintbrush" : "code")
			.onClick(() => {
				void applyExternalCss(ctx, def, !external);
			});
	});
}

/**
 * Set or clear the flag and put every surface that caches this callout's look
 * back in step.
 *
 * `refreshRenderModes()` is the one that is easy to forget and impossible to
 * work around: heading and inline callouts in Reading view are baked DOM, and
 * their appearance changes with the flag, so a note left open across the switch
 * would keep showing the old drawing.
 */
async function applyExternalCss(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
	external: boolean,
): Promise<void> {
	if (!ctx.plugin.registry.setExternalStyle(def.id, external)) return;
	await ctx.plugin.saveSettings();
	ctx.plugin.refreshCallouts();
	ctx.plugin.refreshRenderModes();
	ctx.display();
	new Notice(
		external
			? t("notice.externalCssOn", { name: def.displayName })
			: t("notice.externalCssOff", { name: def.displayName }),
	);
}
