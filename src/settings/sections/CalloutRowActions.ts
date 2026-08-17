/**
 * settings/sections/CalloutRowActions.ts — Row-level context menus in the settings list.
 *
 * Opens a dropdown Menu for a callout row when the user clicks the three-dot
 * button. User rows get options like Edit, Delete, Convert to fallback; built-in
 * rows get Reset to default and Convert to fallback. Delete and replace flows
 * open ConfirmModal / DeleteCalloutModal / ReplaceCalloutModal as needed.
 * Depends on vaultCalloutScanner for usage counts before destructive actions.
 */
import { Menu, Notice } from "obsidian";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { DeleteCalloutModal } from "../../utils/DeleteCalloutModal";
import { ReplaceCalloutModal } from "../../utils/ReplaceCalloutModal";
import {
	convertCalloutsToPlainTextInVault,
	countCalloutUsages,
	replaceCalloutIdsInVault,
} from "../../utils/vaultCalloutScanner";
import { t } from "../../i18n";
import type { App } from "obsidian";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";
import { addExternalStyleMenuItem } from "./styleModeMenu";

const convertVaultCalloutsToPlainText = (
	app: App,
	def: CalloutDefinition,
	ids: string[],
): Promise<{ files: number; blocks: number }> =>
	// The display name is what a heading or inline usage falls back to: those
	// carry no text besides the token, so it is all they have left.
	convertCalloutsToPlainTextInVault(app, ids, def.displayName);

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
					void handleBuiltInCalloutDelete(ctx, def, usage);
				}),
		);
	}

	// The two blocks above are both conditional, so an unmodified, unused
	// built-in has added nothing since the separator after the usage line.
	addExternalStyleMenuItem(menu, ctx, def, modified || usage.fileCount > 0);

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

	menu.addItem((item) =>
		item
			.setTitle(t("settings.deleteAction"))
			.setIcon("trash-2")
			.onClick(() => {
				void handleCalloutDelete(ctx, def, usage);
			}),
	);

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

	// A user row always has the Delete item above, so the divider always lands
	// on something.
	addExternalStyleMenuItem(menu, ctx, def, true);

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

async function handleCalloutDelete(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
	knownUsage?: { fileCount: number; totalCount: number },
): Promise<void> {
	const allIds = ctx.plugin.registry.vaultIdFormsFor(def);
	const usage = knownUsage ?? (await countCalloutUsages(ctx.app, allIds));

	const action = await new DeleteCalloutModal(ctx.app, {
		def,
		usage,
	}).prompt();

	if (action === "cancel") return;

	if (action === "replace") {
		await handleCalloutReplace(ctx, def);
		return;
	}

	if (usage.fileCount > 0) {
		const result = await convertVaultCalloutsToPlainText(
			ctx.app,
			def,
			allIds,
		);
		new Notice(
			t("vault.convertedToPlainText", {
				blocks: String(result.blocks),
				files: String(result.files),
			}),
		);
	}
	// Delete is authoritative. Suppress before removing, so the open-editor scan
	// that ctx.display() runs one line down cannot resurrect the row from a
	// CodeMirror buffer that has not yet caught up with the conversion above —
	// it would come back as an uncustomized fallback row, reading as "delete
	// only reset my callout". Every id form goes in, not just the primary one.
	ctx.plugin.suppressCalloutRediscovery(allIds);
	ctx.plugin.registry.remove(def.id);
	ctx.plugin.registry.cleanupUnusedIconSvgs();
	// Awaited, and not just for tidiness: cleanupUnusedIconSvgs does not notify,
	// so without this its trimmed cache misses the save `remove` kicked off and
	// rides on whatever save happens next.
	await ctx.plugin.saveSettings();
	ctx.display();
}

async function handleBuiltInCalloutDelete(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
	knownUsage?: { fileCount: number; totalCount: number },
): Promise<void> {
	const allIds = ctx.plugin.registry.vaultIdFormsFor(def);
	const usage = knownUsage ?? (await countCalloutUsages(ctx.app, allIds));
	if (usage.fileCount === 0) return;

	const action = await new DeleteCalloutModal(ctx.app, {
		def,
		usage,
	}).prompt();

	if (action === "cancel") return;

	if (action === "replace") {
		await handleCalloutReplace(ctx, def);
		return;
	}

	const result = await convertVaultCalloutsToPlainText(ctx.app, def, allIds);
	new Notice(
		t("vault.convertedToPlainText", {
			blocks: String(result.blocks),
			files: String(result.files),
		}),
	);
	ctx.display();
}

async function handleCalloutReplace(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): Promise<void> {
	const allIds = ctx.plugin.registry.vaultIdFormsFor(def);
	const { fileCount, totalCount } = await countCalloutUsages(ctx.app, allIds);
	const otherCallouts = ctx.plugin.registry
		.getAll()
		.filter((c) => c.id !== def.id);
	if (otherCallouts.length === 0) {
		new Notice(t("vault.noReplacementAvailable"));
		return;
	}

	const message =
		fileCount > 0
			? t("vault.replacePromptInUse", {
					name: def.displayName,
					count: String(totalCount),
					files: String(fileCount),
				})
			: t("vault.replacePromptUnused", { name: def.displayName });

	const result = await new ReplaceCalloutModal(ctx.app, {
		mode: "replace",
		message,
		availableCallouts: otherCallouts,
		registry: ctx.plugin.registry,
	}).prompt();

	if (result.action !== "replace") return;

	if (fileCount > 0) {
		// The name travels with the type. A header this plugin wrote carries the
		// callout's display name as its title, so swapping the token alone would
		// leave `> [!danger] Warning` behind. Only a title that is exactly the
		// old name is touched — one the user wrote themselves is theirs.
		const target = otherCallouts.find((c) => c.id === result.replaceWith);
		const replaced = await replaceCalloutIdsInVault(
			ctx.app,
			allIds,
			result.replaceWith,
			target && target.displayName !== def.displayName
				? { from: def.displayName, to: target.displayName }
				: undefined,
		);
		new Notice(t("vault.filesUpdated", { count: String(replaced) }));
	} else {
		new Notice(t("vault.filesUpdated", { count: "0" }));
	}
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
