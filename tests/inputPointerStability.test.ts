/**
 * tests/inputPointerStability.test.ts — how the plugin's text fields and
 * dropdowns answer the pointer and the keyboard, as styles.css draws them.
 *
 * Two different contracts live side by side (decision 14 of the native-look
 * plan):
 *
 * - **Text fields are Obsidian's own.** A field marked `.cs-text-control`
 *   (Display name, the palette's Name, Callout IDs, the search boxes, the paste
 *   box) gets no face, edge, size or focus ring from the plugin. Obsidian's
 *   `input[type='text']` and `textarea` rules draw all of it, including the
 *   focus edge and 2px ring after a mouse click. The plugin only adds layout
 *   (widths, the IDs field's "+" cap, the paste box's height) and the red of an
 *   invalid value.
 * - **Dropdowns still wear the plugin's face** (until they become Obsidian's
 *   combobox look): one fill that never changes, and one thin edge for hover,
 *   focus, a press and an open list.
 *
 * The CSS is read as text, so this suite needs no browser: each rule is split
 * into its selectors and its body, and the assertions talk about those.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";

/** styles.css with its comments removed, so a word in a comment is never read as CSS. */
const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(
	/\/\*[\s\S]*?\*\//g,
	"",
);

/** One CSS rule: the selectors before its `{`, and the text between the braces. */
interface Rule {
	selectors: string[];
	body: string;
}

/**
 * Every rule in the stylesheet, flattened. A rule nested inside `@media` comes
 * out as its own entry too, because the pattern only matches innermost braces.
 */
const rules: Rule[] = [];
const pattern = /([^{}]+)\{([^{}]*)\}/g;
let match: RegExpExecArray | null;
while ((match = pattern.exec(css)) !== null) {
	rules.push({
		selectors: (match[1] ?? "").trim().split(/,\s*\n/).map((s) => s.trim().replace(/\s+/g, " ")),
		body: match[2] ?? "",
	});
}

/**
 * The property names a rule declares, e.g. `["border-color", "box-shadow"]`.
 * Splitting on `:` keeps a token NAME such as `--background-modifier-border-hover`
 * (which sits after the colon) from being read as a `background` declaration.
 */
function propertiesOf(rule: Rule): string[] {
	return rule.body.split(";").map((d) => (d.split(":")[0] ?? "").trim()).filter((p) => p !== "");
}

/** The single rule that lists `selector`; fails if there are none or several. */
function ruleFor(selector: string): Rule {
	const hits = rules.filter((rule) => rule.selectors.includes(selector));
	assert.strictEqual(hits.length, 1, `expected one rule for ${selector}`);
	return hits[0]!;
}

const DROPDOWN_BASE = ".cs-dropdown-control.cs-dropdown-control.cs-dropdown-control";
const HOVER_EDGE = "var(--cs-field-border-hover, var(--background-modifier-border-hover))";

describe("text fields are Obsidian's own", () => {
	/** Rules whose selector puts a style on a `.cs-text-control` element. */
	const textRules = rules.filter((rule) => rule.selectors.some((s) => s.includes(".cs-text-control")));

	it("are still marked, so the per-screen layout rules have a hook", () => {
		assert.ok(textRules.length > 0);
	});

	it("never get an edge, a ring or an outline from the plugin", () => {
		// Hover, focus and a press are Obsidian's: its focus edge plus the 2px
		// ring, on a click too. A plugin rule setting any of these would bring
		// back the old one-thin-edge behaviour for some fields and not others.
		for (const rule of textRules) {
			for (const property of propertiesOf(rule)) {
				assert.ok(
					!/^(border(-color|-width|-style)?|box-shadow|outline)$/.test(property),
					`${rule.selectors.join(", ")} sets ${property}`,
				);
			}
		}
	});

	it("paint no face of their own, except the IDs field's, which IS Obsidian's field colour", () => {
		const painters = textRules.filter((rule) =>
			propertiesOf(rule).some((p) => p === "background" || p.startsWith("background-")),
		);
		assert.deepStrictEqual(
			painters.map((rule) => rule.selectors.join(", ")),
			['.cs-tag-input-row > input[type="text"].cs-tag-input-field.cs-text-control'],
		);
		// It paints through a variable so its "+" cap can read the very same
		// colour; see the next suite for what that variable holds.
		assert.ok(painters[0]!.body.includes("background: var(--cs-tag-field-bg)"));
	});

	it("keep an invalid value red, above Obsidian's own focus rule", () => {
		const error = "input.cs-input-invalid.cs-input-invalid.cs-input-invalid.cs-input-invalid";
		// Obsidian's focused field is `input[type='text']:focus`, (0,2,1).
		assert.ok(compareSpecificity(specificityOf(error), specificityOf("input[type='text']:focus")) > 0);
		const rule = ruleFor(error);
		assert.ok(rule.selectors.includes(`${error}:focus`), "focused or not, the value stays red");
		assert.ok(rule.body.includes("border-color: var(--text-error)"));
		assert.ok(rule.body.includes("box-shadow: 0 0 0 1px var(--text-error)"));
	});
});

