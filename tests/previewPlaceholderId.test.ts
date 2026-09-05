/**
 * tests/previewPlaceholderId.test.ts — 161: the demo preview and the built-in it
 * used to collide with.
 *
 * The callout editor, the palette editor and the two style popups all render
 * their preview through the *real* pipeline: a transient definition goes into
 * the registry, `getAll()` hands it to `CSSInjector`, and the sample paints in
 * the live theme with the live CSS. That is the whole point of it, and it is
 * also the hazard — a row in the registry is a row every list reads.
 *
 * The bug was the id. The placeholder used to be `example`, one of the 13
 * callouts this plugin ships, so `setPreviewDefinition` recorded the built-in as
 * `previewShadowedDef`, `isUnshadowedPreview` went false, and the draft leaked
 * into "My callout types" as a phantom row that appeared on a preview refresh
 * and vanished when the modal closed. Every real `[!example]` in the vault
 * repainted behind the modal at the same time, because the injector was doing
 * exactly what it was asked to.
 *
 * Two independent things had to become true, and this file pins both — the
 * second is the one that gets forgotten:
 *
 * - **The demo is filtered out of the lists** by `definitionsForLists()`, on the
 *   `isDemo` flag rather than on the id. `settingsListVisibility.test.ts` owns
 *   how that composes with the *other* filter; what is added here is the rest of
 *   the blast radius — `data.json` and the export file, which are permanent in a
 *   way a phantom row is not.
 * - **The id itself is unreachable.** It is not a callout this plugin ships, and
 *   — because it is spelled with a dash and `sanitizeCalloutIdInput` never
 *   produces one — it is not a callout the user can create either. That is what
 *   keeps `previewShadowedDef` null, which is what the filter is built on.
 *   Asserted for `STYLE_DEMO_ID` too, not for the placeholder alone: the style
 *   popups reserve an id of their own, it reaches the same preview slot and the
 *   same injector, and until it was exported nothing could check it at all.
 *
 * `example` is deliberately still exercised below. It is no longer the
 * placeholder, but it is still a built-in and a demo may still be raised over
 * it (the style popups preview whatever id they are handed), so the shadowing
 * path has to keep working rather than merely be unused.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import {
	DEFAULT_CALLOUTS,
	PREVIEW_PLACEHOLDER_ID,
	RESERVED_DEMO_IDS,
	STYLE_DEMO_ID,
} from "../src/constants";
import { buildKnownCalloutIds } from "../src/manager/knownCalloutIds";
import { scanStringForUnknownCallouts } from "../src/utils/vaultCalloutScanner";
import { suggestableCallouts } from "../src/utils/usableCallouts";
import { validateIdString } from "../src/utils/importValidator";
import { sanitizeCalloutIdInput } from "../src/utils/calloutId";
import { readRepoFile } from "./support/sourceScan";
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

/**
 * A registry seeded the way a real load seeds it. `load` — not the bare
 * constructor — is what puts the 13 built-ins in the live map, and every
 * assertion here is about what the built-ins do or don't collide with.
 */
function loaded(callouts: CalloutDefinition[] = []): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load({ callouts } as Partial<PluginData>);
	return registry;
}

const ids = (defs: readonly CalloutDefinition[]): string[] =>
	defs.map((d) => d.id);

/* -------------------------------------------------------------------------- */
/* The id                                                                     */
/* -------------------------------------------------------------------------- */

