/**
 * tests/rowTagLocales.test.ts — the tag after a callout's name is one short word
 * in every language.
 *
 * The callout rows in the settings keep the name on one line, with its tag
 * beside it (styles.css, *Callout List Rows*). The tag is what a long name has
 * to make room for, so both tags were cut to one word in all 32 languages
 * (2026-10-31 and 2026-11-01):
 *
 * - `settings.fallbackTagAuto`, on a callout that follows the default fallback
 *   style. English "Auto"; it used to be "Default fallback" and, translated,
 *   "Predeterminado automático", "Automatischer Standard" and the like, which
 *   on a phone took more than half the line.
 * - `settings.fallbackTag`, on the callout that is the fallback. English
 *   "Default"; French "Par défaut", Russian "По умолчанию", Bulgarian "По
 *   подразбиране" and Ukrainian "За замовчуванням" were two or three words.
 *
 * The emoji skin-tone picker used to share the second key and says "Default"
 * for its first tone. It has a key of its own now (`iconPicker.skinToneDefault`)
 * that holds what every language said before, so cutting the row's tag did not
 * touch the picker.
 *
 * What this pins: one word (no space; Vietnamese writes the two syllables of
 * "Mặc định" and "Tự động" apart, and each is one word), and short enough that
 * the name keeps most of the line. It does not pin which word: the translation
 * is the translators', and any one short word passes.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { en } from "../src/i18n/en";
import { localeEntries } from "./support/localeTables";

/** The two tags, and the most characters each may have (the tag is drawn in capitals at 10px). */
const TAGS = [
	{ key: "settings.fallbackTag", most: 15 },
	{ key: "settings.fallbackTagAuto", most: 12 },
] as const;

/** The languages whose one word is written as separate syllables. */
const SPACED_WORDS: ReadonlySet<string> = new Set(["vi"]);

for (const { key, most } of TAGS) {
	describe(`the ${key} tag of a callout row`, () => {
		it("is one short word in English", () => {
			const word = en[key];
			assert.ok(word, `${key} is in en.ts`);
			assert.doesNotMatch(word, /\s/);
			assert.ok([...word].length <= most, word);
		});

		for (const [fileId, table] of localeEntries()) {
			it(`is one short word in ${fileId}`, () => {
				const word = table[key];
				// A language that has no tag of its own falls back to English, which is fine.
				if (word === undefined) return;
				if (SPACED_WORDS.has(fileId)) {
					assert.ok(word.split(/\s+/).length <= 2, `${word} is the two syllables of one word`);
				} else {
					assert.doesNotMatch(word, /\s/, `${fileId}: "${word}" is more than one word`);
				}
				assert.ok([...word].length <= most, `${fileId}: "${word}" is too long for a tag`);
			});
		}
	});
}

describe("the emoji skin-tone picker's default entry", () => {
	it("has a key of its own, so the row's tag can change without it", () => {
		assert.strictEqual(en["iconPicker.skinToneDefault"], "Default");
		assert.ok(en["settings.fallbackTag"], "the row's tag is its own key too");
	});

	it("is not shortened with the row's tag: a language keeps its usual word for it", () => {
		// "Par défaut" is what a French user expects in a picker, and is what the
		// key kept; the row's tag is the shorter "Défaut".
		const french = localeEntries().find(([fileId]) => fileId === "fr")?.[1];
		assert.strictEqual(french?.["iconPicker.skinToneDefault"], "Par défaut");
		assert.strictEqual(french?.["settings.fallbackTag"], "Défaut");
	});
});
