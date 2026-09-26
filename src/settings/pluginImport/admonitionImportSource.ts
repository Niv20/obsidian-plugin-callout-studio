/**
 * settings/pluginImport/admonitionImportSource.ts — bringing custom types over
 * from the "Obsidian Admonition" plugin.
 *
 * Three ways in, because a user migrating has no reason to know which one they
 * have, and each is the shortest path for somebody:
 *
 * - **This vault** — Admonition is still installed, so its `data.json` is right
 *   there. Nothing to export first.
 * - **A file** — an `admonitions.json` of the kind Admonition's own export
 *   button writes, or one of the community packs shared as that format.
 * - **Paste** — for anything else, including a `data.json` copied out of
 *   another vault.
 *
 * All three end at the same plan (utils/admonitionImport.ts); PluginImportModal
 * owns the window and the shared ImportReportModal, exactly as it does for the
 * Callout Manager importer.
 */
import type { CalloutIcon } from "../../types";
import { ImportLimitError, parseImportJson } from "../../utils/importLimits";
import { mergeById } from "../../utils/mergeById";
import { userImagesFitResourceBudget } from "../../utils/userImages";
import {
	parseAdmonitionExport,
	type AdmonitionRaw,
} from "../../utils/admonitionFormat";
import { planAdmonitionImport } from "../../utils/admonitionImport";
import type {
	PluginImportBatch,
	PluginImportSource,
} from "./pluginImportSource";

function batchOf(entries: readonly AdmonitionRaw[]): PluginImportBatch {
	return {
		size: entries.length,
		async plan(ctx) {
			const { registry } = ctx.plugin;
			const plan = await planAdmonitionImport(
				entries,
				registry,
				registry.getUserImages(),
			);
			return {
				issues: plan.issues,
				applyCount: plan.toApply.length,
				apply: () => {
					// Sync may have added pictures while the report was open.
					if (plan.newImages.length && !userImagesFitResourceBudget(mergeById(registry.getUserImages(), plan.newImages))) {
						throw new ImportLimitError("import.err.imageBudget");
					}
					return registry.applyAdmonitionImport(plan);
				},
				// An imported callout can name an icon from a library this vault
				// has never downloaded, and no file carries artwork. Fetch what is
				// missing rather than leaving those callouts undrawable — the same
				// repair pass the JSON importer runs.
				afterApply: () => {
					void ctx.plugin.ensureIconArtworkFor(
						plan.toApply
							.map((item) => item.entry.icon)
							.filter((icon): icon is CalloutIcon => !!icon),
					);
				},
			};
		},
	};
}

export const ADMONITION_IMPORT: PluginImportSource = {
	// Stable since the plugin's first release and unchanged through the
	// handover to its current maintainer.
	pluginId: "obsidian-admonition",
	modalClass: "callout-studio-adm-import-modal",
	fileAccept: ".json",
	copy: {
		title: "import.admTitle",
		instructions: "import.admInstructions",
		fromVault: "import.admFromVault",
		vaultChecking: "import.admVaultChecking",
		vaultFound: "import.admVaultFound",
		vaultEmpty: "import.admVaultNotFound",
		vaultNotInstalled: "import.admVaultNotInstalled",
		vaultUnreadable: "import.admVaultUnreadable",
		fromFile: "import.admFromFile",
		fromFileDesc: "import.admFromFileDesc",
		fromPaste: "import.admFromPaste",
		fromPasteDesc: "import.admFromPasteDesc",
		cancel: "import.admBtnCancel",
		importButton: "import.admBtnImport",
		notice: "notice.importedAdmonition",
	},

	fromDataJson(raw) {
		const entries = parseAdmonitionExport(raw);
		return entries ? batchOf(entries) : null;
	},

	fromText(text) {
		let parsed: unknown;
		try {
			parsed = parseImportJson(text);
		} catch (error) {
			return { errorKey: error instanceof ImportLimitError ? error.messageKey : "import.err.parseFailed" };
		}
		const entries = parseAdmonitionExport(parsed);
		return entries
			? { batch: batchOf(entries) }
			: { errorKey: "import.err.admNotRecognized" };
	},
};
