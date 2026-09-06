/**
 * i18n/index.ts — Internationalization system.
 *
 * Manages the active locale and provides the `t(key, params?)` translation
 * function used everywhere in the plugin.
 *
 * **Only English is bundled.** The other 31 locales are JSON files downloaded on
 * demand and cached in the plugin folder (see LocaleStore.ts); they arrive here
 * through `registerLocale`. That keeps roughly a megabyte of translations most
 * users will never read out of `main.js`, and it is safe because `t()` already
 * resolves a key against the active table, then English, then the key itself —
 * so a locale that is absent, stale or only half-translated degrades one string
 * at a time instead of breaking.
 *
 * Two identifier spaces, kept apart on purpose:
 *
 * - a **locale code** is what the user or Obsidian names (`"he"`, `"zh-tw"`,
 *   `"no"`), and several can mean the same translation;
 * - a **locale file id** is one body of strings — one source module, one JSON
 *   file, one download, one cache entry (`"he"`, `"zhTW"`, `"nb"`).
 *
 * `LOCALE_FILES` maps the first onto the second, which is why picking Norwegian
 * or Hong Kong Chinese downloads nothing new when the file is already there.
 */
import { en } from "./en";
import type { LocaleFileId } from "./localeManifest";

export type LocaleKey = keyof typeof en;

/**
 * Every locale code the plugin answers to, mapped to the file that serves it.
 * English is absent because it needs no download.
 *
 * Keep in step with `localeNames` below: a code offered in the picker but
 * missing here can never be fetched, and the picker would silently sit in
 * English forever.
 */
export const LOCALE_FILES: Record<string, LocaleFileId> = {
	he: "he",
	zh: "zh",
	"zh-tw": "zhTW",
	"zh-hk": "zhTW",
	"zh-sg": "zh",
	es: "es",
	pt: "pt",
	fr: "fr",
	de: "de",
	ru: "ru",
	ja: "ja",
	ko: "ko",
	it: "it",
	tr: "tr",
	nl: "nl",
	pl: "pl",
	uk: "uk",
	id: "id",
	sv: "sv",
	ar: "ar",
	hi: "hi",
	cs: "cs",
	ro: "ro",
	vi: "vi",
	th: "th",
	fa: "fa",
	hu: "hu",
	da: "da",
	nb: "nb",
	no: "nb",
	el: "el",
	bg: "bg",
	ms: "ms",
	fi: "fi",
};

/**
 * Tables available right now: English always, plus whatever has been downloaded
 * and registered this session.
 */
const locales: Record<string, Record<string, string>> = { en };

/**
 * Native display names for every selectable locale, keyed by the canonical
 * locale code. Each value is written in its own language so the language
 * picker reads naturally (e.g. "עברית", not "Hebrew"). Order here is the
 * order shown in the settings dropdown.
 *
 * Deliberately independent of what is downloaded: the picker offers all 32
 * languages whether or not their files are on disk, and choosing one is what
 * triggers the fetch.
 */
const localeNames: Record<string, string> = {
	en: "English",
	he: "עברית",
	zh: "简体中文",
	"zh-tw": "繁體中文",
	es: "Español",
	pt: "Português",
	fr: "Français",
	de: "Deutsch",
	ru: "Русский",
	ja: "日本語",
	ko: "한국어",
	it: "Italiano",
	tr: "Türkçe",
	nl: "Nederlands",
	pl: "Polski",
	uk: "Українська",
	id: "Bahasa Indonesia",
	sv: "Svenska",
	ar: "العربية",
	hi: "हिन्दी",
	cs: "Čeština",
	ro: "Română",
	vi: "Tiếng Việt",
	th: "ไทย",
	fa: "فارسی",
	hu: "Magyar",
	da: "Dansk",
	nb: "Norsk bokmål",
	el: "Ελληνικά",
	bg: "Български",
	ms: "Bahasa Melayu",
	fi: "Suomi",
};

let currentLocale = "en";

/** Saved names must name a table entry, never an inherited Object property. */
const owns = (table: object, key: string): boolean =>
	Object.prototype.hasOwnProperty.call(table, key);

/**
 * Register a downloaded locale so `setLocale` can select it.
 *
 * Called by LocaleStore once a file has been read from disk or fetched and
 * verified. Registering is separate from selecting because the two happen at
 * different times: a file read at startup is registered before the first paint,
 * while one that had to be downloaded arrives well after it.
 */
