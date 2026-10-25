/**
 * settings/sections/LanguageSection.ts — the plugin's interface language.
 *
 * Who calls it. The settings page's Language row and the row under it that
 * offers a retry when a language is not downloaded (declarative/generalRows.ts).
 *
 * The main idea. A picker lets the user choose the plugin's display language.
 * It lists languages and nothing else, each under its own native name (e.g.
 * "עברית", not "Hebrew"). There is no "Automatic" row: following Obsidian is
 * what the picker does until told otherwise, so it simply shows the language
 * Obsidian is in, and the reset arrow appears once the language shown differs
 * from it. The choice is persisted in PluginSettings and re-rendering the tab
 * refreshes every label in the new language.
 *
 * The saved value kept its old shape when the row went: `"auto"` (the default)
 * follows Obsidian, a locale code pins one. An upgrade reads every saved value
 * as before and rewrites none. "The same as Obsidian" is decided on screen and
 * never written back, because Obsidian's language belongs to the device while
 * data.json syncs: a code pinned on one device can match Obsidian there and
 * differ from it on the next.
 *
 * Only English is bundled, so picking a language may have to fetch it first
 * (see i18n/LocaleStore.ts). Every language is offered whether or not it is
 * downloaded: choosing one is what triggers the download, and the list would be
 * useless if it only showed what the user already had. When the fetch cannot
 * happen — offline, or a blocked CDN — the choice is still kept and the UI
 * stays English until it succeeds, which is the honest outcome. Silently
 * reverting the dropdown would look like the click had not registered.
 *
 * The steps (the picker with its reset arrow, applying a choice, the missing
 * language and its retry) are exported one by one, for the rows to put
 * together.
 */
