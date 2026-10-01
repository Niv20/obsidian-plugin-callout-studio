/**
 * tests/translate.test.ts — `t()` and the two resolvers around it.
 *
 * The whole downloadable-translation design rests on one property: **a locale
 * that is absent, stale or half-translated must cost exactly the strings it is
 * missing, and nothing else.** That is not a nice-to-have. English is the only
 * table inside `main.js`, so on a first launch — and on every launch of a
 * device that never reaches the network — the active table either does not
 * exist or trails `en.ts` by however many strings have been added since the
 * last translation pass. If `t()` returned a raw key for one of them, the
 * shipping failure mode would be a settings pane with `settings.import` written
 * across it, not a slightly English-flavoured one.
 *
 * So the ladder is the subject here: **active table → English → the key
 * itself**, with interpolation applied to whichever rung answered. The last
 * rung is a diagnostic that should never be reached in a release; the middle
 * one is reached constantly and by design.
 *
 * The resolver suite below it is the other half of the same promise. A *code*
 * is what the user or Obsidian names (`"zh-hk"`, `"no"`, `"auto"`); a *file* is
 * one body of strings. Several codes share one file, which is what keeps
 * Norwegian and Hong Kong Chinese from being second downloads — and what makes
 * "registered the file, still rendering English" a bug the type system cannot
 * catch, since both sides are plain strings.
 *
 * Module state note: `locales` and `currentLocale` in `src/i18n/index.ts` are
 * module-level, exactly as they are in a running plugin. `npm test` gives each
 * test *file* its own process, so nothing here leaks into another suite — but
 * order matters *within* this file, and the registration sweep at the bottom
 * runs last on purpose, because it populates every real locale code.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	LOCALE_FILES,
	getAvailableLocales,
	getLocale,
	isLocaleRegistered,
	registerLocale,
	registerLocaleFile,
	resolveLocaleCode,
	resolveLocaleFile,
	setLocale,
	t,
} from "../src/i18n";
import { en } from "../src/i18n/en";
import { LOCALE_MANIFEST, type LocaleFileId } from "../src/i18n/localeManifest";

/**
 * A key `en.ts` really has, used where the point is the *fallback* rather than
 * the copy. Read from `en` rather than written out, so a reworded string does
 * not fail a test that is not about wording.
 */
const REAL_KEY = "settings.import";

/** A key with interpolation that English really carries. */
const REAL_TEMPLATE_KEY = "cmd.customWrapBlock";

/* -------------------------------------------------------------------------- */
/* The fallback ladder                                                        */
/* -------------------------------------------------------------------------- */

describe("t() resolves through the active table, then English, then the key", () => {
	// Registered under an invented code so nothing here touches a real
	// language: this suite is about the ladder, not about any translation.
	registerLocale("partial", {
		"probe.own": "OWN",
		"probe.template": "one {{name}}, two {{name}}",
		"probe.plain": "nothing to fill",
	});

	it("prefers the active table", () => {
		setLocale("partial");
		assert.strictEqual(getLocale(), "partial");
		assert.strictEqual(t("probe.own"), "OWN");
	});

	it("falls through to English for a key the locale lacks", () => {
		// The ordinary state between an `en.ts` edit and its translation pass,
		// and the state of *every* stale cached file after a release that added
		// strings. It has to be invisible, not merely survivable.
		setLocale("partial");
		assert.strictEqual(t(REAL_KEY), en[REAL_KEY]);
		assert.notStrictEqual(en[REAL_KEY], undefined);
	});

	it("returns the key itself when nothing has it", () => {
		setLocale("partial");
		assert.strictEqual(t("no.such.key.anywhere"), "no.such.key.anywhere");
		assert.ok(!("no.such.key.anywhere" in en));
	});

	it("returns the key under English too, not just under a translation", () => {
		// The rung is in `t()`, not in the fallback table, so a missing key is a
		// visible key in every language including the bundled one.
		setLocale("en");
		assert.strictEqual(t("no.such.key.anywhere"), "no.such.key.anywhere");
	});

	it("renders English when the requested locale was never registered", () => {
		// A first launch, or offline: the file has not landed, so `setLocale`
		// resolves to English rather than to an empty table.
		setLocale("th");
		assert.strictEqual(getLocale(), "en");
		assert.strictEqual(t(REAL_KEY), en[REAL_KEY]);
	});

	it("falls from a regional code to a registered language table", () => {
		// `setLocale` resolves against what is *loaded*, not against the code
		// list — so a device holding only the base language still renders it
		// when the preference names a region.
		registerLocale("qq", { "probe.own": "BASE" });
		setLocale("qq-zz");
		assert.strictEqual(getLocale(), "qq");
		assert.strictEqual(t("probe.own"), "BASE");
	});

	it("does not invent a table for an unknown language", () => {
		setLocale("kl");
		assert.strictEqual(getLocale(), "en");
	});
});

