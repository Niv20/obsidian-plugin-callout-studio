// tests/importListMerge.test.ts
import assert2 from "node:assert";
import { describe, it } from "node:test";

// src/utils/mergeById.ts
function mergeById(existing, incoming) {
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()];
}

// tests/support/sourceScan.ts
import assert from "node:assert";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
var REPO_ROOT = process.cwd();
assert.ok(
  existsSync(join(REPO_ROOT, "manifest.json")) && existsSync(join(REPO_ROOT, "src")),
  `sourceScan: cwd is not the repository root (${REPO_ROOT}). Run the suites through \`npm test\`.`
);
function readRepoFile(relPath) {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}
var REGEX_PRECEDERS = new Set("(,=:[!&|?{};+-*%~^<>");

// tests/importListMerge.test.ts
var row = (id, name = id) => ({ id, name });
var ids = (rows) => rows.map((r) => r.id);
describe("mergeById \u2014 what the vault already has", () => {
  it("keeps every existing entry when the file carries none", () => {
    const mine = [row("cp-1"), row("cp-2")];
    assert2.deepStrictEqual(mergeById(mine, []), mine);
  });
  it("takes the file's entries when the vault has none", () => {
    const theirs = [row("cp-1"), row("cp-2")];
    assert2.deepStrictEqual(mergeById([], theirs), theirs);
  });
  it("appends an id the vault has never seen, in file order", () => {
    const merged = mergeById([row("a")], [row("b"), row("c")]);
    assert2.deepStrictEqual(ids(merged), ["a", "b", "c"]);
  });
  it("overwrites a repeated id with the file's version", () => {
    const merged = mergeById([row("a", "mine")], [row("a", "theirs")]);
    assert2.deepStrictEqual(merged, [row("a", "theirs")]);
  });
  it("overwrites in place, so re-importing does not reshuffle the list", () => {
    const mine = [row("a"), row("b"), row("c")];
    const merged = mergeById(mine, [row("b", "updated")]);
    assert2.deepStrictEqual(ids(merged), ["a", "b", "c"]);
    assert2.equal(merged[1]?.name, "updated");
  });
  it("lets the last of two identical ids in one file win", () => {
    const merged = mergeById([], [row("a", "first"), row("a", "second")]);
    assert2.deepStrictEqual(merged, [row("a", "second")]);
  });
  it("de-duplicates a vault list that somehow holds the same id twice", () => {
    const merged = mergeById([row("a", "one"), row("a", "two")], []);
    assert2.deepStrictEqual(merged, [row("a", "two")]);
  });
  it("mutates neither argument", () => {
    const mine = [row("a")];
    const theirs = [row("a", "theirs"), row("b")];
    const merged = mergeById(mine, theirs);
    assert2.deepStrictEqual(mine, [row("a")]);
    assert2.deepStrictEqual(theirs, [row("a", "theirs"), row("b")]);
    assert2.notEqual(merged, mine);
  });
  it("returns the entries themselves, not copies of them", () => {
    const entry = row("a");
    assert2.equal(mergeById([], [entry])[0], entry);
  });
});
describe("the importer still uses it \u2014 for all three lists", () => {
  const source = readRepoFile("src/settings/sections/DataManagementSection.ts");
  it("routes three lists through mergeById", () => {
    const calls = source.match(/mergeById\(/g) ?? [];
    assert2.equal(
      calls.length,
      3,
      `applyImport makes ${calls.length} mergeById calls; palettes, pictures and commands each need one`
    );
  });
  it("keeps the three lists out of the wholesale Object.assign", () => {
    const destructure = /const \{([\s\S]*?)\} = result\.settings;/.exec(source);
    assert2.ok(destructure, "applyImport no longer splits the settings blob");
    for (const field of ["customPalettes", "userImages", "customCommands"]) {
      assert2.ok(
        destructure[1]?.includes(field),
        `${field} is no longer held back from Object.assign \u2014 an import file without it would wipe the user's own`
      );
    }
  });
});
