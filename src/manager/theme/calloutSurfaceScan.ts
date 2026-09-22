/**
 * manager/theme/calloutSurfaceScan.ts — reading ONE stylesheet for what it says
 * about the callout *surface*, for the callouts it does not name.
 *
 * The declaration half of the pair; `calloutSurfaceTarget.ts` reads the
 * selector and owns the guard. Pure text in, plain data out, the way
 * `accentDialectScan.ts` is: this file knows nothing about how several sheets
 * are folded into one verdict, or what is emitted from it.
 *
 * ## The question, and why it is not `themeCalloutScan`'s
 *
 * `themeCalloutScan` reads the ids a theme **names**, which is what decides
 * ownership. This reads the opposite: what a theme says about *every* callout,
 * including the ones it has never heard of — which is every callout this plugin
 * invents. Several themes in the development vault make the callout root
 * transparent, then build the visible box out of the title and content boxes:
 *
 *     body.callout-on .callout                    { background-color: transparent }   GitHub Theme
 *     body:not(.pt-disable-callout-styling)
 *       .callout:not(.cg-note-toolbar-callout)    { background-color: unset }         Prism
 *     .callouts-outlined .callout                 { background-color: transparent }   Minimal, Oxygen
 *
 * AnuPpuccin Sleek paints a neutral root and an accent-tinted title instead;
 * the paired title rule identifies that surface without treating every fixed
 * root colour in every theme as a claim. A studio callout is painted at the
 * studio weight with `!important`, so it can overwrite either kind. Prism and
 * Cybertron go further: their frame is `border: 2px solid` with **no colour** on
 * the title and content, i.e. `currentColor` — which this plugin then overwrites
 * through `.callout-content { color }`, drawing the theme's own frame in the
 * plugin's default text grey. Both facts are read here.
 */
import { eachBlock, stripComments } from "./cssBlocks";
import { splitSelectorList } from "../../utils/selectorText";
import { surfaceTargetOf } from "./calloutSurfaceTarget";

/** A theme's root surface, with the exact conditions under which it applies. */
export interface SurfaceBackground {
	guard: string;
	rootQualifier: string;
	color: string;
}

interface RootBackgroundCandidate {
	background: SurfaceBackground;
	requiresAccentTitle: boolean;
}

/** What one stylesheet says about the generic callout surface. */
export interface SurfaceEvidence {
	/**
	 * Root backgrounds to restore when the theme paints the content separately
	 * or gives the root a neutral colour and tints only the title.
	 */
	neutralBackground: SurfaceBackground[];
	/**
	 * Ancestor guards under which it frames `.callout-title` / `.callout-content`
	 * with a border whose colour it never states.
	 */
	colorlessFrame: Set<string>;
	/**
	 * Guards where it *does* state one — a generic `border-color`, or a border
	 * shorthand carrying a colour. Read as a veto in `calloutSurface.ts`: a theme
	 * that colours its own frame is not asking for this plugin's accent over it.
	 */
	framePainted: Set<string>;
}

/** An empty result, for the sheets that never mention a callout. */
export function emptySurfaceEvidence(): SurfaceEvidence {
	return {
		neutralBackground: [],
		colorlessFrame: new Set(),
		framePainted: new Set(),
	};
}

/**
 * Values that leave the element with no background of its own.
 *
 * `none` is accepted only for the `background` shorthand — `background-color:
 * none` is invalid and the parser drops it, so reading it as "no background"
 * would be believing a declaration that never applied. Oxygen's `rgba(0,0,0,0)`
 * is the one spelled-out transparent in the corpus.
 */
const NEUTRAL_BG =
	/^(?:transparent|unset|initial|revert|revert-layer|rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\))$/i;

/**
 * The border shorthands that reset the colour to `currentColor` when they omit
 * one. Deliberately not `border-width` / `border-style` / `border-color`: those
 * are longhands, and a `border-style: solid` beside a `border-color` elsewhere
 * is a frame the theme *has* coloured.
 */
const BORDER_SHORTHAND =
	/^border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$/;

/** A line style — i.e. a border that actually draws. */
const BORDER_STYLE = /\b(?:solid|dashed|dotted|double|groove|ridge|inset|outset)\b/i;

/**
 * Anything that could be a colour. Deliberately generous in the direction of
 * "this has one": a false positive costs a theme its accent frame, a false
 * negative paints over a colour the theme chose.
 */
