/**
 * tests/colorNames.test.ts — naming a color.
 *
 * `suggestColorName` used to match by raw RGB distance over a list that
 * included the gray/black/white anchors. RGB distance is dominated by
 * lightness, so those three swallowed every pale color: lavender came out
 * "Gray" and pastel pink came out "White". Importing a Callout Manager vault is
 * where that surfaced — a minted palette wears this name, so a callout colored
 * #c8a0ff was saved as "Gray 3".
 *
 * The two properties worth pinning down are opposites, and a fix that satisfies
 * only one is worse than no fix:
 *
 * - **Every anchor still names itself.** This is the regression guard on the
 *   HSL weights; hue alone would collapse brown onto orange, and a heavier
 *   lightness term would start collapsing the pale anchors onto each other.
 * - **A pale color is named for its hue.** The bug itself.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { suggestColorName } from "../src/utils/colorNames";

/** Every anchor in COLOR_ANCHORS, with the label `t()` resolves it to. */
const ANCHORS: ReadonlyArray<readonly [string, string]> = [
	["#f44336", "Red"],
	["#ff9800", "Orange"],
	["#ffc107", "Amber"],
	["#ffeb3b", "Yellow"],
	["#cddc39", "Lime"],
	["#4caf50", "Green"],
	["#009688", "Teal"],
	["#00bcd4", "Cyan"],
	["#03a9f4", "Sky"],
	["#2962ff", "Blue"],
	["#3f51b5", "Indigo"],
	// Both read "Purple" in English: `colorName.violet` also labels the Purple
	// preset that sits on this anchor (see en.ts). Other languages keep the two
	// words apart.
	["#7c4dff", "Purple"],
	["#9c27b0", "Purple"],
	["#e91e63", "Pink"],
	["#f06292", "Rose"],
	["#795548", "Brown"],
	["#9e9e9e", "Gray"],
	["#000000", "Black"],
	["#ffffff", "White"],
];

describe("suggestColorName — anchors name themselves", () => {
	for (const [hex, name] of ANCHORS) {
		it(`${hex} is ${name}`, () => {
			assert.equal(suggestColorName(hex), name);
		});
	}
});

describe("suggestColorName — a pale color is named for its hue", () => {
	// Each of these resolved to Gray or White before the hue weighting, which is
	// how a lavender callout ended up saved as a palette called "Gray 3".
	const cases: ReadonlyArray<readonly [string, string, string]> = [
		["#c8a0ff", "Purple", "lavender — the actual 'Gray 3' from the import"],
		["#78beff", "Blue", "light blue"],
		["#ffc0cb", "Rose", "pastel pink"],
		["#b8e6c8", "Green", "pastel mint"],
		["#d8a0a8", "Rose", "dusty rose"],
		["#16213e", "Indigo", "dark navy, previously Black"],
	];
	for (const [hex, name, why] of cases) {
		it(`${hex} (${why}) is ${name}`, () => {
			assert.equal(suggestColorName(hex), name);
		});
	}
});

describe("suggestColorName — genuinely hueless colors stay hueless", () => {
	it("names a true gray Gray, not the nearest hue", () => {
		assert.equal(suggestColorName("#9e9e9e"), "Gray");
		assert.equal(suggestColorName("#868686"), "Gray");
	});

	it("separates black and white by luminance", () => {
		assert.equal(suggestColorName("#000000"), "Black");
		assert.equal(suggestColorName("#050505"), "Black");
		assert.equal(suggestColorName("#ffffff"), "White");
		assert.equal(suggestColorName("#fbfbfb"), "White");
	});

	it("treats a washed-out color as gray even with a wide channel spread", () => {
		// The saturation guard specifically: 28 levels of channel spread clears
		// the spread test on its own, but at 13.6% saturation this is a gray with
		// a hint of green in it, and naming it "Green" would read as a mistake.
		assert.equal(suggestColorName("#8aa698"), "Gray");
	});
});
