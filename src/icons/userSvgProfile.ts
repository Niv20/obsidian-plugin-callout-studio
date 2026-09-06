/** Shared element/attribute allow-lists for untrusted SVG artwork. */
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
export const USER_SVG_ELEMENTS = new Set([
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
export const USER_SVG_ATTRS = new Set([
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

