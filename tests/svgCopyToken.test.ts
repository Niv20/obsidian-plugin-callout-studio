/**
 * tests/svgCopyToken.test.ts — the tag a copy of an uploaded picture is fenced
 * with (`src/icons/isolateSvg.ts`), and the one caller that has to choose it.
 *
 * A picture with ids or a `<style>` of its own is tagged per copy, and the tag
 * is written into every id and every selector of that copy. On screen the tag
 * is a running number, which is the point: no two copies in a document share
 * one. The website export reads a copy back as markup and writes it to a file
 * (`src/manager/web/webData.ts`), and there the running number was a bug a
 * user met as a page that said "Out of date" straight after **Update now**:
 * the same callouts came out as different bytes every time they were asked
 * for, so the file on disk never matched what would be written next, and
 * every automatic refresh rewrote it.
 *
 * So the export pins the tag, and these are the promises that makes:
 * the same picture under the same pin is the same markup, the pin ends with
 * the call that set it, and the counter goes on as if nothing had happened.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
// Listed first among the project imports: it installs the DOM globals before
// anything under test loads (see tests/support/fakeDom.ts).
import { el, parseMarkupInto, type FakeElement } from "./support/fakeDom";
import { isolateSvgCopy, withSvgCopyToken } from "../src/icons/isolateSvg";

/** What a drawing tool exports: an id on the root, a class rule, a gradient by id. */
const PICTURE =
	'<svg id="Layer_1" viewBox="0 0 24 24">' +
	"<style>.st0{fill:url(#grad)}</style>" +
	'<defs><linearGradient id="grad"><stop offset="0"></stop></linearGradient></defs>' +
	'<path class="st0" d="M0 0h24v24z"></path>' +
	'<use href="#grad"></use>' +
	"</svg>";

/** A glyph of a library: nothing in it reaches past itself. */
const GLYPH = '<svg viewBox="0 0 24 24"><path d="M0 0h24v24z"></path></svg>';

/** A fresh copy of `markup`, isolated as the icon painter isolates it. */
function copyOf(markup: string): FakeElement {
	const holder = el({ tag: "div" });
	parseMarkupInto(holder, markup);
	const svg = holder.children[0];
	assert.ok(svg, "the markup parsed to an element");
	isolateSvgCopy(svg as unknown as Element);
	return svg;
}

const tagOf = (svg: FakeElement): string | null => svg.getAttribute("data-cs-svg");

describe("the tag a copy of a picture is fenced with", () => {
	it("is a number of its own for every copy on screen", () => {
		const first = copyOf(PICTURE);
		const second = copyOf(PICTURE);
		assert.notEqual(tagOf(first), tagOf(second));
		assert.notEqual(first.outerHTML, second.outerHTML, "which is why a file cannot use it");
		assert.equal(first.getAttribute("id"), `Layer_1-${tagOf(first)}`);
	});

	it("is the caller's inside withSvgCopyToken, in every id, reference and selector", () => {
		const svg = withSvgCopyToken("0a", () => copyOf(PICTURE));
		assert.equal(tagOf(svg), "0a");
		assert.equal(svg.getAttribute("id"), "Layer_1-0a");
		assert.equal(svg.querySelector("linearGradient, lineargradient")?.getAttribute("id"), "grad-0a");
		assert.equal(svg.querySelector("use")?.getAttribute("href"), "#grad-0a");
		const css = svg.querySelector("style")?.textContent ?? "";
		assert.ok(css.includes('[data-cs-svg="0a"]'), css);
		assert.ok(css.includes("url(#grad-0a)"), css);
	});

	it("makes the same picture the same markup, however often it is asked for", () => {
		const first = withSvgCopyToken("0a", () => copyOf(PICTURE));
		// Copies painted on screen in between move the counter, not the pin.
		copyOf(PICTURE);
		copyOf(PICTURE);
		const second = withSvgCopyToken("0a", () => copyOf(PICTURE));
		assert.equal(first.outerHTML, second.outerHTML);
		const other = withSvgCopyToken("0b", () => copyOf(PICTURE));
		assert.notEqual(other.outerHTML, first.outerHTML, "another pin is another fence");
	});

	it("ends with the call that set it, also when that call throws or is nested", () => {
		const before = copyOf(PICTURE);
		assert.throws(() =>
			withSvgCopyToken("0a", () => {
				throw new Error("the painter failed");
			}),
		);
		const after = copyOf(PICTURE);
		assert.notEqual(tagOf(after), "0a");
		assert.equal(Number.parseInt(tagOf(after) ?? "", 36), Number.parseInt(tagOf(before) ?? "", 36) + 1);

		const tags = withSvgCopyToken("0a", () => {
			const inner = withSvgCopyToken("0b", () => tagOf(copyOf(PICTURE)));
			return [inner, tagOf(copyOf(PICTURE))];
		});
		assert.deepEqual(tags, ["0b", "0a"]);
	});

	it("leaves a glyph with no ids and no style untagged, pinned or not", () => {
		assert.equal(tagOf(copyOf(GLYPH)), null);
		assert.equal(tagOf(withSvgCopyToken("0a", () => copyOf(GLYPH))), null);
	});
});
