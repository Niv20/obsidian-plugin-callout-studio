/**
 * tests/iconSearch.test.ts — `filterIcons`, the one matcher every source shares.
 *
 * The property worth pinning is not "it finds things" but *what counts as one
 * word*. Nine libraries spell the same idea three ways — `arrow_right`,
 * `arrow-right`, `arrowright` — and a picker that made the user learn which is
 * which would be a picker nobody could search. So a name is matched twice:
 * verbatim, and with its separators turned into spaces. Everything else here
 * follows from two more decisions: words are ANDed (typing narrows, never
 * scatters), and a query that filters nothing returns the index's own array
 * *by identity*, so opening a source costs one comparison rather than a copy of
 * five thousand entries.
 *
 * The other half is the order, which matters as much as the membership. `home`
 * has to come back ahead of `home-storage` and `smart-home`, so a match is
 * ranked by how the *name* answered: it is the query, it starts with it, it
 * contains it, or it only matched a label or keyword. The one thing ranking is
 * not allowed to do is reorder across sources — the pooled "All sources" grid
 * finds its headings by watching `entry.pack` change from one entry to the
 * next, so each source's run stays whole and is ordered inside itself.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { filterIcons } from "../src/icons/search";
import type { IconEntry, IconIndex } from "../src/icons/types";
import { decodeIndex } from "../src/icons/data/codec";
import { OCTICONS_INDEX } from "../src/icons/data/octicons.index";

function entry(over: Partial<IconEntry> & { name: string }): IconEntry {
	return { categories: [], keywords: [], ...over };
}

const INDEX: IconIndex = {
	entries: [
		entry({ name: "arrow_right", categories: ["nav"], keywords: ["forward"] }),
		entry({ name: "arrow-left", categories: ["nav"], keywords: ["back"] }),
		entry({ name: "home", categories: ["places"], keywords: ["house", "roof"] }),
		entry({ name: "home_work", categories: ["places"], keywords: ["office"] }),
		entry({ name: "SmileFace", label: "Smile face", categories: [], keywords: [] }),
	],
	categories: ["nav", "places"],
};

const names = (result: readonly IconEntry[]): string[] =>
	result.map((e) => e.name);

describe("filterIcons — the no-op query", () => {
	it("hands back the index's own array, not a copy", () => {
		// Identity, deliberately: opening a source with 5,130 icons must not
		// allocate a second array of them before a single character is typed.
		assert.strictEqual(filterIcons(INDEX, ""), INDEX.entries);
	});

	it("treats a whitespace-only query as no query at all", () => {
		assert.strictEqual(filterIcons(INDEX, "   "), INDEX.entries);
		assert.strictEqual(filterIcons(INDEX, "\t\n "), INDEX.entries);
	});

	it("stops taking the shortcut as soon as a category is named", () => {
		const result = filterIcons(INDEX, "", "nav");
		assert.notStrictEqual(result, INDEX.entries);
		assert.deepStrictEqual(names(result), ["arrow_right", "arrow-left"]);
	});
});

describe("filterIcons — one word", () => {
	it("matches the name verbatim", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "arrow")), [
			"arrow_right",
			"arrow-left",
		]);
	});

	it("matches anywhere in the name, not only at the front", () => {
		// A substring match, so "right" finds `arrow_right`. Prefix search is
		// the special case of this, not a separate rule.
		assert.deepStrictEqual(names(filterIcons(INDEX, "right")), ["arrow_right"]);
	});

	it("ignores case on both sides", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "SMILE")), ["SmileFace"]);
		assert.deepStrictEqual(names(filterIcons(INDEX, "smileface")), ["SmileFace"]);
	});

	it("searches the label", () => {
		// "Smile face" is spelled with a space only in the label; the name has
		// none, so this can only come from the label field.
		assert.deepStrictEqual(names(filterIcons(INDEX, "face")), ["SmileFace"]);
	});

	it("searches the keywords", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "house")), ["home"]);
		assert.deepStrictEqual(names(filterIcons(INDEX, "office")), ["home_work"]);
	});

	it("finds nothing for a word no field carries", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "zzzz")), []);
	});
});

describe("filterIcons — separators are spaces", () => {
	it("matches an underscore name typed with a space", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "arrow right")), [
			"arrow_right",
		]);
	});

	it("matches a hyphen name typed with a space", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "arrow left")), [
			"arrow-left",
		]);
	});

	it("still matches the separator spelled out", () => {
		// Both spellings are in the haystack, so neither library's own idiom is
		// the one you have to know.
		assert.deepStrictEqual(names(filterIcons(INDEX, "arrow_right")), [
			"arrow_right",
		]);
		assert.deepStrictEqual(names(filterIcons(INDEX, "arrow-left")), [
			"arrow-left",
		]);
	});
});

describe("filterIcons — several words are ANDed", () => {
	it("narrows as more words are typed", () => {
		assert.equal(filterIcons(INDEX, "home").length, 2);
		assert.deepStrictEqual(names(filterIcons(INDEX, "home work")), ["home_work"]);
	});

	it("lets the words come from different fields", () => {
		// "home" is in the name, "roof" only in the keywords. Each word has to
		// match *some* field, not all of them the same one.
		assert.deepStrictEqual(names(filterIcons(INDEX, "home roof")), ["home"]);
	});

	it("takes the words in any order", () => {
		assert.deepStrictEqual(
			names(filterIcons(INDEX, "roof home")),
			names(filterIcons(INDEX, "home roof")),
		);
	});

	it("drops the entry as soon as one word misses", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "home zzzz")), []);
	});

	it("collapses runs of whitespace rather than searching for an empty word", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "  home   work  ")), [
			"home_work",
		]);
	});
});

describe("filterIcons — the category filter", () => {
	it("keeps only entries carrying that category", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "", "places")), [
			"home",
			"home_work",
		]);
	});

	it("ANDs with the query", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "home", "places")), [
			"home",
			"home_work",
		]);
		assert.deepStrictEqual(names(filterIcons(INDEX, "home", "nav")), []);
	});

	it("is exact — a category is a member test, not a substring one", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "", "plac")), []);
	});

	it("finds nothing for a category no entry declares", () => {
		assert.deepStrictEqual(names(filterIcons(INDEX, "", "nope")), []);
	});
});

describe("filterIcons — order and ranking", () => {
	/** The four tiers, deliberately in the *worst* order the index could hold. */
	const TIERS: IconIndex = {
		entries: [
			// Matches only through a keyword — related, but not named.
			entry({ name: "roofing", keywords: ["home"] }),
			// The name contains the query, but not at the front.
			entry({ name: "smart-home" }),
			// The name starts with the query.
			entry({ name: "home-storage" }),
			// The name *is* the query.
			entry({ name: "home" }),
		],
		categories: [],
	};

	it("floats an exact name match to the front", () => {
		// The whole point of ranking: `home` is buried last in the index and has
		// to come back first anyway.
		assert.equal(names(filterIcons(TIERS, "home"))[0], "home");
	});

	it("orders exact, then prefix, then substring, then keyword-only", () => {
		assert.deepStrictEqual(names(filterIcons(TIERS, "home")), [
			"home",
			"home-storage",
			"smart-home",
			"roofing",
		]);
	});

	it("ranks a multi-word query as the phrase it spells", () => {
		// "arrow right" is the whole of `arrow_right` once separators are
		// spaces, so it outranks a name that merely contains both words.
		const index: IconIndex = {
			entries: [
				entry({ name: "arrow_right_alt" }),
				entry({ name: "arrow_right" }),
			],
			categories: [],
		};
		assert.deepStrictEqual(names(filterIcons(index, "arrow right")), [
			"arrow_right",
			"arrow_right_alt",
		]);
	});

	it("keeps equally good matches in the index's own order", () => {
		// Ranking reorders only what it has a reason to; two prefix matches are
		// left exactly as the library listed them.
		assert.deepStrictEqual(names(filterIcons(INDEX, "arrow")), [
			"arrow_right",
			"arrow-left",
		]);
	});

	it("ranks a name above an entry that only matched its label", () => {
		const index: IconIndex = {
			entries: [
				entry({ name: "zzz", label: "Home" }),
				entry({ name: "home" }),
			],
			categories: [],
		};
		assert.deepStrictEqual(names(filterIcons(index, "home")), ["home", "zzz"]);
	});

	it("leaves a category-only query in the index's own order", () => {
		// Nothing was typed, so there is nothing to be more or less relevant to.
		assert.deepStrictEqual(names(filterIcons(INDEX, "", "places")), [
			"home",
			"home_work",
		]);
	});

	it("ranks inside each source, never across them", () => {
		// The pooled "All sources" grid heads each run of one library's entries
		// with that library's name, and finds the boundary by watching `pack`
		// change from one entry to the next. A global sort would interleave the
		// two libraries here and shatter two headings into four.
		const pooled: IconIndex = {
			entries: [
				entry({ name: "home-storage", pack: "octicons" }),
				entry({ name: "home", pack: "octicons" }),
				entry({ name: "smart-home", pack: "tabler" }),
				entry({ name: "home", pack: "tabler" }),
			],
			categories: [],
		};
		const result = filterIcons(pooled, "home");
		assert.deepStrictEqual(
			result.map((e) => [e.pack, e.name]),
			[
				// Ranked within Octicons…
				["octicons", "home"],
				["octicons", "home-storage"],
				// …and within Tabler, with the boundary still a single step.
				["tabler", "home"],
				["tabler", "smart-home"],
			],
		);
	});

	it("keeps every source's run contiguous in the pooled list", () => {
		const pooled: IconIndex = {
			entries: [
				entry({ name: "home-a", pack: "octicons" }),
				entry({ name: "home", pack: "octicons" }),
				entry({ name: "home-b", pack: "octicons" }),
				entry({ name: "home-c", pack: "material" }),
				entry({ name: "home", pack: "material" }),
			],
			categories: [],
		};
		const order = filterIcons(pooled, "home").map((e) => e.pack);
		assert.equal(
			new Set(order).size,
			// One run per source, so the number of boundaries equals the number
			// of sources — any interleaving makes this larger.
			order.filter((p, i) => p !== order[i - 1]).length,
		);
	});
});

