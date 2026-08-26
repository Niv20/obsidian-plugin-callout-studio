/**
 * utils/cssSpecificity.ts — how heavy a CSS selector is, without a browser.
 *
 * Split out of `manager/theme/themeCalloutScan.ts`, where this started life as
 * three regexes. Those were close enough to rank the three themes that were on
 * hand when they were written and wrong on the next five: measured across the
 * 53 themes installed in this vault, they over-counted Prism 9→7, Blue Topaz
 * 8→6, Willemstad 8→6, Baseline 6→5, Cupertino 6→5 and AnuPpuccin 11→10. Two
 * bugs, both structural rather than incidental:
 *
 * - `:not(.x)` was counted as a pseudo-class **plus** its contents, when the
 *   spec says a functional pseudo-class contributes *only* the specificity of
 *   its most specific argument.
 * - `:where(…)` was stripped with `:where\([^()]*\)`, which cannot match a
 *   nested pair — so `:where(:is([data-callout="success"]))` (real, from
 *   Willemstad) kept its contents and scored 2 instead of 0.
 *
 * Over-counting is not the safe direction it looks like. The number decides
 * whether the settings tab tells the user *"your theme is winning"*, and a
 * badge that says so about a theme this plugin already beats is worse than no
 * badge at all — the first false positive is the last time the report is
 * believed.
 *
 * Deliberately a hand-written scanner rather than a `CSSStyleSheet` walk:
 * `CSSStyleSheet` does not exist in this repo's test DOM, and a specificity
 * rule nobody can unit-test is exactly how the regexes above survived. It also
 * lets brackets and strings be skipped properly, which is the one thing the
 * CSSOM was really buying — see `selectorText.ts`, which owns that half.
 */
import {
	matchParen,
	skipBrackets,
	skipString,
	splitSelectorList,
} from "./selectorText";

/** `[a, b, c]` — ids, then classes/attributes/pseudo-classes, then elements. */
export type Specificity = [number, number, number];

/**
 * Pseudo-classes whose specificity is that of their most specific argument
 * rather than one of their own. `:where()` is in the list but is special-cased
 * to zero — it is the only one that contributes nothing at all.
 */
const FUNCTIONAL = new Set([
	"where",
	"is",
	"not",
	"has",
	"matches",
	"any",
	"-moz-any",
	"-webkit-any",
]);

/**
 * The four pseudo-*elements* CSS2 allowed with a single colon. They count as
 * elements (`c`), not pseudo-classes (`b`), and themes really do still write
 * `:before`.
 */
const LEGACY_ELEMENTS = new Set([
	"before",
	"after",
	"first-line",
	"first-letter",
]);

/** An identifier, allowing CSS escapes and non-ASCII. */
const IDENT = /^(?:[\w-]|\\.|[^\0-\x7F])+/;


/** The most specific of a functional pseudo-class's arguments. */
function maxOfArguments(args: string): Specificity {
	let best: Specificity = [0, 0, 0];
	for (const arg of splitSelectorList(args)) {
		const s = specificityOf(arg);
		if (compareSpecificity(s, best) > 0) best = s;
	}
	return best;
}

/** Negative, zero or positive, like a comparator. `a` beats `b` beats `c`. */
export function compareSpecificity(x: Specificity, y: Specificity): number {
	return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/**
 * One compound or complex selector's specificity.
 *
 * A selector *list* is not accepted: CSS gives each part its own specificity
 * and there is no meaningful single answer for the list, so callers split on
 * top-level commas first (`scanCalloutClaims` does, since it also needs to know
 * which part carried the `[data-callout]`).
 */
export function specificityOf(selector: string): Specificity {
	let a = 0;
	let b = 0;
	let c = 0;
	let i = 0;
	while (i < selector.length) {
		const ch = selector[i] ?? "";

		if (ch === '"' || ch === "'") {
			i = skipString(selector, i);
			continue;
		}

		// An attribute selector is one `b`, and its contents are not selectors —
		// skipping it as a unit is what keeps a dot or colon inside a value
		// (`[data-callout="a.b"]`) from being counted as one.
		if (ch === "[") {
			b++;
			i = skipBrackets(selector, i);
			continue;
		}

		if (ch === "." || ch === "#") {
			const m = IDENT.exec(selector.slice(i + 1));
			if (!m) {
				i++;
				continue;
			}
			if (ch === ".") b++;
			else a++;
			i += 1 + m[0].length;
			continue;
		}

		if (ch === ":") {
			const doubled = selector[i + 1] === ":";
			const nameStart = i + (doubled ? 2 : 1);
			const m = IDENT.exec(selector.slice(nameStart));
			if (!m) {
				i++;
				continue;
			}
			const name = m[0].toLowerCase();
			let next = nameStart + m[0].length;
			let args: string | null = null;
			if (selector[next] === "(") {
				const end = matchParen(selector, next);
				args = selector.slice(next + 1, end);
				next = Math.min(end + 1, selector.length);
			}

			if (doubled || LEGACY_ELEMENTS.has(name)) {
				c++;
			} else if (args !== null && FUNCTIONAL.has(name)) {
				// `:where()` is the zero — everything else takes its most
				// specific argument, and nothing for the pseudo-class itself.
				if (name !== "where") {
					const [ia, ib, ic] = maxOfArguments(args);
					a += ia;
					b += ib;
					c += ic;
				}
			} else {
				// Every other pseudo-class, functional (`:nth-child(2n)`) or
				// not. Its argument is not a selector, so it is not descended
				// into — it was already skipped above.
				b++;
			}
			i = next;
			continue;
		}

		// A type selector: an identifier not preceded by any of the above.
		if (/[A-Za-z\\]/.test(ch) || ch === "*") {
			if (ch === "*") {
				i++;
				continue;
			}
			const m = IDENT.exec(selector.slice(i));
			if (m) {
				c++;
				i += m[0].length;
				continue;
			}
		}

		i++;
	}
	return [a, b, c];
}

/**
 * The `b` component alone — classes, attributes and pseudo-classes.
 *
 * This is the number the theme report and force mode both turn on. `b` is
 * compared before `c` and this plugin never writes an id, so as long as both
 * sides have `a = 0` the class count decides the contest on its own; `c` only
 * ever breaks a `b` tie. Kept as its own export because that is what almost
 * every caller wants, and naming it makes the "why only b" reasoning live in
 * one place instead of at each call site.
 */
export function classCountOf(selector: string): number {
	return specificityOf(selector)[1];
}
