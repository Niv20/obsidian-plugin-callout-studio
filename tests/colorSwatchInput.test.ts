/**
 * tests/colorSwatchInput.test.ts — the palette editor's colour dot
 * (`ui/ColorSwatchInput.ts`, finding S6-11).
 *
 * It is the bare `<input type="color">` Obsidian's ColorComponent makes, so
 * app.css draws it as Obsidian's round dot; nothing wraps or covers it. It
 * reports every move inside the picker (`input`, for the live preview and the
 * warning triangles, which take no room) and, separately, the settled pick
 * (`change`, for the contrast line, which does take room and so must not move
 * the window while the user is still choosing).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import { createColorSwatchInput } from "../src/ui/ColorSwatchInput";
import { readRepoFile } from "./support/sourceScan";

describe("the palette editor's colour dot", () => {
	it("is a bare colour input, straight in the row's control", () => {
		fakeDom.document.body.empty();
		const { input } = createColorSwatchInput(asEl(fakeDom.document.body), "#3db8d3", () => undefined);
		const el = input as unknown as FakeElement;
		assert.equal(el.tagName.toLowerCase(), "input");
		assert.equal(el.getAttribute("type"), "color");
		assert.equal(el.parentElement, fakeDom.document.body, "no painted wrapper around it");
		assert.equal(input.value, "#3db8d3");
	});

	it("reports every move to onPick and only the settled pick to onCommit", () => {
		fakeDom.document.body.empty();
		const picks: string[] = [];
		const commits: string[] = [];
		const { input } = createColorSwatchInput(
			asEl(fakeDom.document.body),
			"#000000",
			(hex) => picks.push(hex),
			(hex) => commits.push(hex),
		);
		const el = input as unknown as FakeElement & { value: string };
		for (const hex of ["#111111", "#222222"]) {
			el.value = hex;
			el.fire("input");
		}
		el.fire("change");
		assert.deepEqual(picks, ["#111111", "#222222"]);
		assert.deepEqual(commits, ["#222222"]);
	});

	it("leaves the dot to Obsidian's stylesheet but for room for its ring, and the contrast line to the settled pick", () => {
		const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
		// Obsidian makes the input exactly as tall as the dot, so its 2px hover
		// and focus ring is cut flat at the top and bottom; this one rule gives
		// it the 4px, and nothing else is painted.
		const rules = css.match(/[^{}]*callout-studio-color-input[^{}]*\{[^}]*\}/g) ?? [];
		assert.equal(rules.length, 1, "one rule of ours on the dot");
		assert.match(rules[0] ?? "", /height:\s*calc\(var\(--swatch-height\) \+ 4px\)/);
		assert.ok(!css.includes("cs-color-cell"));
		const palette = readRepoFile("src/settings/PaletteEditorModal.ts");
		assert.match(palette, /\(\) => refreshLine\(\),/, "the line runs on commit");
		assert.doesNotMatch(
			palette,
			/refreshLine\(\);\s*this\.preview\?\.refresh\(\);/,
			"the line is not on every move",
		);
		assert.match(palette, /refreshBadges\(\);\s*this\.preview\?\.refresh\(\);/, "the triangles are");
	});
});
