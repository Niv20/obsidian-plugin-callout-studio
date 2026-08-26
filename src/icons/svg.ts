/**
 * icons/svg.ts — SVG handling for artwork that arrives as markup.
 *
 * Two sanitizers live here because there are two threat models, and conflating
 * them would either break Material or wave a user's file straight through.
 *
 * The deny-list both of them lean on is in `svgSafety.ts`, because a third
 * caller outside this file needs the same guarantee.
 *
 * - `sanitizeSVG` is for Material Symbols, fetched individually from Google as
 *   complete SVG documents. One known vendor, one known shape of output, so a
 *   deny-list of the obviously executable is proportionate. Downloadable packs
 *   ship bare path data instead (see packData.ts) and need nothing at all.
 * - `sanitizeUserSvg` is for a file the user picked off their own disk, which
 *   could be anything — and the markup is inserted into the live DOM, where an
 *   inline SVG is a scripting context like any other. That one is an
 *   allow-list: unknown elements and unknown attributes do not survive.
 */
import { stripUnsafeSvg } from "./svgSafety";


/**
 * Strip anything executable from an SVG document and normalize it.
 *
 * Returns null when the input is not a well-formed `<svg>`, so a bad response
 * is discarded rather than stored and rendered.
 */
export function sanitizeSVG(raw: string): string | null {
	const parser = new DOMParser();
	const doc = parser.parseFromString(raw, "image/svg+xml");

	if (doc.querySelector("parsererror")) return null;

	const svg = doc.documentElement;
	if (svg.tagName.toLowerCase() !== "svg") return null;

	// A viewBox is what lets the icon scale to the callout's font size; some
	// vendor files carry only width/height.
	if (!svg.hasAttribute("viewBox")) {
		const w = svg.getAttribute("width");
		const h = svg.getAttribute("height");
		svg.setAttribute(
			"viewBox",
			w && h ? `0 0 ${parseFloat(w)} ${parseFloat(h)}` : "0 0 24 24",
		);
	}

	stripUnsafeSvg(svg);
	return new XMLSerializer().serializeToString(svg);
}

/* ------------------------------------------------------------------ *
 * User-supplied SVG
 * ------------------------------------------------------------------ */

/**
 * Elements a picture is allowed to be made of.
 *
 * Shapes, grouping, gradients and clipping — enough to draw any icon, and
 * nothing that can reach outside the document. The absences are deliberate:
 * `<use>`/`<foreignObject>` pull in content by reference, `<animate>`/`<set>`
 * assign event handlers at runtime, and a nested `<svg>` re-opens all of it
 * one level down. `<title>` is absent for appearance, not safety: browsers
 * draw it as the OS tooltip. `<desc>` stays — it draws nothing.
 *
 * Lowercase, because SVG's own spelling is mixed (`linearGradient`, `clipPath`)
 * and every lookup here folds case first.
 */
const USER_SVG_ELEMENTS = new Set([
	"svg",
	"desc",
	"defs",
	"g",
	"path",
	"circle",
	"ellipse",
	"rect",
	"line",
	"polyline",
	"polygon",
	"text",
	"tspan",
	"lineargradient",
	"radialgradient",
	"stop",
	"clippath",
	"mask",
	"style",
	"image",
]);

/**
 * Attributes those elements are allowed to carry: geometry, paint, and the few
 * structural ones a gradient or clip path needs to be referred to. Anything
 * else — every `on*` handler, every `href` outside the `<image>` exception
 * below, every `xlink:*` — is dropped without being looked at.
 */
const USER_SVG_ATTRS = new Set([
	// structure
	"viewbox",
	"preserveaspectratio",
	"xmlns",
	"id",
	"class",
	"style",
	"transform",
	// geometry
	"x",
	"y",
	"width",
	"height",
	"d",
	"cx",
	"cy",
	"r",
	"rx",
	"ry",
	"x1",
	"y1",
	"x2",
	"y2",
	"points",
	"offset",
	"dx",
	"dy",
	"text-anchor",
	"font-size",
	"font-family",
	"font-weight",
	// paint
	"fill",
	"fill-opacity",
	"fill-rule",
	"stroke",
	"stroke-width",
	"stroke-opacity",
	"stroke-linecap",
	"stroke-linejoin",
	"stroke-miterlimit",
	"stroke-dasharray",
	"stroke-dashoffset",
	"opacity",
	"color",
	"stop-color",
	"stop-opacity",
	"paint-order",
	"vector-effect",
	"display",
	"visibility",
	// referencing, restricted to same-document `url(#…)` by the value guard
	"clip-path",
	"clip-rule",
	"mask",
	"gradientunits",
	"gradienttransform",
	"spreadmethod",
	"maskunits",
	"clippathunits",
]);

/**
 * The one kind of `href` that survives: a raster embedded in the file itself.
 * Figma and Illustrator both emit these, and it is also the shape this plugin
 * produces when it wraps an uploaded PNG (see userImageImport.ts).
 */
const DATA_IMAGE_HREF_RE = /^data:image\/(png|jpe?g|gif|webp);base64,[\w+/=\s]+$/i;

/**
 * Values that must never survive, wherever they appear: script URLs, IE's
 * `expression()`, HTC `behavior:`, and any `url()` that is not a same-document
 * reference or an inline data URI.
 */