/* -------------------------------------------------------------------------- */
/* Interpolation                                                              */
/* -------------------------------------------------------------------------- */

describe("t() interpolates {{placeholder}} tokens", () => {
	it("replaces every occurrence, not just the first", () => {
		// The regex carries `g`; without it "one {{name}}, two {{name}}" would
		// ship half-filled, which reads as a rendering glitch rather than a bug.
		setLocale("partial");
		assert.strictEqual(t("probe.template", { name: "X" }), "one X, two X");
	});

	it("stringifies numbers", () => {
		setLocale("partial");
		assert.strictEqual(t("probe.template", { name: 3 }), "one 3, two 3");
	});

	it("substitutes falsy values rather than skipping them", () => {
		// `0` and `""` are ordinary counts and names; a guard like `if (v)`
		// would silently leave the raw token in the sentence.
		setLocale("partial");
		assert.strictEqual(t("probe.template", { name: 0 }), "one 0, two 0");
		assert.strictEqual(t("probe.template", { name: "" }), "one , two ");
	});

	it("leaves a token whose parameter was not supplied", () => {
		// Deliberately not an error. A caller that forgets one parameter still
		// renders the rest of the sentence, and the leftover `{{name}}` is the
		// diagnostic — the alternative, throwing, would take a whole modal down
		// over one label.
		setLocale("partial");
		assert.strictEqual(
			t("probe.template", { other: "X" }),
			"one {{name}}, two {{name}}",
		);
	});

	it("leaves every token when no parameters are passed at all", () => {
		setLocale("partial");
		assert.strictEqual(t("probe.template"), "one {{name}}, two {{name}}");
	});

	it("ignores parameters the string does not use", () => {
		setLocale("partial");
		assert.strictEqual(t("probe.plain", { name: "X" }), "nothing to fill");
	});

	it("matches token names exactly, including case", () => {
		// `{{name}}` and `{{Name}}` are different tokens. This is why
		// `tests/localeContent.test.ts` compares them across all 31 locales:
		// nothing at runtime notices a translator who changed the casing.
		setLocale("partial");
		assert.strictEqual(
			t("probe.template", { Name: "X" }),
			"one {{name}}, two {{name}}",
		);
	});

	it("interpolates into the English fallback, not only into a translation", () => {
		// The two features compose: a key that fell through to English still
		// gets its parameters. Missing this would make every *new* templated
		// string render with raw tokens in all 31 languages until translated.
		setLocale("partial");
		const source = en[REAL_TEMPLATE_KEY];
		assert.ok(source?.includes("{{name}}"), `${REAL_TEMPLATE_KEY} lost its token`);
		const rendered = t(REAL_TEMPLATE_KEY, { name: "Tip" });
		assert.ok(rendered.includes("Tip"));
		assert.ok(!rendered.includes("{{"));
	});

	it("returns a missing key intact even when parameters are passed", () => {
		// Interpolation runs on whichever rung answered, and the last rung is
		// the key itself — a single `??` chain feeding one `replace` loop. That
		// is harmless because a key is a dotted identifier and can never
		// contain a token, and this pins the property that follows from it: the
		// diagnostic string stays greppable rather than arriving half-filled.
		setLocale("partial");
		assert.strictEqual(t("no.such.key.anywhere", { name: "X" }), "no.such.key.anywhere");
	});

	/**
	 * `String.prototype.replace` reads `$&`, `` $` ``, `$'`, `$$` and `$n` in a
	 * *string* replacement as patterns rather than as characters, so passing the
	 * parameter straight in as one makes the substituted text re-enter the
	 * substitution. Almost every `{{name}}` in this plugin carries text the user
	 * typed — a callout's display name, a file name, an icon name — so this is
	 * reachable without anyone doing anything unusual: a callout called `A$&B`
	 * used to render as `A{{name}}B`, because `$&` re-inserts the token that was
	 * just matched, and one called `$$` used to render as a single `$`.
	 *
	 * The fix is to hand `replace` a function, which receives the value verbatim.
	 */
	it("treats a parameter as literal text, not as a replacement pattern", () => {
		setLocale("partial");
		// `$&` — the whole match. Used to put the token back, unfilled.
		assert.strictEqual(t("probe.template", { name: "A$&B" }), "one A$&B, two A$&B");
		// `$$` — an escaped dollar. Used to halve every run of them.
		assert.strictEqual(t("probe.template", { name: "$$" }), "one $$, two $$");
		assert.strictEqual(t("probe.template", { name: "$" }), "one $, two $");
		// `` $` `` / `$'` — the text before and after the match. Used to splice
		// the rest of the sentence in, at a position that differs per occurrence.
		assert.strictEqual(
			t("probe.template", { name: "X$`Y" }),
			"one X$`Y, two X$`Y",
		);
		assert.strictEqual(
			t("probe.template", { name: "X$'Y" }),
			"one X$'Y, two X$'Y",
		);
		// `$n` / `$<n>` — capture groups. The token regex has none, so these
		// already survived; pinned so a future capturing group cannot break them.
		assert.strictEqual(t("probe.template", { name: "$1" }), "one $1, two $1");
		assert.strictEqual(
			t("probe.template", { name: "$<name>" }),
			"one $<name>, two $<name>",
		);
	});

	it("substitutes a real display name that is nothing but dollars", () => {
		// The regression as a user meets it rather than as a pattern table: a
		// callout named `$$$` in a sentence English really ships. Before the fix
		// this rendered `$$`, one character short, with nothing to suggest why.
		setLocale("en");
		const rendered = t(REAL_TEMPLATE_KEY, { name: "$$$" });
		assert.ok(rendered.includes("$$$"), rendered);
		assert.ok(!rendered.includes("{{"), rendered);
	});
});

