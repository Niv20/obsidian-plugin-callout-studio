/**
 * tests/colorSwatchInput.test.ts — the palette editor's colour dot
 * (`ui/ColorSwatchInput.ts`, finding S6-11).
 *
 * It is the bare `<input type="color">` Obsidian's ColorComponent makes, so
 * app.css draws it as Obsidian's round dot; nothing wraps or covers it. It
 * reports every move inside the picker (`input`, for the live preview) and,
 * separately, the settled pick (`change`, for the contrast warning, which
 * must not make the rows jump while the user is still choosing).
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

	it("leaves the dot to Obsidian's stylesheet, and the contrast check to the settled pick", () => {
		const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
		assert.ok(!css.includes("callout-studio-color-input"), "no rule of ours on the dot");
		assert.ok(!css.includes("cs-color-cell"));
		const palette = readRepoFile("src/settings/PaletteEditorModal.ts");
		assert.match(palette, /\(\) => refreshWarnings\(\),/, "the warning runs on commit");
		assert.doesNotMatch(palette, /refreshWarnings\(\);\s*this\.preview\?\.refresh\(\);/, "not on every move");
	});
});
