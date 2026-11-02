/**
 * settings/sections/backupImport.ts — importing a Callout Studio
 * backup.
 *
 * Who calls it. The Import from window (ImportSourceModal.ts), once a backup
 * file is chosen.
 *
 * The main idea. The file is checked (size, JSON, every field through
 * importValidator), the problems are shown with ImportReportModal before
 * anything changes, and the valid entries are merged into the setup, after a
 * backup of it is written.
 */
import { t } from "../../i18n";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { ImportReportModal } from "../../utils/ImportReportModal";
import { validateImportPayload } from "../../utils/importValidator";
import { assertImportSize, ImportLimitError, parseImportJson } from "../../utils/importLimits";
import { mergeById } from "../../utils/mergeById";
import { applyPaletteMerge, mergePalettes } from "../../utils/mergePalettes";
import { userImagesFitResourceBudget } from "../../utils/userImages";
import { addImportedCallout, applyImportedCallout } from "../../utils/importedCallout";
import { writeSettingsBackup } from "../../manager/settingsBackup";
import { blockedWhilePaused } from "../pausedGuard";
import type { SettingsContext } from "./types";
import { showNotice } from "../../ui/mascot/mascotNotices";

/**
 * Parses and applies a Callout Studio JSON export. Takes an already-chosen
 * `File` rather than owning a file input itself — see ImportSourceModal,
 * which keeps one persistent, DOM-attached input alive for its lifetime
 * (mirroring ImagePanel's "Custom Icons" add button) rather than creating one
 * fresh per click, since a detached input built inside the click handler was
 * unreliable for actually showing Chromium's file chooser.
 */