describe("filterIcons — against a real bundled index", () => {
	const octicons = decodeIndex(OCTICONS_INDEX);

	it("narrows a real library down as words are added", () => {
		const one = filterIcons(octicons, "arrow");
		const two = filterIcons(octicons, "arrow up");
		assert.ok(one.length > two.length, "the second word must narrow");
		assert.ok(two.length > 0, "arrow up must find something");
		for (const e of two) assert.ok(one.includes(e), "AND must be a subset");
	});

	it("finds a hyphenated Octicons name typed with a space", () => {
		assert.ok(
			names(filterIcons(octicons, "arrow up")).includes("arrow-up"),
			"arrow-up must answer to `arrow up`",
		);
	});

	it("puts the icon actually named `alert` first among the alerts", () => {
		// Alphabetically `alert` sits above `alert-fill`, but the tie is not
		// what is being relied on: `bell` matches through a keyword and has to
		// end up behind both however the library happens to be ordered.
		const result = names(filterIcons(octicons, "alert"));
		assert.equal(result[0], "alert");
		assert.ok(result.length > 1, "alert must not be the only match");
	});

	it("never invents an entry the index does not hold", () => {
		for (const e of filterIcons(octicons, "git")) {
			assert.ok(octicons.entries.includes(e));
		}
	});
});
