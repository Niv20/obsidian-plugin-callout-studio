/**
 * manager/theme/themeCalloutStrip.ts — taking a theme's callout styling out of
 * the browser's parsed copy of it.
 *
 * The judgement is `themeCalloutRules.ts`; this applies it to a live
 * `CSSStyleSheet`, as `ThemeClaimCheck` applies its own for the length of one
 * pass. What differs is the way back: nothing here is put back rule by rule.
 * The theme's own text, parsed again (`reparseStyle` in `customCssApi.ts`), is
 * exactly what the theme wrote, whatever was taken out of the copy.
 *
 * Three things go:
 *
 * - **a rule whose every selector reaches a callout** — deleted, and with it
 *   everything nested inside it;
 * - **the selectors of a list that reach one** — `.callout, .admonition`
 *   becomes `.admonition`. A browser that will not take the narrowed text
 *   keeps the old selector, which would keep styling callouts, so the rule is
 *   deleted instead;
 * - **every `--callout-*` declaration left**, on `body` as often as not, and
 *   any `@property` registration of one — each reaches every callout through
 *   inheritance, or through Obsidian's own callout CSS reading it.
 *
 * Each rule is handled inside its own `try`: one unusual rule type throwing
 * must not leave the rest of the sheet as it was (see "A rule walk needs a
 * `try` around every rule" in `docs/internals-docs/18-theme-callout-discovery.md`).
 */
import { isStyleRule } from "./themeClaimRules";
import { isCalloutVariable, withoutCalloutBranches } from "./themeCalloutRules";

/** What one walk took out — for the log, and for the tests. */
export interface StripCounts {
	/** Rules deleted outright. */
	removed: number;
	/** Rules kept with the selectors that reach a callout taken out. */
	narrowed: number;
	/** `--callout-*` declarations removed from the rules that stay. */
	variables: number;
}

/** A sheet, a group rule or a style rule with rules nested in it. */
export interface RuleContainer {
	readonly cssRules: CSSRuleList;
	deleteRule(index: number): void;
}

/**
 * Obsidian's own values for what its callout CSS is built on, as its default
 * theme resolves them (1.14: `--radius-s` 4px, `--size-4-3` 12px, `--size-4-6`
 * 24px, `--font-normal` 400 + `--bold-modifier` 200,
 * `--highlight-mix-blend-mode` darken in light mode and in print, lighten in
 * dark, and `--icon-m` 16px with a 2px stroke), on the selectors core declares
 * them on - and, for the icon, on the callout's icon box alone, so no other
 * icon in the app changes.
 *
 * Core does not spell a callout's corners, padding, title weight or blend out:
 * `--callout-radius: var(--radius-s)` and its kin read tokens a theme sets for
 * the whole app. With the theme's callout styling switched off those still
 * reached every callout - ITS's square corners, Colored Candy's 20px,
 * Catppuccin's 18px icons - so the
 * switch's copy of the theme ends by saying Obsidian's values instead. Written
 * into the theme's own sheet, they stand where the theme's declarations stood:
 * after core, before the user's snippets and this plugin's sheet, which both
 * still win.
 */
const CORE_CALLOUT_DEFAULTS: readonly string[] = [
	"body { --callout-radius: 4px; --callout-padding: 12px 12px 12px 24px; --callout-title-weight: 600; }",
	".mod-rtl, .is-rtl, .rtl { --callout-padding: 12px 24px 12px 12px; }",
	".theme-light { --callout-blend-mode: darken; }",
	".theme-dark { --callout-blend-mode: lighten; }",
	"@media print { .theme-dark { --callout-blend-mode: darken; } }",
	".callout-icon { --icon-size: 16px; --icon-stroke: 2px; }",
];

/** End `sheet` with {@link CORE_CALLOUT_DEFAULTS}; returns how many rules went in. */
export function pinCoreCalloutDefaults(sheet: RuleContainer & { insertRule(rule: string, index?: number): number }): number {
	let pinned = 0;
	for (const rule of CORE_CALLOUT_DEFAULTS) {
		try {
			sheet.insertRule(rule, sheet.cssRules.length);
			pinned++;
		} catch {
			/* a rule the browser refuses leaves that one value to the theme */
		}
	}
	return pinned;
}

/** Strip `sheet` of its callout styling and say what went. */
export function stripCalloutRules(sheet: RuleContainer): StripCounts {
	const counts: StripCounts = { removed: 0, narrowed: 0, variables: 0 };
	strip(sheet, counts);
	return counts;
}

function strip(container: RuleContainer, counts: StripCounts): void {
	let rules: CSSRuleList;
	try {
		rules = container.cssRules;
	} catch {
		// A sheet from another origin (an `@import`) cannot be read, and so
		// cannot be changed either.
		return;
	}
	// Backwards, so a deletion never moves a rule that is still to come.
	for (let i = rules.length - 1; i >= 0; i--) {
		try {
			const rule = rules[i];
			if (!rule) continue;
			if (registersCalloutVariable(rule)) {
				container.deleteRule(i);
				counts.removed++;
				continue;
			}
			if (isStyleRule(rule)) {
				const original = rule.selectorText;
				const narrowed = withoutCalloutBranches(original);
				if (narrowed === null) {
					container.deleteRule(i);
					counts.removed++;
					continue;
				}
				if (narrowed !== original) {
					rule.selectorText = narrowed;
					if (rule.selectorText === original) {
						container.deleteRule(i);
						counts.removed++;
						continue;
					}
					counts.narrowed++;
				}
			}
			counts.variables += stripVariables(rule);
			const nested = nestedRules(rule);
			if (nested) strip(nested, counts);
			const imported = (rule as CSSRule & { styleSheet?: CSSStyleSheet | null }).styleSheet;
			if (imported) strip(imported, counts);
		} catch {
			/* see the note at the top: one rule never stops the walk */
		}
	}
}

/**
 * The rules nested in `rule` — a group rule (`@media`, `@supports`, `@layer`,
 * `@container`) or a style rule with nesting. Not `@keyframes`: its
 * `deleteRule` takes a keyframe's text, not an index, and a keyframe is no
 * callout's.
 */
function nestedRules(rule: CSSRule): RuleContainer | null {
	const candidate = rule as CSSRule & Partial<RuleContainer> & { appendRule?: unknown };
	if (!candidate.cssRules || typeof candidate.deleteRule !== "function") return null;
	if (typeof candidate.appendRule === "function") return null;
	return candidate as CSSRule & RuleContainer;
}

/** `@property --callout-…`: a theme changing what a variable core reads may hold. */
function registersCalloutVariable(rule: CSSRule): boolean {
	const name = (rule as CSSRule & { name?: unknown }).name;
	return typeof name === "string" && "syntax" in rule && isCalloutVariable(name);
}

function stripVariables(rule: CSSRule): number {
	const style = (rule as CSSRule & { style?: CSSStyleDeclaration }).style;
	if (!style) return 0;
	let removed = 0;
	for (let i = style.length - 1; i >= 0; i--) {
		const name = style.item(i);
		if (!isCalloutVariable(name)) continue;
		style.removeProperty(name);
		removed++;
	}
	return removed;
}
