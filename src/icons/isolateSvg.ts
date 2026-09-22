/**
 * icons/isolateSvg.ts — Make one imported SVG copy answer only for itself.
 *
 * An SVG that arrives as markup carries two things that are element-scoped
 * inside its own file and *document*-scoped the moment it is imported into the
 * page:
 *
 * - a `<style>` block. Illustrator and Figma colour whole drawings through
 *   `.st0` / `.cls-1` classes, and those rules reach every element in the
 *   document, not only the copy that brought them in. Two copies of one picture
 *   — the same file behind a callout that recolours it and one that does not —
 *   therefore fight: stencilSvg rewrites one copy's rules to `currentColor`,
 *   both blocks are live at once, and at equal specificity the later one in DOM
 *   order wins for *both*. What that looked like was the non-recoloured callout
 *   going flat black in the settings list, the autocomplete menu and the
 *   heading/inline tokens, while the recoloured one kept its uploaded yellows on
 *   exactly the shapes that carry a class. The block callout body was right
 *   the whole time, because that path is a data-URI background image (see
 *   `imageOverrideCSS`) and a data URI is its own document.
 * - `id` attributes. `url(#grad)` resolves against the whole document, so the
 *   second copy of a picture paints itself out of the first copy's gradients.
 *
 * Neither can be fixed where the markup is stored (see icons/svg.ts): the same
 * bytes are legitimately painted many times into one document, so the answer has
 * to be per *copy*. This module tags each copy, fences its CSS behind that tag,
 * and renames its ids along with every reference to them.
 *
 * Artwork the plugin builds itself (packData.buildPackSvg) has neither a
 * `<style>` nor an id, so for every library glyph the whole pass is two
 * `querySelectorAll` calls and a return.
 */

/**
 * The attribute each copy is tagged with, and the hook every scoped rule hangs
 * off.
 *
 * The name is load-bearing in one non-obvious way: stencilSvg runs *after* this
 * module and rewrites paint values inside the same `<style>` text with
 * CSS_PAINT_RE, which looks for `fill`/`stroke`/`stop-color`/`color` immediately
 * before a `:`. Neither this name nor the selector shapes below ever put one of
 * those words in front of a colon, so the stencil pass cannot chew through a
 * selector written here.
 */
const SCOPE_ATTR = "data-cs-svg";

/**
 * Per-copy counter, base 36 so the token stays one or two characters. One
 * module-level counter serves every document the plugin paints into — main
 * window, pop-out, export clone — so two copies can never collide even across
 * realms. Keeping it to `[0-9a-z]` is what lets the selector quote it without
 * escaping anything.
 */
let copies = 0;

/** At-rules whose body is itself a list of style rules, so it has to be walked. */
const GROUP_AT_RULE_RE = /^@(media|supports|container|layer|scope)\b/i;

/** A same-document reference, as it appears in CSS and in attribute values. */
const URL_REF_RE = /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g;

/** An id selector inside a rule's prelude. */
const ID_SELECTOR_RE = /#([A-Za-z_-][\w-]*)/g;

const WHITESPACE_RE = /\s/;

/**
 * Fence one freshly imported copy so nothing it declares can reach a sibling.
 *
 * Mutates in place, and is called from renderIcon's importSvg before any of the
 * colour branches run — so it holds at one chokepoint rather than at each of
 * them, and holds for the baked copies a PDF export puts in one clone too.
 */
export function isolateSvgCopy(root: Element): void {
	const styles = Array.from(root.querySelectorAll("style"));
	const ided = Array.from(root.querySelectorAll("[id]"));
	// querySelectorAll never returns the element it was called on, and the root
	// is exactly where Illustrator puts `id="Layer_1"`.
	if (root.hasAttribute("id")) ided.unshift(root);
	// The overwhelmingly common case: a library glyph, which is a viewBox and a
	// handful of paths. Nothing in it is document-scoped, so it is already
	// self-contained and nothing below would find anything to do.
	if (styles.length === 0 && ided.length === 0) return;

	const token = (copies++).toString(36);
	root.setAttribute(SCOPE_ATTR, token);

	const renames = renameIds(ided, token);
	if (renames.size > 0) retargetReferences(root, renames);
	for (const styleEl of styles) {
		styleEl.textContent = scopeRules(
			// Declarations refer to ids too (`fill:url(#grad)`), and they are the
			// one place the selector pass below deliberately never looks.
			rewriteUrlRefs(styleEl.textContent ?? "", renames),
			`[${SCOPE_ATTR}="${token}"]`,
			renames,
		);
	}
}

/* ------------------------------------------------------------------ *
 * Ids
 * ------------------------------------------------------------------ */

/**
 * Rename every id in this copy, and report what each became.
 *
 * A suffix rather than a prefix, so `Layer_1-3` still reads as the layer it came
 * from in the inspector. Appending one constant is injective, so two ids can
 * never collapse into one. A file that (invalidly) repeats an id gets both
 * occurrences mapped to the same new name — preserving what the file said rather
 * than inventing a difference the artwork was not drawn with.
 */
