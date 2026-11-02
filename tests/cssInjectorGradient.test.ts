/**
 * tests/cssInjectorGradient.test.ts — the gradient surfaces: the title sweep
 * (`textGradientCss` / `textSweepProps` / `textSweepRules`), the PDF-export
 * repaint (`printGradientCSS`), and the fold chevron that closes the sweep
 * (`generateFoldArrowCSS`).
 *
 * Three bugs live here, all of which look fine on screen and only appear in an
 * exported PDF or on a second theme. Each has one line of CSS defending it:
 *
 * 1. **CoreGraphics truncates a printed gradient.** On any box, Chromium writes
 *    a gradient into the PDF as a vector axial shading, and macOS CoreGraphics
 *    (Preview, Quick Look) renders roughly the first half of the ramp — pale
 *    sweeps collapse into a near-uniform start colour. `filter: opacity(0.999)`
 *    is the fix: a filter cannot be expressed in PDF vector operators, so
 *    Chromium rasterizes the `::before` and the bitmap renders identically in
 *    every viewer. The value must not be a no-op (or it is optimized away) and
 *    must be invisible (0.999 is both). Text sits above the `::before` and stays
 *    vector.
 * 2. **Chromium resolves a degenerate gradient box on an inline-level box.** The
 *    pill is `inline-flex`, so its gradient prints as a flat wash of the END
 *    colour. Hence the absolutely-positioned `::before` — a block box with
 *    well-defined geometry — and hence `hideElementGradient` for the pill only.
 *    Block roles keep their own `background-image` so a callout fragmented
 *    across pages still has the vector gradient where the `::before` cannot
 *    reach.
 * 3. **`background-clip: text` does not print.** In print the sweep paints as an
 *    unclipped block over the title and the transparent text fill leaves
 *    garbage. There is no way to make the technique print, so print drops the
 *    sweep entirely and the per-grapheme solid colours from
 *    `gradientTitleText.ts` take over.
 *
 * The fourth invariant is the trailing `border-box` layer in `textSweepProps`:
 * `background-clip` governs `background-color` too, via the LAST layer's value,
 * so a lone `background-clip: text` clips the element's solid background to its
 * own text — erasing the heading bar and the pill.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { definition, harness, must, parseRules, ruleFor, valueOf } from "./support/cssInjectorHarness";

const PALE_LIGHT = "#eef4fa";
const PALE_DARK = "#16202b";

/** A def with a background gradient and the title sweep switched on. */
const sweptDef = (over = {}) =>
	definition({
		bgColorLight: PALE_LIGHT,
		bgColorDark: PALE_DARK,
		bgGradient: {
			angleDeg: 90,
			toColorLight: "#fdf0e6",
			toColorDark: "#2b1f16",
			textGradient: true,
			textToColorLight: "#cc5500",
			textToColorDark: "#ffaa66",
		},
		...over,
	});

describe("textGradientCss — the sweep runs between ACCENT colours", () => {
	it("is null without a gradient, and null while the text sweep is off", () => {
		const { css } = harness();
		assert.strictEqual(css.textGradientCss(definition(), "light"), null);
		assert.strictEqual(
			css.textGradientCss(
				definition({
					bgColorLight: PALE_LIGHT,
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#fdf0e6",
						toColorDark: "#2b1f16",
					},
				}),
				"light",
			),
			null,
		);
	});

	it("is null when the accent-strength end colour is missing", () => {
		const { css } = harness();
		// Gradients carrying no accent-strength pair (pre-text-sweep data, or an
		// import) opt out rather than sweeping through an invisible pale tint.
		assert.strictEqual(
			css.textGradientCss(
				definition({
					bgColorLight: PALE_LIGHT,
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#fdf0e6",
						toColorDark: "#2b1f16",
						textGradient: true,
					},
				}),
				"light",
			),
			null,
		);
	});

	it("runs from the callout's accent, never from the background's own stops", () => {
		const { css } = harness();
		// The background's stops are pale tints designed to sit BEHIND text;
		// painted through the glyphs they would be all but invisible.
		assert.strictEqual(css.textGradientCss(sweptDef(), "light"), "linear-gradient(90deg, #336699, #cc5500)");
		assert.strictEqual(css.textGradientCss(sweptDef(), "dark"), "linear-gradient(90deg, #88bbee, #ffaa66)");
	});

	it("keeps the sweep at accent strength — no tint solve here", () => {
		const { css } = harness();
		const value = css.textGradientCss(sweptDef(), "light");
		assert.ok(value);
		assert.ok(!value.includes("color-mix"), "text is painted, not composited behind — a tint would wash it out");
	});
});

