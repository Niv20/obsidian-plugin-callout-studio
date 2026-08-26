/**
 * tests/publicApi.test.ts — the four methods behind
 * `app.plugins.plugins["callout-studio"].api`.
 *
 * This is the one surface with consumers the plugin cannot see, so its bugs are
 * the kind nobody reports: another plugin holds a definition, writes to it, and
 * the user's styling changes with no re-inject and no save. The file is
 * organised around the two invariants `PluginAPI.ts` exists to enforce, both of
 * which had been broken before:
 *
 * - **Nothing live escapes.** Every return value is a frozen copy built by the
 *   mappers at the bottom of that file. The registry stores the real objects
 *   the renderer reads on every paint.
 * - **`usableDefinitions()` is the only list.** `getCallout(id)` resolves
 *   through the registry ladder and then *re-finds the result in that list by
 *   id*, which is what keeps a lookup from answering with something the list
 *   will not show — the transient live-preview row, or a discovered id the user
 *   deleted from their notes hours ago.
 *
 * The contract-shaped items — the member count, and `version` against API.md —
 * live in publicApiContract.test.ts instead.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { apiHarness, definition, discovered, ids } from "./support/apiHarness";
import type { CalloutDefinition } from "../src/types";

/** The 13 shipped callouts, in the order the API sorts them (by title). */
const BUILT_IN_IDS = [
	"abstract",
	"bug",
	"danger",
	"example",
	"failure",
	"info",
	"note",
	"question",
	"quote",
	"success",
	"tip",
	"todo",
	"warning",
];

/* -------------------------------------------------------------------------- */
/* 96 — nothing live escapes                                                  */
/* -------------------------------------------------------------------------- */

describe("getCallouts — every value is frozen", () => {
	it("freezes the list itself", () => {
		const { api } = apiHarness();
		const list = api.getCallouts();
		assert.ok(Object.isFrozen(list));
		assert.throws(() => {
			(list as unknown as unknown[]).push({});
		}, TypeError);
	});

	it("freezes every callout in it", () => {
		const { api } = apiHarness();
		for (const callout of api.getCallouts()) {
			assert.ok(Object.isFrozen(callout), `${callout.id} was not frozen`);
			assert.ok(
				Object.isFrozen(callout.aliases),
				`${callout.id}'s aliases were not frozen`,
			);
		}
	});

	it("refuses a write to a returned callout", () => {
		// The bundle is ESM, so every assignment here runs in strict mode and a
		// frozen target throws rather than failing silently — which is the
		// whole point of freezing rather than merely copying.
		const { api } = apiHarness();
		const [first] = api.getCallouts();
		assert.ok(first);
		assert.throws(() => {
			(first as { title: string }).title = "Hacked";
		}, TypeError);
		assert.throws(() => {
			(first.aliases as string[]).push("hacked");
		}, TypeError);
	});
});

describe("getCallouts — every value is a copy", () => {
	it("hands out no object the registry is holding", () => {
		const { api, registry } = apiHarness();
		registry.add(definition({ aliases: ["hush"] }));
		const live = new Set<unknown>(registry.getAll());
		for (const callout of api.getCallouts()) {
			assert.ok(!live.has(callout), `${callout.id} was the live definition`);
		}
	});

	it("copies the alias array rather than sharing it", () => {
		const { api, registry } = apiHarness();
		registry.add(definition({ aliases: ["hush", "shh"] }));
		const [mine] = api.getCallouts().filter((c) => c.id === "quiet");
		assert.deepStrictEqual([...(mine?.aliases ?? [])], ["hush", "shh"]);
		assert.notEqual(mine?.aliases, registry.get("quiet")?.aliases);
	});

	it("builds a fresh copy on every call", () => {
		// Two consumers must not be able to hand each other state through the
		// API, and one that caches a result must not see it change underfoot.
		const { api } = apiHarness();
		const first = api.getCallouts();
		const second = api.getCallouts();
		assert.notEqual(first, second);
		assert.notEqual(first[0], second[0]);
		assert.deepStrictEqual(ids(first), ids(second));
	});

	it("leaves an already-returned result alone when the registry moves on", () => {
		// The proof that it is a snapshot and not a view: mutate the live
		// definition the way the renderer would find it, and the frozen copy a
		// consumer is still holding must not follow.
		const { api, registry } = apiHarness();
		registry.add(definition({ aliases: ["hush"] }));
		const before = api.getCallouts().find((c) => c.id === "quiet");
		const live = registry.get("quiet") as CalloutDefinition;
		live.displayName = "Loud";
		live.aliases?.push("shout");
		assert.equal(before?.title, "Quiet");
		assert.deepStrictEqual([...(before?.aliases ?? [])], ["hush"]);
		assert.equal(api.getCallouts().find((c) => c.id === "quiet")?.title, "Loud");
	});

	it("cannot be used to reach the registry at all", () => {
		// The failure this method exists to prevent: a consumer writes to what
		// it was handed and the user's styling changes with no re-inject and no
		// save. The write throws, and the registry is untouched either way.
		const { api, registry } = apiHarness();
		const note = api.getCallout("note");
		assert.throws(() => {
			(note as { title: string }).title = "Hacked";
		}, TypeError);
		assert.equal(registry.get("note")?.displayName, "Note");
	});
});

