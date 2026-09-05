/**
 * tests/ignoredCallouts.test.ts — the callouts this vault does not want found.
 *
 * Automatic discovery assumes an id written in a note and missing from the
 * settings is an oversight. For a vault that also uses a CSS-snippet callout —
 * `[!mcc]` for a multi-column layout, a theme's helper, another plugin's marker
 * — it is not, and a row for it arrives every time a note using it is opened.
 *
 * Issue #41 asked for this, and the sentence that came with the request is why
 * the row itself is the problem rather than the clutter: *"I accidentally
 * deleted every instance of `>[!mcc]`, not fun."* A row nobody wants puts a
 * delete button next to a callout the plugin does not own.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	addIgnoredCalloutId,
	isIgnoredCalloutId,
	removeIgnoredCalloutId,
	sanitizeIgnoredCalloutIds,
} from "../src/manager/ignoredCallouts";
import { buildKnownCalloutIds } from "../src/manager/knownCalloutIds";
import { mergeSavedSettings } from "../src/utils/settingsMerge";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { discoveryHarness } from "./support/discoveryHarness";

describe("the list itself", () => {
	it("holds one entry per callout, not one per spelling", () => {
		// Obsidian renders `[!multi column]` and `[!multi-column]` as one
		// callout, so ignoring either has to ignore both — the same rule
		// DeviceLocalStore and findAttrIdConflict already follow.
		const list = addIgnoredCalloutId([], "multi column");

		assert.deepStrictEqual(list, ["multi-column"]);
		assert.strictEqual(isIgnoredCalloutId(list, "multi-column"), true);
		assert.strictEqual(isIgnoredCalloutId(list, "Multi Column"), true);
	});

	it("does not add the same callout twice", () => {
		const once = addIgnoredCalloutId([], "mcc");
		assert.deepStrictEqual(addIgnoredCalloutId(once, "mcc"), ["mcc"]);
	});

	it("removes through any spelling", () => {
		const list = addIgnoredCalloutId([], "multi-column");
		assert.deepStrictEqual(removeIgnoredCalloutId(list, "multi column"), []);
	});

	it("drops junk rather than the whole list", () => {
		// Saved data and import files are untrusted.
		const list = sanitizeIgnoredCalloutIds([
			"mcc",
			42,
			null,
			"",
			{ id: "nope" },
			"MCC",
		]);
		assert.deepStrictEqual(list, ["mcc"]);
	});

	it("reads a non-array as no list at all", () => {
		assert.deepStrictEqual(sanitizeIgnoredCalloutIds("mcc"), []);
		assert.deepStrictEqual(sanitizeIgnoredCalloutIds(undefined), []);
	});

	it("is capped, so a corrupt file cannot make it unbounded", () => {
		const many = Array.from({ length: 500 }, (_, i) => `id-${i}`);
		assert.strictEqual(sanitizeIgnoredCalloutIds(many).length, 200);
	});
});

describe("the list as settings", () => {
	it("survives a save and load", () => {
		const merged = mergeSavedSettings({ ignoredCalloutIds: ["mcc", "grid"] });
		assert.deepStrictEqual(merged.ignoredCalloutIds, ["mcc", "grid"]);
	});

	it("defaults to empty, so nothing is hidden from a vault that never asked", () => {
		assert.deepStrictEqual(mergeSavedSettings({}).ignoredCalloutIds, []);
	});

	it("round-trips through the registry", () => {
		const registry = new CalloutRegistry();
		registry.load({ callouts: [], settings: { ignoredCalloutIds: ["mcc"] } } as never);

		assert.deepStrictEqual(registry.toSaveData().settings.ignoredCalloutIds, [
			"mcc",
		]);
	});
});

describe("what the scanner is told is already known", () => {
	it("includes the ignored ids, in both spellings", () => {
		// Enforced here rather than in a check further down: "known" is what
		// stops the scanner reporting an id at all, so one addition covers the
		// incremental scan, the whole-vault scan, the open-buffer sweep and the
		// first-run modal alike.
		const registry = new CalloutRegistry();
		registry.load({
			callouts: [],
			settings: { ignoredCalloutIds: ["multi column"] },
		} as never);

		const known = buildKnownCalloutIds(registry);
		assert.ok(known.has("multi-column"));
	});
});

describe("a note using an ignored callout", () => {
	it("mints no row for it", async () => {
		const h = discoveryHarness({ "note.md": "> [!mcc]\n> two columns" });
		h.registry.settings.ignoredCalloutIds = ["mcc"];

		await h.internals.scanFileNow(h.vault.file("note.md"));

		assert.strictEqual(h.registry.get("mcc"), undefined);
	});

	it("does not put it in this device's index either", async () => {
		// Otherwise the next launch rebuilds the row from memory, which is the
		// same failure one restart later.
		const h = discoveryHarness({ "note.md": "> [!mcc]" });
		h.registry.settings.ignoredCalloutIds = ["mcc"];

		await h.internals.scanFileNow(h.vault.file("note.md"));

		assert.deepStrictEqual([...h.localState.discovered], []);
	});

	it("still finds everything else in the same note", async () => {
		const h = discoveryHarness({ "note.md": "> [!mcc]\n\n> [!recipe]" });
		h.registry.settings.ignoredCalloutIds = ["mcc"];

		await h.internals.scanFileNow(h.vault.file("note.md"));

		assert.strictEqual(h.registry.get("mcc"), undefined);
		assert.ok(h.registry.get("recipe"), "an unrelated id is unaffected");
	});

	it("is found again once the id comes off the list", async () => {
		// "Detect again" does not re-create the row; the next scan does.
		const h = discoveryHarness({ "note.md": "> [!mcc]" });
		h.registry.settings.ignoredCalloutIds = ["mcc"];
		await h.internals.scanFileNow(h.vault.file("note.md"));

		h.registry.settings.ignoredCalloutIds = [];
		await h.internals.scanFileNow(h.vault.file("note.md"));

		assert.ok(h.registry.get("mcc"));
	});
});
