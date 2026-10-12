/**
 * settings/sections/fallbackStyleAction.ts — *Use default fallback style*, and
 * its way back.
 *
 * The action hands a callout's look to the default fallback callout: its icon,
 * colours, background and icon adjustments are overwritten with the
 * fallback's, and keep following it from then on
 * (`CalloutRegistry.convertToFallback`). It asks nothing first, so the notice
 * it ends with carries Undo, the way Delete's does.
 */
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import { blockedWhilePaused } from "../pausedGuard";
import { noticeWithUndoAction } from "../rewriteUndoNotice";
import type { SettingsSectionContext } from "./types";

export async function applyDefaultFallbackStyle(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): Promise<void> {
	const { registry } = ctx.plugin;
	// The registry's row rather than the menu's copy: Undo has to put back the
	// look the callout has now, not the one the list was drawn with.
	const current = registry.get(def.id);
	if (!current) return;
	const previous = structuredClone(current);
	if (!registry.convertToFallback(def.id)) return;
	await ctx.plugin.saveSettings();
	ctx.plugin.refreshCallouts();
	ctx.display();
	noticeWithUndoAction(t("notice.fallbackStyleApplied", { name: previous.displayName }), () => {
		void restoreOwnStyle(ctx, previous);
	});
}

/** Undo: the callout's own look back, unless the row has moved on since. */
export async function restoreOwnStyle(
	ctx: SettingsSectionContext,
	previous: CalloutDefinition,
): Promise<void> {
	if (blockedWhilePaused(ctx.plugin.settingsWriter)) return;
	const { registry } = ctx.plugin;
	const current = registry.get(previous.id);
	// Deleted, renamed, edited (`customized`) or made the fallback itself since:
	// each is a newer choice than the one being undone, so it stands.
	if (
		!current ||
		current.source !== "fallback" ||
		current.customized === true ||
		registry.settings.fallbackCalloutId === previous.id
	) return;
	const restored: Partial<CalloutDefinition> = structuredClone(previous);
	// `update` merges, so a field the fallback brought and the callout never
	// had, such as a gradient or a text colour, has to be cleared by name.
	for (const key of Object.keys(current) as (keyof CalloutDefinition)[]) {
		if (!(key in previous)) restored[key] = undefined;
	}
	if (!registry.update(previous.id, restored)) return;
	await ctx.plugin.saveSettings();
	ctx.plugin.refreshCallouts();
	ctx.display();
}
