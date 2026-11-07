/**
 * manager/css/borrowedCalloutRules.ts — the rules other stylesheets aim at a
 * callout's name, re-aimed at the callout editor's preview.
 *
 * Who uses it. `CSSInjector`, for the layer it writes the callout editor's
 * draft into (see `CSSInjector.repaintPreview`).
 *
 * The main idea. The callout editor previews its draft under the reserved
 * placeholder id, so the draft reaches the preview pane alone and every note
 * keeps the saved callout until Save. But a callout's look does not come from
 * this plugin alone. A snippet of the user's may give `[!plan]` a border; a
 * theme may style every callout whose name contains `col`; Obsidian itself
 * gives each built-in its colour and its icon by id. None of that reaches the
 * placeholder. So the layer carries a copy of each such rule with the bracket
 * that names the callout swapped for one that names the placeholder: the same
 * declarations, the same weight (an attribute for an attribute), inside the
 * same `@media`, `@supports` or `@layer`.
 *
 * The rules are read from the stylesheets the browser has already parsed —
 * Obsidian's own, the theme as the theme switch leaves it, the snippets,
 * other plugins' — and never from this plugin's own sheets or its exported
 * snippet: those carry the saved callout, which the draft replaces. The caller
 * picks the sheets; this module only reads and rewrites.
 *
 * What a copy cannot do, both rare and both confined to the preview pane:
 *
 * - **Undo a rule that leaves the callout out by name.** A bracket inside
 *   `:not()` is left as it is, so `.callout:not([data-callout="x"])` still
 *   reaches the placeholder where it skips `[!x]` in a note.
 * - **Keep a tie it lost in its own sheet.** The copy sits after every sheet
 *   of the page, so against a rule of exactly equal weight written after the
 *   original it now wins.
 */
import { blankNegations, skipBrackets, skipString, splitSelectorList } from "../../utils/selectorText";
import { unescapeCss } from "../theme/themeClaimSelectors";
import { patternMatches } from "../theme/themeClaimLookup";
import type { PatternOp } from "../theme/themeCalloutScan";

/** One style rule that mentions `data-callout`, as it stands in its sheet. */
export interface CalloutAimedRule {
	/** The group rules around it, outermost first (`@media print`, `@layer x`). */
	at: string[];
	/** Its selector list, with CSS nesting resolved. */
	selector: string;
	/** Its declarations, as the browser serialises them. */
	declarations: string;
}

/** What the walk reads off a rule: the parts of the CSSOM it needs, all optional. */
type RuleLike = CSSRule & {
	selectorText?: string;
	style?: CSSStyleDeclaration;
	cssRules?: CSSRuleList;
	media?: MediaList;
	styleSheet?: CSSStyleSheet | null;
	appendRule?: unknown;
};

/**
 * Every style rule in `sheets` whose selector mentions `data-callout`, with
 * the group rules around it. A sheet the browser will not let us read (another
 * origin) is skipped, and one rule that throws never stops the walk.
 */
export function collectCalloutAimedRules(sheets: Iterable<CSSStyleSheet>): CalloutAimedRule[] {
	const out: CalloutAimedRule[] = [];
	for (const sheet of sheets) {
		const media = sheet.media?.mediaText ?? "";
		walk(sheet, media && media !== "all" ? [`@media ${media}`] : [], null, out);
	}
	return out;
}

function walk(
	container: { readonly cssRules: CSSRuleList },
	at: string[],
	parent: string | null,
	out: CalloutAimedRule[],
): void {
	let rules: CSSRuleList;
	try {
		rules = container.cssRules;
	} catch {
		return;
	}
	for (let i = 0; i < rules.length; i++) {
		try {
			const rule = rules[i] as RuleLike | undefined;
			if (!rule) continue;
			if (typeof rule.selectorText === "string") {
				const selector = parent === null ? rule.selectorText : nestedSelector(parent, rule.selectorText);
				// The selector first: serialising the declarations is the costly
				// part, and almost no rule of Obsidian's or a theme's names a callout.
				if (selector.includes("data-callout")) {
					const declarations = rule.style?.cssText ?? "";
					if (declarations) out.push({ at, selector, declarations });
				}
				if (rule.cssRules && rule.cssRules.length > 0)
					walk(rule as { cssRules: CSSRuleList }, at, selector, out);
				continue;
			}
			// Declarations nested in a group rule inside a style rule
			// (`.a { @media x { color: red } }`) belong to that style rule.
			if (parent !== null && !rule.cssRules && rule.style) {
				if (parent.includes("data-callout")) {
					const declarations = rule.style.cssText;
					if (declarations) out.push({ at, selector: parent, declarations });
				}
				continue;
			}
			if (rule.styleSheet) {
				const media = rule.media?.mediaText ?? "";
				walk(rule.styleSheet, media && media !== "all" ? [...at, `@media ${media}`] : at, parent, out);
				continue;
			}
			// A group rule (`@media`, `@supports`, `@layer`, `@container`), but
			// not `@keyframes`, whose children are keyframes, not rules.
			if (rule.cssRules && typeof rule.appendRule !== "function") {
				const prelude = preludeOf(rule);
				if (prelude !== null) walk(rule as { cssRules: CSSRuleList }, [...at, prelude], parent, out);
			}
		} catch {
			/* one rule never stops the walk */
		}
	}
}

