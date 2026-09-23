/**
 * tests/calloutEditorValidation.test.ts — what the editor lets the user save,
 * and what it counts as an edit.
 *
 * Everything here is a pure function the modal asks before it enables a button,
 * and each has a failure mode the user reads as the plugin being broken rather
 * than as a rule:
 *
 * - **the dirty check** decides whether *Save* is clickable at all. Every field
 *   left out of the snapshot is an edit the user makes and cannot commit, and
 *   two of them — `hideIcon` and `transparentBg` — are exactly that: they
 *   change nothing else in the form, so leaving them out disabled Save on the
 *   one edit the user had opened the modal to make.
 * - **the ID checks** decide whether *Save* is enabled and which of two
 *   messages appears. `canUseCalloutId` owns exact clashes; `findAttrIdCollision`
 *   owns the dasherized ones (`my note` vs `my-note`, which Obsidian collapses
 *   into a single `data-callout` and so a single CSS rule). Reporting both for
 *   one problem would show two different explanations of it, so each is
 *   deliberately silent about the other's case.
 * - **the fallback checks** decide whether a row created from the autocomplete
 *   popover is the user's callout or discovery's placeholder — which decides
 *   whether the prune pass may take it away again.
 *
 * A note on what is NOT here, because the absence is the finding: no ID is
 * *reserved*. `canUseCalloutId` asks the registry two questions and nothing
 * else. `example` is refused because it is one of the 13 built-ins and so is
 * taken, not because it is special — and `PREVIEW_PLACEHOLDER_ID`
 * (`new-callout-preview`, and NOT `cs-preview`) is kept safe by being a string
 * nothing ships and `generateId` would not plausibly produce, not by a check.
 * Both are pinned below so a future reservation is a deliberate change.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	buildStateSnapshot,
	canUseCalloutId,
	findAttrIdCollision,
	hasStateChanges,
	isOverwritingAutoFallbackRow,
	isStateValid,
	shouldSaveNewTokenCalloutAsFallback,
	type SnapshotInput,
	type ValidationStateInput,
} from "../src/settings/editor/CalloutEditorValidation";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DEFAULT_CALLOUTS, PREVIEW_PLACEHOLDER_ID } from "../src/constants";
import type { CalloutDefinition } from "../src/types";

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

/* -------------------------------------------------------------------------- */
/* 120 — the dirty check                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A snapshot input with every field the editor fills in. Built once and spread,
 * so a `change` below differs from the baseline in exactly the named key — and
 * so key ORDER stays identical between the two, which matters (see the last
 * test in this block).
 */
const baseSnapshot: SnapshotInput = {
	displayName: "Warning",
	calloutId: "warning",
	icon: { type: "lucide", value: "triangle-alert" },
	hideIcon: false,
	colorLight: "#e0ac00",
	colorDark: "#e0ac00",
	bgColorLight: "#fdf5e0",
	bgColorDark: "#2e2916",
	bgGradient: undefined,
	transparentBg: false,
	textColorLight: "#222222",
	textColorDark: "#dadada",
	foldable: true,
	defaultFolded: false,
	iconAdjust: undefined,
	iconOffsetX: 0,
	iconOffsetY: 0,
	iconSize: 1,
	aliases: [],
	paletteId: undefined,
};

/** Did the form change, as the modal asks it: snapshot on open vs. snapshot now. */
const dirty = (change: Partial<SnapshotInput>): boolean =>
	hasStateChanges(
		buildStateSnapshot(baseSnapshot),
		buildStateSnapshot({ ...baseSnapshot, ...change }),
	);

describe("buildStateSnapshot / hasStateChanges — the baseline", () => {
	it("reports no change for a form nobody touched", () => {
		assert.strictEqual(dirty({}), false);
	});

	it("reports no change for a re-built identical snapshot", () => {
		// The modal builds the "before" once at construction and the "after" on
		// every keystroke; two builds of the same state must not drift.
		assert.strictEqual(
			buildStateSnapshot(baseSnapshot),
			buildStateSnapshot({ ...baseSnapshot }),
		);
	});

	it("is a plain string comparison, with no notion of what changed", () => {
		assert.strictEqual(hasStateChanges("a", "a"), false);
		assert.strictEqual(hasStateChanges("a", "b"), true);
		// Not a diff: swapping the arguments is the same answer.
		assert.strictEqual(hasStateChanges("b", "a"), true);
	});
});