describe("textSweepProps — two layers, and why the second one matters", () => {
	it("keeps a final border-box layer so the element's own background survives", () => {
		const { css } = harness();
		const props = css.textSweepProps("linear-gradient(90deg, #a, #b)", null);
		assert.deepStrictEqual(props, [
			"  background-image: linear-gradient(90deg, #a, #b), none;",
			"  -webkit-background-clip: text, border-box;",
			"  background-clip: text, border-box;",
			"  -webkit-text-fill-color: transparent;",
			"  -webkit-print-color-adjust: exact;",
			"  print-color-adjust: exact;",
		]);
	});

	it("restates the element's own background layer underneath when it owns one", () => {
		const { css } = harness();
		const props = css.textSweepProps("SWEEP", "UNDER");
		assert.strictEqual(props[0], "  background-image: SWEEP, UNDER;");
		assert.ok(props.includes("  background-clip: text, border-box;"));
	});

	it("hides the flat text with text-fill-color, leaving `color` alone", () => {
		const { css } = harness();
		const props = css.textSweepProps("SWEEP", null);
		// `color` still drives currentColor, which is how the sibling icon keeps
		// tracking the accent.
		assert.ok(props.some((p) => p.includes("-webkit-text-fill-color: transparent")));
		assert.ok(!props.some((p) => /^ {2}color:/.test(p)));
	});
});

describe("textSweepRules — light/dark cascade and the print escape", () => {
	it("emits nothing when there is no sweep", () => {
		const { css } = harness();
		assert.deepStrictEqual(
			css.textSweepRules(definition(), () => ".x", false),
			[],
		);
	});

	it("leaves the light rule unscoped so it still applies in dark mode", () => {
		const { css } = harness();
		const def = sweptDef({
			bgGradient: {
				angleDeg: 90,
				toColorLight: "#fdf0e6",
				toColorDark: "#fdf0e6",
				textGradient: true,
				textToColorLight: "#cc5500",
				// No dark end colour and no dark accent difference → nothing to
				// override, so the unscoped light rule carries both themes.
				textToColorDark: "#cc5500",
			},
			colorLight: "#336699",
			colorDark: "#336699",
		});
		const rules = css.textSweepRules(def, (prefix) => `${prefix}.x`, false);
		const parsed = rules.flatMap((r) => parseRules(r));
		const screen = parsed.filter((r) => r.at.length === 0);
		assert.strictEqual(screen.length, 1);
		assert.strictEqual(must(screen[0], "rule").selector, ".x");
	});

	it("emits a dark rule only when it actually differs", () => {
		const { css } = harness();
		const rules = css.textSweepRules(sweptDef(), (p) => `${p}.x`, false);
		const parsed = rules.flatMap((r) => parseRules(r));
		const screen = parsed.filter((r) => r.at.length === 0);
		assert.deepStrictEqual(
			screen.map((r) => r.selector),
			[".x", ".theme-dark .x"],
		);
	});

	it("drops the sweep entirely in print, for both themes at once", () => {
		const { css } = harness();
		const rules = css.textSweepRules(sweptDef(), (p) => `${p}.x`, false);
		const printed = rules.flatMap((r) => parseRules(r)).filter((r) => r.at.includes("@media print"));
		assert.strictEqual(printed.length, 1);
		// Grouping both prefixes puts this later rule ahead of the screen rules
		// in either mode by source order.
		assert.strictEqual(must(printed[0], "rule").selector, ".x, .theme-dark .x");
		assert.deepStrictEqual(must(printed[0], "rule").decls, [
			"background-image: none",
			"-webkit-background-clip: border-box",
			"background-clip: border-box",
			"-webkit-text-fill-color: currentColor",
		]);
	});

	it("restates the background layer only for the element that owns it", () => {
		const { css } = harness();
		const screenRule = (ownsBackground: boolean) =>
			must(
				css
					.textSweepRules(sweptDef(), (p) => `${p}.x`, ownsBackground)
					.flatMap((r) => parseRules(r))
					.filter((r) => r.at.length === 0)[0],
				"screen rule",
			);
		const owns = screenRule(true);
		const borrows = screenRule(false);

		// Re-declaring the layer under an element that never had it squeezes a
		// second copy of the gradient into that element's own (much narrower)
		// box, on top of the real one.
		assert.ok(valueOf(owns, "background-image")?.includes("color-mix"));
		assert.ok(valueOf(borrows, "background-image")?.endsWith(", none"));
	});
});

