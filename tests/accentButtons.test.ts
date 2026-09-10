/**
 * The plugin's purple CTA buttons darken in light mode and lighten in dark.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(
	/\/\*[\s\S]*?\*\//g,
	"",
);
const flat = css.replace(/\s+/g, " ");

describe("the accent hover token", () => {
	it("derives from the resting accent in the active theme's direction", () => {
		const declaration =
			/--cs-btn-accent-face-hover: color-mix\(([^;]*)\);/.exec(flat)?.[1] ?? "";
		assert.match(declaration, /var\(--interactive-accent\) 92%/);
		assert.match(declaration, /rgb\(var\(--mono-rgb-100\)\)/);
	});
});

describe("the accent hover lands on every plugin surface", () => {
	const selectors = [
		".callout-studio-settings button.mod-cta:not( .mod-warning, .mod-destructive, :disabled, .cs-btn-disabled ):hover",
		".cs-modal button.mod-cta:not( .mod-warning, .mod-destructive, :disabled, .cs-btn-disabled ):hover",
		".callout-studio-editor button.mod-cta:not( .mod-warning, .mod-destructive, :disabled, .cs-btn-disabled ):hover",
	];
	const obsidianHover = specificityOf("button.mod-cta:hover");

	for (const selector of selectors) {
		it(`${selector} uses the directional hover and outranks Obsidian`, () => {
			assert.ok(flat.includes(selector));
			assert.ok(compareSpecificity(specificityOf(selector), obsidianHover) > 0);
		});
	}

	it("never claims a CTA that is also red", () => {
		for (const selector of selectors) {
			assert.match(selector, /:not\([^)]*\.mod-warning[^)]*\.mod-destructive/);
		}
	});

	it("also controls the two selected segmented-button families", () => {
		for (const selector of [
			".cs-border-side-btn.is-active:hover",
			".cs-gradient-dir-btn.is-active:hover",
		]) {
			const start = flat.indexOf(`${selector} {`);
			assert.ok(start >= 0, `${selector} is missing`);
			const rule = flat.slice(start, flat.indexOf("}", start) + 1);
			assert.match(rule, /var\( --cs-btn-accent-face-hover/);
		}
	});
});
