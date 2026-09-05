/**
 * tests/settingsListVisibility.test.ts — which callouts each surface shows, and
 * why the answers differ.
 *
 * There are **two** filters, not one, and it is easy to read them as the same
 * thing because they overlap on most rows:
 *
 * - `CalloutRegistry.definitionsForLists()` — behind `getBuiltIn()` and
 *   `getUserDefined()` — drops the callout editor's transient *demo* preview.
 *   That is a row that is not a callout at all: a placeholder id the editor
 *   registers so its Live Preview renders through the real CSS pipeline.
 * - `filterUsableCallouts()` drops a *discovered* row the last prune scan found
 *   written nowhere. That row IS a callout; it is simply one nobody uses.
 *
 * And they serve different surfaces, which is the part worth pinning:
 *
 * - The **settings lists** use the first and not the second. A stale discovered
 *   row has to stay on screen — the settings tab is where the user goes to
 *   delete it, and filtering it out of the very list that manages it would
 *   leave a row nobody can reach.
 * - The **pick-a-callout surfaces** — the autocomplete dropdown, the public API,
 *   the command builder — use the second, because offering an id the user
 *   deleted from their notes hours ago is noise.
 *
 * The three pick-a-callout surfaces then read *different list views*, which is
 * a real asymmetry and is pinned at the bottom rather than smoothed over.
 *
 * The demo-preview bookkeeping itself is `calloutRegistryViews.test.ts`'s
 * subject and is not re-derived here; what this file adds is how the two
 * filters compose.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { PREVIEW_PLACEHOLDER_ID } from "../src/constants";
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

function loaded(callouts: CalloutDefinition[] = []): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load({ callouts } as Partial<PluginData>);
	return registry;
}

const ids = (defs: readonly CalloutDefinition[]): string[] =>
	defs.map((d) => d.id);

/* -------------------------------------------------------------------------- */
/* The two surfaces, spelled the way their callers spell them                 */
/* -------------------------------------------------------------------------- */

/** The "My callout types" list. */
const settingsUserList = (registry: CalloutRegistry): string[] =>
	ids(registry.getUserDefined());

/** The built-ins list beside it. */
const settingsBuiltInList = (registry: CalloutRegistry): string[] =>
	ids(registry.getBuiltIn());

/** What `AutoComplete` and `CommandEditorModal` offer: the raw map, filtered. */
const offerableFromMap = (
	registry: CalloutRegistry,
	unused: Set<string>,
): string[] =>
	ids(registry.getAll());

/** What the public API offers: the two list views unioned, then filtered. */
const offerableFromLists = (
	registry: CalloutRegistry,
	unused: Set<string>,
): string[] =>
	ids(
		[...registry.getBuiltIn(), ...registry.getUserDefined()],
	);

/* -------------------------------------------------------------------------- */
/* A discovered row nobody writes any more                                    */
/* -------------------------------------------------------------------------- */

describe("a discovered row the scan found written nowhere", () => {
	const registry = loaded([def({ id: "stale", source: "fallback" })]);
	const unused = new Set(["stale"]);

	it("stays in the settings list, because that is where it is deleted", () => {
		// Dropping it here would leave a row in `data.json` with no way to reach
		// it — the settings tab is the only surface that manages callouts rather
		// than merely offering them.
		assert.ok(settingsUserList(registry).includes("stale"));
	});

	it("remains offered until the user removes it", () => {
		assert.strictEqual(offerableFromMap(registry, unused).includes("stale"), true);
		assert.strictEqual(
			offerableFromLists(registry, unused).includes("stale"),
			true,
		);
	});
});

describe("a discovered row the user adopted", () => {
	const registry = loaded([
		def({ id: "mine", source: "fallback", customized: true }),
	]);
	const unused = new Set(["mine"]);

	it("is everywhere, zero usage or not", () => {
		// Customizing it is the adoption. Taking it away because the note that
		// prompted it was edited would throw that work out.
		assert.ok(settingsUserList(registry).includes("mine"));
		assert.ok(offerableFromMap(registry, unused).includes("mine"));
		assert.ok(offerableFromLists(registry, unused).includes("mine"));
	});
});

describe("a discovered row still written in the vault", () => {
	const registry = loaded([def({ id: "seen", source: "fallback" })]);
	const unused = new Set<string>();

	it("is everywhere", () => {
		assert.ok(settingsUserList(registry).includes("seen"));
		assert.ok(offerableFromMap(registry, unused).includes("seen"));
		assert.ok(offerableFromLists(registry, unused).includes("seen"));
	});
});

/* -------------------------------------------------------------------------- */
/* The demo preview                                                           */
/* -------------------------------------------------------------------------- */

