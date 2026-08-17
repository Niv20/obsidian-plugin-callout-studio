/**
 * tests/calloutRegistryCompare.test.ts — the one comparison, asked two ways.
 *
 * `isModified` is a single structural diff over `COMPARED_FIELDS`, and two
 * callers ask it questions that must disagree on exactly one point:
 *
 * - `isBuiltInModified` → **should this built-in be written to `data.json`?**
 *   A field missing from `COMPARED_FIELDS` is not a cosmetic gap: a built-in
 *   customized *only* through that field reads as pristine, is never persisted,
 *   and the edit vanishes on the next reload.
 * - `isUnmodifiedBuiltIn` → **may this built-in keep deferring to the theme's
 *   `--callout-*`?** Answering yes for a real colour edit means the user's hex
 *   is ignored; answering no for a colour-neutral edit swaps core's
 *   `--callout-note` for a hard-coded hex and silently ends the deference.
 *
 * `COLOUR_NEUTRAL_FIELDS` is the whole difference between them, so the tests
 * below are written as a sweep over the field table rather than as a list of
 * hand-picked examples: adding a field to `CalloutDefinition` without deciding
 * its place here should fail *these* tests, not just the compiler.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import {
	COLOUR_NEUTRAL_FIELDS,
	COMPARED_FIELDS,
} from "../src/manager/calloutCompare";
import type { CalloutDefinition } from "../src/types";

/**
 * The two field tables. They used to be `private static` on the registry and
 * were read here through a cast; since they moved to `manager/calloutCompare`
 * they are ordinary exports and the cast is gone. The indirection stays so the
 * assertions below read the same either way.
 */
const TABLES: {
	COMPARED_FIELDS: Record<string, true>;
	COLOUR_NEUTRAL_FIELDS: ReadonlySet<string>;
} = { COMPARED_FIELDS, COLOUR_NEUTRAL_FIELDS };

/**
 * A value for each compared field that differs from what `[!note]` ships with.
 *
 * Deliberately exhaustive and deliberately *not* derived from the table: the
 * test below asserts the two agree, so a new compared field with no entry here
 * fails loudly instead of being skipped.
 */
const CHANGED: Record<string, Partial<CalloutDefinition>> = {
	displayName: { displayName: "Renamed" },
	icon: { icon: { type: "emoji", value: "🌵" } },
	hideIcon: { hideIcon: true },
	colorLight: { colorLight: "#010203" },
	colorDark: { colorDark: "#040506" },
	foldable: { foldable: true },
	defaultFolded: { defaultFolded: true },
	iconAdjust: { iconAdjust: { regular: { offsetX: 3 } } },
	iconOffsetX: { iconOffsetX: 4 },
	iconOffsetY: { iconOffsetY: 5 },
	iconSize: { iconSize: 1.25 },
	bgColorLight: { bgColorLight: "#111111" },
	bgColorDark: { bgColorDark: "#222222" },
	bgGradient: {
		bgGradient: { angleDeg: 45, toColorLight: "#ffffff", toColorDark: "#000000" },
	},
	transparentBg: { transparentBg: true },
	textColorLight: { textColorLight: "#333333" },
	textColorDark: { textColorDark: "#444444" },
	aliases: { aliases: ["zzz"] },
	paletteId: { paletteId: "cp-zzz" },
	customized: { customized: true },
	externalStyle: { externalStyle: true },
	styleMode: { styleMode: "force" },
	metadata: { metadata: { k: "v" } },
};

