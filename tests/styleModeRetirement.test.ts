/**
 * tests/styleModeRetirement.test.ts — taking the manual style mode off disk.
 *
 * A callout used to carry a hand-set answer to "who paints this". That question
 * is no longer the user's to answer, so the fields that stored it have to come
 * off disk — and the whole risk of that is doing it destructively. Two things
 * are asserted here and they pull in opposite directions:
 *
 * **What goes.** `styleMode` on a row, and `settings.defaultStyleMode`. Both
 * are branch-only, never shipped, and every value `styleMode` ever held —
 * `"studio"` and the retired rungs `"blend"`, `"force"`, `"standard"` — meant
 * "this plugin paints it", which is exactly what its absence means now.
 *
 * **What stays.** `externalStyle`, which shipped in 2.11.0 and is translated
 * into all 32 locales. It survives the model that briefly absorbed it because
 * it never really belonged to it: it means "I style this one myself, in a
 * snippet", which is still a real, user-owned choice. Deleting it would make
 * this plugin start overriding the CSS of everyone who used the shipped action,
 * with `!important`, on upgrade.
 *
 * And the row itself is not touched. `styleMode` was compared by the
 * full-strength `isCalloutModified`, so stamping anything in its place would
 * write built-ins into `data.json`, put them in exports, and grow them a
 * spurious *Reset to default*.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { CalloutDefinition, PluginData } from "../src/types";

function def(over: Partial<CalloutDefinition> = {}): Record<string, unknown> {
	return {
		id: "x",
		displayName: "X",
		icon: { type: "lucide", value: "star" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	} satisfies CalloutDefinition as unknown as Record<string, unknown>;
}

/** A `data.json` carrying the retired fields, as the branch used to write it. */
function withModes(
	callouts: Record<string, unknown>[],
	settings?: Record<string, unknown>,
): Partial<PluginData> {
	return {
		version: 3,
		callouts,
		...(settings ? { settings } : {}),
	} as unknown as Partial<PluginData>;
}

function load(data: Partial<PluginData> | null): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(data);
	return registry;
}

/** The retired keys, read off a row without widening the public type. */
function retired(def: CalloutDefinition | undefined): Record<string, unknown> {
	return (def ?? {}) as unknown as Record<string, unknown>;
}

describe("the retired row field", () => {
	it("drops styleMode, whatever it said", () => {
		for (const value of ["studio", "standard", "blend", "force"]) {
			const registry = load(
				withModes([{ ...def({ id: "a" }), styleMode: value }]),
			);
			assert.ok(
				!("styleMode" in retired(registry.get("a"))),
				`styleMode: ${value}`,
			);
		}
	});

	it("asks to be saved, so the file stops carrying it", () => {
		const registry = load(withModes([{ ...def({ id: "a" }), styleMode: "studio" }]));
		assert.strictEqual(registry.needsSaveAfterLoad(), true);
	});

	it("asks for nothing when there was nothing to clean", () => {
		// An idle rewrite of `data.json` on every launch is a sync event for
		// every device the vault touches.
		const registry = load(withModes([def({ id: "a" })]));
		assert.strictEqual(registry.needsSaveAfterLoad(), false);
	});

	it("leaves every other field on the row exactly as it was", () => {
		const registry = load(
			withModes([
				{
					...def({
						id: "a",
						colorLight: "#abcdef",
						aliases: ["b"],
						customized: true,
					}),
					styleMode: "studio",
				},
			]),
		);
		const row = registry.get("a");
		assert.strictEqual(row?.colorLight, "#abcdef");
		assert.deepStrictEqual(row?.aliases, ["b"]);
		assert.strictEqual(row?.customized, true);
	});
});

describe("externalStyle survives", () => {
	it("keeps the flag a shipped release wrote", () => {
		// The regression this guards is silent and large: dropping it makes the
		// plugin start overriding a user's own snippet with `!important`.
		const registry = load(withModes([{ ...def({ id: "a" }), externalStyle: true }]));
		assert.strictEqual(registry.get("a")?.externalStyle, true);
		assert.strictEqual(registry.standsDown(registry.get("a")!), true);
	});

	it("keeps it even when a stale styleMode sat beside it", () => {
		const registry = load(
			withModes([
				{ ...def({ id: "a" }), externalStyle: true, styleMode: "studio" },
			]),
		);
		const row = retired(registry.get("a"));
		assert.strictEqual(row.externalStyle, true);
		assert.ok(!("styleMode" in row));
	});
});

describe("the retired setting", () => {
	it("does not carry defaultStyleMode into the live settings", () => {
		// `mergeSavedSettings` builds a fresh object from the keys this build
		// knows, so the retired one is already gone by the time the migration
		// runs — there is nothing to delete.
		const registry = load(
			withModes([def({ id: "a" })], { defaultStyleMode: "studio" }),
		);
		assert.ok(
			!(
				"defaultStyleMode" in
				(registry.settings as unknown as Record<string, unknown>)
			),
		);
	});

	it("still forces a save, so the key stops riding along in data.json", () => {
		// The only thing left to do about it: notice, and rewrite the file
		// without it. Otherwise it sits there being ignored forever.
		const registry = load(
			withModes([def({ id: "a" })], { defaultStyleMode: "studio" }),
		);
		assert.strictEqual(registry.needsSaveAfterLoad(), true);
	});

	it("asks for nothing when the file never had it", () => {
		const registry = load(withModes([def({ id: "a" })], { language: "auto" }));
		assert.strictEqual(registry.needsSaveAfterLoad(), false);
	});
});

describe("nothing is stamped in its place", () => {
	it("leaves an untouched built-in unmodified, and out of data.json", () => {
		// The trap the previous migration documented and avoided, restated for
		// its replacement: a stamped built-in is written to `data.json`, enters
		// every export, and grows a *Reset to default* nobody asked for.
		const registry = load(withModes([{ ...def({ id: "a" }), styleMode: "studio" }]));
		const note = registry.get("note");
		assert.ok(note, "built-ins are seeded");
		assert.strictEqual(registry.isBuiltInModified("note"), false);
		assert.strictEqual(registry.isUnmodifiedBuiltIn(note), true);
		const saved = registry.toSaveData();
		assert.ok(
			!saved.callouts.some((c) => c.id === "note"),
			"an unmodified built-in is not persisted",
		);
	});

	it("records no ownership, because ownership is derived", () => {
		// A vault loaded with no theme visible owns nothing — and that blank is
		// the fail-safe direction, since standing down on a bad read would strip
		// a user's callouts while standing up cannot.
		const registry = load(withModes([def({ id: "a" })]));
		assert.strictEqual(registry.themeOwns(registry.get("a")!), false);
		assert.strictEqual(registry.themeOwns(registry.get("note")!), false);
	});
});