describe("a demo preview on an id of its own", () => {
	// The palette editor, the global-style popups, and an unnamed new-callout
	// draft. The id is a placeholder, not a callout the user is editing.
	const registry = loaded();
	registry.setPreviewDefinition(def({ id: PREVIEW_PLACEHOLDER_ID }), true);

	it("never appears in either settings list", () => {
		assert.strictEqual(
			settingsUserList(registry).includes(PREVIEW_PLACEHOLDER_ID),
			false,
		);
		assert.strictEqual(
			settingsBuiltInList(registry).includes(PREVIEW_PLACEHOLDER_ID),
			false,
		);
	});

	it("IS in the raw map, so the CSS pipeline can still paint it", () => {
		// The whole reason it is registered at all: `getAll()` is what
		// `CSSInjector` generates from, and a preview invisible to the injector
		// would not preview anything.
		assert.ok(ids(registry.getAll()).includes(PREVIEW_PLACEHOLDER_ID));
	});
});

describe("a demo preview shadowing a real callout", () => {
	// The placeholder id used to be `example`, a built-in every vault has, which
	// is what made every real `[!example]` note repaint behind the modal.
	const registry = loaded();
	const shipped = registry.get("example");
	registry.setPreviewDefinition(
		def({ id: "example", displayName: "DRAFT", builtIn: true, source: "builtin" }),
		true,
	);

	it("shows the real callout in the list, not the draft", () => {
		assert.ok(shipped);
		const listed = registry
			.getBuiltIn()
			.find((d) => d.id === "example");
		assert.strictEqual(listed?.displayName, shipped.displayName);
		assert.notStrictEqual(listed?.displayName, "DRAFT");
	});

	it("still hands the draft to the CSS pipeline", () => {
		assert.strictEqual(registry.get("example")?.displayName, "DRAFT");
	});
});

describe("a NON-demo preview — the live edit of a real callout", () => {
	const registry = loaded([def({ id: "mine", displayName: "Before" })]);
	registry.setPreviewDefinition(def({ id: "mine", displayName: "Typing…" }));

	it("tracks the edit in the settings list, which is the point", () => {
		const listed = registry.getUserDefined().find((d) => d.id === "mine");
		assert.strictEqual(listed?.displayName, "Typing…");
	});

	it("is offerable, being a real callout with real edits in progress", () => {
		assert.ok(offerableFromLists(registry, new Set()).includes("mine"));
	});
});

describe("a NON-demo preview standing in for nothing", () => {
	// A brand-new callout being typed into the editor. It is not a callout yet.
	const registry = loaded();
	registry.setPreviewDefinition(def({ id: "half-typed" }));

	it("is kept out of the user list by the unshadowed-preview guard", () => {
		assert.strictEqual(settingsUserList(registry).includes("half-typed"), false);
	});
});

/* -------------------------------------------------------------------------- */
/* The asymmetry between the three offerable surfaces                         */
/* -------------------------------------------------------------------------- */

describe("the pick-a-callout surfaces do not all read the same list view", () => {
	// Stated rather than smoothed over. `filterUsableCallouts` only ever drops
	// discovered rows, so it cannot remove a preview — whichever list is handed
	// to it decides that, and the callers hand it different ones: `PluginAPI`
	// unions the two list views (no preview can survive), while
	// `CommandEditorModal` passes `registry.getAll()` (every preview does).
	//
	// `AutoComplete` used to be in that second group and is now half out of it:
	// it goes through `suggestableCallouts`, which drops `RESERVED_DEMO_IDS` by
	// name before filtering. A draft callout mid-edit still reaches the `[!`
	// popover; the splash screen's and the style popups' demo ids no longer do.
	// That narrowing is `previewPlaceholderId.test.ts`'s subject — what stays
	// pinned here is the shape below, which `CommandEditorModal` still has.
	//
	// It is benign today for a reason that is worth writing down rather than
	// relying on: a preview only exists while a modal is open, and the raw-map
	// caller is unreachable then — the command editor opens over the command
	// builder, never over the callout editor or the splash. If that ever stops
	// being true, this test is where it shows up.
	const registry = loaded();
	registry.setPreviewDefinition(def({ id: PREVIEW_PLACEHOLDER_ID }), true);

	it("the API's union cannot carry a preview row", () => {
		assert.strictEqual(
			offerableFromLists(registry, new Set()).includes(PREVIEW_PLACEHOLDER_ID),
			false,
		);
	});

	it("the raw-map callers do carry it", () => {
		assert.ok(
			offerableFromMap(registry, new Set()).includes(PREVIEW_PLACEHOLDER_ID),
		);
	});

	it("they agree about everything else", () => {
		const clean = loaded([
			def({ id: "mine" }),
			def({ id: "stale", source: "fallback" }),
			def({ id: "kept", source: "fallback", customized: true }),
		]);
		const unused = new Set(["stale"]);
		assert.deepStrictEqual(
			offerableFromMap(clean, unused).sort(),
			offerableFromLists(clean, unused).sort(),
		);
	});
});
