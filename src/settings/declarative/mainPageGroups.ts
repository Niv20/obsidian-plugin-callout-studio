/**
 * settings/declarative/mainPageGroups.ts — the boxes at the foot of the main
 * settings page (Import and export, Danger zone).
 *
 * Who calls it. The settings tab, when it builds its tree.
 *
 * The main idea. Each function returns one part of the tree. The rows only
 * describe themselves and point at the flows that already exist (the import
 * and export windows, the conversion review, the reset), so the declarative
 * page and the old one run the very same code when a button is pressed. While
 * saving is paused, a row whose button would change the setup is dimmed and
 * says why when pressed (rowParts.ts); the ones that change nothing (Export,
 * Version history, the conversion review) stay usable.
 *
 * (The page's last box, the footer with the language, the project's links,
 * License and the version as icon tiles, is footerGroup.ts.)
 */
import { t } from "../../i18n";
import { ExportFormatModal } from "../ExportFormatModal";
import { ImportSourceModal } from "../ImportSourceModal";
import { confirmAndResetEverything } from "../resetEverything";
import { openPortableConversionFromSettings } from "../../portable/registerPortableConversionView";
import { buttonRow, pausedReason } from "./rowParts";
import type { CsGroup, TreeContext } from "./types";
import { VERSION_HISTORY_PAGE, versionHistoryRow } from "./versionHistoryPage";

/** The rows other parts of the settings jump to, by name. */
export const MAIN_PAGE_ROWS = {
	/** The import prompt's Import scrolls here. */
	importCallouts: "import-callouts",
	/** The paused banner's Go to version history opens this page. */
	earlierVersions: VERSION_HISTORY_PAGE,
} as const;

/** Import and export: two rows, each opening its window. */
export function importExportGroup(ctx: TreeContext): CsGroup {
	return {
		type: "group",
		id: "import-export",
		heading: t("settings.importExport"),
		items: [
			buttonRow({
				id: MAIN_PAGE_ROWS.importCallouts,
				name: t("settings.importTitle"),
				desc: t("settings.importDesc"),
				// Names, not words to translate: the plugins it imports from.
				aliases: ["Admonition", "Callout Manager", "JSON"],
				buttonText: t("settings.import"),
				// An import that cannot be saved would look done and vanish.
				blockedReason: () => pausedReason(ctx.plugin.settingsWriter),
				registerIn: ctx.rows,
				onClick: () => new ImportSourceModal(ctx).open(),
			}),
			buttonRow({
				id: "export-callouts",
				name: t("settings.exportTitle"),
				desc: t("settings.exportDesc"),
				aliases: ["CSS", "JSON"],
				buttonText: t("settings.export"),
				onClick: () => new ExportFormatModal(ctx).open(),
			}),
		],
	};
}

/**
 * Danger zone: Restore an earlier version (the row that opens the version
 * history page; shown only on a host that keeps versions, as a minimal host has
 * no recovery service), the conversion review (it changes notes, never
 * settings) and Reset everything.
 */
export function dangerZoneGroup(ctx: TreeContext): CsGroup {
	return {
		type: "group",
		id: "danger-zone",
		heading: t("settings.maintenance"),
		items: [
			versionHistoryRow(ctx),
			buttonRow({
				id: "convert-to-markdown",
				name: t("portable.title"),
				desc: t("portable.settingDesc"),
				buttonText: t("portable.review"),
				onClick: () => { void openPortableConversionFromSettings(ctx.app); },
			}),
			buttonRow({
				id: "reset-everything",
				name: t("settings.resetAll"),
				desc: t("settings.resetAllDesc"),
				buttonText: t("settings.resetAllButton"),
				destructive: true,
				blockedReason: () => pausedReason(ctx.plugin.settingsWriter),
				onClick: () => confirmAndResetEverything(ctx),
			}),
		],
	};
}
