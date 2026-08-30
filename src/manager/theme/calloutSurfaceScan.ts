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
 * invents. Fifteen of the 257 themes in the development vault answer that with
 * some form of "a callout has no background of its own", and then build the
 * visible box out of the title and content boxes instead:
 *
 *     body.callout-on .callout                    { background-color: transparent }   GitHub Theme
 *     body:not(.pt-disable-callout-styling)
 *       .callout:not(.cg-note-toolbar-callout)    { background-color: unset }         Prism
 *     .callouts-outlined .callout                 { background-color: transparent }   Minimal, Oxygen
 *
 * A studio callout is painted at the studio weight with `!important`, so it wins
 * that declaration and ends up the only filled box in the note. Prism and
 * Cybertron go further: their frame is `border: 2px solid` with **no colour** on
 * the title and content, i.e. `currentColor` — which this plugin then overwrites
 * through `.callout-content { color }`, drawing the theme's own frame in the
 * plugin's default text grey. Both facts are read here.
 */
import { eachBlock, stripComments } from "./cssBlocks";
import { splitSelectorList } from "../../utils/selectorText";
import { surfaceTargetOf } from "./calloutSurfaceTarget";

/** What one stylesheet says about the generic callout surface. */
export interface SurfaceEvidence {
	/**
	 * Ancestor guards under which the sheet blanks the callout background.
	 * `""` is a rule with no guard at all, which applies always.
	 */
	neutralBackground: Set<string>;
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
		neutralBackground: new Set(),
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

/** Record what one declaration on the callout root says, if anything. */
function readRoot(name: string, value: string, guard: string, ev: SurfaceEvidence): void {
	if (name === "background-color" && NEUTRAL_BG.test(value)) {
		ev.neutralBackground.add(guard);
	} else if (name === "background" && (NEUTRAL_BG.test(value) || /^none$/i.test(value))) {
		ev.neutralBackground.add(guard);
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

	eachBlock(stripComments(css), (prelude, body) => {
		// The pre-filter the other scanners use: `.callout` in the prelude keeps
		// `splitSelectorList` off every other rule of an 850 KB sheet.
		if (!prelude.includes(".callout")) return;
		let decls: Array<[string, string]> | null = null;
		for (const part of splitSelectorList(prelude)) {
			const hit = surfaceTargetOf(part);
			if (hit === null) continue;
			decls ??= declarations(body);
			for (const [name, value] of decls) {
				if (hit.target === "root") readRoot(name, value, hit.guard, ev);
				else readChild(name, value, hit.guard, ev);
			}
		}
	});
	return ev;
}
