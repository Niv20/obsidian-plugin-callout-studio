/**
 * tests/dropdownField.test.ts — the field of every dropdown and picker is
 * Obsidian's own dropdown.
 *
 * `DropdownField` (src/ui/dropdownField.ts) is a `div` wearing app.css's
 * `.dropdown`, so Obsidian draws it in every state: its face, its chevron, the
 * round badge in the macOS settings window, its padding, hover, focus ring and
 * disabled look. Two things are pinned here:
 *
 * - the element and the two classes app.css reads from it: `mouse-focus`
 *   (no ring after a mouse press) and `mod-disabled`;
 * - **styles.css paints none of it.** Until 2026-11-01 the plugin copied
 *   Obsidian's dropdown rules by hand and the copy drifted (a badge half the
 *   size, other padding, a ring after a click). A rule that paints the field
 *   would start that again, so the stylesheet may only lay it out.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DropdownField } from "../src/ui/dropdownField";
import { asEl, el, fakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

function mount() {
	fakeDom.light();
	const host = el();
	const field = new DropdownField(asEl(host), { accessibleName: "Callout format", popup: "menu" });
	return { host, field, el: host.querySelector(".cs-dropdown-field")! };
}

describe("DropdownField — Obsidian's dropdown, worn by a div", () => {
	it("wears Obsidian's class, takes focus, and is named without a tooltip", () => {
		const { host, field, el: fieldEl } = mount();
		field.setText("Block");
		assert.equal(fieldEl.tagName.toLowerCase(), "div", "a <button> would take Obsidian's button rules over .dropdown");
		assert.ok(fieldEl.hasClass("dropdown"));
		assert.equal(fieldEl.getAttribute("tabindex"), "0");
		assert.equal(fieldEl.getAttribute("role"), "button");
		assert.equal(fieldEl.getAttribute("aria-haspopup"), "menu");
		assert.equal(fieldEl.getAttribute("aria-expanded"), "false");
		assert.equal(fieldEl.hasAttribute("aria-label"), false, "Obsidian would show aria-label as a tooltip");
		// "Callout format, Block": the hidden name, then the words shown.
		const [nameId, valueId] = (fieldEl.getAttribute("aria-labelledby") ?? "").split(" ");
		assert.equal(host.querySelector(`#${nameId}`)?.textContent, "Callout format");
		assert.equal(host.querySelector(`#${valueId}`)?.textContent, "Block");
	});

	it("keeps an icon slot before the words, which hides itself while empty", () => {
		const { field, el: fieldEl } = mount();
		assert.deepEqual(fieldEl.children, [field.iconEl, field.labelEl]);
		assert.equal(field.iconEl.getAttribute("aria-hidden"), "true");
		const css = readRepoFile("styles.css");
		assert.match(css, /\.cs-dropdown-field-icon:empty\s*\{\s*display:\s*none;/);
	});

	it("marks a mouse press with Obsidian's mouse-focus until the field loses the focus", () => {
		const { el: fieldEl } = mount();
		fieldEl.fire("mousedown");
		assert.ok(fieldEl.hasClass("mouse-focus"), "app.css then draws no ring after a click");
		fieldEl.fire("blur");
		assert.equal(fieldEl.hasClass("mouse-focus"), false, "the next Tab gets its ring");
	});

	it("is disabled the way Obsidian's dropdown is, and out of the Tab order", () => {
		const { field, el: fieldEl } = mount();
		field.setDisabled(true);
		assert.ok(fieldEl.hasClass("mod-disabled"));
		assert.equal(fieldEl.getAttribute("aria-disabled"), "true");
		assert.equal(fieldEl.getAttribute("tabindex"), "-1");
		assert.equal(field.isDisabled(), true);
		field.setDisabled(false);
		assert.equal(fieldEl.hasClass("mod-disabled"), false);
		assert.equal(fieldEl.hasAttribute("aria-disabled"), false);
		assert.equal(fieldEl.getAttribute("tabindex"), "0");
	});

	it("opens on the keys that open Obsidian's <select>", () => {
		for (const key of ["Enter", " ", "ArrowDown", "ArrowUp"])
			assert.equal(DropdownField.isOpenKey({ key } as KeyboardEvent), true, key);
		for (const key of ["Tab", "Escape", "a"])
			assert.equal(DropdownField.isOpenKey({ key } as KeyboardEvent), false, key);
	});
});

describe("styles.css lays the field out and paints none of it", () => {
	const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
	/** Every innermost rule: its selectors and the property names it declares. */
	const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
		selectors: (match[1] ?? "").split(",").map((s) => s.trim().replace(/\s+/g, " ")),
		properties: (match[2] ?? "").split(";").map((d) => (d.split(":")[0] ?? "").trim()).filter(Boolean),
	}));
	/** Whether a selector's own element (its last compound) is the field. */
	const targetsField = (selector: string): boolean => {
		const subject = selector.split(/\s*[\s>+~]\s*/).pop() ?? "";
		return /\.(?:cs-dropdown-field|dropdown)(?![-\w])/.test(subject);
	};
	const fieldRules = rules.filter((rule) => rule.selectors.some(targetsField));

	it("has rules for the field: the layout a div needs to hold one line of words", () => {
		assert.ok(fieldRules.length > 0);
	});

	it("never sets a face, an edge, a ring, padding, corners or a height on it", () => {
		const PAINT = /^(background(-[a-z-]+)?|box-shadow|border(-[a-z-]+)?|outline(-[a-z-]+)?|padding(-[a-z-]+)?|corner-shape|height|min-height|block-size|color|opacity|text-align)$/;
		for (const rule of fieldRules) {
			for (const property of rule.properties) {
				assert.ok(!PAINT.test(property), `${rule.selectors.join(", ")} sets ${property}: that is app.css's to draw`);
			}
		}
	});

	it("changes Obsidian's look only through Obsidian's own tokens", () => {
		// The macOS settings look in the plugin's windows: the same three tokens
		// app.css sets for its own settings window, and nothing else.
		const tokens = rules.find((rule) => rule.selectors.includes(".mod-macos:not(.is-mobile) .cs-modal .setting-item-control"));
		assert.ok(tokens);
		assert.deepEqual(tokens.properties, ["--dropdown-background", "--dropdown-background-hover", "--dropdown-icon-background"]);
	});
});
