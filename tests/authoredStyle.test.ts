/**
 * tests/authoredStyle.test.ts — did the user choose this colour, or is the form
 * merely showing one it invented?
 *
 * The editor's state is always concrete: a swatch has to draw *something*, so
 * the modal fills the background hexes from the accent tint, the text colours
 * from `DEFAULT_TEXT_COLOR_*` and the sliders from `DEFAULT_ICON_ADJUST` when
 * the definition it opened on carried none. A `CalloutDefinition` is not like
 * that — an absent field is load-bearing:
 *
 * - no background means Obsidian's own translucent fill keeps painting, which
 *   is the whole reason nested callouts step;
 * - no text colour means the theme's `--text-normal` keeps winning;
 * - no icon adjustment (with nothing else set) keeps a built-in reading as
 *   unmodified, so it goes on deferring to the theme's `--callout-*` variables.
 *
 * So writing a default the user never picked is a real edit. It used to mean
 * opening a built-in and saving *anything* pinned its accent to a hex forever,
 * and it used to mean merely opening the editor restyled every callout of that
 * type in the vault behind the modal — the live preview registered a definition
 * carrying an 18% background where the real one had none.
 *
 * Two callers ask these questions, the save and the live preview, and they must
 * agree or the callout changes appearance on save. That is why the predicates
 * are one module and why they are pinned here rather than through either caller.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	hasAuthoredBackground,
	hasAuthoredIconAdjust,
	hasAuthoredTextColors,
	type AuthoredBackgroundState,
} from "../src/settings/editor/authoredStyle";
import { DEFAULT_TEXT_COLOR_DARK, DEFAULT_TEXT_COLOR_LIGHT, bgTintFor } from "../src/utils/colorUtils";
import { DEFAULT_ICON_ADJUST } from "../src/utils/iconAdjust";
import type { CalloutDefinition } from "../src/types";

const ACCENT_LIGHT = "#448aff";
const ACCENT_DARK = "#5c9bff";

/**
 * The form as the modal fills it for a definition carrying NO background: the
 * accent, tinted, at whatever strength is being asked about.
 */
function derivedState(over: Partial<AuthoredBackgroundState> = {}, amount?: number): AuthoredBackgroundState {
	return {
		colorLight: ACCENT_LIGHT,
		colorDark: ACCENT_DARK,
		bgColorLight: bgTintFor(ACCENT_LIGHT, false, amount),
		bgColorDark: bgTintFor(ACCENT_DARK, true, amount),
		transparentBg: false,
		...over,
	};
}

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "x",
		displayName: "X",
		icon: { type: "lucide", value: "star" },
		colorLight: ACCENT_LIGHT,
		colorDark: ACCENT_DARK,
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

/* -------------------------------------------------------------------------- */
/* hasAuthoredBackground                                                      */
/* -------------------------------------------------------------------------- */

describe("hasAuthoredBackground — the derived case", () => {
	it("is false for the tint the modal itself derived", () => {
		// The form is holding two concrete hexes and the user chose neither.
		assert.strictEqual(hasAuthoredBackground(derivedState()), false);
	});

	it("stays false at a tint strength the intensity slider produced", () => {
		// Solved, not compared against the default 18%: the palette editor makes
		// tints at any strength, and a fixed-amount comparison would only
		// recognise the ones that happened to land on the default — every other
		// palette would then bake its background onto every callout using it.
		for (const amount of [0.05, 0.12, 0.25, 0.4]) {
			assert.strictEqual(
				hasAuthoredBackground(derivedState({}, amount)),
				false,
				`amount ${amount} read as authored`,
			);
		}
	});
});

describe("hasAuthoredBackground — the authored cases", () => {
	it("is true for a light background that does not solve", () => {
		assert.strictEqual(hasAuthoredBackground(derivedState({ bgColorLight: "#ffeeaa" })), true);
	});

	it("is true for a dark background that does not solve", () => {
		// Either half is enough — the two modes are independent picks.
		assert.strictEqual(hasAuthoredBackground(derivedState({ bgColorDark: "#402000" })), true);
	});

	it("is true whenever there is a gradient at all", () => {
		// A sweep is never something the form invents.
		assert.strictEqual(
			hasAuthoredBackground(
				derivedState({
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#ffd9d9",
						toColorDark: "#3a1c1c",
					},
				}),
			),
			true,
		);
	});
});

describe("hasAuthoredBackground — transparency short-circuits", () => {
	// The flag IS the background, so the hexes the form is still holding beside
	// it describe nothing, and neither does a gradient reaching it from data the
	// editor never wrote.
	it("is false for a transparent callout with hand-picked hexes", () => {
		assert.strictEqual(
			hasAuthoredBackground(
				derivedState({
					transparentBg: true,
					bgColorLight: "#ffeeaa",
					bgColorDark: "#402000",
				}),
			),
			false,
		);
	});

	it("is false for a transparent callout carrying a gradient", () => {
		assert.strictEqual(
			hasAuthoredBackground(
				derivedState({
					transparentBg: true,
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#ffd9d9",
						toColorDark: "#3a1c1c",
					},
				}),
			),
			false,
		);
	});
});

