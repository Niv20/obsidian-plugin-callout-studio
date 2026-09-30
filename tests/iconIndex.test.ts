/**
 * tests/iconIndex.test.ts — the packed search indexes, and the codec that reads
 * them.
 *
 * Icon metadata is the largest thing in `main.js`, so it ships as a handful of
 * string constants rather than object literals: keywords pooled into a
 * front-coded dictionary and referenced by fixed-width base36 codes, one line of
 * codes per icon. That buys a lot of bytes and costs one property — the data is
 * no longer readable, so a decoder that is subtly wrong produces *plausible*
 * icons rather than a crash. `material.index.ts` is 617 KB of text nobody will
 * ever proofread; a keyword shifted by one dictionary slot would show up as an
 * icon that answers to the wrong search, and nothing else.
 *
 * Two halves, therefore:
 *
 * - the decoder against the real encoder (`scripts/lib/encodeIndex.mjs`), on
 *   the real bundled indexes. `generate-icon-packs.mjs` already asserts this
 *   round-trip when it writes them, which catches a bad *encode*; running it
 *   here catches a bad *decode* — a codec edit that breaks reading data already
 *   committed, which the generator would never notice because it re-encodes
 *   first.
 * - sanity on what those indexes decode to: the counts the pack manifest and
 *   the pack modules promise, no duplicate names, and every keyword and
 *   category reference resolving to a real dictionary entry rather than to the
 *   empty string `decodeIndex` substitutes for an out-of-range code.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { encodeFrontCoded, encodeIndex } from "../scripts/lib/encodeIndex.mjs";
import {
	decodeFrontCoded,
	decodeIndex,
	memoizeIndex,
	type EncodedIndex,
} from "../src/icons/data/codec";
import type { IconIndex } from "../src/icons/types";
import type { IconPackId } from "../src/types";
import { PACK_MANIFEST } from "../src/icons/data/packManifest";
import { OCTICONS_INDEX } from "../src/icons/data/octicons.index";
import { RPG_AWESOME_INDEX } from "../src/icons/data/rpg-awesome.index";
import { MATERIAL_INDEX } from "../src/icons/data/material.index";
import { FA_SOLID_INDEX } from "../src/icons/data/fa-solid.index";
import { FA_REGULAR_INDEX } from "../src/icons/data/fa-regular.index";
import { FA_BRANDS_INDEX } from "../src/icons/data/fa-brands.index";
import { TABLER_OUTLINE_INDEX } from "../src/icons/data/tabler-outline.index";
import { TABLER_FILLED_INDEX } from "../src/icons/data/tabler-filled.index";
import { SIMPLE_ICONS_INDEX } from "../src/icons/data/simple-icons.index";

/**
 * Every index this build carries, under the pack id whose artwork it describes.
 *
 * Material has no entry in `PACK_MANIFEST` — it is fetched per icon and has no
 * pack file — so its expected count is stated here instead.
 */
const INDEXES: ReadonlyArray<[IconPackId, EncodedIndex, number]> = [
	["octicons", OCTICONS_INDEX, 383],
	["rpg-awesome", RPG_AWESOME_INDEX, 495],
	["material", MATERIAL_INDEX, 3870],
	["fa-solid", FA_SOLID_INDEX, 1422],
	["fa-regular", FA_REGULAR_INDEX, 169],
	["fa-brands", FA_BRANDS_INDEX, 572],
	["tabler-outline", TABLER_OUTLINE_INDEX, 5130],
	["tabler-filled", TABLER_FILLED_INDEX, 1054],
	["simple-icons", SIMPLE_ICONS_INDEX, 3376],
];

/**
 * Every fixed-width base36 code in a `kr`/`cr` blob, as numbers.
 *
 * A local re-implementation of the decoder's private `unpackRefs`, on purpose:
 * the point of the checks below is that a *code* addresses a slot that exists,
 * and asking the decoder to prove that about its own output would only ever
 * confirm it agrees with itself.
 */
function allRefs(blob: string, width: number): number[] {
	const out: number[] = [];
	for (const line of blob.split("\n")) {
		for (let i = 0; i + width <= line.length; i += width) {
			out.push(parseInt(line.slice(i, i + width), 36));
		}
	}
	return out;
}

