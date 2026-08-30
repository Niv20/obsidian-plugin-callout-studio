/**
 * tests/cssInjectorBackground.test.ts — `bgAlphaFor` / `bgProps` / `bgImageFor`
 * and the `transparentBg` outline half (`transparentBorderProps`).
 *
 * The single rule this file exists to enforce:
 *
 *   **A background is painted as a translucent tint, never as the authored hex,
 *   and there is no opt-out.**
 *
 * Obsidian gives nested callouts their stepped look purely by compositing
 * translucent layers. An opaque fill hides everything behind it — under
 * `mix-blend-mode: darken` a colour over itself is `min(x, x) = x`, a step of
 * exactly zero. The callout looks unchanged on its own; only what shows
 * *through* it changes, which is why the old `solidBackground` flag was retired
 * rather than kept as a toggle. colorUtils.ts solves the tint itself and
 * utils/bgTintAlpha.ts picks WHICH of the many viable alphas to solve at; the
 * tests here are about the injector's use of both, not their maths (see
 * tests/colorUtils.test.ts and tests/bgTintAlpha.test.ts for that).
 *
 * The two structural consequences, both easy to break by accident:
 *
 * - A gradient's two stops must share ONE alpha. They are a single
 *   `linear-gradient`, and ramping the alpha across it would tilt the sweep, so
 *   the shared value has to clear whichever stop sits further from the page.
 * - The gradient's stops must be tinted too. An opaque gradient painted over a
 *   translucent `background-color` puts the opaque layer straight back on top
 *   and re-hides the backdrop the tint just exposed.
 *
 * `transparentBg` is the one way out, and is checked FIRST — before the
 * no-background return — because a transparent def carries no bg hex at all and
 * would otherwise fall out emitting nothing. "Nothing" is not transparent: it
 * hands the callout back to core's own default tint. It is also not the opaque
 * opt-out in disguise: zero alpha hides nothing, so a callout nested inside a
 * transparent one still tints normally.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { hexToRgb } from "../src/utils/colorUtils";
import { transparentBorderProps } from "../src/manager/css/transparentBorder";
import {
	definition,
	harness,
	must,
	parseRules,
	ruleFor,
	valueOf,
} from "./support/cssInjectorHarness";

/**
 * `colorUtils`' own alpha band, restated rather than imported — the constants
 * are module-private there, and pinning the numbers here is the point: a change
 * to either end changes how every existing background renders.
 */
const MIN_TINT_ALPHA = 0.1;
const MAX_TINT_ALPHA = 0.6;

/** A pale blue that solves comfortably inside the alpha ceiling in both modes. */
const PALE_LIGHT = "#eef4fa";
const PALE_DARK = "#16202b";

describe("bgAlphaFor — one alpha per mode", () => {
	it("is null when the def has no background for that mode", () => {
		const { css } = harness();
		const def = definition({ bgColorLight: PALE_LIGHT });
		assert.strictEqual(css.bgAlphaFor(def, "dark"), null);
	});

	it("lands inside the plugin's own alpha band for a pale tint", () => {
		const { css } = harness();
		const alpha = css.bgAlphaFor(
			definition({ bgColorLight: PALE_LIGHT }),
			"light",
		);
		assert.ok(alpha !== null);
		assert.ok(alpha >= MIN_TINT_ALPHA && alpha <= MAX_TINT_ALPHA);
	});

	it("returns null when no alpha at or below the ceiling can reproduce the colour", () => {
		const { css } = harness();
		// Saturated red on a white page: the green channel needs alpha 1.0 to
		// reach 0, which is past MAX_TINT_ALPHA. Null is the caller's cue to
		// paint opaque and lose the nesting step for this one callout — the
		// documented, deliberate fallback.
		assert.strictEqual(
			css.bgAlphaFor(definition({ bgColorLight: "#ff0000" }), "light"),
			null,
		);
	});

	it("makes a gradient's two stops share the alpha that clears BOTH", () => {
		const { css } = harness();
		const near = css.bgAlphaFor(
			definition({ bgColorLight: PALE_LIGHT }),
			"light",
		);
		const withFarStop = css.bgAlphaFor(
			definition({
				bgColorLight: PALE_LIGHT,
				bgGradient: {
					angleDeg: 90,
					// Much further from the page than the base stop, so it is the
					// binding constraint — but still inside the ceiling, so the
					// pair resolves rather than falling back to opaque.
					toColorLight: "#7fa8cc",
					toColorDark: "#7fa8cc",
				},
			}),
			"light",
		);
		assert.ok(near !== null && withFarStop !== null);
		assert.ok(
			withFarStop > near,
			`the further stop must raise the shared alpha (${near} → ${withFarStop})`,
		);
	});

	it("returns null when only the gradient's far stop is unreachable", () => {
		const { css } = harness();
		// The base stop alone solves fine; the end stop does not. One shared
		// alpha means the pair fails together rather than tilting the sweep.
		assert.strictEqual(
			css.bgAlphaFor(
				definition({
					bgColorLight: PALE_LIGHT,
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#ff0000",
						toColorDark: "#ff0000",
					},
				}),
				"light",
			),
			null,
		);
	});
});