/* -------------------------------------------------------------------------- */
/* hasAuthoredTextColors                                                      */
/* -------------------------------------------------------------------------- */

describe("hasAuthoredTextColors — a definition that already carried one", () => {
	// A user is entitled to pick the default colour deliberately, so a stored
	// value is kept whatever it says. Anything else would silently drop it on
	// the next save.
	it("is true when the light colour is stored, defaults in the form or not", () => {
		const baseline = def({ textColorLight: DEFAULT_TEXT_COLOR_LIGHT });
		assert.strictEqual(hasAuthoredTextColors(baseline, DEFAULT_TEXT_COLOR_LIGHT, DEFAULT_TEXT_COLOR_DARK), true);
	});

	it("is true when only the dark colour is stored", () => {
		assert.strictEqual(
			hasAuthoredTextColors(def({ textColorDark: "#ffffff" }), DEFAULT_TEXT_COLOR_LIGHT, DEFAULT_TEXT_COLOR_DARK),
			true,
		);
	});
});

describe("hasAuthoredTextColors — a definition that carried none", () => {
	const fresh = def();

	it("is false while the form still holds both invented defaults", () => {
		assert.strictEqual(hasAuthoredTextColors(fresh, DEFAULT_TEXT_COLOR_LIGHT, DEFAULT_TEXT_COLOR_DARK), false);
	});

	it("is true once either half moves off its default", () => {
		assert.strictEqual(hasAuthoredTextColors(fresh, "#000000", DEFAULT_TEXT_COLOR_DARK), true);
		assert.strictEqual(hasAuthoredTextColors(fresh, DEFAULT_TEXT_COLOR_LIGHT, "#ffffff"), true);
	});

	it("treats a brand-new callout (no baseline at all) the same way", () => {
		assert.strictEqual(hasAuthoredTextColors(undefined, DEFAULT_TEXT_COLOR_LIGHT, DEFAULT_TEXT_COLOR_DARK), false);
		assert.strictEqual(hasAuthoredTextColors(undefined, "#123456", DEFAULT_TEXT_COLOR_DARK), true);
	});

	it("compares the hex as written, without normalizing case", () => {
		// Worth stating rather than assuming: the form only ever hands back what
		// the colour input produced, which is lowercase, so an uppercase spelling
		// reaching here means it came from somewhere else and is a real value.
		assert.strictEqual(
			hasAuthoredTextColors(fresh, DEFAULT_TEXT_COLOR_LIGHT.toUpperCase(), DEFAULT_TEXT_COLOR_DARK),
			true,
		);
	});
});

/* -------------------------------------------------------------------------- */
/* hasAuthoredIconAdjust                                                      */
/* -------------------------------------------------------------------------- */

describe("hasAuthoredIconAdjust — a definition that already carried one", () => {
	// Both storage layers count: the per-role map and the flat legacy trio.
	// Either one present means the definition already had an adjustment, and
	// dropping it because the *regular* role happens to sit at the default
	// would throw away the heading and inline ones with it.
	const cases: Array<[string, Partial<CalloutDefinition>]> = [
		["a per-role iconAdjust map", { iconAdjust: { heading: { offsetY: 2 } } }],
		["a legacy iconOffsetX", { iconOffsetX: 0 }],
		["a legacy iconOffsetY", { iconOffsetY: 0 }],
		["a legacy iconSize", { iconSize: 1 }],
	];

	for (const [name, over] of cases) {
		it(`is true for ${name}, even at the default value`, () => {
			assert.strictEqual(hasAuthoredIconAdjust(def(over), { ...DEFAULT_ICON_ADJUST }), true);
		});
	}
});

describe("hasAuthoredIconAdjust — a definition that carried none", () => {
	const fresh = def();

	it("is false while every slider sits where the modal started it", () => {
		assert.strictEqual(hasAuthoredIconAdjust(fresh, { ...DEFAULT_ICON_ADJUST }), false);
	});

	it("is true once any one slider moves", () => {
		const moved: Array<[string, Parameters<typeof hasAuthoredIconAdjust>[1]]> = [
			["offsetX", { ...DEFAULT_ICON_ADJUST, offsetX: -2 }],
			["offsetY", { ...DEFAULT_ICON_ADJUST, offsetY: 3 }],
			["size", { ...DEFAULT_ICON_ADJUST, size: 1.2 }],
		];
		for (const [name, adjust] of moved) {
			assert.strictEqual(hasAuthoredIconAdjust(fresh, adjust), true, `${name} did not register`);
		}
	});

	it("treats a brand-new callout (no baseline at all) the same way", () => {
		assert.strictEqual(hasAuthoredIconAdjust(undefined, { ...DEFAULT_ICON_ADJUST }), false);
		assert.strictEqual(
			hasAuthoredIconAdjust(undefined, {
				...DEFAULT_ICON_ADJUST,
				size: 0.75,
			}),
			true,
		);
	});
});
