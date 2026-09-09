/**
 * tests/themeOverlayRows.test.ts — the theme overlay sweep as a pure function.
 *
 * Given a registry and the set of ids the active theme declares, which rows
 * exist afterwards. `themeRowSync.test.ts` pins the half around it — when the
 * sweep runs and in what order — so everything here is about the *result*.
 *
 * Two properties carry the whole design and are therefore asserted in almost
 * every case:
 *
 * 1. **`toSaveData()` never moves.** Theme ownership is a fact about the
 *    machine, not the vault. A laptop with a different theme has to write a
 *    byte-identical `data.json` or the two devices start rewriting one file at
 *    each other — issue #41. The overlay is invisible to persistence.
 * 2. **The overlay only ever holds ids nothing else claims.** It cannot shadow
 *    a built-in, a user row, a fallback row or an alias, so a row that survives
 *    a sweep is by construction one that existed first.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { syncThemeOverlayRows } from "../src/manager/theme/themeOverlayRows";
import { PREVIEW_PLACEHOLDER_ID, STYLE_DEMO_ID } from "../src/constants";
import { discovered, definition } from "./support/discoveryHarness";

function vault(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

/** Run the sweep over a plain id list. */
function sweep(registry: CalloutRegistry, ...ids: string[]): number {
	return syncThemeOverlayRows(registry, new Set(ids));
}

describe("theme overlay rows — what the sweep mints", () => {
	it("mints a row for an id nothing else claims", () => {
		const registry = vault();
		assert.strictEqual(sweep(registry, "recite"), 1);
		assert.strictEqual(registry.get("recite")?.source, "theme");
	});

	it("never persists what it mints", () => {
		const registry = vault();
		const saved = registry.toSaveData();
		sweep(registry, "recite", "aside", "mcc");
		assert.deepStrictEqual(registry.toSaveData(), saved);
	});

	it("keeps the overlay out of the user's list and out of exports", () => {
		const registry = vault();
		sweep(registry, "recite");
		assert.ok(!registry.getUserDefined().some((d) => d.id === "recite"));
		assert.ok(
			!registry.getExportableDefinitions().some((d) => d.id === "recite"),
		);
		assert.ok(registry.getThemeProvided().some((d) => d.id === "recite"));
	});

	it("publishes ownership for a built-in without minting a second row", () => {
		const registry = vault();
		const before = registry.getAll().length;
		assert.strictEqual(sweep(registry, "note"), 0);
		assert.strictEqual(registry.getAll().length, before);
		assert.strictEqual(registry.themeOwns(registry.get("note")!), true);
	});

	it("leaves a user row alone when the theme declares its id", () => {
		const registry = vault();
		registry.add(definition({ id: "recite", displayName: "Mine" }));
		const saved = registry.toSaveData();
		assert.strictEqual(sweep(registry, "recite"), 0);
		assert.strictEqual(registry.get("recite")?.source, "user");
		assert.strictEqual(registry.get("recite")?.displayName, "Mine");
		assert.deepStrictEqual(registry.toSaveData(), saved);
	});

	it("leaves a scanned fallback row alone when the theme declares its id", () => {
		const registry = vault();
		registry.add(discovered("recite"));
		assert.strictEqual(sweep(registry, "recite"), 0);
		assert.strictEqual(registry.get("recite")?.source, "fallback");
	});

	it("does not mint over an alias", () => {
		const registry = vault();
		registry.add(definition({ id: "summary", aliases: ["tldr"] }));
		assert.strictEqual(sweep(registry, "tldr"), 0);
		assert.strictEqual(registry.get("tldr"), undefined);
	});

	it("does not mint over the dash form of a space-form row", () => {
		const registry = vault();
		registry.add(definition({ id: "two words" }));
		assert.strictEqual(sweep(registry, "two-words"), 0);
		assert.strictEqual(registry.get("two-words"), undefined);
	});

	it("never mints a reserved preview id", () => {
		const registry = vault();
		assert.strictEqual(
			sweep(registry, PREVIEW_PLACEHOLDER_ID, STYLE_DEMO_ID),
			0,
		);
		assert.strictEqual(registry.get(PREVIEW_PLACEHOLDER_ID), undefined);
		assert.strictEqual(registry.get(STYLE_DEMO_ID), undefined);
	});

	it("drops values that cannot be written as a callout token", () => {
		const registry = vault();
		const bad = ["", "   ", "bad|meta", "bad]name", "[bad", "bad\\esc", "a\nb", "a\rb", "a\0b"];
		assert.strictEqual(sweep(registry, ...bad), 0);
		assert.strictEqual(registry.getAll().length, vault().getAll().length);
	});

	it("folds case and spacing the way Obsidian does", () => {
		const registry = vault();
		assert.strictEqual(sweep(registry, "VALID", "valid"), 1);
	});
});

describe("theme overlay rows — what the sweep retires", () => {
	it("removes a row it minted once the theme stops declaring it", () => {
		const registry = vault();
		sweep(registry, "recite");
		const saved = registry.toSaveData();
		assert.strictEqual(sweep(registry), 1);
		assert.strictEqual(registry.get("recite"), undefined);
		assert.deepStrictEqual(registry.toSaveData(), saved);
	});

	it("never removes a row it did not mint", () => {
		const registry = vault();
		registry.add(discovered("recite"));
		registry.add(definition({ id: "mine" }));
		const saved = registry.toSaveData();
		sweep(registry, "recite", "mine");
		sweep(registry);
		assert.strictEqual(registry.get("recite")?.source, "fallback");
		assert.strictEqual(registry.get("mine")?.source, "user");
		assert.deepStrictEqual(registry.toSaveData(), saved);
	});

	it("keeps an id both themes declare owned across a switch", () => {
		const registry = vault();
		sweep(registry, "shared", "old-only");
		const kept = registry.get("shared");
		sweep(registry, "shared", "new-only");
		assert.strictEqual(registry.get("old-only"), undefined);
		assert.strictEqual(registry.get("new-only")?.source, "theme");
		assert.deepStrictEqual(registry.get("shared"), kept, "not remade");
	});

	it("is idempotent", () => {
		const registry = vault();
		sweep(registry, "recite", "note");
		const after = registry.toSaveData();
		const all = registry.getAll().length;
		assert.strictEqual(sweep(registry, "recite", "note"), 0);
		assert.strictEqual(registry.getAll().length, all);
		assert.deepStrictEqual(registry.toSaveData(), after);
	});

	it("hands a minted id over to a real row when a scan claims it", () => {
		// The one sanctioned route from theme id to saved configuration.
		const registry = vault();
		sweep(registry, "recite");
		registry.remove("recite");
		registry.add(discovered("recite"));
		assert.strictEqual(sweep(registry, "recite"), 0);
		assert.strictEqual(registry.get("recite")?.source, "fallback");
		assert.ok(
			registry.toSaveData().callouts.some((d) => d.id === "recite"),
			"a scanned row is saved configuration",
		);
	});
});