describe("the sweep on each render role", () => {
	it("scopes the block callout's sweep to the title text, not the whole title row", () => {
		const { css } = harness();
		const out = css.generateCalloutCSS(sweptDef());
		// .callout-title is full width and holds the icon as a sibling;
		// .callout-title-inner hugs the words, so the sweep spans them and the
		// icon stays solid.
		assert.ok(out.includes('.callout[data-callout="quiet"] > .callout-title > .callout-title-inner'));
	});

	it("doubles the pill's class so the sweep outranks its own background rules", () => {
		const { css } = harness();
		const out = css.generateTokenColorCSS(sweptDef());
		// The bg rules above it are 2 selectors; repeating the class makes this 3.
		assert.ok(out.includes('.cs-inline-callout.cs-inline-callout[data-callout="quiet"]'));
	});

	it("sweeps the heading bar's two hugging text runs, never the full-width bar", () => {
		const { css } = harness();
		const out = css.generateTokenColorCSS(sweptDef());
		// Sweeping the block directly would stretch the gradient across the whole
		// line and leave the text showing only its opening slice. The two runs are
		// mutually exclusive (`showName: !hasTitle`), so only one ever paints.
		assert.ok(out.includes('.cs-heading-callout[data-callout="quiet"] .cs-heading-title'));
		assert.ok(out.includes('.cs-heading-token[data-callout="quiet"] > .cs-callout-name'));
	});

	it("gives ref tokens no sweep — they are bare icons", () => {
		const { css } = harness();
		const out = css.generateTokenColorCSS(sweptDef());
		for (const rule of parseRules(out)) {
			if (!rule.props.includes("-webkit-text-fill-color")) continue;
			assert.ok(!rule.selector.includes("cs-ref-token"), rule.selector);
		}
	});

	it("covers every alias", () => {
		const { css } = harness();
		const out = css.generateCalloutCSS(sweptDef({ aliases: ["hush"] }));
		assert.ok(out.includes('.callout[data-callout="hush"] > .callout-title > .callout-title-inner'));
	});
});