/** The `@…` line that opens a group rule, or null when it cannot be read. */
function preludeOf(rule: RuleLike): string | null {
	if (rule.media && typeof rule.media.mediaText === "string") return `@media ${rule.media.mediaText}`;
	const text = rule.cssText ?? "";
	const brace = text.indexOf("{");
	return brace > 0 ? text.slice(0, brace).trim() : null;
}

/**
 * A nested selector, resolved the way the browser resolves it: `&` stands for
 * the parent, and a selector without one is a descendant of it. The parent is
 * wrapped in `:is()`, which is what `&` means and weighs what the parent does.
 */
function nestedSelector(parent: string, child: string): string {
	const outer = `:is(${parent})`;
	return splitSelectorList(child)
		.map((part) => {
			const sel = part.trim();
			return hasAmpersand(sel) ? replaceAmpersands(sel, outer) : `${outer} ${sel}`;
		})
		.join(", ");
}

function hasAmpersand(sel: string): boolean {
	return replaceAmpersands(sel, "") !== sel;
}

/** `sel` with every `&` outside strings and brackets replaced by `outer`. */
function replaceAmpersands(sel: string, outer: string): string {
	let out = "";
	let i = 0;
	while (i < sel.length) {
		const ch = sel[i];
		if (ch === '"' || ch === "'") {
			const end = skipString(sel, i);
			out += sel.slice(i, end);
			i = end;
			continue;
		}
		if (ch === "[") {
			const end = skipBrackets(sel, i);
			out += sel.slice(i, end);
			i = end;
			continue;
		}
		out += ch === "&" ? outer : ch;
		i++;
	}
	return out;
}

/** One `[data-callout<op>=<value> <flag>]`, the whole bracket. */
const CALLOUT_ATTR =
	/^\[\s*data-callout\s*([~^*$|]?)=\s*(?:"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'|([^\]\s]+))\s*(?:([iIsS])\s*)?\]$/;

/** Whether the bracket `bracket` selects a callout whose attribute id is `attrId`. */
function bracketSelects(bracket: string, attrId: string): boolean {
	const m = CALLOUT_ATTR.exec(bracket);
	if (!m) return false;
	const op = m[1] ?? "";
	let value = unescapeCss(m[2] ?? m[3] ?? m[4] ?? "");
	let id = attrId;
	if (value.length === 0) return false;
	if (m[5] === "i" || m[5] === "I") {
		value = value.toLowerCase();
		id = id.toLowerCase();
	}
	return op === "" ? value === id : patternMatches(op as PatternOp, value, id);
}

/**
 * `selector` with every bracket outside `:not()` that selects `attrId`
 * replaced by `replacement`, or null when none does.
 */
function reaimed(selector: string, attrId: string, replacement: string): string | null {
	// Blanking keeps offsets, so a position found here is a position in `selector`.
	const visible = blankNegations(selector);
	const hits: Array<{ start: number; end: number }> = [];
	let i = 0;
	while (i < visible.length) {
		const ch = visible[i];
		if (ch === '"' || ch === "'") {
			i = skipString(visible, i);
			continue;
		}
		if (ch === "[") {
			const end = skipBrackets(visible, i);
			if (bracketSelects(visible.slice(i, end), attrId)) hits.push({ start: i, end });
			i = end;
			continue;
		}
		i++;
	}
	if (hits.length === 0) return null;
	let out = selector;
	for (const { start, end } of hits.reverse()) out = out.slice(0, start) + replacement + out.slice(end);
	return out;
}

/**
 * The rules among `rules` that reach a callout of attribute id `attrId`,
 * re-aimed at the callout id `placeholder`, as stylesheet text. A rule's
 * selector list keeps only the selectors that reached it.
 */
export function borrowedRulesCss(rules: readonly CalloutAimedRule[], attrId: string, placeholder: string): string {
	const replacement = `[data-callout="${placeholder}"]`;
	const out: string[] = [];
	for (const rule of rules) {
		const selectors: string[] = [];
		for (const part of splitSelectorList(rule.selector)) {
			const copy = reaimed(part.trim(), attrId, replacement);
			if (copy !== null) selectors.push(copy);
		}
		if (selectors.length === 0) continue;
		const body = `${selectors.join(",\n")} { ${rule.declarations} }`;
		out.push(rule.at.reduceRight((inner, prelude) => `${prelude} {\n${inner}\n}`, body));
	}
	return out.join("\n");
}
