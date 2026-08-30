/**
 * manager/css/transparentBorder.ts — the outline half of `transparentBg`.
 *
 * Split out of `CSSInjector` rather than left as a private method: both the
 * per-callout block and `fallbackCSS` need it, the latter already reaching it
 * through `FallbackCssContext`, and it reads nothing off the injector but one
 * settings field. A pure function of that field is the honest shape.
 */
import type { BorderSidesSettings } from "../../types";

/**
 * Emitted only for a def that clears its background, and only for the
 * block-callout roles.
 *
 * Clearing the background alone still leaves the box outlined on any theme
 * that gives callouts a frame. Core draws that frame itself:
 *
 *     .callout {
 *       border-style: solid;
 *       border-color: color-mix(in oklch, var(--callout-color)
 *                     calc(var(--callout-border-opacity) * 100%), transparent);
 *       border-width: var(--callout-border-width);   // 0px out of the box
 *     }
 *
 * so a theme turns it on by doing nothing more than raising that width — and
 * the colour it comes out in is `--callout-color`, which is *this plugin's*
 * accent. The callout the user asked to disappear reads as an empty outline
 * in their custom colour instead. Some themes draw the same frame — or an
 * elevation ring — as an inset `box-shadow` keyed off the very same
 * variable instead of (or in addition to) `border`, so both have to go.
 *
 * `border-color` rather than the `--callout-border-opacity` knob, even
 * though the knob is what core's own rule reads: custom properties inherit,
 * so zeroing it here would also silently reach every callout NESTED inside
 * this one and strip the theme's frame off callouts nobody made transparent.
 * The colour is per-element and can't leak. It also outranks the variable
 * route anyway — core declares the border on `.callout` (0,1,0) while this
 * lands on `.callout[data-callout="…"]` (0,2,0). `box-shadow: none` has no
 * comparable variable to leak through in the first place — it fully
 * replaces whatever the theme declared for this callout alone.
 *
 * The width is deliberately left alone: the frame keeps its box, so a
 * transparent callout still lines up with its neighbours and nothing
 * reflows — only the ink goes.
 *
 * `border-color` is empty when the user has switched the plugin's OWN
 * global border on. That border is an explicit choice, drawn in the accent
 * by `generateGlobalStyleCSS` at one class less than this rule, so clearing
 * the colour here would quietly erase it. `box-shadow: none` carries no
 * such conflict — the plugin never draws its own border that way — so it is
 * unconditional.
 */
export function transparentBorderProps(
	borderSides: BorderSidesSettings,
	important = false,
): string[] {
	const imp = important ? " !important" : "";
	const { top, right, bottom, left } = borderSides;
	const props = [`  box-shadow: none${imp};`];
	if (!(top || right || bottom || left)) {
		props.push(`  border-color: transparent${imp};`);
	}
	return props;
}
