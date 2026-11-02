/**
 * tests/locales.test.ts — the downloadable-translation contract.
 *
 * Only English is bundled; the other 31 languages are JSON files served from
 * the plugin's release tag and verified against checksums compiled into
 * main.js. That makes two silent failure modes possible, and both are invisible
 * until a user in that language updates:
 *
 * - a locale edited without regenerating `locales/` — every download for that
 *   version then fails its checksum, and the whole UI falls back to English;
 * - a locale code that resolves to a file the manifest has never heard of, or
 *   to a different file than `setLocale` will pick — the plugin downloads one
 *   language and displays another.
 *
 * Everything here is about those two. The CI workflows also re-run the
 * generator and diff the result, which catches the first case at commit time;
 * this catches it in `npm test` as well, and covers the resolver besides.
 */
import assert from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
	LOCALE_FILES,
	getSelectableLocales,
	isLocaleRegistered,
	registerLocaleFile,
	resolveLocaleCode,
	resolveLocaleFile,
	setLocale,
	getLocale,
	t,
} from "../src/i18n";
import { en } from "../src/i18n/en";
import { LOCALE_FORMAT, LOCALE_MANIFEST, type LocaleFileId } from "../src/i18n/localeManifest";

const LOCALE_DIR = join(process.cwd(), "locales");

const files = readdirSync(LOCALE_DIR)
	.filter((f) => f.endsWith(".json"))
	.map((f) => f.slice(0, -5) as LocaleFileId)
	.sort();

const manifestIds = Object.keys(LOCALE_MANIFEST).sort() as LocaleFileId[];

describe("locales/ matches the manifest compiled into the build", () => {
	it("has a file for every manifest entry and vice versa", () => {
		assert.deepStrictEqual(files, manifestIds);
		assert.ok(files.length > 0, "no locale files were generated");
	});

	for (const id of manifestIds) {
		it(`${id}.json is byte-for-byte what the build expects`, () => {
			const raw = readFileSync(join(LOCALE_DIR, `${id}.json`));
			const expected = LOCALE_MANIFEST[id];

			assert.strictEqual(
				raw.byteLength,
				expected.bytes,
				"size drifted — run npm run i18n:generate and commit the result",
			);
			assert.strictEqual(
				createHash("sha256").update(raw).digest("hex"),
				expected.sha256,
				"checksum drifted — run npm run i18n:generate and commit the result",
			);
		});

		it(`${id}.json carries the shape the runtime accepts`, () => {
			const file = JSON.parse(readFileSync(join(LOCALE_DIR, `${id}.json`), "utf8")) as {
				format: number;
				locale: string;
				strings: Record<string, string>;
			};

			// The runtime rejects a payload whose identity does not match what it
			// asked for, so a mis-generated file must fail here, not on a device.
			assert.strictEqual(file.format, LOCALE_FORMAT);
			assert.strictEqual(file.locale, id);
			assert.strictEqual(Object.keys(file.strings).length, LOCALE_MANIFEST[id].keys);
			for (const [key, value] of Object.entries(file.strings)) {
				assert.strictEqual(typeof value, "string", `${key} is not a string`);
			}
		});

		it(`${id}.json has no keys English lacks`, () => {
			// The reverse is allowed and normal: en.ts is edited alone, so a
			// locale trails it until the translation pass. A key with no English
			// counterpart is different — nothing can ever look it up.
			const file = JSON.parse(readFileSync(join(LOCALE_DIR, `${id}.json`), "utf8")) as {
				strings: Record<string, string>;
			};
			const orphans = Object.keys(file.strings).filter((k) => !(k in en));
			assert.deepStrictEqual(orphans, []);
		});
	}
});

describe("locale codes resolve to the right file", () => {
	it("offers no language it cannot fetch", () => {
		for (const { code } of getSelectableLocales()) {
			if (code === "en") continue;
			assert.ok(code in LOCALE_FILES, `${code} is in the picker but has no file`);
		}
	});

	it("points every code at a file that exists", () => {
		for (const [code, id] of Object.entries(LOCALE_FILES)) {
			assert.ok(id in LOCALE_MANIFEST, `${code} → ${id}, which has no data`);
		}
	});

	it("maps aliases onto the file that serves them", () => {
		// Several codes deliberately share one body of strings, which is what
		// keeps Hong Kong Chinese or Norwegian from being a second download.
		assert.strictEqual(resolveLocaleFile("zh-tw"), "zhTW");
		assert.strictEqual(resolveLocaleFile("zh-hk"), "zhTW");
		assert.strictEqual(resolveLocaleFile("zh-sg"), "zh");
		assert.strictEqual(resolveLocaleFile("no"), "nb");
		assert.strictEqual(resolveLocaleFile("he"), "he");
	});

	it("falls back from a regional code to its language", () => {
		assert.strictEqual(resolveLocaleCode("pt-br"), "pt");
		assert.strictEqual(resolveLocaleFile("pt-br"), "pt");
		assert.strictEqual(resolveLocaleCode("DE-AT"), "de");
	});

	it("needs no download for English or an unknown language", () => {
		assert.strictEqual(resolveLocaleFile("en"), null);
		assert.strictEqual(resolveLocaleFile("en-gb"), null);
		assert.strictEqual(resolveLocaleFile("kl"), null);
		assert.strictEqual(resolveLocaleCode("kl"), "en");
	});
});

describe("registering a downloaded file", () => {
	it("makes every code it serves selectable, not just its own id", () => {
		// Registering under the file id alone would leave "zh-tw" and "zh-hk"
		// resolving to English with the translation sitting in memory.
		assert.strictEqual(isLocaleRegistered("zh-tw"), false);
		registerLocaleFile("zhTW", { "settings.language": "語言" });

		assert.strictEqual(isLocaleRegistered("zh-tw"), true);
		assert.strictEqual(isLocaleRegistered("zh-hk"), true);

		setLocale("zh-hk");
		assert.strictEqual(getLocale(), "zh-hk");
		assert.strictEqual(t("settings.language"), "語言");
	});

	it("fills a missing key from English rather than showing the key", () => {
		// The property the whole feature rests on: a locale that trails en.ts —
		// or a stale file from an older release — degrades one string at a time.
		setLocale("zh-hk");
		assert.strictEqual(t("settings.import"), en["settings.import"]);
		assert.strictEqual(t("no.such.key"), "no.such.key");
	});

	it("renders English while the language is still undownloaded", () => {
		setLocale("th");
		assert.strictEqual(getLocale(), "en");
		assert.strictEqual(t("settings.language"), en["settings.language"]);
	});
});
