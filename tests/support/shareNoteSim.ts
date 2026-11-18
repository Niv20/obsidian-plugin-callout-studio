/**
 * tests/support/shareNoteSim.ts — what Share Note does to a note's callouts
 * and stylesheet between Obsidian and a shared page, for the suites that check
 * Callout Studio comes through it (tests/shareNote.test.ts).
 *
 * Ported from Share Note 1.6.2 (https://github.com/alangrainger/share-note,
 * MIT, © Alan Grainger), and kept to its lines rather than to what they mean,
 * so a diff against a newer release shows what moved:
 *
 * - {@link fixCalloutIcons} — `src/pipeline/transforms/fix-callout-icons.ts`
 * - {@link reachesPage} — the `@media print` filter in `src/pipeline/capture.ts`
 * - {@link cssAttachments} — the `url(...)` scan in `src/pipeline/upload-css.ts`
 *
 * Share Note reads a live CSSOM. Here a rule is the harness's parsed
 * `CssRule`, which answers the two things it asks of one: the selector text,
 * and the rule's `--callout-icon`.
 */
import type { CssRule } from "./cssInjectorHarness";
import type { FakeElement } from "./fakeDom";

/** The release these lines were read from. */
export const SHARE_NOTE_VERSION = "1.6.2";

/** `style.getPropertyValue("--callout-icon")`: the value, without `!important`. */
function calloutIconOf(rule: CssRule): string {
	const decl = rule.decls.find((d) => /^--callout-icon\s*:/.test(d));
	return decl
		? decl
				.replace(/^--callout-icon\s*:\s*/, "")
				.replace(/\s*!important\s*$/, "")
				.trim()
		: "";
}

/**
 * Whether a rule reaches the shared page. Share Note uploads every sheet's
 * top-level rules, at-rules whole, less a top-level `@media print`, which it
 * drops so a shared page prints.
 */
export function reachesPage(rule: CssRule): boolean {
	return rule.at[0] !== "@media print";
}

/**
 * The rules {@link fixCalloutIcons} can name an icon from: a rule nested in
 * an at-rule is part of that at-rule's object and has no `selectorText`.
 */
function topLevelRules(rules: readonly CssRule[]): CssRule[] {
	return rules.filter((rule) => rule.at.length === 0);
}

function stripLucidePrefix(value: string): string {
	return value.replace(/^lucide-/, "");
}

function findCalloutIcon(rules: readonly CssRule[], match: (selectorText: string) => boolean): string {
	const rule = rules.find((r) => r.selector && match(r.selector) && calloutIconOf(r));
	return rule ? calloutIconOf(rule) : "";
}

function lucideNameFromClassList(svgEl: FakeElement): string | undefined {
	for (const cls of svgEl.classList.toArray()) {
		if (cls.startsWith("lucide-")) return cls.slice("lucide-".length);
	}
	return undefined;
}

/**
 * Every block callout's first icon `<svg>`, emptied down to a placeholder
 * that names its icon. Share Note's server then draws that name with its own
 * Lucide; a name it does not have leaves the placeholder as it is.
 */
export function fixCalloutIcons(root: FakeElement, cssRules: readonly CssRule[]): void {
	const rules = topLevelRules(cssRules);
	const defaultIcon = stripLucidePrefix(findCalloutIcon(rules, (s) => s === ".callout")) || "pencil";
	for (const el of root.querySelectorAll(".callout")) {
		const iconEl = el.querySelector("div.callout-icon");
		const svgEl = iconEl?.querySelector("svg");
		if (!svgEl) continue;

		const fromSvg = lucideNameFromClassList(svgEl);
		const type = el.getAttribute("data-callout");
		const fromCss = stripLucidePrefix(findCalloutIcon(rules, (s) => s.includes(`data-callout="${type}"`)));
		const icon = fromSvg || fromCss || defaultIcon;

		svgEl.replaceChildren();
		for (const name of svgEl.getAttributeNames()) svgEl.removeAttribute(name);
		// The fake keeps classes apart from attributes; the browser does not.
		svgEl.classList.remove(...svgEl.classList.toArray());
		svgEl.setAttribute("width", "16");
		svgEl.setAttribute("height", "16");
		svgEl.setAttribute("data-share-note-lucide", icon);
	}
}

/** One `url(...)` the upload step finds, and what it would upload, if anything. */
export interface CssAttachment {
	/** What `/url\s*\(.*?\)/g` matched — up to the first `)`. */
	found: string;
	/** The URL inside quotes, when the second pattern accepts `found`; `null` leaves it in place. */
	uploaded: string | null;
}

/** The `url(...)` references the CSS upload walks, in order. */
export function cssAttachments(css: string): CssAttachment[] {
	return (css.match(/url\s*\(.*?\)/g) ?? []).map((found) => {
		const assetMatch = found.match(/url\s*\(\s*"((?:\\.|[^"\\])*)"\s*\)/);
		return { found, uploaded: assetMatch?.[1] ?? null };
	});
}
