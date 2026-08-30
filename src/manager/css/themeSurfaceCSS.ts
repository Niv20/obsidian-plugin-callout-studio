/**
 * manager/css/themeSurfaceCSS.ts — standing down from the callout *surface*
 * when the active styling owns it, under the theme's own guard.
 *
 * `manager/theme/calloutSurface.ts` decides *whether* and *where*; this decides
 * what that costs the emitted stylesheet. Three declarations, and each one is a
 * measured answer to a symptom rather than a tidy-up:
 *
 * ## The surface
 *
 *     <guard> .callout…[data-callout="x"] {
 *       background-color: transparent !important;
 *       background-image: none !important;
 *     }
 *
 * GitHub Theme with **GitHub callout style** on, Prism, Cybertron and thirteen
 * others blank `.callout` at ordinary importance; this plugin paints it with
 * `!important`, so the studio callout is the only filled box on the page. In
 * Prism the damage is worse than a mismatch: Prism draws no frame on `.callout`
 * at all — the visible box is `.callout-title`'s 2px border over
 * `.callout-content`'s 1px ones — while `.callout` itself carries
 * `--callout-padding: 4px` and a radius of its own. A background painted there
 * is a 4px halo in a different radius around a box it does not belong to, which
 * is what reads as a colour "spilling" out of the bottom-right corner.
 *
 * Emitted as a **cancel** rather than by suppressing `bgProps` at the source,
 * and that is the whole reason a Style Settings toggle works live. Style
 * Settings' `setSetting` adds and removes body classes and fires no
 * `css-change`, so a decision taken in JS would never be revisited. Restating
 * the theme's guard in front of our own selector puts the decision back in the
 * cascade: one stylesheet carries both states and the browser picks, instantly,
 * with nothing re-injected. It also covers the light rule, the `.theme-dark`
 * rule and every alias copy in one block rather than three.
 *
 * ## The content colour
 *
 *     <guard> … > .callout-content { color: inherit !important; }
 *
 * Only when the colour being cancelled is `DEFAULT_TEXT_COLOR_*` — the value the
 * editor *invents* to have something to show in a swatch, not one the user
 * picked. `settings/editor/authoredStyle.ts` draws that line for the save path
 * and `CalloutRegistry.dropDerivedBackgrounds` applies the same doctrine
 * retroactively to backgrounds; this is the third place it holds. A text colour
 * the user chose is never discarded, in any theme.
 *
 * It matters far more than a text colour usually would, because in these themes
 * `color` is *structural*: Prism's and Cybertron's frame shorthands state no
 * colour, so the frame draws in `currentColor` and this declaration was painting
 * it. Measured on Cybertron, whose built-in callouts frame themselves in the
 * theme's cyan `--text-normal`: the studio callout came out `rgb(224,224,224)`,
 * which is `#e0e0e0`, which is this plugin's own default.
 *
 * ## The frame
 *
 *     <guard> … > .callout-title, <guard> … > .callout-content {
 *       border-color: var(--cs-accent) !important;
 *     }
 *
 * Cancelling the colour above hands the frame back to the theme's `--text-normal`,
 * which matches the theme's own callouts but is not what a callout with a chosen
 * accent should look like. `--cs-accent` is declared on the callout root for
 * every definition in every mode (`manager/accentDeclarations.ts`), is guaranteed
 * to be a real colour, and inherits to both children — so this follows an
 * arbitrary custom colour, follows the theme on an unmodified built-in, and gives
 * a nested callout its *own* accent because each level redeclares the variable.
 *
 * Three things it deliberately does not do:
 *
 * - **It never touches `.callout` itself.** All four themes that leave the frame
 *   colourless put those borders on the title and the content, and the callout
 *   root is where the plugin's own global-border setting paints. Leaving the root
 *   alone means these two features cannot collide.
 * - **It stands down for `transparentBg`.** That definition already emits
 *   `border-color: transparent` from `transparentBorderProps`, and the user asking
 *   for a callout to disappear outranks the theme's frame having an opinion.
 * - **It is vetoed whenever the active styling colours a generic frame anywhere** —
 *   see `calloutSurface.ts`, which owns that rule and the theme that proves it.
 *
 * ## Why `weight + 2`
 *
 * These rules cancel the plugin's own `!important` declarations, so specificity
 * is what decides between them, and the heaviest thing being cancelled is the
 * dark-mode block at `(0, weight + 2, 0)` — `.theme-dark` contributes a class of
 * its own. An unguarded cancel at `weight + 1` would only *tie* it and win on
 * source order; `weight + 2` wins outright, in every guard including the empty
 * one, with no dependence on where in the file this lands.
 */
import type { CalloutSurface } from "../theme/calloutSurface";
import { guardPrefix } from "../theme/calloutSurface";

export interface ThemeSurfaceInput {
	/**
	 * `.callout…[data-callout="x"]` for the id and every alias, comma-joined,
	 * already built at the cancel weight and behind `guardPrefix(guard)`.
	 *
	 * A callback because the two callers spell a callout differently: the
	 * per-callout block names ids, and `fallbackCSS` writes one `:not()` chain
	 * that names none of them.
	 */
	selectorsFor(guard: string): string;
	/** What the active styling says. */
	surface: CalloutSurface;
	/** True when this def emits background declarations there would be anything to cancel. */
	paintsBackground: boolean;
	/** True when it emits a `.callout-content { color }` that is the plugin's own default. */
	cancelsContentColor: boolean;
	/** True when the def asked to be transparent — the frame rule stands down. */
	transparentBg: boolean;
}

/** Re-point a comma-joined selector list at one child or pseudo of each part. */
function each(sels: string, tail: string): string {
	return sels
		.split(",\n")
		.map((s) => `${s}${tail}`)
		.join(",\n");
}

/** The `::before` half of the same list — see the print cancel below. */
function before(sels: string): string {
	return each(sels, "::before");
}

/** The block for one callout, or `""` when the active styling claims nothing. */
export function themeSurfaceCSS(input: ThemeSurfaceInput): string {
	const parts: string[] = [];

	for (const guard of input.surface.neutralBackground) {
		const sels = input.selectorsFor(guardPrefix(guard));
		if (input.paintsBackground) {
			parts.push(
				`${sels} {\n` +
					`  background-color: transparent !important;\n` +
					`  background-image: none !important;\n` +
					`}`,
			);
			// PDF export repaints a gradient onto a `::before` at `inset: 0`
			// (see `printGradientCSS`), which is a second copy of the same
			// surface and spills exactly as the first one did. Only its
			// `background-image` is cancelled, never its `content`: killing the
			// pseudo-element outright would take a theme's own `::before` with
			// it, and an empty absolutely-positioned box paints nothing anyway.
			parts.push(
				`@media print {\n${before(sels)} {\n` +
					`  background-image: none !important;\n` +
					`}\n}`,
			);
		}
		if (input.cancelsContentColor) {
			parts.push(
				`${each(sels, " > .callout-content")} {\n  color: inherit !important;\n}`,
			);
		}
	}

	if (!input.transparentBg) {
		for (const guard of input.surface.colorlessFrame) {
			const sels = input.selectorsFor(guardPrefix(guard));
			const boxes = [
				each(sels, " > .callout-title"),
				each(sels, " > .callout-content"),
			].join(",\n");
			parts.push(`${boxes} {\n  border-color: var(--cs-accent) !important;\n}`);
		}
	}

	return parts.join("\n\n");
}
