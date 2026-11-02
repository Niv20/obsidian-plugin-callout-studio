/**
 * tests/sorting.test.ts — the order every callout list is shown in.
 *
 * One comparator feeds the registry's load-time sort, the settings list and the
 * autocomplete dropdown, so a change here reorders all three at once. Three
 * things are worth stating as tests:
 *
 * - **The two-collator design is not redundant.** The base pass folds case and
 *   accents so `Note` and `note` land together; without the variant tie-breaker
 *   they would compare *equal*, and `Array.sort` would then leave them in
 *   whatever order the map happened to hold — a list that reshuffles itself
 *   between launches.
 * - **The locale really is consulted.** `ä` sorts next to `a` in German and
 *   after `z` in Swedish; `i` and `I` are different letters in Turkish. A
 *   comparator that quietly fell back to `en` would pass a naive test and be
 *   wrong for half the 32 locales this plugin ships.
 * - **Nothing is sorted in place.** The registry hands its live array to these
 *   functions; sorting it would reorder the source of truth as a side effect.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	compareText,
	getSortedCalloutIds,
	sortCalloutsById,
	sortCalloutsByDisplayName,
	sortIds,
} from "../src/utils/sorting";
import type { CalloutDefinition } from "../src/types";

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "x",
		displayName: "X",
		icon: { type: "lucide", value: "star" },
		colorLight: "#ff0000",
		colorDark: "#ff0000",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

const sign = (n: number): number => (n === 0 ? 0 : n > 0 ? 1 : -1);

describe("compareText — the basics", () => {
	it("orders alphabetically", () => {
		assert.ok(compareText("apple", "banana") < 0);
		assert.ok(compareText("banana", "apple") > 0);
	});

	it("is zero only for identical strings", () => {
		assert.equal(compareText("note", "note"), 0);
	});

	it("compares numbers numerically, not as text", () => {
		// Without `numeric: true` the user's `Step 10` sorts before `Step 2`.
		assert.ok(compareText("Step 2", "Step 10") < 0);
		assert.ok(compareText("item2", "item10") < 0);
	});

	it("is antisymmetric across a spread of pairs", () => {
		const words = ["a", "A", "ä", "b", "note", "Note", "Step 2", "Step 10", ""];
		for (const x of words) {
			for (const y of words) {
				assert.equal(sign(compareText(x, y)), -sign(compareText(y, x)), `${x} vs ${y}`);
			}
		}
	});
});

describe("compareText — the tie-breaker is what keeps sorting stable", () => {
	it("does NOT call two case variants equal", () => {
		// The base collator folds them; the variant collator separates them. If
		// this ever returned 0, a list containing both would reshuffle itself
		// between launches.
		assert.notEqual(compareText("note", "Note"), 0);
		assert.notEqual(compareText("café", "cafe"), 0);
	});

	it("still groups case variants next to each other", () => {
		const sorted = sortIds(["zebra", "Note", "apple", "note"]);
		const noteIndexes = [sorted.indexOf("Note"), sorted.indexOf("note")].sort((a, b) => a - b);
		assert.equal(noteIndexes[1]! - noteIndexes[0]!, 1, `expected the two Notes adjacent, got ${sorted.join(", ")}`);
	});

	it("gives a deterministic order for a case-only difference", () => {
		const a = compareText("note", "Note");
		const b = compareText("note", "Note");
		assert.equal(a, b);
	});
});

describe("compareText — the locale is really consulted", () => {
	it("puts ä with a in German but after z in Swedish", () => {
		assert.ok(compareText("ä", "z", "de") < 0, "de: ä should precede z");
		assert.ok(compareText("ä", "z", "sv") > 0, "sv: ä should follow z");
	});

	it("treats dotted and dotless i as different letters in Turkish", () => {
		// In `en` these fold together at base sensitivity; in `tr` they must not.
		assert.equal(compareText("i", "I", "en"), compareText("i", "I", "en"));
		assert.notEqual(sign(compareText("i", "ı", "tr")), sign(compareText("i", "ı", "en")));
	});

	it("orders the Hebrew alphabet", () => {
		assert.ok(compareText("א", "ב", "he") < 0);
		assert.ok(compareText("ת", "א", "he") > 0);
		assert.deepStrictEqual(sortIds(["גימל", "אלף", "בית"], "he"), ["אלף", "בית", "גימל"]);
	});

	it("falls back through the language chain to the base tag", () => {
		// "de-AT" is not a collation of its own; the chain reaches "de".
		assert.equal(sign(compareText("ä", "z", "de-AT")), sign(compareText("ä", "z", "de")));
	});

	it("falls back to English for an unrecognized tag", () => {
		assert.equal(sign(compareText("ä", "z", "xx-YY")), sign(compareText("ä", "z")));
	});

	it("treats an absent or blank locale as English", () => {
		assert.equal(compareText("a", "b", undefined), compareText("a", "b", "en"));
		assert.equal(compareText("a", "b", ""), compareText("a", "b", "en"));
		assert.equal(compareText("a", "b", "   "), compareText("a", "b", "en"));
	});

	it("sorts in English rather than throwing on a malformed tag", () => {
		// `Intl` rejects a tag that is not structurally BCP-47 by throwing, and
		// it validates the whole list at once, so one bad tag used to take the
		// valid ones with it. That is not a misordered list — it is an exception
		// out of `Array.sort`, while the settings tab or the autocomplete
		// dropdown is mid-build. Today every caller passes `getLocale()`, which
		// can only return a registered code; this is what keeps that a
		// precondition rather than a trap for the next call site.
		assert.doesNotThrow(() => compareText("a", "b", "!!"));
		assert.equal(compareText("a", "b", "!!"), compareText("a", "b", "en"));
		assert.doesNotThrow(() => sortIds(["b", "a"], "e n"));
	});

	it("keeps the language when only the region is malformed", () => {
		// The chain is filtered tag by tag rather than abandoned whole, so
		// `de-!!` still sorts as German instead of dropping to English.
		assert.equal(sign(compareText("ä", "z", "de-!!")), sign(compareText("ä", "z", "de")));
		assert.notEqual(sign(compareText("ä", "z", "sv-!!")), sign(compareText("ä", "z", "de")));
	});
});

describe("sortCalloutsByDisplayName", () => {
	it("orders by the shown name, not the id", () => {
		const sorted = sortCalloutsByDisplayName([
			def({ id: "aaa", displayName: "Zebra" }),
			def({ id: "zzz", displayName: "Apple" }),
		]);
		assert.deepStrictEqual(
			sorted.map((d) => d.id),
			["zzz", "aaa"],
		);
	});

	it("breaks a name tie on the id", () => {
		const sorted = sortCalloutsByDisplayName([
			def({ id: "b", displayName: "Same" }),
			def({ id: "a", displayName: "Same" }),
		]);
		assert.deepStrictEqual(
			sorted.map((d) => d.id),
			["a", "b"],
		);
	});

	it("honours the locale", () => {
		const items = [def({ id: "1", displayName: "ä" }), def({ id: "2", displayName: "z" })];
		assert.deepStrictEqual(
			sortCalloutsByDisplayName(items, "de").map((d) => d.id),
			["1", "2"],
		);
		assert.deepStrictEqual(
			sortCalloutsByDisplayName(items, "sv").map((d) => d.id),
			["2", "1"],
		);
	});

	it("does not sort the caller's array in place", () => {
		const input = [def({ id: "b", displayName: "B" }), def({ id: "a", displayName: "A" })];
		const before = input.map((d) => d.id);
		sortCalloutsByDisplayName(input);
		assert.deepStrictEqual(
			input.map((d) => d.id),
			before,
		);
	});

	it("handles the empty and single-item cases", () => {
		assert.deepStrictEqual(sortCalloutsByDisplayName([]), []);
		assert.equal(sortCalloutsByDisplayName([def()]).length, 1);
	});
});

describe("sortCalloutsById", () => {
	it("orders by id, not by the shown name", () => {
		const sorted = sortCalloutsById([
			def({ id: "zzz", displayName: "Apple" }),
			def({ id: "aaa", displayName: "Zebra" }),
		]);
		assert.deepStrictEqual(
			sorted.map((d) => d.id),
			["aaa", "zzz"],
		);
	});

	it("breaks an id tie on the display name", () => {
		// Two rows can share an id only transiently (a rename in flight), but the
		// tie-breaker is what stops the pair from swapping places on every render.
		const sorted = sortCalloutsById([
			def({ id: "same", displayName: "Second" }),
			def({ id: "same", displayName: "First" }),
		]);
		assert.deepStrictEqual(
			sorted.map((d) => d.displayName),
			["First", "Second"],
		);
	});

	it("is the mirror image of sortCalloutsByDisplayName's tie rule", () => {
		const items = [def({ id: "b", displayName: "A" }), def({ id: "a", displayName: "B" })];
		assert.deepStrictEqual(
			sortCalloutsById(items).map((d) => d.id),
			["a", "b"],
		);
		assert.deepStrictEqual(
			sortCalloutsByDisplayName(items).map((d) => d.id),
			["b", "a"],
		);
	});

	it("does not sort the caller's array in place", () => {
		const input = [def({ id: "b" }), def({ id: "a" })];
		sortCalloutsById(input);
		assert.deepStrictEqual(
			input.map((d) => d.id),
			["b", "a"],
		);
	});
});

describe("getSortedCalloutIds", () => {
	it("returns just the id when there are no aliases", () => {
		assert.deepStrictEqual(getSortedCalloutIds(def({ id: "note" })), ["note"]);
	});

	it("sorts the id in among its aliases rather than pinning it first", () => {
		assert.deepStrictEqual(getSortedCalloutIds(def({ id: "note", aliases: ["alert", "zebra"] })), [
			"alert",
			"note",
			"zebra",
		]);
	});

	it("treats an empty alias array as none", () => {
		assert.deepStrictEqual(getSortedCalloutIds(def({ id: "note", aliases: [] })), ["note"]);
	});

	it("honours the locale", () => {
		const d = def({ id: "m", aliases: ["ä", "z"] });
		assert.deepStrictEqual(getSortedCalloutIds(d, "de"), ["ä", "m", "z"]);
		assert.deepStrictEqual(getSortedCalloutIds(d, "sv"), ["m", "z", "ä"]);
	});

	it("does not mutate the definition's own alias array", () => {
		const aliases = ["zebra", "alert"];
		const d = def({ id: "note", aliases });
		getSortedCalloutIds(d);
		assert.deepStrictEqual(aliases, ["zebra", "alert"]);
		assert.equal(d.aliases, aliases);
	});

	it("gives the same order for the same input every time", () => {
		const d = def({ id: "note", aliases: ["Note", "NOTE", "note2", "note10"] });
		const first = getSortedCalloutIds(d);
		for (let i = 0; i < 5; i++) {
			assert.deepStrictEqual(getSortedCalloutIds(d), first);
		}
	});
});

describe("sortIds", () => {
	it("sorts and leaves the input alone", () => {
		const input = ["c", "a", "b"];
		assert.deepStrictEqual(sortIds(input), ["a", "b", "c"]);
		assert.deepStrictEqual(input, ["c", "a", "b"]);
	});

	it("is idempotent", () => {
		const once = sortIds(["Note", "note", "alert", "Step 10", "Step 2"]);
		assert.deepStrictEqual(sortIds(once), once);
	});
});
