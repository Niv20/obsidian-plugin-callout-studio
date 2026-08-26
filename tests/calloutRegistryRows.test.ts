/**
 * tests/calloutRegistryRows.test.ts — the row-level operations.
 *
 * Four writers that each change what a callout *is* rather than what it looks
 * like, and one mirror pass that reaches rows the user never opened:
 *
 * - **`restyleUncustomizedFallbackRows`** copies the active Default fallback's
 *   whole appearance onto every uncustomized discovery row. Its skip list is the
 *   interesting part — each entry there is a row someone else owns.
 * - **`convertToFallback`** re-adopts a row into that mirror.
 * - **`setStyleMode`** is the ONLY writer of `externalStyle` and `styleMode`,
 *   so the rules it enforces (at most one field, delete rather than write a
 *   falsy value, never `theme` on the fallback target) cannot drift to a call
 *   site.
 * - **`resetBuiltIn` / `isBuiltInModified`** are the persistence gate's two ends.
 *
 * The mirror is spelled out field by field in the source, `undefined` included,
 * because it merges onto the row: a key that isn't there leaves the old value
 * standing. Each of those spellings is asserted here, since the failure is
 * invisible — a mirrored row that keeps its own stale transparency flag while
 * taking the fallback's hexes is exactly the contradiction
 * `dropStaleTransparencyFlags` exists to repair.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DEFAULT_SETTINGS } from "../src/constants";
import type { CalloutDefinition, PluginData } from "../src/types";

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
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
	};
}

function saved(
	callouts: CalloutDefinition[],
	settings?: Record<string, unknown>,
): Partial<PluginData> {
	return { callouts, ...(settings ? { settings } : {}) } as Partial<PluginData>;
}

function loaded(data: Partial<PluginData> | null): {
	registry: CalloutRegistry;
	events: () => number;
} {
	const registry = new CalloutRegistry();
	registry.load(data);
	let n = 0;
	registry.onChange(() => n++);
	return { registry, events: () => n };
}

/** The active fallback plus one plain uncustomized discovery row. */
function withFallback(
	base: Partial<CalloutDefinition> = {},
	rows: CalloutDefinition[] = [],
): { registry: CalloutRegistry; events: () => number } {
	return loaded(
		saved(
			[
				def({ id: "base", source: "user", colorLight: "#ff0000", colorDark: "#ff0000", ...base }),
				def({ id: "f1", source: "fallback" }),
				...rows,
			],
			{ fallbackCalloutId: "base" },
		),
	);
}

