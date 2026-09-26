/**
 * tests/importBoxStyles.test.ts — the shared import/export option boxes and
 * the Recommended pill, as styles.css draws them.
 *
 * pluginImportModal.test.ts drives the window on the fake DOM, which has no
 * cascade, so none of this is visible to it. Each rule here is one a tidy-up
 * would plausibly "restore":
 *
 * - Every enabled box gets the same neutral hover wash and clearer border.
 *   Disabled boxes stay grey, with a not-allowed cursor and no hover wash.
 * - The active box lightens on hover. Lighter is more of the lighter accent
 *   over a dark window and less of it over a light one, so the two themes move
 *   the percentage in opposite directions — which looks like a mistake and
 *   isn't.
 * - Both hovers sit behind `(hover: hover)`, so a tapped box on a phone doesn't
 *   stay lit.
 * - The pill's word is trimmed to cap height and baseline. Without that, a UI
 *   font with a deep line box below the baseline (Ploni, and most Hebrew faces)
 *   sets the word visibly high in the pill.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseRules, valueOf, type CssRule } from "./support/cssInjectorHarness";

const rules = parseRules(readFileSync(join(process.cwd(), "styles.css"), "utf8"));

const HOVER_MEDIA = "@media (hover: hover)";
const TEXT_BOX = "@supports (text-box: trim-both cap alphabetic)";

/** Every rule whose selector list names `selector` as one of its entries. */
function rulesNaming(selector: string): CssRule[] {
	return rules.filter((r) => r.selector.split(",").map((s) => s.trim()).includes(selector));
}

function only(selector: string): CssRule {
	const hits = rulesNaming(selector);
	assert.equal(hits.length, 1, `expected one rule for ${selector}, found ${hits.length}`);
	return hits[0]!;
}

/** The accent share of a `color-mix(in srgb, <accent> N%, transparent)` wash. */
function washPercent(rule: CssRule, accent: string): number {
	const value = valueOf(rule, "background") ?? "";
	const match = new RegExp(
		`^color-mix\\(in srgb, var\\(${accent}\\) (\\d+(?:\\.\\d+)?)%, transparent\\)$`,
	).exec(value);
	assert.ok(match, `${rule.selector}: expected a ${accent} wash, got "${value}"`);
	return Number(match[1]);
}

describe("the shared import/export boxes on hover", () => {
	it("gives an enabled box a subtle neutral wash and a distinct border", () => {
		const rule = only('.cs-option-box[tabindex="0"]:not(.is-selected):hover');
		assert.deepEqual(rule.at, [HOVER_MEDIA]);
		assert.equal(valueOf(rule, "background"), "var(--background-modifier-hover)");
		assert.equal(valueOf(rule, "border-color"), "var(--background-modifier-border-focus)");
	});

	it("reserves hover feedback for enabled or selected boxes on hover-capable devices", () => {
		const painted = rules.filter(
			(r) =>
				r.selector.includes(".cs-option-box") &&
				r.selector.includes(":hover") &&
				r.props.some((p) => p === "background" || p === "background-color"),
		);
		assert.ok(painted.length > 0);
		for (const rule of painted) {
			assert.deepEqual(rule.at, [HOVER_MEDIA]);
			assert.match(rule.selector, /\.cs-option-box(?:\[tabindex="0"\]:not\(\.is-selected\)|\.is-selected):hover(?: \.cs-recommended-badge)?$/, rule.selector);
		}
	});

	it("lightens the active box's wash on hover, in both themes", () => {
		const rest = washPercent(only(".cs-option-box.is-selected"), "--interactive-accent");
		const dark = only(".theme-dark .cs-option-box.is-selected:hover");
		const light = only(".theme-light .cs-option-box.is-selected:hover");
		assert.deepEqual(dark.at, [HOVER_MEDIA]);
		assert.deepEqual(light.at, [HOVER_MEDIA]);
		assert.ok(
			washPercent(dark, "--interactive-accent-hover") > rest,
			"over a dark window, lighter is more of the accent",
		);
		const lightShare = washPercent(light, "--interactive-accent-hover");
		assert.ok(lightShare < rest, "over a light window, lighter is less of it");
		assert.ok(lightShare > 0, "and still some, so the box stays purple");
	});

	it("greys the disabled icon, title and empty-state reason and uses the not-allowed cursor", () => {
		assert.equal(valueOf(only(".cs-option-box.is-disabled"), "cursor"), "not-allowed");
		for (const child of ["icon", "title", "desc:not(.is-warning)"]) {
			const rule = only(`.cs-option-box.is-disabled .cs-option-box-${child}`);
			assert.equal(valueOf(rule, "color"), "var(--text-faint)");
		}
		assert.equal(
			valueOf(only(".cs-option-box-desc.is-warning"), "color"),
			"var(--text-warning)",
			"an unreadable file still explains the problem as a warning",
		);
	});
});

describe("the Recommended pill", () => {
	it("centres its word on the capitals, where text-box is supported", () => {
		const word = only(".cs-recommended-badge-text");
		assert.deepEqual(word.at, [TEXT_BOX]);
		assert.equal(valueOf(word, "text-box"), "trim-both cap alphabetic");
		const pill = rulesNaming(".cs-recommended-badge").find((r) => r.at.includes(TEXT_BOX));
		assert.ok(pill, "the trimmed pill sets its own block padding");
		assert.ok(valueOf(pill, "padding-block"), "with the line box gone, padding is the pill's height");
	});

	it("sets its word a step below the UI's smaller size", () => {
		const pill = rulesNaming(".cs-recommended-badge").find((r) => r.at.length === 0);
		assert.ok(pill);
		assert.equal(valueOf(pill, "font-size"), "calc(var(--font-ui-smaller) - 1px)");
	});
});
