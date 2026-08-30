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
import { matchParen, skipBrackets } from "../../utils/selectorText";

/** Which box a generic callout selector ends on. */
export type SurfaceTarget = "root" | "child";

/** A generic callout selector, cut into the part we restate and the box it hits. */
export interface SurfaceHit {
	target: SurfaceTarget;
	/** The ancestor steps, verbatim. `""` when the rule has no guard at all. */
	guard: string;
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
 * A pseudo-class's contents are skipped rather than read. `:not(.is-collapsed)`
 * narrows *which* callouts a rule reaches, and this plugin cannot know which of
 * those states its own callout is in on any given render; treating the compound
 * as satisfied is the call `reachable()` already makes in `accentDialectScan.ts`.
 * It is safe in both directions here — a background cancel is what the theme
 * asked for in the state it named, and a `border-color` on a box with no border
 * width draws nothing at all.
 *
 * An id, an attribute or a universal selector returns `null`. None of the three
 * appears on a generic callout rule anywhere in the corpus, and each would make
 * the guard something that cannot be restated as written.
 */
export function compoundClasses(step: string): string[] | null {
	const classes: string[] = [];
	let i = 0;
	while (i < step.length) {
		const ch = step[i] ?? "";
		if (ch === "#" || ch === "[" || ch === "*") return null;
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
 * - **`[data-callout=…]` anywhere disqualifies the part.** A rule that names an
 *   id cannot reach a callout the user invented, so it is not evidence about
 *   what happens to one.
 * - **The guard stops at the LAST callout-root step**, because that is the step
 *   this plugin's own selector replaces. A child target with no root above it —
 *   Cyber Glow writes a bare `.callout-content` — keeps everything before it.
 */
export function surfaceTargetOf(part: string): SurfaceHit | null {
	if (part.includes("[data-callout")) return null;
	const steps = selectorSteps(part);
	if (steps === null) return null;
	const classes = steps.map(compoundClasses);
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
	return { target, guard: guardSteps.join(" ") };
}
