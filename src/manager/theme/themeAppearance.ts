/**
 * manager/theme/themeAppearance.ts — turning what a rendered callout *looks
 * like* into data, so every surface can draw a theme's callout the theme's way.
 *
 * Pure: readouts in, appearance out. The DOM half lives in
 * `ThemeAppearanceProbe.ts`, the same split `themeCalloutScan` (pure) and
 * `ThemeCalloutStore` (caching) already use, and for the same reason — this
 * half has to be testable without a browser, and the fake DOM has no cascade.
 *
 * ## Why used values, and not the stylesheet
 *
 * `themeCalloutScan` parses theme CSS as text and keeps property *names* only:
 * it can say that a theme declares `--callout-color` for `[!note]`, never what
 * colour that is. No amount of parsing fixes that, because the answer is
 * whatever the cascade computes — through variables, `color-mix()`,
 * inheritance, a Style Settings body class the user toggled ten minutes ago.
 *
 * So nothing here interprets CSS. It reads *used values* off a real rendered
 * callout, which is why it can be honest about every theme rather than the ones
 * that happen to be written in a shape a parser recognises. The corresponding
 * rule for callers: a theme-owned callout is drawn from these values or from a
 * neutral placeholder, **never** from the row's stored `icon` / `colorLight` —
 * those describe a design that is not on screen.
 *
 * The icon is a separate question, with its own five-rung derivation and its
 * own consumer in `renderThemeIcon.ts`; it lives in `themeIcon.ts`. This file
 * asks it, and reads the colours.
 *
 * ## The accent ladder
 *
 * `.callout-title` is **not** where a theme necessarily states a callout's
 * colour, and reading only it is what showed core's default blue for a fifth of
 * the corpus. Obsidian's own stylesheet is the whole explanation:
 *
 * ```css
 * .callout             { --callout-color: var(--callout-default); }
 * .callout-title       { color: rgb(var(--callout-color)); }
 * .callout-title-inner { color: var(--callout-title-color); }
 * :root                { --callout-title-color: inherit; }
 * ```
 *
 * `--callout-title-color` is core's documented hook for colouring a callout
 * title, and 25 of the 257 themes use it — **13 of which never set
 * `--callout-color` at all**. For those, `.callout-title` keeps core's default
 * hue forever while the title the reader sees carries the theme's. So the
 * accent is taken from the most deliberate evidence available:
 *
 * 1. **The `::before`'s own paint**, when the `::before` is what draws the icon
 *    — its `background-color` under a mask, its `color` under a glyph. Core
 *    paints no `::before` at all, so a painted one is always a theme saying so.
 * 2. **`.callout-title-inner`'s colour** — the hook above. Because it defaults
 *    to `inherit` this is byte-identical to rung 3 for every theme that does
 *    not use it, which is what makes adding it safe.
 * 3. **`.callout-title`'s colour** — `rgb(var(--callout-color))`.
 *
 * The child `<svg>`'s own colour is deliberately *not* a rung: core paints it
 * `rgb(var(--callout-color))`, so it would duplicate rung 3 while letting the
 * handful of themes that neutralise their icon artwork (`--text-muted`,
 * `transparent`) drain the colour out of a swatch that is currently right.
 */

import {
	drawnByPseudo,
	iconKey,
	readThemeIcon,
	type ThemeIcon,
} from "./themeIcon";

// The icon vocabulary is re-exported so a caller that wants one reading of a
// rendered callout still has one import to make.
export { readThemeIcon, type ThemeIcon } from "./themeIcon";

/** One rendered callout, as a handful of computed strings. */
export interface ProbeReadout {
	/** Computed `color` of `.callout-title` — core resolves this to the accent. */
	titleColor: string;
	/**
	 * Computed `color` of `.callout-title-inner`, the element that actually
	 * holds the title text and the one core's `--callout-title-color` hook
	 * paints. `inherit` by default, so this equals {@link titleColor} unless a
	 * theme has used the hook.
	 */
	titleTextColor: string;
	/** Computed `background-color` of `.callout`. */
	background: string;
	/** Computed `background-image` of `.callout`, for gradient-painted themes. */
	backgroundImage: string;
	/** Computed `display` of `.callout-icon`. */
	iconDisplay: string;
	/** The icon element's child markup, or `null` when it has none. */
	iconMarkup: string | null;
	/**
	 * Computed `display` of the icon element's first element child — the drawing
	 * itself, which a theme can switch off without touching the slot around it.
	 * `""` when there is no child to ask.
	 */
	iconChildDisplay: string;
	/** Computed `mask-image` (or its `-webkit-` twin) of `.callout-icon`. */
	iconMask: string;
	/** Computed `content` of `.callout-icon::before`. */
	iconPseudoContent: string;
	/** Computed `font-family` of `.callout-icon::before`. */
	iconPseudoFont: string;
	/** Computed `mask-image` (or its `-webkit-` twin) of `.callout-icon::before`. */
	iconPseudoMask: string;
	/** Computed `background-color` of `.callout-icon::before` — a mask's paint. */
	iconPseudoBackground: string;
	/** Computed `color` of `.callout-icon::before` — a glyph's paint. */
	iconPseudoColor: string;
}

