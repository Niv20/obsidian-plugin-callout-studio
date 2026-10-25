/**
 * settings/declarative/mainPageGroups.ts — the boxes at the foot of the main
 * settings page (Import and export, Version history, Danger zone, About) and
 * the Manage icon libraries row.
 *
 * Who calls it. The settings tab, when it builds its tree.
 *
 * The main idea. Each function returns one part of the tree. The rows only
 * describe themselves and point at the flows that already exist (the import
 * and export windows, version history, the conversion review, the reset), so
 * the declarative page and the old one run the very same code when a button is
 * pressed. While saving is paused, a row whose button would change the setup
 * is dimmed and says why when pressed (rowParts.ts); the ones that change
 * nothing (Export, Earlier versions, the conversion review) stay usable.
 */
import { t } from "../../i18n";
import { ExportFormatModal } from "../ExportFormatModal";
import { IconCreditsModal } from "../IconCreditsModal";
import { ImportSourceModal } from "../ImportSourceModal";
import { SettingsRecoveryModal } from "../SettingsRecoveryModal";
import { WelcomeModal } from "../WelcomeModal";
import { appendContactSentence, projectLinks, releaseNotesUrl } from "../aboutLinks";
import { openIconLibrariesWindow } from "../iconpicker/openIconLibraries";
import { confirmAndResetEverything } from "../resetEverything";
import { openPortableConversionFromSettings } from "../../portable/registerPortableConversionView";
import { buttonRow, pausedReason } from "./rowParts";
import { guardRender } from "./safeTree";
import type { CsAction, CsGroup, CsRender, TreeContext } from "./types";

/** The rows other parts of the settings jump to, by name. */
export const MAIN_PAGE_ROWS = {
	/** The import prompt's Import scrolls here. */
	importCallouts: "import-callouts",
	/** The paused banner's Go to version history scrolls here. */
	earlierVersions: "earlier-versions",
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

/** Version history: shown only on a host that keeps versions (a minimal host has no recovery service). */
export function versionHistoryGroup(ctx: TreeContext): CsGroup {
	return {
		type: "group",
		id: "version-history",
		heading: t("settings.versionHistory"),
		visible: () => ctx.plugin.recovery !== undefined,
		items: [
			buttonRow({
				id: MAIN_PAGE_ROWS.earlierVersions,
				name: t("settings.versions"),
				desc: t("settings.versionsDesc"),
				buttonText: t("settings.versionsButton"),
				registerIn: ctx.rows,
				onClick: () => new SettingsRecoveryModal(ctx.app, ctx.plugin).open(),
			}),
		],
	};
}

/** Danger zone: the conversion review (it changes notes, never settings) and Reset everything. */
export function dangerZoneGroup(ctx: TreeContext): CsGroup {
	return {
		type: "group",
		id: "danger-zone",
		heading: t("settings.maintenance"),
		items: [
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

/**
 * About: the welcome window, how to get in touch, the icon licenses, and the
 * version with the project's links. (The welcome window was the ⓘ beside the
 * page's old title, and the rest was the page's old footer.)
 */
export function aboutGroup(ctx: TreeContext): CsGroup {
	return {
		type: "group",
		id: "about",
		heading: t("settings.about"),
		items: [
			{ id: "about-callout-studio", name: t("welcome.tooltip"), action: () => new WelcomeModal(ctx.plugin).open() },
			contactRow(),
			{ id: "icon-licenses", name: t("footer.iconCredits"), action: () => new IconCreditsModal(ctx.app).open() },
			versionRow(ctx.plugin.manifest.version),
		],
	};
}

/**
 * Manage icon libraries, as a row of the settings, so that searching the
 * settings for "icon" finds the window. It opens the same window as Pick an
 * icon's Manage libraries button.
 */
export function iconLibrariesRow(ctx: TreeContext): CsAction {
	return {
		id: "icon-libraries",
		name: t("iconLibraries.manage"),
		// The libraries' names, which are not words to translate.
		aliases: ["Lucide", "Tabler", "Font Awesome", "Material", "Octicons", "RPG Awesome", "Simple Icons", "emoji"],
		action: () => { void openIconLibrariesWindow(ctx.plugin); },
	};
}

/**
 * The contact sentence, with its two links, as a row without a name. It is
 * drawn by `render` because a description given as data cannot hold links that
 * stay links after Obsidian copies it, and it is left out of the search: a
 * result would have no name to show.
 */
function contactRow(): CsRender {
	return {
		id: "contact",
		name: "",
		searchable: false,
		render: guardRender("contact", (setting) => {
			// Obsidian draws links in a description itself (muted, underlined).
			appendContactSentence(setting.descEl);
		}),
	};
}

/** The version, linking to its release notes, with the project's links under the name. */
function versionRow(version: string): CsRender {
	return {
		id: "version",
		name: t("settings.version"),
		aliases: ["GitHub"],
		render: guardRender("version", (setting) => {
			projectLinks().forEach((link, index) => {
				if (index > 0) setting.descEl.appendText(" · ");
				setting.descEl.createEl("a", {
					text: link.label,
					href: link.href,
					attr: { target: "_blank", rel: "noopener noreferrer" },
				});
			});
			setting.controlEl.createEl("a", {
				text: `v${version}`,
				href: releaseNotesUrl(version),
				attr: { target: "_blank", rel: "noopener noreferrer" },
			});
		}),
	};
}
