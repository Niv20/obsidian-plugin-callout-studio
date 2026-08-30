/**
 * manager/theme/accentValueFormat.ts — is this CSS value a colour, or a bare
 * RGB triplet?
 *
 * The value half of {@link accentDialect}, split out because it is a different
 * kind of question: that file walks a stylesheet and counts, this one looks at
 * one declared value and follows it wherever it points. Both are pure, and
 * this one is the half a `var()` chain makes interesting.
 */
import type { AccentSpelling } from "./accentDialect";

/** `1, 2, 3` or `1 2 3` — a bare channel list, meaningless outside `rgb()`. */
const BARE_TRIPLET =
	/^\d{1,3}(?:\.\d+)?(?:\s*,\s*|\s+)\d{1,3}(?:\.\d+)?(?:\s*,\s*|\s+)\d{1,3}(?:\.\d+)?%?$/;

/** `var(--x` at the head of a value; the fallback, if any, follows. */
const SOLE_VAR = /^var\(\s*(--[\w-]+)\s*(,)?/;

const MAX_VAR_HOPS = 6;

/** Classify a literal value, or null when it needs a `var()` hop to know. */
export function classifyLiteral(value: string): AccentSpelling | null {
	const v = value.trim();
	if (v.length === 0) return null;
	if (BARE_TRIPLET.test(v)) return "triplet";
	if (SOLE_VAR.test(v)) return null;
	// Anything else that parses as a value here is a colour: a hex, a colour
	// function, a keyword. Deliberately not an allow-list of function names —
	// the colour functions are still being added to, and "is it a bare triplet"
	// is the question actually being asked.
	return "color";
}

/**
 * Resolve what a `--callout-<type>` holds, following `var()` through the
 * theme's own custom properties.
 *
 * The indirection is not an edge case: Obsidian gruvbox declares
 * `--callout-info: var(--neutral-blue_x)` and `--neutral-blue_x: 69,133,136`
 * five hundred lines apart, and 19 other installed themes do something similar.
 * A `var()` FALLBACK counts as the next hop when the primary is undeclared,
 * which is the whole of the Catppuccin-style chain
 * `var(--ctp-custom-red, var(--ctp-ext-red, 210, 15, 57))`. The hop budget and
 * the `seen` set are both about a theme that references itself, which is legal
 * CSS and merely resolves to nothing.
 */
export function resolveDeclaredSpelling(
	name: string,
	props: ReadonlyMap<string, string>,
): AccentSpelling | undefined {
	const seen = new Set<string>();
	let current = props.get(name);
	for (let hop = 0; current !== undefined && hop < MAX_VAR_HOPS; hop++) {
		const verdict = classifyLiteral(current);
		if (verdict !== null) return verdict;
		const next = SOLE_VAR.exec(current.trim());
		const ref = next?.[1];
		if (ref === undefined || seen.has(ref)) return undefined;
		seen.add(ref);
		const hopped = props.get(ref);
		current =
			hopped ??
			(next?.[2] === undefined ? undefined : fallbackOf(current.trim()));
	}
	return undefined;
}

/** The fallback argument of a leading `var(--x, …)`, without its closing paren. */
function fallbackOf(value: string): string | undefined {
	const comma = value.indexOf(",");
	if (comma < 0) return undefined;
	let depth = 1;
	for (let i = value.indexOf("(") + 1; i < value.length; i++) {
		if (value[i] === "(") depth++;
		else if (value[i] === ")" && --depth === 0) {
			return value.slice(comma + 1, i).trim();
		}
	}
	return value.slice(comma + 1).trim();
}