describe("restyleUncustomizedFallbackRows — who is mirrored", () => {
	it("mirrors an uncustomized discovery row", () => {
		const { registry } = withFallback();
		assert.strictEqual(registry.restyleUncustomizedFallbackRows(), 1);
		assert.strictEqual(registry.get("f1")?.colorLight, "#ff0000");
	});

	it("skips a discovery row the user has customized", () => {
		const { registry } = withFallback({}, [
			def({ id: "mine", source: "fallback", customized: true }),
		]);
		registry.restyleUncustomizedFallbackRows();
		assert.strictEqual(registry.get("mine")?.colorLight, "#336699");
	});

	it("skips a row the theme owns", () => {
		// Nothing reads its colours while `externalStyle` is set, so mirroring
		// would only churn data.json on every fallback change and make the row
		// look edited in an export.
		const { registry } = withFallback({}, [
			def({ id: "themed", source: "fallback", externalStyle: true }),
		]);
		registry.restyleUncustomizedFallbackRows();
		assert.strictEqual(registry.get("themed")?.colorLight, "#336699");
	});

	it("skips a user-created callout — it was never a mirror", () => {
		const { registry } = withFallback({}, [def({ id: "mine", source: "user" })]);
		registry.restyleUncustomizedFallbackRows();
		assert.strictEqual(registry.get("mine")?.colorLight, "#336699");
	});

	it("skips every built-in", () => {
		const { registry } = withFallback();
		registry.restyleUncustomizedFallbackRows();
		assert.strictEqual(registry.get("note")?.colorLight, "#086ddd");
	});

	it("skips the fallback callout itself", () => {
		const { registry } = withFallback({ source: "fallback" });
		assert.strictEqual(registry.restyleUncustomizedFallbackRows(), 1, "f1 only");
		assert.strictEqual(registry.get("base")?.colorLight, "#ff0000");
	});

	it("does nothing when the fallback id resolves to no callout", () => {
		const { registry, events } = loaded(
			saved([def({ id: "f1", source: "fallback" })], { fallbackCalloutId: "gone" }),
		);
		assert.strictEqual(registry.restyleUncustomizedFallbackRows(), 0);
		assert.strictEqual(events(), 0);
	});

	it("falls back to the default id when the setting is empty", () => {
		const { registry } = loaded(
			saved([def({ id: "f1", source: "fallback" })], { fallbackCalloutId: "" }),
		);
		assert.strictEqual(registry.restyleUncustomizedFallbackRows(), 1);
		assert.strictEqual(
			registry.get("f1")?.colorLight,
			registry.get(DEFAULT_SETTINGS.fallbackCalloutId)?.colorLight,
		);
	});

	it("announces only when at least one row was touched", () => {
		const { registry, events } = withFallback();
		registry.restyleUncustomizedFallbackRows();
		assert.strictEqual(events(), 1);

		registry.remove("f1");
		const before = events();
		assert.strictEqual(registry.restyleUncustomizedFallbackRows(), 0);
		assert.strictEqual(events(), before);
	});

	it("counts rows CHANGED, not rows visited — a second call is free", () => {
		// The pass runs on every fallback edit, every fallback-target delete and
		// every discovery sweep, so most of its work lands on rows already
		// wearing this style. Writing those back unconditionally reported them
		// as updated and fired the change event anyway: a full stylesheet
		// regeneration, an icon repaint and a data.json write for a no-op.
		const { registry, events } = withFallback();
		assert.strictEqual(registry.restyleUncustomizedFallbackRows(), 1);
		assert.strictEqual(registry.restyleUncustomizedFallbackRows(), 0);
		assert.strictEqual(events(), 1);
	});

	it("still reports a row that drifts back out of the mirror", () => {
		// The diff is on content, so it must not latch: a row edited away from
		// the fallback style is mirrored again on the next pass.
		const { registry } = withFallback();
		assert.strictEqual(registry.restyleUncustomizedFallbackRows(), 1);

		registry.update("f1", { colorLight: "#00ff00" });
		assert.strictEqual(registry.restyleUncustomizedFallbackRows(), 1);
		assert.strictEqual(registry.get("f1")?.colorLight, "#ff0000");
	});

	it("reports only the rows that differ, not every row it walks", () => {
		const { registry } = withFallback({}, [
			def({ id: "drifted", source: "fallback", colorLight: "#0000ff" }),
		]);
		assert.strictEqual(registry.restyleUncustomizedFallbackRows(), 2);
		assert.strictEqual(registry.restyleUncustomizedFallbackRows(), 0);
	});
});