describe("getCalloutsDetailed — every value is frozen and copied", () => {
	it("freezes the list, each row, its aliases and its icon", () => {
		const { api } = apiHarness();
		const list = api.getCalloutsDetailed();
		assert.ok(Object.isFrozen(list));
		for (const details of list) {
			assert.ok(Object.isFrozen(details), `${details.id} was not frozen`);
			assert.ok(Object.isFrozen(details.aliases));
			assert.ok(Object.isFrozen(details.icon), `${details.id}'s icon`);
		}
	});

	it("hands out no icon object the registry is holding", () => {
		// `icon` is the one nested object in the shape, so it is the one that
		// could be shared by accident — and the renderer reads it on every paint.
		const { api, registry } = apiHarness();
		const live = new Set<unknown>(registry.getAll().map((d) => d.icon));
		for (const details of api.getCalloutsDetailed()) {
			assert.ok(!live.has(details.icon), `${details.id} shared its icon`);
		}
	});

	it("refuses a write to a returned row or its icon", () => {
		const { api, registry } = apiHarness();
		const [first] = api.getCalloutsDetailed();
		assert.ok(first);
		assert.throws(() => {
			(first as { colorLight: string }).colorLight = "#000000";
		}, TypeError);
		assert.throws(() => {
			(first.icon as { name: string }).name = "skull";
		}, TypeError);
		assert.notEqual(registry.get(first.id)?.icon.value, "skull");
	});

	it("builds a fresh copy on every call", () => {
		const { api } = apiHarness();
		const first = api.getCalloutsDetailed();
		const second = api.getCalloutsDetailed();
		assert.notEqual(first, second);
		assert.notEqual(first[0], second[0]);
		assert.notEqual(first[0]?.icon, second[0]?.icon);
	});
});

