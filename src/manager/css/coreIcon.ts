/**
 * manager/css/coreIcon.ts — reading back the icon *Obsidian* would draw.
 *
 * Needed only by `CSSInjector.restoreCoreIcon`, which puts core's own icon back
 * after this plugin has painted over it: core resolves a callout's icon once,
 * the first time it builds the element, and its post-processor bails early if
 * `.callout-icon` already has a child — so nothing puts it back on its own.
 *
 * Both functions mirror core's reader deliberately, quirks included. Split out
 * of `CSSInjector` for room; behaviour is unchanged.
 */

/**
 * The icon Obsidian itself would draw in a callout, read the way core reads it:
 * the `data-callout-icon` attribute the renderer stamps from the callout node,
 * and failing that the computed `--callout-icon`.
 *
 * The unwrapping matches core's because a custom property keeps its CSS quoting
 * through the computed value — a theme writing `--callout-icon: 'lucide-star'`
 * hands back the apostrophes as well, and `setIcon` would look up an icon by
 * that name and find none. The double-quoted form goes through `JSON.parse`
 * for the escapes; a malformed one is used verbatim, which is also what core
 * does with it.
 */
export function coreIconValue(calloutEl: HTMLElement): string {
	const attr = calloutEl.getAttribute("data-callout-icon")?.trim() ?? "";
	const raw =
		attr.length > 0
			? attr
			: calloutEl.getCssPropertyValue("--callout-icon").trim();
	if (raw.startsWith("'") && raw.endsWith("'")) {
		return raw.slice(1, -1).replace(/\\'/g, "'");
	}
	if (raw.startsWith('"')) {
		try {
			const parsed: unknown = JSON.parse(raw);
			if (typeof parsed === "string") return parsed;
		} catch {
			// Fall through to the raw value, as core does.
		}
	}
	return raw;
}

/**
 * A theme may write its icon as literal markup — `--callout-icon: '<svg …>'` —
 * and Obsidian honours that, so a faithful restore has to as well. Sized and
 * painted exactly as core's reader does it: 16px, `currentColor` for both fill
 * and stroke, so the drawing tracks whatever colour the theme gives the callout.
 *
 * Parsed as `image/svg+xml`, which builds no scripting context, and the markup
 * can only have come from a stylesheet the user installed — the same trust
 * boundary as the `background-image` any theme is already free to put here.
 * (Separate from `icons/svg.ts`, whose two sanitizers guard artwork arriving
 * over the network and artwork the user uploaded; neither describes this.)
 */
export function importCoreIconSvg(
	markup: string,
	doc: Document,
): Element | null {
	const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
	const root = parsed.documentElement;
	if (
		parsed.querySelector("parsererror") ||
		root.nodeName.toLowerCase() !== "svg"
	) {
		return null;
	}
	const copy = doc.importNode(root, true);
	copy.setAttribute("width", "16");
	copy.setAttribute("height", "16");
	copy.setAttribute("fill", "currentColor");
	copy.setAttribute("stroke", "currentColor");
	return copy;
}
