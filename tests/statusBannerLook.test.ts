/**
 * tests/statusBannerLook.test.ts — the two banners under the settings title,
 * "Saving is paused" and the import prompt, look like the warning box
 * Obsidian's Keychain settings show (finding GAP-08).
 *
 * - Obsidian's callout geometry: `--callout-radius`, `--callout-padding`, and
 *   the paused banner's title in `--callout-title-weight`.
 * - A 10% tint mixed as Obsidian mixes a callout's, of `--text-warning` or
 *   `--interactive-accent`; never `--callout-warning`, which some themes still
 *   declare as an RGB triplet, and never `rgba(var(--callout-…))`, which is
 *   invalid since Obsidian 1.13 made those full colours.
 * - No outline, as Obsidian's box has none.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseRules, valueOf, type CssRule } from "./support/cssInjectorHarness";

const rules = parseRules(readFileSync(join(process.cwd(), "styles.css"), "utf8"));

/** The one rule written exactly for `selector`, outside any media query. */
function only(selector: string): CssRule {
	const hits = rules.filter(
		(r) =>
			r.at.length === 0 &&
			r.selector
				.split(",")
				.map((s) => s.trim())
				.includes(selector),
	);
	assert.equal(hits.length, 1, `expected one rule for ${selector}, found ${hits.length}`);
	return hits[0]!;
}

describe("the banners under the settings title", () => {
	for (const [selector, colour] of [
		[".cs-readonly-banner", "--text-warning"],
		[".cs-competitor-import-banner", "--interactive-accent"],
	] as const) {
		it(`${selector} takes Obsidian's callout geometry and a 10% tint, with no outline`, () => {
			const rule = only(selector);
			assert.equal(valueOf(rule, "border-radius"), "var(--callout-radius)");
			assert.equal(valueOf(rule, "padding"), "var(--callout-padding)");
			assert.equal(valueOf(rule, "background"), `color-mix(in oklch, var(${colour}) 10%, transparent)`);
			assert.deepEqual(
				rule.props.filter((p) => p === "border" || (p.startsWith("border-") && p !== "border-radius")),
				[],
			);
		});
	}

	it("titles the paused banner as Obsidian titles its warning box", () => {
		const title = only(".cs-readonly-banner-title");
		assert.equal(valueOf(title, "color"), "var(--text-warning)");
		assert.equal(valueOf(title, "font-weight"), "var(--callout-title-weight)");
	});

	it("never reads a callout colour token", () => {
		const banners = rules.filter((r) => /\.cs-(?:readonly-banner|competitor-import-banner)/.test(r.selector));
		assert.ok(banners.length >= 4, "found the banner rules");
		for (const rule of banners) {
			for (const decl of rule.decls)
				assert.doesNotMatch(decl, /--callout-(?:warning|color)\b/, `${rule.selector}: ${decl}`);
		}
	});
});
