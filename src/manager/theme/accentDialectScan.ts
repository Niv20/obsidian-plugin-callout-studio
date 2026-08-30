/**
 * manager/theme/accentDialectScan.ts — reading ONE stylesheet for accent
 * evidence.
 *
 * The text-walking half of `accentDialect.ts`, split off the way
 * `themeCalloutScan.ts` is split from `themeClaimLookup.ts`: this file answers
 * "what does *this* sheet say", and knows nothing about how several sheets are
 * folded into one verdict or what is done with it. Pure text in, plain data
 * out. Every counting rule below is a measurement over the 257 themes in the
 * dev vault, and `tests/accentDialect.test.ts` freezes each one with the
 * theme that justifies it.
 */
import { eachBlock, stripComments } from "./cssBlocks";
import { blankNegations, splitSelectorList } from "../../utils/selectorText";
import type { AccentEvidence } from "./accentDialect";

/**
 * Which theme modes a rule's declarations can apply in.
 *
 * A substring test on the whole prelude rather than a walk of the selector
 * list, and both halves of that are deliberate. It is the same pre-filter
 * economy the scan already uses on `.callout`; and a comma list that names both
 * modes correctly comes out `"both"`, because its declarations really do apply
 * in both. A `:not(.theme-dark)` reads as dark-guarded and is the one shape
 * this gets wrong — no installed theme writes it on an accent variable, and
 * being wrong there costs the same grey the whole mechanism exists to avoid,
 * not something worse.
 */
function guardedMode(prelude: string): "light" | "dark" | "both" {
	const dark = prelude.includes(".theme-dark");
	const light = prelude.includes(".theme-light");
	if (dark === light) return "both";
	return dark ? "dark" : "light";
}

/**
 * The variables this plugin and core actually exchange. Deliberately not "any
 * `--callout-*`": a theme's private palette (`--callout-blue` in ITS Theme) is
 * its own business, and counting reads of it would let a theme's internal
 * habits outvote the contract surface we share with it.
 *
 * Two jobs, and the second is why the set is not just a read filter: a
 * declaration of one of THESE is held to {@link reachable}, while a palette
 * variable is recorded wherever it is declared so a `var()` chain can resolve
 * through it.
 */
export const ACCENT_VARS = new Set([
	"--callout-color",
	"--callout-default",
	"--callout-summary",
	"--callout-info",
	"--callout-todo",
	"--callout-important",
	"--callout-tip",
	"--callout-success",
	"--callout-question",
	"--callout-warning",
	"--callout-fail",
	"--callout-error",
	"--callout-bug",
	"--callout-example",
	"--callout-quote",
]);

/** Functions whose legacy comma form takes bare channel numbers. */
const TRIPLET_FNS = new Set(["rgb", "rgba", "hsl", "hsla"]);

/** Compounds whose state this plugin already knows. See {@link reachable}. */
const KNOWN_STEP = /^(?::root|html|body|\.theme-light|\.theme-dark|\.callout)+$/;

/**
 * Is this selector satisfied in a state we know we are in?
 *
 * `:root`, `html` and `body` always match; `.theme-light` / `.theme-dark` are
 * the split {@link guardedMode} already makes; `.callout` is the element being
 * styled. A `:not(...)` counts as satisfied, because a theme writes one for its
 * *normal* styling — Velocity's `body:not(.disable-callout-styling)` is what
 * every reader sees until they tick "Restore default Callout styling".
 *
 * Everything else is a theme option whose state the text cannot reveal, and two
 * installed themes declare accent variables only there: Aura's
 * `.aura-origin-layout` (one of three layouts, and not the default) and
 * TerraFlow's `.academia-theme` (one palette of eleven). A `--callout-<type>`
 * seen only behind such a guard says nothing about the value that is live — in
 * the default state the variable still holds *core's*, in core's spelling — and
 * betting on it is not a near-miss. `--cs-accent-theme` is registered `<color>`,
 * so a wrong wrapper falls back to grey and takes every heading bar, inline
 * pill and icon tint on that built-in with it. Ignoring the declaration leaves
 * the variable absent, which sends `accentVarSpelling` to core: right in the
 * default state, and no worse than the bet in the other.
 *
 * Only accent variables are held to this. A palette variable a `var()` chain
 * hops through is recorded wherever it is declared: its *spelling* is a fact
 * about how the theme writes colours, not about which option is on.
 */
function reachable(part: string): boolean {
	return blankNegations(part)
		.replace(/:not\(\s*\)/g, "")
		.split(/[\s>+~]+/)
		.filter((step) => step.length > 0)
		.every((step) => KNOWN_STEP.test(step));
}

/** `.callout`, optionally repeated for weight, and nothing else. */
function isBareCallout(part: string): boolean {
	return /^(?:\.callout)+$/.test(part.trim());
}

