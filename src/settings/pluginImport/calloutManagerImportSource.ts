/**
 * settings/pluginImport/calloutManagerImportSource.ts — bringing callouts over
 * from the competing "Obsidian Callout Manager" plugin.
 *
 * Two ways in:
 *
 * - **This vault** — Callout Manager is (or was) installed here, so its
 *   `data.json` is right there. Nothing to copy first.
 * - **Copied styles** — the styles its Copy button puts on the clipboard, which
 *   is what somebody moving between vaults or following a shared snippet has. A
 *   `data.json` copied as text works too. Pasted by the user into the
 *   window's text box, or put there by its Paste button — the only time the
 *   window reads the clipboard. The only option there is when this vault holds
 *   no Callout Manager data.
 *
 * There used to be a third, a file; each window now offers one way in besides
 * the vault (`PluginImportManual`). A `data.json` from another vault still
 * comes over, pasted as text.
 *
 * The vault route is not merely the convenient one, it is the *complete* one.
 * The Copy button emits the stylesheet already resolved for whichever colour
 * scheme was active, so it structurally cannot carry a callout stored with a
 * different light and dark colour — and a callout that was created but never
 * restyled emits no CSS at all and is invisible to it.
 *
 * Both end at the same plan (utils/calloutManagerImport.ts);
 * PluginImportModal owns the window and the shared ImportReportModal, exactly
 * as it does for the Admonition importer.
 */
import { parseCalloutManagerExport } from "../../utils/calloutCssParse";
import { parseCalloutManagerData } from "../../utils/calloutManagerFormat";
import { assertImportTextSize, ImportLimitError, parseImportJson } from "../../utils/importLimits";
import {
	planCalloutManagerImport,
	toCalloutManagerEntries,
	type CalloutManagerEntry,
} from "../../utils/calloutManagerImport";
import type {
	PluginImportBatch,
	PluginImportParse,
	PluginImportSource,
} from "./pluginImportSource";

function batchOf(entries: readonly CalloutManagerEntry[]): PluginImportBatch {
	return {
		size: entries.length,
		plan(ctx) {
			const { registry } = ctx.plugin;
			const { toApply, issues } = planCalloutManagerImport(entries, registry);
			// No afterApply, unlike the Admonition and JSON importers, and not an
			// oversight: every icon this one can produce is `type: "lucide"`,
			// whose pack is `kind: "builtin"` and drawn by `setIcon`. There is no
			// artwork to fetch, and IconService.isFullyCached short-circuits
			// builtin to true anyway, so the call would only add a promise.
			return Promise.resolve({
				issues,
				applyCount: toApply.length,
				apply: () => registry.applyCalloutManagerImport(toApply),
			});
		},
	};
}

export const CALLOUT_MANAGER_IMPORT: PluginImportSource = {
	// Unchanged since its first release.
	pluginId: "callout-manager",
	modalClass: "callout-studio-cm-import-modal",
	manual: { kind: "paste", placeholder: "import.cmPlaceholder" },
	copy: {
		title: "import.cmTitle",
		instructions: "import.cmInstructions",
		fromVault: "import.cmFromVault",
		vaultChecking: "import.cmVaultChecking",
		vaultFound: "import.cmVaultFound",
		manual: "import.cmFromPaste",
		manualDesc: "import.cmFromPasteDesc",
		cancel: "import.cmBtnCancel",
		importButton: "import.cmBtnImport",
		notice: "notice.importedCalloutManager",
	},

	fromDataJson(raw) {
		const raws = parseCalloutManagerData(raw);
		return raws ? batchOf(toCalloutManagerEntries(raws)) : null;
	},

	fromText,
};

/**
 * Pasted text, which takes two languages: the copied styles, or a `data.json`
 * copied as text.
 *
 * Which one it is, is decided by the first character rather than by
 * trial-parsing: a stylesheet never opens with a brace (a rule opens with its
 * selector), so the two are told apart without a failed `JSON.parse` being
 * swallowed as "must have been CSS then" and the user losing the real syntax
 * error.
 */
function fromText(input: string): PluginImportParse {
	try {
		assertImportTextSize(input);
		return parseText(input);
	} catch (error) {
		return { errorKey: error instanceof ImportLimitError ? error.messageKey : "import.err.parseFailed" };
	}
}

function parseText(input: string): PluginImportParse {
	const text = input.trim();

	if (text.startsWith("{") || text.startsWith("[")) {
		let parsed: unknown;
		try {
			parsed = parseImportJson(text);
		} catch (error) {
			return { errorKey: error instanceof ImportLimitError ? error.messageKey : "import.err.parseFailed" };
		}
		const raws = parseCalloutManagerData(parsed);
		if (!raws) return { errorKey: "import.err.cmNotRecognized" };
		if (raws.length === 0) return { errorKey: "import.err.cmNoEntries" };
		return { batch: batchOf(toCalloutManagerEntries(raws)) };
	}

	// The clipboard export. An empty result is the planner's own to report,
	// via import.err.cmNoBlocksFound.
	return { batch: batchOf(parseCalloutManagerExport(text)) };
}