import type { Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "../../constants";
import { getSelectableLocales, resolveLocaleFile, setLocale, t } from "../../i18n";
import { SelectDropdown } from "../../ui/selectDropdown";
import { addFieldResetButton } from "../editor/fieldResetButton";
import type { SettingsTabPlugin } from "./types";

type LanguageChoice = {
	code: string;
	name: string;
};

/** The saved preference that follows Obsidian's interface language. */
const FOLLOW_OBSIDIAN = DEFAULT_SETTINGS.language;

/** The row for everything English covers: no file, nothing to download. */
const ENGLISH = "en";

/** What {@link drawLanguageControls} drew, and how to take it down. */
export interface LanguageControls {
	picker: SelectDropdown;
	/**
	 * Stop what the controls set up: the picker's menu, the layout watch.
	 * (A property holding a function, not a method, so it can be handed on
	 * by itself, as a row's cleanup.)
	 */
	dispose: () => void;
}

/**
 * Draw the language picker and its reset arrow into `setting`'s controls.
 *
 * @param choose Called with the preference to save when the user picks a
 *   language or resets. It must write the preference into the settings
 *   before it returns (it may go on saving and downloading afterwards), so
 *   the reset arrow, checked right after, sees the new preference.
 */
export function drawLanguageControls(
	setting: Setting,
	plugin: SettingsTabPlugin,
	choose: (pref: string) => void,
): LanguageControls {
	// A plain choice opened in Obsidian's own menu, with a ✓ beside the
	// language shown. Every language is listed under its own native name.
	const picker = new SelectDropdown(setting.controlEl, t("settings.language"))
		.setOptions(getSelectableLocales().map(({ code, name }) => ({ value: code, label: name })))
		.setValue(shownLanguage(plugin.settings.language))
		// `onPick` rather than `onChange`: picking the language already shown
		// must still reach this, because for a language whose download is
		// still missing, picking it again is how the user retries.
		.onPick((code) => {
			const current = plugin.settings.language;
			const next = preferenceFor(current, code);
			// Nothing changed and nothing is missing: no save, no redraw.
			if (next === current && plugin.locales.isReady(next)) return;
			choose(next);
			syncReset();
		});
	const syncReset = addFieldResetButton(
		setting,
		`${t("settings.resetAction")}: ${t("settings.language")}`,
		() => showsObsidianLanguage(plugin.settings.language),
		() => {
			picker.setValue(shownLanguage(FOLLOW_OBSIDIAN));
			choose(FOLLOW_OBSIDIAN);
		},
	);
	renderLanguageWidthSizer(picker.el, setting.controlEl, getSelectableLocales());
	const stopWatchingLayout = observeLanguageSettingLayout(setting);
	return {
		picker,
		dispose: () => {
			stopWatchingLayout();
			picker.destroy();
		},
	};
}

/**
 * Follow Obsidian's actual setting-row layout instead of copying its current
 * breakpoint. Core and themes are free to change that breakpoint; the picker
 * only needs to know whether its own row has already stacked. Returns the
 * function that stops watching.
 */
function observeLanguageSettingLayout(setting: Setting): () => void {
	const sync = (): void => {
		setting.settingEl.toggleClass(
			"cs-language-setting-stacked",
			getComputedStyle(setting.settingEl).flexDirection === "column",
		);
	};

	sync();
	const observer = new ResizeObserver(sync);
	observer.observe(setting.settingEl);
	return () => observer.disconnect();
}

/**
 * Size the control column from the widest translated option.
 *
 * The list of languages is Obsidian's menu, which opens apart from the row, so
 * it cannot widen the column. These overlapping, hidden labels can: each is
 * measured at its own width, with the field's own padding and caret around it
 * (styles.css gives them the field's padding variables), without us guessing
 * at glyph widths in proportional fonts. The column also keeps room for the
 * reset arrow whether or not it shows, so the arrow never takes that room from
 * the labels.
 */
function renderLanguageWidthSizer(
	containerEl: HTMLElement,
	controlEl: HTMLElement,
	choices: readonly LanguageChoice[],
): void {
	const sizerEl = containerEl.createDiv({
		cls: "cs-language-width-sizer",
		attr: { "aria-hidden": "true" },
	});
	for (const choice of choices) sizerEl.createSpan({ text: choice.name });

	// Fractional widths, rounded up once at the end: `scrollWidth` rounds to
	// the nearest pixel, which could leave a label half a pixel short.
	const widestLabel = Math.max(
		...Array.from(sizerEl.children, (labelEl) => labelEl.getBoundingClientRect().width),
	);
	if (widestLabel > 0) {
		controlEl.style.setProperty(
			"--cs-language-control-width",
			`${Math.ceil(widestLabel + resetSlotWidth(controlEl))}px`,
		);
	}
}

/**
 * The reset arrow's width plus its gap, measured whether or not it is showing.
 *
 * It is hidden (`display: none`, so no box) while the picker shows Obsidian's
 * language, and it appears as soon as another language is committed, before
 * the tab redraws. Showing it for this one synchronous read paints nothing in
 * between.
 */
function resetSlotWidth(controlEl: HTMLElement): number {
	const resetEl = controlEl.querySelector<HTMLElement>(".clickable-icon");
	if (!resetEl) return 0;
	const hidden = resetEl.hasClass("cs-hidden");
	resetEl.removeClass("cs-hidden");
	const width = resetEl.getBoundingClientRect().width;
	resetEl.toggleClass("cs-hidden", hidden);
	if (width <= 0) return 0;
	const gap = parseFloat(getComputedStyle(controlEl).columnGap);
	return width + (Number.isFinite(gap) ? gap : 0);
}

/**
 * The row a saved preference shows as: the language it renders in.
 *
 * Matched by locale file, so `"auto"`, aliases such as `no` and `zh-hk`, and a
 * code no row offers all land on a real row instead of an empty picker. That
 * last one is a value written by a newer or older version on another device,
 * or by hand. Whatever English covers shows as English, since that is what
 * the user is reading.
 */
function shownLanguage(pref: string): string {
	const file = resolveLocaleFile(pref);
	if (file === null) return ENGLISH;
	return getSelectableLocales().find(({ code }) => resolveLocaleFile(code) === file)?.code ?? ENGLISH;
}

/**
 * Does this preference show the language Obsidian is in? Then, as far as
 * this device can tell, it is the default, and there is nothing to reset.
 *
 * A pinned code can pass. That is an upgrade from the Automatic row, where
 * someone pinned the very language Obsidian uses. Their arrow stays hidden
 * while the two agree and comes back if Obsidian's language moves, on this
 * device or on another one.
 */
function showsObsidianLanguage(pref: string): boolean {
	return resolveLocaleFile(pref) === resolveLocaleFile(FOLLOW_OBSIDIAN);
}

/**
 * What picking the row `code` saves, given the preference saved now.
 *
 * - The row already shown keeps the preference as it is. Re-picking it must
 *   not turn a pinned language into "follow Obsidian" behind the user's back:
 *   the two look the same here, but a synced device whose Obsidian speaks
 *   another language would see the difference.
 * - Obsidian's own language follows Obsidian again, exactly as the reset
 *   arrow would.
 * - Any other row pins that language.
 */
function preferenceFor(current: string, code: string): string {
	if (code === shownLanguage(current)) return current;
	return showsObsidianLanguage(code) ? FOLLOW_OBSIDIAN : code;
}

function languageName(code: string): string {
	return getSelectableLocales().find((choice) => choice.code === code)?.name ?? code;
}

/**
 * Make `pref` the language preference: write it (at once, before the first
 * wait), save it, and bring the interface to it, downloading the language
 * first when this device does not have it.
 *
 * @param redraw Draws the settings again once there is something new to show.
 * @param onDownload Runs just before a download starts, so the page can say so.
 */
export async function applyLanguagePreference(
	plugin: SettingsTabPlugin,
	pref: string,
	redraw: () => void,
	onDownload?: () => void,
): Promise<void> {
	plugin.settings.language = pref;
	await plugin.saveSettings();

	// Nothing to fetch for English, or for a language already on disk —
	// the common case, and it must not flicker a spinner.
	if (plugin.locales.isReady(pref)) {
		setLocale(pref);
		redraw();
		plugin.applyLocaleChange();
		return;
	}

	onDownload?.();
	// ensureLocale applies the new language itself, including the
	// command names and the rendered notes, so there is nothing to do
	// here but redraw: on success every label has changed language, and
	// on failure the warning below has to replace the "Downloading…"
	// text the row may still be showing.
	await plugin.ensureLocale();
	redraw();
}

/**
 * The name of the chosen language when this device has not downloaded it,
 * or null when nothing is missing.
 *
 * Named also while following Obsidian ("עברית is not downloaded yet"), and
 * after the row the picker shows, since codes such as `zh-hk` and `no` are
 * served by another code's file.
 */
export function missingLanguageName(plugin: SettingsTabPlugin): string | null {
	const pref = plugin.settings.language;
	if (!resolveLocaleFile(pref) || plugin.locales.isReady(pref)) return null;
	return languageName(shownLanguage(pref));
}

/** Whether the chosen language is downloading right now. */
export function languageDownloading(plugin: SettingsTabPlugin): boolean {
	const file = resolveLocaleFile(plugin.settings.language);
	return file !== null && plugin.locales.state(file) === "loading";
}

/** Try the download of the chosen language again, then draw the settings again. */
export async function retryLanguageDownload(plugin: SettingsTabPlugin, redraw: () => void): Promise<void> {
	await plugin.ensureLocale();
	redraw();
}
