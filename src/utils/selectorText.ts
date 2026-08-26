/**
 * utils/selectorText.ts — cutting a CSS selector up without misreading it.
 *
 * The companion to `cssSpecificity.ts`, which decides how *heavy* a selector
 * is; this decides where one selector ends and the next begins, and which parts
 * of it mean what they appear to mean. Split apart because they are asked by
 * different callers for different reasons — `themeCalloutScan` needs the
 * cutting without the arithmetic — and because every function here is about the
 * same hazard: punctuation that looks structural but is not.
 *
 * All three primitives exist because a selector is not safely scannable with a
 * regex. A comma inside `:not(a, b)` is not a list separator; a `.` inside
 * `[data-callout="a.b"]` is not a class; a `]` inside `[title="]"]` does not
 * close the bracket. Every one of those appears in themes installed in the
 * development vault, and each was a real mis-read before this module existed.
 */

/** Index just past the quote closing the string opened at `start`. */
export function skipString(sel: string, start: number): number {
	const quote = sel[start];
	let i = start + 1;
	while (i < sel.length) {
		if (sel[i] === "\\") {
			i += 2;
			continue;
		}
		if (sel[i] === quote) return i + 1;
		i++;
	}
	return sel.length;
}

/** Index just past the `]` closing the bracket at `start`, quotes respected. */
export function skipBrackets(sel: string, start: number): number {
	let i = start + 1;
	while (i < sel.length) {
		const ch = sel[i];
		if (ch === '"' || ch === "'") {
			i = skipString(sel, i);
			continue;
		}
		if (ch === "\\") {
			i += 2;
			continue;
		}
		if (ch === "]") return i + 1;
		i++;
	}
	return sel.length;
}

/** Index of the `)` matching the `(` at `start`, or `sel.length` if unclosed. */
export function matchParen(sel: string, start: number): number {
	let depth = 0;
	let i = start;
	while (i < sel.length) {
		const ch = sel[i];
		if (ch === '"' || ch === "'") {
			i = skipString(sel, i);
			continue;
		}
		if (ch === "(") depth++;
		else if (ch === ")" && --depth === 0) return i;
		i++;
	}
	return sel.length;
}

/**
 * Split a selector list on commas that are not inside brackets, parens or
 * strings.
 *
 * A plain `.split(",")` is not this. ITS Theme writes
 * `body:not(.default-callout-quote, .callout-no-quote) .callout.callout[data-callout=quote] …`,
 * which a naive split tears into `body:not(.default-callout-quote` and
 * `.callout-no-quote) .callout.callout[data-callout=quote] …`. The claim
 * survives there only by luck — the fragment happens to still contain the
 * attribute — and its weight is then computed from a selector nobody wrote. An
 * `:is(a, b)` wrapped around the attribute instead loses the claim outright.
 */
export function splitSelectorList(sel: string): string[] {
	const out: string[] = [];
	let start = 0;
	let i = 0;
	while (i < sel.length) {
		const ch = sel[i];
		if (ch === '"' || ch === "'") {
			i = skipString(sel, i);
			continue;
		}
		if (ch === "[") {
			i = skipBrackets(sel, i);
			continue;
		}
		if (ch === "(") {
			i = matchParen(sel, i) + 1;
			continue;
		}
		if (ch === ",") {
			out.push(sel.slice(start, i));
			start = i + 1;
		}
		i++;
	}
	out.push(sel.slice(start));
	return out;
}

/**
 * The same selector with the *contents* of every `:not(…)` replaced by spaces,
 * offsets preserved.
 *
 * A `[data-callout=x]` inside a negation says the rule applies to everything
 * **except** that callout, so reading it as a claim is not merely imprecise —
 * it is backwards. Blue Topaz writes
 * `… .markdown-preview-view:not(.kanban) *:not([data-callout="kanban"]) > div > …`
 * for its indent guides, and taking that at face value reports a conflict on
 * `[!kanban]` for a rule that deliberately leaves `[!kanban]` alone.
 *
 * Only `:not()` is blanked. A claim inside `:is()`, `:where()` or `:has()` is a
 * real claim on that callout — those select it, they do not exclude it.
 */
export function blankNegations(selector: string): string {
	let out = selector;
	let i = 0;
	while (i < out.length) {
		const ch = out[i];
		if (ch === '"' || ch === "'") {
			i = skipString(out, i);
			continue;
		}
		if (ch === "[") {
			i = skipBrackets(out, i);
			continue;
		}
		if (ch === ":" && /^:not\s*\(/i.test(out.slice(i))) {
			const open = out.indexOf("(", i);
			const close = matchParen(out, open);
			out =
				out.slice(0, open + 1) +
				" ".repeat(Math.max(0, close - open - 1)) +
				out.slice(close);
			i = close;
			continue;
		}
		i++;
	}
	return out;
}
