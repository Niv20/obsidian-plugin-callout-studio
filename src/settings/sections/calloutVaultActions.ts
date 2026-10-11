/**
 * settings/sections/calloutVaultActions.ts — the row actions behind Delete,
 * Convert uses to plain text and Replace in vault.
 *
 * Split from `CalloutRowActions.ts`, which builds menus. Separating them is
 * what lets a surface that is not a menu — the buttons on a theme-styled row —
 * reach the same flows without either duplicating them or importing a menu
 * builder.
 *
 * ## Delete never touches a note
 *
 * {@link handleCalloutDelete} removes the definition and nothing else. A note
 * that still writes `[!id]` keeps it, and draws it in the fallback style like
 * any callout Callout Studio has no type for. A callout nothing uses goes at
 * once, with Undo in the notice; one still in use, or the default fallback
 * callout, asks first, because what changes is the look of notes the user is
 * not looking at.
 *
 * {@link handleClearCalloutUsages} is the half that Delete used to do in the
 * same breath: every use becomes plain text and the type stays where it is.
 * Every row offers it. On a built-in or a theme's type it is the only thing
 * there is to clear — the registry re-seeds a built-in on every load and the
 * next theme sweep re-mints a theme's type — so the confirmation says which of
 * the three keeps the type, and never implies anything of the theme's was
 * touched.
 */
import { Notice } from "obsidian";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { ReplaceCalloutModal } from "../../utils/ReplaceCalloutModal";
import {
	convertCalloutsToPlainTextInVault,
	countCalloutUsages,
	replaceCalloutIdsInVault,
} from "../../utils/vaultCalloutScanner";
import { t } from "../../i18n";
import { DEFAULT_SETTINGS } from "../../constants";
import { activeThemeName } from "../../manager/theme/customCssApi";
import { refreshOccurrencesViewAppearance } from "../../usage/registerOccurrencesView";
import { blockedWhilePaused } from "../pausedGuard";
import { noticeWithUndo, noticeWithUndoAction } from "../rewriteUndoNotice";
import { NoteRewriteJournal } from "../../utils/noteRewriteUndo";
import type { App } from "obsidian";
import type { CalloutDefinition, IconSvgCacheEntry } from "../../types";
import type { SettingsSectionContext } from "./types";

const convertVaultCalloutsToPlainText = (
	app: App,
	def: CalloutDefinition,
	ids: string[],
	journal: NoteRewriteJournal,
): Promise<{ files: number; blocks: number }> =>
	// The display name is what a heading or inline usage falls back to: those
	// carry no text besides the token, so it is all they have left.
	convertCalloutsToPlainTextInVault(app, ids, def.displayName, true, journal);

/**
 * Count the notes that use `def` right now, or null when some could not be
 * read. `scanVaultFiles` has already said so in a notice. A partial count is
 * never taken for "unused": for Delete that would skip the question.
 */
async function countUsagesNow(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): Promise<{ fileCount: number; totalCount: number } | null> {
	try {
		return await countCalloutUsages(ctx.app, ctx.plugin.registry.vaultIdFormsFor(def));
	} catch (error) {
		console.warn("[callout-studio] could not count callout usages", error);
		return null;
	}
}

/** What a deleted callout leaves behind for Undo to put back. */
export interface DeletedCallout {
	def: CalloutDefinition;
	/** Cached artwork only this type used, which cleanup is about to drop. */
	artwork: IconSvgCacheEntry[];
	/** It was the default fallback callout, which `remove` reset to Note. */
	wasFallback: boolean;
}

export async function handleCalloutDelete(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): Promise<void> {
	// While saving is paused the removal would be lost on restart: the type
	// would come back on the next launch as if Delete had never been pressed.
	if (blockedWhilePaused(ctx.plugin.settingsWriter)) return;
	const usage = await countUsagesNow(ctx, def);
	if (!usage) return;
	const { registry } = ctx.plugin;
	const isFallback = registry.settings.fallbackCalloutId === def.id;

	if (usage.fileCount > 0 || isFallback) {
		const lines: string[] = [];
		if (usage.fileCount > 0) {
			lines.push(
				t("deleteModal.bodyInUse", {
					count: String(usage.totalCount),
					files: String(usage.fileCount),
				}),
				t("deleteModal.notesUntouched"),
			);
		}
		// Every callout without a type of its own changes with it, used or not.
		if (isFallback) {
			const fallback = registry.get(DEFAULT_SETTINGS.fallbackCalloutId);
			lines.push(t("deleteModal.fallbackTarget", {
				fallback: fallback?.displayName ?? DEFAULT_SETTINGS.fallbackCalloutId,
			}));
		}
		const confirmed = await new ConfirmModal(
			ctx.app,
			t("deleteModal.title", { name: def.displayName }),
			lines.join("\n"),
		).confirm();
		if (!confirmed) return;
		// Saving can pause while the dialog is open.
		if (blockedWhilePaused(ctx.plugin.settingsWriter)) return;
	}

	// The registry's row rather than the menu's copy: the menu was built from
	// the list as it was drawn, and Undo has to put back what is removed now.
	const current = registry.get(def.id);
	if (!current) return;
	const deleted: DeletedCallout = {
		def: structuredClone(current),
		// Cleanup drops artwork used only by this type. Keep its cached variants
		// with Undo so restoring it also works offline or without the source pack.
		artwork: registry.iconSvgCache.filter(entry =>
			entry.pack === current.icon.type && entry.name === current.icon.value),
		wasFallback: registry.settings.fallbackCalloutId === current.id,
	};
	if (!registry.remove(current.id)) return;
	registry.cleanupUnusedIconSvgs();
	// Awaited, and not just for tidiness: cleanupUnusedIconSvgs does not notify,
	// so without this its trimmed cache misses the save `remove` kicked off and
	// rides on whatever save happens next.
	await ctx.plugin.saveSettings();
	// Notes keep their `[!id]`, and they look different now: repaint them.
	ctx.plugin.refreshCallouts();
	if (deleted.wasFallback) refreshOccurrencesViewAppearance(ctx.plugin);
	ctx.display();
	noticeWithUndoAction(t("notice.calloutDeleted", { name: current.displayName }), () => {
		void restoreDeletedCallout(ctx, deleted);
	});
}

