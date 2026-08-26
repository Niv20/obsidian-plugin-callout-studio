/**
 * tests/coreIcon.test.ts — an outline stays an outline.
 *
 * `importCoreIconSvg` is the one place a *theme's* artwork becomes DOM: a
 * stylesheet's `--callout-icon: '<svg …>'`, and — since the appearance probe
 * landed — the markup read straight back off a callout the theme already drew.
 * That second caller made it the busiest icon path in the plugin and exposed
 * what the first one had hidden: it painted `fill` unconditionally.
 *
 * Obsidian's own callout icon is Lucide, and Lucide opens
 * `fill="none" stroke="currentColor"`. An outline drawing is *defined* by the
 * ink it withholds, so overwriting that `none` closes every open path into a
 * filled polygon — a pencil came out as a solid lozenge, on the 107 installed
 * themes whose icon reaches the `svg` rung.
 *
 * The parse and the DOM insertion need `DOMParser`, which Node has not got and
 * which this project declines to stub (see `iconSvg.test.ts`). So the decision
 * was split out as `paintImportedIcon`, which takes only the three attribute
 * methods it uses — and that decision is the whole of the bug.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { paintImportedIcon, type SvgRootLike } from "../src/manager/css/coreIcon";

/** An `<svg>` root reduced to the three methods the paint pass touches. */
function svgRoot(attrs: Record<string, string> = {}): SvgRootLike & {
	attrs: Record<string, string>;
} {
	const store: Record<string, string> = { ...attrs };
	return {
		attrs: store,
		getAttribute: (name) => store[name] ?? null,
		setAttribute: (name, value) => {
			store[name] = value;
		},
		hasAttribute: (name) => store[name] !== undefined,
	};
}

/** How Obsidian's own callout icon — and every Tabler Outline glyph — opens. */
const LUCIDE_ROOT = {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	"stroke-width": "2",
	"stroke-linecap": "round",
	"stroke-linejoin": "round",
};

/* ------------------------------------------------------------------ *
 * Stroke and fill
 * ------------------------------------------------------------------ */

describe("paintImportedIcon — an open stroked drawing", () => {
	it("leaves fill=none alone", () => {
		// The regression itself. `fill: currentColor` here is the solid blob.
		const root = svgRoot(LUCIDE_ROOT);
		paintImportedIcon(root);
		assert.strictEqual(root.attrs.fill, "none");
	});

	it("keeps the stroke the artwork already declared", () => {
		const root = svgRoot({ ...LUCIDE_ROOT, stroke: "#ff0000" });
		paintImportedIcon(root);
		assert.strictEqual(root.attrs.stroke, "#ff0000");
	});

	it("preserves the stroke geometry that makes it an outline", () => {
		const root = svgRoot(LUCIDE_ROOT);
		paintImportedIcon(root);
		assert.strictEqual(root.attrs["stroke-width"], "2");
		assert.strictEqual(root.attrs["stroke-linecap"], "round");
		assert.strictEqual(root.attrs["stroke-linejoin"], "round");
	});

	it("does not invent a fill for a drawing that only strokes", () => {
		// No `fill` declared at all is a different case from `fill="none"`, and
		// it is the one where supplying `currentColor` is right: SVG's initial
		// fill is opaque black, which would be invisible on a dark theme.
		const root = svgRoot({ viewBox: "0 0 24 24", stroke: "currentColor" });
		paintImportedIcon(root);
		assert.strictEqual(root.attrs.fill, "currentColor");
		assert.strictEqual(root.attrs.stroke, "currentColor");
	});
});

describe("paintImportedIcon — a solid drawing", () => {
	it("still paints artwork that declares no paint of its own", () => {
		// Every downloadable pack except Tabler Outline emits exactly this, and
		// it has to keep rendering filled.
		const root = svgRoot({ viewBox: "0 0 24 24" });
		paintImportedIcon(root);
		assert.strictEqual(root.attrs.fill, "currentColor");
		assert.strictEqual(root.attrs.stroke, "currentColor");
	});

	it("keeps a declared fill rather than replacing it", () => {
		const root = svgRoot({ viewBox: "0 0 16 16", fill: "#0a84ff" });
		paintImportedIcon(root);
		assert.strictEqual(root.attrs.fill, "#0a84ff");
	});

	it("leaves fill-rule and clip-rule untouched", () => {
		const root = svgRoot({
			viewBox: "0 0 24 24",
			"fill-rule": "evenodd",
			"clip-rule": "evenodd",
		});
		paintImportedIcon(root);
		assert.strictEqual(root.attrs["fill-rule"], "evenodd");
		assert.strictEqual(root.attrs["clip-rule"], "evenodd");
	});
});

/* ------------------------------------------------------------------ *
 * Sizing
 * ------------------------------------------------------------------ */

describe("paintImportedIcon — sizing", () => {
	it("sizes to 16px, as core's own reader does", () => {
		const root = svgRoot(LUCIDE_ROOT);
		paintImportedIcon(root);
		assert.strictEqual(root.attrs.width, "16");
		assert.strictEqual(root.attrs.height, "16");
	});

	it("never rewrites a viewBox the artwork already has", () => {
		const root = svgRoot({ viewBox: "0 0 512 512", width: "512" });
		paintImportedIcon(root);
		assert.strictEqual(root.attrs.viewBox, "0 0 512 512");
	});

	it("derives one from width/height before overwriting them", () => {
		// Forcing 16x16 onto a drawing sized only by width/height rescales its
		// geometry rather than its box — the same clause `sanitizeSVG` carries.
		const root = svgRoot({ width: "48", height: "24" });
		paintImportedIcon(root);
		assert.strictEqual(root.attrs.viewBox, "0 0 48 24");
	});

	it("leaves the viewBox off when width and height say nothing usable", () => {
		// Better a drawing that scales oddly than one boxed to a guess: a
		// viewBox is a coordinate system, and inventing the wrong one crops.
		const root = svgRoot({ width: "auto", height: "100%" });
		paintImportedIcon(root);
		assert.strictEqual(root.attrs.viewBox, undefined);
	});
});
