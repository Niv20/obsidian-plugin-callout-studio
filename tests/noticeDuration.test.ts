/**
 * How long a notice stays up is worked out from its words (ui/noticeDuration.ts),
 * once, when the notice is made: short ones keep Obsidian's four seconds, long
 * ones grow with the sentence up to ten, a notice with a button stays ten, and
 * a caller's own number still wins.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Notice } from "obsidian";
import { en } from "../src/i18n/en";
import { showNotice } from "../src/ui/mascot/mascotNotices";
import { showActionNotice } from "../src/ui/noticeAction";
import { ACTION_NOTICE_MS, MAX_NOTICE_MS, MIN_NOTICE_MS, noticeDuration, wordCount } from "../src/ui/noticeDuration";
import { installFakeDom } from "./support/fakeDom";

// The button of an action notice is drawn into the notice's element.
installFakeDom();

const lastDuration = (): number | undefined =>
	(Notice as unknown as { last: { duration: number | undefined } }).last.duration;
const words = (count: number): string => Array.from({ length: count }, () => "word").join(" ");

describe("the duration worked out from a sentence", () => {
	it("keeps Obsidian's four seconds for a short sentence", () => {
		assert.equal(noticeDuration("Done."), MIN_NOTICE_MS);
		assert.equal(noticeDuration(words(8)), MIN_NOTICE_MS);
		assert.equal(noticeDuration(""), MIN_NOTICE_MS);
	});
	it("grows by about a third of a second a word after that", () => {
		assert.equal(noticeDuration(words(14)), 5700);
		assert.equal(noticeDuration(words(20)), 7500);
		assert.ok(noticeDuration(words(21)) > noticeDuration(words(20)));
	});
	it("stops at ten seconds however long the sentence", () => {
		assert.equal(noticeDuration(words(40)), MAX_NOTICE_MS);
		assert.equal(noticeDuration(words(400)), MAX_NOTICE_MS);
	});
	it("counts words across spaces and line breaks", () => {
		assert.equal(wordCount("  one   two\nthree\t four  "), 4);
		assert.equal(wordCount(""), 0);
		assert.equal(wordCount("   "), 0);
	});
	it("counts a language without spaces by its characters, not as one word", () => {
		const japanese = "ノートを更新できませんでした。保存の状態を確認してもう一度お試しください。";
		assert.ok(wordCount(japanese) > 8, `counted ${wordCount(japanese)} words`);
		assert.ok(noticeDuration(japanese) > MIN_NOTICE_MS);
	});
	it("gives every language about the same time as English for the same notices", () => {
		const keys = Object.keys(en).filter((key) =>
			/^(notice|vault|import\.err|saveStatus|portable\.(error|blocked|custom))/.test(key),
		);
		const average = (table: Record<string, string>): number =>
			keys.reduce((total, key) => total + noticeDuration(table[key] ?? en[key]!), 0) / keys.length;
		const english = average(en);
		const folder = join(process.cwd(), "locales");
		const files = readdirSync(folder).filter((name) => name.endsWith(".json"));
		assert.ok(files.length >= 30, "the language files were not found");
		for (const file of files) {
			const { strings } = JSON.parse(readFileSync(join(folder, file), "utf8")) as {
				strings: Record<string, string>;
			};
			const ratio = average(strings) / english;
			assert.ok(ratio > 0.75 && ratio < 1.3, `${file}: ${ratio.toFixed(2)} times English`);
		}
	});
});

describe("a notice's duration", () => {
	it("follows its sentence when the caller names none", () => {
		const long = words(20);
		showNotice("info", long);
		assert.equal(lastDuration(), noticeDuration(long));
		showNotice("info", "Done.");
		assert.equal(lastDuration(), MIN_NOTICE_MS);
	});
	it("is the caller's own number when one is given, 0 included", () => {
		showNotice("info", words(20), 2500);
		assert.equal(lastDuration(), 2500);
		showNotice("info", words(20), 0);
		assert.equal(lastDuration(), 0);
	});
	it("is ten seconds for a notice with a button, however short the sentence", () => {
		showActionNotice("success", "Deleted.", { label: "Undo", run: () => {} });
		assert.equal(lastDuration(), ACTION_NOTICE_MS);
		showActionNotice("paused", "Paused.", { label: "Open", run: () => {} }, 0);
		assert.equal(lastDuration(), 0);
	});
});