/** Undo for Delete: the type, its artwork, and its place as the fallback. */
export async function restoreDeletedCallout(
	ctx: SettingsSectionContext,
	deleted: DeletedCallout,
): Promise<void> {
	if (blockedWhilePaused(ctx.plugin.settingsWriter)) return;
	const { registry } = ctx.plugin;
	// Made again since, or found again by a scan: that row is the user's now.
	if (registry.has(deleted.def.id)) return;
	const restored = registry.batch(() => {
		// Artwork first, so the repaint `add` triggers already has it.
		for (const entry of deleted.artwork) {
			if (!registry.findIconSvg(entry.pack, entry.name, entry.variant)) {
				registry.addIconSvg(entry);
			}
		}
		if (!registry.add(structuredClone(deleted.def))) {
			registry.cleanupUnusedIconSvgs();
			return false;
		}
		// `remove` moved the fallback to Note and restyled the rows that mirror
		// it. Put both back, unless another fallback has been picked since.
		if (
			deleted.wasFallback &&
			registry.settings.fallbackCalloutId === DEFAULT_SETTINGS.fallbackCalloutId
		) {
			registry.settings.fallbackCalloutId = deleted.def.id;
			registry.restyleUncustomizedFallbackRows();
		}
		return true;
	});
	if (!restored) return;
	await ctx.plugin.saveSettings();
	ctx.plugin.refreshCallouts();
	if (deleted.wasFallback) refreshOccurrencesViewAppearance(ctx.plugin);
	ctx.display();
}

/** The confirmation's last line: who keeps the type once its uses are gone. */
function typeStaysLine(ctx: SettingsSectionContext, def: CalloutDefinition): string {
	if (def.builtIn) return t("deleteModal.keepsRowBuiltIn");
	// Named only when the theme is the reason the type survives. A callout of
	// the user's own stays because nothing removes it, and blaming the theme —
	// or calling it one of Obsidian's built-ins — would both be wrong.
	const theme = ctx.plugin.registry.themeOwns(def) ? activeThemeName(ctx.app) : null;
	if (theme) return t("deleteModal.keepsRowTheme", { theme });
	return t("convertModal.typeStays");
}

export async function handleClearCalloutUsages(
	ctx: SettingsSectionContext,
	def: CalloutDefinition,
): Promise<void> {
	const usage = await countUsagesNow(ctx, def);
	if (!usage || usage.fileCount === 0) return;

	const confirmed = await new ConfirmModal(
		ctx.app,
		t("convertModal.title", { name: def.displayName }),
		[
			t("deleteModal.bodyInUse", {
				count: String(usage.totalCount),
				files: String(usage.fileCount),
			}),
			t("convertModal.explain"),
			typeStaysLine(ctx, def),
		].join("\n"),
		t("convertModal.confirm"),
	).confirm();
	if (!confirmed) return;

	const allIds = ctx.plugin.registry.vaultIdFormsFor(def);
	let result: { files: number; blocks: number };
	const journal = new NoteRewriteJournal();
	try { result = await convertVaultCalloutsToPlainText(ctx.app, def, allIds, journal); }
	catch (error) {
		console.warn("[callout-studio] converting callout usages was incomplete", error);
		new Notice(t("notice.calloutDeleteIncomplete"), 10000);
		return;
	}
	noticeWithUndo(ctx.app, t("vault.convertedToPlainText", {
		blocks: String(result.blocks),
		files: String(result.files),
	}), journal);
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
		const journal = new NoteRewriteJournal();
		const replaced = await replaceCalloutIdsInVault(
			ctx.app,
			allIds,
			result.replaceWith,
			target && target.displayName !== def.displayName
				? { from: def.displayName, to: target.displayName }
				: undefined,
			false,
			journal,
		);
		noticeWithUndo(ctx.app, t("vault.filesUpdated", { count: String(replaced) }), journal);
	} else {
		new Notice(t("vault.filesUpdated", { count: "0" }));
	}
	ctx.display();
}