describe("restyleUncustomizedFallbackRows — what is mirrored", () => {
	it("copies the icon as a fresh object, not a shared reference", () => {
		const { registry } = withFallback({ icon: { type: "emoji", value: "🌵" } });
		registry.restyleUncustomizedFallbackRows();

		assert.deepStrictEqual(registry.get("f1")?.icon, { type: "emoji", value: "🌵" });
		assert.notStrictEqual(registry.get("f1")?.icon, registry.get("base")?.icon);
	});

	it("carries hideIcon, so the flex gap collapses on the mirror too", () => {
		const { registry } = withFallback({ hideIcon: true });
		registry.restyleUncustomizedFallbackRows();
		assert.strictEqual(registry.get("f1")?.hideIcon, true);
	});

	it("CLEARS a stale flag when the fallback does not set it", () => {
		// The spread merges onto the row, so every mirrored field is spelled
		// out `undefined` included — omitting a key would let the row keep its
		// own value while taking the fallback's icon.
		const { registry } = withFallback({}, [
			def({ id: "stale", source: "fallback", hideIcon: true, transparentBg: true }),
		]);
		registry.restyleUncustomizedFallbackRows();

		assert.strictEqual(registry.get("stale")?.hideIcon, undefined);
		assert.strictEqual(registry.get("stale")?.transparentBg, undefined);
	});

	it("mirrors transparency, so a transparent fallback really is mirrored as transparent", () => {
		const { registry } = withFallback({ transparentBg: true });
		registry.restyleUncustomizedFallbackRows();
		assert.strictEqual(registry.get("f1")?.transparentBg, true);
	});

	it("mirrors both background hexes and clears them together", () => {
		const { registry } = withFallback({ bgColorLight: "#123456", bgColorDark: "#654321" }, [
			def({ id: "stale", source: "fallback", bgColorLight: "#aaaaaa", bgColorDark: "#bbbbbb" }),
		]);
		registry.restyleUncustomizedFallbackRows();

		assert.strictEqual(registry.get("stale")?.bgColorLight, "#123456");
		assert.strictEqual(registry.get("stale")?.bgColorDark, "#654321");
	});

	it("clones the gradient rather than sharing it", () => {
		const gradient = {
			angleDeg: 45,
			toColorLight: "#ffffff",
			toColorDark: "#000000",
		};
		const { registry } = withFallback({ bgGradient: gradient });
		registry.restyleUncustomizedFallbackRows();

		assert.deepStrictEqual(registry.get("f1")?.bgGradient, gradient);
		assert.notStrictEqual(registry.get("f1")?.bgGradient, registry.get("base")?.bgGradient);
	});

	it("mirrors the text colours", () => {
		const { registry } = withFallback({
			textColorLight: "#111111",
			textColorDark: "#eeeeee",
		});
		registry.restyleUncustomizedFallbackRows();

		assert.strictEqual(registry.get("f1")?.textColorLight, "#111111");
		assert.strictEqual(registry.get("f1")?.textColorDark, "#eeeeee");
	});

	it("moves both icon-adjustment layers together, deep-cloning the per-role map", () => {
		// The per-role map alone would be read against THIS row's stale legacy
		// trio wherever a role leaves a field unset — see resolveIconAdjust.
		const { registry } = withFallback(
			{ iconAdjust: { regular: { offsetX: 3 } }, iconOffsetX: 7, iconOffsetY: 8, iconSize: 1.2 },
			[def({ id: "stale", source: "fallback", iconOffsetX: 99, iconSize: 0.5 })],
		);
		registry.restyleUncustomizedFallbackRows();
		const row = registry.get("stale");

		assert.deepStrictEqual(row?.iconAdjust, { regular: { offsetX: 3 } });
		assert.notStrictEqual(row?.iconAdjust, registry.get("base")?.iconAdjust);
		assert.strictEqual(row?.iconOffsetX, 7);
		assert.strictEqual(row?.iconOffsetY, 8);
		assert.strictEqual(row?.iconSize, 1.2);
	});

	it("leaves the row's own identity alone", () => {
		// It is a *style* mirror. Id, display name, aliases and source are the
		// row's own, or the settings list would collapse into one repeated row.
		const { registry } = withFallback({ displayName: "Base", aliases: ["bb"] }, [
			def({ id: "keep", displayName: "Keep", source: "fallback", aliases: ["kk"] }),
		]);
		registry.restyleUncustomizedFallbackRows();
		const row = registry.get("keep");

		assert.strictEqual(row?.id, "keep");
		assert.strictEqual(row?.displayName, "Keep");
		assert.deepStrictEqual(row?.aliases, ["kk"]);
		assert.strictEqual(row?.source, "fallback");
	});
});

describe("restyleUncustomizedFallbackRows — the callers that trigger it", () => {
	it("runs when the active fallback callout itself is edited", () => {
		const { registry } = withFallback();
		registry.update("base", { colorLight: "#00ff00" });
		assert.strictEqual(registry.get("f1")?.colorLight, "#00ff00");
	});

	it("does NOT run when some other callout is edited", () => {
		const { registry } = withFallback({}, [def({ id: "other", source: "user" })]);
		registry.update("other", { colorLight: "#00ff00" });
		assert.strictEqual(registry.get("f1")?.colorLight, "#336699", "still its own");
	});

	it("runs when a rename makes a callout the fallback target", () => {
		// `update` tests the NEW id against the setting, so renaming a row onto
		// the fallback id re-mirrors from it.
		const { registry } = loaded(
			saved([def({ id: "old", source: "user", colorLight: "#00ff00" }), def({ id: "f1", source: "fallback" })], {
				fallbackCalloutId: "base",
			}),
		);
		registry.update("old", { id: "base" });
		assert.strictEqual(registry.get("f1")?.colorLight, "#00ff00");
	});

	it("runs when the active fallback is deleted, after the id resets to the default", () => {
		const { registry } = withFallback();
		registry.remove("base");

		assert.strictEqual(
			registry.settings.fallbackCalloutId,
			DEFAULT_SETTINGS.fallbackCalloutId,
		);
		assert.strictEqual(
			registry.get("f1")?.colorLight,
			registry.get("note")?.colorLight,
		);
	});

	it("costs ONE change round on those paths, not two", () => {
		// The mirror pass notifies on its own and the caller notifies again, so
		// un-batched a single delete (or edit) regenerated the stylesheet,
		// repainted every icon and wrote data.json twice.
		const { registry, events } = withFallback();
		registry.remove("base");
		assert.strictEqual(events(), 1);
	});

	it("costs one round for an edit of the fallback callout too", () => {
		const { registry, events } = withFallback();
		registry.update("base", { colorLight: "#00ff00" });
		assert.strictEqual(events(), 1);
		assert.strictEqual(registry.get("f1")?.colorLight, "#00ff00", "still mirrored");
	});

	it("holds the mirrored rows back until the one event fires", () => {
		// The whole point of the batch: a listener must never see the fallback
		// deleted while the rows that copy it still wear its old style.
		const { registry } = withFallback();
		let seen: string | undefined;
		registry.onChange(() => {
			seen = registry.get("f1")?.colorLight;
		});
		registry.remove("base");

		assert.strictEqual(seen, registry.get("note")?.colorLight);
	});
});