describe("getCalloutsDetailed — what a row carries", () => {
	it("resolves `color` to the theme currently on screen", () => {
		const { api, registry, theme } = apiHarness();
		registry.add(definition({ colorLight: "#111111", colorDark: "#eeeeee" }));

		const light = api.getCalloutsDetailed().find((d) => d.id === "quiet");
		assert.equal(light?.color, "#111111");
		assert.equal(light?.colorLight, "#111111");
		assert.equal(light?.colorDark, "#eeeeee");

		theme.dark();
		const dark = api.getCalloutsDetailed().find((d) => d.id === "quiet");
		assert.equal(dark?.color, "#eeeeee");
		// The authored pair is reported unchanged either way — `color` is the
		// convenience, not a replacement for the two.
		assert.equal(dark?.colorLight, "#111111");
		assert.equal(dark?.colorDark, "#eeeeee");
	});

	it("leaves an unauthored background absent rather than undefined", () => {
		// "No authored background" is a real state that means Obsidian's own
		// tint applies, and a consumer using `in` or `Object.keys` has to be
		// able to tell it apart from a background that was set.
		const { api } = apiHarness();
		const note = api.getCalloutsDetailed().find((d) => d.id === "note");
		assert.ok(note);
		for (const key of [
			"bgColorLight",
			"bgColorDark",
			"textColorLight",
			"textColorDark",
		]) {
			assert.ok(!(key in note), `${key} should be absent, not undefined`);
		}
	});

	it("reports an authored background and text colour when there is one", () => {
		const { api, registry } = apiHarness();
		registry.add(
			definition({
				bgColorLight: "#fafafa",
				bgColorDark: "#0a0a0a",
				textColorLight: "#202020",
				textColorDark: "#f0f0f0",
			}),
		);
		const mine = api.getCalloutsDetailed().find((d) => d.id === "quiet");
		assert.equal(mine?.bgColorLight, "#fafafa");
		assert.equal(mine?.bgColorDark, "#0a0a0a");
		assert.equal(mine?.textColorLight, "#202020");
		assert.equal(mine?.textColorDark, "#f0f0f0");
	});

	it("normalizes the true-or-absent flags to real booleans", () => {
		// `hideIcon` and `externalStyle` are stored `true`-or-absent internally.
		// A consumer told they are `boolean` must never be handed `undefined`.
		const { api, registry } = apiHarness();
		registry.add(definition({ id: "plain" }));
		registry.add(
			definition({ id: "bare", hideIcon: true, externalStyle: true }),
		);
		const detailed = api.getCalloutsDetailed();
		const plain = detailed.find((d) => d.id === "plain");
		const bare = detailed.find((d) => d.id === "bare");
		assert.equal(plain?.hideIcon, false);
		assert.equal(plain?.externalStyle, false);
		assert.equal(bare?.hideIcon, true);
		assert.equal(bare?.externalStyle, true);
	});

	it("still names the drawing of a callout whose icon is hidden", () => {
		// Deliberate: `icon` keeps holding the last drawing so the choice stays
		// undoable. `hideIcon` is what a consumer checks before drawing it.
		const { api, registry } = apiHarness();
		registry.add(
			definition({
				id: "bare",
				hideIcon: true,
				icon: { type: "lucide", value: "star" },
			}),
		);
		const bare = api.getCalloutsDetailed().find((d) => d.id === "bare");
		assert.equal(bare?.hideIcon, true);
		assert.deepStrictEqual({ ...bare?.icon }, { pack: "lucide", name: "star" });
	});

	it("carries Material's style and weight, and omits them for other packs", () => {
		const { api, registry } = apiHarness();
		registry.add(
			definition({
				id: "mat",
				icon: {
					type: "material",
					value: "rocket",
					style: "rounded",
					weight: 500,
				},
			}),
		);
		registry.add(
			definition({ id: "luc", icon: { type: "lucide", value: "star" } }),
		);
		const detailed = api.getCalloutsDetailed();
		const mat = detailed.find((d) => d.id === "mat");
		const luc = detailed.find((d) => d.id === "luc");
		assert.deepStrictEqual(
			{ ...mat?.icon },
			{ pack: "material", name: "rocket", style: "rounded", weight: 500 },
		);
		assert.ok(luc?.icon && !("style" in luc.icon));
		assert.ok(luc?.icon && !("weight" in luc.icon));
	});

	it("reports a weight of zero rather than dropping it", () => {
		// `weight` is guarded on `!== undefined`, not on truthiness. Guarding on
		// truthiness would silently swallow a real value.
		const { api, registry } = apiHarness();
		registry.add(
			definition({
				id: "mat",
				icon: { type: "material", value: "rocket", weight: 0 },
			}),
		);
		const mat = api.getCalloutsDetailed().find((d) => d.id === "mat");
		assert.equal(mat?.icon.weight, 0);
	});

	it("passes `source` and `builtIn` through untranslated", () => {
		const { api, registry } = apiHarness();
		registry.add(definition({ id: "theirs", source: "theme" }));
		const detailed = api.getCalloutsDetailed();
		const note = detailed.find((d) => d.id === "note");
		const theirs = detailed.find((d) => d.id === "theirs");
		assert.equal(note?.builtIn, true);
		assert.equal(note?.source, "builtin");
		assert.equal(theirs?.builtIn, false);
		assert.equal(theirs?.source, "theme");
	});

	it("lists the same callouts, in the same order, as getCallouts", () => {
		const { api, registry } = apiHarness();
		registry.add(definition());
		registry.add(definition({ id: "loud", displayName: "Loud" }));
		assert.deepStrictEqual(
			ids(api.getCalloutsDetailed()),
			ids(api.getCallouts()),
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 97 — getCallout(id)                                                        */
/* -------------------------------------------------------------------------- */

describe("getCallout — the forgiving lookups API.md promises", () => {
	it("finds a callout by its id", () => {
		const { api } = apiHarness();
		assert.equal(api.getCallout("abstract")?.title, "Abstract");
	});

	it("finds one by an alias", () => {
		const { api } = apiHarness();
		assert.equal(api.getCallout("tldr")?.id, "abstract");
		assert.equal(api.getCallout("summary")?.id, "abstract");
		assert.equal(api.getCallout("cite")?.id, "quote");
	});

	it("is case-insensitive", () => {
		const { api } = apiHarness();
		assert.equal(api.getCallout("WARNING")?.id, "warning");
		assert.equal(api.getCallout("TlDr")?.id, "abstract");
	});

	it("trims and collapses whitespace", () => {
		const { api, registry } = apiHarness();
		registry.add(definition({ id: "multi word", displayName: "Multi word" }));
		assert.equal(api.getCallout("  note  ")?.id, "note");
		assert.equal(api.getCallout("multi   word")?.id, "multi word");
	});

	it("accepts the dashed spelling Obsidian writes into data-callout", () => {
		// `> [!multi word]` and `> [!multi-word]` both render to
		// `data-callout="multi-word"`, so a consumer reading that attribute back
		// has to be able to look the definition up with it.
		const { api, registry } = apiHarness();
		registry.add(definition({ id: "multi word", displayName: "Multi word" }));
		assert.equal(api.getCallout("multi-word")?.id, "multi word");
	});

	it("resolves an alias through its dashed spelling too", () => {
		const { api, registry } = apiHarness();
		registry.add(definition({ id: "quiet", aliases: ["hush now"] }));
		assert.equal(api.getCallout("hush-now")?.id, "quiet");
	});

	it("strips `|metadata` before looking anything up", () => {
		// Obsidian splits the header at the FIRST pipe, so `> [!note|purple]` is
		// the `note` callout carrying metadata — not a callout named `note|purple`.
		const { api } = apiHarness();
		assert.equal(api.getCallout("note|purple")?.id, "note");
		assert.equal(api.getCallout("tldr|left")?.id, "abstract");
		assert.equal(api.getCallout("note|")?.id, "note");
		assert.equal(api.getCallout("note|a|b")?.id, "note");
	});

	it("strips metadata before the case and whitespace pass, not after", () => {
		const { api } = apiHarness();
		assert.equal(api.getCallout("  NOTE  |Purple")?.id, "note");
	});

	it("never invents a callout for an id nobody defined", () => {
		// The renderer substitutes the fallback callout for an unknown id
		// because it still has to draw something. An API that answered every id
		// with a definition would be useless for asking whether one exists.
		const { api, registry } = apiHarness();
		assert.equal(api.getCallout("nope"), undefined);
		assert.equal(api.getCallout(""), undefined);
		assert.equal(api.getCallout("   "), undefined);
		assert.equal(api.getCallout("|purple"), undefined);
		// …and specifically not the configured fallback, which is what the
		// renderer would have drawn.
		assert.equal(registry.settings.fallbackCalloutId, "note");
	});

	it("returns a frozen copy, exactly like the list does", () => {
		const { api, registry } = apiHarness();
		const note = api.getCallout("note");
		assert.ok(note && Object.isFrozen(note));
		assert.ok(Object.isFrozen(note.aliases));
		assert.notEqual(note, registry.get("note"));
	});

	it("reports the resolved callout's own id, not the spelling asked for", () => {
		const { api } = apiHarness();
		assert.equal(api.getCallout("tldr")?.id, "abstract");
		assert.equal(api.getCallout("NOTE|x")?.id, "note");
	});
});

describe("getCallout — only ever answers with what the list shows", () => {
	it("refuses a discovered row the last scan found written nowhere", () => {
		// The row is genuinely in the registry — `registry.get` finds it — but
		// the published list drops it, and the lookup has to agree.
		const { api, registry, zeroUsage } = apiHarness();
		registry.add(discovered("gone"));
		assert.ok(registry.get("gone"));
		assert.equal(api.getCallout("gone")?.id, "gone");

		zeroUsage.add("gone");
		assert.ok(registry.get("gone"), "the row itself must survive");
		assert.equal(api.getCallout("gone"), undefined);
	});

	it("keeps a discovered row the user adopted, even at zero usage", () => {
		const { api, registry, zeroUsage } = apiHarness();
		registry.add(discovered("mine", { customized: true }));
		zeroUsage.add("mine");
		assert.equal(api.getCallout("mine")?.id, "mine");
	});

	it("refuses a dropped row asked for by alias as well", () => {
		// The ladder resolves the alias first and the list check runs second,
		// so both spellings have to give the same answer.
		const { api, registry, zeroUsage } = apiHarness();
		registry.add(discovered("gone", { aliases: ["vanished"] }));
		zeroUsage.add("gone");
		assert.equal(api.getCallout("vanished"), undefined);
	});

	it("refuses the callout editor's in-progress draft of a new type", () => {
		// A brand-new callout being typed into the editor is registered as a
		// transient preview so it renders live. It is not a callout the user can
		// write anywhere yet, so it must not be answerable.
		const { api, registry } = apiHarness();
		registry.setPreviewDefinition(definition({ id: "draft" }));
		assert.ok(registry.get("draft"), "the preview really is in the map");
		assert.equal(api.getCallout("draft"), undefined);
	});

	it("refuses the style popups' demo callout", () => {
		const { api, registry } = apiHarness();
		registry.setPreviewDefinition(definition({ id: "cs-preview" }), true);
		assert.ok(registry.get("cs-preview"));
		assert.equal(api.getCallout("cs-preview"), undefined);
	});

	it("answers with the real callout a demo preview is shadowing", () => {
		// The demo placeholder reuses the built-in `example` id. Re-finding the
		// resolved row *in the published list by id* is exactly what swaps the
		// real built-in back in here — returning `resolved` directly would hand
		// out the demo's colours as if the user had chosen them.
		const { api, registry } = apiHarness();
		registry.setPreviewDefinition(
			definition({ id: "example", displayName: "DEMO", colorLight: "#123456" }),
			true,
		);
		const example = api.getCallout("example");
		assert.equal(example?.title, "Example");
		const detailed = api
			.getCalloutsDetailed()
			.find((d) => d.id === "example");
		assert.equal(detailed?.colorLight, "#7852ee");
	});

	it("is answerable again once the preview is taken down", () => {
		const { api, registry } = apiHarness();
		registry.setPreviewDefinition(definition({ id: "draft" }));
		assert.equal(api.getCallout("draft"), undefined);
		registry.setPreviewDefinition(null);
		assert.equal(api.getCallout("draft"), undefined);
		registry.add(definition({ id: "draft" }));
		assert.equal(api.getCallout("draft")?.id, "draft");
	});

	it("hides an in-progress edit of an EXISTING callout", () => {
		// The settings rows track the open editor keystroke by keystroke, and a
		// non-demo preview passes through the registry's list view as-is so they
		// can. An outside consumer must not see it: the API is the committed
		// state, and `usableDefinitions` reads every row through `getReal`.
		const { api, registry } = apiHarness();
		registry.add(definition({ id: "quiet", displayName: "Quiet" }));
		const before = ids(api.getCallouts());

		registry.setPreviewDefinition(
			definition({ id: "quiet", displayName: "Quiet (draft)" }),
		);
		assert.deepStrictEqual(ids(api.getCallouts()), before, "no row appeared");
		assert.equal(api.getCallout("quiet")?.title, "Quiet");

		registry.setPreviewDefinition(null);
		assert.equal(api.getCallout("quiet")?.title, "Quiet");
	});

	it("hides a draft's colours from the detailed list too", () => {
		// The same window, seen through the surface that actually carries the
		// styling. A consumer painting a swatch per callout would otherwise
		// track the colour picker live and keep whatever it happened to read.
		const { api, registry } = apiHarness();
		registry.add(definition({ id: "quiet", colorLight: "#336699" }));

		registry.setPreviewDefinition(
			definition({ id: "quiet", colorLight: "#ff0000" }),
		);
		const detailed = api.getCalloutsDetailed().find((d) => d.id === "quiet");
		assert.equal(detailed?.colorLight, "#336699");
	});

	it("never answers with a draft a cancelled edit threw away", () => {
		// Why the window matters at all. A preview fires no `onChange`, and so
		// does taking one down — so a consumer that re-read the list mid-edit
		// (any unrelated mutation prompts one) would cache the draft title and
		// never be told the user pressed Cancel.
		const { api, registry } = apiHarness();
		registry.add(definition({ id: "quiet", displayName: "Quiet" }));

		registry.setPreviewDefinition(
			definition({ id: "quiet", displayName: "Never saved" }),
		);
		// Something unrelated changes, so the consumer re-reads.
		registry.add(definition({ id: "other", displayName: "Other" }));
		const seen = api.getCallouts().find((c) => c.id === "quiet");

		registry.setPreviewDefinition(null);
		assert.equal(seen?.title, "Quiet");
		assert.equal(api.getCallout("quiet")?.title, "Quiet");
	});
});

/* -------------------------------------------------------------------------- */
/* 98 — usableDefinitions is the only list                                    */
/* -------------------------------------------------------------------------- */

describe("the published list — what is in it", () => {
	it("carries all 13 built-ins on a registry nobody has touched", () => {
		// They are seeded into the map on every load, so all of Obsidian's own
		// types belong in any list a consumer shows — customized or not.
		const { api } = apiHarness();
		assert.deepStrictEqual(ids(api.getCallouts()), BUILT_IN_IDS);
	});

	it("sorts by title, not by id", () => {
		const { api, registry } = apiHarness();
		registry.add(definition({ id: "zulu", displayName: "Aardvark" }));
		registry.add(definition({ id: "alpha", displayName: "Zebra" }));
		const list = ids(api.getCallouts());
		assert.equal(list[0], "zulu");
		assert.equal(list[list.length - 1], "alpha");
	});

	it("includes user, theme-provided and plugin rows alongside the built-ins", () => {
		const { api, registry } = apiHarness();
		registry.add(definition({ id: "mine", source: "user" }));
		registry.add(definition({ id: "theirs", source: "theme" }));
		registry.add(definition({ id: "other", source: "plugin" }));
		const list = ids(api.getCallouts());
		for (const id of ["mine", "theirs", "other", ...BUILT_IN_IDS]) {
			assert.ok(list.includes(id), `${id} was missing`);
		}
	});

	it("includes a callout handed over to the user's theme", () => {
		// Callout Studio stops styling an `externalStyle` callout, but the id is
		// still perfectly valid to write into a note.
		const { api, registry } = apiHarness();
		registry.add(definition({ id: "themed", externalStyle: true }));
		assert.ok(ids(api.getCallouts()).includes("themed"));
	});

	it("returns a new array on every call", () => {
		const { api } = apiHarness();
		assert.notEqual(api.getCallouts(), api.getCallouts());
	});
});

describe("the published list — what is dropped from it", () => {
	it("drops a discovered row the last scan found written nowhere", () => {
		const { api, registry, zeroUsage } = apiHarness();
		registry.add(discovered("gone"));
		assert.ok(ids(api.getCallouts()).includes("gone"));
		zeroUsage.add("gone");
		assert.ok(!ids(api.getCallouts()).includes("gone"));
	});

	it("keeps a discovered row that is still written somewhere", () => {
		const { api, registry } = apiHarness();
		registry.add(discovered("seen"));
		assert.ok(ids(api.getCallouts()).includes("seen"));
	});

	it("keeps a discovered row the user customized", () => {
		const { api, registry, zeroUsage } = apiHarness();
		registry.add(discovered("mine", { customized: true }));
		zeroUsage.add("mine");
		assert.ok(ids(api.getCallouts()).includes("mine"));
	});

	it("asks the plugin about discovered rows only", () => {
		// The usage lookup is a map the plugin only populates after a completed
		// scan; asking about a built-in would be a question with no meaningful
		// answer, and the source check is what short-circuits it.
		const { api, registry, usageQueries } = apiHarness();
		registry.add(definition({ id: "mine", source: "user" }));
		registry.add(discovered("found"));
		registry.add(discovered("adopted", { customized: true }));
		usageQueries.length = 0;
		api.getCallouts();
		assert.deepStrictEqual(usageQueries, ["found"]);
	});

	it("drops the callout editor's draft of a new type", () => {
		const { api, registry } = apiHarness();
		const before = ids(api.getCallouts());
		registry.setPreviewDefinition(definition({ id: "draft" }));
		assert.deepStrictEqual(ids(api.getCallouts()), before);
		assert.deepStrictEqual(ids(api.getCalloutsDetailed()), before);
	});

	it("drops a demo preview that occupies a fresh id", () => {
		const { api, registry } = apiHarness();
		const before = ids(api.getCallouts());
		registry.setPreviewDefinition(definition({ id: "cs-preview" }), true);
		assert.deepStrictEqual(ids(api.getCallouts()), before);
	});

	it("lets a demo preview neither add nor displace the row it shadows", () => {
		const { api, registry } = apiHarness();
		registry.setPreviewDefinition(
			definition({ id: "example", displayName: "DEMO" }),
			true,
		);
		const list = api.getCallouts();
		assert.deepStrictEqual(ids(list), BUILT_IN_IDS);
		assert.equal(list.find((c) => c.id === "example")?.title, "Example");
	});

	it("drops a draft that shares its id with a dropped discovered row", () => {
		// Both filters have to hold at once: the preview is unshadowed *and*
		// the id is one the scan retired. Neither alone may let it back in.
		const { api, registry, zeroUsage } = apiHarness();
		zeroUsage.add("draft");
		registry.setPreviewDefinition(definition({ id: "draft" }));
		assert.ok(!ids(api.getCallouts()).includes("draft"));
	});
});

/* -------------------------------------------------------------------------- */
/* 99 — onChange                                                              */
/* -------------------------------------------------------------------------- */

describe("onChange — subscribing", () => {
	it("fires on an add, an update and a remove", () => {
		const { api, registry } = apiHarness();
		let fired = 0;
		api.onChange(() => fired++);

		registry.add(definition());
		assert.equal(fired, 1);
		registry.update("quiet", { displayName: "Loud" });
		assert.equal(fired, 2);
		registry.remove("quiet");
		assert.equal(fired, 3);
	});

	it("receives no arguments — the consumer re-reads the list", () => {
		const { api, registry } = apiHarness();
		const seen: unknown[][] = [];
		api.onChange((...args: unknown[]) => seen.push(args));
		registry.add(definition());
		assert.deepStrictEqual(seen, [[]]);
	});

	it("fires once for a whole batch", () => {
		const { api, registry } = apiHarness();
		let fired = 0;
		api.onChange(() => fired++);
		registry.batch(() => {
			registry.add(definition({ id: "a", displayName: "A" }));
			registry.add(definition({ id: "b", displayName: "B" }));
			registry.add(definition({ id: "c", displayName: "C" }));
		});
		assert.equal(fired, 1);
	});

	it("stays silent for a preview, which is not a mutation", () => {
		// A preview must never reach the `onChange` → `saveSettings` path, or
		// every keystroke in the callout editor would write data.json and force
		// every open note to re-render.
		const { api, registry } = apiHarness();
		let fired = 0;
		api.onChange(() => fired++);
		registry.setPreviewDefinition(definition({ id: "draft" }));
		registry.setPreviewDefinition(null);
		assert.equal(fired, 0);
	});
});

describe("onChange — the unsubscribe really detaches", () => {
	it("stops the callback firing", () => {
		const { api, registry } = apiHarness();
		let fired = 0;
		const off = api.onChange(() => fired++);

		registry.add(definition({ id: "a", displayName: "A" }));
		assert.equal(fired, 1);

		off();
		registry.add(definition({ id: "b", displayName: "B" }));
		registry.update("b", { displayName: "B2" });
		registry.remove("b");
		assert.equal(fired, 1);
	});

	it("hands back a distinct unsubscribe per subscription", () => {
		const { api } = apiHarness();
		const noop = (): void => {};
		assert.notEqual(api.onChange(noop), api.onChange(noop));
	});

	it("detaches by identity, not by position", () => {
		// The middle one, so an implementation that spliced a captured index
		// would take the wrong listener out.
		const { api, registry } = apiHarness();
		const fired: string[] = [];
		api.onChange(() => fired.push("a"));
		const offB = api.onChange(() => fired.push("b"));
		api.onChange(() => fired.push("c"));

		offB();
		registry.add(definition());
		assert.deepStrictEqual(fired, ["a", "c"]);
	});

	it("removes one registration when the same function subscribed twice", () => {
		// Two subscriptions of one function are two listeners, so one
		// unsubscribe must retire exactly one of them.
		const { api, registry } = apiHarness();
		let fired = 0;
		const cb = (): void => void fired++;
		const off1 = api.onChange(cb);
		api.onChange(cb);

		registry.add(definition({ id: "a", displayName: "A" }));
		assert.equal(fired, 2);

		off1();
		registry.add(definition({ id: "b", displayName: "B" }));
		assert.equal(fired, 3);
	});

	it("is harmless to call twice", () => {
		const { api, registry } = apiHarness();
		const fired: string[] = [];
		const off = api.onChange(() => fired.push("mine"));
		api.onChange(() => fired.push("theirs"));

		off();
		assert.doesNotThrow(() => off());
		registry.add(definition());
		assert.deepStrictEqual(fired, ["theirs"]);
	});

	it("leaves the plugin's own registry listeners alone", () => {
		// main.ts subscribes directly for the `saveSettings` + re-inject pass. A
		// consumer unsubscribing must not be able to switch that off.
		const { api, registry } = apiHarness();
		let internal = 0;
		registry.onChange(() => internal++);
		const off = api.onChange(() => {});

		off();
		registry.add(definition());
		assert.equal(internal, 1);
	});

	it("takes effect when called from inside the callback itself", () => {
		const { api, registry } = apiHarness();
		let fired = 0;
		const off = api.onChange(() => {
			fired++;
			off();
		});

		registry.add(definition({ id: "a", displayName: "A" }));
		registry.add(definition({ id: "b", displayName: "B" }));
		registry.add(definition({ id: "c", displayName: "C" }));
		assert.equal(fired, 1);
	});

	it("does not cost the next listener its turn when one unsubscribes itself", () => {
		// `notifyChange` used to iterate the live array, so removing the running
		// listener shifted everything after it down one while the iterator index
		// had already moved up — and the very next listener was passed over for
		// that round. Two plugins subscribing is enough: whether the second one
		// hears about an add depended on what the first one did.
		const { api, registry } = apiHarness();
		const fired: string[] = [];
		const off = api.onChange(() => {
			fired.push("first");
			off();
		});
		api.onChange(() => fired.push("second"));

		registry.add(definition());
		assert.deepStrictEqual(fired, ["first", "second"]);
	});

	it("skips every listener a callback unsubscribed, not just its own", () => {
		// The snapshot must not go the other way either: a listener taken off
		// during the round is gone, even though the copy still names it. Here
		// the first callback retires both of the ones behind it.
		const { api, registry } = apiHarness();
		const fired: string[] = [];
		api.onChange(() => {
			fired.push("first");
			offB();
			offC();
		});
		const offB = api.onChange(() => fired.push("second"));
		const offC = api.onChange(() => fired.push("third"));

		registry.add(definition());
		assert.deepStrictEqual(fired, ["first"]);
	});

	it("does not call a listener subscribed from inside the same round", () => {
		// The mirror image. Appending to the live array mid-iteration would run
		// the newcomer immediately, before the mutation it is watching has
		// finished settling — and it would see the round it was not there for.
		const { api, registry } = apiHarness();
		const fired: string[] = [];
		api.onChange(() => {
			fired.push("first");
			api.onChange(() => fired.push("late"));
		});

		registry.add(definition({ id: "a", displayName: "A" }));
		assert.deepStrictEqual(fired, ["first"], "the newcomer waits for the next");

		registry.add(definition({ id: "b", displayName: "B" }));
		assert.deepStrictEqual(fired, ["first", "first", "late"]);
	});
});
