/**
 * manager/theme/calloutSurface.ts — what the ACTIVE STYLING says about the
 * surface of a callout it has never heard of.
 *
 * `calloutSurfaceScan.ts` reads one sheet; this folds what several of them said
 * into the one answer the emitter consults, exactly as `accentDialect.ts` folds
 * `accentDialectScan.ts`. Two facts come out, and each one exists because a
 * theme can be right about callouts in general while saying nothing at all about
 * the callout the user just invented.
 *
 * ## Fact one: the surface is the theme's
 *
 * Sixteen of the 257 themes in the development vault blank the callout
 * background generically. Three do it unconditionally (Cyber Glow, Notation 2,
 * Polka); the rest sit behind a class — Prism, Cybertron, LYT Mode and Ultra
 * Lobster behind a `body:not(…)` the reader has to opt *out* of, GitHub Theme's
 * `callout-on`, Minimal's and Oxygen's `callouts-outlined`, and one each from
 * Composer, Glass Robo, Iridium, ITS, Shiba Inu, Typomagical and Underwater.
 *
 * Where that holds, this plugin's `!important` background is the one filled box
 * in the note. It stands down there — and only there, and only under the guard
 * the theme itself wrote, which is what makes a Style Settings toggle work live.
 *
 * ## Fact two: the frame's ink is `currentColor`
 *
 * Four themes build the callout's visible box out of `.callout-title` and
 * `.callout-content` borders and never state a colour for them, so the frame
 * draws in `currentColor`. That is fine for the theme, whose own text colour is
 * a deliberate choice, and wrong for this plugin, which sets `color` on
 * `.callout-content` and so silently repaints the frame in a text grey.
 *
 * **The veto is global, not per guard**, and that is the interesting line. Shiba
 * Inu writes `border: 2px solid` and `border-color: color-mix(in srgb,
 * var(--callout-color) 40%, transparent)` in the *same* rule: it colours its
 * frame, from the very variable this plugin already sets, so it works today and
 * must be left alone. A per-guard veto would have caught that one, but not the
 * general shape — a theme that states the colour in a *separate* rule under a
 * different guard would slip through, and the cost of being wrong is painting
 * over a colour the theme chose. One coloured generic frame anywhere in the
 * active styling is enough to keep this plugin's hands off all of them.
 */
import type { SurfaceEvidence } from "./calloutSurfaceScan";

/** What the active styling says, resolved. */
export interface CalloutSurface {
	/**
	 * Guards under which this plugin must not paint the callout surface.
	 * A single `""` means "always"; empty means the plugin paints as it always has.
	 */
	neutralBackground: readonly string[];
	/** Guards under which this plugin supplies the frame's ink from its accent. */
	colorlessFrame: readonly string[];
}

/** Nothing to defer to — the answer for 241 of the 257 installed themes. */
export const NO_SURFACE_CLAIM: CalloutSurface = {
	neutralBackground: [],
	colorlessFrame: [],
};

/**
 * Collapse one guard set into the list the emitter iterates.
 *
 * Sorted, because the generated stylesheet is compared byte-for-byte against the
 * last one to decide whether to pay for a `css-change` (see
 * `CSSInjector.injectNow`), and an unordered set would make that comparison
 * depend on scan order. An unguarded rule swallows every guarded one: it already
 * applies in every state they name.
 */
function collapse(guards: ReadonlySet<string>): string[] {
	if (guards.size === 0) return [];
	if (guards.has("")) return [""];
	return [...guards].sort();
}

/** Fold every sheet's evidence into one answer. */
export function resolveCalloutSurface(
	evidence: readonly SurfaceEvidence[],
): CalloutSurface {
	const neutral = new Set<string>();
	const colorless = new Set<string>();
	let painted = false;
	for (const ev of evidence) {
		for (const g of ev.neutralBackground) neutral.add(g);
		for (const g of ev.colorlessFrame) colorless.add(g);
		if (ev.framePainted.size > 0) painted = true;
	}
	return {
		neutralBackground: collapse(neutral),
		colorlessFrame: painted ? [] : collapse(colorless),
	};
}

/**
 * One guard as a selector prefix: `""` for an unguarded rule, otherwise the
 * theme's own ancestor compound plus the descendant combinator it implied.
 */
export function guardPrefix(guard: string): string {
	return guard === "" ? "" : `${guard} `;
}
