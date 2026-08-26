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
]);

const EVENT_ATTR_RE = /^on/i;
const DANGEROUS_ATTR_VALUES_RE = /javascript:|data:text\/html/i;

/**
 * Remove everything executable from an SVG subtree, in place.
 *
 * Parsing as `image/svg+xml` builds no scripting context, but the result is
 * then inserted into the live document — where an inline SVG is a scripting
 * context like any other and an `on*` handler would fire.
 */
export function stripUnsafeSvg(el: Element): void {
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
}
