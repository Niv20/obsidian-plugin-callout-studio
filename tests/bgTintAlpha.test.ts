/**
 * tests/bgTintAlpha.test.ts — how a background tint's alpha is CHOSEN.
 *
 * Every alpha at or above `minTintAlpha` renders the callout itself identically
 * (tests/colorUtils.test.ts owns that identity). What the choice decides is
 * everything stacked INSIDE it: the colour at nesting depth `n` converges on the
 * solved source, and the source is `‖bg − backdrop‖ / alpha` away from the page.
 * So this file is about the cap that raises the alpha — the accent bound — and,
 * more than the cap itself, about the property that made the first attempt at it
 * a regression:
 *
 *   **A cap may only ever RAISE the alpha inside the viable band.** It can never
 *   push a background into the opaque fallback, because opaque is exactly the
 *   nesting failure the cap exists to soften. Fed to `resolveTintAlpha` as if it
 *   were a constraint, an unsatisfiable cap returns null — and null paints the
 *   authored hex flat, so a callout that nested perfectly well before stops
 *   nesting at all.
 *
 * The tests are properties over a grid rather than samples, because that is what
 * catches it: the regression only showed on colour pairs nobody would have
 * thought to write down (an accent 10 levels from the page on one channel, a
 * background nudged three levels by hand).
 *
 * `resolveBgAlpha`'s def-shaped behaviour — gradients, the two modes, the
 * `transparentBg` interaction — is exercised through `css.bgAlphaFor` in
 * tests/cssInjectorBackground.test.ts, where the rest of the injector's use of it
 * lives.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { accentAnchorAlpha, resolveBgAlpha } from "../src/utils/bgTintAlpha";
import {
	BG_PRIMARY_DARK,
	BG_PRIMARY_LIGHT,
	bgTintFor,
	hexToRgb,
	minTintAlpha,
	resolveTintAlpha,
	tintColorAt,
} from "../src/utils/colorUtils";
import type { CalloutDefinition } from "../src/types";
import { definition } from "./support/cssInjectorHarness";

/** Same spread `colorUtils.test.ts` uses — wide enough to catch a per-channel bug. */
const SAMPLE_HEXES = [
	"#000000",
	"#ffffff",
	"#ff0000",
	"#00ff00",
	"#0000ff",
	"#448aff",
	"#7f3fbf",
	"#e0af68",
	"#1c1c1c",
	"#808080",
	"#123456",
	"#fedcba",
	"#e93147",
	"#4287f5",
];

/** The intensities the palette editor's slider can produce, plus its default. */
const SAMPLE_AMOUNTS = [0.1, 0.14, 0.18, 0.22, 0.26, 0.3];

/**
 * Hand-picked backgrounds on top of the derived ones — the pairs that broke the
 * first implementation, plus the shapes a user reaches through the colour picker.
 */
const HAND_PICKED = [
	"#dde9f0",
	"#dde9fa",
	"#cccccc",
	"#eeeeee",
	"#fff5cc",
	"#141414",
	"#2a2833",
	"#eef4fa",
	"#16202b",
	"#fbdade",
];

/** How far a colour sits from the mode's page background — the file's own metric. */
function reach(hex: string, isDark: boolean): number {
	const b = hexToRgb(isDark ? BG_PRIMARY_DARK : BG_PRIMARY_LIGHT);
	const c = hexToRgb(hex);
	return Math.hypot(c.r - b.r, c.g - b.g, c.b - b.b);
}

/** The largest per-channel distance from the page — the step as an eye sees it. */
function widestChannel(hex: string, isDark: boolean): number {
	const b = hexToRgb(isDark ? BG_PRIMARY_DARK : BG_PRIMARY_LIGHT);
	const c = hexToRgb(hex);
	return Math.max(
		Math.abs(c.r - b.r),
		Math.abs(c.g - b.g),
		Math.abs(c.b - b.b),
	);
}

/** The answer before either cap existed: the smallest viable alpha, and nothing else. */
function uncappedAlpha(bg: string, isDark: boolean): number | null {
	return resolveTintAlpha(minTintAlpha(bg, isDark));
}

function alphaFor(
	accent: string,
	bg: string,
	isDark: boolean,
	over: Partial<CalloutDefinition> = {},
): number | null {
	const def = definition(
		isDark
			? { colorDark: accent, bgColorDark: bg, ...over }
			: { colorLight: accent, bgColorLight: bg, ...over },
	);
	return resolveBgAlpha(def, isDark ? "dark" : "light");
}

/** Every accent × background × mode combination the properties below range over. */
function* grid(): Generator<{ accent: string; bg: string; isDark: boolean }> {
	for (const isDark of [false, true]) {
		const backgrounds = [
			...SAMPLE_HEXES.map((h) => bgTintFor(h, isDark)),
			...HAND_PICKED,
			...SAMPLE_HEXES,
		];
		for (const accent of SAMPLE_HEXES) {
			for (const bg of backgrounds) yield { accent, bg, isDark };
		}
	}
}

