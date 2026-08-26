/**
 * tests/retiredThemeIds.test.ts — the list that stops a theme's callouts coming
 * back from the notes.
 *
 * When the active theme stops supplying `[!recite]`, the row goes. The notes do
 * not: they still say `> [!recite]`, and `CalloutDiscovery` reads exactly that
 * and auto-creates rows for ids nothing defines. Without this list the row the
 * theme switch just removed returns one file-open later as an uncustomized
 * fallback row — a callout the user never made, styled by nobody, filed under
 * the callouts they did make.
 *
 * The list is the smallest thing that can hold that line, so what matters is
 * that it stays small and self-correcting: pruned on every sweep, capped, and
 * gating *automatic* discovery only.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	RETIRED_THEME_ID_CAP,
	isRetiredThemeId,
	pruneRetiredThemeIds,
	recordRetiredThemeIds,
	sanitizeRetiredThemeIds,
} from "../src/manager/theme/retiredThemeIds";

describe("sanitizeRetiredThemeIds — reading a stored list back", () => {
	it("takes a plain list of ids", () => {
		assert.deepStrictEqual(
			sanitizeRetiredThemeIds(["recite", "infobox"]),
			["recite", "infobox"],
		);
	});

	it("survives anything the file could say", () => {
		// It reaches this through `mergeSavedSettings`, which is handed whatever
		// data.json holds — including a hand-edited one.
		assert.deepStrictEqual(sanitizeRetiredThemeIds(undefined), []);
		assert.deepStrictEqual(sanitizeRetiredThemeIds("recite"), []);
		assert.deepStrictEqual(sanitizeRetiredThemeIds({ a: 1 }), []);
		assert.deepStrictEqual(sanitizeRetiredThemeIds([1, null, "ok"]), ["ok"]);
	});

	it("normalizes, so a stored spelling still matches what discovery asks", () => {
		assert.deepStrictEqual(sanitizeRetiredThemeIds([" Recite "]), ["recite"]);
	});

	it("drops duplicates and anything that normalizes to nothing", () => {
		assert.deepStrictEqual(
			sanitizeRetiredThemeIds(["recite", "RECITE", "", "   "]),
			["recite"],
		);
	});
});

describe("recordRetiredThemeIds — adding to it", () => {
	it("appends and dedupes", () => {
		assert.deepStrictEqual(recordRetiredThemeIds(["a"], ["b", "b"]), ["a", "b"]);
	});

	it("moves a re-retired id to the back rather than duplicating it", () => {
		// The cap evicts oldest-first, so "oldest" has to mean "longest since it
		// last mattered", not "first ever seen".
		assert.deepStrictEqual(recordRetiredThemeIds(["a", "b"], ["a"]), ["b", "a"]);
	});

	it("returns a copy when there is nothing to add", () => {
		const before = ["a"];
		const after = recordRetiredThemeIds(before, []);
		assert.deepStrictEqual(after, before);
		assert.notStrictEqual(after, before, "the sweep compares by value");
	});

	it("caps the list, keeping the most recent", () => {
		const many = Array.from({ length: RETIRED_THEME_ID_CAP + 10 }, (_, i) =>
			String(i),
		);
		const out = recordRetiredThemeIds([], many);
		assert.strictEqual(out.length, RETIRED_THEME_ID_CAP);
		assert.strictEqual(out.at(-1), String(RETIRED_THEME_ID_CAP + 9));
		assert.strictEqual(out[0], "10");
	});
});

describe("pruneRetiredThemeIds — how it stays small", () => {
	const never = (): boolean => false;

	it("drops an id something defines again", () => {
		// The user created it themselves, which is the escape hatch the whole
		// design leaves open. It is not retired any more.
		assert.deepStrictEqual(
			pruneRetiredThemeIds(["recite", "aside"], (id) => id === "recite", never),
			["aside"],
		);
	});

	it("drops an id a theme has started declaring again", () => {
		assert.deepStrictEqual(
			pruneRetiredThemeIds(["recite"], never, (id) => id === "recite"),
			[],
		);
	});

	it("keeps one that is still genuinely gone", () => {
		assert.deepStrictEqual(pruneRetiredThemeIds(["recite"], never, never), [
			"recite",
		]);
	});
});

describe("isRetiredThemeId — the question discovery asks", () => {
	it("matches whatever spelling the note used", () => {
		assert.strictEqual(isRetiredThemeId(["recite"], "Recite"), true);
		assert.strictEqual(isRetiredThemeId(["recite"], " recite "), true);
	});

	it("says no to an empty id and an empty list", () => {
		assert.strictEqual(isRetiredThemeId(["recite"], "  "), false);
		assert.strictEqual(isRetiredThemeId([], "recite"), false);
	});
});
