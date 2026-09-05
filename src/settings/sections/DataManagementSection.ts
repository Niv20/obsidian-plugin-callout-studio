/**
 * settings/sections/DataManagementSection.ts — Import, export, and reset settings.
 *
 * Renders the "Vault insights & maintenance" and "Import / Export" sections in
 * the settings tab. Handles JSON import with validation (via importValidator),
 * vault statistics, and full data reset. Uses ImportReportModal to surface
 * validation issues before import. Both export formats live behind
 * ExportFormatModal, the way both import sources live behind ImportSourceModal.
 */
import { Notice, Setting } from "obsidian";
import { t } from "../../i18n";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { ExportFormatModal } from "../ExportFormatModal";
import { ImportReportModal } from "../../utils/ImportReportModal";
import { validateImportPayload } from "../../utils/importValidator";
import { mergeById } from "../../utils/mergeById";
import { ImportSourceModal } from "../ImportSourceModal";
import { countCalloutUsages } from "../../utils/vaultCalloutScanner";
import { scanVaultCalloutStatistics } from "../../utils/vaultCalloutStats";
import { VaultCalloutStatisticsModal } from "../../utils/VaultCalloutStatisticsModal";
import type { SettingsSectionContext } from "./types";

export function renderImportExportSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	new Setting(containerEl).setName(t("settings.importExport")).setHeading();

	new Setting(containerEl)
		.setName(t("settings.import"))
		.setDesc(t("settings.importDesc"))
		.addButton((btn) => {
			btn.setButtonText(t("settings.import"))
				.setIcon("download")
				.onClick(() => new ImportSourceModal(ctx).open());
			btn.buttonEl.addClass("cs-settings-neutral-btn");
		});

	new Setting(containerEl)
		.setName(t("settings.export"))
		.setDesc(t("settings.exportDesc"))
		.addButton((btn) => {
			btn.setButtonText(t("settings.export"))
				.setIcon("upload")
				.onClick(() => new ExportFormatModal(ctx).open());
			btn.buttonEl.addClass("cs-settings-neutral-btn");
		});
}

export function renderResetSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	new Setting(containerEl)
		.setName(t("settings.vaultMaintenance"))
		.setHeading();

	new Setting(containerEl)
		.setName(t("settings.vaultStats"))
		.setDesc(t("settings.vaultStatsDesc"))
		.addButton((btn) => {
			btn.setButtonText(t("settings.vaultStatsButton")).onClick(
				async () => {
					btn.setDisabled(true);
					btn.setButtonText(t("settings.vaultStatsScanning"));
					try {
						await showVaultStatistics(ctx);
					} finally {
						btn.setDisabled(false);
						btn.setButtonText(t("settings.vaultStatsButton"));
					}
				},
			);
			btn.buttonEl.addClass("cs-settings-neutral-btn");
		});

	new Setting(containerEl)
		.setName(t("settings.resetAll"))
		.setDesc(t("settings.resetAllDesc"))
		.addButton((btn) =>
			btn
				.setButtonText(t("settings.resetAllButton"))
				.setWarning()
				.onClick(async () => {
					const userCallouts = ctx.plugin.registry.getUserDefined();
					const userIds = userCallouts.flatMap((c) =>
						ctx.plugin.registry.vaultIdFormsFor(c),
					);

					const messageFrag = createFragment();
					if (userIds.length > 0) {
						const { fileCount, totalCount } =
							await countCalloutUsages(ctx.app, userIds);
						if (fileCount > 0) {
							messageFrag.createEl("p", {
								text: t("vault.resetAllInUse", {
									count: String(totalCount),
									files: String(fileCount),
								}),
								cls: "cs-reset-warning",
							});
						}
					}
					messageFrag.createEl("p", {
						text: t("settings.resetAllConfirm"),
					});

					const confirmed = await new ConfirmModal(
						ctx.app,
						t("confirm.titleResetAll"),
						messageFrag,
					).confirm();
					if (!confirmed) return;
					ctx.plugin.registry.resetAll();
					ctx.plugin.cssInjector.inject();
					await ctx.plugin.saveSettings();
					new Notice(t("notice.resetAllDone"));
					ctx.display();
				}),
		);
}