function renameIds(ided: readonly Element[], token: string): Map<string, string> {
	const renames = new Map<string, string>();
	for (const el of ided) {
		const id = el.getAttribute("id");
		if (id === null || id === "") continue;
		const renamed = renames.get(id) ?? `${id}-${token}`;
		renames.set(id, renamed);
		el.setAttribute("id", renamed);
	}
	return renames;
}

/**
 * Point every same-document reference in this copy at the renamed ids.
 *
 * Attribute names are deliberately not enumerated. A reference can live in
 * `clip-path`, `mask`, `filter`, `fill`, `stroke`, `marker-*` or a `style`
 * attribute, and a value that is not a `url(#…)` is left alone anyway — so
 * scanning them all is both shorter and more complete than a list that would
 * have to be kept in step with the sanitizer's allow-list.
 */
function retargetReferences(
	root: Element,
	renames: ReadonlyMap<string, string>,
): void {
	for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
		// A static array, and only values are written below, so mutating as we go
		// cannot disturb the walk.
		for (const name of el.getAttributeNames()) {
			if (name === "id") continue;
			const value = el.getAttribute(name);
			if (value === null || value === "") continue;
			// `<use href="#shape">`, which is the one reference not written as a
			// url(). The `:href` tail catches the `xlink:` spelling.
			if (
				value.charAt(0) === "#" &&
				(name === "href" || name.endsWith(":href"))
			) {
				const renamed = renames.get(value.slice(1));
				if (renamed !== undefined) el.setAttribute(name, `#${renamed}`);
				continue;
			}
			const rewritten = rewriteUrlRefs(value, renames);
			if (rewritten !== value) el.setAttribute(name, rewritten);
		}
	}
}

/**
 * Repoint the `url(#…)` references in one value.
 *
 * Only names this copy actually defines are rewritten: a reference to something
 * outside the artwork is not ours to redirect, and leaving it alone is the same
 * answer the sanitizer's same-document guard already gives it.
 */
function rewriteUrlRefs(
	value: string,
	renames: ReadonlyMap<string, string>,
): string {
	if (renames.size === 0 || !value.includes("url(")) return value;
	return value.replace(
		URL_REF_RE,
		(whole: string, quote: string, id: string) => {
			const renamed = renames.get(id);
			return renamed === undefined ? whole : `url(${quote}#${renamed}${quote})`;
		},
	);
}

/* ------------------------------------------------------------------ *
 * Fencing the stylesheet
 * ------------------------------------------------------------------ */

/**
 * Rewrite a stylesheet so none of its rules can match outside this copy.
 *
 * Each rule's selector list is wrapped twice:
 *
 *     .st0 { fill:#FBAC02 }
 *     → [data-cs-svg="0"] :is(.st0),[data-cs-svg="0"]:is(.st0){fill:#FBAC02}
 *
 * The descendant form covers the shapes, the compound form covers the root
 * `<svg>` itself — every element in the copy is one or the other, so the new
 * match set is exactly the old one narrowed to this copy.
 *
 * `:is()` rather than pasting the prefix onto each selector, for two reasons.
 * It takes the whole comma list in one go, so nothing has to split a selector
 * list or regex-replace class names (where `.st1` is a prefix of `.st10`). And
 * it is the only form that is *valid* for the root: a type selector has to lead
 * its compound, so `[data-cs-svg="0"]svg` is a parse error where
 * `[data-cs-svg="0"]:is(svg)` is fine — and `svg { … }` inside an SVG's own
 * `<style>` is something Figma emits.
 *
 * Two consequences worth knowing. `:is()` cannot hold a pseudo-element, so a
 * `::before` rule would stop matching — no drawing tool emits one. And every
 * scoped rule gains one attribute selector's specificity, which lifts the
 * artwork's own paint above a theme's blanket `svg path` rule; that is the same
 * intent the `keepsOwnColors` branch already serves with a presentation
 * attribute, and the plugin's own paint is `!important`, so nothing it does is
 * outranked.
 *
 * The scanning below only has to find where a selector *ends*, never what a
 * declaration means, which is why it is a brace scanner rather than the CSSOM:
 * re-serializing through a real stylesheet silently drops every property the
 * engine does not recognise, and `enable-background` is sitting in the very file
 * that prompted this.
 */