/* ------------------------------------------------------------------ *
 * decodeFrontCoded
 * ------------------------------------------------------------------ */

describe("decodeFrontCoded", () => {
	it("reads an empty dictionary as no entries, not as one empty string", () => {
		// "".split("\n") is [""], which would decode to a phantom keyword every
		// icon could accidentally reference.
		assert.deepStrictEqual(decodeFrontCoded(""), []);
	});

	it("rebuilds the shared prefix from the leading base36 digit", () => {
		// "0ab" = share nothing, take "ab"; "2c" = keep "ab", append "c".
		assert.deepStrictEqual(decodeFrontCoded("0ab\n2c"), ["ab", "abc"]);
	});

	it("shortens as well as lengthens", () => {
		assert.deepStrictEqual(decodeFrontCoded("0arrow\n1lert"), [
			"arrow",
			"alert",
		]);
	});

	it("reads a shared prefix longer than nine characters as base36", () => {
		// A decimal read would take "a" for 10 and get the wrong split — this is
		// the digit where base36 stops looking like base10.
		const long = "abcdefghij";
		assert.deepStrictEqual(decodeFrontCoded(`0${long}\na!`), [long, `${long}!`]);
	});

	it("keeps an entry identical to its predecessor", () => {
		assert.deepStrictEqual(decodeFrontCoded("0abc\n3"), ["abc", "abc"]);
	});

	it("round-trips whatever the encoder produced", () => {
		const cases = [
			[],
			[""],
			["a"],
			["a", "ab", "abc", "b"],
			["arrow", "arrow-down", "arrow-up", "asterisk"],
			// Past the 35-character cap the encoder can express: it encodes less
			// of the saving, never the wrong amount.
			["x".repeat(60), `${"x".repeat(60)}y`],
			["ünicode", "ünicode-ish"],
		];
		for (const sorted of cases) {
			assert.deepStrictEqual(
				decodeFrontCoded(encodeFrontCoded(sorted)),
				sorted,
				JSON.stringify(sorted),
			);
		}
	});
});

/* ------------------------------------------------------------------ *
 * decodeIndex
 * ------------------------------------------------------------------ */

