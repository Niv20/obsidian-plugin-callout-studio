/**
 * settings/sections/languagePicker.ts — the plugin's interface language.
 *
 * Who calls it. The settings page's footer, whose globe opens the language menu
 * (declarative/footerGroup.ts), and the guarded pick it makes
 * (declarative/generalRows.ts).
 *
 * The main idea. A menu lets the user choose the plugin's display language.
 * It lists languages and nothing else, each under its own native name (e.g.
 * "עברית", not "Hebrew"), with a ✓ beside the one shown. There is no "Automatic"
 * row: following Obsidian is what the plugin does until told otherwise, so the
 * menu simply shows the language Obsidian is in, and picking it follows
 * Obsidian again. The choice is persisted in PluginSettings and re-rendering the
 * tab refreshes every label in the new language.
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
 * stays as it was until it succeeds, which is the honest outcome. Silently
 * reverting the menu would look like the click had not registered.
 *
 * The download is told in notices, never in the page: a row that appeared
 * above the footer in the middle of the switch moved the page under the
 * pointer. A language already on the device switches at once, with no notice.
 * One that has to be fetched is told like a vault scan (manualScan.ts): a
 * "Downloading…" notice with the mascot painting, up for one whole stroke at
 * least however quick the fetch is, then a notice with the result. A failure
 * comes with a Retry button; picking the language again, from the globe,
 * retries as well. A language still missing when the settings open is told in
 * the same kind of notice (the launch's own fetch is silent).
 *
 * The steps (the menu, applying a choice, the notice on opening) are exported
 * one by one, for the page to put together.
 */
import { DEFAULT_SETTINGS } from "../../constants";
import { getSelectableLocales, resolveLocaleFile, setLocale, t } from "../../i18n";
import { BEFORE_RESULT_MS, showNotice, workNotice, WORK_ONE_PASS_MS } from "../../ui/mascot/mascotNotices";
import { showActionNotice } from "../../ui/noticeAction";
import { SelectDropdown } from "../../ui/selectDropdown";
import type { SettingsTabPlugin } from "./types";

/** The saved preference that follows Obsidian's interface language. */
const FOLLOW_OBSIDIAN = DEFAULT_SETTINGS.language;

/** The row for everything English covers: no file, nothing to download. */
const ENGLISH = "en";

/**
 * The plugins whose language is being fetched for a notice now: a second
 * request meanwhile (Retry pressed on an older notice) would put two
 * "Downloading…" notices on top of each other. A WeakSet: it holds no plugin
 * alive, and an unloaded plugin's entry goes with it.
 */
const fetching = new WeakSet<SettingsTabPlugin>();

/**
 * Draw the language button — a globe and the name of the language shown — into
 * `parent`. Pressing it opens Obsidian's menu of every language, with a ✓ beside
 * the one shown.
 *
 * @param choose Called with the preference to save when the user picks a
 *   language. It must write the preference into the settings before it
 *   returns (it may go on saving and downloading afterwards).
 */
export function drawLanguageMenu(
	parent: HTMLElement,
	plugin: SettingsTabPlugin,
	choose: (pref: string) => void,
): SelectDropdown {
	return (
		new SelectDropdown(parent, t("settings.language"), { icon: "globe", showValue: true })
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
			})
	);
}

/**
 * The row a saved preference shows as: the language it renders in.
 *
 * Matched by locale file, so `"auto"`, aliases such as `no` and `zh-hk`, and a
 * code no row offers all land on a real row instead of none being ticked. That
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
 * this device can tell, it is the default.
 *
 * A pinned code can pass. That is an upgrade from the Automatic row, where
 * someone pinned the very language Obsidian uses. It stays pinned while the
 * two agree, and shows as a different language again if Obsidian's moves, on
 * this device or on another one.
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
 * - Obsidian's own language follows Obsidian again. This is the way back to
 *   the default: the menu has no Automatic row and no reset arrow.
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
 */