export function registerLocale(
	code: string,
	strings: Record<string, string>,
): void {
	locales[code] = strings;
}

/**
 * Register a locale file under *every* code it serves.
 *
 * The download unit is the file, but `setLocale` resolves codes, so registering
 * `zhTW` alone would leave `"zh-tw"` and `"zh-hk"` resolving to English with the
 * translation sitting right there in memory. All the codes share one object, so
 * the aliases cost nothing.
 */
export function registerLocaleFile(
	file: LocaleFileId,
	strings: Record<string, string>,
): void {
	for (const [code, id] of Object.entries(LOCALE_FILES)) {
		if (id === file) locales[code] = strings;
	}
}

/** Is a table for this exact code loaded? */
export function isLocaleRegistered(code: string): boolean {
	return owns(locales, code);
}

type MomentLike = { locale: () => string };
type WindowWithMoment = Window & { moment?: MomentLike };

/** The locale Obsidian's own interface is using, lowercased. */
function obsidianLocale(): string {
	return ((window as WindowWithMoment).moment?.locale() ?? "en").toLowerCase();
}

/**
 * Resolve a preference to a locale code that `has` accepts: the full code first
 * (`"zh-tw"`), then its language prefix (`"zh"`), then English.
 *
 * Both callers below share this so they cannot drift. If the resolver that
 * picks a *file to download* disagreed with the one that picks a *table to
 * render*, the plugin would fetch one language and display another.
 */
function resolve(pref: string, has: (code: string) => boolean): string {
	const lower = (pref === "auto" ? obsidianLocale() : pref).toLowerCase();
	if (has(lower)) return lower;
	const lang = lower.split("-")[0] ?? "en";
	return has(lang) ? lang : "en";
}

/**
 * The locale code a preference asks for, whether or not it is downloaded.
 * `"auto"` follows Obsidian's interface language.
 */
export function resolveLocaleCode(pref: string): string {
	return resolve(pref, (code) => code === "en" || owns(LOCALE_FILES, code));
}

/**
 * Which file has to be on disk for a preference to render, or `null` when
 * English already covers it.
 */
export function resolveLocaleFile(pref: string): LocaleFileId | null {
	const code = resolveLocaleCode(pref);
	return owns(LOCALE_FILES, code) ? (LOCALE_FILES[code] ?? null) : null;
}

/**
 * Set the active locale.
 *
 * Falls back to English when the requested locale has not been downloaded yet,
 * which is the ordinary state on a first launch or offline. Call it again once
 * the file lands to switch the UI over.
 */
export function setLocale(pref: string): void {
	currentLocale = resolve(pref, isLocaleRegistered);
}

/**
 * Translate a key, optionally interpolating `{{placeholder}}` tokens.
 *
 * The replacement is passed as a **function**, never as a string. Almost every
 * `{{name}}` in this plugin carries text the user typed — a callout's display
 * name, a file name, an icon name — and `String.prototype.replace` reads `$&`,
 * `` $` ``, `$'`, `$$` and `$1` in a *string* replacement as patterns rather
 * than as characters. A callout called `A$&B` would come back as `A{{name}}B`
 * (`$&` re-inserting the token that was just matched) and one called `$$` as a
 * single `$`. A replacer function is handed the value verbatim, so the only
 * thing this substitutes is the parameter itself.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
	const table = locales[currentLocale] ?? en;
	let value = table[key] ?? en[key] ?? key;

	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			const literal = String(v);
			value = value.replace(
				new RegExp(`\\{\\{${k}\\}\\}`, "g"),
				() => literal,
			);
		}
	}

	return value;
}

/** Returns the current locale code. */
export function getLocale(): string {
	return currentLocale;
}

/**
 * Locale codes with a table loaded right now — English, plus anything
 * downloaded and registered this session. Diagnostics; the picker uses
 * `getSelectableLocales`, which is not gated on what has been downloaded.
 */
export function getAvailableLocales(): string[] {
	return Object.keys(locales);
}

/**
 * Returns the locales offered in the language picker, each with its own
 * native display name, in the order they should appear in the dropdown.
 */
export function getSelectableLocales(): { code: string; name: string }[] {
	return Object.entries(localeNames).map(([code, name]) => ({ code, name }));
}
