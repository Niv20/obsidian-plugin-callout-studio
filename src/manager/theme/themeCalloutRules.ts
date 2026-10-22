/**
 * manager/theme/themeCalloutRules.ts — which of a theme's rules style
 * callouts, read from their selector text, for the setting that switches the
 * theme's callout styling off.
 *
 * Callout Studio cannot take a callout from a callout-heavy theme by weight
 * (see `docs/internals-docs/06-css-generation.md`, "One rule, and why there is
 * no setting"): whatever the theme escalates it keeps, whatever this plugin
 * never declares — a shadow, a `::before` badge, the padding — stays the
 * theme's, and the callout comes out half one and half the other. So the
 * setting does not compete with the theme's callout rules at all; it takes
 * them out of the browser's copy of the theme (`themeCalloutStrip.ts`). This
 * module is the judgement of which ones, pure text in and out, so every
 * decision is unit-tested.
 *
 * A selector is the theme's callout styling when it reaches a box of a
 * callout — a class Obsidian puts on a callout's own DOM, or a `data-callout…`
 * attribute — anywhere in it except inside `:not()`, which says "everything
 * but a callout". Two consequences worth keeping:
 *
 * - **The class list is exact.** ITS writes `body:not(.default-callout-quote,
 *   .callout-no-quote) …` and Blue Topaz `*:not([data-callout="kanban"])`. A
 *   theme option's class, or a negation, is not a callout box, and whatever it
 *   guards stays the theme's.
 * - **Only the selectors that reach a callout go.** `.callout, .admonition`
 *   keeps `.admonition`, and `:is(.callout, blockquote) p` keeps
 *   `:is(blockquote) p`: everything outside a callout must look exactly as it
 *   did.
 */
import {
	blankNegations,
	matchParen,
	skipBrackets,
	skipString,
	splitSelectorList,
} from "../../utils/selectorText";
import { CLASS_TOKEN, unescapeCss } from "./themeClaimSelectors";

/**
 * The classes on a callout's own boxes, on the widget Live Preview wraps one
 * in (`div.cm-embed-block.cm-callout`), and on its `> [!type]` line while it
 * is being edited as text (`HyperMD-callout` on the line, `cm-hmd-callout` on
 * the token) — core styles neither of those two, so a rule naming one is the
 * theme's callout styling too.
 */
const CALLOUT_CLASSES: ReadonlySet<string> = new Set([
	"callout",
	"callout-title",
	"callout-title-inner",
	"callout-icon",
	"callout-content",
	"callout-fold",
	"cm-callout",
	"HyperMD-callout",
	"cm-hmd-callout",
]);

/** `[data-callout]`, `[data-callout-metadata]` and `[data-callout-fold]`, any operator. */
const CALLOUT_ATTRIBUTE = /^\[\s*data-callout(?:-metadata|-fold)?\s*(?:[~|^$*]?=|\])/i;

/** `[class*="callout"]` and its kin: the callout classes matched by their text. */
const CLASS_ATTRIBUTE = /^\[\s*class\s*[~|^$*]?=\s*(?:"[^"]*callout|'[^']*callout|[^\]\s"']*callout)/i;

/**
 * The cheap answer for the great majority of a theme's rules: no `callout` in
 * the text, and no escape that could spell one (`.c\61llout`).
 */
function cannotNameCallout(selector: string): boolean {
	return !selector.includes("\\") && !/callout/i.test(selector);
}