describe("convertToFallback", () => {
	it("re-homes a user callout into the mirror and re-styles it at once", () => {
		const { registry } = withFallback({}, [
			def({ id: "mine", source: "user", customized: true }),
		]);

		assert.strictEqual(registry.convertToFallback("mine"), true);
		assert.strictEqual(registry.get("mine")?.source, "fallback");
		assert.strictEqual(registry.get("mine")?.colorLight, "#ff0000", "mirrored");
	});

	it("clears the sticky customized flag, or the mirror would skip it forever", () => {
		const { registry } = withFallback({}, [
			def({ id: "mine", source: "user", customized: true }),
		]);
		registry.convertToFallback("mine");

		assert.ok(!("customized" in (registry.get("mine") as object)), "deleted, not false");
	});

	it("announces the conversion and the re-style as one round", () => {
		const { registry, events } = withFallback({}, [
			def({ id: "mine", source: "user", customized: true }),
		]);
		assert.strictEqual(registry.convertToFallback("mine"), true);
		assert.strictEqual(events(), 1);
	});

	it("refuses a built-in", () => {
		const { registry, events } = withFallback();
		assert.strictEqual(registry.convertToFallback("note"), false);
		assert.strictEqual(events(), 0);
	});

	it("refuses the active fallback callout — it cannot mirror itself", () => {
		const { registry, events } = withFallback();
		assert.strictEqual(registry.convertToFallback("base"), false);
		assert.strictEqual(events(), 0);
	});

	it("refuses an id that does not exist", () => {
		const { registry, events } = withFallback();
		assert.strictEqual(registry.convertToFallback("nope"), false);
		assert.strictEqual(events(), 0);
	});
});

describe("setExternalStyle", () => {
	it("hands a callout to the user's own CSS and announces it", () => {
		const { registry, events } = loaded(saved([def({ id: "mine" })]));
		assert.strictEqual(registry.setExternalStyle("mine", true), true);
		assert.strictEqual(registry.get("mine")?.externalStyle, true);
		assert.strictEqual(events(), 1);
	});

	it("DELETES the key it is leaving, never writes a falsy one", () => {
		// `isModified` compares `JSON.stringify(value ?? null)`, so an explicit
		// `false` would leave a built-in nobody edited looking customized
		// forever — and being written to data.json forever with it.
		const { registry } = loaded(saved([def({ id: "mine", externalStyle: true })]));
		assert.strictEqual(registry.setExternalStyle("mine", false), true);
		assert.ok(!("externalStyle" in (registry.get("mine") as object)));
	});

	it("leaves a built-in pristine after a there-and-back trip", () => {
		// Coming back carries no field at all, which is what keeps an untouched
		// built-in out of data.json and out of "Reset to default".
		const { registry } = loaded(null);
		registry.setExternalStyle("note", true);
		registry.setExternalStyle("note", false);

		assert.strictEqual(registry.isBuiltInModified("note"), false);
		assert.deepStrictEqual(registry.toSaveData().callouts, []);
	});

	it("returns false and announces nothing when already there", () => {
		const { registry, events } = loaded(saved([def({ id: "mine" })]));
		assert.strictEqual(registry.setExternalStyle("mine", false), false);
		assert.strictEqual(events(), 0);

		registry.setExternalStyle("mine", true);
		assert.strictEqual(registry.setExternalStyle("mine", true), false);
		assert.strictEqual(events(), 1, "only the one real change");
	});

	it("has no special case for the active fallback callout", () => {
		// It used to refuse. `generateFallbackCSS` now asks the template
		// whether the plugin paints it and emits nothing when it does not, so
		// the contradiction the refusal guarded against no longer exists.
		const { registry } = withFallback();
		assert.strictEqual(registry.setExternalStyle("base", true), true);
		assert.strictEqual(registry.standsDown(registry.get("base")!), true);
		assert.strictEqual(registry.setExternalStyle("base", false), true);
	});

	it("returns false for an id that does not exist", () => {
		const { registry, events } = loaded(null);
		assert.strictEqual(registry.setExternalStyle("nope", true), false);
		assert.strictEqual(events(), 0);
	});

	it("says nothing about the theme, which is derived and not settable", () => {
		// The two were briefly one field. Keeping them apart is what lets an
		// External CSS row stay in the user's own section, keep its pencil, and
		// be handed back — none of which is true of a theme-owned callout.
		const { registry } = loaded(saved([def({ id: "mine" })]));
		registry.setExternalStyle("mine", true);
		assert.strictEqual(registry.themeOwns(registry.get("mine")!), false);
	});
});