describe("no reserved demo id names anything real", () => {
	// Stated over every reserved id rather than over the placeholder alone. The
	// placeholder is the id that *was* wrong; `STYLE_DEMO_ID` is the one nothing
	// was checking, and it reaches the same preview slot, the same `getAll()`
	// and the same injector. Both are reserved for the same reason, so both are
	// asserted by the same four claims.
	for (const demoId of [PREVIEW_PLACEHOLDER_ID, STYLE_DEMO_ID]) {
		describe(demoId, () => {
			it("is not the id of any callout this plugin ships", () => {
				// The regression itself, stated as a fact about the constants. It
				// fails the moment somebody points one back at a real id.
				assert.strictEqual(
					DEFAULT_CALLOUTS.some((d) => d.id === demoId),
					false,
					`${demoId} is a shipped callout — a demo raised on it repaints every real occurrence`,
				);
			});

			it("is not an alias of one either", () => {
				// An alias is resolved by `findByAlias` and styled by its own
				// generated selector, so colliding with one repaints a real
				// callout just as surely.
				const aliases = DEFAULT_CALLOUTS.flatMap((d) => d.aliases ?? []);
				assert.strictEqual(aliases.includes(demoId), false);
			});

			it("is absent from a freshly loaded registry", () => {
				// The same claim from the other side: whatever `load` seeds,
				// nothing answers to this id until a modal puts something there.
				assert.strictEqual(loaded().get(demoId), undefined);
			});

			it("is spelled with a dash, which is what keeps a user from minting it", () => {
				// `sanitizeCalloutIdInput` folds every dash run into a space, so
				// no name the user can type in the ID field normalizes onto this
				// id. That is not a coincidence to lean on quietly — it is the
				// reason a dashed reserved id is safe where a one-word one would
				// not be. Every spelling is derived from the id itself, so a new
				// entry in the list is covered without editing this test.
				assert.ok(demoId.includes("-"));
				for (const spelling of [
					demoId,
					demoId.replace(/-/g, " "),
					demoId.replace(
						/(^|-)(\w)/g,
						(_m: string, sep: string, c: string) =>
							`${sep}${c.toUpperCase()}`,
					),
					demoId.replace(/-/g, " - "),
				]) {
					const sanitized = sanitizeCalloutIdInput(spelling);
					assert.ok(!sanitized.includes("-"), spelling);
					assert.notStrictEqual(sanitized, demoId, spelling);
				}
			});

			it("is listed in RESERVED_DEMO_IDS", () => {
				// The four claims below are all keyed off that set, so an id
				// that reserves itself in name only would pass every one of
				// them vacuously.
				assert.ok(RESERVED_DEMO_IDS.has(demoId));
			});

			it("counts as known, so discovery never mints a row for it", () => {
				// `buildKnownCalloutIds` used to answer purely from `getAll()`,
				// which meant a demo id was "known" only while a modal held it
				// in the preview slot. A note that writes `[!global-style-demo]`
				// — pasted from a screenshot, or left behind by a crash — would
				// then be discovered the moment that modal closed, and appear
				// as a row the user never made and cannot explain.
				//
				// Asked through the real scanner rather than of the set: the
				// set holds a *known* id's two spellings and the scanner tests
				// a *found* id's two spellings against it, so only the pair
				// together answers "would this be discovered".
				const known = buildKnownCalloutIds(loaded());
				for (const spelling of [demoId, demoId.replace(/-/g, " ")]) {
					assert.deepStrictEqual(
						scanStringForUnknownCallouts(
							[
								`> [!${spelling}] Block`,
								"",
								`## [!${spelling}] Heading`,
								"",
								`An [!${spelling}] pill.`,
							].join("\n"),
							known,
						),
						[],
						spelling,
					);
				}
			});

			it("is never offered by the `[!` autocomplete", () => {
				// Autocomplete reads `getAll()` rather than the list views —
				// deliberately, so a fresh row is offerable at once — which is
				// exactly why the demo ids need excluding here by name. The
				// registry is seeded with the demo raised on a *fresh* id, the
				// shape a real preview takes.
				const registry = loaded();
				registry.setPreviewDefinition(def({ id: demoId }), true);
				for (const role of ["regular", "heading", "inline"] as const) {
					const offered = suggestableCallouts(
						registry,
						role).map((d) => d.id);
					assert.ok(!offered.includes(demoId), `${demoId} / ${role}`);
				}
			});

			it("is rejected by the import validator", () => {
				const issues: Array<{ messageKey: string }> = [];
				const ok = validateIdString(
					demoId,
					(issue) => issues.push(issue),
					"id",
				);
				assert.strictEqual(ok, false, demoId);
				assert.ok(
					issues.some((i) => i.messageKey === "import.err.idReserved"),
					JSON.stringify(issues),
				);
			});

			it("never reaches an export, even shadowing a real row", () => {
				// `isUnshadowedPreview` already covers the ordinary case. This
				// is the one it does not: a row that somehow exists under the
				// reserved id with no preview active at all — an older
				// data.json, or a crash mid-preview — must still not leave in
				// a backup file.
				const registry = loaded([
					def({ id: demoId, displayName: "Leaked" }),
				]);
				const exported = ids(registry.getExportableDefinitions());
				assert.ok(!exported.includes(demoId), exported.join(", "));
			});
		});
	}

	it("still ships `example`, so the shadowing path is not dead code", () => {
		// It stopped being the placeholder; it did not stop being a built-in a
		// demo can be raised over.
		assert.ok(DEFAULT_CALLOUTS.some((d) => d.id === "example"));
	});
});

