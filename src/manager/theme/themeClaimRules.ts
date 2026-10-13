/**
 * manager/theme/themeClaimRules.ts — the theme's parsed rules, as the claim
 * check asks about them.
 *
 * `ThemeClaimCheck` measures whether switching the rules that name a callout
 * off changes what is drawn. Before any of that it needs three answers about
 * the rules themselves, all against the browser's parsed copy of the theme
 * and the page as it is right now:
 *
 * - which rules name which id ({@link indexRules});
 * - whether a rule is switched off by the page - a `<body>`/`<html>` condition
 *   it fails ({@link pageRootTest}), or a Style Settings option class `<body>`
 *   does not carry ({@link optionGatedRule});
 * - whether a rule is in force on the callout the check rendered
 *   ({@link ruleInForce}).
 *
 * The selector text itself is read and rewritten in `themeClaimSelectors.ts`,
 * which is pure and unit-tested; this module applies it to the CSSOM and the
 * DOM.
 */
import {
	namesInSelector,
	optionGated,
	pageRootFails,
	resolveNested,
	stripPseudoElements,
	type PageRoot,
} from "./themeClaimSelectors";

export type StyleRule = CSSRule & { selectorText: string };

/** Each named id's rules in one parsed sheet. */
export type RuleIndex = Map<string, StyleRule[]>;

/** `@page` also has a `selectorText`, but never one naming a callout. */
export function isStyleRule(rule: CSSRule): rule is StyleRule {
	return typeof (rule as Partial<StyleRule>).selectorText === "string";
}

/** Every rule of `sheet` naming a callout id, nested ones included; `null` when unreadable. */
export function indexRules(sheet: CSSStyleSheet): RuleIndex | null {
	let rules: CSSRuleList;
	try {
		rules = sheet.cssRules;
	} catch {
		return null;
	}
	const index: RuleIndex = new Map();
	const walk = (list: CSSRuleList): void => {
		for (const rule of Array.from(list)) {
			if (isStyleRule(rule) && rule.selectorText.includes("data-callout")) {
				for (const id of namesInSelector(rule.selectorText)) {
					const named = index.get(id);
					if (named) named.push(rule);
					else index.set(id, [rule]);
				}
			}
			const inner = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
			if (inner && inner.length > 0) walk(inner);
		}
	};
	walk(rules);
	return index;
}

/**
 * Whether a rule - or a rule it is nested in - asks `<body>`/`<html>` for
 * something the page lacks right now. Memoised for one question.
 */
export function pageRootTest(doc: Document): (rule: CSSRule) => boolean {
	const matches = (compound: string, root: PageRoot): boolean =>
		(root === "body" ? doc.body : doc.documentElement).matches(compound);
	const off = new Map<CSSRule, boolean>();
	const ruleOff = (rule: CSSRule): boolean => {
		const known = off.get(rule);
		if (known !== undefined) return known;
		const parent = rule.parentRule;
		const result =
			(isStyleRule(rule) && pageRootFails(rule.selectorText, matches)) ||
			(parent !== null && ruleOff(parent));
		off.set(rule, result);
		return result;
	};
	return ruleOff;
}

/**
 * Classes Obsidian itself keeps on `<body>`, and nowhere else: the appearance
 * mode and the platform. A theme writes `.theme-dark .callout[…]` as often as
 * `body.theme-dark …`, and in light mode that rule draws nothing - the light
 * twin, or core, is what shows. Switching mode fires `css-change`, so the
 * verdict is measured again in the other mode.
 */
export const OBSIDIAN_BODY_STATE: ReadonlySet<string> = new Set([
	"theme-dark",
	"theme-light",
	"is-mobile",
	"is-phone",
	"is-tablet",
	"mod-windows",
	"mod-macos",
	"mod-linux",
]);

/**
 * Whether a rule - or a rule it is nested in - requires, in every branch, a
 * class the page root does not carry and only the page root could: one the
 * theme's Style Settings block offers (`options`, a theme option that is off),
 * or one of Obsidian's own {@link OBSIDIAN_BODY_STATE} classes (the other mode,
 * another platform).
 */