describe("buildStateSnapshot — every field the editor can change", () => {
	// One case per key. A field dropped from SnapshotInput fails here rather
	// than silently disabling Save on the edit that touches it.
	const changes: Array<[string, Partial<SnapshotInput>]> = [
		["displayName", { displayName: "Caution" }],
		["calloutId", { calloutId: "caution" }],
		["icon", { icon: { type: "lucide", value: "flame" } }],
		["hideIcon", { hideIcon: true }],
		["colorLight", { colorLight: "#ff0000" }],
		["colorDark", { colorDark: "#ff0000" }],
		["bgColorLight", { bgColorLight: "#ffffff" }],
		["bgColorDark", { bgColorDark: "#000000" }],
		[
			"bgGradient",
			{
				bgGradient: {
					angleDeg: 90,
					toColorLight: "#ffd9d9",
					toColorDark: "#3a1c1c",
				},
			},
		],
		["transparentBg", { transparentBg: true }],
		["textColorLight", { textColorLight: "#111111" }],
		["textColorDark", { textColorDark: "#eeeeee" }],
		["foldable", { foldable: false }],
		["defaultFolded", { defaultFolded: true }],
		["iconAdjust", { iconAdjust: { heading: { offsetX: 2 } } }],
		["iconOffsetX", { iconOffsetX: 3 }],
		["iconOffsetY", { iconOffsetY: -3 }],
		["iconSize", { iconSize: 1.25 }],
		["aliases", { aliases: ["warn"] }],
		["paletteId", { paletteId: "sunset" }],
	];

	for (const [name, change] of changes) {
		it(`counts a changed ${name} as an edit`, () => {
			assert.strictEqual(dirty(change), true);
		});
	}
});

describe("buildStateSnapshot — the fields that were once left out", () => {
	// Both of these are axes of their own: flipping one changes nothing else in
	// the form, so a snapshot without them left Save disabled on the only edit
	// the user had come to make. That is the regression, and this is the pin.
	it("counts turning the icon off as an edit, though `icon` is untouched", () => {
		const off = { ...baseSnapshot, hideIcon: true };
		assert.strictEqual(dirty({ hideIcon: true }), true);
		// And the icon is still the drawing it would have shown — hiding it is a
		// display flag, not the removal of a pick.
		assert.deepStrictEqual(off.icon, baseSnapshot.icon);
	});

	it("counts switching the background to None as an edit", () => {
		assert.strictEqual(dirty({ transparentBg: true }), true);
	});

	it("counts re-pointing at another palette as an edit, colours and all", () => {
		// The link is what decides whose later edits cascade onto this callout,
		// so two palettes carrying identical colours are still not the same row.
		assert.strictEqual(dirty({ paletteId: "sunset" }), true);
	});
});

describe("buildStateSnapshot — how the JSON shape behaves", () => {
	it("cannot tell an absent optional from an explicit undefined", () => {
		// `JSON.stringify` drops both, which is what keeps the two spellings of
		// "no gradient" from reading as an edit when nothing happened.
		const { bgGradient: _dropped, ...withoutKey } = baseSnapshot;
		assert.strictEqual(
			buildStateSnapshot(withoutKey as SnapshotInput),
			buildStateSnapshot(baseSnapshot),
		);
	});

	it("compares nested values structurally, not by identity", () => {
		const sameIcon = { ...(baseSnapshot.icon as Record<string, unknown>) };
		assert.notStrictEqual(sameIcon, baseSnapshot.icon);
		assert.strictEqual(dirty({ icon: sameIcon }), false);
	});

	it("treats a reordered alias list as an edit", () => {
		// Aliases are an ordered array in the definition, so this is honest
		// rather than a false positive: the saved value really would differ.
		const before = buildStateSnapshot({
			...baseSnapshot,
			aliases: ["a", "b"],
		});
		const after = buildStateSnapshot({
			...baseSnapshot,
			aliases: ["b", "a"],
		});
		assert.strictEqual(hasStateChanges(before, after), true);
	});

	it("is a snapshot of ONE builder, and only comparable with itself", () => {
		// `JSON.stringify` follows insertion order, so the same values entered in
		// a different order stringify differently. Harmless — both snapshots come
		// from the same literal in CalloutEditor — but it is the reason this is a
		// dirty *flag* and never a diff, and the reason nothing may persist one.
		// Destructured rather than written as two keys ahead of a spread of the
		// whole thing: that form names `calloutId`/`displayName` twice, and the
		// second one wins, so the compiler rejects it outright. Pulling them out
		// first says the same thing — same values, `calloutId` ahead of
		// `displayName` instead of behind it — with each key written once.
		const { calloutId, displayName, ...rest } = baseSnapshot;
		const reordered = buildStateSnapshot({
			calloutId,
			displayName,
			...rest,
		} as SnapshotInput);
		assert.notStrictEqual(reordered, buildStateSnapshot(baseSnapshot));
	});
});

