/**
 * utils/bgTintAlpha.ts — picks the alpha a callout's background is painted at in
 * one theme mode.
 *
 * Split out of colorUtils.ts / CSSInjector.ts rather than grown in either — both
 * are already at `tests/repoSourceRules.test.ts`'s frozen line count, which asks
 * for a sibling module instead of raising those numbers. colorUtils.ts owns the
 * maths of the tint itself (`translucentTintFor` / `minTintAlpha` /
 * `resolveTintAlpha` / `tintColorAt`); this file owns the *choice* of alpha among
 * the many that would work. See the `callout-color-nesting` skill for the wider
 * derivation.
 *
 * Why there is a choice to make at all. A background is emitted as
 * `color-mix(in oklch, S alpha%, transparent)` with `S` solved so the callout
 * renders as exactly the authored hex on the page — so `S` and the alpha move
 * together, and EVERY alpha at or above `minTintAlpha` reproduces the callout
 * itself identically. What they do not reproduce identically is everything
 * stacked inside it: nesting depth `n` renders `S + (1 - alpha)ⁿ·(backdrop - S)`,
 * which converges to `S`, and `‖S - backdrop‖` is `‖bg - backdrop‖ / alpha`.
 *
 * The alpha is therefore one knob between two things wanted at once:
 *
 * - a LOW alpha gives the boldest step per level — exactly
 *   `(1 - alpha)·(bg - backdrop)` — at the cost of a wildly saturated `S`, which
 *   is what a deep stack drifts toward. Taking the smallest viable alpha, always,
 *   is what this plugin used to do, and what the "nested callouts become
 *   unreadable" reports were about.
 * - a HIGH alpha keeps a deep stack near the colour that was actually authored,
 *   at a smaller step per level.
 *
 * One cap raises the floor: {@link accentAnchorAlpha} — never end up more intense
 * than the callout's own accent. It is a PREFERENCE rather than a constraint;
 * {@link resolveBgAlpha} drops one it cannot satisfy instead of escalating, and
 * that distinction is the whole ballgame.
 *
 * **What is deliberately NOT here is a ceiling on nesting depth, and there is no
 * setting for one either.** Bounding the ladder at a fixed multiple of the
 * authored background needs a `.callout .callout` rule restating the cap with the
 * page colour pre-mixed into core's tint — which works by *diluting every level
 * with `--background-primary`*, so nested callouts come out desaturated instead
 * of staying themselves. This file leaves Obsidian's own compositing completely
 * alone and fixes what was actually wrong with it: the colour that compositing
 * was converging on.
 */
import type { CalloutDefinition } from "../types";
import {
	hexToRgb,
	isValidHexColor,
	minTintAlpha,
	resolveTintAlpha,
	tintBackdrop,
} from "./colorUtils";

/**
 * How far a colour sits from the mode's own page background, as one number.
 *
 * Straight-line distance in sRGB, matching the space the rest of the tint solve
 * works in. Only meaningful for a `#rrggbb` hex; both callers check first.
 */
function backdropDistance(hex: string, isDark: boolean): number {
	const b = tintBackdrop(isDark);
	const c = hexToRgb(hex);
	return Math.hypot(c.r - b.r, c.g - b.g, c.b - b.b);
}

/**
 * The alpha at which the solved tint source lands exactly as far from the page as
 * `accent` itself — i.e. the blend strength `opaque` would have been derived at,
 * if it was derived from `accent` at all. `0` when there is no such alpha to
 * speak of.
 *
 * Feeding it into the solve caps a deep nested stack at the callout's own accent:
 * the stack converges to the source, and at this alpha the source is the accent's
 * equal in intensity. Solving from `opaque` alone — all the plugin used to do —
 * finds the smallest alpha that merely keeps the source in gamut, which is
 * provably at or below the true blend amount and far below it whenever the accent
 * is not fully saturated. That is how a red callout's nesting drifted to a red
 * nobody picked.
 *
 * Intensity is measured as ONE distance rather than three channels. A tint is a
 * straight line toward the backdrop, so the distance scales by exactly the blend
 * amount and this ratio recovers it whatever the hue. Solving per channel and
 * taking the largest candidate — the obvious reading of "no channel may
 * out-saturate the accent" — looks equivalent and is not: a channel where the
 * accent sits a few levels from the page has a near-zero denominator, so one hex
 * level of rounding becomes a huge ratio and that channel wins every time.
 * `#4287f5` sits 10 levels below white on blue, and a background nudged 3 levels
 * there asked for alpha 0.51 in place of 0.14.
 *
 * `0` — no cap at all — for an accent that IS the page colour (no axis to measure
 * along), and for anything that is not a `#rrggbb` hex. The second guard is what
 * keeps hand-edited data (`"transparent"`, a CSS colour name) out of the maths
 * instead of turning the alpha into `NaN`.
 */
