/**
 * tests/statusBannerLook.test.ts — the banners, "Saving is paused" and the
 * offers (import, website), are drawn in one box, `.cs-banner`
 * (settings/bannerBox.ts), which looks like the warning box Obsidian's
 * Keychain settings show (finding GAP-08) with the corners of the settings
 * boxes around it.
 *
 * - One place: the box's corners, padding, margins, fill and edge are set by
 *   `.cs-banner` alone; a banner's own rules lay out only its insides.
 * - The corners of an Obsidian settings box, `--setting-items-radius`; a
 *   callout's padding, `--callout-padding`; the paused banner's title in
 *   `--callout-title-weight`.
 * - A 10% tint mixed as Obsidian mixes a callout's, of the banner's tone:
 *   `--text-warning` or `--interactive-accent`; never `--callout-warning`,
 *   which some themes still declare as an RGB triplet, and never
 *   `rgba(var(--callout-…))`, which is invalid since Obsidian 1.13 made those
 *   full colours.
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

/** A property that draws the box rather than laying out what is in it. */
const drawsTheBox = (prop: string): boolean =>
	/^(?:margin|padding|border|background|corner-shape|outline|box-shadow)(?:-|$)/.test(prop);

/** A selector whose last part is a banner itself, not something inside it. */
const targetsABanner = (selector: string): boolean =>
	/\.cs-(?:banner|readonly-banner|competitor-import-banner)(?![\w-])[^\s>+~]*$/.test(selector.trim());

describe("the banners under the settings title", () => {
	it("are drawn in one box: the settings boxes' corners, a callout's padding and a 10% tint, with no outline", () => {
		const box = only(".cs-banner");
		assert.equal(valueOf(box, "border-radius"), "var(--setting-items-radius)");
		assert.equal(valueOf(box, "corner-shape"), "var(--corner-shape)");
		assert.equal(valueOf(box, "padding"), "var(--callout-padding)");
		assert.equal(valueOf(box, "background"), "color-mix(in oklch, var(--cs-banner-tint) 10%, transparent)");
		assert.deepEqual(
			box.props.filter((p) => p === "border" || (p.startsWith("border-") && p !== "border-radius")),
			[],
		);
	});

	for (const [tone, colour] of [
		["warning", "--text-warning"],
		["accent", "--interactive-accent"],
	] as const) {
		it(`tints a ${tone} banner in ${colour}`, () => {
			assert.equal(valueOf(only(`.cs-banner-${tone}`), "--cs-banner-tint"), `var(${colour})`);
		});
	}

	it("draws the box in that one rule, so a banner's own rules never set it", () => {
		const offenders = rules.flatMap((rule) =>
			rule.selector
				.split(",")
				.filter((s) => targetsABanner(s) && s.trim() !== ".cs-banner")
				.flatMap((s) =>
					rule.props
						.filter(drawsTheBox)
						// A row on the settings page lets the page space it.
						.filter((p) => !(s.trim() === ".cs-banner-row .cs-banner" && p === "margin"))
						.map((p) => `${[...rule.at, s.trim()].join(" ")} { ${p} }`),
				),
		);
		assert.deepEqual(offenders, []);
	});

	it("titles the paused banner as Obsidian titles its warning box", () => {
		const title = only(".cs-readonly-banner-title");
		assert.equal(valueOf(title, "color"), "var(--text-warning)");
		assert.equal(valueOf(title, "font-weight"), "var(--callout-title-weight)");
	});

	it("never reads a callout colour token", () => {
		const banners = rules.filter((r) =>
			/\.cs-(?:banner(?:-warning|-accent)?(?![\w-])|readonly-banner|competitor-import-banner)/.test(r.selector),
		);
		assert.ok(banners.length >= 6, "found the banner rules");
		for (const rule of banners) {
			for (const decl of rule.decls)
				assert.doesNotMatch(decl, /--callout-(?:warning|color)\b/, `${rule.selector}: ${decl}`);
		}
	});
});
