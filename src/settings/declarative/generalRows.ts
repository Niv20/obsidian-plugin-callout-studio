/**
 * settings/declarative/generalRows.ts — the plugin-wide rows of the main
 * page's first box: Default fallback callout, Language (and the notice when the
 * chosen language is not downloaded), and Use your theme's callout styles.
 *
 * Who calls it. The settings tab, when it builds the main page.
 *
 * The main idea. Each row draws the same controls as the old page, from the
 * same code (sections/FallbackSection.ts, sections/LanguageSection.ts); only
 * the way they sit on the page is new:
 * - The rows' `disabled` greys them while saving is paused, and every callback
 *   that changes something is also guarded (pausedGuards.ts), since `disabled`
 *   alone does not stop a list that is already open.
 * - The fallback picker is kept across redraws (persistentParts.ts): it holds
 *   its list and a listener on the document, and has no reason to be rebuilt.
 * - The language row reads the download's progress on every draw, so a redraw
 *   in the middle of a download still says "Downloading…".
 * - The theme's styles switch is a plain control row: Obsidian draws the
 *   toggle, and the tab saves it (controlBinding.ts).
 */
import { getSelectableLocales, t } from "../../i18n";
import { linesFragment } from "../../ui/textLines";
import type { CalloutCombobox } from "../calloutCombobox";
import {
	addFallbackReset,
	createFallbackPicker,
	setFallbackCallout,
} from "../sections/FallbackSection";
import {
	applyLanguagePreference,
	drawLanguageControls,
	languageDownloading,
	missingLanguageName,
	retryLanguageDownload,
} from "../sections/LanguageSection";
import { partitionCallouts, themeStylesSwitchedOff } from "../sections/rowOwnership";
import { disabledWhilePaused, refuseWhilePaused } from "./pausedGuards";
import type { PersistentPart } from "./persistentParts";
import { addControlComponent, buttonRow } from "./rowParts";
import { guardRender } from "./safeTree";
import type { CsControl, CsRender, TreeContext } from "./types";

/** The rows' ids: they key the rows, so they never change. */
export const GENERAL_ROWS = {
	fallback: "fallback-callout",
	language: "language",
	languageMissing: "language-missing",
	themeStyles: "theme-callout-styles",
} as const;

/** Where the theme's styles switch saves, as a dotted path into the settings. */
const THEME_STYLES_KEY = "themeCalloutStyles.enabled";

/* ---- Default fallback callout ---- */

/** The name the fallback picker is kept under in the parts store. */
const FALLBACK_PICKER = "fallback-picker";

/** The kept picker: its element, the picker itself, and how to take it down. */
interface FallbackPickerPart extends PersistentPart {
	picker: CalloutCombobox;
}

/** Default fallback callout: the callout picker, and ↺ back to the default. */
export function fallbackRow(ctx: TreeContext): CsRender {
	return {
		id: GENERAL_ROWS.fallback,
		name: t("settings.fallbackCallout"),
		desc: t("settings.fallbackCalloutDesc"),
		disabled: disabledWhilePaused(ctx.plugin.settingsWriter),
		render: guardRender("fallback callout", (setting) => {
			setting.setClass("cs-reset-setting");
			const { picker } = ctx.parts.mount(FALLBACK_PICKER, setting.controlEl, () => buildFallbackPicker(ctx));
			// Another device's settings may have changed it since the last draw.
			picker.setValue(ctx.plugin.settings.fallbackCalloutId);
			addControlComponent(setting, picker);
			addFallbackReset(setting, ctx.plugin, picker);
			return () => ctx.parts.releaseLater(FALLBACK_PICKER);
		}),
	};
}

/** Build the picker once; the row moves it back in on every draw. */
function buildFallbackPicker(ctx: TreeContext): FallbackPickerPart {
	const pick = (id: string): void => {
		void setFallbackCallout(ctx.plugin, id);
		// Drawn again for the reset arrow, which shows once another fallback is chosen.
		ctx.display();
	};
	// Refused while paused; the redraw then puts the saved fallback back.
	const onChange = refuseWhilePaused(ctx.plugin.settingsWriter, pick, () => ctx.display());
	// Built into a spare element: `mount` moves its outer element into the row.
	const picker = createFallbackPicker(ctx.plugin, createDiv(), onChange);
	return { el: picker.el, picker, dispose: () => picker.destroy() };
}

/* ---- Language ---- */

/** Language, then the notice shown while the chosen language is missing. */
export function languageRows(ctx: TreeContext): CsRender[] {
	return [languageRow(ctx), missingLanguageRow(ctx)];
}

/** Language: Obsidian's menu of every language, and ↺ back to Obsidian's. */
function languageRow(ctx: TreeContext): CsRender {
	const plugin = ctx.plugin;
	const choose = refuseWhilePaused(
		plugin.settingsWriter,
		(pref: string) => { void applyLanguagePreference(plugin, pref, () => ctx.display()); },
		() => ctx.display(),
	);
	return {
		id: GENERAL_ROWS.language,
		name: t("settings.language"),
		// While the chosen language downloads, the row says so.
		desc: languageDownloading(plugin) ? t("locale.downloading") : t("settings.languageDesc"),
		// Every language under its own name, so a search for "Deutsch" or
		// "עברית" finds the row whatever language the page is in.
		aliases: getSelectableLocales().map(({ name }) => name),
		// Paused, a choice could not be saved; downloading, one is on its way.
		disabled: () => plugin.settingsWriter.isFrozen || languageDownloading(plugin),
		render: guardRender("language", (setting) => {
			setting.setClass("cs-language-setting");
			setting.setClass("cs-reset-setting");
			const controls = drawLanguageControls(setting, plugin, choose);
			addControlComponent(setting, controls.picker);
			return controls.dispose;
		}),
	};
}

/** "עברית is not downloaded yet", with Retry. Shown only while that is so. */
function missingLanguageRow(ctx: TreeContext): CsRender {
	const plugin = ctx.plugin;
	const row = buttonRow({
		id: GENERAL_ROWS.languageMissing,
		name: t("locale.notDownloaded", { name: missingLanguageName(plugin) ?? "" }),
		desc: t("locale.notDownloadedDesc"),
		cls: "callout-studio-locale-warning",
		buttonText: t("locale.retry"),
		cta: true,
		busy: () => languageDownloading(plugin),
		// Downloading saves nothing to the settings, so it works while paused.
		onClick: () => retryLanguageDownload(plugin, () => ctx.display()),
	});
	return {
		...row,
		visible: () => missingLanguageName(plugin) !== null,
		// It reports a state; it is not a setting to look for.
		searchable: false,
	};
}

/* ---- Use your theme's callout styles ---- */

/**
 * The switch that turns the active theme's callout styles off
 * (manager/theme/themeCalloutsOff.ts). On the main page, below the row that
 * opens the theme's callouts: that page is drawn by the plugin, so a row on it
 * would not be found by the settings search.
 *
 * Shown while the theme's section is: while the theme styles any callout,
 * and while the switch is off (it took the rows away and must stay to bring
 * them back).
 */
export function themeStylesRow(ctx: TreeContext): CsControl {
	return {
		id: GENERAL_ROWS.themeStyles,
		name: t("settings.themeCalloutStyles"),
		desc: linesFragment(t("settings.themeCalloutStylesDesc")),
		visible: () => partitionCallouts(ctx).fromTheme.length > 0 || themeStylesSwitchedOff(ctx),
		control: {
			type: "toggle",
			key: THEME_STYLES_KEY,
			disabled: disabledWhilePaused(ctx.plugin.settingsWriter),
		},
	};
}