export function accentAnchorAlpha(
	accent: string,
	opaque: string,
	isDark: boolean,
): number {
	if (!isValidHexColor(accent) || !isValidHexColor(opaque)) return 0;
	const reach = backdropDistance(accent, isDark);
	if (reach === 0) return 0;
	return backdropDistance(opaque, isDark) / reach;
}

/**
 * The alpha a def's background is painted at in one mode, or null when it is
 * painted opaque.
 *
 * A gradient's two stops share one alpha: they are a single `linear-gradient`,
 * and ramping the alpha across it would tilt the sweep, so the shared value has
 * to clear whichever stop sits further from the page. Null means no alpha at or
 * below the ceiling can reproduce the colour — see `translucentTintFor` — and the
 * caller paints the authored hex, accepting no nesting step for that one callout.
 *
 * The caps are applied SECOND, over the un-capped answer, and one at a time.
 * That is the important line in this file. A cap is a preference — *don't end up
 * more intense than the accent* — and a preference that cannot be met has to be
 * given up, not escalated: handed to `resolveTintAlpha` alongside the real minima
 * it returns null above the ceiling, and null is the opaque fallback. A
 * background BOLDER than its own accent (a grey accent over a darker grey fill)
 * genuinely asks for 0.75, and taking that literally would trade a perfectly good
 * translucent tint for a flat fill — losing nesting outright, for the callout
 * this code exists to protect. One at a time rather than as a set, because they
 * are independent: an unsatisfiable cap on one gradient stop must not take the
 * other's down with it.
 *
 * The gradient's far stop is capped ONLY against its own accent-strength colour
 * (`textToColor*`, the second colour the title sweep runs to — see
 * `CSSInjector.textGradientCss`), never against the primary accent as a stand-in.
 * That stop is a deliberately different hue (the palette editor's suggested
 * default rotates it — see `rotateHue`), so the primary accent says nothing about
 * how intense it is allowed to be. With no `textToColor*` there is no accent for
 * that stop, and it carries no cap at all.
 *
 * A background that is not a `#rrggbb` hex returns null as well, so `bgProps`
 * emits it verbatim. Only hand-edited data reaches that state — `sanitizeBgGradient`
 * and the import validator reject the rest — and `background-color: transparent`
 * out of a hand-edited `data.json` is at least the thing that was asked for, where
 * solving it emits `color-mix(in oklch, #NaNNaNNaN …)` and is dropped by the
 * parser.
 */
export function resolveBgAlpha(
	def: CalloutDefinition,
	mode: "light" | "dark",
): number | null {
	const isDark = mode === "dark";
	const bg = isDark ? def.bgColorDark : def.bgColorLight;
	if (!bg || !isValidHexColor(bg)) return null;

	const minima = [minTintAlpha(bg, isDark)];
	const caps = [
		accentAnchorAlpha(isDark ? def.colorDark : def.colorLight, bg, isDark),
	];

	const gradient = def.bgGradient;
	if (gradient) {
		const to = isDark ? gradient.toColorDark : gradient.toColorLight;
		if (isValidHexColor(to)) {
			minima.push(minTintAlpha(to, isDark));
			const stopAccent = isDark
				? gradient.textToColorDark
				: gradient.textToColorLight;
			if (stopAccent) caps.push(accentAnchorAlpha(stopAccent, to, isDark));
		}
	}

	let alpha = resolveTintAlpha(...minima);
	if (alpha === null) return null;
	for (const cap of caps) {
		const raised = resolveTintAlpha(...minima, cap);
		if (raised !== null && raised > alpha) alpha = raised;
	}
	return alpha;
}