export async function applyLanguagePreference(
	plugin: SettingsTabPlugin,
	pref: string,
	redraw: () => void,
): Promise<void> {
	plugin.settings.language = pref;
	await plugin.saveSettings();

	// A copy cached by an earlier session is on disk but not yet loaded, and
	// reading it is not a download to tell the user about.
	if (!plugin.locales.isReady(pref)) await plugin.locales.prepare(pref);

	// Nothing to fetch for English, or for a language already on disk —
	// the common case, and it must not flicker a notice.
	if (plugin.locales.isReady(pref)) {
		setLocale(pref);
		redraw();
		plugin.applyLocaleChange();
		return;
	}

	await downloadLanguage(plugin, redraw);
}

/**
 * Fetch the chosen language and tell how it went, in notices. The fetch itself
 * is `ensureLocale`, which applies the new language itself, including the
 * command names and the rendered notes, once it arrives.
 *
 * "Downloading…" stays up for the mascot to be seen painting one whole stroke
 * even when the fetch ends at once, and a pause follows before the result, so
 * the two notices can each be read (the same as the vault scan). A second call
 * while one runs does nothing.
 */
async function downloadLanguage(plugin: SettingsTabPlugin, redraw: () => void): Promise<void> {
	if (fetching.has(plugin)) return;
	fetching.add(plugin);
	// Named before the wait, from the preference that is being fetched.
	const name = languageName(shownLanguage(plugin.settings.language));
	const work = workNotice(t("locale.downloading"), { minMs: WORK_ONE_PASS_MS, gapMs: BEFORE_RESULT_MS });
	let arrived = false;
	try {
		arrived = await plugin.ensureLocale();
		// The globe was dimmed while the language downloaded.
		redraw();
	} catch (error) {
		// Caught so the notice below cannot be left up for good.
		console.error("[callout-studio] language download failed", error);
	}
	try {
		await work.done();
		// Unloaded in the meantime: there is no one left to tell.
		if (plugin.settingsWriter.isDestroyed) return;
		if (arrived) showNotice("success", t("locale.downloaded"));
		else tellNotDownloaded("problem", plugin, name, redraw);
	} finally {
		fetching.delete(plugin);
	}
}

/**
 * Say, in a notice with a Retry button, that the language `name` is not on
 * this device. `kind` is what the news is: a `problem` right after a fetch
 * failed, a `warning` when the settings open and find it still missing.
 */
function tellNotDownloaded(
	kind: "problem" | "warning",
	plugin: SettingsTabPlugin,
	name: string,
	redraw: () => void,
): void {
	showActionNotice(kind, t("locale.notDownloaded", { name }), {
		label: t("locale.retry"),
		run: () => {
			void downloadLanguage(plugin, redraw);
		},
	});
}

/**
 * The name of the chosen language when this device has not downloaded it,
 * or null when nothing is missing.
 *
 * Named also while following Obsidian ("עברית is not downloaded yet"), and
 * after the row the picker shows, since codes such as `zh-hk` and `no` are
 * served by another code's file.
 */
function missingLanguageName(plugin: SettingsTabPlugin): string | null {
	const pref = plugin.settings.language;
	if (!resolveLocaleFile(pref) || plugin.locales.isReady(pref)) return null;
	return languageName(shownLanguage(pref));
}

/**
 * When the settings open: if the chosen language is still not on this device,
 * say so in a notice with Retry. A fetch failing at launch is silent (English
 * works), and this is where the user, who may have wondered why the interface
 * is not in their language, is told. Nothing is said while the language is
 * downloading, or while a fetch started from here is under way, since both
 * tell their own result.
 */
export function tellMissingLanguage(plugin: SettingsTabPlugin, redraw: () => void): void {
	const name = missingLanguageName(plugin);
	if (name === null || languageDownloading(plugin) || fetching.has(plugin)) return;
	tellNotDownloaded("warning", plugin, name, redraw);
}

/** Whether the chosen language is downloading right now. */
export function languageDownloading(plugin: SettingsTabPlugin): boolean {
	const file = resolveLocaleFile(plugin.settings.language);
	return file !== null && plugin.locales.state(file) === "loading";
}
