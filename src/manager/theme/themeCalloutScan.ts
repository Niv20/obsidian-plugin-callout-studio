/**
 * manager/theme/themeCalloutScan.ts — which callouts a stylesheet claims.
 *
 * Pure text in, plain data out: no DOM, no `CSSStyleSheet`, nothing to mock.
 * That is deliberate. The obvious implementation is to `replaceSync()` the
 * theme into an unadopted sheet and walk `cssRules`, which is what Callout
 * Manager does — but `CSSStyleSheet` does not exist in this repo's test DOM,
 * and a scanner nobody can test is how a false "your theme conflicts here"
 * badge ships. Comments are stripped up front and string bodies are skipped,
 * which is the only thing the CSSOM was really buying.
 *
 * ## Two questions, not one
 *
 * *"Which callouts does this theme define?"* and *"does this theme style the
 * callout I already have?"* look like the same question and are not, and
 * collapsing them is the mistake this module is shaped around. This file owns
 * the first; `themeClaimLookup.ts` owns the second, and says why it is allowed
 * to be laxer.
 *
 * Enumeration may only read operators that name **one** id: `=` and `~=`. ITS
 * Theme writes `[data-callout*=column]` to catch `two-column`, `three-column`
 * and friends, and reading that as an id invents a callout named "column" that
 * nobody has. Callout Manager makes that mistake, and also treats `^=` as an id
 * when it is a *prefix*.
 *
 * `~=` is the one fuzzy-looking operator that is not fuzzy here. It matches a
 * whitespace-separated word list, and Obsidian writes only the callout *type*
 * into `data-callout` — metadata goes to `data-callout-metadata` — so the list
 * is always one word and `~=infobox` matches exactly what `=infobox` does.
 * Excluding it was a measured false negative: ITS Theme declares `infobox`,
 * `cards`, `timeline`, `aside` and `kanban` that way and only that way, so its
 * five most-used callout types never reached the user's list.
 *
 * ## Why the weight
 *
 * A claim is only interesting if the theme's rule actually outranks ours, so
 * each id records the heaviest specificity seen among the selectors matching
 * it — see `utils/cssSpecificity.ts`, which owns that arithmetic and the
 * reasons the three regexes this used to carry were wrong.
 */
import {
	compareSpecificity,
	specificityOf,
	type Specificity,
} from "../../utils/cssSpecificity";
import { blankNegations, splitSelectorList } from "../../utils/selectorText";
import { obsidianCalloutAttrId } from "../../utils/calloutId";

/** One thing a stylesheet says about one callout id. */
export interface ThemeClaim {
	/** Heaviest `[a,b,c]` seen among the selectors that match this id. */
	weight: Specificity;
	/** Declared property names, lower-cased. `--callout-color`, `background`, … */
	props: Set<string>;
	/** The subset of `props` marked `!important`, which force cannot beat. */
	important: Set<string>;
	/**
	 * True when the theme names this callout outright (`[data-callout=x]` or
	 * `[data-callout~=x]`). False when it was reached by a family pattern
	 * (`^=`, `*=`, `$=`, `|=`) — the rule really does apply, but the theme
	 * author may have been aiming at a different callout whose id happens to
	 * match, so a caller hedges.
	 */
	certain: boolean;
}

/** The operators that match by pattern rather than by naming an id. */
export type PatternOp = "^" | "*" | "~" | "$" | "|";

/**
 * The attribute operators that name exactly one callout, and so may be
 * enumerated. See the module doc for why `~=` belongs here and `*=` does not.
 */
const NAMES_ONE_ID = new Set(["", "~"]);

/** A pattern claim, kept with its operator so matching stays exact. */
export interface PatternClaim {
	op: PatternOp;
	value: string;
	claim: ThemeClaim;
}

export interface ThemeScan {
	/**
	 * Claims that name one id (`=`, `~=`), keyed by the **attribute form** —
	 * `obsidianCalloutAttrId`, i.e. trimmed, lower-cased, spaces dasherized.
	 *
	 * Not the text as written, and the difference is not cosmetic. Every
	 * consumer compares against `obsidianCalloutAttrId(def.id)`, so a theme
	 * writing `[data-callout~=Metadata i]` — ITS Theme does, in 24 rules —
	 * would produce a key nothing could ever match: `themeProvidedRows` would
	 * mint a row for it, fail to recognise that row on the next sweep, delete
	 * it, and mint it again, forever. Normalising here is what keeps the sweep
	 * idempotent no matter how a theme author capitalised their selector.
	 */
	byId: Map<string, ThemeClaim>;
	/** Family claims — matched by `themeClaimLookup`, never enumerated. */
	patterns: PatternClaim[];
}

/**
 * Strip CSS comments. Not string-aware, and does not need to be: comment
 * punctuation inside a CSS string literal is legal but vanishingly rare, and
 * the cost of getting it wrong is one missed claim rather than a wrong one.
 */