/* -------------------------------------------------------------------------- */
/* Codes, files and "auto"                                                    */
/* -------------------------------------------------------------------------- */

describe("a locale code resolves to the file that serves it", () => {
	it("points every code at a file the manifest ships", () => {
		for (const [code, fileId] of Object.entries(LOCALE_FILES)) {
			assert.strictEqual(
				resolveLocaleFile(code),
				fileId,
				`${code} did not resolve to ${fileId}`,
			);
			assert.ok(fileId in LOCALE_MANIFEST, `${code} → ${fileId}, undownloadable`);
		}
	});

	it("shares one file between the codes that mean the same translation", () => {
		// The reason this matters is bandwidth and correctness at once: picking
		// Hong Kong Chinese must render the Traditional table already on disk,
		// not fetch a second copy and not sit in English beside one.
		assert.strictEqual(resolveLocaleFile("zh-tw"), "zhTW");
		assert.strictEqual(resolveLocaleFile("zh-hk"), "zhTW");
		assert.strictEqual(resolveLocaleFile("zh"), "zh");
		assert.strictEqual(resolveLocaleFile("zh-sg"), "zh");
		assert.strictEqual(resolveLocaleFile("no"), "nb");
		assert.strictEqual(resolveLocaleFile("nb"), "nb");
	});

	it("is case-insensitive, because Obsidian's locale is not normalised", () => {
		assert.strictEqual(resolveLocaleFile("ZH-HK"), "zhTW");
		assert.strictEqual(resolveLocaleCode("DE-AT"), "de");
	});

	it("falls from a region to its language", () => {
		assert.strictEqual(resolveLocaleCode("pt-br"), "pt");
		assert.strictEqual(resolveLocaleFile("pt-br"), "pt");
		assert.strictEqual(resolveLocaleFile("fr-ca"), "fr");
	});

	it("asks for no download when English already covers it", () => {
		// `null` is what `LocaleStore.prepare`/`ensure` short-circuit on, so
		// this is the assertion that keeps an English user entirely offline.
		assert.strictEqual(resolveLocaleFile("en"), null);
		assert.strictEqual(resolveLocaleFile("en-gb"), null);
		assert.strictEqual(resolveLocaleFile("kl"), null);
		assert.strictEqual(resolveLocaleCode("kl"), "en");
	});

	it("follows Obsidian's own language for 'auto'", () => {
		// `resolveLocaleCode` and `resolveLocaleFile` share one `resolve()`
		// helper precisely so the file downloaded and the table rendered cannot
		// disagree; "auto" is the case where the answer comes from outside the
		// plugin, so it is the one worth pinning.
		const globals = globalThis as { __CS_LANGUAGE__?: string };
		try {
			globals.__CS_LANGUAGE__ = "zh-HK";
			assert.strictEqual(resolveLocaleCode("auto"), "zh-hk");
			assert.strictEqual(resolveLocaleFile("auto"), "zhTW");

			globals.__CS_LANGUAGE__ = "pt-BR";
			assert.strictEqual(resolveLocaleCode("auto"), "pt");

			// An older Obsidian's code for Czech, which moment knew as `cs`.
			globals.__CS_LANGUAGE__ = "cz";
			assert.strictEqual(resolveLocaleCode("auto"), "cs");

			globals.__CS_LANGUAGE__ = "";
			assert.strictEqual(resolveLocaleCode("auto"), "en");
			assert.strictEqual(resolveLocaleFile("auto"), null);
		} finally {
			delete globals.__CS_LANGUAGE__;
		}
	});

	it("asks Obsidian for its language, not moment, which other plugins re-point", () => {
		// Calendar's "Override locale" moves moment's global locale for its
		// date formats. Read from there, "follow Obsidian" followed Calendar.
		const globals = globalThis as { window?: unknown; __CS_LANGUAGE__?: string };
		const saved = globals.window;
		try {
			globals.window = { moment: { locale: () => "fr" } };
			globals.__CS_LANGUAGE__ = "he";
			assert.strictEqual(resolveLocaleCode("auto"), "he");
		} finally {
			globals.window = saved;
			delete globals.__CS_LANGUAGE__;
		}
	});
});

