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
 * So the rule now lives in `utils/mergeById.ts` and is tested here directly.
 * Palettes add one thing to it — a name is also an identity — and that lives in
 * `utils/mergePalettes.ts`, tested below it. The last suite keeps the two halves
 * tied together: the importer still has to route all three lists through their
 * merge, and still has to keep them out of the wholesale `Object.assign` that
 * carries everything else.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { CustomPalette } from "../src/types";
import { mergeById } from "../src/utils/mergeById";
import { mergePalettes, type PaletteMerge } from "../src/utils/mergePalettes";
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

/** A palette of one colour, enough for `mergePalettes` to tell two looks apart. */
const pal = (id: string, name: string, accent = "#336699"): CustomPalette => ({
	id,
	name,
	colorLight: accent,
	colorDark: accent,
	bgColorLight: "#eeeeee",
	bgColorDark: "#222222",
	textColorLight: "#111111",
	textColorDark: "#eeeeee",
});
const palIds = (merge: PaletteMerge): string[] => merge.palettes.map((p) => p.id);

describe("mergePalettes — a name is how the user tells palettes apart", () => {
	it("merges by id exactly like mergeById when no names collide", () => {
		const mine = [pal("a", "Mine"), pal("b", "Other")];
		const theirs = [pal("b", "Other", "#ff0000"), pal("c", "New")];
		const merge = mergePalettes(mine, theirs);
		assert.deepStrictEqual(merge.palettes, mergeById(mine, theirs));
		assert.strictEqual(merge.remap.size, 0, "an id match needs no re-pointing");
		assert.deepStrictEqual(merge.restyled, ["b"]);
	});

	it("replaces the palette of the same name, keeping the vault's id and place", () => {
		const merge = mergePalettes(
			[pal("a", "Blue 2"), pal("z", "Zed")],
			[pal("file-id", "Blue 2", "#ff0000")],
		);
		assert.deepStrictEqual(palIds(merge), ["a", "z"]);
		assert.strictEqual(merge.palettes[0]?.colorLight, "#ff0000");
		assert.strictEqual(merge.remap.get("file-id"), "a");
		assert.deepStrictEqual(merge.restyled, ["a"]);
	});

	it("compares names ignoring case and surrounding spaces, like the editor", () => {
		const merge = mergePalettes([pal("a", "Blue 2")], [pal("b", "  blue 2 ")]);
		assert.deepStrictEqual(palIds(merge), ["a"]);
	});

	it("keeps a differently named palette apart even when its id is new", () => {
		const merge = mergePalettes([pal("a", "Blue 2")], [pal("b", "Blue 3")]);
		assert.deepStrictEqual(palIds(merge), ["a", "b"]);
		assert.strictEqual(merge.remap.size, 0);
	});

	it("does not repaint anything when the colours are the ones the vault already had", () => {
		// Same name, same look: the callouts using it have nothing to follow, and
		// a callout the user tuned by hand since must not be touched.
		const merge = mergePalettes([pal("a", "Blue 2")], [pal("b", "Blue 2")]);
		assert.deepStrictEqual(palIds(merge), ["a"]);
		assert.deepStrictEqual(merge.restyled, []);
	});

	it("reports a rename-only change as no repaint", () => {
		// `restyled` feeds the cascade onto linked callouts, which carry colours,
		// not names.
		const merge = mergePalettes([pal("a", "Old name")], [pal("a", "New name")]);
		assert.strictEqual(merge.palettes[0]?.name, "New name");
		assert.deepStrictEqual(merge.restyled, []);
	});

	it("rewrites every vault palette that carries the name, so the twins become one look", () => {
		// What an earlier version left behind. All of them take the file's version
		// (keeping their own ids); the consolidation that follows an import then
		// folds them, since they are now identical.
		const merge = mergePalettes(
			[pal("a", "Blue 2"), pal("b", "Blue 2", "#00ff00")],
			[pal("file-id", "Blue 2", "#ff0000")],
		);
		assert.deepStrictEqual(palIds(merge), ["a", "b"]);
		assert.deepStrictEqual(
			merge.palettes.map((p) => p.colorLight),
			["#ff0000", "#ff0000"],
		);
		assert.strictEqual(merge.remap.get("file-id"), "a");
	});

	it("matches by id and by name together, with no re-pointing when its own id matched", () => {
		const merge = mergePalettes(
			[pal("a", "Blue 2"), pal("b", "Blue 2", "#00ff00")],
			[pal("b", "Blue 2", "#ff0000")],
		);
		assert.deepStrictEqual(
			merge.palettes.map((p) => p.colorLight),
			["#ff0000", "#ff0000"],
		);
		assert.strictEqual(merge.remap.size, 0);
	});

	it("brings across two same-named palettes the file itself carries", () => {
		// A palette this file has written is not matched by name again, so the
		// second does not overwrite the first.
		const merge = mergePalettes([], [pal("a", "Blue 2"), pal("b", "Blue 2", "#ff0000")]);
		assert.deepStrictEqual(palIds(merge), ["a", "b"]);
	});

	it("does the same when the vault holds one of that name", () => {
		const merge = mergePalettes(
			[pal("mine", "Blue 2")],
			[pal("a", "Blue 2", "#ff0000"), pal("b", "Blue 2", "#00ff00")],
		);
		assert.deepStrictEqual(palIds(merge), ["mine", "b"]);
		assert.strictEqual(merge.palettes[0]?.colorLight, "#ff0000");
		assert.strictEqual(merge.remap.get("a"), "mine");
		assert.strictEqual(merge.remap.has("b"), false, "the second one was appended under its own id");
	});

	it("never matches on an empty name", () => {
		const merge = mergePalettes([pal("a", "  ")], [pal("b", " ")]);
		assert.deepStrictEqual(palIds(merge), ["a", "b"]);
	});

	it("mutates neither argument", () => {
		const mine = [pal("a", "Blue 2")];
		const theirs = [pal("b", "Blue 2", "#ff0000")];
		const mineBefore = JSON.stringify(mine);
		const theirsBefore = JSON.stringify(theirs);
		const merge = mergePalettes(mine, theirs);
		assert.strictEqual(JSON.stringify(mine), mineBefore);
		assert.strictEqual(JSON.stringify(theirs), theirsBefore);
		assert.notStrictEqual(merge.palettes, mine);
	});
});

describe("the importer still uses it — for all three lists", () => {
	const source = readRepoFile("src/settings/sections/DataManagementSection.ts");

	it("routes three lists through their merge when applied", () => {
		// Budget checks may also compute a prospective merge. Pin each applied
		// list, rather than counting unrelated read-only merge calls. Palettes
		// have their own rule (by id and by name); the other two merge by id.
		for (const [list, pattern] of [
			["palettes", /applyPaletteMerge\(\s*ctx\.plugin\.registry,\s*mergePalettes\([\s\S]*?importedPalettes/],
			["pictures", /setUserImages\(\s*mergeById\([\s\S]*?importedImages/],
			["commands", /customCommands\s*=\s*mergeById\([\s\S]*?importedCommands/],
		] as const) {
			assert.match(source, pattern, `${list} must still merge when applied`);
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
