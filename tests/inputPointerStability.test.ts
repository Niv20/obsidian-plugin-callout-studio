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
 * - **Dropdowns are drawn like Obsidian's combobox button.** The plugin keeps
 *   its own trigger element (it opens the plugin's list), but paints it from
 *   Obsidian's dropdown tokens, with Obsidian's states: a hover step, the 3px
 *   focus ring, and an open fill plus the ring.
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

	it("draw nothing of their own on an invalid value: Obsidian says it under the field", () => {
		// A rejected value is shown as Obsidian shows one, a line under the
		// field (`setErrorMessage`, findings S5-V1 and S7-06); core draws no red
		// edge or ring on the field of an invalid setting row, so neither do we.
		assert.ok(!css.includes("cs-input-invalid"));
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

	it("keep the hover edge while the pointer is over the + button, but never over focus", () => {
		// The + button takes the pointer, so over it the input is not the hovered
		// element. The row repeats Obsidian's hover edge — except on a focused
		// field, which keeps Obsidian's focus edge.
		const hover = ruleFor(".cs-tag-input-row:hover > input:not(:disabled):not(:focus)");
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

describe("dropdowns are drawn like Obsidian's combobox button", () => {
	it("rest on Obsidian's dropdown tokens: height, face, shadow, corners", () => {
		const base = ruleFor(DROPDOWN_BASE);
		for (const declaration of [
			"height: var(--input-height)",
			"border: 0",
			"background-color: var(--dropdown-background, var(--interactive-normal))",
			"box-shadow: var(--input-shadow)",
			"border-radius: var(--input-radius, var(--radius-s))",
			"corner-shape: var(--input-corner-shape, round)",
			"padding-inline: var(--cs-dropdown-pad-start) var(--cs-dropdown-pad-end)",
		]) assert.ok(base.body.includes(declaration), declaration);
	});

	it("step the face and shadow under a mouse and under Obsidian's press class", () => {
		const hover = ruleFor(".cs-dropdown-control.cs-dropdown-control:not(:disabled):not(.cs-dropdown-disabled):hover");
		const press = ruleFor(".cs-dropdown-control.cs-dropdown-control.mobile-tap:not(:disabled):not(.cs-dropdown-disabled)");
		for (const rule of [hover, press]) {
			assert.ok(rule.body.includes("background-color: var(--dropdown-background-hover, var(--interactive-hover))"));
			assert.ok(rule.body.includes("box-shadow: var(--input-shadow-hover)"));
		}
	});

	it("draw the focus ring, and the open fill plus the ring, above the hover", () => {
		const hoverSelector = ".cs-dropdown-control.cs-dropdown-control:not(:disabled):not(.cs-dropdown-disabled):hover";
		const four = ".cs-dropdown-control.cs-dropdown-control.cs-dropdown-control.cs-dropdown-control";
		const focus = ruleFor(`${four}:focus-within`);
		const open = ruleFor(`${four}.is-open`);
		assert.ok(focus.body.includes("box-shadow: 0 0 0 3px var(--background-modifier-border-focus)"));
		assert.ok(open.body.includes("background-color: var(--metadata-label-background-active)"));
		assert.ok(open.body.includes("box-shadow: 0 0 0 3px var(--background-modifier-border-focus)"));
		// Hovering a focused or open control must not hide its ring: each of the
		// two is at least as specific as the hover and written after it.
		const hover = ruleFor(hoverSelector);
		for (const [selector, rule] of [[`${four}:focus-within`, focus], [`${four}.is-open`, open]] as const) {
			assert.ok(compareSpecificity(specificityOf(selector), specificityOf(hoverSelector)) >= 0, selector);
			assert.ok(rules.indexOf(rule) > rules.indexOf(hover), `${selector} comes after the hover`);
		}
	});

	it("give a plain choice's hidden width-sizer the same room the control keeps around its text", () => {
		// The sizer makes the trigger as wide as its longest option; it only
		// works if it adds exactly the control's padding, gap and caret.
		const sizer = rules.find((rule) => rule.selectors.includes(".cs-dropdown-width-sizer > span"));
		assert.ok(sizer, "the sizer's span rule exists");
		assert.ok(sizer.body.includes("var(--cs-dropdown-pad-start)"));
		assert.ok(/calc\(var\(--cs-dropdown-gap\) \+ var\(--icon-xs\) \+ var\(--cs-dropdown-pad-end\)\)/.test(sizer.body.replace(/\s+/g, " ")));
		// Both read the variables from the same rule, so they cannot drift.
		const shared = ruleFor(".cs-dropdown-control");
		assert.ok(shared.selectors.includes(".cs-dropdown-width-sizer"));
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