export function stripComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every `[data-callout<op>=<value>]` in one selector. */
function calloutAttrs(selector: string): Array<{ op: string; value: string }> {
	const out: Array<{ op: string; value: string }> = [];
	const re =
		/\[\s*data-callout\s*([~^*$|]?)=\s*("([^"]*)"|'([^']*)'|([^\]\s]+))\s*(?:[iIsS]\s*)?\]/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(selector)) !== null) {
		const value = m[3] ?? m[4] ?? m[5] ?? "";
		if (value.length > 0) out.push({ op: m[1] ?? "", value });
	}
	return out;
}

function emptyClaim(certain: boolean): ThemeClaim {
	return {
		weight: [0, 0, 0],
		props: new Set(),
		important: new Set(),
		certain,
	};
}

function exactClaim(map: Map<string, ThemeClaim>, key: string): ThemeClaim {
	let claim = map.get(key);
	if (!claim) {
		claim = emptyClaim(true);
		map.set(key, claim);
	}
	return claim;
}

function patternClaim(
	list: PatternClaim[],
	op: PatternOp,
	value: string,
): ThemeClaim {
	const found = list.find((p) => p.op === op && p.value === value);
	if (found) return found.claim;
	const claim = emptyClaim(false);
	list.push({ op, value, claim });
	return claim;
}

/** Property names declared in one rule body, with their `!important` flag. */
function declarationsOf(body: string): Array<{ name: string; bang: boolean }> {
	const out: Array<{ name: string; bang: boolean }> = [];
	for (const piece of body.split(";")) {
		const colon = piece.indexOf(":");
		if (colon < 0) continue;
		const name = piece.slice(0, colon).trim().toLowerCase();
		if (name.length === 0 || /[{}]/.test(name)) continue;
		out.push({ name, bang: /!\s*important/i.test(piece.slice(colon + 1)) });
	}
	return out;
}

/**
 * Visit every `prelude { body }` block, descending into at-rule wrappers.
 *
 * The close brace has to be found by depth rather than by the next `}`: with a
 * flat search, `@media print { .callout[data-callout=x] { … } }` matches the
 * *inner* rule's brace, so the inner selector ends up inside what is treated as
 * the wrapper's body and the claim is silently lost. A wrapper is recognised by
 * its body containing a brace at all, which covers `@media`, `@supports` and
 * their nestings without needing to know their names.
 */
export function eachBlock(
	text: string,
	visit: (prelude: string, body: string) => void,
): void {
	let cursor = 0;
	while (cursor < text.length) {
		const open = text.indexOf("{", cursor);
		if (open < 0) return;
		let depth = 0;
		let close = -1;
		for (let i = open; i < text.length; i++) {
			const ch = text[i];
			if (ch === "{") depth++;
			else if (ch === "}" && --depth === 0) {
				close = i;
				break;
			}
		}
		if (close < 0) return;
		const prelude = text.slice(cursor, open);
		const body = text.slice(open + 1, close);
		cursor = close + 1;
		if (body.includes("{")) eachBlock(body, visit);
		else visit(prelude, body);
	}
}

function absorb(
	claim: ThemeClaim,
	weight: Specificity,
	decls: Array<{ name: string; bang: boolean }>,
): void {
	if (compareSpecificity(weight, claim.weight) > 0) claim.weight = weight;
	for (const { name, bang } of decls) {
		claim.props.add(name);
		if (bang) claim.important.add(name);
	}
}

/** Scan one stylesheet's text. */
export function scanCalloutClaims(css: string): ThemeScan {
	const byId = new Map<string, ThemeClaim>();
	const patterns: PatternClaim[] = [];

	eachBlock(stripComments(css), (prelude, body) => {
		if (!prelude.includes("data-callout")) return;
		const decls = declarationsOf(body);

		// A selector list; each part is scored on its own. The split has to
		// respect parentheses — see splitSelectorList for the ITS Theme
		// selector that proves a plain `.split(",")` wrong.
		for (const part of splitSelectorList(prelude)) {
			if (!part.includes("data-callout")) continue;
			const weight = specificityOf(part);
			// A claim inside `:not()` is an exclusion, not a claim.
			for (const { op, value } of calloutAttrs(blankNegations(part))) {
				// Both halves are normalised, not just the exact one: a pattern
				// is matched against an attribute id too, so `^=Col` has to
				// compare like for like or it silently never fires.
				const attr = obsidianCalloutAttrId(value);
				const claim = NAMES_ONE_ID.has(op)
					? exactClaim(byId, attr)
					: patternClaim(patterns, op as PatternOp, attr);
				absorb(claim, weight, decls);
			}
		}
	});

	return { byId, patterns };
}

/** Merge two scans, keeping the strongest claim per id. Snippets over theme. */
export function mergeScans(scans: ThemeScan[]): ThemeScan {
	const out: ThemeScan = { byId: new Map(), patterns: [] };
	for (const scan of scans) {
		for (const [id, claim] of scan.byId) {
			mergeInto(exactClaim(out.byId, id), claim);
		}
		for (const { op, value, claim } of scan.patterns) {
			mergeInto(patternClaim(out.patterns, op, value), claim);
		}
	}
	return out;
}

function mergeInto(target: ThemeClaim, claim: ThemeClaim): void {
	if (compareSpecificity(claim.weight, target.weight) > 0) {
		target.weight = claim.weight;
	}
	for (const p of claim.props) target.props.add(p);
	for (const p of claim.important) target.important.add(p);
}
