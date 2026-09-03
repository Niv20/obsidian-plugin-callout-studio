/**
 * tests/svgSafety.test.ts — the deny-list every SVG passes through.
 *
 * `icons/svg.ts`'s two sanitizers are not covered by tests, and deliberately so:
 * they parse and re-serialize through `DOMParser`/`XMLSerializer`, which Node
 * has not got, and a test that stubbed those would be testing the stub (see the
 * note at the top of `iconSvg.test.ts`).
 *
 * `stripUnsafeSvg` is the part of that surface which parses nothing. It walks a
 * tree that is already built and decides, per element and per attribute, what
 * may stay — so the fake element tree is a stand-in for the DOM, not for the
 * behaviour under test. The decisions themselves are worth pinning down: this
 * is the only guard standing between a theme's `--callout-icon: '<svg …>'` and
 * the live document, where an inline SVG is a scripting context like any other.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { asEl, el } from "./support/fakeDom";
import { stripUnsafeSvg } from "../src/icons/svgSafety";
import type { FakeElement } from "./support/fakeDom";

/** Tag names still present in the tree, outermost first. */
function tags(root: FakeElement): string[] {
	const out: string[] = [];
	const walk = (node: FakeElement): void => {
		for (const child of node.children as unknown as FakeElement[]) {
			out.push(child.tagName.toLowerCase());
			walk(child);
		}
	};
	walk(root);
	return out;
}

const svgWith = (...children: FakeElement[]): FakeElement =>
	el({ tag: "svg", children });

describe("stripUnsafeSvg — elements", () => {
	it("drops a script anywhere in the tree", () => {
		const root = svgWith(el({ tag: "g", children: [el({ tag: "script" })] }));
		stripUnsafeSvg(asEl(root));
		assert.deepStrictEqual(tags(root), ["g"]);
	});

	it("keeps ordinary artwork geometry", () => {
		const root = svgWith(el({ tag: "path" }), el({ tag: "circle" }));
		stripUnsafeSvg(asEl(root));
		assert.deepStrictEqual(tags(root), ["path", "circle"]);
	});

	it("drops `use`, which resolves an href of its own", () => {
		// Not paranoia about a tag nobody writes: `use` is the one SVG element
		// that reaches back out of the picture, and no artwork this plugin
		// ships or fetches contains one.
		const root = svgWith(el({ tag: "use", attrs: { href: "#x" } }));
		stripUnsafeSvg(asEl(root));
		assert.deepStrictEqual(tags(root), []);
	});

	it("drops the SMIL elements, which retarget attributes after the walk", () => {
		for (const tag of ["animate", "animateTransform", "animateMotion", "set"]) {
			const root = svgWith(el({ tag }));
			stripUnsafeSvg(asEl(root));
			assert.deepStrictEqual(tags(root), [], `${tag} survived`);
		}
	});

	it("reports a denied root instead of walking past it", () => {
		// Every caller today hands in an `<svg>`, so this never fires in
		// production — but the recursion tests children only, and a caller
		// passing a subtree would otherwise have its outermost node skipped.
		const root = el({ tag: "svg" });
		assert.strictEqual(stripUnsafeSvg(asEl(root)), false);
		assert.strictEqual(stripUnsafeSvg(asEl(el({ tag: "script" }))), true);
	});
});

describe("stripUnsafeSvg — attributes", () => {
	it("strips every on* handler, whatever its case", () => {
		const root = el({
			tag: "svg",
			attrs: { onload: "x()", ONCLICK: "y()", fill: "red" },
		});
		stripUnsafeSvg(asEl(root));
		assert.strictEqual(root.getAttribute("onload"), null);
		assert.strictEqual(root.getAttribute("ONCLICK"), null);
		assert.strictEqual(root.getAttribute("fill"), "red", "artwork survives");
	});

	it("strips a javascript: or data:text/html value from any attribute", () => {
		const root = el({
			tag: "svg",
			attrs: { href: "javascript:alert(1)", src: "data:text/html,<b>" },
		});
		stripUnsafeSvg(asEl(root));
		assert.strictEqual(root.getAttribute("href"), null);
		assert.strictEqual(root.getAttribute("src"), null);
	});

	it("cleans attributes on nested elements too, not just the root", () => {
		const child = el({ tag: "path", attrs: { onmouseover: "x()", d: "M0 0" } });
		const root = svgWith(child);
		stripUnsafeSvg(asEl(root));
		assert.strictEqual(child.getAttribute("onmouseover"), null);
		assert.strictEqual(child.getAttribute("d"), "M0 0");
	});

	it("removes every handler when several sit on one element", () => {
		// Removing while iterating a live attribute list skips every other name;
		// the names are snapshotted for exactly this reason.
		const root = el({
			tag: "svg",
			attrs: { onload: "a()", onclick: "b()", onfocus: "c()" },
		});
		stripUnsafeSvg(asEl(root));
		assert.deepStrictEqual(root.getAttributeNames(), []);
	});
});