describe("isBuiltInModified", () => {
	it("is false for every built-in straight out of the box", () => {
		const { registry } = loaded(null);
		for (const d of registry.getBuiltIn()) {
			assert.strictEqual(registry.isBuiltInModified(d.id), false, d.id);
		}
	});

	it("turns true on the first visible difference", () => {
		const { registry } = loaded(null);
		registry.update("note", { colorLight: "#ff0000" });
		assert.strictEqual(registry.isBuiltInModified("note"), true);
	});

	it("is false for a user callout — there is no default to compare against", () => {
		const { registry } = loaded(saved([def({ id: "mine" })]));
		assert.strictEqual(registry.isBuiltInModified("mine"), false);
	});

	it("is false for an id that does not exist", () => {
		const { registry } = loaded(null);
		assert.strictEqual(registry.isBuiltInModified("nope"), false);
	});

	it("answers about a row that squatted on a built-in id — now reclaimed as one", () => {
		// The comparison is keyed on the id rather than on the row's own
		// `builtIn`, which used to mean it answered "yes, modified" about a row
		// whose `builtIn` was false. `load()` reclaims such a row as the
		// built-in it names, so the two now agree.
		const { registry } = loaded(
			saved([def({ id: "note", displayName: "Mine", builtIn: false, source: "user" })]),
		);
		assert.strictEqual(registry.get("note")?.builtIn, true);
		assert.strictEqual(registry.isBuiltInModified("note"), true);
	});
});

describe("resetBuiltIn", () => {
	it("restores every field from the shipped default", () => {
		const { registry } = loaded(null);
		registry.update("note", {
			displayName: "Renamed",
			colorLight: "#ff0000",
			hideIcon: true,
			aliases: ["nn"],
		});

		assert.strictEqual(registry.resetBuiltIn("note"), true);
		const note = registry.get("note");
		assert.strictEqual(note?.displayName, "Note");
		assert.strictEqual(note?.colorLight, "#086ddd");
		assert.strictEqual(note?.hideIcon, undefined);
		assert.strictEqual(note?.aliases, undefined);
		assert.strictEqual(registry.isBuiltInModified("note"), false);
	});

	it("restores the aliases a built-in ships with", () => {
		const { registry } = loaded(null);
		registry.update("abstract", { aliases: ["mine"] });
		registry.resetBuiltIn("abstract");
		assert.deepStrictEqual(registry.get("abstract")?.aliases, ["summary", "tldr"]);
	});

	it("stores a clone, so a later edit cannot reach back into the defaults", () => {
		const { registry } = loaded(null);
		registry.resetBuiltIn("abstract");
		registry.update("abstract", { aliases: ["mine"] });

		assert.deepStrictEqual(registry.getBuiltInDefault("abstract")?.aliases, [
			"summary",
			"tldr",
		]);
	});

	it("announces the change", () => {
		const { registry, events } = loaded(null);
		registry.resetBuiltIn("note");
		assert.strictEqual(events(), 1);
	});

	it("returns false for anything that is not one of the 13", () => {
		const { registry, events } = loaded(saved([def({ id: "mine" })]));
		assert.strictEqual(registry.resetBuiltIn("mine"), false);
		assert.strictEqual(registry.resetBuiltIn("nope"), false);
		assert.strictEqual(events(), 0);
	});

	it("clears the edit a saved row had carried onto a built-in id", () => {
		// `load()` reclaims such a row as the built-in it names, keeping its
		// edit; this is the user throwing that edit away.
		const { registry } = loaded(
			saved([def({ id: "note", displayName: "Mine", builtIn: false, source: "user" })]),
		);
		assert.strictEqual(registry.resetBuiltIn("note"), true);
		assert.strictEqual(registry.get("note")?.displayName, "Note");
		assert.strictEqual(registry.get("note")?.builtIn, true);
		assert.strictEqual(registry.getBuiltIn().length, 13);
	});
});
