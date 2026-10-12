/**
 * tests/calloutMetadata.test.ts — reading `[!type|metadata]` for colours.
 *
 * The rules pinned here are the ones the user can see:
 *
 * - spaces and pipes are interchangeable separators, so a note written for
 *   ITS Theme (`pink wide`) and one written for the Callout Metadata plugin
 *   (`pink|wide`) mean the same thing here;
 * - only the built-in colour ids, four aliases, and the user's palettes (by
 *   kebab-cased name) are colours — every other word is left alone;
 * - two colours resolve by a FIXED order (palette > Obsidian > extra preset),
 *   never by which was written last, because that is all the stylesheet can do
 *   and print must agree with the screen.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	definitionWithMetadataColor,
	entryWords,
	foldMetadataCase,
	isMetadataSeparator,
	METADATA_COLOR_ALIASES,
	metadataColorEntries,
	metadataWords,
	paletteMetadataKey,
	resolveMetadataColor,
} from "../src/utils/calloutMetadata";
import type { CalloutDefinition, CustomPalette } from "../src/types";

const palette = (name: string, over: Partial<CustomPalette> = {}): CustomPalette => ({
	id: `cp-${name}`,
	name,
	colorLight: "#aa0000",
	colorDark: "#ff5555",
	bgColorLight: "#ffeeee",
	bgColorDark: "#331111",
	textColorLight: "#111111",
	textColorDark: "#eeeeee",
	...over,
});

const words = (s: string): string[] => metadataWords(s).map((w) => w.text);

describe("metadataWords — either separator, any mix", () => {
	it("spaces and pipes split the same way", () => {
		assert.deepStrictEqual(words("pink right"), ["pink", "right"]);
		assert.deepStrictEqual(words("pink|right"), ["pink", "right"]);
		assert.deepStrictEqual(words(" pink | right "), ["pink", "right"]);
		assert.deepStrictEqual(words("a|b c\td"), ["a", "b", "c", "d"]);
	});

	it("empty runs are not words", () => {
		assert.deepStrictEqual(words(""), []);
		assert.deepStrictEqual(words("||"), []);
		assert.deepStrictEqual(words("|pink|"), ["pink"]);
	});

	it("a comma is part of a word, not a separator", () => {
		assert.deepStrictEqual(words("pink,blue"), ["pink,blue"]);
	});

	it("reports each word's span inside the metadata", () => {
		assert.deepStrictEqual(metadataWords("ab |cd"), [
			{ text: "ab", from: 0, to: 2 },
			{ text: "cd", from: 4, to: 6 },
		]);
	});

	it("isMetadataSeparator knows exactly the two kinds", () => {
		assert.ok(isMetadataSeparator(" "));
		assert.ok(isMetadataSeparator("|"));
		assert.ok(isMetadataSeparator("\t"));
		assert.ok(!isMetadataSeparator(","));
		assert.ok(!isMetadataSeparator("-"));
	});

	it("case folds ASCII only, like the stylesheet's `i` flag", () => {
		assert.strictEqual(foldMetadataCase("PiNK"), "pink");
		// Non-ASCII stays as typed: CSS would not match it either.
		assert.strictEqual(foldMetadataCase("ÄBC"), "Äbc");
	});
});

describe("paletteMetadataKey — the word that names a saved palette", () => {
	it("kebab-cases an ordinary name", () => {
		assert.strictEqual(paletteMetadataKey("Comic Red"), "comic-red");
		assert.strictEqual(paletteMetadataKey("  Blue  2 "), "blue-2");
		assert.strictEqual(paletteMetadataKey("snake_case|pipe"), "snake-case-pipe");
	});

	it("drops punctuation and collapses the dashes it leaves", () => {
		assert.strictEqual(paletteMetadataKey("Red!"), "red");
		assert.strictEqual(paletteMetadataKey("a - b"), "a-b");
		assert.strictEqual(paletteMetadataKey("--x--"), "x");
	});

	it("keeps letters of every script", () => {
		assert.strictEqual(paletteMetadataKey("ורוד בהיר"), "ורוד-בהיר");
		assert.strictEqual(paletteMetadataKey("Ｃａｆé"), "café");
	});

	it("is empty when nothing usable is left", () => {
		assert.strictEqual(paletteMetadataKey("🔥🔥"), "");
		assert.strictEqual(paletteMetadataKey("   "), "");
	});
});

describe("metadataColorEntries — which words are colours, weakest first", () => {
	it("extra presets, then Obsidian colours, then the user's palettes", () => {
		const keys = metadataColorEntries([palette("Comic Red")]).map((e) => e.key);
		assert.ok(keys.indexOf("pink") < keys.indexOf("blue"));
		assert.ok(keys.indexOf("blue") < keys.indexOf("comic-red"));
		assert.strictEqual(keys[keys.length - 1], "comic-red");
	});

	it("folds each alias onto its preset", () => {
		const entries = metadataColorEntries([]);
		for (const [alias, target] of Object.entries(METADATA_COLOR_ALIASES)) {
			const entry = entries.find((e) => e.key === target);
			assert.ok(entry, target);
			assert.ok(entry.aliases.includes(alias), `${target} answers to ${alias}`);
		}
	});

	it("names every one of Obsidian's colours by its own word, not an alias", () => {
		// Obsidian's eight `--color-*` names plus the quote's gray. Each is a
		// preset id in its own right; none may hide behind another word.
		const keys = new Set(metadataColorEntries([]).map((e) => e.key));
		for (const word of ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "gray"]) {
			assert.ok(keys.has(word), word);
		}
	});

	it("the only alias left is a spelling variant", () => {
		assert.deepStrictEqual({ ...METADATA_COLOR_ALIASES }, { grey: "gray" });
	});

	it("a preset's former id is not a colour word", () => {
		// `violet` and `bubblegum` live on as legacyIds for saved callouts, but
		// were never released as metadata — and the dropdown would print them
		// beside the real word.
		const entries = metadataColorEntries([]);
		for (const old of ["violet", "bubblegum"]) {
			assert.strictEqual(resolveMetadataColor(old, entries), null, old);
		}
	});

	it("a palette saved under a preset's word keeps it, and the preset drops out", () => {
		// A palette named "Pink" before the preset took that name.
		const entries = metadataColorEntries([palette("Pink")]);
		const pinks = entries.filter((e) => entryWords(e).includes("pink"));
		assert.strictEqual(pinks.length, 1);
		assert.strictEqual(pinks[0]?.palette.group, "custom");
		assert.ok(!entries.some((e) => e.palette.group === "preset" && e.palette.id === "pink"));
	});

	it("a palette named like a preset id replaces that preset", () => {
		const entries = metadataColorEntries([palette("Blue")]);
		const blues = entries.filter((e) => e.key === "blue");
		assert.strictEqual(blues.length, 1);
		assert.strictEqual(blues[0]?.palette.group, "custom");
	});

	it("between two palettes with one word, the later one wins", () => {
		const entries = metadataColorEntries([
			palette("Blue 2", { id: "cp-first" }),
			palette("blue-2", { id: "cp-second" }),
		]);
		const hits = entries.filter((e) => e.key === "blue-2");
		assert.strictEqual(hits.length, 1);
		assert.strictEqual(hits[0]?.palette.id, "cp-second");
	});

	it("a palette with no usable name has no word", () => {
		const entries = metadataColorEntries([palette("🔥")]);
		assert.ok(!entries.some((e) => e.palette.id === "cp-🔥"));
	});
});

describe("resolveMetadataColor — one colour, by a fixed order", () => {
	const entries = metadataColorEntries([palette("Comic Red")]);

	it("finds a colour in either separator and any case", () => {
		for (const raw of ["pink", "wide pink", "wide|pink", "PINK", " Pink |x"]) {
			assert.strictEqual(resolveMetadataColor(raw, entries)?.key, "pink", raw);
		}
	});

	it("ignores words that are not colours", () => {
		assert.strictEqual(resolveMetadataColor("wide c-red 50", entries), null);
		assert.strictEqual(resolveMetadataColor("pinky", entries), null);
		assert.strictEqual(resolveMetadataColor("", entries), null);
		assert.strictEqual(resolveMetadataColor(undefined, entries), null);
	});

	it("two colours: the stronger group wins, not the later word", () => {
		// Obsidian's blue beats the extra preset coral, in both orders.
		assert.strictEqual(resolveMetadataColor("coral blue", entries)?.key, "blue");
		assert.strictEqual(resolveMetadataColor("blue coral", entries)?.key, "blue");
		// A saved palette beats every built-in.
		assert.strictEqual(resolveMetadataColor("comic-red blue", entries)?.key, "comic-red");
	});
});

describe("definitionWithMetadataColor — what the PDF export bakes", () => {
	const def: CalloutDefinition = {
		id: "mark",
		displayName: "Mark",
		icon: { type: "lucide", value: "flag" },
		colorLight: "#ff0000",
		colorDark: "#ff0000",
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "user",
	};
	const entries = metadataColorEntries([]);

	it("bakes the named colour over the definition's own", () => {
		const out = definitionWithMetadataColor(def, "purple", entries);
		assert.strictEqual(out.colorLight, "#7852ee");
		assert.strictEqual(out.colorDark, "#a882ff");
		assert.strictEqual(out.id, "mark");
		assert.deepStrictEqual(out.icon, def.icon);
	});

	it("is the definition itself when nothing is named", () => {
		assert.strictEqual(definitionWithMetadataColor(def, "wide", entries), def);
		assert.strictEqual(definitionWithMetadataColor(def, null, entries), def);
	});
});
