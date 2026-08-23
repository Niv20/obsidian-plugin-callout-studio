/**
 * ui/inlineLinkHint.ts — one sentence of hint text with a single link inside it.
 *
 * The sentence comes from a locale string carrying a literal `{{link}}` token,
 * and the link is rendered in the token's place rather than concatenated onto
 * either end. That is what lets a translation put the link anywhere in the
 * sentence: word order differs between languages, and an RTL locale in
 * particular cannot take a hardcoded "text, then link".
 *
 * The link is a real `<button>`, never an `<a>`. These hints open a modal or
 * flip a view — they navigate nowhere, so there is no href to give an anchor,
 * and a button already carries the focus ring, the Enter/Space activation and
 * the screen-reader role that an anchor would otherwise have to fake with
 * `role="button"` plus `tabindex` plus a keydown handler.
 *
 * Styling lives in `styles.css` under `.cs-inline-hint .cs-link-btn` (and the
 * `.cs-link-btn-inline` override that keeps it on the same line), scoped to
 * this function's own wrapper div rather than `.setting-item` so the hint
 * still gets the low-emphasis look when rendered outside a Setting — see
 * PaletteEditorModal.renderColorError.
 */
import { t } from "../i18n";

export interface InlineLinkHintOptions {
	/** Locale key whose string contains a literal `{{link}}` token. */
	textKey: string;
	/** Locale key for the link's own label. */
	linkKey: string;
	/** Interpolation vars for `textKey` — e.g. a `{{count}}`. */
	vars?: Record<string, string | number>;
	/** Extra class on the wrapper, for callers needing their own spacing. */
	cls?: string;
	onClick: () => void;
}

/**
 * Renders the hint into `parent` and returns the wrapper element.
 *
 * A `textKey` whose translation has lost the `{{link}}` token still renders the
 * sentence with the link after it, rather than dropping the only way out of
 * whatever state the hint is explaining.
 */
export function renderInlineLinkHint(
	parent: HTMLElement,
	options: InlineLinkHintOptions,
): HTMLElement {
	const { textKey, linkKey, vars, cls, onClick } = options;
	const [before, after] = t(textKey, vars).split("{{link}}");
	const line = parent.createDiv({
		cls: cls ? `cs-inline-hint ${cls}` : "cs-inline-hint",
	});
	if (before) line.createSpan({ text: before });
	const link = line.createEl("button", {
		cls: "cs-link-btn cs-link-btn-inline",
		text: t(linkKey),
	});
	link.addEventListener("click", (e) => {
		e.preventDefault();
		onClick();
	});
	if (after) line.createSpan({ text: after });
	return line;
}
