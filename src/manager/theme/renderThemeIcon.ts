/**
 * manager/theme/renderThemeIcon.ts — drawing a theme's own callout icon
 * anywhere Callout Studio lists that callout.
 *
 * The counterpart to `icons/renderIcon.ts`, which is the only code allowed to
 * draw a *Callout Studio* icon. This is the only code allowed to draw a
 * **theme's**, and the division matters: a theme-owned callout must never be
 * shown wearing the artwork stored on its row, because that artwork describes a
 * design the reader will never see.
 *
 * Every rung reproduces what was measured rather than interpreting it again —
 * see `themeAppearance.ts` for how the measurement is taken and why the ladder
 * is ordered as it is. The two colour-dependent rungs inherit `currentColor`,
 * so a caller that sets the accent on the container gets a drawing that matches
 * the callout without this function knowing anything about colour.
 */
import { importCoreIconSvg } from "../css/coreIcon";
import { renderNoIcon } from "../../icons/renderIcon";
import type { ThemeIcon } from "./themeIcon";

/** Marks the two rungs that are not an inline SVG, for `styles.css`. */
const MASK_CLASS = "cs-theme-icon-mask";
const GLYPH_CLASS = "cs-theme-icon-glyph";

/**
 * Draw `icon` into `target`, replacing whatever was there.
 *
 * Returns `false` when nothing was drawn, which happens two ways that callers
 * usually want to treat alike: the theme hides the icon, or nothing legible
 * came back. Both mean "no artwork here" — the difference is that `hidden` is
 * the theme's decision and `unknown` is our ignorance, so `unknown` gets the
 * dashed placeholder `renderNoIcon` draws for a stalled download, while
 * `hidden` leaves a genuinely empty slot.
 */
export function renderThemeIconInto(
	target: HTMLElement,
	icon: ThemeIcon,
): boolean {
	target.empty();
	target.removeClass(MASK_CLASS);
	target.removeClass(GLYPH_CLASS);

	switch (icon.kind) {
		case "svg": {
			// Parsed as `image/svg+xml`, which builds no scripting context. The
			// markup came out of a callout the page had already rendered, so it
			// is the theme's own artwork on the same trust boundary it was
			// installed under.
			const svg = importCoreIconSvg(icon.markup, target.doc);
			if (!svg) break;
			target.appendChild(svg);
			return true;
		}
		case "mask": {
			// There is no drawing to copy — the artwork is a stencil over a
			// painted box, so the box is what gets reproduced.
			target.addClass(MASK_CLASS);
			target.style.setProperty("--cs-theme-mask", icon.image);
			return true;
		}
		case "glyph": {
			// A pseudo-element cannot be cloned, so its content becomes real
			// text in a real span, carrying the font that made it a glyph rather
			// than three letters.
			const span = target.createSpan({
				cls: GLYPH_CLASS,
				text: icon.text,
			});
			if (icon.fontFamily.trim().length > 0) {
				span.style.fontFamily = icon.fontFamily;
			}
			return true;
		}
		case "hidden":
			return false;
		case "unknown":
			break;
	}

	renderNoIcon(target);
	return false;
}

/**
 * A cache key for a theme icon, for the Live Preview widgets' `eq()` snapshot.
 *
 * Lives here rather than in `renderShared` because it has to change whenever
 * {@link renderThemeIconInto} would draw something different, and keeping the
 * two in one file is what makes that easy to see. Without it a widget survives
 * a theme switch still showing the previous theme's drawing, because the key it
 * was built from — `def.icon` — did not move.
 */
export function themeIconKey(icon: ThemeIcon): string {
	switch (icon.kind) {
		case "svg":
			return `theme:svg:${icon.markup}`;
		case "mask":
			return `theme:mask:${icon.image}`;
		case "glyph":
			return `theme:glyph:${icon.fontFamily}:${icon.text}`;
		default:
			return `theme:${icon.kind}`;
	}
}
