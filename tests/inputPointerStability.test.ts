/** Shared field chrome must survive Obsidian's hover rules and validation. */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(
	/\/\*[\s\S]*?\*\//g,
	"",
);
const rules: { selectors: string[]; body: string }[] = [];
const pattern = /([^{}]+)\{([^{}]*)\}/g;
let match: RegExpExecArray | null;
while ((match = pattern.exec(css)) !== null) {
	rules.push({
		selectors: (match[1] ?? "").trim().split(/,\s*\n/).map((s) => s.trim().replace(/\s+/g, " ")),
		body: match[2] ?? "",
	});
}
function ruleFor(selector: string) {
	const hits = rules.filter((rule) => rule.selectors.includes(selector));
	assert.strictEqual(hits.length, 1, `expected one rule for ${selector}`);
	return hits[0]!;
}
const TEXT_BASE = ".cs-text-control.cs-text-control.cs-text-control.cs-text-control";
const DROPDOWN_BASE = ".cs-dropdown-control.cs-dropdown-control.cs-dropdown-control";
const HOVER_FILL = "var(--cs-btn-face-hover, var(--interactive-hover))";
const OBSIDIAN_HOVER = specificityOf("input[type='text']:not(:disabled):hover");

// A separate text-only rule sets the cursor, so locate the shared chrome by
// its two opt-ins instead of assuming every selector occurs just once.
const shared = rules.find((r) => r.selectors.includes(TEXT_BASE) && r.selectors.includes(DROPDOWN_BASE));
assert.ok(shared, "text fields and dropdowns must share their base chrome");

describe("text fields match selection controls through hover and focus", () => {
	it("shares geometry and fill while outranking Obsidian's input hover", () => {
		for (const declaration of [
			"min-height: max(36px, var(--input-height))",
			"padding: 6px 10px",
			"border-radius: var(--input-radius, var(--radius-s))",
			"corner-shape: var(--input-corner-shape, round)",
			"background: var(--cs-btn-face, var(--interactive-normal))",
			"border: 1px solid var(--cs-btn-border, var(--background-modifier-border))",
		]) assert.ok(shared.body.includes(declaration), declaration);
		assert.ok(compareSpecificity(specificityOf(TEXT_BASE), OBSIDIAN_HOVER) > 0);
		assert.ok(!shared.body.includes("cursor: pointer"), "text fields keep a text cursor");
	});

	it("keeps the dropdown hover fill throughout editing without repainting its border", () => {
		for (const state of ["hover", "focus", "active"]) {
			const selector = `.cs-text-control.cs-text-control:not(:disabled):${state}`;
			const rule = ruleFor(selector);
			assert.ok(rule.body.includes(`background-color: ${HOVER_FILL}`));
			assert.ok(!/border(?:-color)?:/.test(rule.body));
			assert.ok(compareSpecificity(specificityOf(selector), specificityOf(TEXT_BASE)) >= 0);
			assert.ok(rule.selectors.some((s) => s.startsWith(".cs-dropdown-control")));
		}
	});

	it("shares the focus ring but leaves invalid fields' red border and ring intact", () => {
		const focus = `${TEXT_BASE}:not(:disabled):not(.cs-input-invalid):focus`;
		const rule = ruleFor(focus);
		assert.ok(rule.selectors.includes(`${DROPDOWN_BASE}:focus-within`));
		assert.ok(rule.body.includes("border-color: var(--background-modifier-border-focus)"));
		assert.ok(compareSpecificity(specificityOf(focus), specificityOf(TEXT_BASE)) > 0);
		const error = "input.cs-input-invalid.cs-input-invalid.cs-input-invalid.cs-input-invalid";
		assert.ok(compareSpecificity(specificityOf(error), specificityOf(TEXT_BASE)) > 0);
		assert.ok(ruleFor(error).body.includes("box-shadow: 0 0 0 1px var(--text-error)"));
	});
});

describe("compound and multiline fields keep their specialized layout", () => {
	it("changes the ID field and its + overlay as one surface", () => {
		const field = ruleFor('.cs-tag-input-row > input[type="text"].cs-tag-input-field.cs-text-control');
		assert.ok(field.body.includes("background: var(--cs-tag-field-bg)"));
		assert.ok(field.body.includes("padding-inline-end: calc(var(--cs-tag-add-size) + 5px)"));
		assert.ok(ruleFor(".cs-tag-add-slot").body.includes("background: var(--cs-tag-field-bg)"));
		for (const selector of [
			".cs-tag-input-row:hover > input:not(:disabled)",
			".cs-tag-input-row:focus-within > input:not(:disabled)",
			".cs-tag-input-row > input:not(:disabled):active",
		]) {
			// Both surfaces read the native field state, so disabling the input
			// immediately stops painting its hover/focus fill on the overlay too.
			const rule = ruleFor(selector);
			assert.ok(rule.body.includes(`--cs-tag-field-bg: ${HOVER_FILL}`));
			assert.ok(rule.selectors.includes(`${selector} + .cs-tag-add-slot`));
		}
	});

	it("rounds the + end-cap one pixel inside the field's own Obsidian corners", () => {
		const slot = ruleFor(".cs-tag-add-slot");
		for (const corner of ["start-end", "end-end"]) {
			assert.ok(
				slot.body.includes(`border-${corner}-radius: calc(var(--input-radius, var(--radius-s)) - 1px)`),
				`${corner} must track the field radius, not a fixed token`,
			);
		}
		assert.ok(slot.body.includes("corner-shape: var(--input-corner-shape, round)"));
		const add = ruleFor(".cs-tag-add-btn");
		assert.ok(add.body.includes("border-radius: inherit"));
		assert.ok(add.body.includes("corner-shape: inherit"), "the hover tint follows the end-cap's shape");
	});

	it("gives the paste textarea Obsidian's textarea radius instead of the pill input radius", () => {
		const paste = ruleFor(".cs-import-paste-input.cs-text-control.cs-text-control.cs-text-control.cs-text-control");
		assert.ok(paste.body.includes("border-radius: var(--textarea-radius, var(--input-radius, var(--radius-s)))"));
	});

	it("leaves the inner combobox input transparent in every pointer/focus state", () => {
		for (const state of ["hover", "active", "focus", "focus-visible"]) {
			const rule = ruleFor(`.cs-combobox-control input[type="text"].cs-combobox-input:${state}`);
			assert.ok(rule.body.includes("background: transparent"));
			assert.ok(rule.body.includes("box-shadow: none"));
			assert.ok(rule.body.includes("border: 0"));
		}
	});
});
