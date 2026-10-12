/**
 * manager/theme/themeMetadataScan.ts — the metadata words a stylesheet reacts
 * to, for the `[!type|…]` suggestions.
 *
 * Pure text in, plain data out, like `themeCalloutScan.ts` beside it — and for
 * the same reason: a scanner nobody can test is how a wrong suggestion ships.
 *
 * ## What the operator says about where a word may stand
 *
 * Themes match metadata with every attribute operator there is, and the
 * operator decides how the word can be combined with others — which is the
 * one thing a user cannot see from the theme's documentation alone:
 *
 * | Operator | Word must…                                   | Placement  |
 * |----------|----------------------------------------------|------------|
 * | `*=`     | appear anywhere, any separator               | `anywhere` |
 * | `~=`     | be a whitespace-separated word — a `\|` breaks it | `spaced` |
 * | `^=`     | come first                                   | `first`    |
 * | `$=`     | come last                                    | `last`     |
 * | `=` `\|=` | be the whole metadata                        | `alone`    |
 *
 * A word the theme matches several ways gets the most forgiving placement of
 * them — if any rule of the theme reacts to `wide` wherever it stands, `wide`
 * works wherever it stands.
 *
 * ## Words tied to one callout
 *
 * A rule like ITS Theme's `.callout[data-callout=kith][data-callout-metadata=friend]`
 * makes `friend` mean something on `[!kith]` and nothing anywhere else. The
 * callout conditions standing at the top level of the SAME compound are kept as
 * the word's guards and the suggestions offer it only where one matches.
 *
 * Only the top level: inside `:is()` a condition is an alternative, not a
 * requirement — Blue Topaz's `:is([data-callout-metadata*="indent"],
 * [data-callout*=indent])` means "the word OR a callout named like it", and
 * reading the id as a guard hid `indent` from every other callout. A condition
 * on an ancestor (`.callout[data-callout=columns] > .callout-content >
 * .callout[…]`) is not a guard on this callout's own id either. A word any rule
 * reaches without a guard is unguarded, full stop.
 *
 * ## What is not a word
 *
 * Empty values, values with whitespace, and family fragments that start or
 * end with `-` (ITS Theme's `*=bg-` that detects the whole `bg-*` set) are
 * dropped: nobody types `bg-`. Words named only inside `:not()` are kept —
 * those are opt-outs (`revert`, `anp-sleek`), still words a user writes.
 */
import { eachBlock, stripComments } from "./cssBlocks";
import {
	matchParen,
	skipBrackets,
	skipString,
	splitSelectorList,
} from "../../utils/selectorText";
import { obsidianCalloutAttrId } from "../../utils/calloutId";

/** Where a metadata word may stand for the theme to still see it. */
export type MetadataPlacement = "anywhere" | "spaced" | "first" | "last" | "alone";

/** One `[data-callout<op>=value]` condition a word is tied to. */
export interface MetadataGuard {
	/** The attribute operator without its `=`: `""`, `~`, `^`, `$`, `*`, `|`. */
	op: string;
	/** The id, in `data-callout` attribute form. */
	value: string;
}

/** One word a stylesheet reacts to. */
export interface ThemeMetadataWord {
	/** Exactly as the stylesheet spells it — theme matching is case-sensitive. */
	word: string;
	placement: MetadataPlacement;
	/**
	 * The callout conditions the word was found beside, any of which enables it
	 * — or `null` when some rule reacts to it on every callout.
	 */
	guards: MetadataGuard[] | null;
}

const PLACEMENT_FOR_OP: Record<string, MetadataPlacement> = {
	"*": "anywhere",
	"~": "spaced",
	"^": "first",
	"$": "last",
	"": "alone",
	"|": "alone",
};

/** Lower is more forgiving. `first` and `last` are not comparable; first seen wins. */
const PLACEMENT_RANK: Record<MetadataPlacement, number> = {
	anywhere: 0,
	spaced: 1,
	first: 2,
	last: 2,
	alone: 3,
};

const METADATA_ATTR_RE =
	/\[\s*data-callout-metadata\s*([~^*$|]?)=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*(?:[iIsS]\s*)?\]/g;
const CALLOUT_ATTR_RE =
	/\[\s*data-callout\s*([~^*$|]?)=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*(?:[iIsS]\s*)?\]/g;

