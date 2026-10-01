/**
 * manager/theme/calloutSurfaceTarget.ts — reading ONE selector: does it reach
 * every callout, which box does it land on, and what is it guarded by?
 *
 * Split from `calloutSurfaceScan.ts`, which asks what the *declarations* say.
 * This half is entirely about the selector, and it is the half that decides what
 * the plugin is allowed to restate.
 *
 * ## The guard is the product
 *
 * Twelve of the fifteen themes that blank the callout surface do it behind a
 * class the user toggles in Style Settings, and Style Settings adds and removes
 * body classes without firing `css-change` — there is no event to re-inject on.
 * So the fact is only useful if it comes with the condition attached: re-stating
 * the theme's own ancestor compound in front of this plugin's selector hands the
 * decision to the browser, and the option then flips the render with no JS in
 * the path.
 *
 * Everything rejected below is rejected for that one reason — the guard could
 * not be restated faithfully, and a guard that means something *else* in front
 * of our selector is worse than no fact at all.
 */
import { blankNegations, matchParen, skipBrackets } from "../../utils/selectorText";

/** Which box a generic callout selector ends on. */
export type SurfaceTarget = "root" | "child";

/** A generic callout selector, cut into the part we restate and the box it hits. */
export interface SurfaceHit {
	target: SurfaceTarget;
	/** The ancestor steps, verbatim. `""` when the rule has no guard at all. */
	guard: string;
	/** Conditions on `.callout` itself, replayed after our `[data-callout]`. */
	rootQualifier: string;
}

