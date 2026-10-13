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

/**
 * A condition on the page root that moves without any event this plugin hears:
 * `:has()` follows the whole document, the user-action pseudo-classes follow
 * the pointer and focus. A class on `<body>` is different - the theme sync
 * watches those (`watchPageClasses`) - so only these are left unjudged.
 */
const UNSTABLE_ROOT_STATE =
	/:(?:has|hover|focus|focus-within|focus-visible|active|target|target-within|fullscreen|modal|popover-open|picture-in-picture|playing|paused)(?![\w-])/i;

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
 * selector it cannot parse counts as a match, and so does a condition that
 * moves without an event (`:has()`, `:hover`): an unreadable or unstable
 * condition never takes a callout away from a theme. A class on `<body>`
 * moves without one too, but the theme sync watches those.
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
			if (root === null || UNSTABLE_ROOT_STATE.test(compound)) return false;
			try {
				return !matches(compound, root);
			} catch {
				return false;
			}
		}),
	);
}

/** Scan `sel`, calling `visit` at every index outside a string or a bracket. */
function eachPlainIndex(sel: string, visit: (i: number) => number | void): void {
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
		if (ch === "\\") {
			i += 2;
			continue;
		}
		const next = visit(i);
		i = typeof next === "number" ? next : i + 1;
	}
}

const PSEUDO_ELEMENT = /^(?:::[\w-]+(?:\([^)]*\))?|:(?:before|after|first-line|first-letter)(?![\w-]))/i;

/**
 * The selector with its pseudo-elements taken out, so `Element.matches` can be
 * asked about the element they hang off: `.callout[data-callout="x"]
 * .callout-title::before` matches the title. Pseudo-*classes* stay - a
 * `:hover` the measurement cannot see is exactly the doubt this is used to
 * find.
 */
export function stripPseudoElements(selector: string): string {
	let out = "";
	let last = 0;
	eachPlainIndex(selector, (i) => {
		if (selector[i] !== ":") return;
		const m = PSEUDO_ELEMENT.exec(selector.slice(i));
		if (!m) return;
		out += selector.slice(last, i);
		last = i + m[0].length;
		return last;
	});
	return out + selector.slice(last);
}

/**
 * A nested rule's selector made whole against its parent's, the way CSS
 * nesting reads it: every `&` is the parent (`:is(parent)`), and a branch with
 * no `&` is a descendant of it (relative ones such as `> .x` included).
 */
export function resolveNested(child: string, parent: string): string {
	const parentIs = `:is(${parent})`;
	return splitSelectorList(child)
		.map((branch) => branch.trim())
		.filter((branch) => branch.length > 0)
		.map((branch) => {
			let out = "";
			let last = 0;
			let found = false;
			eachPlainIndex(branch, (i) => {
				if (branch[i] !== "&") return;
				found = true;
				out += branch.slice(last, i) + parentIs;
				last = i + 1;
			});
			return found ? out + branch.slice(last) : `${parentIs} ${branch}`;
		})
		.join(", ");
}

const CLASS_TOKEN = /^\.((?:[\w-]|[\u0080-\uffff]|\\[\s\S])+)/;

/**
 * The class names a selector requires outright. Nothing inside a functional
 * pseudo-class counts: `:not()` excludes, and `:is()`, `:where()`, `:has()`
 * and their kin offer alternatives or look elsewhere -
 * `body:is(.theme-light, .theme-dark)` requires neither mode, and reading both
 * as required made such a rule look switched off in every mode.
 */
export function classesIn(selector: string): Set<string> {
	const out = new Set<string>();
	eachPlainIndex(selector, (i) => {
		const ch = selector[i];
		if (ch === "(") return matchParen(selector, i) + 1;
		if (ch !== ".") return;
		const m = CLASS_TOKEN.exec(selector.slice(i));
		if (!m) return;
		out.add(unescapeCss(m[1] ?? ""));
		return i + m[0].length;
	});
	return out;
}

/**
 * True when every selector in the list requires a class `isOff` says is a
 * theme option that is switched off - a Style Settings class the page does not
 * carry. A bare `.my-option .callout[…]` cannot be told from a note's
 * `cssclasses` by its text alone; the theme's own `@settings` block is what
 * says it is an option.
 */
export function optionGated(selector: string, isOff: (cls: string) => boolean): boolean {
	const list = splitSelectorList(selector).filter((part) => part.trim().length > 0);
	if (list.length === 0) return false;
	return list.every((complex) => [...classesIn(complex)].some(isOff));
}

/** One `key: value` of a Style Settings item, quotes dropped. */
function settingValue(line: string, key: string): string | null {
	const m = new RegExp(`^\\s*(?:-\\s+)?${key}\\s*:\\s*["']?([^"'#\\s][^"'#]*?)["']?\\s*$`).exec(line);
	return m?.[1]?.trim() ?? null;
}

/**
 * The class names a theme's Style Settings block can put on `<body>`: the
 * `id` of every `class-toggle`, and every option of a `class-select` (a bare
 * list item or an item's `value:`), read from each `/* @settings … *\/`
 * comment. Nothing else - a heading's or a variable's `id`, or the block's
 * own, is not a class Style Settings ever sets, and a heading named `callout`
 * would otherwise make every rule needing `.callout` look like an option.
 */
export function styleSettingsClasses(css: string): Set<string> {
	const out = new Set<string>();
	const block = /\/\*\s*@settings\b([\s\S]*?)\*\//g;
	let m: RegExpExecArray | null;
	while ((m = block.exec(css)) !== null) {
		// Tabs expanded, as Style Settings itself does before it reads the YAML:
		// ITS writes some items with four spaces and the next with a tab.
		const lines = (m[1] ?? "").split(/\r?\n/).map((line) => line.replace(/\t/g, "    "));
		const start = lines.findIndex((line) => /^\s*settings\s*:\s*$/.test(line));
		if (start < 0) continue;
		// Items are the list entries at the first indentation under `settings:`.
		let indent = -1;
		const items: string[][] = [];
		for (const line of lines.slice(start + 1)) {
			const dash = /^(\s*)-(?:\s|$)/.exec(line);
			if (dash && (indent < 0 || (dash[1] ?? "").length <= indent)) {
				indent = (dash[1] ?? "").length;
				items.push([line]);
			} else if (items.length > 0) {
				items[items.length - 1]?.push(line);
			}
		}
		for (const item of items) {
			const id = item.map((line) => settingValue(line, "id")).find((v) => v !== null) ?? null;
			const type = item.map((line) => settingValue(line, "type")).find((v) => v !== null) ?? null;
			if (type === "class-toggle" && id) out.add(id);
			if (type !== "class-select") continue;
			const from = item.findIndex((line) => /^\s*(?:-\s+)?options\s*:/.test(line));
			if (from < 0) continue;
			for (const line of item.slice(from + 1)) {
				const value = settingValue(line, "value") ?? /^\s*-\s+["']?([A-Za-z_][\w-]*)["']?\s*$/.exec(line)?.[1] ?? null;
				if (value && /^[A-Za-z_][\w-]*$/.test(value)) out.add(value);
			}
		}
	}
	return out;
}
