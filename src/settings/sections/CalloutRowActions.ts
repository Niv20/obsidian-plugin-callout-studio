/**
 * settings/sections/CalloutRowActions.ts — Row-level context menus in the settings list.
 *
 * Opens a dropdown Menu for a callout row when the user clicks the three-dot
 * button. User rows get options like Delete and Convert to fallback; built-in
 * rows get Reset to default. The flows that actually rewrite notes live next
 * door in `calloutVaultActions.ts` — this file decides which items a row is
 * offered, and asks `vaultCalloutScanner` for the usage counts that decision
 * turns on.
 *
 * Rows under *Callouts from your theme* never reach here: they have no ⋯ at
 * all, because nothing this menu offers would be true of them. See
 * `themeRowActions.ts`.
 */
import { Menu } from "obsidian";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { countCalloutUsages } from "../../utils/vaultCalloutScanner";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";
import { addExternalCssMenuItem } from "./externalCssMenu";
import { addDeleteItem } from "./rowOwnership";
import {
	handleCalloutReplace,
	handleClearCalloutUsages,
} from "./calloutVaultActions";

const convertRegistryCalloutToFallback = (
	ctx: SettingsSectionContext,
	id: string,
): boolean => ctx.plugin.registry.convertToFallback(id);

export async function openBuiltInRowMenu(
	ctx: SettingsSectionContext,
	event: MouseEvent,
	def: CalloutDefinition,
): Promise<void> {
	const allIds = ctx.plugin.registry.vaultIdFormsFor(def);
	const usage = await countCalloutUsages(ctx.app, allIds);
	const menu = new Menu();
	const modified = ctx.plugin.registry.isBuiltInModified(def.id);

	addUsageInfoMenuItem(menu, usage);
	menu.addSeparator();

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

	if (usage.fileCount > 0) {
		menu.addItem((item) =>
			item
				.setTitle(t("settings.replaceAction"))
				.setIcon("arrow-left-right")
				.onClick(() => {
					void handleCalloutReplace(ctx, def);
				}),
		);

		menu.addItem((item) =>
			item
				.setTitle(t("settings.deleteAction"))
				.setIcon("trash-2")
				.onClick(() => {
					void handleClearCalloutUsages(ctx, def, usage);
				}),
		);
	}

	// The two blocks above are both conditional, so an unmodified, unused
	// built-in has added nothing since the separator after the usage line.
	addExternalCssMenuItem(menu, ctx, def, modified || usage.fileCount > 0);

	menu.showAtMouseEvent(event);
}

export async function openRowMenu(
	ctx: SettingsSectionContext,
	event: MouseEvent,
	def: CalloutDefinition,
): Promise<void> {
	const allIds = ctx.plugin.registry.vaultIdFormsFor(def);
	const usage = await countCalloutUsages(ctx.app, allIds);
	const menu = new Menu();

	addUsageInfoMenuItem(menu, usage);
	menu.addSeparator();

	if (usage.fileCount > 0) {
		menu.addItem((item) =>
			item
				.setTitle(t("settings.replaceAction"))
				.setIcon("arrow-left-right")
				.onClick(() => {
					void handleCalloutReplace(ctx, def);
				}),
		);
	}

	addDeleteItem(menu, ctx, def, usage);

	const isFallbackTarget = def.id === ctx.plugin.settings.fallbackCalloutId;
	const alreadyMirrors = def.source === "fallback" && def.customized !== true;
	if (!isFallbackTarget && !alreadyMirrors) {
		menu.addItem((item) =>
			item
				.setTitle(t("settings.makeFallbackAction"))
				.setIcon("sparkles")
				.onClick(() => {
					void handleConvertToFallback(ctx, def);
				}),
		);
	}

	// A user row always has at least the usage line above, so the divider
	// always lands on something.
	addExternalCssMenuItem(menu, ctx, def, true);

	menu.showAtMouseEvent(event);
}

function addUsageInfoMenuItem(
	menu: Menu,
	usage: { fileCount: number; totalCount: number },
): void {
	menu.addItem((item) =>
		item
			.setTitle(
				t("settings.usageInfo", {
					count: String(usage.totalCount),
					files: String(usage.fileCount),
				}),
			)
			.setIcon("info")
			.setDisabled(true),
	);
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