const UNSAFE_VALUE_RE = /javascript:|expression\s*\(|behaviou?r\s*:/i;
const EXTERNAL_URL_RE = /url\(\s*['"]?(?!#|data:)/i;

/**
 * Ceilings that keep a pathological file from stalling a render or bloating
 * `data.json`, which is read and rewritten on every save.
 *
 * The byte ceiling has to clear a legitimate raster: an uploaded picture is
 * wrapped in `<svg><image href="data:…">`, and a 128px PNG that keeps its
 * transparency can base64 to well over a hundred kilobytes. A hand-authored
 * icon is a thousandth of that, so this only ever bites the pathological case.
 */
const MAX_USER_SVG_ELEMENTS = 5000;
const MAX_USER_SVG_BYTES = 256 * 1024;

export interface SanitizedUserSvg {
	svg: string;
	/** Intrinsic size from the viewBox, for the icon box's aspect ratio. */
	width: number;
	height: number;
}

/**
 * Filter a user's SVG file down to markup that is safe to put in the DOM.
 *
 * Returns null when the file is not a well-formed `<svg>`, when it exceeds the
 * size ceilings, or when nothing drawable survives the filtering — all of which
 * the caller reports as "this file cannot be used", because a picture that
 * renders blank is not a better outcome than a refusal that says why.
 */
export function sanitizeUserSvg(raw: string): SanitizedUserSvg | null {
	const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
	if (doc.querySelector("parsererror")) return null;

	const svg = doc.documentElement;
	if (svg.localName.toLowerCase() !== "svg") return null;

	const { width, height } = normalizeViewBox(svg);
	// The root's own width/height would pin the artwork to whatever pixel size
	// it was exported at; the viewBox alone lets it scale to the callout.
	svg.removeAttribute("width");
	svg.removeAttribute("height");

	const budget = { remaining: MAX_USER_SVG_ELEMENTS };
	if (!cleanUserElement(svg, budget)) return null;
	if (svg.children.length === 0) return null;

	svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	const serialized = new XMLSerializer().serializeToString(svg);
	if (serialized.length > MAX_USER_SVG_BYTES) return null;

	return { svg: serialized, width, height };
}

/**
 * Recursively drop every element and attribute outside the allow-lists.
 *
 * Returns false when the element budget runs out, which fails the whole file
 * rather than silently keeping the first 5,000 shapes of it.
 */
function cleanUserElement(
	el: Element,
	budget: { remaining: number },
): boolean {
	if (budget.remaining-- <= 0) return false;

	const toRemove: Element[] = [];
	for (const child of Array.from(el.children)) {
		const name = child.localName.toLowerCase();
		if (!USER_SVG_ELEMENTS.has(name)) {
			toRemove.push(child);
			continue;
		}
		// CSS is kept because Illustrator and Figma colour whole drawings
		// through classes, and dropping it would render those files black. It
		// is kept only when it stays inside the document, though: `@import` and
		// an external `url()` are both requests to somewhere else.
		if (name === "style") {
			const css = child.textContent ?? "";
			if (css.includes("@import") || EXTERNAL_URL_RE.test(css)) {
				toRemove.push(child);
			}
			continue;
		}
		if (!cleanUserElement(child, budget)) return false;
	}
	for (const child of toRemove) el.removeChild(child);

	cleanUserAttributes(el);
	return true;
}

function cleanUserAttributes(el: Element): void {
	const isImage = el.localName.toLowerCase() === "image";
	let embedded: string | undefined;

	for (const attr of el.getAttributeNames()) {
		const name = attr.toLowerCase();
		const value = el.getAttribute(attr) ?? "";

		// `<image>` is the one element allowed a reference, and only to a
		// raster carried inside the file. Both spellings are read, and only
		// the SVG2 one is written back, so no xlink namespace has to survive.
		if (isImage && (name === "href" || name === "xlink:href")) {
			el.removeAttribute(attr);
			if (DATA_IMAGE_HREF_RE.test(value.trim())) embedded = value.trim();
			continue;
		}

		if (!USER_SVG_ATTRS.has(name)) {
			el.removeAttribute(attr);
			continue;
		}
		if (UNSAFE_VALUE_RE.test(value) || EXTERNAL_URL_RE.test(value)) {
			el.removeAttribute(attr);
		}
	}

	if (embedded) el.setAttribute("href", embedded);
}

/**
 * Guarantee a usable viewBox and report the size it describes.
 *
 * A file with only width/height is common from icon editors; one with neither
 * gets the 24×24 box every other source in this plugin draws in.
 */
function normalizeViewBox(svg: Element): { width: number; height: number } {
	const parsed = parseViewBox(svg.getAttribute("viewBox"));
	if (parsed) return parsed;

	const w = parseFloat(svg.getAttribute("width") ?? "");
	const h = parseFloat(svg.getAttribute("height") ?? "");
	const width = Number.isFinite(w) && w > 0 ? w : 24;
	const height = Number.isFinite(h) && h > 0 ? h : 24;
	svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	return { width, height };
}

function parseViewBox(
	value: string | null,
): { width: number; height: number } | null {
	if (!value) return null;
	const parts = value.trim().split(/[\s,]+/).map(Number);
	if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
	const [, , width, height] = parts as [number, number, number, number];
	if (width <= 0 || height <= 0) return null;
	return { width, height };
}

/** Encode SVG markup for use in a CSS `url()` value. */
export function svgToDataUri(svg: string): string {
	const encoded = encodeURIComponent(svg)
		.replace(/'/g, "%27")
		.replace(/"/g, "%22");
	return `url("data:image/svg+xml,${encoded}")`;
}