/** Functional pseudo-classes whose arguments are alternatives — any one of them selects. */
const ALTERNATIVES = /^:(?:is|where|matches|-webkit-any|-moz-any|has)\(/i;

/**
 * Whether `selector` reaches a box of a callout: it needs a callout class or a
 * `data-callout…` attribute somewhere outside `:not()`. Inside `:is()`,
 * `:where()` or `:has()` counts — those select a callout, or what holds one.
 */
export function reachesCallout(selector: string): boolean {
	if (cannotNameCallout(selector)) return false;
	const visible = blankNegations(selector);
	let i = 0;
	while (i < visible.length) {
		const ch = visible[i];
		if (ch === '"' || ch === "'") {
			i = skipString(visible, i);
			continue;
		}
		if (ch === "\\") {
			i += 2;
			continue;
		}
		if (ch === "[") {
			const end = skipBrackets(visible, i);
			const bracket = visible.slice(i, end);
			if (CALLOUT_ATTRIBUTE.test(bracket) || CLASS_ATTRIBUTE.test(bracket)) return true;
			i = end;
			continue;
		}
		if (ch === ".") {
			const m = CLASS_TOKEN.exec(visible.slice(i));
			if (m) {
				if (CALLOUT_CLASSES.has(unescapeCss(m[1] ?? ""))) return true;
				i += m[0].length;
				continue;
			}
		}
		i++;
	}
	return false;
}

/**
 * One alternative switched off without moving the rule's weight.
 *
 * `:is()` and `:has()` weigh as much as their heaviest argument, so simply
 * dropping `.callout-title-inner` from Dune's `:is(p, li, .callout-title-inner)`
 * would lighten the rule for every paragraph in the vault — and a lighter rule
 * can lose a tie it used to win, outside any callout. `:not(*, x)` matches
 * nothing (everything is `*`) and weighs exactly what `x` did. It also sits
 * inside a negation, which is what keeps it from reading as a reach the next
 * time it is looked at. A `:has()` argument's leading combinator goes, since a
 * negation holds only complete selectors.
 */
function switchedOff(alternative: string): string {
	return `:not(*, ${alternative.replace(/^[>+~]\s*/, "")})`;
}

/**
 * `branch` with every alternative that reaches a callout switched off in its
 * `:is()`, `:where()` and `:has()` lists ({@link switchedOff}), or `null` when
 * such a list is left with nothing that can still match: the branch then
 * selects only callouts, or only what holds one. A negation is left whole —
 * what it names is already not a reach.
 */
function pruneAlternatives(branch: string): string | null {
	let out = "";
	let last = 0;
	let i = 0;
	while (i < branch.length) {
		const ch = branch[i];
		if (ch === '"' || ch === "'") {
			i = skipString(branch, i);
			continue;
		}
		if (ch === "[") {
			i = skipBrackets(branch, i);
			continue;
		}
		if (ch === "\\") {
			i += 2;
			continue;
		}
		if (ch !== ":") {
			i++;
			continue;
		}
		const rest = branch.slice(i);
		if (/^:not\(/i.test(rest)) {
			i = matchParen(branch, i + 4) + 1;
			continue;
		}
		const m = ALTERNATIVES.exec(rest);
		if (!m) {
			i++;
			continue;
		}
		const open = i + m[0].length - 1;
		const close = matchParen(branch, open);
		const args: string[] = [];
		let live = 0;
		let changed = false;
		for (const arg of splitSelectorList(branch.slice(open + 1, close))) {
			const trimmed = arg.trim();
			if (trimmed.length === 0) continue;
			const pruned = pruneAlternatives(trimmed);
			if (pruned === null || reachesCallout(pruned)) {
				args.push(switchedOff(trimmed));
				changed = true;
				continue;
			}
			if (pruned !== trimmed) changed = true;
			args.push(pruned);
			live++;
		}
		if (live === 0) return null;
		if (changed) {
			out += branch.slice(last, open + 1) + args.join(", ");
			last = close;
		}
		i = close + 1;
	}
	return out + branch.slice(last);
}

/**
 * The selector list without the selectors that reach a callout: the same text
 * when none does, `null` when every one does (the rule goes), and what is
 * left otherwise.
 *
 * Nested rules are asked about their own text. A parent that reaches a
 * callout is deleted with everything nested in it, so a nested rule is only
 * ever asked about under a parent that does not — and then it reaches a
 * callout exactly when its own text does.
 */
export function withoutCalloutBranches(selectorList: string): string | null {
	if (cannotNameCallout(selectorList)) return selectorList;
	const kept: string[] = [];
	let changed = false;
	for (const branch of splitSelectorList(selectorList)) {
		const trimmed = branch.trim();
		const pruned = trimmed.length > 0 ? pruneAlternatives(trimmed) : null;
		if (pruned === null || reachesCallout(pruned)) {
			changed = true;
			continue;
		}
		if (pruned !== trimmed) changed = true;
		kept.push(pruned);
	}
	if (kept.length === 0) return null;
	return changed ? kept.join(", ") : selectorList;
}

/**
 * A custom property of the callout family — the ones Obsidian's callout CSS
 * reads (`--callout-radius`, `--callout-default`, `--callout-color`, …) and any
 * a theme keeps beside them. Declared anywhere in the theme, on `body` as
 * often as not, each one reaches every callout through inheritance.
 */
export function isCalloutVariable(name: string): boolean {
	return name.startsWith("--callout-");
}
