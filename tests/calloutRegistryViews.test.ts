/**
 * tests/calloutRegistryViews.test.ts — the four list views, and the one row
 * that must never leak into three of them.
 *
 * The callout editor renders its Live Preview through the *real* pipeline, so
 * the in-progress draft is registered in the very map everything else reads. It
 * has to be there — `getAll()` is what CSSInjector generates from, and a
 * preview invisible to the injector would not preview anything. Everywhere
 * else it is a lie, and two separate guards keep it out:
 *
 * - `definitionsForLists()` substitutes the shadowed reality for a **demo**
 *   preview (the palette editor, the global-style popups, an unnamed draft),
 *   which must neither add a phantom row nor displace a real callout it happens
 *   to overlay.
 * - `isUnshadowedPreview()` drops a preview standing in for **nothing** — a
 *   brand-new callout being typed — from the user list, since it is not a
 *   callout yet.
 *
 * A *non-demo* preview of an existing callout passes through on purpose: that
 * row should track the edit live. It can still never change sections, because
 * `withIdentityOf` re-stamps it with the shadowed callout's ownership fields on
 * the way into the map.
 *
 * The views themselves split three ways and the split is load-bearing:
 * `getAll()` is the raw map (render pipeline), `getUserDefined()` is the
 * settings list and the legacy public export, and `getExportableDefinitions()`
 * adds modified built-ins — because recolouring `[!note]` is no less the user's
 * work than creating a callout, and leaving it out made "export" quietly not
 * mean "back up my callouts".
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	CalloutRegistry,
	EXPORT_FORMAT_ID,
	EXPORT_FORMAT_VERSION,
} from "../src/manager/CalloutRegistry";
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

function saved(callouts: CalloutDefinition[]): Partial<PluginData> {
	return { callouts } as Partial<PluginData>;
}

function loaded(data: Partial<PluginData> | null = null): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(data);
	return registry;
}

const ids = (defs: CalloutDefinition[]): string[] => defs.map((d) => d.id).sort();

describe("getAll / getUserDefined / getExportableDefinitions — the plain case", () => {
	it("getAll is the raw map: every built-in plus everything the user has", () => {
		const registry = loaded(saved([def({ id: "mine" }), def({ id: "found", source: "fallback" })]));
		assert.strictEqual(registry.getAll().length, 15);
	});

	it("getUserDefined is the user's own rows — not the theme's", () => {
		// `source: "theme"` rows are minted from the active theme's stylesheet,
		// so they are excluded here and answered by `getThemeProvided()`. This
		// view feeds backups, `exportToJSON()` and the reset sweep, none of
		// which should treat the theme's callout types as the user's work.
		//
		// Added after load, not through it: a `"theme"` row arriving in
		// `data.json` predates that meaning and is re-homed to `"user"` on the
		// way in (see manager/styleModeMigration.ts).
		const registry = loaded(
			saved([
				def({ id: "mine", source: "user" }),
				def({ id: "found", source: "fallback" }),
			]),
		);
		registry.add(def({ id: "themed", source: "theme" }));
		assert.deepStrictEqual(ids(registry.getUserDefined()), ["found", "mine"]);
		assert.deepStrictEqual(ids(registry.getThemeProvided()), ["themed"]);
	});

	it("getBuiltIn is the complement, and holds all 13 until one is displaced", () => {
		const registry = loaded(saved([def({ id: "mine" })]));
		assert.strictEqual(registry.getBuiltIn().length, 13);
		assert.ok(registry.getBuiltIn().every((d) => d.builtIn));
	});

	it("getExportableDefinitions is getUserDefined until a built-in is edited", () => {
		const registry = loaded(saved([def({ id: "mine" })]));
		assert.deepStrictEqual(ids(registry.getExportableDefinitions()), ["mine"]);

		registry.update("note", { colorLight: "#ff0000" });
		assert.deepStrictEqual(ids(registry.getExportableDefinitions()), ["mine", "note"]);
	});

	it("carries exactly the built-ins toSaveData would persist, no more", () => {
		// The two answers come from the same gate, so an export can never be a
		// different set of rows than a reload would restore.
		const registry = loaded(saved([def({ id: "mine" })]));
		registry.update("note", { colorLight: "#ff0000" });
		registry.update("tip", { hideIcon: true });

		assert.deepStrictEqual(
			ids(registry.getExportableDefinitions().filter((d) => d.builtIn)),
			ids(registry.toSaveData().callouts.filter((d) => d.builtIn)),
		);
	});

	it("puts the user's own callouts first, then the modified built-ins", () => {
		const registry = loaded(saved([def({ id: "mine" })]));
		registry.update("note", { colorLight: "#ff0000" });
		assert.deepStrictEqual(
			registry.getExportableDefinitions().map((d) => d.id),
			["mine", "note"],
		);
	});

	it("drops a built-in back out of the export the moment it is reset", () => {
		const registry = loaded(null);
		registry.update("note", { colorLight: "#ff0000" });
		registry.resetBuiltIn("note");
		assert.deepStrictEqual(registry.getExportableDefinitions(), []);
	});
});

describe("the v2 export envelope", () => {
	it("wraps the exportable definitions and the whole settings object", () => {
		const registry = loaded(saved([def({ id: "mine" })]));
		registry.update("note", { colorLight: "#ff0000" });

		const parsed = JSON.parse(registry.exportToJSONv2()) as {
			format: string;
			formatVersion: number;
			callouts: CalloutDefinition[];
			settings: unknown;
		};

		assert.strictEqual(parsed.format, EXPORT_FORMAT_ID);
		assert.strictEqual(parsed.formatVersion, EXPORT_FORMAT_VERSION);
		assert.deepStrictEqual(ids(parsed.callouts), ["mine", "note"]);
		assert.deepStrictEqual(parsed.settings, registry.settings);
	});

	it("keeps the legacy flat export on getUserDefined, as its API contract says", () => {
		const registry = loaded(saved([def({ id: "mine" })]));
		registry.update("note", { colorLight: "#ff0000" });

		const flat = JSON.parse(registry.exportToJSON()) as CalloutDefinition[];
		assert.deepStrictEqual(ids(flat), ["mine"]);
	});
});

describe("a DEMO preview — hidden from the lists entirely", () => {
	it("adds no phantom row when it takes a fresh id", () => {
		const registry = loaded(null);
		registry.setPreviewDefinition(def({ id: "new-callout-preview" }), true);

		assert.strictEqual(registry.getAll().length, 14, "the render pipeline sees it");
		assert.deepStrictEqual(registry.getUserDefined(), [], "the settings list does not");
		assert.deepStrictEqual(registry.getExportableDefinitions(), []);
	});

	it("does not displace a real callout it happens to overlay", () => {
		// The demo id used to be `example`, a built-in every vault has, so every
		// real `[!example]` note repainted behind the modal AND the row went
		// missing from the list. The id is reserved now; this is the other half.
		const registry = loaded(null);
		registry.setPreviewDefinition(
			def({ id: "note", displayName: "DEMO", colorLight: "#ff0000" }),
			true,
		);

		assert.strictEqual(
			registry.getBuiltIn().find((d) => d.id === "note")?.displayName,
			"Note",
			"the list shows the reality it overlays",
		);
		assert.strictEqual(
			registry.getAll().find((d) => d.id === "note")?.displayName,
			"DEMO",
			"the CSS pipeline still renders the demo",
		);
	});

	it("never reaches data.json — the shadowed original is persisted instead", () => {
		const registry = loaded(saved([def({ id: "mine", displayName: "Mine" })]));
		registry.setPreviewDefinition(def({ id: "mine", displayName: "DRAFT" }), true);

		assert.deepStrictEqual(
			registry.toSaveData().callouts.map((d) => d.displayName),
			["Mine"],
		);
	});

	it("is skipped from data.json outright when it shadows nothing", () => {
		const registry = loaded(saved([def({ id: "mine" })]));
		registry.setPreviewDefinition(def({ id: "brand-new" }), true);

		assert.deepStrictEqual(registry.toSaveData().callouts.map((d) => d.id), ["mine"]);
	});
});

describe("a NON-demo preview — the live edit of a real callout", () => {
	it("shows the in-progress style in the settings row", () => {
		const registry = loaded(saved([def({ id: "mine", displayName: "Mine" })]));
		registry.setPreviewDefinition(def({ id: "mine", displayName: "Typing…" }));

		assert.strictEqual(registry.getUserDefined()[0]?.displayName, "Typing…");
	});

	it("cannot re-home a built-in into the user list while its editor is open", () => {
		// The editor fabricates `builtIn: false` / `source: "user"` from form
		// state alone; `withIdentityOf` re-stamps the ownership fields, or a
		// built-in row would move sections mid-edit.
		const registry = loaded(null);
		registry.setPreviewDefinition(
			def({ id: "note", displayName: "Typing…", builtIn: false, source: "user" }),
		);

		assert.deepStrictEqual(registry.getUserDefined(), []);
		assert.strictEqual(registry.getBuiltIn().length, 13);
		assert.strictEqual(
			registry.getBuiltIn().find((d) => d.id === "note")?.displayName,
			"Typing…",
		);
	});

	it("cannot strip the shadowed callout's aliases, un-styling open notes mid-edit", () => {
		const registry = loaded(null);
		registry.setPreviewDefinition(def({ id: "abstract", displayName: "Typing…" }));

		assert.deepStrictEqual(registry.get("abstract")?.aliases, ["summary", "tldr"]);
	});

	it("is kept out of the user list while it stands in for nothing at all", () => {
		// A brand-new callout being typed is not a callout yet. It still has to
		// render, so `getAll()` keeps it.
		const registry = loaded(null);
		registry.setPreviewDefinition(def({ id: "drafty" }));

		assert.strictEqual(registry.getAll().length, 14);
		assert.deepStrictEqual(registry.getUserDefined(), []);
		assert.deepStrictEqual(registry.getExportableDefinitions(), []);
	});

	it("is kept out of the exportable built-ins too, when drafting a fresh built-in id", () => {
		// `isUnshadowedPreview` is checked on the built-in half of the export
		// as well, not only on `getUserDefined`.
		const registry = loaded(null);
		registry.setPreviewDefinition(def({ id: "drafty", builtIn: true, source: "builtin" }));

		assert.deepStrictEqual(registry.getExportableDefinitions(), []);
	});
});

describe("setPreviewDefinition — the bookkeeping around the slot", () => {
	it("restores the shadowed callout when the preview clears", () => {
		const registry = loaded(saved([def({ id: "mine", displayName: "Mine" })]));
		registry.setPreviewDefinition(def({ id: "mine", displayName: "Typing…" }));
		registry.setPreviewDefinition(null);

		assert.strictEqual(registry.get("mine")?.displayName, "Mine");
		assert.strictEqual(registry.hasPreviewDefinition(), false);
	});

	it("leaves no orphan row when the id changes while typing a name", () => {
		const registry = loaded(null);
		registry.setPreviewDefinition(def({ id: "m" }));
		registry.setPreviewDefinition(def({ id: "my" }));
		registry.setPreviewDefinition(def({ id: "myc" }));
		registry.setPreviewDefinition(null);

		assert.strictEqual(registry.getAll().length, 13);
	});

	it("reports whether the active preview is a demo, for a nested modal to restore", () => {
		const registry = loaded(null);
		assert.strictEqual(registry.isPreviewDemo(), false);

		registry.setPreviewDefinition(def({ id: "d" }), true);
		assert.strictEqual(registry.isPreviewDemo(), true);
		assert.strictEqual(registry.getPreviewDefinition()?.id, "d");

		registry.setPreviewDefinition(null);
		assert.strictEqual(registry.isPreviewDemo(), false);
		assert.strictEqual(registry.getPreviewDefinition(), null);
	});

	it("never fires onChange — that would save and re-render every open note", () => {
		const registry = loaded(saved([def({ id: "mine" })]));
		let changes = 0;
		registry.onChange(() => changes++);

		registry.setPreviewDefinition(def({ id: "mine", displayName: "Typing…" }));
		registry.setPreviewDefinition(null);

		assert.strictEqual(changes, 0);
	});

	it("fires onPreviewChange when the lists could look different", () => {
		const registry = loaded(saved([def({ id: "mine" })]));
		let previews = 0;
		registry.onPreviewChange(() => previews++);

		registry.setPreviewDefinition(def({ id: "mine", displayName: "Typing…" }));
		assert.strictEqual(previews, 1, "putting a list-visible preview up");

		registry.setPreviewDefinition(null);
		assert.strictEqual(previews, 2, "taking it down restores the real row");
	});

	it("stays quiet for a demo → demo swap, which changes nothing on screen", () => {
		const registry = loaded(null);
		let previews = 0;
		registry.onPreviewChange(() => previews++);

		registry.setPreviewDefinition(def({ id: "d1" }), true);
		registry.setPreviewDefinition(def({ id: "d2" }), true);
		registry.setPreviewDefinition(null);

		assert.strictEqual(previews, 0);
	});

	it("can suppress the signal for a merely hovered colour", () => {
		const registry = loaded(saved([def({ id: "mine" })]));
		let previews = 0;
		registry.onPreviewChange(() => previews++);

		registry.setPreviewDefinition(def({ id: "mine", colorLight: "#ff0000" }), false, false);
		assert.strictEqual(previews, 0, "rows keep rendering the last committed state");
	});

	it("keeps the next listener's turn when one unsubscribes itself", () => {
		// Same defect as onChange's, in the other notifier: walking the live
		// array while `offPreviewChange` splices it costs the following listener
		// that round. The settings tab is the only subscriber today, so this is
		// a guard rather than a report — but fixing one notifier and not the
		// other is exactly how the two drift apart.
		const registry = loaded(saved([def({ id: "mine" })]));
		const fired: string[] = [];
		const first = (): void => {
			fired.push("first");
			registry.offPreviewChange(first);
		};
		registry.onPreviewChange(first);
		registry.onPreviewChange(() => fired.push("second"));

		registry.setPreviewDefinition(def({ id: "mine", displayName: "Typing…" }));
		assert.deepStrictEqual(fired, ["first", "second"]);
	});

	it("unsubscribes cleanly from both listener lists", () => {
		const registry = loaded(null);
		let changes = 0;
		let previews = 0;
		const onChange = (): void => {
			changes++;
		};
		const onPreview = (): void => {
			previews++;
		};

		registry.onChange(onChange);
		registry.onPreviewChange(onPreview);
		registry.offChange(onChange);
		registry.offPreviewChange(onPreview);

		registry.add(def({ id: "mine" }));
		registry.setPreviewDefinition(def({ id: "mine" }));

		assert.strictEqual(changes, 0);
		assert.strictEqual(previews, 0);
	});
});

describe("getReal — seeing through the shadow", () => {
	it("returns the shadowed callout rather than the draft standing on its id", () => {
		const registry = loaded(saved([def({ id: "mine", displayName: "Mine" })]));
		registry.setPreviewDefinition(def({ id: "mine", displayName: "Typing…" }));

		assert.strictEqual(registry.get("mine")?.displayName, "Typing…", "the render lookup");
		assert.strictEqual(registry.getReal("mine")?.displayName, "Mine", "the validation lookup");
	});

	it("returns undefined for a draft standing on nothing, so it is not its own conflict", () => {
		const registry = loaded(null);
		registry.setPreviewDefinition(def({ id: "drafty" }));

		assert.ok(registry.get("drafty"), "the render lookup finds it");
		assert.strictEqual(registry.getReal("drafty"), undefined);
		assert.strictEqual(registry.findAttrIdConflict("drafty", null), undefined);
	});

	it("is unchanged for any id the preview is not standing on", () => {
		const registry = loaded(saved([def({ id: "mine" })]));
		registry.setPreviewDefinition(def({ id: "other" }));
		assert.strictEqual(registry.getReal("mine")?.id, "mine");
	});
});