export async function processImportedJSON(ctx: SettingsContext, file: File): Promise<void> {
	let parsed: unknown;
	try {
		assertImportSize(file.size);
		const text = await file.text();
		parsed = parseImportJson(text);
	} catch (error) {
		await new ImportReportModal(
			ctx.app,
			[
				{
					index: -1,
					entryLabel: "",
					level: "error",
					messageKey: error instanceof ImportLimitError ? error.messageKey : "import.err.parseFailed",
				},
			],
			0,
			0,
			true,
		).prompt();
		return;
	}

	const result = await validateImportPayload(parsed, ctx.plugin.registry);

	if (result.issues.length > 0 || result.fatal) {
		const total = countImportedCallouts(parsed);
		const choice = await new ImportReportModal(
			ctx.app,
			result.issues,
			result.validDefs.length,
			total,
			result.fatal,
		).prompt();
		if (choice === "cancel" || result.fatal) return;
	}

	const defs = result.validDefs;
	// A report can stay open while sync changes the destination collection.
	const incomingImages = result.settings?.userImages;
	if (
		incomingImages?.length &&
		!userImagesFitResourceBudget(mergeById(ctx.plugin.registry.getUserImages(), incomingImages))
	) {
		await new ImportReportModal(
			ctx.app,
			[{ index: -1, entryLabel: "", level: "error", messageKey: "import.err.imageBudget" }],
			0,
			0,
			true,
		).prompt();
		return;
	}

	// Only the setting groups the file carries: an older export predates newer
	// groups, and filling them with defaults would silently reset them here.
	const present = presentSettingGroups(parsed);
	const restored = result.settings
		? Object.keys(result.settings).filter((key) => present.has(key) && !LIST_GROUPS.has(key))
		: [];
	// A clean file used to apply without a word. Say what it will replace; the
	// report above already asked when there were issues.
	if (result.issues.length === 0) {
		const replaced = defs.filter((def) => ctx.plugin.registry.has(def.id)).length;
		const confirmed = await new ConfirmModal(
			ctx.app,
			t("import.confirmTitle"),
			t("import.confirmSummary", { added: defs.length - replaced, replaced, settings: restored.length }),
			t("import.confirmAction"),
			undefined,
			"cta",
		).confirm();
		if (!confirmed) return;
	}
	if (blockedWhilePaused(ctx.plugin.settingsWriter)) return;
	// Same-id callouts and whole setting groups are replaced: keep a way back.
	if (!(await writeSettingsBackup(ctx.plugin, ctx.plugin.registry.toSaveData(), { reason: "before-import" }))) {
		showNotice("problem", t("import.backupFailed"));
		return;
	}

	let imported = 0;
	let overwritten = 0;
	// Match foreign imports: one stylesheet/repaint/save notification for the
	// batch, rather than rebuilding the growing registry once per entry.
	ctx.plugin.registry.batch(() => {
		for (const def of defs) {
			if (ctx.plugin.registry.has(def.id)) {
				if (!applyImportedCallout(ctx.plugin.registry, def)) continue;
				overwritten++;
				imported++;
			} else {
				const added = addImportedCallout(ctx.plugin.registry, def);
				if (added) imported++;
			}
		}
	});

	// v2 files also carry plugin settings; apply them field-by-field
	// (result.settings is already merged against defaults, so unknown
	// fields are impossible here).
	const settingsImported = !!result.settings;
	if (result.settings) {
		// Everything else IS replaced wholesale, deliberately: an import is a
		// restore, and global style / menu config / language are single values
		// with no id to merge on, so "keep both" has no meaning for them.
		//
		// Palettes and pictures are the exception because they are lists the
		// user builds up. Merge them by id rather than letting Object.assign
		// replace the arrays — otherwise importing a file with none of either
		// would silently wipe the user's existing ones. This mirrors how
		// callouts are merged (add new / overwrite same id). Palettes are also
		// matched by name, since that is how the user tells them apart.
		// Commands are on that list too: an export predating them carries
		// none, and replacing the array wholesale would delete every
		// command the user had built here.
		const {
			customPalettes: importedPalettes,
			userImages: importedImages,
			customCommands: importedCommands,
			...restSettings
		} = result.settings;
		// One round for the whole settings half, and always one: the global
		// style, the fallback and the palettes' colour words are read by the
		// stylesheet straight off settings, and the callout batch above
		// repainted before any of them arrived.
		ctx.plugin.registry.batch(() => {
			Object.assign(
				ctx.plugin.registry.settings,
				Object.fromEntries(Object.entries(restSettings).filter(([key]) => restored.includes(key))),
			);
			if (importedPalettes) {
				applyPaletteMerge(
					ctx.plugin.registry,
					mergePalettes(ctx.plugin.registry.settings.customPalettes, importedPalettes),
				);
				// Merging routinely brings in a palette that duplicates a local
				// one's colors under a different id and name — the two vaults made
				// the same color independently. No vault may hold two of those, so
				// fold them together here rather than leaving a state the next
				// launch would silently repair. The callouts that referenced the
				// dropped id are re-pointed, so nothing is orphaned by the merge.
				const merges = ctx.plugin.registry.consolidateDuplicatePalettes();
				if (merges.length > 0) {
					showNotice(
						"success",
						t("notice.palettesMerged", {
							count: merges.length,
							names: merges.map((m) => m.from).join(", "),
						}),
					);
				}
			}
			if (importedImages) {
				// Through the registry rather than by assignment: it is what
				// hands the new pictures to the pack that draws them.
				ctx.plugin.registry.setUserImages(mergeById(ctx.plugin.registry.getUserImages(), importedImages));
			}
			if (importedCommands) {
				ctx.plugin.registry.settings.customCommands = mergeById(
					ctx.plugin.registry.settings.customCommands,
					importedCommands,
				);
				// Anything pointing at a callout this vault doesn't have is
				// dropped by the sweep, which also registers the rest.
				ctx.plugin.customCommands.syncAll();
			}
			ctx.plugin.registry.settingsChanged();
		});
		ctx.plugin.refreshRenderModes();
	}
	// Awaited for every import, callouts-only included, so the notice below
	// reports what reached the file rather than what the registry holds.
	await ctx.plugin.saveSettings();
	if (ctx.plugin.settingsWriter.persists?.(ctx.plugin.registry.toSaveData()) === false) {
		showNotice("problem", t("import.notSaved"));
		ctx.redraw();
		return;
	}

	if (imported > 0) {
		if (overwritten > 0) {
			showNotice(
				"celebrate",
				t("settings.importConflictNotice", {
					count: imported,
					overwritten,
				}),
			);
		} else {
			showNotice("celebrate", t("notice.importedJSON", { count: imported }));
		}
		ctx.redraw();
		// An imported callout can name an icon from a source this vault has
		// never downloaded, and the file carries no artwork. Fetch whatever
		// is missing rather than leaving those callouts undrawable. One that
		// draws no icon is skipped: nothing renders its stored drawing, so it
		// would be a download nobody could see.
		void ctx.plugin.ensureIconArtworkFor(defs.filter((d) => d.hideIcon !== true).map((d) => d.icon));
	} else if (settingsImported) {
		showNotice("celebrate", t("notice.importedSettings"));
		ctx.redraw();
	} else {
		showNotice("upToDate", t("notice.noNewJSON"));
	}
}

/** Lists the user builds up: merged by id on import, never replaced. */
const LIST_GROUPS: ReadonlySet<string> = new Set(["customPalettes", "userImages", "customCommands"]);

/** The top-level settings groups an import file actually carries. */
function presentSettingGroups(parsed: unknown): Set<string> {
	const settings =
		parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as { settings?: unknown }).settings
			: undefined;
	const groups = new Set(
		settings !== null && typeof settings === "object" && !Array.isArray(settings) ? Object.keys(settings) : [],
	);
	// 1.x kept the menu switch under `popup`; the merge reads it into contextMenu.
	if (groups.has("popup")) groups.add("contextMenu");
	return groups;
}

/** Number of callout entries in either import shape (for the report modal). */
function countImportedCallouts(parsed: unknown): number {
	if (Array.isArray(parsed)) return parsed.length;
	if (parsed && typeof parsed === "object" && Array.isArray((parsed as { callouts?: unknown }).callouts)) {
		return (parsed as { callouts: unknown[] }).callouts.length;
	}
	return 0;
}