describe("bgAlphaFor — the cap on how far a nested stack may drift", () => {
	// The nested-callout readability investigation's own worked example:
	// bgTintFor("#e93147", false, 0.18). Solving from the background alone needs
	// only ~0.15, and that reverse-solves a source far more saturated than the
	// accent — which is what a deep stack converges toward. See
	// `utils/bgTintAlpha.ts` for the cap that raises it, and
	// tests/bgTintAlpha.test.ts for its maths; what is pinned here is the numbers
	// the injector actually emits.
	const ACCENT = "#e93147";
	const DERIVED_BG = "#fbdade";
	/** The same accent at 45% — bold enough that its own cap binds hard. */
	const BOLD_BG = "#f5a2ac";

	it("raises the alpha to the accent's own intensity", () => {
		const { css } = harness();
		const def = definition({
			colorLight: ACCENT,
			bgColorLight: DERIVED_BG,
		});
		// 0.18 — the amount this background really is its accent at — plus the
		// solve's rounding headroom. Solving from the colour alone asks 0.15.
		assert.strictEqual(css.bgAlphaFor(def, "light"), 0.19);
	});

	it("still recomposites to the exact authored colour — the outer callout is unchanged", () => {
		const { css } = harness();
		const def = definition({
			colorLight: ACCENT,
			bgColorLight: DERIVED_BG,
		});
		const value = must(css.bgProps(def, "light")[0], "declaration");
		const match =
			/color-mix\(in oklch, (#[0-9a-f]{6}) ([\d.]+)%, transparent\)/.exec(
				value,
			);
		assert.ok(match, `expected a color-mix() declaration, got: ${value}`);
		const [, source, pct] = match as unknown as [string, string, string];
		const alpha = Number(pct) / 100;
		const src = hexToRgb(source);
		const want = hexToRgb(DERIVED_BG);
		for (const ch of ["r", "g", "b"] as const) {
			const recomposited = alpha * src[ch] + (1 - alpha) * 255;
			assert.ok(
				Math.abs(recomposited - want[ch]) <= 1,
				`${ch}: recomposited ${recomposited}, wanted ${want[ch]}`,
			);
		}
	});

	it("scales with how bold the background really is", () => {
		const { css } = harness();
		const alpha = css.bgAlphaFor(
			definition({ colorLight: ACCENT, bgColorLight: BOLD_BG }),
			"light",
		);
		// The same accent at 45% rather than 18%, and the cap tracks it.
		assert.strictEqual(alpha, 0.47);
	});

	it("anchors a gradient's far stop against its own textToColor", () => {
		const { css } = harness();
		// The BASE stop here is mild — its own cap sits well under its bare
		// minTintAlpha, so without a `textToColor*` the pair lands on the FAR
		// stop's own minimum. That stop is bold enough that its OWN accent asks
		// for more than either minimum does, so this is the one arrangement where
		// `textToColor*` is the deciding input.
		const base = {
			colorLight: "#336699",
			bgColorLight: PALE_LIGHT,
			bgGradient: {
				angleDeg: 90,
				toColorLight: BOLD_BG,
				toColorDark: BOLD_BG,
			},
		};
		const withoutOwnAnchor = css.bgAlphaFor(definition(base), "light");
		const withOwnAnchor = css.bgAlphaFor(
			definition({
				...base,
				bgGradient: { ...base.bgGradient, textToColorLight: ACCENT },
			}),
			"light",
		);
		assert.strictEqual(withoutOwnAnchor, 0.38);
		assert.strictEqual(withOwnAnchor, 0.47);
	});

	it("leaves a far stop with no textToColor of its own uncapped", () => {
		const { css } = harness();
		// A far stop is deliberately a DIFFERENT hue from the primary accent (the
		// palette editor's suggested default rotates it — see `rotateHue`), so
		// the primary accent says nothing about how intense that stop may be.
		// These colours are chosen so the difference shows: capping this far stop
		// against this primary accent would ask 0.55.
		const alpha = css.bgAlphaFor(
			definition({
				colorLight: "#5a7d9a",
				bgColorLight: PALE_LIGHT,
				bgGradient: {
					angleDeg: 90,
					toColorLight: BOLD_BG,
					toColorDark: BOLD_BG,
				},
			}),
			"light",
		);
		assert.strictEqual(alpha, 0.38);
	});

	it("leaves the colour's own minimum standing where the cap asks for less", () => {
		const { css } = harness();
		// The accent sits well ABOVE the dark backdrop on every channel and the
		// background well below it — a pairing reachable through the palette
		// editor's advanced per-channel mode, where the background is nobody's
		// tint. Its accent cap lands UNDER the minimum, and a cap may only ever
		// raise, so the minimum is the answer: (28 − 20) / 28 with 2% headroom.
		const def = definition({
			colorDark: "#ff8a65",
			bgColorDark: "#141414",
		});
		assert.strictEqual(css.bgAlphaFor(def, "dark"), 0.3);
	});

	it("drops a cap it cannot meet rather than paint the callout opaque", () => {
		const { css } = harness();
		// `#cccccc` really is `#bbbbbb` at 75%, so the accent cap is
		// arithmetically right and unreachable — 0.75 is past MAX_TINT_ALPHA.
		// Handed to the solve as if it were a constraint it returns null, which
		// paints the background OPAQUE: a callout that nested fine loses its
		// nesting to a fix meant to help it. The colour's own minimum stands
		// instead, and it is satisfiable by construction.
		const def = definition({
			colorLight: "#bbbbbb",
			bgColorLight: "#cccccc",
		});
		assert.strictEqual(css.bgAlphaFor(def, "light"), 0.21);
	});

	it("emits no alpha at all for a background that is not a hex", () => {
		const { css } = harness();
		// Only hand-edited data reaches this state — `sanitizeBgGradient` and the
		// import validator reject the rest — and null is what makes `bgProps`
		// pass the value through untouched. Solving it would emit
		// `color-mix(in oklch, #NaNNaNNaN …)`, which the parser drops.
		const def = definition({ bgColorLight: "transparent" });
		assert.strictEqual(css.bgAlphaFor(def, "light"), null);
		assert.deepStrictEqual(css.bgProps(def, "light"), [
			"  background-color: transparent;",
		]);
	});
});

describe("bgProps — the background is always a tint", () => {
	it("emits nothing when the mode has no background colour", () => {
		const { css } = harness();
		assert.deepStrictEqual(css.bgProps(definition(), "light"), []);
	});

	it("never emits the authored hex as the background-color", () => {
		const { css } = harness();
		const props = css.bgProps(
			definition({ bgColorLight: PALE_LIGHT }),
			"light",
		);
		const value = must(props[0], "declaration");
		assert.ok(
			!value.includes(PALE_LIGHT),
			`the authored hex must not be painted opaque, got: ${value}`,
		);
		assert.match(
			value,
			/^ {2}background-color: color-mix\(in oklch, #[0-9a-f]{6} [\d.]+%, transparent\);$/,
		);
	});

	it("falls back to the opaque hex only when no alpha can reproduce it", () => {
		const { css } = harness();
		const props = css.bgProps(
			definition({ bgColorLight: "#ff0000" }),
			"light",
		);
		assert.deepStrictEqual(props, ["  background-color: #ff0000;"]);
	});

	it("solves light and dark against their own backdrops", () => {
		const { css } = harness();
		const def = definition({
			bgColorLight: PALE_LIGHT,
			bgColorDark: PALE_DARK,
		});
		const light = css.bgProps(def, "light")[0];
		const dark = css.bgProps(def, "dark")[0];
		assert.notStrictEqual(light, dark);
	});

	it("adds print-color-adjust only alongside a gradient image", () => {
		const { css } = harness();
		const flat = css.bgProps(
			definition({ bgColorLight: PALE_LIGHT }),
			"light",
		);
		assert.deepStrictEqual(flat.length, 1);

		const swept = css.bgProps(
			definition({
				bgColorLight: PALE_LIGHT,
				bgGradient: {
					angleDeg: 90,
					toColorLight: "#fdf0e6",
					toColorDark: "#2b1f16",
				},
			}),
			"light",
		);
		assert.deepStrictEqual(
			swept.map((p) => p.trim().split(":")[0]),
			[
				"background-color",
				"background-image",
				"-webkit-print-color-adjust",
				"print-color-adjust",
			],
		);
	});

	it("carries !important through every declaration when asked", () => {
		const { css } = harness();
		const props = css.bgProps(
			definition({
				bgColorLight: PALE_LIGHT,
				bgGradient: {
					angleDeg: 90,
					toColorLight: "#fdf0e6",
					toColorDark: "#2b1f16",
				},
			}),
			"light",
			true,
		);
		assert.ok(props.every((p) => p.endsWith(" !important;")));
	});
});

describe("bgProps — transparentBg", () => {
	it("clears the colour AND any image, before the no-background return", () => {
		const { css } = harness();
		// A transparent def carries no bg hex, so without the early check it
		// would fall out of `if (!bg) return []` emitting nothing — and nothing
		// is not transparent, it is core's own default tint.
		assert.deepStrictEqual(
			css.bgProps(definition({ transparentBg: true }), "light"),
			["  background-color: transparent;", "  background-image: none;"],
		);
	});

	it("wins over a gradient left behind by hand-edited data", () => {
		const { css } = harness();
		const def = definition({
			transparentBg: true,
			bgColorLight: PALE_LIGHT,
			bgGradient: {
				angleDeg: 90,
				toColorLight: "#fdf0e6",
				toColorDark: "#2b1f16",
			},
		});
		assert.strictEqual(css.bgImageFor(def, "light"), null);
		assert.ok(
			css.bgProps(def, "light").includes("  background-image: none;"),
		);
	});
});

describe("transparentBorderProps — the outline half", () => {
	it("clears both the frame and any elevation ring", () => {
		const { registry } = harness();
		// Core draws the frame in `--callout-color` — this plugin's accent — so a
		// callout the user asked to disappear would otherwise read as an empty
		// outline in their custom colour. Some themes draw the same frame (or an
		// elevation ring) as an inset box-shadow off the same variable, so both
		// have to go.
		assert.deepStrictEqual(
			transparentBorderProps(registry.settings.globalStyle.borderSides),
			["  box-shadow: none;", "  border-color: transparent;"],
		);
	});

	it("leaves border-color alone once the plugin's own border is on", () => {
		const { registry } = harness();
		registry.settings.globalStyle.borderSides.left = true;
		// That border is an explicit choice, drawn in the accent by
		// generateGlobalStyleCSS at one class less than this rule, so clearing
		// the colour here would quietly erase it. box-shadow carries no such
		// conflict — the plugin never draws its own border that way.
		assert.deepStrictEqual(
			transparentBorderProps(registry.settings.globalStyle.borderSides),
			["  box-shadow: none;"],
		);
	});

	it("never touches border-width, so the box keeps its place in the flow", () => {
		const { registry } = harness();
		assert.ok(
			transparentBorderProps(
				registry.settings.globalStyle.borderSides,
			).every((p) => !p.includes("border-width")),
		);
	});

	it("goes in the light (unscoped) rule only", () => {
		const { css } = harness();
		const out = css.generateCalloutCSS(definition({ transparentBg: true }));
		const light = ruleFor(out, '.callout[data-callout="quiet"]');
		const dark = ruleFor(out, '.theme-dark .callout[data-callout="quiet"]');
		// The frame's colour is the same in either theme, and the dark block
		// exists purely for values that differ.
		assert.ok(light.props.includes("border-color"));
		assert.ok(light.props.includes("box-shadow"));
		assert.ok(!dark.props.includes("border-color"));
		assert.ok(!dark.props.includes("box-shadow"));
	});

	it("reaches the fallback block too, with !important", () => {
		const { registry, css } = harness();
		registry.add(
			definition({
				id: "ghost",
				transparentBg: true,
				colorDark: "#336699",
			}),
		);
		registry.settings.fallbackCalloutId = "ghost";
		const out = css.generateFallbackCSS(registry.getAll());
		// An unknown id must inherit a transparent fallback whole, rather than as
		// a frame with nothing in it.
		assert.ok(out.includes("box-shadow: none !important;"));
		assert.ok(out.includes("border-color: transparent !important;"));
	});
});

describe("bgImageFor — the gradient layer", () => {
	it("is null without a gradient, and null without a base colour to sweep from", () => {
		const { css } = harness();
		assert.strictEqual(
			css.bgImageFor(definition({ bgColorLight: PALE_LIGHT }), "light"),
			null,
		);
		assert.strictEqual(
			css.bgImageFor(
				definition({
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

	it("tints BOTH stops, at the one shared alpha", () => {
		const { css } = harness();
		const def = definition({
			bgColorLight: PALE_LIGHT,
			bgGradient: {
				angleDeg: 90,
				toColorLight: "#fdf0e6",
				toColorDark: "#2b1f16",
			},
		});
		const layer = css.bgImageFor(def, "light");
		assert.ok(layer);
		const alphas = [
			...layer.image.matchAll(/ ([\d.]+)%, transparent\)/g),
		].map((m) => m[1]);
		assert.strictEqual(
			alphas.length,
			2,
			`expected two tinted stops: ${layer.image}`,
		);
		assert.strictEqual(
			alphas[0],
			alphas[1],
			"an alpha ramp across a single linear-gradient would tilt the sweep",
		);
		// And neither stop survives as the raw hex, which would re-hide the
		// backdrop the background-color tint just exposed.
		assert.ok(!layer.image.includes(PALE_LIGHT));
		assert.ok(!layer.image.includes("#fdf0e6"));
	});

	it("paints both stops opaque when the pair cannot be solved", () => {
		const { css } = harness();
		const layer = css.bgImageFor(
			definition({
				bgColorLight: PALE_LIGHT,
				bgGradient: {
					angleDeg: 90,
					toColorLight: "#ff0000",
					toColorDark: "#ff0000",
				},
			}),
			"light",
		);
		assert.ok(layer);
		assert.strictEqual(
			layer.image,
			`linear-gradient(90deg, ${PALE_LIGHT}, #ff0000)`,
		);
	});

	it("normalizes the angle", () => {
		const { css } = harness();
		const layer = css.bgImageFor(
			definition({
				bgColorLight: "#ff0000",
				bgGradient: {
					angleDeg: 450,
					toColorLight: "#00ff00",
					toColorDark: "#00ff00",
				},
			}),
			"light",
		);
		assert.ok(layer?.image.startsWith("linear-gradient(90deg,"));
	});
});

describe("the tint reaches every surface that paints a callout", () => {
	const swept = () =>
		definition({
			bgColorLight: PALE_LIGHT,
			bgColorDark: PALE_DARK,
			bgGradient: {
				angleDeg: 90,
				toColorLight: "#fdf0e6",
				toColorDark: "#2b1f16",
			},
		});

	it("never emits an opaque authored hex as any background, anywhere", () => {
		const { css } = harness();
		const out =
			css.generateCalloutCSS(swept()) +
			"\n" +
			css.generateTokenColorCSS(swept());
		for (const rule of parseRules(out)) {
			for (const prop of ["background-color", "background-image"]) {
				const value = valueOf(rule, prop);
				if (!value) continue;
				for (const hex of [
					PALE_LIGHT,
					PALE_DARK,
					"#fdf0e6",
					"#2b1f16",
				]) {
					assert.ok(
						!value.includes(hex),
						`${rule.selector} paints ${hex} opaque via ${prop}: ${value}`,
					);
				}
			}
		}
	});

	it("gives the heading bar and the inline pill the same background as the block", () => {
		const { css } = harness();
		const block = ruleFor(
			css.generateCalloutCSS(swept()),
			'.callout[data-callout="quiet"]',
		);
		const tokens = ruleFor(
			css.generateTokenColorCSS(swept()),
			'.cs-inline-callout[data-callout="quiet"], .cs-heading-callout[data-callout="quiet"]',
		);
		// The COLOUR has to match; the importance does not, and must not. The
		// block rule lands on core's DOM, where a theme is competing for it, so
		// studio mode marks it. The token rules land on `.cs-*`, which no theme
		// selector can reach — marking those would only take away the user's
		// own ability to restyle them in a snippet.
		const bare = (v: string | undefined): string | undefined =>
			v?.replace(/ !important$/, "");
		assert.strictEqual(
			bare(valueOf(tokens, "background-color")),
			bare(valueOf(block, "background-color")),
		);
		assert.strictEqual(
			bare(valueOf(tokens, "background-image")),
			bare(valueOf(block, "background-image")),
		);
	});

	it("skips the dark background rule only when the emitted props are identical", () => {
		const { css } = harness();
		const darkBgRules = (out: string) =>
			parseRules(out).filter(
				(r) =>
					r.selector.startsWith(".theme-dark") &&
					r.props.includes("background-color"),
			);

		// The same hex in both modes is NOT the same declaration: each mode
		// solves its tint against its own backdrop, so `#eef4fa` comes out as two
		// different color-mix() values and the dark rule is real work.
		assert.strictEqual(
			darkBgRules(
				css.generateTokenColorCSS(
					definition({
						bgColorLight: PALE_LIGHT,
						bgColorDark: PALE_LIGHT,
					}),
				),
			).length,
			1,
		);

		// `transparentBg` is the case that genuinely repeats — it emits the same
		// two literal declarations whatever the mode — so the dark copy is
		// dropped and the unscoped light rule carries both themes. That is the
		// explicit-undefined cascade the comparison exists for.
		assert.strictEqual(
			darkBgRules(
				css.generateTokenColorCSS(definition({ transparentBg: true })),
			).length,
			0,
		);
	});
});