/** Split one declaration block into `name: value` pairs, values kept. */
function declarationsWithValues(body: string): Array<[string, string]> {
	const out: Array<[string, string]> = [];
	for (const piece of body.split(";")) {
		const colon = piece.indexOf(":");
		if (colon < 0) continue;
		const name = piece.slice(0, colon).trim().toLowerCase();
		if (name.length === 0 || /[{}]/.test(name)) continue;
		out.push([name, piece.slice(colon + 1).replace(/!\s*important/i, "").trim()]);
	}
	return out;
}

/**
 * The function call wrapping the `var(` that starts at `at`, or null when the
 * read sits at the top level of the value.
 *
 * Scanning backwards for the nearest unbalanced `(` is what makes
 * `color-mix(in srgb, rgb(var(--callout-color)) 25%, transparent)` come out
 * **triplet**: the innermost wrapper is what dictates the spelling, not the
 * outermost.
 */
function enclosingCall(value: string, at: number): { fn: string; args: string } | null {
	let depth = 0;
	for (let i = at - 1; i >= 0; i--) {
		const ch = value[i];
		if (ch === ")") depth++;
		else if (ch === "(") {
			if (depth > 0) {
				depth--;
				continue;
			}
			let j = i - 1;
			while (j >= 0 && /[\w-]/.test(value.charAt(j))) j--;
			return { fn: value.slice(j + 1, i).toLowerCase(), args: value.slice(i + 1) };
		}
	}
	return null;
}

/**
 * Count the accent reads in one declaration value.
 *
 * Two exclusions, both measured rather than defensive:
 *
 * - **Relative colour syntax.** `hsl(from var(--callout-color) h s l / .1)` is
 *   real (Baseline, Cupertino; `oklch(from …)` in Iridium) and wants a
 *   *colour* despite the `hsl(` wrapper. No verdict in the 257-theme dev vault
 *   flips on this today, but relative colour is where themes are heading.
 * - **Pass-through aliases.** An unwrapped read assigned to another custom
 *   property (`--callout-color: var(--callout-default)`) carries no format
 *   information — it just forwards whatever it was given. Counting them flips
 *   SALEM, Sandstorm and Serenity from triplet to colour, which is three themes
 *   broken by one missing rule; the test that freezes this says so.
 */
function countReads(value: string, intoCustomProp: boolean, ev: AccentEvidence): void {
	const re = /var\(\s*(--callout-[\w-]+)/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(value)) !== null) {
		const varName = m[1]?.toLowerCase();
		if (varName === undefined || !ACCENT_VARS.has(varName)) continue;
		const call = enclosingCall(value, m.index);
		if (!call) {
			if (!intoCustomProp) ev.colorReads++;
			continue;
		}
		if (TRIPLET_FNS.has(call.fn) && !/^from[\s(]/i.test(call.args.trimStart())) {
			ev.tripletReads++;
		} else {
			ev.colorReads++;
		}
	}
}

/** Scan one stylesheet's text for accent evidence. */
export function scanAccentDialect(css: string): AccentEvidence {
	const ev: AccentEvidence = {
		tripletReads: 0,
		colorReads: 0,
		customProps: new Map(),
		lightProps: new Map(),
		darkProps: new Map(),
		unguarded: new Set(),
	};
	if (!css.includes("--callout-") && !css.includes(".callout")) return ev;

	eachBlock(stripComments(css), (prelude, body) => {
		// `.callout` in the prelude is the pre-filter that keeps
		// `splitSelectorList` + the bare test off every rule of an 850 KB sheet.
		const bare =
			prelude.includes(".callout") &&
			splitSelectorList(prelude).some(isBareCallout);
		if (!bare && !body.includes("--")) return;
		const scope = guardedMode(prelude);
		const into =
			scope === "light"
				? ev.lightProps
				: scope === "dark"
					? ev.darkProps
					: ev.customProps;
		// Computed only for a block that declares or reads one of these, which
		// keeps `splitSelectorList` off the other 20 000 rules of an 850 KB sheet.
		const open =
			!body.includes("--callout-") ||
			splitSelectorList(prelude).some(reachable);

		for (const [name, value] of declarationsWithValues(body)) {
			const custom = name.startsWith("--");
			if (custom && !into.has(name) && (open || !ACCENT_VARS.has(name))) {
				into.set(name, value);
			}
			if (value.includes("var(--callout-")) countReads(value, custom, ev);
			if (!bare || custom) continue;
			// Recorded under the name the theme wrote, shorthand or longhand.
			// Expanding one into the other is `manager/css/coreAccentShim.ts`'s
			// job — it is the only reader, and it is the only place that knows
			// which properties are at stake. See `PAINTERS` there.
			ev.unguarded.add(name);
		}
	});
	return ev;
}