function scopeRules(
	css: string,
	prefix: string,
	renames: ReadonlyMap<string, string>,
): string {
	const out: string[] = [];
	let i = 0;
	while (i < css.length) {
		const start = findRuleStart(css, i);
		if (start < 0) break;
		const preludeEnd = findPreludeEnd(css, start);
		// Trailing text with no block at all. It declares nothing and so can
		// leak nothing; dropping it is the whole of the handling it needs.
		if (preludeEnd < 0) break;
		const prelude = css.slice(start, preludeEnd).trim();

		if (css.charAt(preludeEnd) === ";") {
			i = preludeEnd + 1;
			// `@charset`, `@namespace`, `@layer a;`. `@import` cannot arrive —
			// svg.ts drops any `<style>` containing one — and is refused here as
			// well rather than being the one statement that could reach the
			// network from inside a picture.
			if (prelude !== "" && !/^@import\b/i.test(prelude)) {
				out.push(`${prelude};`);
			}
			continue;
		}

		const blockEnd = findBlockEnd(css, preludeEnd);
		const body = css.slice(preludeEnd + 1, blockEnd);
		i = blockEnd + 1;
		if (prelude === "") continue;

		if (prelude.charAt(0) === "@") {
			out.push(
				GROUP_AT_RULE_RE.test(prelude)
					? // The body is another rule list, and the recursion handles it
						// nested to any depth.
						`${prelude}{${scopeRules(body, prefix, renames)}}`
					: // `@keyframes`, `@font-face`, `@page`. A keyframe's `from` or
						// `50%` is not a selector, and fencing it would break the
						// animation rather than scope it.
						`${prelude}{${body}}`,
			);
			continue;
		}

		const selectors = rewriteIdSelectors(prelude, renames);
		out.push(`${prefix} :is(${selectors}),${prefix}:is(${selectors}){${body}}`);
	}
	return out.join("");
}

/**
 * Where the next rule begins, or -1 once only whitespace is left.
 *
 * Comments are stepped over and stray closers are swallowed, so a malformed
 * sheet resynchronises on the next real rule instead of fencing junk.
 */
function findRuleStart(css: string, from: number): number {
	let i = from;
	while (i < css.length) {
		const ch = css.charAt(i);
		if (ch === "}" || ch === ";") {
			i++;
			continue;
		}
		if (ch === "/" && css.charAt(i + 1) === "*") {
			i += atomicLength(css, i);
			continue;
		}
		if (!WHITESPACE_RE.test(ch)) return i;
		i++;
	}
	return -1;
}

/**
 * The `{` that opens this rule's block, or the `;` that ends it as a statement.
 * Returns -1 when neither is left.
 *
 * Parens and brackets are counted so a `;` inside `@media (min-width:1px)` or a
 * `[title=";"]` attribute selector does not end the prelude early.
 */
function findPreludeEnd(css: string, from: number): number {
	let depth = 0;
	let i = from;
	while (i < css.length) {
		const atomic = atomicLength(css, i);
		if (atomic > 0) {
			i += atomic;
			continue;
		}
		const ch = css.charAt(i);
		if (ch === "(" || ch === "[") depth++;
		else if (ch === ")" || ch === "]") {
			if (depth > 0) depth--;
		} else if (depth === 0 && (ch === "{" || ch === ";")) return i;
		i++;
	}
	return -1;
}

/**
 * The `}` matching the `{` at `open`, or the end of the string.
 *
 * Clamping is deliberate: an unterminated block is closed by us, so the rule
 * still lands inside the fence. Passing it through untouched would let the
 * engine auto-close it at document level — which is the very bug this module
 * exists to stop, reintroduced by a truncated file.
 */
function findBlockEnd(css: string, open: number): number {
	let depth = 0;
	let i = open;
	while (i < css.length) {
		const atomic = atomicLength(css, i);
		if (atomic > 0) {
			i += atomic;
			continue;
		}
		const ch = css.charAt(i);
		if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) return i;
		}
		i++;
	}
	return css.length;
}

/**
 * How many characters the string or comment starting at `i` occupies, or 0 when
 * neither starts there.
 *
 * Both have to be stepped over whole: a `{` inside a comment or a quoted
 * attribute value does not open a block, and every scanner above would
 * miscount without this. An unterminated one runs to the end of the sheet,
 * which is what the CSS parser does with it too.
 */
function atomicLength(css: string, i: number): number {
	const ch = css.charAt(i);
	if (ch === '"' || ch === "'") {
		let j = i + 1;
		while (j < css.length) {
			const c = css.charAt(j);
			if (c === "\\") {
				j += 2;
				continue;
			}
			if (c === ch) return j - i + 1;
			j++;
		}
		return css.length - i;
	}
	if (ch === "/" && css.charAt(i + 1) === "*") {
		const end = css.indexOf("*/", i + 2);
		return end < 0 ? css.length - i : end + 2 - i;
	}
	return 0;
}

/**
 * Repoint the id selectors in one prelude at the renamed ids.
 *
 * Confined to the prelude on purpose. A declaration block is full of `#` that
 * are hex colours (`fill:#FBAC02`), and the one thing that reliably keeps them
 * safe is never looking at them — combined with only rewriting names this copy
 * defines, an id that spells a colour cannot be confused for one.
 *
 * An id needing CSS escaping (`#\32 a`) is not matched, so a rule addressing one
 * stops applying to the copy. No drawing tool emits those.
 */
function rewriteIdSelectors(
	prelude: string,
	renames: ReadonlyMap<string, string>,
): string {
	if (renames.size === 0 || !prelude.includes("#")) return prelude;
	return prelude.replace(ID_SELECTOR_RE, (whole: string, id: string) => {
		const renamed = renames.get(id);
		return renamed === undefined ? whole : `#${renamed}`;
	});
}