const COLOR_TOKEN =
	/#|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|var|currentcolor|transparent|inherit)\b|\b(?:red|blue|green|black|white|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|fuchsia|purple|yellow|orange|pink|brown|cyan|magenta|gold|beige|coral|crimson|indigo|ivory|khaki|lavender|salmon|tan|violet|wheat)\b/i;

/** Split one declaration block into `name: value` pairs, `!important` stripped. */
function declarations(body: string): Array<[string, string]> {
	const out: Array<[string, string]> = [];
	for (const piece of body.split(";")) {
		const colon = piece.indexOf(":");
		if (colon < 0) continue;
		const name = piece.slice(0, colon).trim().toLowerCase();
		if (name.length === 0 || /[{}]/.test(name)) continue;
		out.push([
			name,
			piece
				.slice(colon + 1)
				.replace(/!\s*important/i, "")
				.trim(),
		]);
	}
	return out;
}

/** The identity of a selector's conditions, independent of its declarations. */
function scopeKey(guard: string, rootQualifier: string): string {
	return `${guard}\u0000${rootQualifier}`;
}

/** Record a blank root, or a possible neutral surface painted by the theme. */
function readRoot(
	name: string,
	value: string,
	guard: string,
	rootQualifier: string,
	backgrounds: RootBackgroundCandidate[],
): void {
	if (
		(name === "background-color" && NEUTRAL_BG.test(value)) ||
		(name === "background" && (NEUTRAL_BG.test(value) || /^none$/i.test(value)))
	) {
		backgrounds.push({
			background: { guard, rootQualifier, color: "transparent" },
			requiresAccentTitle: false,
		});
	} else if (
		name === "background-color" &&
		!/(?:--callout-color\b|currentcolor\b)/i.test(value)
	) {
		// A fixed or theme-variable root colour is only a neutral surface if
		// the matching title rule uses the callout accent. Checked after scanning
		// so source order between the two rules does not matter.
		backgrounds.push({
			background: { guard, rootQualifier, color: value },
			requiresAccentTitle: true,
		});
	}
}

/** The same for the title / content box, where the question is the frame. */
function readChild(name: string, value: string, guard: string, ev: SurfaceEvidence): void {
	if (name === "border-color") {
		ev.framePainted.add(guard);
		return;
	}
	if (!BORDER_SHORTHAND.test(name) || !BORDER_STYLE.test(value)) return;
	if (COLOR_TOKEN.test(value)) ev.framePainted.add(guard);
	else ev.colorlessFrame.add(guard);
}

/** Scan one stylesheet for what it says about the generic callout surface. */
export function scanCalloutSurface(css: string): SurfaceEvidence {
	const ev = emptySurfaceEvidence();
	if (!css.includes(".callout")) return ev;
	const backgrounds: RootBackgroundCandidate[] = [];
	const accentTitles = new Set<string>();

	eachBlock(stripComments(css), (prelude, body) => {
		// The pre-filter the other scanners use: `.callout` in the prelude keeps
		// `splitSelectorList` off every other rule of an 850 KB sheet.
		if (!prelude.includes(".callout")) return;
		let decls: Array<[string, string]> | null = null;
		for (const part of splitSelectorList(prelude)) {
			// A theme that paints the title from the accent while using a fixed
			// surface on the root (AnuPpuccin Sleek, for example) owns that
			// surface. Preserve its exact CSS value so light/dark variables follow
			// the theme; transparent would change the native appearance.
			const titleRoot = part.replace(/\s*>\s*\.callout-title\s*$/, "");
			if (titleRoot !== part) {
				const titleHit = surfaceTargetOf(titleRoot);
				if (titleHit?.target === "root") {
					decls ??= declarations(body);
					if (decls.some(([name, value]) =>
						(name === "background-color" || name === "background") &&
						/--callout-color\b/i.test(value),
					)) {
						accentTitles.add(scopeKey(titleHit.guard, titleHit.rootQualifier));
					}
				}
			}
			const hit = surfaceTargetOf(part);
			if (hit === null) continue;
			decls ??= declarations(body);
			for (const [name, value] of decls) {
				if (hit.target === "root") {
					readRoot(name, value, hit.guard, hit.rootQualifier, backgrounds);
				}
				else readChild(name, value, hit.guard, ev);
			}
		}
	});
	for (const candidate of backgrounds) {
		const bg = candidate.background;
		if (
			!candidate.requiresAccentTitle ||
			accentTitles.has(scopeKey(bg.guard, bg.rootQualifier))
		) {
			ev.neutralBackground.push(bg);
		}
	}
	return ev;
}