/* -------------------------------------------------------------------------- */
/* A demo on the placeholder — the ordinary case                              */
/* -------------------------------------------------------------------------- */

describe("a demo preview standing on the placeholder id", () => {
	const withDemo = (): CalloutRegistry => {
		const registry = loaded();
		registry.setPreviewDefinition(
			def({ id: PREVIEW_PLACEHOLDER_ID, displayName: "DRAFT" }),
			true,
		);
		return registry;
	};

	it("reaches the CSS pipeline, which is the only reason it is registered", () => {
		assert.ok(ids(withDemo().getAll()).includes(PREVIEW_PLACEHOLDER_ID));
	});

	it("reaches neither settings list", () => {
		const registry = withDemo();
		assert.strictEqual(
			ids(registry.getUserDefined()).includes(PREVIEW_PLACEHOLDER_ID),
			false,
		);
		assert.strictEqual(
			ids(registry.getBuiltIn()).includes(PREVIEW_PLACEHOLDER_ID),
			false,
		);
	});

	it("never reaches data.json", () => {
		// The phantom row was temporary; a persisted row is not. `toSaveData`
		// skips the active preview id outright when it shadows nothing.
		assert.strictEqual(
			ids(withDemo().toSaveData().callouts).includes(PREVIEW_PLACEHOLDER_ID),
			false,
		);
	});

	it("never reaches the export file", () => {
		assert.strictEqual(
			ids(withDemo().getExportableDefinitions()).includes(
				PREVIEW_PLACEHOLDER_ID,
			),
			false,
		);
	});

	it("leaves nothing behind when the modal closes", () => {
		const registry = withDemo();
		registry.setPreviewDefinition(null);

		assert.strictEqual(registry.get(PREVIEW_PLACEHOLDER_ID), undefined);
		assert.strictEqual(
			ids(registry.getAll()).includes(PREVIEW_PLACEHOLDER_ID),
			false,
		);
	});
});

/* -------------------------------------------------------------------------- */
/* A demo over a real built-in — the shape the bug had                        */
/* -------------------------------------------------------------------------- */

describe("a demo preview raised over the built-in `example`", () => {
	const withDemo = (registry: CalloutRegistry): CalloutRegistry => {
		registry.setPreviewDefinition(
			def({
				id: "example",
				displayName: "DRAFT",
				colorLight: "#00ff00",
				builtIn: true,
				source: "builtin",
			}),
			true,
		);
		return registry;
	};

	it("shows the shipped callout in the list, not the draft", () => {
		const registry = loaded();
		const shipped = registry.get("example");
		assert.ok(shipped);

		withDemo(registry);
		const listed = registry.getBuiltIn().find((d) => d.id === "example");
		assert.strictEqual(listed?.displayName, shipped.displayName);
		assert.notStrictEqual(listed?.displayName, "DRAFT");
	});

	it("still hands the draft to the CSS pipeline", () => {
		assert.strictEqual(withDemo(loaded()).get("example")?.displayName, "DRAFT");
	});

	it("persists the real callout's colours, not the draft's", () => {
		// The sharpest form of the leak: a background save landing mid-preview
		// would otherwise write whatever the modal happened to be showing into
		// `data.json` — permanently, and for a callout the user never edited.
		const registry = loaded();
		registry.update("example", { colorLight: "#ff0000" });
		withDemo(registry);

		const saved = registry
			.toSaveData()
			.callouts.find((d) => d.id === "example");
		assert.strictEqual(saved?.colorLight, "#ff0000");
	});

	it("keeps an untouched built-in out of data.json, preview or no preview", () => {
		// A demo must not make a pristine built-in look modified: `toSaveData`
		// compares the *shadowed* definition against the shipped default, and
		// the draft's own colours are not part of that comparison.
		const registry = withDemo(loaded());
		assert.strictEqual(
			ids(registry.toSaveData().callouts).includes("example"),
			false,
		);
	});

	it("puts the real callout back when the modal closes", () => {
		const registry = loaded();
		const shipped = registry.get("example");
		registry.setPreviewDefinition(null);

		withDemo(registry);
		registry.setPreviewDefinition(null);

		assert.deepStrictEqual(registry.get("example"), shipped);
	});
});