describe("printGradientCSS — the CoreGraphics repaint", () => {
	const printRules = (out: string) => parseRules(out);

	it("emits nothing for a solid background", () => {
		const { css } = harness();
		assert.strictEqual(
			css.printGradientCSS(definition({ bgColorLight: PALE_LIGHT }), (p, s) => `${p}.x${s}`, false),
			"",
		);
	});

	it("emits nothing when the mode has no background at all", () => {
		const { css } = harness();
		assert.strictEqual(
			css.printGradientCSS(definition(), (p, s) => `${p}.x${s}`, false),
			"",
		);
	});

	it("lives entirely inside @media print", () => {
		const { css } = harness();
		const out = css.printGradientCSS(sweptDef(), (p, s) => `${p}.x${s}`, false);
		for (const rule of printRules(out)) {
			assert.deepStrictEqual(rule.at, ["@media print"]);
		}
	});

	it("carries filter: opacity(0.999) — the whole point of the ::before", () => {
		const { css } = harness();
		const out = css.printGradientCSS(sweptDef(), (p, s) => `${p}.x${s}`, false);
		const before = ruleFor(out, ".x::before");
		// Not a no-op (so it cannot be optimized away) and invisible (so the
		// alpha change never shows). Removing it puts the sweep back on the
		// vector path, where Preview truncates the ramp.
		assert.strictEqual(valueOf(before, "filter"), "opacity(0.999)");
		assert.strictEqual(valueOf(before, "content"), '""');
		assert.strictEqual(valueOf(before, "position"), "absolute");
		assert.strictEqual(valueOf(before, "inset"), "0");
		assert.strictEqual(valueOf(before, "z-index"), "-1");
		assert.strictEqual(valueOf(before, "border-radius"), "inherit");
	});

	it("scopes the ::before's negative z-index to the host's own stacking context", () => {
		const { css } = harness();
		const out = css.printGradientCSS(sweptDef(), (p, s) => `${p}.x${s}`, false);
		const host = ruleFor(out, ".x, .theme-dark .x");
		// Without `z-index: 0` on the host, the -1 escapes and the sweep paints
		// behind the page rather than behind the text.
		assert.strictEqual(valueOf(host, "position"), "relative");
		assert.strictEqual(valueOf(host, "z-index"), "0");
	});

	it("hides the element's own gradient for the pill, and only the pill", () => {
		const { css } = harness();
		const pill = ruleFor(
			css.printGradientCSS(sweptDef(), (p, s) => `${p}.x${s}`, true),
			".x, .theme-dark .x",
		);
		const block = ruleFor(
			css.printGradientCSS(sweptDef(), (p, s) => `${p}.x${s}`, false),
			".x, .theme-dark .x",
		);
		// The pill is inline-flex: leaving its own gradient in place prints the
		// whole pill in the gradient's END colour. A block role keeps its as a
		// fragmentation fallback for the pages the ::before cannot reach.
		assert.strictEqual(valueOf(pill, "background-image"), "none");
		assert.strictEqual(valueOf(block, "background-image"), undefined);
	});

	it("keeps print-color-adjust on the ::before, or the layer is stripped", () => {
		const { css } = harness();
		const before = ruleFor(
			css.printGradientCSS(sweptDef(), (p, s) => `${p}.x${s}`, false),
			".x::before",
		);
		assert.ok(before.props.includes("print-color-adjust"));
		assert.ok(before.props.includes("-webkit-print-color-adjust"));
	});

	it("emits a dark ::before only when the sweep actually differs", () => {
		const { css } = harness();
		const differs = css.printGradientCSS(sweptDef(), (p, s) => `${p}.x${s}`, false);
		assert.ok(differs.includes(".theme-dark .x::before"));

		// Identical *emitted* values, not merely identical hexes: each mode solves
		// its tint against its own backdrop, so the same hex normally yields two
		// different layers. The pair below is past the alpha ceiling in both
		// modes, so both fall back to the untinted gradient and really do match.
		const same = css.printGradientCSS(
			sweptDef({
				bgColorLight: "#ff0000",
				bgColorDark: "#ff0000",
				bgGradient: {
					angleDeg: 90,
					toColorLight: "#00ff00",
					toColorDark: "#00ff00",
				},
			}),
			(p, s) => `${p}.x${s}`,
			false,
		);
		assert.ok(!same.includes(".theme-dark .x::before"));
	});

	it("reaches all three roles plus the unknown-id fallback", () => {
		const { registry, css } = harness();
		registry.add(sweptDef({ id: "swept" }));
		registry.settings.fallbackCalloutId = "swept";

		const block = css.generateCalloutCSS(sweptDef());
		const tokens = css.generateTokenColorCSS(sweptDef());
		const fallback = css.generateFallbackCSS(registry.getAll());

		assert.ok(block.includes('.callout[data-callout="quiet"]::before'));
		assert.ok(tokens.includes('.cs-inline-callout[data-callout="quiet"]::before'));
		assert.ok(tokens.includes('.cs-heading-callout[data-callout="quiet"]::before'));
		assert.ok(fallback.includes(".cs-inline-callout.cs-unknown::before"));
		assert.ok(fallback.includes(".cs-heading-callout.cs-unknown::before"));
		assert.ok(fallback.includes("::before"));
	});
});

