/**
 * manager/css/backgroundProps.ts — the `background-color` / `background-image`
 * declarations one definition carries, for one theme mode.
 *
 * Split out of `CSSInjector` rather than left as two private methods, for the
 * reason `transparentBorder.ts` was: `fallbackCSS` already reaches both of them
 * through `FallbackCssContext`, so they were being passed around as plain
 * functions of a definition already — and they read nothing off the injector but
 * `resolveBgAlpha`, which is itself a free function. A pure function of the
 * definition is the honest shape, and it is the shape the ratchet in
 * `tests/repoSourceRules.test.ts` asks for.
 */
import { bgGradientCss, tintColorAt, tintCss } from "../../utils/colorUtils";
import { resolveBgAlpha } from "../../utils/bgTintAlpha";
import type { CalloutDefinition } from "../../types";

/** One `background-image` layer: a gradient sweep. */
export interface BgLayer {
	image: string;
}

/**
 * Background declarations for one theme mode: the color plus, when a
 * gradient is set, the image layered on top. The `background-color`
 * doubles as the fallback if a renderer drops the image;
 * `print-color-adjust: exact` keeps the image from being stripped when
 * exporting to PDF / printing. Empty when the mode has no background
 * color (a gradient alone has no base to render on).
 *
 * The color is emitted as a TRANSLUCENT tint that renders as the authored
 * hex on the theme's own background, not as the hex itself. That is what
 * restores Obsidian's nesting: core gives nested callouts their stepped look
 * purely by compositing translucent layers, and an opaque fill hides
 * everything behind it — under `mix-blend-mode: darken` a colour over itself
 * is `min(x, x) = x`, a step of exactly zero. The callout looks unchanged on
 * its own; only what shows *through* it changes. There is no opt-out into an
 * opaque fill: it would break nesting for every callout stacked inside it.
 *
 * `transparentBg` is the one way out and is checked FIRST, before the
 * no-background return below — a transparent def carries no bg hex at all,
 * so it would otherwise fall out here emitting nothing, and "nothing" is not
 * transparent: it hands the callout back to core's own default tint. It is
 * also not the opaque opt-out in disguise (see `CalloutDefinition`): zero
 * alpha hides nothing, so a callout nested inside a transparent one still
 * tints normally.
 */
export function bgProps(
	def: CalloutDefinition,
	mode: "light" | "dark",
	important = false,
): string[] {
	if (def.transparentBg) {
		const impT = important ? " !important" : "";
		// `background-image: none` is load-bearing, not belt-and-braces: a
		// theme can paint one, and it also stops a gradient left behind by
		// hand-edited data from showing through the cleared colour.
		return [
			`  background-color: transparent${impT};`,
			`  background-image: none${impT};`,
		];
	}
	const bg = mode === "dark" ? def.bgColorDark : def.bgColorLight;
	if (!bg) return [];
	const imp = important ? " !important" : "";
	const alpha = resolveBgAlpha(def, mode);
	const color =
		alpha === null
			? bg
			: tintCss(tintColorAt(bg, mode === "dark", alpha), alpha);
	const props = [`  background-color: ${color}${imp};`];
	const layer = bgImageFor(def, mode);
	if (layer) {
		props.push(
			`  background-image: ${layer.image}${imp};`,
			`  -webkit-print-color-adjust: exact${imp};`,
			`  print-color-adjust: exact${imp};`,
		);
	}
	return props;
}

/**
 * The `background-image` layer for one mode: the gradient sweep, or null
 * when the def has no gradient, or when the mode has no background color
 * to sweep from.
 *
 * Both stops go through the same tint solve as the flat color above, at the
 * one shared alpha from `bgAlphaFor`. They have to: an opaque gradient
 * painted over a translucent `background-color` would put the opaque layer
 * back on top and re-hide the backdrop the tint just exposed.
 */
export function bgImageFor(
	def: CalloutDefinition,
	mode: "light" | "dark",
): BgLayer | null {
	// A sweep is a background, so transparency wins over it. `bgProps`
	// already returns before reaching here; this guards the hand-edited case
	// where a gradient survived alongside the flag.
	if (def.transparentBg) return null;
	const bg = mode === "dark" ? def.bgColorDark : def.bgColorLight;
	if (!bg) return null;
	if (!def.bgGradient) return null;
	const isDark = mode === "dark";
	const to = isDark
		? def.bgGradient.toColorDark
		: def.bgGradient.toColorLight;
	const alpha = resolveBgAlpha(def, mode);
	if (alpha === null) {
		return { image: bgGradientCss(bg, to, def.bgGradient) };
	}
	return {
		image: bgGradientCss(
			tintCss(tintColorAt(bg, isDark, alpha), alpha),
			tintCss(tintColorAt(to, isDark, alpha), alpha),
			def.bgGradient,
		),
	};
}
