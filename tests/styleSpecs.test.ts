/**
 * tests/styleSpecs.test.ts — the style pages' slider definitions
 * (settings/styleSpecs.ts), which give each slider its range and its place in
 * the settings.
 *
 * What is checked: an inline callout's corner rounding goes to 25px, which a
 * pill at its largest text scale (1.5×) needs to round its ends fully, while
 * the other roles stop at 24px; and the slider reads and writes the inline
 * frame only.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "../src/constants";
import { cornerRoundingSlider } from "../src/settings/styleSpecs";

describe("corner rounding", () => {
	it("goes to 25px for an inline callout and 24px for the other roles", () => {
		assert.equal(cornerRoundingSlider("inline").min, 0);
		assert.equal(cornerRoundingSlider("inline").max, 25);
		assert.equal(cornerRoundingSlider("heading").max, 24);
		assert.equal(cornerRoundingSlider("regular").max, 24);
	});

	it("reads and writes the inline frame, and leaves the block frame alone", () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		const radius = cornerRoundingSlider("inline");
		assert.equal(radius.get(settings), DEFAULT_SETTINGS.globalStyle.inline.borderRadius);
		radius.set(settings, 25);
		assert.equal(settings.globalStyle.inline.borderRadius, 25);
		assert.equal(settings.globalStyle.borderRadius, DEFAULT_SETTINGS.globalStyle.borderRadius);
	});
});
