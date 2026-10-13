/**
 * manager/theme/themeClaimSelectors.ts — the selector text the live claim
 * check reads and rewrites.
 *
 * The text scan (`themeCalloutScan.ts`) decides which ids a theme names. The
 * claim check (`ThemeClaimCheck.ts`) then asks the browser's own copy of the
 * theme whether those rules do anything right now, and it needs three answers
 * from a rule's `selectorText`: which ids it names, the same selector with one
 * of those ids switched off, and whether a `body`/`html` condition in it fails
 * on the page as it is. Pure text, so all three are unit-tested; the DOM half
 * only applies them.
 *
 * A name is read exactly as the scan reads one — `=` or `~=`, outside
 * `:not()`, in Obsidian's attribute form, and only a value a rendered callout
 * can carry — so the check can never weigh an id the scan did not hand it.
 */
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import {
	blankNegations,
	matchParen,
	skipBrackets,
	skipString,
	splitSelectorList,
} from "../../utils/selectorText";
import { namesRenderedId } from "./themeCalloutScan";

/** One exact `[data-callout=…]` / `[data-callout~=…]`, the whole bracket. */
const EXACT_ATTR =
	/^\[\s*data-callout\s*~?=\s*(?:"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'|([^\]\s]+))\s*(?:([iIsS])\s*)?\]$/;

/**
 * What a switched-off name becomes. Obsidian dasherizes whitespace before it
 * writes `data-callout`, so no rendered callout can carry a value with a space.
 */
const NO_CALLOUT = '[data-callout="cs no callout"]';

/** CSS string and identifier escapes, read back to the characters they stand for. */
function unescapeCss(value: string): string {
	return value.replace(/\\([0-9a-fA-F]{1,6}[ \t\n]?|[\s\S])/g, (_m, esc: string) => {
		if (!/^[0-9a-fA-F]/.test(esc)) return esc;
		const code = Number.parseInt(esc.trim(), 16);
		return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "�";
	});
}

/** The attribute-form id an exact bracket names, or `null`. */
function namedBy(bracket: string): string | null {
	const m = EXACT_ATTR.exec(bracket);
	if (!m) return null;
	const raw = m[1] ?? m[2] ?? m[3] ?? "";
	const value = unescapeCss(raw);
	if (value.length === 0 || !namesRenderedId(value, m[4])) return null;
	return obsidianCalloutAttrId(value);
}

/** Every exact bracket outside `:not()`, with where it sits. */
function namingBrackets(selector: string): Array<{ start: number; end: number; id: string }> {
	// Blanking keeps offsets, so a position found here is a position in `selector`.
	const visible = blankNegations(selector);
	const out: Array<{ start: number; end: number; id: string }> = [];
	let i = 0;
	while (i < visible.length) {
		const ch = visible[i];
		if (ch === '"' || ch === "'") {
			i = skipString(visible, i);
			continue;
		}
		if (ch === "[") {
			const end = skipBrackets(visible, i);
			const id = namedBy(visible.slice(i, end));
			if (id !== null) out.push({ start: i, end, id });
			i = end;
			continue;
		}
		i++;
	}
	return out;
}

/** The callout ids a selector names, in attribute form. */
export function namesInSelector(selector: string): Set<string> {
	return new Set(namingBrackets(selector).map(({ id }) => id));
}

/** The same selector with every name of `attrId` replaced by one no callout carries. */
export function withoutName(selector: string, attrId: string): string {
	let out = selector;
	for (const { start, end, id } of namingBrackets(selector).reverse()) {
		if (id === attrId) out = out.slice(0, start) + NO_CALLOUT + out.slice(end);
	}
	return out;
}

/** The compounds of one complex selector, combinators dropped. */
function compoundsOf(complex: string): string[] {
	const sel = complex.trim();
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
		if (ch === "\\") {
			i += 2;
			continue;
		}
		if (/[\s>+~]/.test(ch)) {
			if (i > start) out.push(sel.slice(start, i));
			start = i + 1;
		}
		i++;
	}
	if (start < sel.length) out.push(sel.slice(start));
	return out;
}

/** Which page-wide element a compound has to be, if it names one. */
export type PageRoot = "body" | "html";

function pageRootOf(compound: string): PageRoot | null {
	if (/^body(?![\w-])/i.test(compound)) return "body";
	if (/^(?:html(?![\w-])|:root(?![\w-]))/i.test(compound)) return "html";
	return null;
}

/**
 * True when every selector in the list asks `<body>` or `<html>` for
 * something the page does not have right now.
 *
 * Retroma wraps all 312 of its callout types in
 * `body.rtm-ss-retro-callout { … }`, a theme option that is off until the user
 * turns it on; while it is off, none of them is drawn by the theme. Only a
 * compound that *is* the page root is asked — a bare class such as
 * `.aura-callouts` may sit on `<body>` or on the note, and only the note can
 * say which, so it is never held against a rule. `matches` throwing on a
 * selector it cannot parse counts as a match: an unreadable condition never
 * takes a callout away from a theme.
 */
export function pageRootFails(
	selector: string,
	matches: (compound: string, root: PageRoot) => boolean,
): boolean {
	const list = splitSelectorList(selector).filter((part) => part.trim().length > 0);
	if (list.length === 0) return false;
	return list.every((complex) =>
		compoundsOf(complex).some((compound) => {
			const root = pageRootOf(compound);
			if (root === null) return false;
			try {
				return !matches(compound, root);
			} catch {
				return false;
			}
		}),
	);
}
