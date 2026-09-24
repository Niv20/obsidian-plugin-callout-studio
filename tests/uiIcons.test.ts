import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Plugin } from "obsidian";
import { registerUiIcons } from "../src/icons/registerUiIcons";
import {
	PORTABLE_CONVERSION_ICON_ID,
	QUICK_INSERT_ICON_ID,
	STATISTICS_ICON_ID,
	UI_ICON_CONTENT,
} from "../src/icons/uiIcons";

const exports = [
	[QUICK_INSERT_ICON_ID, "quick-insert"],
	[STATISTICS_ICON_ID, "statistics"],
	[PORTABLE_CONVERSION_ICON_ID, "conversion"],
] as const;

describe("plugin action icon artwork", () => {
	for (const [id, file] of exports) {
		it(`${file} stays identical in the editable export and registered artwork`, () => {
			const svg = readFileSync(`assets/ui-icons/${file}.svg`, "utf8");
			assert.match(svg, /viewBox="0 0 24 24"/);
			const artwork = svg.match(/<g fill=[\s\S]*<\/g>/)?.[0];
			assert.equal(artwork, UI_ICON_CONTENT[id]);
			assert.match(svg, /ISC License/);
			assert.match(svg, /MIT License/);
		});
	}

	it("every composite can repeat on any background without colliding SVG IDs", () => {
		assert.equal(Object.keys(UI_ICON_CONTENT).length, exports.length);
		for (const content of Object.values(UI_ICON_CONTENT)) {
			assert.match(content, /fill="none" stroke="currentColor" stroke-width="2"/);
			assert.match(content, /stroke-linecap="round" stroke-linejoin="round"/);
			assert.doesNotMatch(content, /<(?:mask|clipPath|filter|image|style|use)\b|\bid=|url\(/);
			assert.doesNotMatch(content, /\bfill="(?!none")/);
		}
	});

	it("keeps transparent clearance between the conversion brush and both split arrowheads", () => {
		const paths = Array.from(UI_ICON_CONTENT[PORTABLE_CONVERSION_ICON_ID]!.matchAll(/<path d="([^"]+)"/g), (match) => match[1]!);
		assert.equal(paths.length, 7);
		const start = /^M([\d.]+) ([\d.]+)/.exec(paths[1]!);
		const end = /L([\d.]+) ([\d.]+)$/.exec(paths[1]!);
		const leftArrow = /^M[\d.]+ ([\d.]+)H([\d.]+)/.exec(paths[4]!);
		const rightArrow = /^M([\d.]+) ([\d.]+)/.exec(paths[3]!);
		assert.ok(start && end && leftArrow && rightArrow);
		// Each centerline has a 1px half-stroke. Test the remaining transparent
		// space, not merely centerline distance, to catch a visually touching badge.
		const clearance = (x: string, y: string, bx: string, by: string): number =>
			Math.hypot(Number(x) - Number(bx), Number(y) - Number(by)) - 2;
		const gaps = [
			clearance(start[1]!, start[2]!, leftArrow[2]!, leftArrow[1]!),
			clearance(end[1]!, end[2]!, rightArrow[1]!, rightArrow[2]!),
		];
		for (const gap of gaps) assert.ok(gap > 1.59 && gap < 1.62, `gap was ${gap}px`);
	});

	it("registers a cleanup for every action icon, including conversion", () => {
		const cleanups: Array<() => void> = [];
		registerUiIcons({ register: (cleanup: () => void) => { cleanups.push(cleanup); } } as unknown as Plugin);
		assert.equal(cleanups.length, exports.length);
		for (const cleanup of cleanups) assert.doesNotThrow(cleanup);
	});
});
