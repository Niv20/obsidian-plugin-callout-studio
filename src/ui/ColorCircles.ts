/**
 * ui/ColorCircles.ts — Two-circle accent/background color swatch widget.
 *
 * Shared renderer used by CalloutRowRenderer (settings list rows), the
 * custom palettes settings section, and the color preset dropdown inside
 * CalloutEditor. Renders two overlapping circles: the accent (title/icon)
 * color in front and the callout background color behind it — both resolved
 * for the CURRENT theme mode, so the swatch previews what the callout
 * actually looks like right now.
 */
import { bgTintFor } from "../utils/colorUtils";
import type { BgGradient } from "../types";

/**
 * The colors one swatch shows, already resolved for the current theme mode.
 *
 * A swatch is ~16px wide and the accent circle covers 40% of the background
 * circle, so a background effect has only a ~10px crescent to read in — far
 * too little room to *preview* one literally. Rendering a real gradient there
 * never reaches either end color (the eye only ever sees the blend's midpoint,
 * so two pale stops look exactly like a plain background). So the swatch encodes
 * a gradient instead, with the real colors but exaggerated geometry: it adds a
 * whole extra circle ({@link bgTo}).
 */
export interface SwatchColors {
	/** Title/icon color for the current theme mode. */
	accent: string;
	/** Callout background color — a gradient's first stop — for that mode. */
	bg: string;
	/**
	 * A background gradient's second stop, which gets its own circle behind
	 * {@link bg}. One circle per color is the widget's existing grammar, and a
	 * gradient really is one more color; giving it a bead of its own means the
	 * swatch can be *counted* rather than squinted at, and the circle's own
	 * border keeps the two stops apart even when they are near-identical tints
	 * (where a blend or a seam between them would show nothing at all).
	 *
	 * The gradient's angle is deliberately not encoded: it is illegible at this
	 * size, and the editor previews it for real.
	 */
	bgTo?: string;
	/**
	 * The callout paints no background. Drawn as the usual checkerboard rather
	 * than as an empty circle, which at 16px is indistinguishable from a swatch
	 * that failed to render. {@link bg} is then meaningless and ignored.
	 */
	transparent?: true;
}

/**
 * Resolves the accent/background pair to display for the current theme mode.
 * When the source has no explicit background for that mode, falls back to the
 * same pale tint the callout editor derives by default. A background gradient
 * additionally sets the field that draws it — see {@link SwatchColors}.
 */
export function resolveCurrentModeColors(source: {
	colorLight: string;
	colorDark: string;
	bgColorLight?: string;
	bgColorDark?: string;
	bgGradient?: BgGradient;
	/**
	 * Widened from the `true`-only field on a definition: this reads a source
	 * for display, and the editor's in-progress form state carries a plain
	 * boolean (a control needs an off position). The narrow type exists to keep
	 * `false` out of what gets *persisted*, which is not this.
	 */
	transparentBg?: boolean;
}): SwatchColors {
	const isDark = activeDocument.body.classList.contains("theme-dark");
	const accent = isDark ? source.colorDark : source.colorLight;
	// Checked before the tint fallback below, which fires on a missing
	// background — exactly the state transparency leaves the source in. Falling
	// through would draw a pale tinted circle for a callout that paints nothing,
	// i.e. a swatch that lies about what the callout looks like.
	if (source.transparentBg) {
		return { accent, bg: "", transparent: true };
	}
	const bg = (isDark ? source.bgColorDark : source.bgColorLight) ?? bgTintFor(accent, isDark);
	const gradient = source.bgGradient;
	return {
		accent,
		bg,
		bgTo: gradient ? (isDark ? gradient.toColorDark : gradient.toColorLight) : undefined,
	};
}

/**
 * Renders the accent (main) color in front and the background color peeking
 * out behind it, plus a third circle further back for a gradient's second
 * stop. Callers resolve the colors for the current mode via
 * {@link resolveCurrentModeColors}.
 */
export function renderColorCircles(
	parent: HTMLElement,
	colors: SwatchColors,
	options: { size?: number; ariaLabel?: string } = {},
): HTMLElement {
	const size = options.size ?? 16;
	const wrap = parent.createDiv({
		cls: "cs-color-circles",
		attr: options.ariaLabel ? { "aria-label": options.ariaLabel } : {},
	});
	wrap.style.setProperty("--cs-circle-size", `${size}px`);

	const left = wrap.createDiv({ cls: "cs-color-circle cs-color-circle-l" });
	left.style.backgroundColor = colors.accent;

	const right = wrap.createDiv({ cls: "cs-color-circle cs-color-circle-r" });
	// A class, not an inline colour: the checkerboard's two tones come from the
	// theme's own variables so it reads as "empty" on a light and a dark page
	// alike, which an inline value here could not follow.
	if (colors.transparent) {
		right.addClass("is-transparent");
	} else {
		right.style.backgroundColor = colors.bg;
	}

	if (colors.bgTo) {
		const far = wrap.createDiv({
			cls: "cs-color-circle cs-color-circle-r2",
		});
		far.style.backgroundColor = colors.bgTo;
	}

	return wrap;
}
