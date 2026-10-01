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
import { boxFillTargetOf, surfaceTargetOf, type BoxFillHit } from "./calloutSurfaceTarget";

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

/**
 * One generic rule filling a box of the callout.
 *
 * A pseudo-element is only recorded when it is a *surface* — absolutely
 * positioned over its whole box (`inset: 0`, `100%` × `100%`, or zero on every
 * side). Ultra Lobster's line style and Glass Robo's glow style paint the
 * callout's whole fill that way, from the accent; a 3px accent bar, a dog-eared
 * corner or a title underline is a decoration of the frame and is not a fill.
 */
export interface SurfaceFill extends BoxFillHit {
	/** The fill reads the callout's own accent, rather than a fixed colour. */
	accent: boolean;
	/**
	 * The rule also sets the box's own `opacity`, so a colour put there would not
	 * render as written — Ultra Lobster's brutal style is a 20%-opacity offset
	 * block. Such a surface can be cleared but not given a background.
	 */
	ownOpacity: boolean;
	/**
	 * The theme's ink for this box was chosen against this fill: the fill is
	 * opaque, or the same rule picks the text colour. Glass Robo and flexcyon
	 * write the title in the page colour on an opaque badge, and that ink cannot
	 * survive the badge being removed. A translucent stripe under the theme's
	 * ordinary ink (AnuPpuccin Sleek's 10%) is not this.
	 */
	inked: boolean;
}

/** What one stylesheet says about the generic callout surface. */
export interface SurfaceEvidence {
	/**
	 * Root backgrounds to restore when the theme paints the content separately
	 * or gives the root a neutral colour and tints only the title.
	 */
	neutralBackground: SurfaceBackground[];
	/**
	 * Every generic fill the sheet puts *inside* the callout: on the title or
	 * the content box, or on a pseudo-element laid over a whole box. Each keeps
	 * the conditions it applies under — see {@link SurfaceFill} and
	 * `calloutSurface.ts`, which decides what each one means.
	 */
	fills: SurfaceFill[];
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
		fills: [],
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

/** The declarations that fill a box, as opposed to framing or inking it. */
const FILL_PROPS = new Set(["background", "background-color", "background-image"]);

/** A value derived from the callout's own accent, in either spelling. */
const ACCENT_READ = /--callout-color\b/i;

/** A length of zero, however it is spelled. */
const ZERO = /^-?0(?:\.0+)?(?:px|%|r?em)?$/i;

/** The fill one rule paints, or `null` when it paints none (or removes one). */
function fillOf(
	decls: ReadonlyArray<[string, string]>,
): { accent: boolean; opaque: boolean } | null {
	const fills = decls.filter(([name, value]) =>
		FILL_PROPS.has(name) && !NEUTRAL_BG.test(value) && !/^none$/i.test(value),
	);
	if (fills.length === 0) return null;
	return {
		accent: fills.some(([, value]) => ACCENT_READ.test(value)),
		opaque: fills.some(([, value]) => fillAlpha(value) >= 0.5),
	};
}

/** The top-level comma-separated arguments of the function call opening `value`. */
function callArgs(value: string): string[] | null {
	const open = value.indexOf("(");
	if (open < 0 || !value.trimEnd().endsWith(")")) return null;
	const args: string[] = [];
	let depth = 0;
	let start = open + 1;
	for (let i = open + 1; i < value.length; i++) {
		const ch = value[i];
		if (ch === "(") depth++;
		else if (ch === ")") {
			if (depth === 0) {
				args.push(value.slice(start, i).trim());
				return args;
			}
			depth--;
		} else if (ch === "," && depth === 0) {
			args.push(value.slice(start, i).trim());
			start = i + 1;
		}
	}
	return null;
}

/** A number or percentage, read through a `var(--x, fallback)` if need be. */
function alphaNumber(text: string): number | null {
	const v = /^var\(\s*--[\w-]+\s*,\s*([^)]+)\)$/i.exec(text.trim())?.[1] ?? text.trim();
	const m = /^(-?\d*\.?\d+)(%?)$/.exec(v.trim());
	if (m === null) return null;
	return Number(m[1]) / (m[2] === "%" ? 100 : 1);
}

