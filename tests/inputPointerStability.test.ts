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
/** The property names a rule declares. `background` inside a token NAME such as
 *  `--background-modifier-border-hover` is a value, not a paint. */
function propertiesOf(rule: { body: string }): string[] {
	return rule.body.split(";").map((d) => (d.split(":")[0] ?? "").trim()).filter((p) => p !== "");
}
function ruleFor(selector: string) {
	const hits = rules.filter((rule) => rule.selectors.includes(selector));
	assert.strictEqual(hits.length, 1, `expected one rule for ${selector}`);
	return hits[0]!;
}
const TEXT_BASE = ".cs-text-control.cs-text-control.cs-text-control.cs-text-control";
const DROPDOWN_BASE = ".cs-dropdown-control.cs-dropdown-control.cs-dropdown-control";
const HOVER_EDGE = "var(--cs-field-border-hover, var(--background-modifier-border-hover))";
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

	it("never repaints a field's fill: hover, focus, press and an open list all leave it alone", () => {
		// Buttons change fill under the pointer; fields answer with their edge. That
		// is what lets the list that opens from a dropdown wear the field's own face
		// (see dropdownPopupSurface.test.ts) and be the same grey in every state.
		const painters = rules.filter(
			(rule) => rule.selectors.some((s) => /^\.cs-(text|dropdown)-control/.test(s))
				&& propertiesOf(rule).some((p) => p === "background" || p.startsWith("background-")),
		);
		assert.deepStrictEqual(painters, [shared], "only the shared base paints a field");
		assert.ok(!shared.body.includes("--cs-btn-face-hover"), "a field has no hover fill to read");
	});

	it("answers hover, focus, a press and an open list with one and the same thin edge", () => {
		// Clicking a hovered field must not change its border: every engaged state
		// is the hover edge, with no thicker border and no ring.
		const textHover = ".cs-text-control.cs-text-control:not(:disabled):hover";
		const dropdownHover =
			".cs-dropdown-control.cs-dropdown-control:not(:disabled):not(.cs-dropdown-disabled):hover";
		const hover = ruleFor(textHover);
		assert.ok(hover.selectors.includes(dropdownHover), "dropdowns and text fields share the hover edge");
		assert.deepStrictEqual(propertiesOf(hover), ["border-color"], "hover is an edge: no fill, no ring");
		assert.ok(hover.body.includes(`border-color: ${HOVER_EDGE}`));

		const focus = `${TEXT_BASE}:not(:disabled):not(.cs-input-invalid):focus`;
		const engaged = ruleFor(focus);
		assert.ok(engaged.selectors.includes(`${DROPDOWN_BASE}:focus-within`));
		// A tap on a phone does not focus a <button> trigger, and the list it opens
		// draws the same edge, so an open list carries it itself.
		assert.ok(engaged.selectors.includes(`${DROPDOWN_BASE}.is-open`));
		// Obsidian's press class: a phone has no hover.
		assert.ok(engaged.selectors.includes(".cs-dropdown-control.cs-dropdown-control.mobile-tap:not(:disabled):not(.cs-dropdown-disabled)"));
		assert.ok(engaged.body.includes(`border-color: ${HOVER_EDGE}`), "focus is the hover edge, not a stronger border");
		assert.ok(engaged.body.includes("box-shadow: none"), "and draws no ring");
		assert.ok(!/border-color:\s*var\(--background-modifier-border-focus\)/.test(engaged.body));
	});

	it("keeps those rules above Obsidian's input hover and below the invalid red", () => {
		const textHover = ".cs-text-control.cs-text-control:not(:disabled):hover";
		const hover = ruleFor(textHover);
		// Text half is level with its base, so it has to come after it to win — and
		// it must still outrank Obsidian's own input hover.
		assert.ok(compareSpecificity(specificityOf(textHover), specificityOf(TEXT_BASE)) >= 0);
		assert.ok(rules.indexOf(hover) > rules.indexOf(shared), "a tie with the base is settled by source order");
		assert.ok(compareSpecificity(specificityOf(textHover), OBSIDIAN_HOVER) > 0);

		const focus = `${TEXT_BASE}:not(:disabled):not(.cs-input-invalid):focus`;
		assert.ok(compareSpecificity(specificityOf(focus), specificityOf(TEXT_BASE)) > 0);
		assert.ok(compareSpecificity(specificityOf(focus), OBSIDIAN_HOVER) > 0);

		// Validation owns the red border and ring, hovered or focused.
		const error = "input.cs-input-invalid.cs-input-invalid.cs-input-invalid.cs-input-invalid";
		assert.ok(compareSpecificity(specificityOf(error), specificityOf(TEXT_BASE)) > 0);
		assert.ok(compareSpecificity(specificityOf(error), specificityOf(textHover)) > 0);
		assert.ok(ruleFor(error).body.includes("border-color: var(--text-error)"));
		assert.ok(ruleFor(error).body.includes("box-shadow: 0 0 0 1px var(--text-error)"));
	});
});

describe("compound and multiline fields keep their specialized layout", () => {
	it("paints the ID field and its + overlay as one constant surface, and answers the pointer over the + too", () => {
		const field = ruleFor('.cs-tag-input-row > input[type="text"].cs-tag-input-field.cs-text-control');
		assert.ok(field.body.includes("background: var(--cs-tag-field-bg)"));
		assert.ok(field.body.includes("padding-inline-end: calc(var(--cs-tag-add-size) + 5px)"));
		assert.ok(ruleFor(".cs-tag-add-slot").body.includes("background: var(--cs-tag-field-bg)"));

		// Both read one variable, so the end-cap is exactly the field's fill — and
		// because a field's fill never changes, it is declared once, as the resting
		// face, and never re-declared under a pointer or focus state.
		assert.ok(ruleFor(".cs-tag-input-row").body.includes("--cs-tag-field-bg: var(--cs-btn-face, var(--interactive-normal))"));
		assert.strictEqual(css.match(/--cs-tag-field-bg\s*:/g)?.length, 1);

		// The + button re-enables pointer events, so over it the input is not the
		// hovered element and the shared `:hover` would let go of the edge. The row
		// carries it, but never over the invalid red.
		const hover = ruleFor(".cs-tag-input-row:hover > input:not(:disabled):not(.cs-input-invalid)");
		assert.ok(hover.body.includes(`border-color: ${HOVER_EDGE}`));
		assert.deepStrictEqual(propertiesOf(hover), ["border-color"]);
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