function loaded(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

const note = (registry: CalloutRegistry): CalloutDefinition => {
	const def = registry.get("note");
	assert.ok(def, "expected the built-in [!note]");
	return def;
};

describe("the field tables themselves", () => {
	it("covers every compared field with a sample value", () => {
		assert.deepStrictEqual(
			Object.keys(TABLES.COMPARED_FIELDS).sort(),
			Object.keys(CHANGED).sort(),
			"a new CalloutDefinition field needs a decision here, not just in the type",
		);
	});

	it("omits the three fields that identify a built-in rather than describe it", () => {
		// `id` identifies the pair; `builtIn` and `source` are what make it a
		// built-in in the first place. Everything else is a visible difference.
		for (const key of ["id", "builtIn", "source"]) {
			assert.ok(!(key in TABLES.COMPARED_FIELDS), key);
		}
	});

	it("declares exactly hideIcon and styleMode as colour-neutral", () => {
		// Both are edits the user can see that say nothing about what colour the
		// callout should be. `styleMode` is the sharper case: forcing an
		// untouched `[!info]` asks for core's own blue at a weight the theme
		// cannot reach, so counting it here would bake a literal hex and drop
		// the deference the request depends on.
		assert.deepStrictEqual(
			[...TABLES.COLOUR_NEUTRAL_FIELDS].sort(),
			["hideIcon", "styleMode"],
		);
	});

	it("keeps every colour-neutral field inside the compared set", () => {
		// A neutral field outside COMPARED_FIELDS would be neutral by accident
		// — never compared at all, and so never persisted either.
		for (const key of TABLES.COLOUR_NEUTRAL_FIELDS) {
			assert.ok(TABLES.COMPARED_FIELDS[key], key);
		}
	});
});

describe("isBuiltInModified — the persistence gate", () => {
	for (const [field, partial] of Object.entries(CHANGED)) {
		it(`counts a change to \`${field}\``, () => {
			const registry = loaded();
			registry.update("note", partial);

			assert.strictEqual(
				registry.isBuiltInModified("note"),
				true,
				`editing ${field} alone must survive a reload`,
			);
			assert.deepStrictEqual(
				registry.toSaveData().callouts.map((d) => d.id),
				["note"],
			);
		});
	}

	it("compares structurally, so nested values need no per-field spelling", () => {
		const registry = loaded();
		registry.update("note", { metadata: { a: "1" } });
		assert.strictEqual(registry.isBuiltInModified("note"), true);

		registry.update("note", { metadata: undefined });
		assert.strictEqual(registry.isBuiltInModified("note"), false);
	});

	it("treats an explicitly-undefined field as absent, like a JSON round trip", () => {
		const registry = loaded();
		registry.update("note", { bgColorLight: undefined, aliases: undefined });
		assert.strictEqual(registry.isBuiltInModified("note"), false);
	});

	it("does not read a bare-vs-prefixed Lucide spelling as an edit", () => {
		// `constants.ts` spells a built-in's icon `pencil`; the picker spells
		// the same drawing `lucide-pencil`. An untouched built-in would read as
		// customized the moment its owner merely opened the picker.
		const registry = loaded();
		assert.deepStrictEqual(note(registry).icon, { type: "lucide", value: "pencil" });

		registry.update("note", { icon: { type: "lucide", value: "lucide-pencil" } });
		assert.strictEqual(registry.isBuiltInModified("note"), false);
	});

	it("still sees a genuinely different Lucide icon", () => {
		const registry = loaded();
		registry.update("note", { icon: { type: "lucide", value: "lucide-star" } });
		assert.strictEqual(registry.isBuiltInModified("note"), true);
	});

	it("sees a difference in an icon field other than type and value", () => {
		const registry = loaded();
		registry.update("note", {
			icon: { type: "lucide", value: "pencil", recolor: true } as CalloutDefinition["icon"],
		});
		assert.strictEqual(registry.isBuiltInModified("note"), true);
	});
});

describe("isUnmodifiedBuiltIn — the theme-deference gate", () => {
	it("is true for a built-in exactly as shipped", () => {
		const registry = loaded();
		for (const def of registry.getBuiltIn()) {
			assert.strictEqual(registry.isUnmodifiedBuiltIn(def), true, def.id);
		}
	});

	it("is false for anything that is not a built-in", () => {
		const registry = loaded();
		assert.strictEqual(
			registry.isUnmodifiedBuiltIn({ ...note(registry), builtIn: false }),
			false,
		);
	});

	it("is false for a built-in id the registry never shipped", () => {
		const registry = loaded();
		assert.strictEqual(
			registry.isUnmodifiedBuiltIn({ ...note(registry), id: "invented" }),
			false,
		);
	});

	for (const [field, partial] of Object.entries(CHANGED)) {
		const neutral = TABLES.COLOUR_NEUTRAL_FIELDS.has(field);
		it(`${neutral ? "keeps" : "drops"} the deference after a change to \`${field}\``, () => {
			const registry = loaded();
			registry.update("note", partial);

			assert.strictEqual(
				registry.isUnmodifiedBuiltIn(note(registry)),
				neutral,
				neutral
					? `${field} says nothing about colour — the theme must keep deciding`
					: `${field} is the user's claim on the callout; the hex must win`,
			);
		});
	}

	it("drops the deference once a colour edit joins a neutral one", () => {
		const registry = loaded();
		registry.update("note", { hideIcon: true, colorLight: "#ff0000" });
		assert.strictEqual(registry.isUnmodifiedBuiltIn(note(registry)), false);
	});

	it("takes the definition, not an id, so a live preview answers for itself", () => {
		// The preview is registered under a real built-in's id while holding
		// unsaved colours; answering for the stored row would drop the very
		// colours the preview exists to show.
		const registry = loaded();
		const draft: CalloutDefinition = { ...note(registry), colorLight: "#ff0000" };

		assert.strictEqual(registry.isUnmodifiedBuiltIn(draft), false);
		assert.strictEqual(
			registry.isUnmodifiedBuiltIn(note(registry)),
			true,
			"the stored row is still pristine",
		);
	});

	it("is strictly the narrower of the two questions", () => {
		// For every compared field: modified ⇒ not-unmodified, except for the
		// declared neutral ones. This is the invariant the pair exists to hold.
		for (const [field, partial] of Object.entries(CHANGED)) {
			const registry = loaded();
			registry.update("note", partial);

			const modified = registry.isBuiltInModified("note");
			const unmodified = registry.isUnmodifiedBuiltIn(note(registry));
			assert.strictEqual(modified, true, field);
			assert.strictEqual(
				unmodified,
				TABLES.COLOUR_NEUTRAL_FIELDS.has(field),
				field,
			);
		}
	});
});
