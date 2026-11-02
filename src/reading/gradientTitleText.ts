/**
 * reading/gradientTitleText.ts — Per-grapheme gradient title colors for PDF
 * export.
 *
 * Chromium's print engine does not support `-webkit-background-clip: text`,
 * the technique every CSS text-gradient is built on: in an exported PDF the
 * sweep paints as an unclipped block over the title (with the transparent
 * text fill making it worse), and there is no way to make the technique
 * itself print. So print gets an approximation made of plain colored text —
 * which prints perfectly: every grapheme of a swept title is wrapped in a
 * `<span class="cs-grad-ch">` carrying its own solid color, sampled along
 * the gradient into an inline `--cs-gch` custom property.
 *
 * On screen the spans are inert — they carry no styling of their own, and
 * the ancestor's real sweep clips through descendant glyphs unchanged. A
 * print-only rule in styles.css then switches each glyph's fill from the
 * sweep's transparent to its sampled color, so the exported title shows a
 * smooth per-character ramp instead of garbage.
 *
 * Colors are sampled by grapheme index, not measured geometry, so they are
 * layout-independent and survive the not-yet-laid-out DOM Obsidian's PDF
 * export renders into. For RTL titles the ramp is flipped: CSS gradient
 * angles are physical (every preset direction runs left→right), while an
 * RTL title's first logical character sits on the right.
 */
import type { CalloutDefinition } from "../types";
import { CSS_INLINE_TOKEN, CSS_TOKEN_ICON } from "../editor/renderShared";
import { blendHex } from "../utils/colorUtils";

/** Wrapper class for one swept grapheme; styled only by the print rule. */
export const CSS_GRAD_CHAR = "cs-grad-ch";
/** Inline custom property carrying the grapheme's sampled print color. */
const GRAD_CHAR_PROP = "--cs-gch";

/** Strong RTL characters (Hebrew, Arabic + presentation forms, Syriac…). */
const RTL_CHAR = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
/** Strong LTR characters (Latin, Greek, Cyrillic settle the direction). */
const LTR_CHAR = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

/** First strong-directional character decides the title's ramp direction. */
function isRtlText(text: string): boolean {
	for (const c of text) {
		if (RTL_CHAR.test(c)) return true;
		if (LTR_CHAR.test(c)) return false;
	}
	return false;
}

/** Splits into grapheme clusters so emoji/combining marks stay whole. */
function graphemes(text: string): string[] {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		const segmenter = new Intl.Segmenter(undefined, {
			granularity: "grapheme",
		});
		return Array.from(segmenter.segment(text), (s) => s.segment);
	}
	// Code points (never splits surrogate pairs) as the fallback.
	return Array.from(text);
}

/**
 * True when `node` sits inside a nested inline callout or icon box *within*
 * `root` — those glyphs are excluded from the sweep (a nested pill inside a
 * swept heading title has a sweep and colors of its own; icons stay solid),
 * so they must not receive this root's print colors either.
 */
function inNestedToken(node: Node, root: HTMLElement): boolean {
	let el = node.parentElement;
	while (el && el !== root) {
		if (el.classList.contains(CSS_INLINE_TOKEN) || el.classList.contains(CSS_TOKEN_ICON)) {
			return true;
		}
		el = el.parentElement;
	}
	return false;
}

/** Wraps every own (non-nested-token) text node's graphemes; idempotent. */
function wrapChars(root: HTMLElement): void {
	const doc = root.ownerDocument;
	const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const pending: Text[] = [];
	let node: Node | null;
	while ((node = walker.nextNode())) {
		const parent = node.parentElement;
		if (!parent) continue;
		if (parent.classList.contains(CSS_GRAD_CHAR)) continue;
		if (inNestedToken(node, root)) continue;
		if ((node.nodeValue ?? "").length === 0) continue;
		pending.push(node as Text);
	}
	// Mutate after the walk — replacing nodes mid-walk derails TreeWalker.
	for (const textNode of pending) {
		const frag = createFragment();
		for (const grapheme of graphemes(textNode.nodeValue ?? "")) {
			const span = createSpan();
			span.className = CSS_GRAD_CHAR;
			span.textContent = grapheme;
			frag.appendChild(span);
		}
		textNode.replaceWith(frag);
	}
}

/** The root's own char spans, excluding any inside a nested pill. */
function ownSpans(root: HTMLElement): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(`.${CSS_GRAD_CHAR}`)).filter(
		(span) => !inNestedToken(span, root),
	);
}

/**
 * Wraps `el`'s title text and colors each grapheme along the `from` → `to`
 * sweep (re-wrapping whatever a name rewrite stripped). A single grapheme
 * takes the midpoint rather than a bare start color.
 */
export function paintGradientChars(el: HTMLElement, from: string, to: string): void {
	wrapChars(el);
	const spans = ownSpans(el);
	const n = spans.length;
	if (n === 0) return;
	const rtl = isRtlText(el.textContent ?? "");
	spans.forEach((span, i) => {
		const fraction = n === 1 ? 0.5 : i / (n - 1);
		span.style.setProperty(GRAD_CHAR_PROP, blendHex(from, to, rtl ? 1 - fraction : fraction));
	});
}

/**
 * Wraps and colors `el`'s title for a def whose text sweep is on, or clears
 * any stale spans when it is off. The single decision point both render
 * surfaces share (reading post-processor at DOM-build time; CSSInjector's
 * paint sweep on inject), so the per-grapheme print colors always match the
 * `background-clip: text` sweep the CSS draws on screen — including its
 * cascade: a dark end color only exists when the palette set one, otherwise
 * dark mode reuses the light pair. The colors are baked for whichever theme
 * the document is currently in, the same "current theme wins" compromise the
 * baked material/emoji export icons make.
 */
export function applyTitleGradient(el: HTMLElement, def: CalloutDefinition): void {
	const g = def.bgGradient;
	if (!g?.textGradient || !g.textToColorLight) {
		clearGradientChars(el);
		return;
	}
	const isDark = el.ownerDocument.body?.classList.contains("theme-dark") ?? false;
	const to = (isDark ? g.textToColorDark : undefined) ?? g.textToColorLight;
	const from = isDark && g.textToColorDark ? def.colorDark : def.colorLight;
	paintGradientChars(el, from, to);
}

/**
 * Removes the wrapping (and its inline colors) when the def's sweep is off:
 * stale colored spans would otherwise still print a gradient the screen no
 * longer shows. Spans of a nested pill are left for that pill's own pass.
 */
export function clearGradientChars(el: HTMLElement): void {
	const spans = ownSpans(el);
	if (spans.length === 0) return;
	for (const span of spans) {
		span.replaceWith(...Array.from(span.childNodes));
	}
	el.normalize();
}