/**
 * One selector cut into its compounds — the runs between combinators — with
 * strings, attribute brackets and parenthesised arguments kept whole, so an
 * `:is(…)` full of attributes stays inside the compound it qualifies.
 */
function compoundsOf(selector: string): string[] {
	const sel = selector.trim();
	const out: string[] = [];
	let start = 0;
	let i = 0;
	while (i < sel.length) {
		const ch = sel[i] ?? "";
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
		if (/[\s>+~]/.test(ch)) {
			if (i > start) out.push(sel.slice(start, i));
			start = i + 1;
		}
		i++;
	}
	if (start < sel.length) out.push(sel.slice(start));
	return out.filter((c) => c.trim().length > 0);
}

/**
 * `compound` with every parenthesised argument blanked to spaces — `:not()`,
 * `:is()`, `:where()` alike — leaving only what the compound itself requires.
 */
function topLevelOf(compound: string): string {
	let out = "";
	let i = 0;
	while (i < compound.length) {
		const ch = compound[i] ?? "";
		if (ch === '"' || ch === "'") {
			const end = skipString(compound, i);
			out += compound.slice(i, end);
			i = end;
			continue;
		}
		if (ch === "[") {
			const end = skipBrackets(compound, i);
			out += compound.slice(i, end);
			i = end;
			continue;
		}
		if (ch === "(") {
			const close = matchParen(compound, i);
			out += `(${" ".repeat(Math.max(0, close - i - 1))})`;
			i = close + 1;
			continue;
		}
		out += ch;
		i++;
	}
	return out;
}

function attrsIn(text: string, re: RegExp): Array<{ op: string; value: string }> {
	const out: Array<{ op: string; value: string }> = [];
	for (const m of text.matchAll(re)) {
		out.push({ op: m[1] ?? "", value: m[2] ?? m[3] ?? m[4] ?? "" });
	}
	return out;
}

const isWord = (value: string): boolean =>
	value.length > 0 &&
	!/\s/.test(value) &&
	!value.startsWith("-") &&
	!value.endsWith("-");

/** Every metadata word one stylesheet reacts to, in the order it first names them. */
export function scanMetadataWords(css: string): ThemeMetadataWord[] {
	const words = new Map<string, ThemeMetadataWord>();

	eachBlock(stripComments(css), (prelude) => {
		if (!prelude.includes("data-callout-metadata")) return;
		for (const part of splitSelectorList(prelude)) {
			for (const compound of compoundsOf(part)) {
				const found = attrsIn(compound, METADATA_ATTR_RE);
				if (found.length === 0) continue;
				// A callout condition the compound itself requires.
				const guards = attrsIn(topLevelOf(compound), CALLOUT_ATTR_RE)
					.filter((g) => g.value.length > 0)
					.map((g) => ({ op: g.op, value: obsidianCalloutAttrId(g.value) }));
				for (const { op, value } of found) {
					if (!isWord(value)) continue;
					record(words, value, PLACEMENT_FOR_OP[op] ?? "alone", guards);
				}
			}
		}
	});
	return [...words.values()];
}

function record(
	words: Map<string, ThemeMetadataWord>,
	word: string,
	placement: MetadataPlacement,
	guards: MetadataGuard[],
): void {
	const seen = words.get(word);
	if (!seen) {
		words.set(word, {
			word,
			placement,
			guards: guards.length > 0 ? [...guards] : null,
		});
		return;
	}
	if (PLACEMENT_RANK[placement] < PLACEMENT_RANK[seen.placement]) {
		seen.placement = placement;
	}
	if (seen.guards === null) return;
	if (guards.length === 0) {
		seen.guards = null;
		return;
	}
	for (const g of guards) {
		if (!seen.guards.some((s) => s.op === g.op && s.value === g.value)) {
			seen.guards.push(g);
		}
	}
}

/**
 * Whether a word may be offered on a callout with this id — always for an
 * unguarded word, else when one of its guards matches the id's attribute form
 * the way the stylesheet's own operator would.
 */
export function wordAppliesTo(word: ThemeMetadataWord, calloutId: string): boolean {
	if (word.guards === null) return true;
	const attr = obsidianCalloutAttrId(calloutId);
	return word.guards.some(({ op, value }) => {
		switch (op) {
			case "^": return attr.startsWith(value);
			case "$": return attr.endsWith(value);
			case "*": return attr.includes(value);
			case "|": return attr === value || attr.startsWith(`${value}-`);
			default: return attr === value;
		}
	});
}
