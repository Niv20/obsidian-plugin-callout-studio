/**
 * tests/support/localeTables.ts — every translation source, as data.
 *
 * `tests/locales.test.ts` reads the *generated* `locales/*.json`; this reads
 * the `src/i18n/*.ts` they are generated **from**. The distinction is the whole
 * reason this file exists: the JSON and the manifest are written by the same
 * run of `scripts/generate-locales.mjs`, so an edit to `he.ts` that was never
 * regenerated leaves the two agreeing with each other and disagreeing with the
 * source. Checking the source catches that edit in `npm test`, before CI's
 * `git diff --exit-code` does.
 *
 * The imports are spelled out one per line because esbuild resolves imports at
 * build time — there is no glob to expand, and the generator's `readdirSync`
 * trick needs esbuild itself, which cannot be bundled into a test. The cost of
 * that is a list that could silently fall behind `src/i18n/`, so
 * `tests/localeContent.test.ts` asserts these ids are exactly
 * `LOCALE_MANIFEST`'s: adding a 32nd language fails that test until it is
 * listed here, rather than quietly going untested.
 *
 * `en` is deliberately kept separate — it is the reference every other table is
 * measured against, not one of the things being measured.
 */
import type { LocaleFileId } from "../../src/i18n/localeManifest";

import { ar } from "../../src/i18n/ar";
import { bg } from "../../src/i18n/bg";
import { cs } from "../../src/i18n/cs";
import { da } from "../../src/i18n/da";
import { de } from "../../src/i18n/de";
import { el } from "../../src/i18n/el";
import { es } from "../../src/i18n/es";
import { fa } from "../../src/i18n/fa";
import { fi } from "../../src/i18n/fi";
import { fr } from "../../src/i18n/fr";
import { he } from "../../src/i18n/he";
import { hi } from "../../src/i18n/hi";
import { hu } from "../../src/i18n/hu";
import { id } from "../../src/i18n/id";
import { it } from "../../src/i18n/it";
import { ja } from "../../src/i18n/ja";
import { ko } from "../../src/i18n/ko";
import { ms } from "../../src/i18n/ms";
import { nb } from "../../src/i18n/nb";
import { nl } from "../../src/i18n/nl";
import { pl } from "../../src/i18n/pl";
import { pt } from "../../src/i18n/pt";
import { ro } from "../../src/i18n/ro";
import { ru } from "../../src/i18n/ru";
import { sv } from "../../src/i18n/sv";
import { th } from "../../src/i18n/th";
import { tr } from "../../src/i18n/tr";
import { uk } from "../../src/i18n/uk";
import { vi } from "../../src/i18n/vi";
import { zh } from "../../src/i18n/zh";
import { zhTW } from "../../src/i18n/zhTW";

/** One locale's strings, read straight off the source module. */
export type LocaleTable = Readonly<Record<string, string>>;

/**
 * Every downloadable locale, keyed by file id. English is absent on purpose:
 * it is bundled, not downloaded, and it is the reference rather than a subject.
 */
export const LOCALE_TABLES: Record<LocaleFileId, LocaleTable> = {
	ar,
	bg,
	cs,
	da,
	de,
	el,
	es,
	fa,
	fi,
	fr,
	he,
	hi,
	hu,
	id,
	it,
	ja,
	ko,
	ms,
	nb,
	nl,
	pl,
	pt,
	ro,
	ru,
	sv,
	th,
	tr,
	uk,
	vi,
	zh,
	zhTW,
};

/** `[fileId, table]` for every downloadable locale, in id order. */
export const localeEntries = (): [LocaleFileId, LocaleTable][] =>
	(Object.keys(LOCALE_TABLES) as LocaleFileId[]).sort().map((fileId) => [fileId, LOCALE_TABLES[fileId]]);

/**
 * The three right-to-left languages the plugin ships.
 *
 * Not derived from anything — there is no RTL flag in the codebase, and
 * inventing one for a test would be asserting against a fact this file made
 * up. Listed instead, so adding an RTL language is a deliberate edit here.
 */
export const RTL_LOCALES: LocaleFileId[] = ["he", "ar", "fa"];
