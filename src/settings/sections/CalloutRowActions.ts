/**
 * settings/sections/CalloutRowActions.ts — Row-level context menus in the settings list.
 *
 * Opens a dropdown Menu for a callout row when the user clicks the three-dot
 * button. User rows get Duplicate, Convert uses to plain text, Delete and
 * Convert to fallback; built-in rows get Reset to default and Convert uses to
 * plain text, never Delete. The flows behind them live next door in
 * `calloutVaultActions.ts` — this file decides which items a row is offered.
 * Menu counts come from the read-only occurrence index; the actions still
 * count current contents before they ask anything.
 */
import { ConfirmModal } from "../../utils/ConfirmModal";
import { countCalloutUsages } from "../../utils/vaultCalloutScanner";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";
import { addConvertUsesItem, addDeleteItem } from "./rowOwnership";
import { addUsageMenuItem } from "../../usage/usageMenuItem";
import { openCalloutRowMenu } from "./calloutRowMenu";
import { addDuplicateItem } from "./duplicateCallout";
import { handleCalloutReplace } from "./calloutVaultActions";

const convertRegistryCalloutToFallback = (
	ctx: SettingsSectionContext,
	id: string,
): boolean => ctx.plugin.registry.convertToFallback(id);

export async function openBuiltInRowMenu(
	ctx: SettingsSectionContext,
	event: MouseEvent,
	def: CalloutDefinition,
): Promise<void> {
	return openCalloutRowMenu(ctx, event, (menu) => {
		const allIds = ctx.plugin.registry.vaultIdFormsFor(def);
		const usage = addUsageMenuItem(menu, ctx.app, allIds);
		const modified = ctx.plugin.registry.isBuiltInModified(def.id);

		if (modified || usage?.fileCount !== 0) menu.addSeparator();

		if (modified) {
			menu.addItem((item) =>
				item
					.setTitle(t("settings.resetAction"))
					.setIcon("rotate-ccw")
					.onClick(() => {
						void handleBuiltInReset(ctx, def);
					}),
			);
		}

		if (usage?.fileCount !== 0) {
			menu.addItem((item) =>
				item
					.setTitle(t("settings.replaceAction"))
					.setIcon("arrow-left-right")
					.onClick(() => {
						void handleCalloutReplace(ctx, def);
					}),
			);
		}

		// No Delete: Obsidian keeps declaring a built-in, so the type cannot go.
		addConvertUsesItem(menu, ctx, def, usage);
	});
}

export async function openRowMenu(
	ctx: SettingsSectionContext,
	event: MouseEvent,
	def: CalloutDefinition,
): Promise<void> {
	return openCalloutRowMenu(ctx, event, (menu) => {
		const allIds = ctx.plugin.registry.vaultIdFormsFor(def);
		const usage = addUsageMenuItem(menu, ctx.app, allIds);

		menu.addSeparator();
		addDuplicateItem(menu, ctx, def);

		if (usage?.fileCount !== 0) {
			menu.addItem((item) =>
				item
					.setTitle(t("settings.replaceAction"))
					.setIcon("arrow-left-right")
					.onClick(() => {
						void handleCalloutReplace(ctx, def);
					}),
			);
		}

		addConvertUsesItem(menu, ctx, def, usage);
		addDeleteItem(menu, ctx, def);

		const isFallbackTarget = def.id === ctx.plugin.settings.fallbackCalloutId;
		const alreadyMirrors = def.source === "fallback" && def.customized !== true;

		if (!isFallbackTarget && !alreadyMirrors) {
			menu.addItem((item) =>
				item
					.setTitle(t("settings.makeFallbackAction"))
					.setIcon("rotate-ccw")
					.onClick(() => {
						void handleConvertToFallback(ctx, def);
					}),
			);
		}
	});
}

async function handleConvertToFallback(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): Promise<void> {
	if (!convertRegistryCalloutToFallback(ctx, def.id)) {
		return;
	}
	await ctx.plugin.saveSettings();
	ctx.plugin.refreshCallouts();
	ctx.display();
}

async function handleBuiltInReset(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): Promise<void> {
	const original = ctx.plugin.registry.getBuiltInDefault(def.id);
	if (original) {
		const currentAliases = def.aliases ?? [];
		const originalAliasSet = new Set(
			(original.aliases ?? []).map((a) => a.toLowerCase()),
		);
		const customAliases = currentAliases.filter(
			(a) => !originalAliasSet.has(a.toLowerCase()),
		);

		if (customAliases.length > 0) {
			const { fileCount, totalCount } = await countCalloutUsages(
				ctx.app,
				ctx.plugin.registry.vaultIdFormsFor(def, customAliases),
			);
			if (fileCount > 0) {
				const confirmed = await new ConfirmModal(
					ctx.app,
					t("confirm.titleResetCallout"),
					t("vault.resetAliasWarning", {
						count: String(totalCount),
						files: String(fileCount),
						aliases: customAliases.join(", "),
					}),
					t("vault.resetConfirm"),
				).confirm();
				if (!confirmed) return;
			}
		}
	}

	ctx.plugin.registry.resetBuiltIn(def.id);
	ctx.display();
}
