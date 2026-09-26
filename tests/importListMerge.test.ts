/**
 * tests/importListMerge.test.ts — the merge that stands between an import file
 * and the three lists a user builds up.
 *
 * `settingsValidator.test.ts` pins the boundary from the other side:
 * `sanitizeImportedSettings` hands back `customPalettes`, `userImages` and
 * `customCommands` exactly as the file gave them — **empty arrays when the file
 * said nothing** — because a validator reading a file cannot know what the vault
 * already holds. Everything therefore rests on the caller merging by id, and
 * that call used to live entirely inside `DataManagementSection.applyImport`,
 * behind a live registry, a live plugin and a modal. It was the one rule in the
 * import path that no test could reach, which is exactly the wrong rule to
 * leave unreachable: getting it wrong is not a visible error, it is the user's
 * palettes, pictures and commands quietly gone after importing a file that
 * never mentioned them.
 *
 * So the rule now lives in `utils/mergeById.ts` and is tested here directly. The
 * last suite keeps the two halves tied together: the importer still has to route
 * all three lists through it, and still has to keep them out of the wholesale
 * `Object.assign` that carries everything else.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { mergeById } from "../src/utils/mergeById";
import { readRepoFile } from "./support/sourceScan";

interface Row {
	id: string;
	name: string;
}

const row = (id: string, name = id): Row => ({ id, name });
const ids = (rows: readonly Row[]): string[] => rows.map((r) => r.id);

describe("mergeById — what the vault already has", () => {
	it("keeps every existing entry when the file carries none", () => {
		// The whole reason this function exists. An export predating custom
		// commands carries no commands at all; a plain assignment of the
		// sanitized settings would replace the user's list with `[]`.
		const mine = [row("cp-1"), row("cp-2")];
		assert.deepStrictEqual(mergeById(mine, []), mine);
	});

	it("takes the file's entries when the vault has none", () => {
		const theirs = [row("cp-1"), row("cp-2")];
		assert.deepStrictEqual(mergeById([], theirs), theirs);
	});

	it("appends an id the vault has never seen, in file order", () => {
		const merged = mergeById([row("a")], [row("b"), row("c")]);
		assert.deepStrictEqual(ids(merged), ["a", "b", "c"]);
	});

	it("overwrites a repeated id with the file's version", () => {
		const merged = mergeById([row("a", "mine")], [row("a", "theirs")]);
		assert.deepStrictEqual(merged, [row("a", "theirs")]);
	});

	it("overwrites in place, so re-importing does not reshuffle the list", () => {
		// `Map.set` on a key it already holds leaves the key where it was. A
		// user who imports the same file twice sees their list rewritten, never
		// reordered.
		const mine = [row("a"), row("b"), row("c")];
		const merged = mergeById(mine, [row("b", "updated")]);
		assert.deepStrictEqual(ids(merged), ["a", "b", "c"]);
		assert.equal(merged[1]?.name, "updated");
	});

	it("lets the last of two identical ids in one file win", () => {
		const merged = mergeById([], [row("a", "first"), row("a", "second")]);
		assert.deepStrictEqual(merged, [row("a", "second")]);
	});

	it("de-duplicates a vault list that somehow holds the same id twice", () => {
		// Hand-edited `data.json` is a real input; the merge must not carry a
		// duplicate through and hand the pack two entries under one id.
		const merged = mergeById([row("a", "one"), row("a", "two")], []);
		assert.deepStrictEqual(merged, [row("a", "two")]);
	});

	it("mutates neither argument", () => {
		const mine = [row("a")];
		const theirs = [row("a", "theirs"), row("b")];
		const merged = mergeById(mine, theirs);
		assert.deepStrictEqual(mine, [row("a")]);
		assert.deepStrictEqual(theirs, [row("a", "theirs"), row("b")]);
		assert.notEqual(merged, mine);
	});

	it("returns the entries themselves, not copies of them", () => {
		// The importer hands the result straight to `setUserImages`, which is
		// what gives the pack its drawable artwork; a shallow copy here would be
		// wasted work, and a deep one would break identity comparisons.
		const entry = row("a");
		assert.equal(mergeById([], [entry])[0], entry);
	});
});

describe("the importer still uses it — for all three lists", () => {
	const source = readRepoFile("src/settings/sections/DataManagementSection.ts");

	it("routes three lists through mergeById", () => {
		// Budget checks may also compute a prospective merge. Pin each applied
		// list, rather than counting unrelated read-only merge calls.
		for (const [list, pattern] of [
			["palettes", /customPalettes\s*=\s*mergeById\([\s\S]*?importedPalettes/],
			["pictures", /setUserImages\(\s*mergeById\([\s\S]*?importedImages/],
			["commands", /customCommands\s*=\s*mergeById\([\s\S]*?importedCommands/],
		] as const) {
			assert.match(source, pattern, `${list} must still merge by id when applied`);
		}
	});

	it("keeps the three lists out of the wholesale Object.assign", () => {
		// Everything else in an imported settings blob IS replaced wholesale —
		// deliberately, since an import is a restore and a border width has no
		// id to merge on. The three lists are pulled out of the object before
		// that assignment, and the check is that they still are.
		const destructure = /const \{([\s\S]*?)\} = result\.settings;/.exec(source);
		assert.ok(destructure, "applyImport no longer splits the settings blob");
		for (const field of ["customPalettes", "userImages", "customCommands"]) {
			assert.ok(
				destructure[1]?.includes(field),
				`${field} is no longer held back from Object.assign — an import ` +
					"file without it would wipe the user's own",
			);
		}
	});
});