/* -------------------------------------------------------------------------- */
/* 121 — canUseCalloutId                                                      */
/* -------------------------------------------------------------------------- */

/** The two registry questions the ID checks ask, over a fixed little world. */
function lookup(defs: CalloutDefinition[]): {
	getById: (id: string) => CalloutDefinition | undefined;
	findByAlias: (id: string) => CalloutDefinition | undefined;
} {
	return {
		getById: (id) => defs.find((d) => d.id === id),
		findByAlias: (id) => defs.find((d) => d.aliases?.includes(id)),
	};
}

const world = [
	def({ id: "note", displayName: "Note", builtIn: true, source: "builtin" }),
	def({ id: "mine", aliases: ["ours"] }),
	def({ id: "auto", source: "fallback" }),
	def({ id: "adopted", source: "fallback", customized: true }),
];

/** `canUseCalloutId`, with the fixed world above and sensible defaults. */
const canUse = (
	id: string,
	over: Partial<Parameters<typeof canUseCalloutId>[0]> = {},
): boolean =>
	canUseCalloutId({
		...lookup(world),
		createFromToken: false,
		existingId: null,
		role: "primary",
		id,
		...over,
	});

describe("canUseCalloutId — taken", () => {
	it("refuses an ID another callout already owns", () => {
		assert.strictEqual(canUse("mine"), false);
	});

	it("refuses an ID that is another callout's alias", () => {
		// Aliases are IDs the user can write in a note, so they are just as taken.
		assert.strictEqual(canUse("ours"), false);
	});

	it("allows a free ID", () => {
		assert.strictEqual(canUse("brand-new"), true);
	});

	it("lets a callout keep its own ID while being edited", () => {
		assert.strictEqual(canUse("mine", { existingId: "mine" }), true);
	});

	it("lets a callout keep its own alias while being edited", () => {
		assert.strictEqual(
			canUse("ours", { existingId: "mine", role: "alias" }),
			true,
		);
	});

	it("still refuses someone ELSE's ID while editing", () => {
		assert.strictEqual(canUse("note", { existingId: "mine" }), false);
	});
});

describe("canUseCalloutId — invalid", () => {
	it("refuses the empty ID", () => {
		// The editor rejects empty IDs everywhere; this is the check that says so.
		assert.strictEqual(canUse(""), false);
	});

	it("refuses the empty ID even for the callout being edited", () => {
		assert.strictEqual(canUse("", { existingId: "mine" }), false);
	});
});

describe("canUseCalloutId — the one allowance, and its shape", () => {
	// Creating for a token already in a note when discovery has filed that id as
	// an uncustomized placeholder: the row IS the thing being created, so taking
	// it over is not a clash.
	const overwriting = {
		createFromToken: true,
		existingId: null,
	} as const;

	it("lets a new token-based callout take over an untouched fallback row", () => {
		assert.strictEqual(canUse("auto", overwriting), true);
	});

	it("does NOT extend the allowance to an alias", () => {
		// Only the primary ID is the row being replaced. An alias landing on it
		// would leave two callouts claiming one id.
		assert.strictEqual(
			canUse("auto", { ...overwriting, role: "alias" }),
			false,
		);
	});

	it("does NOT extend it to a fallback row the user adopted", () => {
		assert.strictEqual(canUse("adopted", overwriting), false);
	});

	it("does NOT extend it to a real callout", () => {
		assert.strictEqual(canUse("mine", overwriting), false);
		assert.strictEqual(canUse("note", overwriting), false);
	});
});