describe("accentAnchorAlpha — the accent's own intensity, as an alpha", () => {
	it("recovers the blend strength of a genuine tint, in both modes, at every intensity", () => {
		for (const isDark of [false, true]) {
			for (const accent of SAMPLE_HEXES) {
				for (const amount of SAMPLE_AMOUNTS) {
					const bg = bgTintFor(accent, isDark, amount);
					const anchor = accentAnchorAlpha(accent, bg, isDark);
					// An accent that IS the page colour has no axis to measure
					// along; it is covered on its own below.
					if (anchor === 0) continue;
					assert.ok(
						Math.abs(anchor - amount) <= 0.02,
						`${accent} @ ${amount} ${isDark ? "dark" : "light"} → ${anchor}`,
					);
				}
			}
		}
	});

	it("stays sane where the accent sits a few levels from the page on one channel", () => {
		// The pair that broke the per-channel implementation. `#4287f5` is 10
		// levels below white on blue, so solving per channel and taking the
		// largest candidate turned a 6-level difference there into a demand for
		// alpha 1.5 — past the ceiling, i.e. an opaque background. Measured as
		// one distance, that channel is a rounding detail of a much longer line.
		const anchor = accentAnchorAlpha("#4287f5", "#dde9f0", false);
		assert.ok(
			anchor > 0.1 && anchor < 0.3,
			`a background this pale cannot want a heavy alpha, got ${anchor}`,
		);
	});

	it("is zero for an accent that is the page colour itself", () => {
		assert.equal(accentAnchorAlpha(BG_PRIMARY_LIGHT, "#f4e0e0", false), 0);
		assert.equal(accentAnchorAlpha(BG_PRIMARY_DARK, "#302020", true), 0);
	});

	it("is zero for anything that is not a #rrggbb hex", () => {
		// Reachable only by hand-editing data.json, and the reason the guard is
		// spelled rather than left to `hexToRgb` — its NaN would ride all the way
		// into a `color-mix()` percentage.
		for (const bad of ["transparent", "rgb(1, 2, 3)", "", "#abc", "red"]) {
			assert.equal(accentAnchorAlpha(bad, "#fbdade", false), 0, bad);
			assert.equal(accentAnchorAlpha("#e93147", bad, false), 0, bad);
		}
	});
});

describe("resolveBgAlpha — a cap can never cost the nesting step", () => {
	it("never falls back to opaque where the un-capped solve did not", () => {
		for (const { accent, bg, isDark } of grid()) {
			const capped = alphaFor(accent, bg, isDark);
			if (uncappedAlpha(bg, isDark) === null) continue;
			assert.ok(
				capped !== null,
				`${accent} on ${bg} ${isDark ? "dark" : "light"} went opaque`,
			);
		}
	});

	it("never lowers the alpha below the un-capped solve", () => {
		for (const { accent, bg, isDark } of grid()) {
			const uncapped = uncappedAlpha(bg, isDark);
			const capped = alphaFor(accent, bg, isDark);
			if (uncapped === null || capped === null) continue;
			assert.ok(
				capped >= uncapped,
				`${accent} on ${bg}: ${capped} < ${uncapped}`,
			);
		}
	});

	it("leaves the callout itself pixel-identical at whatever alpha it picks", () => {
		// The whole subsystem rests on this: raising the alpha re-solves the
		// source with it, so only what shows THROUGH the callout ever changes.
		for (const { accent, bg, isDark } of grid()) {
			const alpha = alphaFor(accent, bg, isDark);
			if (alpha === null) continue;
			const source = hexToRgb(tintColorAt(bg, isDark, alpha));
			const page = hexToRgb(isDark ? BG_PRIMARY_DARK : BG_PRIMARY_LIGHT);
			const want = hexToRgb(bg);
			for (const ch of ["r", "g", "b"] as const) {
				const rendered = alpha * source[ch] + (1 - alpha) * page[ch];
				assert.ok(
					Math.abs(rendered - want[ch]) <= 1,
					`${bg} @ ${alpha}: ${ch} renders ${rendered}, authored ${want[ch]}`,
				);
			}
		}
	});

	it("keeps a visible step at every level", () => {
		// The cost of raising the alpha, held to a number. The step one level
		// down is exactly `(1 - alpha)·(bg - page)`, so a cap that pushed the
		// alpha near the ceiling would flatten nesting just as thoroughly as an
		// opaque fill would.
		for (const { accent, bg, isDark } of grid()) {
			const alpha = alphaFor(accent, bg, isDark);
			if (alpha === null) continue;
			const distance = widestChannel(bg, isDark);
			if (distance === 0) continue; // a background that IS the page
			assert.ok(
				(1 - alpha) * distance >= 2,
				`${bg} @ ${alpha}: step of ${(1 - alpha) * distance} levels`,
			);
		}
	});
});

