/**
 * tests/gradientDirectionPicker.test.ts — the palette editor's three gradient
 * direction arrows are Obsidian icon buttons (finding S6-10).
 *
 * Each is a `div.clickable-icon` acting as a button, as Obsidian builds its
 * extra buttons, so app.css draws it: a plain arrow, Obsidian's hover, and for
 * the chosen one `.is-active`. The plugin adds no face of its own. They used
 * to be grey framed squares, the chosen one solid purple, with a pile of
 * phone-only size fixes against Obsidian's button rules — none of which apply
 * to a `.clickable-icon`, so that fight (and its old test,
 * gradientDirectionMobileSize) is gone.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import { renderDirectionPicker } from "../src/settings/paletteDirectionPicker";
import { readRepoFile } from "./support/sourceScan";

function mount(initialDeg: number) {
	fakeDom.document.body.empty();
	const picked: number[] = [];
	renderDirectionPicker(asEl(fakeDom.document.body), initialDeg, (deg) => picked.push(deg));
	const buttons = fakeDom.document.body.querySelectorAll(".cs-gradient-dir-btn");
	const byLabel = (label: string): FakeElement => {
		const button = buttons.find((b: FakeElement) => b.getAttribute("aria-label") === label);
		assert.ok(button, label);
		return button;
	};
	return { buttons, byLabel, picked };
}

describe("the gradient direction picker", () => {
	it("draws three Obsidian icon buttons, named once each", () => {
		const { buttons } = mount(90);
		assert.equal(buttons.length, 3);
		for (const button of buttons) {
			assert.ok(button.hasClass("clickable-icon"));
			assert.equal(button.tagName.toLowerCase(), "div", "a div, as Obsidian's extra buttons");
			assert.equal(button.getAttribute("role"), "button");
			assert.equal(button.getAttribute("tabindex"), "0");
			assert.equal(button.getAttribute("title"), null, "aria-label only: one tooltip, not two");
		}
	});

	it("marks the chosen angle active and pressed, and moves the mark on a pick", () => {
		const { byLabel, picked } = mount(90);
		assert.ok(byLabel("90°").hasClass("is-active"));
		assert.equal(byLabel("90°").getAttribute("aria-pressed"), "true");
		assert.equal(byLabel("45°").getAttribute("aria-pressed"), "false");
		byLabel("45°").fire("click", { preventDefault: () => undefined });
		assert.deepEqual(picked, [45]);
		assert.ok(byLabel("45°").hasClass("is-active"));
		assert.ok(!byLabel("90°").hasClass("is-active"));
	});

	it("answers Enter and Space, as a button does", () => {
		const { byLabel, picked } = mount(90);
		byLabel("135°").fire("keydown", { key: "Enter", preventDefault: () => undefined });
		byLabel("45°").fire("keydown", { key: " ", preventDefault: () => undefined });
		assert.deepEqual(picked, [135, 45]);
	});
});

describe("the gradient direction arrows' CSS", () => {
	const css = readRepoFile("styles.css")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\s+/g, " ");
	const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
		selector: (m[1] ?? "").trim(),
		body: m[2] ?? "",
	}));

	it("paints no face, edge or size of its own on the arrows", () => {
		const painting = rules.filter(
			(r) =>
				r.selector.includes(".cs-gradient-dir-btn") &&
				/(^|;)\s*(background|border|width|height|padding)\s*:/.test(r.body),
		);
		assert.deepEqual(
			painting.map((r) => r.selector),
			[],
		);
	});

	it("keeps the arrows pointing the way the gradient runs in a right-to-left Obsidian", () => {
		const rtl = rules.find((r) => r.selector.startsWith(".mod-rtl") && r.selector.includes(".cs-gradient-dir-btn"));
		assert.ok(rtl, "a .mod-rtl rule for the arrows");
		assert.match(rtl.body, /transform: none/);
	});
});