/* -------------------------------------------------------------------------- */
/* Registration — runs last, it populates every real code                     */
/* -------------------------------------------------------------------------- */

describe("registering a downloaded file reaches every code it serves", () => {
	const fileIds = Object.keys(LOCALE_MANIFEST) as LocaleFileId[];

	it("registers no real language before the sweep below", () => {
		// Establishes the starting point the next test measures against, and
		// would catch an import that quietly registered something on load.
		assert.deepStrictEqual(
			getAvailableLocales().filter((code) => code in LOCALE_FILES),
			[],
		);
	});

	it("renders every code that maps to the file, not just the file id", () => {
		// The download unit is the file and the render unit is the code, so
		// registering `zhTW` alone leaves "zh-tw" and "zh-hk" in English with
		// the translation sitting in memory a few bytes away. Each file gets a
		// sentinel value so a code rendering the *wrong* file also fails.
		for (const fileId of fileIds) {
			registerLocaleFile(fileId, { "probe.own": `from:${fileId}` });
		}

		for (const [code, fileId] of Object.entries(LOCALE_FILES)) {
			assert.ok(isLocaleRegistered(code), `${code} was never registered`);
			setLocale(code);
			assert.strictEqual(getLocale(), code, `${code} did not become active`);
			assert.strictEqual(
				t("probe.own"),
				`from:${fileId}`,
				`${code} rendered the wrong file`,
			);
		}
	});

	it("registers the codes and nothing else", () => {
		// `zhTW` is a file id, never a code Obsidian or the picker uses, so it
		// must not become selectable — otherwise `getAvailableLocales()` starts
		// reporting languages `resolveLocaleFile` has never heard of.
		assert.ok(!isLocaleRegistered("zhTW"), "the file id leaked in as a code");
		assert.ok(isLocaleRegistered("nb"), "nb is a code as well as a file id");

		const unexpected = getAvailableLocales().filter(
			(code) =>
				code !== "en" &&
				!(code in LOCALE_FILES) &&
				!["partial", "qq"].includes(code),
		);
		assert.deepStrictEqual(unexpected, []);
	});

	it("gives the aliases the same object, so they cost nothing", () => {
		setLocale("zh-tw");
		const traditional = t("probe.own");
		setLocale("zh-hk");
		assert.strictEqual(t("probe.own"), traditional);
		setLocale("no");
		const norwegian = t("probe.own");
		setLocale("nb");
		assert.strictEqual(t("probe.own"), norwegian);
	});
});
