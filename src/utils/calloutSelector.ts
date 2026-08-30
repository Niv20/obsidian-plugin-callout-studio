/**
 * utils/calloutSelector.ts — the two ways a callout ID becomes a CSS selector,
 * and the escaper both of them owe their safety to.
 *
 * Split out of `CSSInjector` rather than left inline because the escaping rule
 * is the interesting part and it has to hold for *every* builder: fixing only
 * the `.callout[…]` selector would leave the heading bar, the inline pill, the
 * ref token and the fallback `:not()` chain open, and those are the majority of
 * the interpolations. One module means one place to read the rule and one place
 * a new selector builder can be added without re-deriving it.
 *
 * Companion to `calloutId.ts`, which decides what the ID *is*; this decides how
 * that ID may be written into a stylesheet.
 */
import { obsidianCalloutAttrId } from "./calloutId";

/**
 * One callout ID as the *body* of a double-quoted CSS string.
 *
 * A callout ID is not the tame thing the editor's own field produces — two
 * paths put one in front of this without the user typing a character of it:
 *
 * - **Vault discovery.** The scanner's header regex is `\[!([^\]\n\r]+)\]`, so
 *   a note containing `> [!ev"il]` yields the ID `ev"il` and `CalloutDiscovery`
 *   auto-creates a row for it. Opening a shared note is enough.
 * - **Import.** `ID_BAD_CHAR_RE` rejects pipes, brackets and non-space
 *   whitespace, and permits `"` and `\`.
 *
 * Unescaped, a bare `"` closes the attribute selector's string early and CSS
 * error recovery discards that whole rule; a *trailing* `\` escapes the closing
 * quote the selector itself wrote, leaving the string token open so the parser
 * swallows the rules generated after it. Either way a callout the user really
 * did define silently loses its styling, and the second costs its neighbours
 * theirs too.
 *
 * `]` is filtered on both paths, so this is not arbitrary rule injection — the
 * damage is parser corruption, bounded by the generated sheet. Only the two
 * characters that mean anything inside a CSS string need escaping, backslash
 * first or it would double the ones added after it. A raw newline is invalid
 * there as well, and becomes a hex escape rather than being trusted never to
 * arrive.
 *
 * The same job `CSSInjector.generateEmojiOverride` already does for the one
 * string it interpolates; this is the selector half of it.
 */
export const cssAttrValue = (raw: string): string =>
	raw
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/[\n\r\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `);

/**
 * The `.callout[data-callout=…]` selector base for one callout ID, with an
 * optional theme prefix. THE single place this plugin writes that selector.
 *
 * Obsidian dasherizes the ID it writes into that attribute (see
 * obsidianCalloutAttrId), so `> [!multi word callout]` renders as
 * `data-callout="multi-word-callout"` and a space-form selector matches
 * nothing. Normalize first, escape second: the other order would feed the
 * escape's own backslashes through `\s+` collapsing and case folding.
 * Callers append their own `> .callout-title …` tail.
 *
 * Deliberately does NOT cover the heading-bar / inline-pill / ref-token
 * selectors: that DOM is ours and carries the space-preserving normalized ID
 * (see renderShared.buildCalloutTokenDom) — those go through
 * {@link tokenAttrSel}, which escapes the same way.
 */
export const calloutSel = (id: string, themePrefix = ""): string =>
	calloutSelAt(id, 1, themePrefix);

/**
 * {@link calloutSel} at a chosen specificity, by repeating `.callout`.
 *
 * `weight` is the number of `.callout` classes, so the rule lands at
 * `(0, weight + 1, 0)` — one for each class plus the attribute. Weight 1 is
 * the normal selector, which is why `calloutSel` is just an alias: everything
 * not in force mode emits **byte-identical** text to before this existed, and
 * a test asserts exactly that.
 *
 * See `manager/styleMode.ts` for the weight force uses and why repetition beat
 * `:is()` and `:not()`.
 */
export const calloutSelAt = (
	id: string,
	weight: number,
	themePrefix = "",
): string =>
	`${themePrefix}${".callout".repeat(Math.max(1, weight))}` +
	`[data-callout="${cssAttrValue(obsidianCalloutAttrId(id))}"]`;

/**
 * {@link calloutSel} at the LOWEST specificity that still matches only a real
 * callout: `(0,1,0)`, the attribute alone, with the class laundered through
 * `:where()` so it contributes nothing.
 *
 * For rules that must defer to the theme rather than beat it — see
 * `manager/css/coreAccentShim.ts`, which restates core's own declarations and
 * has no business outranking anybody. The `:where(.callout)` is not decoration:
 * without it the attribute would also match this plugin's own heading-bar and
 * inline-pill DOM, which carries `data-callout` too.
 *
 * The one thing this rule still beats is core, and it beats it on source order
 * rather than weight — `adoptedStyleSheets` sort after every `<link>` in the
 * document, and app.css is a `<link>`. That is the same premise the rest of the
 * emitted sheet rests on; see `manager/theme/studioWeight.ts`.
 */
export const calloutSelDeferring = (id: string): string =>
	`:where(.callout)[data-callout="${cssAttrValue(obsidianCalloutAttrId(id))}"]`;

/**
 * The `[data-callout=…]` attribute selector for the plugin's OWN token DOM —
 * heading bars, inline pills, ref tokens — which carries the space-preserving
 * normalized ID rather than Obsidian's dasherized one, so it must not go
 * through `obsidianCalloutAttrId`. It must still be escaped: see
 * {@link cssAttrValue}.
 */
export const tokenAttrSel = (id: string): string =>
	`[data-callout="${cssAttrValue(id)}"]`;
