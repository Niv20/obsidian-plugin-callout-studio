/**
 * settings/sections/calloutVaultActions.ts — the row actions that rewrite notes.
 *
 * Split from `CalloutRowActions.ts`, which builds menus. These three do the
 * opposite kind of work: they put a confirmation in front of the user and then
 * walk every markdown file in the vault. Separating them is what lets a
 * surface that is not a menu — the buttons on a theme-styled row — reach the
 * same flows without either duplicating them or importing a menu builder.
 *
 * ## Two deletes, and the difference is what the row can promise
 *
 * {@link handleCalloutDelete} is the real one: the usages become plain
 * paragraphs and the row goes.
 *
 * {@link handleClearCalloutUsages} is for a callout whose definition this
 * plugin does not own — one of Obsidian's thirteen built-ins, or a type the
 * active theme declares. The row cannot go: the registry re-seeds a built-in
 * on every load, and the next theme sweep re-mints a theme's type, so removing
 * it would achieve nothing but a flicker. What it can honestly do is clear the
 * usages and leave the type where it is, which is exactly what it does — and
 * `DeleteCalloutModal` is told to say so, so the button never implies that
 * anything of the theme's was touched.
 */
import { Notice } from "obsidian";
import { DeleteCalloutModal } from "../../utils/DeleteCalloutModal";
import { ReplaceCalloutModal } from "../../utils/ReplaceCalloutModal";
import {
	convertCalloutsToPlainTextInVault,
	countCalloutUsages,
	replaceCalloutIdsInVault,
} from "../../utils/vaultCalloutScanner";
import { t } from "../../i18n";
import { activeThemeName } from "../../manager/theme/customCssApi";
import type { App } from "obsidian";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";

const convertVaultCalloutsToPlainText = (
	app: App,
	def: CalloutDefinition,
	ids: string[],
): Promise<{ files: number; blocks: number }> =>
	// The display name is what a heading or inline usage falls back to: those
	// carry no text besides the token, so it is all they have left.
	convertCalloutsToPlainTextInVault(app, ids, def.displayName);

export async function handleCalloutDelete(
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
	ctx.plugin.registry.remove(def.id);
	ctx.plugin.registry.cleanupUnusedIconSvgs();
	// Awaited, and not just for tidiness: cleanupUnusedIconSvgs does not notify,
	// so without this its trimmed cache misses the save `remove` kicked off and
	// rides on whatever save happens next.
	await ctx.plugin.saveSettings();
	ctx.display();
}

export async function handleClearCalloutUsages(
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
		keepsRow: true,
		// Named only when the theme is the reason the row survives. For a
		// built-in it is Obsidian's own list that keeps it, and blaming the
		// theme would be wrong.
		themeName: def.builtIn ? null : activeThemeName(ctx.app),
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

export async function handleCalloutReplace(
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