export function optionGatedRule(
	rule: CSSRule,
	options: ReadonlySet<string>,
	doc: Document,
): boolean {
	const off = (cls: string): boolean =>
		(options.has(cls) || OBSIDIAN_BODY_STATE.has(cls)) &&
		!doc.body.classList.contains(cls) &&
		!doc.documentElement.classList.contains(cls);
	for (let r: CSSRule | null = rule; r; r = r.parentRule) {
		if (isStyleRule(r) && optionGated(r.selectorText, off)) return true;
	}
	return false;
}

/**
 * A rule's selector with the selectors of the rules it is nested in folded in
 * (`resolveNested`), so it can be matched on its own.
 */
function resolvedSelector(rule: StyleRule): string {
	let parent = rule.parentRule;
	while (parent && !isStyleRule(parent)) parent = parent.parentRule;
	if (!parent) return rule.selectorText;
	return resolveNested(rule.selectorText, resolvedSelector(parent));
}

/**
 * Whether every grouping rule around `rule` holds on this page right now:
 * `@media` against the window, `@supports` against the browser. `@container`
 * and `@scope` depend on where the callout sits, which an offscreen render
 * cannot answer, so they count as not holding - a doubt, and a doubt keeps the
 * callout with the theme. `@layer` and the rest are transparent.
 */
function groupsHold(rule: CSSRule, doc: Document): boolean {
	const win = doc.defaultView;
	for (let r = rule.parentRule; r; r = r.parentRule) {
		if (isStyleRule(r)) continue;
		const group = r as CSSRule & {
			media?: { mediaText?: string };
			conditionText?: string;
			containerName?: string;
			containerQuery?: string;
			start?: unknown;
		};
		if (group.media && typeof group.media.mediaText === "string") {
			const text = group.media.mediaText;
			if (text && !(win?.matchMedia?.(text).matches ?? false)) return false;
			continue;
		}
		if (group.containerQuery !== undefined || group.containerName !== undefined) return false;
		if (typeof group.conditionText === "string") {
			const css = (win as (Window & { CSS?: { supports?: (c: string) => boolean } }) | null)?.CSS;
			if (!(css?.supports?.(group.conditionText) ?? false)) return false;
			continue;
		}
		if (group.start !== undefined) return false;
	}
	return true;
}

/**
 * Whether everything nested inside `rule` is accounted for by `seen`: child
 * style rules (`&:hover`, `& .callout-title`, `&.is-collapsed`), through any
 * `@media` or `@supports` around them, and the bare declarations nested after
 * or inside those (in force where their owning rule is, under the groups
 * around them). A theme that writes `&:hover` inside the id's rule draws on
 * hover exactly as one that writes `.callout[…]:hover` beside it, and the
 * render sees neither.
 */
export function nestedRulesSeen(
	rule: StyleRule,
	seen: (rule: StyleRule) => boolean,
	doc: Document,
): boolean {
	const walk = (list: CSSRuleList | undefined, owner: StyleRule): boolean => {
		if (!list) return true;
		for (const child of Array.from(list)) {
			if (isStyleRule(child)) {
				if (!seen(child) || !walk(cssRulesOf(child), child)) return false;
				continue;
			}
			const inner = cssRulesOf(child);
			if (inner) {
				if (!walk(inner, owner)) return false;
				continue;
			}
			// `CSSNestedDeclarations`: declarations with no selector of their own.
			if ("style" in child && !(groupsHold(child, doc) && seen(owner))) return false;
		}
		return true;
	};
	return walk(cssRulesOf(rule), rule);
}

/** Every style rule nested inside `rule`, through any group rules, in order. */
export function nestedStyleRules(rule: CSSRule): StyleRule[] {
	const out: StyleRule[] = [];
	const walk = (list: CSSRuleList | undefined): void => {
		if (!list) return;
		for (const child of Array.from(list)) {
			if (isStyleRule(child)) out.push(child);
			walk(cssRulesOf(child));
		}
	};
	walk(cssRulesOf(rule));
	return out;
}

function cssRulesOf(rule: CSSRule): CSSRuleList | undefined {
	return (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
}

/** Does `rule` apply, right now, to one of `boxes`? */
export function ruleInForce(rule: StyleRule, boxes: Iterable<Element>, doc: Document): boolean {
	if (!groupsHold(rule, doc)) return false;
	const plain = stripPseudoElements(resolvedSelector(rule));
	for (const el of boxes) {
		try {
			if (el.matches(plain)) return true;
		} catch {
			/* a selector this browser will not match is not one it can see in force */
		}
	}
	return false;
}
