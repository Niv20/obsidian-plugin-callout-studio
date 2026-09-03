/**
 * icons/svgSafety.ts — what is unsafe in any SVG, regardless of where it came
 * from.
 *
 * Separate from `svg.ts`, which holds the two *sanitizers* and their two
 * different threat models, because this one question has three askers now and
 * none of them is about artwork provenance: Material's fetched files, and — via
 * `manager/css/coreIcon.ts` — a theme's `--callout-icon: '<svg …>'` and the
 * artwork read back off a callout the theme already drew.
 *
 * A deny-list is the right shape here precisely because it is shared: it says
 * "never this", which is true of every input. The allow-list in `svg.ts` says
 * "only this", which is a judgement about one source and does not travel.
 */

const DANGEROUS_TAGS = new Set([
	"script",
	"iframe",
	"object",
	"embed",
	"applet",
	"form",
	"input",
	"button",
	"textarea",
	"select",
	"link",
	"meta",
	"base",
	"frame",
	"frameset",
	// SVG's own two ways to reach back out of the picture. `use` resolves an
	// `href` — including into another document — and the SMIL elements can
	// retarget any attribute after the sanitizer has already walked it, which
	// makes a cleaned `href` no guarantee of the one that ends up live. Neither
	// appears in any artwork this plugin ships or fetches (the icon packs are
	// flat `path`/`circle` geometry), so denying them costs nothing real.
	// Lowercase because the check lowercases: `animateTransform` arrives here as
	// `animatetransform`.
	"use",
	"animate",
	"animatetransform",
	"animatemotion",
	"set",
]);

const EVENT_ATTR_RE = /^on/i;
const DANGEROUS_ATTR_VALUES_RE = /javascript:|data:text\/html/i;

/**
 * Remove everything executable from an SVG subtree, in place.
 *
 * Parsing as `image/svg+xml` builds no scripting context, but the result is
 * then inserted into the live document — where an inline SVG is a scripting
 * context like any other and an `on*` handler would fire.
 *
 * Returns whether `el` itself is a denied element. Every caller today hands in
 * an `<svg>` root, which never is — but the recursion below tests children
 * only, so a caller passing a subtree would otherwise have its outermost node
 * skipped. Answering rather than assuming keeps that from being a trap for the
 * next caller.
 */
export function stripUnsafeSvg(el: Element): boolean {
	if (DANGEROUS_TAGS.has(el.tagName.toLowerCase())) {
		el.remove();
		return true;
	}

	const toRemove: Element[] = [];
	for (let i = 0; i < el.children.length; i++) {
		const child = el.children[i];
		if (!child) continue;
		if (DANGEROUS_TAGS.has(child.tagName.toLowerCase())) toRemove.push(child);
		else stripUnsafeSvg(child);
	}
	for (const child of toRemove) el.removeChild(child);

	for (const attr of el.getAttributeNames()) {
		if (EVENT_ATTR_RE.test(attr)) {
			el.removeAttribute(attr);
			continue;
		}
		const value = el.getAttribute(attr);
		if (value && DANGEROUS_ATTR_VALUES_RE.test(value)) {
			el.removeAttribute(attr);
		}
	}

	return false;
}
