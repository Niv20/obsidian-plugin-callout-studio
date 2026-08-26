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
import { isolateSvgCopy } from "../../icons/isolateSvg";
import { stripUnsafeSvg } from "../../icons/svgSafety";

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

/** The narrow slice of `Element` {@link paintImportedIcon} needs, so the paint
 *  decision can be tested without a DOM. */
export interface SvgRootLike {
	getAttribute(name: string): string | null;
	setAttribute(name: string, value: string): void;
	hasAttribute(name: string): boolean;
}

/** Declared paint that draws nothing. Colouring over one *adds* ink. */
const UNPAINTED_ROOT_ATTRS = ["fill", "stroke"] as const;

/**
 * Size an imported icon to 16px and give it core's `currentColor`, **without
 * overwriting paint the artwork declares for itself.**
 *
 * The guard is the whole point, and its absence was a bug. An outline drawing
 * is defined by the ink it withholds: Obsidian's own Lucide callout icon, and
 * every Tabler Outline glyph, opens with `fill="none" stroke="currentColor"`.
 * Setting `fill` unconditionally — which this did — closes every open path into
 * a filled polygon, so a pencil outline came out as a solid black lozenge.
 * `icons/renderIcon.ts` has always followed the same rule for the same reason
 * (`UNPAINTED`, `stencilSvg`, the `stroked` branch); this is that rule, here.
 *
 * Filled artwork declares no root paint at all, so it still gets
 * `fill="currentColor"` exactly as before and still renders filled.
 *
 * The `viewBox` clause matters for the same reason it does in
 * `sanitizeSVG`: without one, forcing 16×16 onto a drawing sized only by
 * `width`/`height` rescales its geometry rather than its box. Everything else —
 * transforms, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `fill-rule`,
 * `clip-rule`, per-element paint — survives untouched because nothing here
 * touches it.
 */
export function paintImportedIcon(root: SvgRootLike): void {
	if (!root.hasAttribute("viewBox")) {
		const w = parseFloat(root.getAttribute("width") ?? "");
		const h = parseFloat(root.getAttribute("height") ?? "");
		if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
			root.setAttribute("viewBox", `0 0 ${w} ${h}`);
		}
	}
	root.setAttribute("width", "16");
	root.setAttribute("height", "16");
	for (const attr of UNPAINTED_ROOT_ATTRS) {
		if (!root.hasAttribute(attr)) root.setAttribute(attr, "currentColor");
	}
}

/**
 * A theme may write its icon as literal markup — `--callout-icon: '<svg …>'` —
 * and Obsidian honours that, so a faithful restore has to as well. The probe
 * also arrives here with artwork read straight back off a callout the theme
 * already drew (`manager/theme/ThemeAppearanceProbe.ts`).
 *
 * Parsed as `image/svg+xml`, which builds no scripting context — but the result
 * is then inserted into the live document, where an inline SVG is a scripting
 * context like any other, so it goes through `stripUnsafeSvg` before it gets
 * there. `isolateSvgCopy` then keeps a theme's own `id`s and `url(#…)`
 * references from colliding with the page; it early-returns for the plain
 * `viewBox`-and-paths glyph that nearly every theme actually supplies.
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
	stripUnsafeSvg(copy);
	isolateSvgCopy(copy);
	paintImportedIcon(copy);
	return copy;
}