describe("decodeIndex — the shape it produces", () => {
	const build = (entries: Parameters<typeof encodeIndex>[0]): IconIndex =>
		decodeIndex(encodeIndex(entries));

	it("reads an empty index as no entries", () => {
		const index = build([]);
		assert.deepStrictEqual(index.entries, []);
		assert.deepStrictEqual(index.categories, []);
	});

	it("keeps names positionally aligned with their keywords", () => {
		const index = build([
			{ name: "a", categories: [], keywords: ["one"] },
			// An icon with no keywords contributes an empty line, which is what
			// keeps every later icon's keywords on its own icon.
			{ name: "b", categories: [], keywords: [] },
			{ name: "c", categories: [], keywords: ["two", "three"] },
		]);
		assert.deepStrictEqual(
			index.entries.map((e) => [e.name, [...e.keywords]]),
			[
				["a", ["one"]],
				["b", []],
				["c", ["two", "three"]],
			],
		);
	});

	it("omits `label` entirely when no entry has one", () => {
		// Absent, not "" — the grid tooltip falls back on a prettified name, and
		// an empty string is not a falsy label it would catch. This is the state
		// eight of the nine bundled indexes are actually in; Simple Icons, whose
		// slugs spell punctuation out (`nodedotjs`), is the one with labels.
		const index = build([
			{ name: "a", categories: [], keywords: [] },
			{ name: "b", categories: [], keywords: [] },
		]);
		for (const e of index.entries) {
			assert.ok(!("label" in (e as object)), `${e.name} gained a label`);
		}
	});

	it("leaves an entry that declared no label without one, column or not", () => {
		// The column used to be all-or-nothing: one entry with a label gave every
		// entry a label, and an entry that had declared none was filled in with
		// its own raw name. That is not the same as having no label — the tooltip
		// falls back to a *prettified* name, so `b_c` would have shipped as
		// "b_c" where it should read "B c". Only the entries that actually said
		// something carry anything.
		const index = build([
			{ name: "a", label: "Alpha", categories: [], keywords: [] },
			{ name: "b_c", categories: [], keywords: [] },
		]);
		assert.equal(index.entries[0]?.label, "Alpha");
		assert.ok(
			!("label" in (index.entries[1] as object)),
			"an entry that declared no label was given its own name as one",
		);
	});

	it("does not spend the whole name list on a column two entries use", () => {
		// The byte half of the same bug: filling every row in meant the label
		// column was a second copy of every name in the library, and Material's
		// names alone are 60 KB.
		const encoded: EncodedIndex = encodeIndex([
			{ name: "a", label: "Alpha", categories: [], keywords: [] },
			{ name: "an-extremely-long-icon-name", categories: [], keywords: [] },
		]);
		assert.ok(
			!encoded.l?.includes("an-extremely-long-icon-name"),
			"a label-less entry paid for its own name in the label column",
		);
	});

	it("treats a label identical to its name as no label at all", () => {
		// Both spellings of "nothing to add" have to land in the same place, or
		// which one a generator happens to emit changes what ships.
		const index = build([
			{ name: "a", label: "Alpha", categories: [], keywords: [] },
			{ name: "b", label: "b", categories: [], keywords: [] },
		]);
		assert.equal(index.entries[0]?.label, "Alpha");
		assert.ok(!("label" in (index.entries[1] as object)));
	});

	it("leaves the label column out when every label just repeats its name", () => {
		const index = build([
			{ name: "a", label: "a", categories: [], keywords: [] },
			{ name: "b", label: "b", categories: [], keywords: [] },
		]);
		for (const e of index.entries) {
			assert.ok(!("label" in (e as object)), `${e.name} kept a redundant label`);
		}
	});

	it("carries categories per entry and as the index's own sorted list", () => {
		const index = build([
			{ name: "a", categories: ["Nav", "Alerts"], keywords: [] },
			{ name: "b", categories: [], keywords: [] },
		]);
		assert.deepStrictEqual([...index.entries[0]!.categories].sort(), [
			"Alerts",
			"Nav",
		]);
		assert.deepStrictEqual(index.entries[1]?.categories, []);
		assert.deepStrictEqual([...index.categories].sort(), ["Alerts", "Nav"]);
	});

	it("survives a dictionary big enough to need two base36 characters", () => {
		// 36 keywords is exactly where the reference width has to grow; a decoder
		// that kept reading one character would resolve every code past the 36th
		// to the wrong keyword and never fail loudly.
		const keywords = Array.from({ length: 40 }, (_, i) => `kw${i}`);
		const index = build(
			keywords.map((kw, i) => ({ name: `i${i}`, categories: [], keywords: [kw] })),
		);
		assert.deepStrictEqual(
			index.entries.map((e) => e.keywords[0]),
			keywords,
		);
	});

	it("round-trips every real bundled index, entry for entry", () => {
		// The generator asserts this when it *writes* an index, which catches a
		// bad encode. This catches a bad decode against data already committed.
		for (const [id, encoded] of INDEXES) {
			const decoded = decodeIndex(encoded);
			const again = decodeIndex(
				encodeIndex(
					decoded.entries.map((e) => ({
						name: e.name,
						...(e.label === undefined ? {} : { label: e.label }),
						categories: [...e.categories],
						keywords: [...e.keywords],
					})),
				),
			);
			assert.deepStrictEqual(again.entries, decoded.entries, id);
		}
	});
});

describe("memoizeIndex", () => {
	it("builds once and hands back the very same object thereafter", () => {
		let builds = 0;
		const load = memoizeIndex(() => {
			builds++;
			return { entries: [], categories: [] };
		});
		return Promise.all([load(), load(), load()]).then(([a, b, c]) => {
			assert.equal(builds, 1, "the index must be decoded exactly once");
			assert.strictEqual(a, b);
			assert.strictEqual(b, c);
		});
	});

	it("does not decode anything until it is first called", () => {
		let builds = 0;
		memoizeIndex(() => {
			builds++;
			return { entries: [], categories: [] };
		});
		assert.equal(builds, 0, "constructing the loader must be free");
	});
});

/* ------------------------------------------------------------------ *
 * The real indexes
 * ------------------------------------------------------------------ */