export interface ThemeAppearance {
	/** The accent as a used colour, or `null` when nothing legible was read. */
	accent: string | null;
	/** The surface colour behind the callout, or `null`. */
	background: string | null;
	icon: ThemeIcon;
}

/** What a caller shows when the probe could not run at all. */
export const UNKNOWN_APPEARANCE: ThemeAppearance = {
	accent: null,
	background: null,
	icon: { kind: "unknown" },
};

/**
 * A fully transparent colour, in either serialization —
 * `rgba(r, g, b, 0)` and `rgb(r g b / 0)`.
 *
 * The alpha component is **named** rather than searched for. The earlier
 * `/^rgba?\([^)]*?,\s*0*(?:\.0+)?\s*\)$/` let its lazy head slide onto the
 * *blue* channel, so every opaque colour whose last channel is zero came back
 * transparent: `rgb(184, 131, 0)` — Sanctum's amber, and so its `warning`,
 * `caution`, `attention`, `alarm`, `idea` and `win` — along with pure red,
 * yellow and green in any theme. {@link colorOrNull} then returned `null`, and
 * a row whose accent is `null` is drawn with no swatch and no colour at all,
 * which reads as the probe having failed rather than as a bug in one regex.
 */
const ZERO_ALPHA_RE =
	/^rgba?\([^,/)]+[,\s]+[^,/)]+[,\s]+[^,/)]+\s*[,/]\s*(?:0|0?\.0+|0%)\s*\)$/;

/** Values a computed colour takes when nothing is painted. */
function isBlankColor(value: string): boolean {
	const v = value.trim().toLowerCase();
	if (v.length === 0 || v === "transparent" || v === "none") return true;
	return ZERO_ALPHA_RE.test(v);
}

function colorOrNull(value: string): string | null {
	return isBlankColor(value) ? null : value.trim();
}

/**
 * The first concrete colour inside a `background-image`.
 *
 * A theme that paints its callouts with a gradient leaves `background-color`
 * transparent, so the swatch would come out empty for exactly the themes that
 * put the most work into their callouts. One stop is not the gradient, but it
 * is a colour the reader can genuinely see in that callout, which is what a
 * swatch is for.
 */
export function firstGradientColor(image: string): string | null {
	const match = /(#[0-9a-f]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\))/i.exec(
		image,
	);
	if (!match?.[1]) return null;
	return isBlankColor(match[1]) ? null : match[1];
}

/**
 * The colour the theme painted the icon with, when the icon is the theme's own
 * `::before` rather than core's markup — see the accent ladder above for why
 * that is the most deliberate evidence there is.
 */
function pseudoIconPaint(readout: ProbeReadout, icon: ThemeIcon): string | null {
	if (!drawnByPseudo(readout, icon)) return null;
	return icon.kind === "glyph"
		? colorOrNull(readout.iconPseudoColor)
		: colorOrNull(readout.iconPseudoBackground);
}

/**
 * Everything one rendered callout can tell us about how its theme paints it.
 *
 * Both colours are `null` rather than a guess when nothing legible came back.
 * A caller that substitutes the row's stored colour there has reintroduced the
 * exact bug this module exists to remove — the swatch would then confidently
 * name a colour that is not on screen.
 */
export function readThemeAppearance(readout: ProbeReadout): ThemeAppearance {
	const icon = readThemeIcon(readout);
	return {
		accent:
			pseudoIconPaint(readout, icon) ??
			colorOrNull(readout.titleTextColor) ??
			colorOrNull(readout.titleColor),
		background:
			colorOrNull(readout.background) ??
			firstGradientColor(readout.backgroundImage),
		icon,
	};
}

/** Do two readings describe the same rendered callout? */
export function sameThemeAppearance(
	a: ThemeAppearance,
	b: ThemeAppearance,
): boolean {
	return (
		a.accent === b.accent &&
		a.background === b.background &&
		iconKey(a.icon) === iconKey(b.icon)
	);
}

/**
 * Do two whole measurement passes agree?
 *
 * The reason this exists rather than a `!==` on the map: publishing a set of
 * appearances now announces a registry change, and announcing one that changed
 * nothing costs a CSS regeneration, a `data.json` write and a settings-tab
 * repaint. A theme switch that lands on the same colours must stay silent.
 */
export function sameThemeAppearances(
	a: ReadonlyMap<string, ThemeAppearance>,
	b: ReadonlyMap<string, ThemeAppearance>,
): boolean {
	if (a.size !== b.size) return false;
	for (const [id, appearance] of a) {
		const other = b.get(id);
		if (!other || !sameThemeAppearance(appearance, other)) return false;
	}
	return true;
}