async function showVaultStatistics(ctx: SettingsSectionContext): Promise<void> {
	new VaultCalloutStatisticsModal(ctx, await scanVaultCalloutStatistics(ctx.app)).open();
}

/**
 * Parses and applies a Callout Studio JSON export. Takes an already-chosen
 * `File` rather than owning a file input itself — see ImportSourceModal,
 * which keeps one persistent, DOM-attached input alive for its lifetime
 * (mirroring ImagePanel's "Your images" add button) rather than creating one
 * fresh per click, since a detached input built inside the click handler was
 * unreliable for actually showing Chromium's file chooser.
 */
export async function processImportedJSON(
	ctx: SettingsSectionContext,
	file: File,
): Promise<void> {
	let parsed: unknown;
	try {
		const text = await file.text();
		parsed = JSON.parse(text);
	} catch {
		await new ImportReportModal(
			ctx.app,
			[
				{
					index: -1,
					entryLabel: "",
					level: "error",
					messageKey: "import.err.parseFailed",
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
		if (choice === "cancel") return;
	}

	const defs = result.validDefs;

	let imported = 0;
	let overwritten = 0;
	for (const def of defs) {
		if (ctx.plugin.registry.has(def.id)) {
			ctx.plugin.registry.update(def.id, def);
			overwritten++;
			imported++;
		} else {
			const added = ctx.plugin.registry.add(def);
			if (added) imported++;
		}
	}

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
		// callouts are merged (add new / overwrite same id).
		// Commands are on that list too: an export predating them carries
		// none, and replacing the array wholesale would delete every
		// command the user had built here.
		const {
			customPalettes: importedPalettes,
			userImages: importedImages,
			customCommands: importedCommands,
			...restSettings
		} = result.settings;
		Object.assign(ctx.plugin.registry.settings, restSettings);
		if (importedPalettes) {
			ctx.plugin.registry.settings.customPalettes = mergeById(
				ctx.plugin.registry.settings.customPalettes,
				importedPalettes,
			);
			// Merging by id routinely brings in a palette that duplicates a
			// local one's colors under a different id — the two vaults named
			// the same color independently. No vault may hold two of those, so
			// fold them together here rather than leaving a state the next
			// launch would silently repair. The callouts that referenced the
			// dropped id are re-pointed, so nothing is orphaned by the merge.
			const merges = ctx.plugin.registry.consolidateDuplicatePalettes();
			if (merges.length > 0) {
				new Notice(
					t("settings.palettesMergedNotice", { count: merges.length }),
				);
			}
		}
		if (importedImages) {
			// Through the registry rather than by assignment: it is what
			// hands the new pictures to the pack that draws them.
			ctx.plugin.registry.setUserImages(
				mergeById(ctx.plugin.registry.getUserImages(), importedImages),
			);
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
		await ctx.plugin.saveSettings();
		ctx.plugin.refreshRenderModes();
	}

	if (imported > 0) {
		if (overwritten > 0) {
			new Notice(
				t("settings.importConflictNotice", {
					count: imported,
					overwritten,
				}),
			);
		} else {
			new Notice(t("notice.importedJSON", { count: imported }));
		}
		ctx.display();
		// An imported callout can name an icon from a source this vault has
		// never downloaded, and the file carries no artwork. Fetch whatever
		// is missing rather than leaving those callouts undrawable. One that
		// draws no icon is skipped: nothing renders its stored drawing, so it
		// would be a download nobody could see.
		void ctx.plugin.ensureIconArtworkFor(
			defs.filter((d) => d.hideIcon !== true).map((d) => d.icon),
		);
	} else if (settingsImported) {
		new Notice(t("notice.importedSettings"));
		ctx.display();
	} else {
		new Notice(t("notice.noNewJSON"));
	}
}

/** Number of callout entries in either import shape (for the report modal). */
function countImportedCallouts(parsed: unknown): number {
	if (Array.isArray(parsed)) return parsed.length;
	if (
		parsed &&
		typeof parsed === "object" &&
		Array.isArray((parsed as { callouts?: unknown }).callouts)
	) {
		return (parsed as { callouts: unknown[] }).callouts.length;
	}
	return 0;
}
