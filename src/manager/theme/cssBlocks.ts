/**
 * manager/theme/cssBlocks.ts — walking a stylesheet's rule blocks, with native
 * CSS nesting flattened back out.
 *
 * Split out of `themeCalloutScan.ts`, which reads callout claims out of what
 * this hands it, and `themeReport.ts`, which counts facts about the same
 * blocks. The rule both of them depend on is that **a nested stylesheet must
 * read exactly as its flat equivalent would**: same ids, same property names,
 * same specificity. Nesting is a choice about source formatting, and the
 * browser resolves it away before anything the plugin cares about happens.
 *
 * ## What the flat-only walker got wrong
 *
 * It treated *any* body containing a `{` as a wrapper and descended into it, so
 * a rule that both declares something and nests a child rule lost its own
 * prelude and its own declarations:
 *
 * ```css
 * .callout[data-callout="todo"] {
 *     background: red !important;   ← never seen: the parent was not visited
 *     a { color: white; }           ← seen, but as the bare selector `a`
 * }
 * ```
 *
 * Measured across the 257 themes installed in the development vault, seven
 * write callout rules that way — and **Minimal Dracula writes all of them that
 * way**, so the plugin read that theme as having no callout rules at all: none
 * of its ids were listed under *Callouts from your theme*, every one of its
 * callouts was treated as Callout Studio's to paint, and the `!important`
 * escalation was sized against a sheet that had come back empty.
 *
 * ## The two halves of the fix
 *
 * **Declarations are separated from the nested rules among them.** A body is
 * now a mixture of both, in any order (CSS allows declarations after a nested
 * rule), so the walker cuts each stretch of text at the last top-level `;` —
 * everything up to it is the parent's, everything after it is the next rule's
 * selector.
 *
 * **A nested selector is resolved against its parent**, so `.callout-content`
 * inside `.callout[data-callout="todo"]` is announced as
 * `.callout[data-callout="todo"] .callout-content`. That is the half the
 * specificity arithmetic needs: a nested `!important` declaration counts
 * against `studioWeightFor` at the weight the browser gives it, not at the
 * weight of the fragment the theme author happened to type.
 *
 * Both halves are the same claim: read it as if it were written flat.
 */
import {
	matchParen,
	skipBrackets,
	skipString,
	splitSelectorList,
} from "../../utils/selectorText";

/** What {@link eachBlock} is handed for each style rule it finds. */
export type BlockVisitor = (prelude: string, body: string) => void;

/**
 * Strip CSS comments. Not string-aware, and does not need to be: comment
 * punctuation inside a CSS string literal is legal but vanishingly rare, and
 * the cost of getting it wrong is one missed claim rather than a wrong one.
 */
export function stripComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Visit every style rule in `text`, one call per rule, with nesting resolved.
 *
 * `prelude` is the rule's selector — for a nested rule, the selector it stands
 * for once `&` is worked out. `body` is that rule's **own** declarations, with
 * any rules nested inside it removed and announced separately.
 *
 * Rules arrive in post-order: a parent is announced after its children, because
 * its own declarations are not complete until the whole body has been walked
 * (they may sit on either side of a nested rule). Nothing downstream depends on
 * the order — every consumer takes a maximum or a union.
 *
 * Callers strip comments first; this does not do it for them, because
 * `themeReport` reads the `@settings` block out of the raw text.
 */
export function eachBlock(text: string, visit: BlockVisitor): void {
	walkBody(text, null, visit);
}

/**
 * Walk one rule list — the whole sheet when `parent` is null, otherwise the
 * body of the rule `parent` selects for.
 *
 * Returns the declaration text belonging to `parent`, which is everything at
 * this level that was not part of a nested rule. The caller is what knows what
 * to do with that: a style rule announces it, the sheet's top level throws it
 * away, and a conditional at-rule hands it further up (see {@link visitRule}).
 */
