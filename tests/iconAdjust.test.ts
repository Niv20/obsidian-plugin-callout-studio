/**
 * tests/iconAdjust.test.ts — what actually gets written to data.json.
 *
 * Two layers store one thing here — a per-role `iconAdjust` map over a flat
 * legacy trio — and the whole module exists so nothing outside it reads either
 * layer directly. The tests are aimed at the two rules that are easy to state
 * wrongly and expensive to get wrong:
 *
 * - **Resolution is per FIELD, not per role object.** A role entry that sets
 *   only `offsetY` still inherits the definition's legacy `iconSize`. Falling
 *   back per object instead would snap a hand-edited file's size back to 1.
 * - **`buildIconAdjust` omits a role when it matches `regular`, NOT when it
 *   matches the neutral default.** The caller mirrors `regular` into the legacy
 *   trio, and that trio is what an omitted role falls back to — so omitting on
 *   neutral would resurrect regular's offset on any role the user deliberately
 *   zeroed. All three matching collapses to `undefined`, which is what leaves
 *   an untouched callout byte-identical in `data.json` and keeps the registry's
 *   modified-built-in comparison honest.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	DEFAULT_ICON_ADJUST,
	ICON_ADJUST_LIMITS,
	buildIconAdjust,
	cloneIconAdjustFields,
	equalIconAdjust,
	iconAdjustSourcesEqual,
	isDefaultIconAdjust,
	resolveIconAdjust,
	type ResolvedIconAdjust,
} from "../src/utils/iconAdjust";
import { definitionIconAdjustFields } from "../src/settings/editor/definitionIconAdjust";
import type { CalloutDefinition, CalloutRenderRole } from "../src/types";

type Source = Pick<
	CalloutDefinition,
	"iconAdjust" | "iconOffsetX" | "iconOffsetY" | "iconSize"
>;

const ROLES: CalloutRenderRole[] = ["regular", "heading", "inline"];

function adjust(over: Partial<ResolvedIconAdjust> = {}): ResolvedIconAdjust {
	return { ...DEFAULT_ICON_ADJUST, ...over };
}

describe("resolveIconAdjust — the neutral case", () => {
	it("returns the default for a missing definition", () => {
		assert.deepStrictEqual(resolveIconAdjust(null, "regular"), DEFAULT_ICON_ADJUST);
		assert.deepStrictEqual(
			resolveIconAdjust(undefined, "heading"),
			DEFAULT_ICON_ADJUST,
		);
	});

	it("returns a fresh object, never DEFAULT_ICON_ADJUST itself", () => {
		// The editor writes into what it gets back; a shared reference would
		// let one callout's nudge become every callout's default.
		const a = resolveIconAdjust(null, "regular");
		assert.notEqual(a, DEFAULT_ICON_ADJUST);
		a.offsetX = 7;
		assert.equal(DEFAULT_ICON_ADJUST.offsetX, 0);
		assert.equal(resolveIconAdjust(null, "regular").offsetX, 0);
	});

	it("returns the default for a definition that adjusts nothing", () => {
		assert.deepStrictEqual(resolveIconAdjust({}, "inline"), DEFAULT_ICON_ADJUST);
	});
});

describe("resolveIconAdjust — the two layers", () => {
	it("reads the legacy trio when there is no per-role map", () => {
		const def: Source = { iconOffsetX: 3, iconOffsetY: -2, iconSize: 1.2 };
		for (const role of ROLES) {
			assert.deepStrictEqual(
				resolveIconAdjust(def, role),
				{ offsetX: 3, offsetY: -2, size: 1.2 },
				role,
			);
		}
	});

	it("lets a role entry override the trio", () => {
		const def: Source = {
			iconOffsetX: 3,
			iconOffsetY: -2,
			iconSize: 1.2,
			iconAdjust: { heading: { offsetX: 0, offsetY: 0, size: 1 } },
		};
		assert.deepStrictEqual(resolveIconAdjust(def, "heading"), DEFAULT_ICON_ADJUST);
		assert.deepStrictEqual(resolveIconAdjust(def, "regular"), {
			offsetX: 3,
			offsetY: -2,
			size: 1.2,
		});
	});

	it("falls back FIELD by field, not role object by role object", () => {
		// The rule that makes hand-edited and older files keep rendering: a
		// partial role entry inherits the rest of the trio rather than snapping
		// the unset fields back to neutral.
		const def: Source = {
			iconOffsetX: 3,
			iconOffsetY: -2,
			iconSize: 1.4,
			iconAdjust: { heading: { offsetY: 5 } },
		};
		assert.deepStrictEqual(resolveIconAdjust(def, "heading"), {
			offsetX: 3,
			offsetY: 5,
			size: 1.4,
		});
	});

	it("falls through to the default when neither layer has a field", () => {
		const def: Source = { iconAdjust: { inline: { size: 0.8 } } };
		assert.deepStrictEqual(resolveIconAdjust(def, "inline"), {
			offsetX: 0,
			offsetY: 0,
			size: 0.8,
		});
	});

	it("uses the trio for a role the map does not mention", () => {
		const def: Source = {
			iconOffsetY: 4,
			iconAdjust: { heading: { offsetY: 1 } },
		};
		assert.equal(resolveIconAdjust(def, "inline").offsetY, 4);
		assert.equal(resolveIconAdjust(def, "regular").offsetY, 4);
		assert.equal(resolveIconAdjust(def, "heading").offsetY, 1);
	});

	it("respects a role entry that deliberately zeroes a nudged trio", () => {
		// The zero must win over the trio's 4; `?? ` and not `||` is what makes
		// that true, and a regression here is invisible until someone tries it.
		const def: Source = {
			iconOffsetY: 4,
			iconAdjust: { inline: { offsetY: 0 } },
		};
		assert.equal(resolveIconAdjust(def, "inline").offsetY, 0);
	});
});

describe("resolveIconAdjust — clamping untrusted values", () => {
	const { offset, size } = ICON_ADJUST_LIMITS;

	it("clamps offsets to the slider's range", () => {
		assert.equal(resolveIconAdjust({ iconOffsetX: 999 }, "regular").offsetX, offset.max);
		assert.equal(resolveIconAdjust({ iconOffsetX: -999 }, "regular").offsetX, offset.min);
		assert.equal(resolveIconAdjust({ iconOffsetY: 10.5 }, "regular").offsetY, offset.max);
	});

	it("clamps size to the slider's range", () => {
		assert.equal(resolveIconAdjust({ iconSize: 99 }, "regular").size, size.max);
		assert.equal(resolveIconAdjust({ iconSize: 0.01 }, "regular").size, size.min);
		assert.equal(resolveIconAdjust({ iconSize: 0 }, "regular").size, size.min);
		assert.equal(resolveIconAdjust({ iconSize: -1 }, "regular").size, size.min);
	});

	it("keeps a value that is exactly on a bound", () => {
		assert.equal(resolveIconAdjust({ iconOffsetX: offset.min }, "regular").offsetX, offset.min);
		assert.equal(resolveIconAdjust({ iconSize: size.max }, "regular").size, size.max);
	});

	it("falls back to the default for anything that is not a finite number", () => {
		for (const junk of [NaN, Infinity, -Infinity, "3", null, {}, true]) {
			const def = {
				iconOffsetX: junk,
				iconOffsetY: junk,
				iconSize: junk,
			} as unknown as Source;
			assert.deepStrictEqual(
				resolveIconAdjust(def, "regular"),
				DEFAULT_ICON_ADJUST,
				JSON.stringify(junk),
			);
		}
	});

	it("clamps the per-role layer too, not just the legacy one", () => {
		const def: Source = { iconAdjust: { heading: { offsetX: 500, size: 9 } } };
		assert.deepStrictEqual(resolveIconAdjust(def, "heading"), {
			offsetX: offset.max,
			offsetY: 0,
			size: size.max,
		});
	});

	it("skips a junk role value in favour of the trio", () => {
		const def = {
			iconOffsetY: 3,
			iconAdjust: { heading: { offsetY: NaN } },
		} as unknown as Source;
		// NaN is not `undefined`, so it wins the `??` and then fails the clamp's
		// finite check — landing on the neutral default rather than the trio.
		assert.equal(resolveIconAdjust(def, "heading").offsetY, 0);
	});

	it("always returns something renderable, whatever the file said", () => {
		const def = {
			iconOffsetX: "x",
			iconAdjust: { regular: { size: null } },
		} as unknown as Source;
		for (const role of ROLES) {
			const a = resolveIconAdjust(def, role);
			assert.ok(Number.isFinite(a.offsetX) && Number.isFinite(a.offsetY));
			assert.ok(a.size >= size.min && a.size <= size.max);
		}
	});
});

describe("iconAdjustSourcesEqual — rendered equality", () => {
	it("accepts different raw shapes that resolve identically", () => {
		assert.equal(
			iconAdjustSourcesEqual(
				{ iconOffsetX: 2, iconOffsetY: 0, iconSize: 1 },
				{
					iconAdjust: {
						regular: { offsetX: 2 },
						heading: { offsetX: 2 },
						inline: { offsetX: 2 },
					},
				},
			),
			true,
		);
	});

	it("rejects a difference in any one role", () => {
		assert.equal(
			iconAdjustSourcesEqual(
				{},
				{ iconAdjust: { heading: { offsetY: 1 } } },
			),
			false,
		);
	});

	it("clones the raw fields without inventing absent defaults", () => {
		const source: Source = {
			iconAdjust: { heading: { offsetX: 2 } },
		};
		const cloned = cloneIconAdjustFields(source);
		assert.deepStrictEqual(cloned, {
			iconAdjust: { heading: { offsetX: 2 } },
			iconOffsetX: undefined,
			iconOffsetY: undefined,
			iconSize: undefined,
		});
		assert.notStrictEqual(cloned.iconAdjust, source.iconAdjust);
	});

	it("restores a future non-neutral built-in's raw storage shape", () => {
		const shipped = {
			iconOffsetX: 2,
			iconOffsetY: -1,
			iconSize: 1.1,
			iconAdjust: { heading: { offsetX: 0, offsetY: 3, size: 0.9 } },
		} as CalloutDefinition;
		const stored = definitionIconAdjustFields(
			{
				iconOffsetX: 2,
				iconOffsetY: -1,
				iconSize: 1.1,
				iconAdjust: {
					heading: { offsetX: 0, offsetY: 3, size: 0.9 },
				},
			},
			{ ...shipped, iconOffsetX: 5 },
			undefined,
			shipped,
		);

		assert.deepStrictEqual(stored, cloneIconAdjustFields(shipped));
		assert.notStrictEqual(stored.iconAdjust, shipped.iconAdjust);
	});
});

describe("isDefaultIconAdjust / equalIconAdjust", () => {
	it("recognizes the neutral adjustment", () => {
		assert.equal(isDefaultIconAdjust(DEFAULT_ICON_ADJUST), true);
		assert.equal(isDefaultIconAdjust(adjust()), true);
	});

	it("rejects a deviation in any single field", () => {
		assert.equal(isDefaultIconAdjust(adjust({ offsetX: 1 })), false);
		assert.equal(isDefaultIconAdjust(adjust({ offsetY: -1 })), false);
		assert.equal(isDefaultIconAdjust(adjust({ size: 1.01 })), false);
	});

	it("compares field-wise, not by reference", () => {
		assert.equal(equalIconAdjust(adjust(), adjust()), true);
		assert.equal(equalIconAdjust(adjust({ size: 1.2 }), adjust({ size: 1.2 })), true);
		assert.equal(equalIconAdjust(adjust({ size: 1.2 }), adjust({ size: 1.3 })), false);
	});

	it("is symmetric and reflexive", () => {
		const a = adjust({ offsetX: 2, size: 1.1 });
		const b = adjust({ offsetX: 2, size: 1.1 });
		assert.equal(equalIconAdjust(a, a), true);
		assert.equal(equalIconAdjust(a, b), equalIconAdjust(b, a));
	});
});

describe("buildIconAdjust — what reaches data.json", () => {
	const byRole = (
		regular: ResolvedIconAdjust,
		heading = regular,
		inline = regular,
	): Record<CalloutRenderRole, ResolvedIconAdjust> => ({
		regular,
		heading,
		inline,
	});

	it("stores nothing when all three roles agree", () => {
		// Not merely when they are neutral — an untouched callout and a callout
		// nudged identically across all roles both write no map at all, and the
		// trio carries the value.
		assert.equal(buildIconAdjust(byRole(adjust())), undefined);
		assert.equal(buildIconAdjust(byRole(adjust({ offsetY: 3, size: 1.2 }))), undefined);
	});

	it("never stores `regular` itself — the trio is where it goes", () => {
		const out = buildIconAdjust(
			byRole(adjust({ offsetY: 3 }), adjust({ offsetY: 1 }), adjust({ offsetY: 3 })),
		);
		assert.deepStrictEqual(Object.keys(out ?? {}), ["heading"]);
	});

	it("stores only the roles that differ from regular", () => {
		const out = buildIconAdjust(
			byRole(adjust(), adjust({ offsetY: 2 }), adjust({ size: 0.9 })),
		);
		assert.deepStrictEqual(out, {
			heading: { offsetX: 0, offsetY: 2, size: 1 },
			inline: { offsetX: 0, offsetY: 0, size: 0.9 },
		});
	});

	it("STORES a role the user deliberately zeroed while regular stays nudged", () => {
		// The whole reason the omission rule is "matches regular" and not
		// "matches neutral": omitting this entry would send `resolveIconAdjust`
		// back to the trio and silently resurrect regular's offset.
		const out = buildIconAdjust(
			byRole(adjust({ offsetY: 4 }), adjust({ offsetY: 0 }), adjust({ offsetY: 4 })),
		);
		assert.deepStrictEqual(out, { heading: { offsetX: 0, offsetY: 0, size: 1 } });
		// Read back the way the renderer will, with regular mirrored into the
		// trio: the zero has to survive. Had the entry been omitted, this would
		// resolve to regular's 4.
		assert.equal(
			isDefaultIconAdjust(
				resolveIconAdjust({ iconAdjust: out, iconOffsetY: 4 }, "heading"),
			),
			true,
		);
	});

	it("writes every field, never a partial entry", () => {
		// The per-field fallback in resolveIconAdjust exists for hand-edited
		// files, not for this writer.
		const out = buildIconAdjust(byRole(adjust(), adjust({ offsetX: 1 })));
		assert.deepStrictEqual(Object.keys(out?.heading ?? {}).sort(), [
			"offsetX",
			"offsetY",
			"size",
		]);
	});

	it("round-trips through resolveIconAdjust", () => {
		const regular = adjust({ offsetX: 2, offsetY: 4, size: 1.2 });
		const heading = adjust({ offsetY: 0, size: 0.8 });
		const inline = adjust({ offsetX: -3 });
		const map = buildIconAdjust(byRole(regular, heading, inline));
		// The caller mirrors `regular` into the legacy trio; that pairing is
		// what makes an omitted role resolve correctly.
		const def: Source = {
			iconAdjust: map,
			iconOffsetX: regular.offsetX,
			iconOffsetY: regular.offsetY,
			iconSize: regular.size,
		};
		assert.deepStrictEqual(resolveIconAdjust(def, "regular"), regular);
		assert.deepStrictEqual(resolveIconAdjust(def, "heading"), heading);
		assert.deepStrictEqual(resolveIconAdjust(def, "inline"), inline);
	});

	it("round-trips the all-equal case, where the map is absent entirely", () => {
		const same = adjust({ offsetX: 1, offsetY: 2, size: 1.1 });
		const def: Source = {
			iconAdjust: buildIconAdjust(byRole(same)),
			iconOffsetX: same.offsetX,
			iconOffsetY: same.offsetY,
			iconSize: same.size,
		};
		assert.equal(def.iconAdjust, undefined);
		for (const role of ROLES) {
			assert.deepStrictEqual(resolveIconAdjust(def, role), same, role);
		}
	});

	it("does not alias the caller's objects into the stored map", () => {
		const heading = adjust({ offsetY: 2 });
		const out = buildIconAdjust(byRole(adjust(), heading));
		assert.notEqual(out?.heading, heading);
	});
});