describe("the Callout IDs field and its + cap", () => {
	it("paint one colour, Obsidian's field colour, and swap it together under the pointer", () => {
		// The cap is a separate element laid over the field's end, so it can only
		// match the field if both read one variable.
		assert.ok(ruleFor(".cs-tag-input-row").body.includes("--cs-tag-field-bg: var(--background-modifier-form-field)"));
		assert.ok(ruleFor(".cs-tag-add-slot").body.includes("background: var(--cs-tag-field-bg)"));
		// Obsidian's hovered field takes the form-field hover colour; the row
		// moves the variable there, so the cap follows.
		assert.ok(ruleFor(".cs-tag-input-row:hover").body.includes("--cs-tag-field-bg: var(--background-modifier-form-field-hover)"));
	});

	it("keep the hover edge while the pointer is over the + button, but never over focus or red", () => {
		// The + button takes the pointer, so over it the input is not the hovered
		// element. The row repeats Obsidian's hover edge — except on a focused
		// field (which keeps Obsidian's focus edge) and an invalid one (red).
		const hover = ruleFor(".cs-tag-input-row:hover > input:not(:disabled):not(:focus):not(.cs-input-invalid)");
		assert.deepStrictEqual(propertiesOf(hover), ["border-color"]);
		assert.ok(hover.body.includes("border-color: var(--background-modifier-border-hover)"));
	});

	it("sit the cap inside the field's border and corners, whatever Obsidian's border width", () => {
		// 1px on the desktop, 0 on mobile (where Obsidian's fields have no edge).
		const slot = ruleFor(".cs-tag-add-slot");
		assert.ok(slot.body.includes("inset-block: var(--input-border-width, 1px)"));
		assert.ok(slot.body.includes("inset-inline-end: var(--input-border-width, 1px)"));
		for (const corner of ["start-end", "end-end"]) {
			assert.ok(
				slot.body.includes(`border-${corner}-radius: calc(var(--input-radius, var(--radius-s)) - var(--input-border-width, 1px))`),
				`${corner} must track the field's radius minus its border`,
			);
		}
		assert.ok(slot.body.includes("corner-shape: var(--input-corner-shape, round)"));
		const add = ruleFor(".cs-tag-add-btn");
		assert.ok(add.body.includes("border-radius: inherit"));
		assert.ok(add.body.includes("corner-shape: inherit"), "the hover tint follows the cap's shape");
	});

	it("reserve the cap's room at the field's end, so the first typed letter never jumps", () => {
		const field = ruleFor('.cs-tag-input-row > input[type="text"].cs-tag-input-field.cs-text-control');
		assert.ok(field.body.includes("padding-inline-end: calc(var(--cs-tag-add-size) + 5px)"));
	});
});

describe("the import window's paste box", () => {
	it("takes Obsidian's textarea corners by setting none of its own", () => {
		// Obsidian's `textarea` rule reads `--textarea-radius` before the input
		// radius, which keeps a tall box from becoming a pill on mobile.
		const own = rules.filter(
			(rule) => rule.selectors.some((s) => s.startsWith(".cs-import-paste-input")) && /border-radius/.test(rule.body),
		);
		assert.deepStrictEqual(own, []);
	});

	it("has one fixed height that scrolls, and cannot be dragged larger", () => {
		const paste = ruleFor(".cs-import-paste-input.cs-text-control");
		assert.ok(paste.body.includes("height: 132px"));
		assert.ok(paste.body.includes("resize: none"));
		assert.ok(paste.body.includes("overflow: auto"));
	});
});

describe("dropdowns keep the plugin's face and one thin edge", () => {
	it("answer hover, focus, a press and an open list with the same edge and no ring", () => {
		const hover = ruleFor(".cs-dropdown-control.cs-dropdown-control:not(:disabled):not(.cs-dropdown-disabled):hover");
		assert.deepStrictEqual(propertiesOf(hover), ["border-color"], "hover is an edge: no fill, no ring");
		assert.ok(hover.body.includes(`border-color: ${HOVER_EDGE}`));

		const engaged = ruleFor(`${DROPDOWN_BASE}:focus-within`);
		// A tap on a phone does not focus a <button> trigger, so an open list
		// carries the edge itself; `.mobile-tap` is Obsidian's press class.
		assert.ok(engaged.selectors.includes(`${DROPDOWN_BASE}.is-open`));
		assert.ok(engaged.selectors.includes(".cs-dropdown-control.cs-dropdown-control.mobile-tap:not(:disabled):not(.cs-dropdown-disabled)"));
		assert.ok(engaged.body.includes(`border-color: ${HOVER_EDGE}`));
		assert.ok(engaged.body.includes("box-shadow: none"));
	});

	it("leave the inner combobox input transparent in every pointer and focus state", () => {
		// The combobox's wrapper is the visible box; the text input inside it must
		// not draw a second box (Obsidian's input rules would, without this).
		for (const state of ["hover", "active", "focus", "focus-visible"]) {
			const rule = ruleFor(`.cs-combobox-control input[type="text"].cs-combobox-input:${state}`);
			assert.ok(rule.body.includes("background: transparent"));
			assert.ok(rule.body.includes("box-shadow: none"));
			assert.ok(rule.body.includes("border: 0"));
		}
	});
});
