import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeSvgCssValue } from "../src/icons/svgCss";

describe("SVG drawing CSS value grammar", () => {
	it("keeps literal drawing values and local gradients", () => {
		for (const value of ["#f00", "none", "currentColor", "0.5", "1px 2px", "rgb(255, 0, 20)",
			"translate(12 4) rotate(30)", 'url("#gradient-1")', "url(#clip)", "'Open Sans', sans-serif"]) {
			assert.equal(safeSvgCssValue(value), true, value);
		}
	});
	it("rejects every unrecognized function, escaped reference and rule delimiter", () => {
		for (const value of ['url("https://example.invalid/x")', 'u\\72l("https://example.invalid/x")',
			'url("\\23 local")', "var(--remote)", "attr(data-url url)", "expression(alert(1))",
			"url(data:image/svg+xml,x)", "red; } body { display:none", "red/*comment*/", "rgb(1 2 3", "red)"]) {
			assert.equal(safeSvgCssValue(value), false, value);
		}
	});
});