/* -------------------------------------------------------------------------- */
/* The flag, not the id                                                       */
/* -------------------------------------------------------------------------- */

describe("`isDemo` is what decides this, and it defaults to false", () => {
	it("an edit of a real callout still tracks in the list", () => {
		// The other way to break this is to over-correct — mark every preview a
		// demo and the settings row stops following what the user is typing,
		// which is the feature the preview slot exists for.
		const registry = loaded([def({ id: "mine", displayName: "Before" })]);
		registry.setPreviewDefinition(def({ id: "mine", displayName: "Typing…" }));

		assert.strictEqual(
			registry.getUserDefined().find((d) => d.id === "mine")?.displayName,
			"Typing…",
		);
	});

	it("a demo on a fresh id is dropped from the lists whatever it is called", () => {
		// Not keyed on `PREVIEW_PLACEHOLDER_ID`: the style popups register their
		// own demo ids, and the filter has to hold for those too.
		const registry = loaded();
		registry.setPreviewDefinition(def({ id: "style-popup-demo" }), true);

		assert.strictEqual(
			ids(registry.getUserDefined()).includes("style-popup-demo"),
			false,
		);
		assert.ok(ids(registry.getAll()).includes("style-popup-demo"));
	});
});

/* -------------------------------------------------------------------------- */
/* The prose the fix left behind                                              */
/* -------------------------------------------------------------------------- */

/**
 * The code moved off `example` and the comments around it did not, which is a
 * failure mode of its own: a reader who believes `setPreviewDefinition`'s doc
 * comment concludes the placeholder still collides with a built-in, and either
 * "fixes" a bug that is gone or leaves the real reservation rule undiscovered.
 *
 * Named literally, in the shape `repoTestGate.test.ts` already uses for retired
 * claims, and for its reason: a stale sentence has nothing to derive it from,
 * and reads perfectly well. Anything more general has to tell "is the
 * placeholder" from "was the placeholder", which is where a text check stops
 * being able to help.
 */
describe("no comment still says a shipped callout is the placeholder", () => {
	const RETIRED = [
		{
			file: "src/manager/CalloutRegistry.ts",
			phrase: "reused as the preview placeholder id",
			since: "the placeholder is `new-callout-preview`, which nothing ships",
		},
		{
			file: "src/manager/CalloutRegistry.ts",
			phrase: "as the demo placeholder",
			since: "no reserved demo id is a built-in id any more",
		},
		{
			file: "src/settings/CalloutEditor.ts",
			phrase: "a readable placeholder",
			since: "it is reserved rather than readable — see constants.ts",
		},
	];

	for (const { file, phrase, since } of RETIRED) {
		it(`${file} no longer says "${phrase}"`, () => {
			assert.strictEqual(
				readRepoFile(file).includes(phrase),
				false,
				`${file} still says "${phrase}" — ${since}`,
			);
		});
	}

	it("and the files being read are the ones that own this", () => {
		// A rename would otherwise make every assertion above pass by reading a
		// file that no longer contains the subject at all.
		assert.match(
			readRepoFile("src/manager/CalloutRegistry.ts"),
			/setPreviewDefinition\(/,
		);
		assert.match(
			readRepoFile("src/settings/CalloutEditor.ts"),
			/PREVIEW_PLACEHOLDER_ID/,
		);
	});
});