function walkBody(
	text: string,
	parent: string | null,
	visit: BlockVisitor,
): string {
	let cursor = 0;
	let own = "";
	while (cursor < text.length) {
		const open = text.indexOf("{", cursor);
		if (open < 0) break;
		const close = closingBrace(text, open);
		if (close < 0) break;
		// Everything since the last block is a run of declarations followed by
		// the next rule's selector. A selector cannot contain a top-level `;`
		// — `[data-callout=tl;dr]`, which several themes ship, is inside
		// brackets and skipped — so the last one is the boundary.
		const between = text.slice(cursor, open);
		const cut = declarationsEnd(between);
		own += between.slice(0, cut);
		own += visitRule(
			between.slice(cut),
			text.slice(open + 1, close),
			parent,
			visit,
		);
		cursor = close + 1;
	}
	return own + text.slice(cursor);
}

/**
 * Announce one block, and return whatever of it belonged to `parent`.
 *
 * An at-rule is a wrapper rather than a selector: `@media print { … }` changes
 * *when* its contents apply, never *what* they apply to. So its body continues
 * in the same nesting context — a rule inside it still resolves against
 * `parent`, and bare declarations inside it are `parent`'s, which is exactly
 * what a nested `@media` inside a style rule means. At the top level that
 * return value is discarded, which is what keeps `@font-face`'s declarations
 * from being mistaken for anybody's.
 */
function visitRule(
	prelude: string,
	body: string,
	parent: string | null,
	visit: BlockVisitor,
): string {
	if (prelude.trim().startsWith("@")) return walkBody(body, parent, visit);
	const selector = parent === null ? prelude : resolveNested(parent, prelude);
	visit(selector, walkBody(body, selector, visit));
	return "";
}

/** Index just past the `}` closing the `{` at `open`, or -1 when unclosed. */
function closingBrace(text: string, open: number): number {
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		const ch = text[i];
		if (ch === "{") depth++;
		else if (ch === "}" && --depth === 0) return i;
	}
	return -1;
}

/**
 * Index just past the last top-level `;` in `text`, or 0 when there is none.
 *
 * Strings, brackets and parens are skipped, so `content: ";"`,
 * `[data-callout=tl;dr]` and `url(a;b)` do not move the boundary.
 */
function declarationsEnd(text: string): number {
	let end = 0;
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === '"' || ch === "'") {
			i = skipString(text, i);
			continue;
		}
		if (ch === "[") {
			i = skipBrackets(text, i);
			continue;
		}
		if (ch === "(") {
			i = matchParen(text, i) + 1;
			continue;
		}
		if (ch === ";") end = i + 1;
		i++;
	}
	return end;
}

/** The nested selector list `prelude` written out against `parent`. */
function resolveNested(parent: string, prelude: string): string {
	const base = ampersandText(parent);
	return splitSelectorList(prelude)
		.map((part) => substituteAmpersand(part.trim(), base))
		.filter((part) => part.length > 0)
		.join(", ");
}

/**
 * The text `&` stands for.
 *
 * CSS Nesting defines it as `:is(<parent selector list>)`. For a parent that is
 * a single selector that is the same thing as the parent written out — same
 * matches, and the same specificity, since `:is()` takes its one argument's —
 * so the wrapper is added only when the parent really is a list, where
 * substituting `.a, .b` raw into `& .c` would produce the nonsense
 * `.a, .b .c`.
 */
function ampersandText(parent: string): string {
	const trimmed = parent.trim();
	return splitSelectorList(trimmed).length > 1 ? `:is(${trimmed})` : trimmed;
}

/**
 * One nested selector with `&` replaced by `base`, or — when it has no `&` at
 * all — `base` prepended as the descendant the spec implies. That covers the
 * leading-combinator form too: `> .c` becomes `base > .c`.
 *
 * Parens are deliberately *not* skipped, because `:is(&)` and `:not(&)` are
 * real spellings and the `&` inside them means the same thing. Strings and
 * brackets are, so an `&` inside `[title="a&b"]` is left alone.
 */
function substituteAmpersand(part: string, base: string): string {
	if (part.length === 0) return "";
	let out = "";
	let last = 0;
	let i = 0;
	let found = false;
	while (i < part.length) {
		const ch = part[i];
		if (ch === '"' || ch === "'") {
			i = skipString(part, i);
			continue;
		}
		if (ch === "[") {
			i = skipBrackets(part, i);
			continue;
		}
		if (ch === "&") {
			out += part.slice(last, i) + base;
			last = i + 1;
			found = true;
		}
		i++;
	}
	return found ? out + part.slice(last) : `${base} ${part}`;
}
