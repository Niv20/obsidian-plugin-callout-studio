/**
 * tests/dropdownOptionRows.test.ts — how a dropdown's option rows and a callout
 * row's id line are laid out, as far as the stylesheet decides it.
 *
 * Two things that went wrong by being said twice:
 *
 * - **Option padding.** The command editor's and the palette editor's selects
 *   gave their option *row* `padding: 8px 12px` while the label inside it
 *   already carried `padding: 6px 12px`. The text then started 25px inside the
 *   popup and the rows were 45px tall instead of 29px. Since 2026-10-23 the
 *   padding lives on the row, as on Obsidian's `.menu-item`, and only there,
 *   and nothing pads a row a second time. (The plain choices whose labels
 *   carried it open Obsidian's own menu now.)
 * - **The id line's ellipsis.** Code counted the ids that would fit and drew
 *   `...`, while `text-overflow: ellipsis` drew a `…` of its own on top, so one
 *   list showed clean dots, a glued `…` and the two overlapping. The cut is now
 *   the browser's alone (the markup half is in `calloutCombobox.test.ts`).
 *
 * Read from `styles.css` because layout is not observable here; the rendered
 * result was checked in Chrome against Obsidian's real `app.css`.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Rule {
	selectors: string[];
	decls: Map<string, string>;
}

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rules: Rule[] = [];
const pattern = /([^{}]+)\{([^{}]*)\}/g;
let match: RegExpExecArray | null;
while ((match = pattern.exec(css)) !== null) {
	const decls = new Map<string, string>();
	for (const declaration of (match[2] ?? "").split(";")) {
		const colon = declaration.indexOf(":");
		if (colon < 0) continue;
		decls.set(
			declaration.slice(0, colon).trim(),
			declaration
				.slice(colon + 1)
				.replace(/\s+/g, " ")
				.trim(),
		);
	}
	rules.push({
		selectors: (match[1] ?? "")
			.trim()
			.split(/,\s*\n/)
			.map((s) => s.replace(/\s+/g, " ").trim()),
		decls,
	});
}

function ruleFor(selector: string): Rule {
	const hits = rules.filter((rule) => rule.selectors.includes(selector));
	assert.strictEqual(hits.length, 1, `expected one rule for ${selector}, found ${hits.length}`);
	return hits[0]!;
}

describe("a select's option rows are padded once", () => {
	/** True when a rule sets `padding` or any `padding-*` longhand. */
	const pads = (rule: Rule): boolean =>
		[...rule.decls.keys()].some((p) => p === "padding" || p.startsWith("padding-"));

	it("leaves plain choices' rows to Obsidian's menu, with no row rules of their own", () => {
		// A plain choice (`SelectDropdown`, the language picker) opens Obsidian's
		// own menu since 2026-10-23, so the labels it used to draw are gone.
		for (const gone of [".cs-dropdown-option-label", ".cs-language-option-label"]) {
			assert.ok(!rules.some((rule) => rule.selectors.includes(gone)), `${gone} has no rule left`);
		}
	});

	it("never pads a row a second time from a narrower context", () => {
		// Only the shared row rules (`.cs-combobox-option` on its own, with the
		// Fold menu's row beside it) may pad a row. A rule that reaches a row
		// through some other class — a toolbar, a field, a picker — would push
		// the words in and make that list's rows taller than every other list's.
		const rowPadders = rules.filter(
			(rule) =>
				rule.selectors.some((s) => /\.cs-combobox-option\b/.test(s) && s !== ".cs-combobox-option") &&
				pads(rule),
		);
		assert.deepStrictEqual(
			rowPadders.map((rule) => rule.selectors),
			[],
			"a second layer of padding on the row pushes the text in and changes the row height",
		);
	});
});

describe("a callout's id line is cut in one place, by the browser", () => {
	const line = ".callout-studio-suggestion-id";

	it("clips the line with the native ellipsis and keeps it on one line", () => {
		const rule = ruleFor(line);
		assert.strictEqual(rule.decls.get("white-space"), "nowrap");
		assert.strictEqual(rule.decls.get("overflow"), "hidden");
		assert.strictEqual(rule.decls.get("text-overflow"), "ellipsis");
	});

	it("makes each id an atomic unit that keeps its trailing space", () => {
		// Atomic inline boxes are hidden whole at the clip, never cut mid-word, so
		// the mark always follows an id's own ", ". `pre` keeps that space, which an
		// inline-block would otherwise collapse.
		const item = ruleFor(".callout-studio-suggestion-id-item");
		assert.strictEqual(item.decls.get("display"), "inline-block");
		assert.strictEqual(item.decls.get("white-space"), "pre");
		// A single id longer than the whole line has nowhere to be cut but inside.
		assert.strictEqual(item.decls.get("max-width"), "100%");
		assert.strictEqual(item.decls.get("text-overflow"), "ellipsis");
	});

	it("is left-to-right in any window, aligned with the name above it in an RTL one", () => {
		// Ids are code: the bidi algorithm would reorder a comma-separated run and
		// strand the commas on the wrong side of the words.
		assert.strictEqual(ruleFor(line).decls.get("direction"), "ltr");
		assert.strictEqual(ruleFor(".mod-rtl .callout-studio-suggestion-id").decls.get("text-align"), "right");
	});

	it("has no second truncation mechanism left behind", () => {
		assert.ok(!css.includes("callout-studio-suggestion-id-truncated"));
	});
});