describe("canUseCalloutId — there is no reserved-ID list", () => {
	// The header says why this matters. Both of these pass today for reasons
	// that have nothing to do with reservation, and a future change that DOES
	// reserve something will land here first.
	it("refuses `example` only because a built-in already owns it", () => {
		const builtInIds = DEFAULT_CALLOUTS.map((d) => d.id);
		assert.ok(builtInIds.includes("example"));

		const registry = new CalloutRegistry();
		registry.load(null);
		const ask = (id: string): boolean =>
			canUseCalloutId({
				getById: (x) => registry.get(x),
				findByAlias: (x) => registry.findByAlias(x),
				createFromToken: false,
				existingId: null,
				role: "primary",
				id,
			});

		assert.strictEqual(ask("example"), false);
		// Take it out of the world and the very same id is free again — which is
		// what "taken, not reserved" means.
		assert.strictEqual(canUse("example"), true);
	});

	it("allows the live-preview placeholder ID like any other free string", () => {
		assert.strictEqual(PREVIEW_PLACEHOLDER_ID, "new-callout-preview");
		assert.strictEqual(canUse(PREVIEW_PLACEHOLDER_ID), true);
		// It is safe because nothing ships it, not because anything guards it.
		assert.ok(
			!DEFAULT_CALLOUTS.some((d) => d.id === PREVIEW_PLACEHOLDER_ID),
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 122 — findAttrIdCollision                                                  */
/* -------------------------------------------------------------------------- */

describe("findAttrIdCollision — `my note` against `my-note`", () => {
	/** A registry holding one user callout, asked the way the modal asks it. */
	function collisionIn(
		existing: CalloutDefinition,
		typed: string,
		editing: string | null = null,
	): string | null {
		const registry = new CalloutRegistry();
		registry.load({ callouts: [existing] });
		return findAttrIdCollision({
			findAttrIdConflict: (id) => registry.findAttrIdConflict(id, editing),
			existingId: editing,
			id: typed,
		});
	}

	it("reports the space form when the dash form is typed", () => {
		assert.strictEqual(
			collisionIn(def({ id: "my note" }), "my-note"),
			"my note",
		);
	});

	it("reports the dash form when the space form is typed", () => {
		// Symmetric on purpose — a precedence-ordered search would let the
		// literal ID win and hide the conflict in one of the two directions.
		assert.strictEqual(
			collisionIn(def({ id: "my-note" }), "my note"),
			"my-note",
		);
	});

	it("reports an alias that dasherizes onto the typed ID", () => {
		assert.strictEqual(
			collisionIn(def({ id: "other", aliases: ["my note"] }), "my-note"),
			"other",
		);
	});

	it("says nothing when the callout in the way is the one being edited", () => {
		assert.strictEqual(
			collisionIn(def({ id: "my note" }), "my-note", "my note"),
			null,
		);
	});

	it("says nothing about IDs that do not collapse together", () => {
		assert.strictEqual(collisionIn(def({ id: "my note" }), "other"), null);
	});
});

describe("findAttrIdCollision — the cases it deliberately stays silent on", () => {
	// Every one of these is `canUseCalloutId`'s to report. Two messages for one
	// problem is the failure being avoided.
	const owner = def({ id: "taken", aliases: ["also"] });
	const ask = (id: string, existingId: string | null = null): string | null =>
		findAttrIdCollision({
			findAttrIdConflict: () => owner,
			existingId,
			id,
		});

	it("stays silent on an exact ID clash", () => {
		assert.strictEqual(ask("taken"), null);
	});

	it("stays silent on an exact alias clash", () => {
		assert.strictEqual(ask("also"), null);
	});

	it("stays silent on the empty ID, without asking the registry", () => {
		let asked = false;
		const result = findAttrIdCollision({
			findAttrIdConflict: () => {
				asked = true;
				return owner;
			},
			existingId: null,
			id: "",
		});
		assert.strictEqual(result, null);
		assert.strictEqual(asked, false);
	});

	it("stays silent when the reported owner IS the callout being edited", () => {
		// Belt and braces: the registry already excludes it, and this covers a
		// caller that wires the lookup without the exclusion.
		assert.strictEqual(ask("t a k e n", "taken"), null);
	});

	it("reports the owner's ID when the collision is a real one", () => {
		assert.strictEqual(ask("some other spelling"), "taken");
	});
});

/* -------------------------------------------------------------------------- */
/* 123 — the two fallback questions                                           */
/* -------------------------------------------------------------------------- */

describe("shouldSaveNewTokenCalloutAsFallback", () => {
	const ask = (
		over: Partial<
			Parameters<typeof shouldSaveNewTokenCalloutAsFallback>[0]
		> = {},
	): boolean =>
		shouldSaveNewTokenCalloutAsFallback({
			...lookup(world),
			createFromToken: true,
			existingId: null,
			hasStyleChanges: false,
			...over,
		});

	it("is true for a brand-new token callout the user did not style", () => {
		// Nothing was chosen, so the row is discovery's placeholder rather than
		// the user's callout — and the prune pass may take it away again.
		assert.strictEqual(ask(), true);
	});

	it("is false once the user styled it — that is the adoption", () => {
		assert.strictEqual(ask({ hasStyleChanges: true }), false);
	});

	it("is false when the modal was not opened for an existing token", () => {
		assert.strictEqual(ask({ createFromToken: false }), false);
	});

	it("is false when an existing callout is being edited", () => {
		assert.strictEqual(ask({ existingId: "mine" }), false);
	});
});

describe("isOverwritingAutoFallbackRow", () => {
	const ask = (
		id: string,
		over: Partial<Parameters<typeof isOverwritingAutoFallbackRow>[0]> = {},
	): boolean =>
		isOverwritingAutoFallbackRow({
			...lookup(world),
			createFromToken: true,
			existingId: null,
			id,
			...over,
		});

	it("is true for an untouched row discovery filed", () => {
		assert.strictEqual(ask("auto"), true);
	});

	it("is false once that row was adopted", () => {
		assert.strictEqual(ask("adopted"), false);
	});

	it("requires `customized` to be exactly true to count as adopted", () => {
		// Same rule as `filterUsableCallouts`: merely truthy is not adopted.
		const rows = [
			def({
				id: "odd",
				source: "fallback",
				customized: 1 as unknown as boolean,
			}),
		];
		assert.strictEqual(
			isOverwritingAutoFallbackRow({
				...lookup(rows),
				createFromToken: true,
				existingId: null,
				id: "odd",
			}),
			true,
		);
	});

	it("is false for a real callout, built-in or user", () => {
		assert.strictEqual(ask("mine"), false);
		assert.strictEqual(ask("note"), false);
	});

	it("is false for an ID nothing owns yet", () => {
		assert.strictEqual(ask("nobody"), false);
	});

	it("is false for the empty ID", () => {
		assert.strictEqual(ask(""), false);
	});

	it("is false outside the token-create flow", () => {
		assert.strictEqual(ask("auto", { createFromToken: false }), false);
	});

	it("is false while editing an existing callout", () => {
		assert.strictEqual(ask("auto", { existingId: "mine" }), false);
	});
});

/* -------------------------------------------------------------------------- */
/* 124 — isStateValid                                                         */
/* -------------------------------------------------------------------------- */

describe("isStateValid", () => {
	const valid = (over: Partial<ValidationStateInput> = {}): boolean =>
		isStateValid({
			...lookup(world),
			findAttrIdConflict: () => undefined,
			createFromToken: false,
			existingId: null,
			isBuiltIn: false,
			displayName: "Brand new",
			calloutId: "brand-new",
			aliases: [],
			...over,
		});

	it("accepts a named callout with a free ID", () => {
		assert.strictEqual(valid(), true);
	});

	it("rejects an empty ID", () => {
		assert.strictEqual(valid({ calloutId: "" }), false);
	});

	it("rejects a taken ID", () => {
		assert.strictEqual(valid({ calloutId: "mine" }), false);
	});

	it("rejects a taken alias", () => {
		assert.strictEqual(valid({ aliases: ["ours"] }), false);
	});

	it("rejects an alias colliding with another callout's dasherized ID", () => {
		assert.strictEqual(
			valid({
				aliases: ["some alias"],
				findAttrIdConflict: (id) =>
					id === "some alias" ? def({ id: "some-alias" }) : undefined,
			}),
			false,
		);
	});

	it("rejects a primary ID colliding the same way", () => {
		assert.strictEqual(
			valid({
				findAttrIdConflict: (id) =>
					id === "brand-new" ? def({ id: "brand new" }) : undefined,
			}),
			false,
		);
	});
});

describe("isStateValid — when a display name is required", () => {
	const valid = (over: Partial<ValidationStateInput>): boolean =>
		isStateValid({
			...lookup(world),
			findAttrIdConflict: () => undefined,
			createFromToken: false,
			existingId: null,
			isBuiltIn: false,
			displayName: "",
			calloutId: "brand-new",
			aliases: [],
			...over,
		});

	it("requires one for an ordinary new callout", () => {
		assert.strictEqual(valid({}), false);
	});

	it("treats whitespace as no name at all", () => {
		assert.strictEqual(valid({ displayName: "   " }), false);
	});

	it("waives it for a callout created from a token in the note", () => {
		// The caller already knows the token ID; a name is derived from it, and
		// demanding another one would block the direct token-creation path.
		assert.strictEqual(valid({ createFromToken: true }), true);
	});

	it("re-imposes it once that callout is opened again for editing", () => {
		assert.strictEqual(
			valid({ createFromToken: true, existingId: "brand-new" }),
			false,
		);
	});

	it("waives it for a built-in, whose name the theme may own", () => {
		assert.strictEqual(
			valid({ isBuiltIn: true, calloutId: "note", existingId: "note" }),
			true,
		);
	});
});