/**
 * How opaque a declared fill is, as well as the text says: `1` for anything
 * it cannot see through (a hex, a palette variable, `rgb()`), the alpha for
 * `rgba(…, a)`, `rgb(… / a)` and `color-mix(…, transparent)`, and `0` for a
 * gradient — whose stops would each need reading, and which in this corpus is
 * always a tint fading to transparent.
 */
function fillAlpha(value: string): number {
	const v = value.trim();
	if (/gradient\(/i.test(v)) return 0;
	const fn = /^([a-z-]+)\(/i.exec(v)?.[1]?.toLowerCase();
	const args = callArgs(v);
	if (fn === undefined || args === null) return 1;
	if (fn === "color-mix") {
		// color-mix(in srgb, C p%, transparent) or (…, C, transparent q%)
		const [, first = "", second = ""] = args;
		const p = /\s(\d*\.?\d+)%$/.exec(first)?.[1];
		const q = /^transparent\s+(\d*\.?\d+)%$/i.exec(second)?.[1];
		if (!/^transparent\b/i.test(second)) return 1;
		if (p !== undefined) return Number(p) / 100;
		if (q !== undefined) return 1 - Number(q) / 100;
		return 0.5;
	}
	if (!/^(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)$/.test(fn)) return 1;
	const slash = /\/\s*([^/)]+)\)\s*$/.exec(v)?.[1];
	if (slash !== undefined) return alphaNumber(slash) ?? 1;
	// Comma syntax: a triplet variable plus an alpha, or three channels plus one.
	if (args.length === 2 || args.length === 4) return alphaNumber(args[args.length - 1] ?? "") ?? 1;
	return 1;
}

/**
 * Whether a pseudo-element rule lays a surface over its whole box, as opposed
 * to drawing a bar, a dot or a line on it. Read from the rule's own geometry:
 * `inset: 0`, `100%` × `100%`, or every side pinned to zero — physically or,
 * as TerraFlow's glass style writes it, through the logical `inset-block` /
 * `inset-inline` longhands.
 */
function coversBox(decls: ReadonlyArray<[string, string]>): boolean {
	const get = (name: string): string | undefined =>
		decls.find(([n]) => n === name)?.[1].trim();
	if (!/^(?:absolute|fixed)$/i.test(get("position") ?? "")) return false;
	const inset = get("inset");
	if (inset !== undefined && inset.split(/\s+/).every((v) => ZERO.test(v))) return true;
	if (get("width") === "100%" && get("height") === "100%") return true;
	// One value of a logical shorthand sets both of its ends.
	const ends = (name: string): string[] => (get(name) ?? "").split(/\s+/).filter(Boolean);
	const [blockStart, blockEnd = blockStart] = ends("inset-block");
	const [inlineStart, inlineEnd = inlineStart] = ends("inset-inline");
	const sides = [
		get("top") ?? get("inset-block-start") ?? blockStart,
		get("bottom") ?? get("inset-block-end") ?? blockEnd,
		get("left") ?? get("inset-inline-start") ?? inlineStart,
		get("right") ?? get("inset-inline-end") ?? inlineEnd,
	];
	return sides.every((side) => side !== undefined && ZERO.test(side));
}

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
			// A child box painted from the accent. Two uses: it is where a
			// relocated background goes (`calloutSurface.ts`), and a title stripe
			// is what makes a fixed root colour a neutral surface rather than a
			// background the theme merely happens to give every callout —
			// AnuPpuccin Sleek's `rgba(var(--ctp-mantle), 0.4)` under an accent
			// title, for example. Its exact value is kept so light and dark
			// variables follow the theme; transparent would change its look.
			const target = boxFillTargetOf(part);
			if (target !== null) {
				decls ??= declarations(body);
				const fill = fillOf(decls);
				if (fill !== null && (target.pseudo === "" || coversBox(decls))) {
					const opacity = decls.find(([name]) => name === "opacity")?.[1].trim();
					ev.fills.push({
						...target,
						accent: fill.accent,
						ownOpacity: opacity !== undefined && !/^(?:1|100%)$/.test(opacity),
						inked:
							fill.opaque ||
							decls.some(([name]) => name === "color" || name === "-webkit-text-fill-color"),
					});
					if (fill.accent && target.box === "title" && target.pseudo === "") {
						accentTitles.add(scopeKey(target.guard, target.rootQualifier));
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