/** A positive id selector names a theme-owned row; exclusions do not. */
function namesCalloutId(part: string): boolean {
	return /\[\s*data-callout(?![\w-])/i.test(blankNegations(part));
}

/** Preserve root metadata/state predicates without repeating its type or class. */
function rootQualifier(step: string): string {
	return step
		.replace(/^[a-z][\w-]*/i, "")
		.replace(/\.callout(?![\w-])/, "");
}

/**
 * Cut a selector into its descendant steps, or `null` when it uses a combinator.
 *
 * `>`, `+` and `~` are rejected rather than handled: the guard is re-stated in
 * front of a selector this plugin writes, and a child combinator would then mean
 * something different from what the theme wrote. No installed theme uses one on
 * a generic callout rule, so refusing costs nothing.
 */
export function selectorSteps(sel: string): string[] | null {
	const steps: string[] = [];
	let start = 0;
	let i = 0;
	let sawText = false;
	while (i < sel.length) {
		const ch = sel[i] ?? "";
		if (ch === "[") {
			i = skipBrackets(sel, i);
			sawText = true;
			continue;
		}
		if (ch === "(") {
			i = matchParen(sel, i) + 1;
			sawText = true;
			continue;
		}
		if (ch === ">" || ch === "+" || ch === "~") return null;
		if (/\s/.test(ch)) {
			if (sawText) steps.push(sel.slice(start, i));
			while (i < sel.length && /\s/.test(sel[i] ?? "")) i++;
			start = i;
			sawText = false;
			continue;
		}
		sawText = true;
		i++;
	}
	if (sawText) steps.push(sel.slice(start));
	return steps.length > 0 ? steps : null;
}

/**
 * The class names one compound states outright, or `null` when the compound is
 * something this module will not reason about.
 *
 * A pseudo-class's contents are skipped when identifying the compound's
 * classes; the root's complete predicate is carried separately in
 * `rootQualifier`. Attributes are accepted only on the callout root. An
 * attribute on an ancestor cannot be safely replayed as a guard, so it still
 * returns `null` when `allowAttributes` is false.
 */
export function compoundClasses(step: string, allowAttributes = false): string[] | null {
	const classes: string[] = [];
	let i = 0;
	while (i < step.length) {
		const ch = step[i] ?? "";
		if (ch === "#" || ch === "*") return null;
		if (ch === "[") {
			if (!allowAttributes) return null;
			i = skipBrackets(step, i);
			continue;
		}
		if (ch === ":") {
			if (step[i + 1] === ":") return null; // ::before — not a compound
			const open = step.indexOf("(", i);
			const nextSep = step.slice(i + 1).search(/[.:#[]/);
			const endOfName = nextSep < 0 ? step.length : i + 1 + nextSep;
			i = open >= 0 && open < endOfName ? matchParen(step, open) + 1 : endOfName;
			continue;
		}
		if (ch === ".") {
			let j = i + 1;
			while (j < step.length && /[\w-]/.test(step[j] ?? "")) j++;
			classes.push(step.slice(i + 1, j));
			i = j;
			continue;
		}
		// A bare element name (`body`, `html`) is legal and contributes no class.
		if (/[\w-]/.test(ch)) {
			i++;
			continue;
		}
		return null;
	}
	return classes;
}

/** The callout root — `.callout`, however else the compound is qualified. */
function isCalloutRoot(classes: readonly string[]): boolean {
	return (
		classes.includes("callout") &&
		!classes.includes("callout-title") &&
		!classes.includes("callout-content")
	);
}

/** `.callout-title` or `.callout-content` — the two boxes a theme frames. */
function isCalloutChild(classes: readonly string[]): boolean {
	return classes.includes("callout-title") || classes.includes("callout-content");
}

/**
 * Where one selector part lands and what guards it, or `null` when it is not a
 * generic callout rule.
 *
 * Two cuts, and both matter:
 *
 * - A **positive** `[data-callout=…]` disqualifies the part. An exclusion in
 *   `:not()` still reaches invented ids and is replayed with the root predicate.
 *   `[data-callout-metadata*=…]` is also generic and must be kept.
 * - **The guard stops at the LAST callout-root step**, because that is the step
 *   this plugin's own selector replaces. A child target with no root above it —
 *   Cyber Glow writes a bare `.callout-content` — keeps everything before it.
 */
export function surfaceTargetOf(part: string): SurfaceHit | null {
	if (namesCalloutId(part)) return null;
	const steps = selectorSteps(part);
	if (steps === null) return null;
	const classes = steps.map((step) => compoundClasses(step, true));
	const lastIndex = classes.length - 1;
	const last = classes[lastIndex];
	if (last === undefined || last === null) return null;

	let target: SurfaceTarget;
	let cut = lastIndex;
	if (isCalloutRoot(last)) {
		target = "root";
	} else if (isCalloutChild(last)) {
		target = "child";
		for (let i = lastIndex - 1; i >= 0; i--) {
			const c = classes[i];
			if (c !== undefined && c !== null && isCalloutRoot(c)) {
				cut = i;
				break;
			}
		}
	} else {
		return null;
	}

	const guardSteps = steps.slice(0, cut);
	// One unrestatable step drops the whole fact. See the module header.
	if (guardSteps.some((step) => compoundClasses(step) === null)) return null;
	return {
		target,
		guard: guardSteps.join(" "),
		rootQualifier: rootQualifier(steps[cut] ?? ""),
	};
}

/** The three boxes of a callout: the root and its two children. */
export type CalloutBox = "root" | "title" | "content";

/** One box a generic rule fills, with the conditions it applies under. */
export interface BoxFillHit {
	box: CalloutBox;
	/**
	 * `""` for the box itself, or the pseudo-element it paints — always written
	 * `::before` / `::after`, however the theme spelled it.
	 */
	pseudo: "" | "::before" | "::after";
	/** Ancestor steps before the callout root, verbatim, as in {@link SurfaceHit}. */
	guard: string;
	/** Conditions on `.callout` itself; `""` when the rule names no root step. */
	rootQualifier: string;
}

/**
 * The plain child box a selector part ends on: `.callout-title` or
 * `.callout-content` after a descendant or child combinator, with nothing else
 * in its compound but an optional pseudo-element.
 *
 * A child qualified any other way (`.callout-title:hover`,
 * `.callout-content:empty`) is refused rather than read: its fill is a state the
 * theme draws on top of the box, and a background moved onto the box itself
 * would then be painted permanently.
 */
const CHILD_STEP = /^([\s\S]*?)(?:\s*>\s*|\s+|^)\.callout-(title|content)\s*$/;

/** A trailing `::before` / `::after` (or the legacy one-colon spelling). */
const PSEUDO = /::?(before|after)\s*$/i;

/**
 * Which box of a callout a generic rule fills, or `null` when the rule is not
 * generic, lands somewhere else, or its conditions cannot be restated.
 *
 * Three shapes reach a child box, and the corpus uses all of them:
 *
 *     .anp-callout-sleek .callout:not(…) > .callout-title   AnuPpuccin — root step, child combinator
 *     .callout:not(.is-collapsible) .callout-title          Cyber Glow — root step, descendant
 *     .composer--WindowPanelCallout .callout-title          Composer — no root step at all
 *
 * The first two keep the root's own conditions, exactly as
 * {@link surfaceTargetOf} reads them. The third has nothing on the root to
 * keep, so everything before the child is the guard — and has to be restatable
 * by the same rule as any other guard.
 *
 * A pseudo-element is read on any of the three boxes (`.glow-callouts
 * .callout::after`, `.draa-callouts .callout .callout-title::before`). Whether
 * it is a *surface* rather than a decoration is a question about its geometry,
 * which only the declarations can answer — see `calloutSurfaceScan.ts`.
 */
export function boxFillTargetOf(part: string): BoxFillHit | null {
	if (namesCalloutId(part)) return null;
	let sel = part.trim();
	const pm = PSEUDO.exec(sel);
	const pseudo = pm === null ? "" : pm[1]?.toLowerCase() === "before" ? "::before" : "::after";
	if (pm !== null) sel = sel.slice(0, pm.index).trim();

	const m = CHILD_STEP.exec(sel);
	if (m === null) {
		// No child step: only a root pseudo-element is a box this reads.
		if (pseudo === "") return null;
		const hit = surfaceTargetOf(sel);
		return hit?.target === "root"
			? { box: "root", pseudo, guard: hit.guard, rootQualifier: hit.rootQualifier }
			: null;
	}
	const box = m[2] === "title" ? "title" : "content";
	const before = (m[1] ?? "").trim();
	if (before === "") return { box, pseudo, guard: "", rootQualifier: "" };
	const hit = surfaceTargetOf(before);
	if (hit !== null) {
		return hit.target === "root"
			? { box, pseudo, guard: hit.guard, rootQualifier: hit.rootQualifier }
			: null;
	}
	// No callout root above the child: the whole prefix is the guard. A step
	// that IS a callout root got here only because its guard was refused, and
	// refusing it again here is the point.
	const steps = selectorSteps(before);
	if (
		steps === null ||
		steps.some((step) => {
			const classes = compoundClasses(step);
			return classes === null || isCalloutRoot(classes) || isCalloutChild(classes);
		})
	) {
		return null;
	}
	return { box, pseudo, guard: steps.join(" "), rootQualifier: "" };
}