describe("the bundled indexes decode to the libraries they claim", () => {
	for (const [id, encoded, expected] of INDEXES) {
		const index = decodeIndex(encoded);

		it(`${id} holds exactly ${expected} icons`, () => {
			assert.equal(index.entries.length, expected);
		});

		it(`${id} agrees with the pack manifest`, () => {
			// Material has no pack file, so nothing to agree with; every other
			// index describes a file whose icon count is compiled into the build.
			const manifest = PACK_MANIFEST[id];
			if (!manifest) return;
			assert.equal(manifest.iconCount, index.entries.length);
		});

		it(`${id} names every icon once`, () => {
			const names = index.entries.map((e) => e.name);
			assert.equal(new Set(names).size, names.length);
		});

		it(`${id} names every icon at all`, () => {
			for (const e of index.entries) {
				assert.ok(e.name.length > 0, "an empty name is unrenderable");
				assert.ok(
					!e.name.includes("\n"),
					`a newline in "${e.name}" would corrupt the line framing`,
				);
			}
		});

		it(`${id} spends no dictionary slot on a keyword that says nothing`, () => {
			// Upstream ships debris: Octicons tags `eye-closed` with an empty
			// string. A blank keyword buys a dictionary slot and a reference on
			// every entry carrying it, and matches nothing in return — the
			// search drops empty words out of a query before it ever looks. The
			// generator cleans them, and this is what says it still does.
			for (const keyword of decodeFrontCoded(encoded.k)) {
				assert.ok(
					keyword.length > 0,
					"the keyword dictionary has a blank slot",
				);
			}
		});

		it(`${id} lists each of an icon's keywords once`, () => {
			// Upstream repeats itself: Font Awesome tags `copy` with `replicate`
			// three times and `feather` with `plume` four. Every repeat is
			// another reference in the index and another string the search walks
			// per keystroke, and it cannot match anything the first one did not.
			for (const e of index.entries) {
				assert.equal(
					new Set(e.keywords).size,
					e.keywords.length,
					`"${e.name}" carries the same keyword twice`,
				);
			}
		});

		it(`${id} points every keyword code at a slot the dictionary has`, () => {
			// The check has to be on the *codes*, not on the strings they decode
			// to: an out-of-range code yields "" rather than throwing, so a width
			// or dictionary bug would decode as a keyword that is merely empty
			// and never fail loudly.
			const dictSize = decodeFrontCoded(encoded.k).length;
			for (const ref of allRefs(encoded.kr, encoded.kw)) {
				assert.ok(
					ref < dictSize,
					`a keyword code addresses slot ${ref} of a ${dictSize}-entry dictionary`,
				);
			}
		});

		it(`${id} points every category code at a slot the list has`, () => {
			if (!encoded.c || !encoded.cw || !encoded.cr) return;
			const listSize = encoded.c.split("\n").length;
			for (const ref of allRefs(encoded.cr, encoded.cw)) {
				assert.ok(
					ref < listSize,
					`a category code addresses slot ${ref} of a ${listSize}-entry list`,
				);
			}
		});

		it(`${id} gives every icon its own line of keyword codes`, () => {
			// One line per icon, empty line included — the framing that keeps a
			// keyword on the icon it belongs to. A short `kr` would silently
			// shift every icon after the gap.
			const lines = encoded.kr.length === 0 ? [] : encoded.kr.split("\n");
			assert.equal(lines.length, index.entries.length);
			for (const line of lines) {
				assert.equal(
					line.length % encoded.kw,
					0,
					"a partial code would decode to NaN",
				);
			}
		});

		it(`${id} resolves every category to one it declares`, () => {
			const known = new Set(index.categories);
			for (const e of index.entries) {
				for (const category of e.categories) {
					assert.ok(
						known.has(category),
						`"${e.name}" is in "${category}", which the index does not list`,
					);
				}
			}
		});

		it(`${id} lists its categories once each, sorted`, () => {
			assert.equal(
				new Set(index.categories).size,
				index.categories.length,
				"a repeated category would show twice in the picker's dropdown",
			);
			assert.deepStrictEqual(
				[...index.categories],
				[...index.categories].sort(),
			);
		});

		it(`${id} leaves no category orphaned`, () => {
			// The reverse of the check above: a category nothing is in would be a
			// dropdown option that filters the grid down to nothing.
			const used = new Set(index.entries.flatMap((e) => [...e.categories]));
			for (const category of index.categories) {
				assert.ok(used.has(category), `nothing is in "${category}"`);
			}
		});
	}
});