describe("resolveBgAlpha — what the cap actually bounds", () => {
	it("never lets a stack converge past the callout's own accent — where it can", () => {
		// The cap's whole claim, over the grid: the source the stack converges
		// toward is no further from the page than the accent the user picked.
		//
		// "Where it can" is not a hedge, it is the design. The cap is a
		// PREFERENCE: a background genuinely bolder than its own accent asks for
		// an alpha past `MAX_TINT_ALPHA`, and honouring that literally would mean
		// an opaque fill — no nesting at all, for the callout this exists to
		// protect. Such a pair is skipped here and pinned by name below.
		for (const { accent, bg, isDark } of grid()) {
			const alpha = alphaFor(accent, bg, isDark);
			if (alpha === null) continue;
			const cap = accentAnchorAlpha(accent, bg, isDark);
			if (cap === 0) continue; // an accent that IS the page
			if (resolveTintAlpha(minTintAlpha(bg, isDark), cap) === null)
				continue;
			assert.ok(
				reach(tintColorAt(bg, isDark, alpha), isDark) <=
					reach(accent, isDark) + 3,
				`${accent}/${bg} @ ${alpha}: source reaches ${reach(tintColorAt(bg, isDark, alpha), isDark)}, accent ${reach(accent, isDark)}`,
			);
		}
	});

	it("gives the cap up rather than go opaque, where it cannot be met", () => {
		// `#808080` really is `#ff0000` at well past the ceiling. Fed to
		// `resolveTintAlpha` as if it were a constraint the pair returns null —
		// an opaque background, i.e. a callout that nested perfectly well before
		// losing nesting because of a fix meant to help it.
		const alpha = alphaFor("#ff0000", "#808080", false);
		assert.ok(alpha !== null, "went opaque rather than dropping the cap");
		assert.ok(alpha <= 0.6, `${alpha} is past the ceiling`);
	});

	it("binds hardest on a background bolder than its own derived tint", () => {
		// A background at 45% of its accent — the case where the cap is doing
		// visible work rather than sitting under the colour's own minimum.
		const accent = "#e93147";
		const bg = bgTintFor(accent, false, 0.45);
		const alpha = alphaFor(accent, bg, false);
		assert.ok(alpha !== null);
		assert.ok(
			alpha > 0.4,
			`the accent cap should bind well above the minimum here, got ${alpha}`,
		);
		assert.ok(
			reach(tintColorAt(bg, false, alpha), false) <=
				reach(accent, false) + 3,
			"the source out-reached the accent it was capped against",
		);
	});

	it("drops a cap it cannot meet and keeps the colour's own minimum", () => {
		// `#cccccc` really is `#bbbbbb` at 75% — the accent cap is arithmetically
		// right and unreachable, since 0.75 is past MAX_TINT_ALPHA. Handing it to
		// `resolveTintAlpha` beside the minima returned null, i.e. an opaque
		// background: a callout that nested fine on master stopped nesting
		// because of a fix meant to help it. What is left is the bare minimum,
		// which is always satisfiable by construction.
		const alpha = alphaFor("#bbbbbb", "#cccccc", false);
		assert.strictEqual(alpha, uncappedAlpha("#cccccc", false));
		assert.ok(alpha !== null);
	});

	it("does not go opaque for the pair that regressed", () => {
		// accent `#4287f5`, background nudged a few levels off its derived tint.
		for (const bg of ["#dde9f0", "#dde9fa"]) {
			const alpha = alphaFor("#4287f5", bg, false);
			assert.ok(alpha !== null, `${bg} went opaque`);
			assert.ok(
				alpha < 0.5,
				`${bg} resolved at ${alpha}, which all but flattens the step`,
			);
		}
	});

	it("answers from the def and the mode alone, with no setting to read", () => {
		// Deliberate, and worth pinning. The obvious alternative shape is a knob
		// that bounds how far a stack may accumulate, which needs a
		// `.callout .callout` rule restating the bound with the page colour mixed
		// into core's tint — i.e. it works by diluting every level, and nested
		// callouts come out desaturated at every value it could offer. This takes
		// the other route entirely: leave Obsidian's compositing alone and fix
		// the colour it converges on. So there is no setting in the signature,
		// and the answer cannot move with one.
		assert.strictEqual(resolveBgAlpha.length, 2);
	});

	it("emits no tint at all for a background that is not a hex", () => {
		// Null hands `bgProps` the value verbatim, so a hand-edited
		// `"transparent"` paints transparent instead of resolving to
		// `color-mix(in oklch, #NaNNaNNaN …)` and being dropped by the parser.
		for (const bad of ["transparent", "red", "", "#abc"]) {
			assert.strictEqual(alphaFor("#e93147", bad, false), null, bad);
		}
	});
});
