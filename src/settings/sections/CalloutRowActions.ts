/**
 * settings/sections/CalloutRowActions.ts — Row-level context menus in the settings list.
 *
 * Opens a dropdown Menu for a callout row when the user clicks the three-dot
 * button. Every menu is drawn in the four groups `rowMenuSections.ts`
 * describes: Find callouts; Replace in vault and Convert uses to plain text;
 * the callout's own definition; Delete. User rows offer Duplicate, Use default
 * fallback style and Delete there; built-in rows offer Reset to default, never
 * Delete. The flows behind them live next door — `calloutVaultActions.ts`,
 * `builtInResetAction.ts` — and this file decides which items a row is offered. Menu counts come from the
 * read-only occurrence index; the actions still count current contents before
 * they ask anything.
 */
import type { Menu } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";
import { addConvertUsesItem, addDeleteItem, addReplaceItem } from "./rowOwnership";
import { addUsageMenuItem } from "../../usage/usageMenuItem";
import { openCalloutRowMenu } from "./calloutRowMenu";
import { addDuplicateItem } from "./duplicateCallout";
import { applyDefaultFallbackStyle } from "./fallbackStyleAction";
import { ROW_MENU_SECTION } from "./rowMenuSections";
import { handleBuiltInReset } from "./builtInResetAction";

export async function openBuiltInRowMenu(
	ctx: SettingsSectionContext,
	event: MouseEvent,
	def: CalloutDefinition,
): Promise<void> {
	return openCalloutRowMenu(ctx, event, (menu) => buildBuiltInRowMenu(menu, ctx, def));
}

/** Find callouts ‖ Replace · Convert ‖ Reset to default, when modified. */
export function buildBuiltInRowMenu(
	menu: Menu,
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): void {
	const usage = addUsageMenuItem(menu, ctx.app, ctx.plugin.registry.vaultIdFormsFor(def));
	addReplaceItem(menu, ctx, def, usage);
	addConvertUsesItem(menu, ctx, def, usage);

	if (ctx.plugin.registry.isBuiltInModified(def.id)) {
		menu.addItem((item) =>
			item
				.setTitle(t("settings.resetAction"))
				.setIcon("rotate-ccw")
				.setSection(ROW_MENU_SECTION.callout)
				.onClick(() => {
					void handleBuiltInReset(ctx, def);
				}),
		);
	}
	// No Delete: Obsidian keeps declaring a built-in, so the type cannot go.
}

export async function openRowMenu(
	ctx: SettingsSectionContext,
	event: MouseEvent,
	def: CalloutDefinition,
): Promise<void> {
	return openCalloutRowMenu(ctx, event, (menu) => buildUserRowMenu(menu, ctx, def));
}

/**
 * Find callouts ‖ Replace · Convert ‖ Duplicate · Use default fallback style
 * ‖ Delete.
 */
export function buildUserRowMenu(
	menu: Menu,
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): void {
	const usage = addUsageMenuItem(menu, ctx.app, ctx.plugin.registry.vaultIdFormsFor(def));
	addReplaceItem(menu, ctx, def, usage);
	addConvertUsesItem(menu, ctx, def, usage);
	addDuplicateItem(menu, ctx, def);

	const isFallbackTarget = def.id === ctx.plugin.settings.fallbackCalloutId;
	const alreadyMirrors = def.source === "fallback" && def.customized !== true;

	if (!isFallbackTarget && !alreadyMirrors) {
		menu.addItem((item) =>
			item
				.setTitle(t("settings.makeFallbackAction"))
				.setIcon("rotate-ccw")
				.setSection(ROW_MENU_SECTION.callout)
				.onClick(() => {
					void applyDefaultFallbackStyle(ctx, def);
				}),
		);
	}

	addDeleteItem(menu, ctx, def);
}