describe("generateFoldArrowCSS — the chevron closes the sweep", () => {
	it("emits nothing without a gradient", () => {
		const { css } = harness();
		assert.strictEqual(css.generateFoldArrowCSS(definition()), "");
	});

	it("emits nothing while the title sweep is off", () => {
		const { css } = harness();
		// The recolouring exists to echo the title's own sweep. With no sweep to
		// close, the arrow keeps the default accent from styles.css.
		assert.strictEqual(
			css.generateFoldArrowCSS(
				definition({
					bgColorLight: PALE_LIGHT,
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#fdf0e6",
						toColorDark: "#2b1f16",
						textToColorLight: "#cc5500",
					},
				}),
			),
			"",
		);
	});

	it("emits nothing when the gradient carries no accent-strength colour", () => {
		const { css } = harness();
		// Never the pale `toColor*` tints: those are the background's end stop,
		// and an arrow painted in one disappears into the corner it sits on.
		assert.strictEqual(
			css.generateFoldArrowCSS(
				definition({
					bgColorLight: PALE_LIGHT,
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#fdf0e6",
						toColorDark: "#2b1f16",
						textGradient: true,
					},
				}),
			),
			"",
		);
	});

	it("paints all three foldable chevrons in the sweep's second colour", () => {
		const { css } = harness();
		const rules = parseRules(css.generateFoldArrowCSS(sweptDef()));
		assert.strictEqual(rules.length, 2);
		assert.deepStrictEqual(must(rules[0], "rule").decls, ["color: #cc5500"]);
		assert.deepStrictEqual(must(rules[1], "rule").decls, ["color: #ffaa66"]);
		for (const part of [
			'.callout[data-callout="quiet"] > .callout-title > .callout-fold',
			'.cs-heading-callout[data-callout="quiet"] .cs-fold-arrow',
			'.cs-heading-callout[data-callout="quiet"] .heading-collapse-indicator',
		]) {
			assert.ok(must(rules[0], "rule").selector.includes(part), `missing ${part}`);
		}
	});

	it("mixes the two id conventions deliberately, and only one way round", () => {
		const { css } = harness();
		const out = css.generateFoldArrowCSS(sweptDef({ id: "multi word callout" }));
		// Obsidian's own DOM takes the dasherized attr; the heading bar is ours
		// and takes the space form. Unifying them breaks one surface or the other.
		assert.ok(out.includes('.callout[data-callout="multi-word-callout"]'));
		assert.ok(out.includes('.cs-heading-callout[data-callout="multi word callout"]'));
	});

	it("falls back to the light colour when no dark end is set", () => {
		const { css } = harness();
		const rules = parseRules(
			css.generateFoldArrowCSS(
				sweptDef({
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#fdf0e6",
						toColorDark: "#2b1f16",
						textGradient: true,
						textToColorLight: "#cc5500",
					},
				}),
			),
		);
		// Identical values → the dark rule is a no-op and is skipped.
		assert.strictEqual(rules.length, 1);
		assert.deepStrictEqual(must(rules[0], "rule").decls, ["color: #cc5500"]);
	});

	it("covers every alias", () => {
		const { css } = harness();
		const out = css.generateFoldArrowCSS(sweptDef({ aliases: ["hush"] }));
		assert.ok(out.includes('.callout[data-callout="hush"]'));
		assert.ok(out.includes('.cs-heading-callout[data-callout="hush"]'));
	});
});
