/**
 * tests/rowHoverStyles.test.ts — how a list row answers the pointer, as
 * styles.css draws it.
 *
 * A row is not clickable; only its buttons are. So, as in every Obsidian list:
 *
 * - The row itself never changes on hover — no fill, no transition to one.
 *   The plugin's own row kinds are the callout rows, `.cs-callout-row`, and
 *   the version rows, `.cs-recovery-row`, both Obsidian setting rows; every
 *   other list in the settings is Obsidian's. (`.callout-studio-row`, the
 *   plugin's old row, is still matched below so it cannot come back with a
 *   hover.)
 * - Pointing anywhere on a row only sharpens that row's own icon buttons, with
 *   Obsidian's icon opacity steps (`--icon-opacity` → `--icon-opacity-hover`).
 * - Every row hover sits behind `(hover: hover)`. On touch, WebKit replays the
 *   last tap's hover onto whatever row lands under it after a re-render, which
 *   is how a dragged row on an iPhone used to light up.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseRules, valueOf } from "./support/cssInjectorHarness";

const rules = parseRules(readFileSync(join(process.cwd(), "styles.css"), "utf8"));

const ROW = /\.(?:callout-studio-row|cs-callout-row|cs-recovery-row)\b/;

/** Split a selector list on its top-level commas (not the ones inside `:is()`). */
function selectors(list: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = "";
	for (const ch of list) {
		if (ch === "(") depth++;
		if (ch === ")") depth--;
		if (ch === "," && depth === 0) {
			parts.push(current.trim());
			current = "";
		} else current += ch;
	}
	parts.push(current.trim());
	return parts;
}

const rowHoverRules = rules.filter((rule) =>
	selectors(rule.selector).some((s) => ROW.test(s) && s.includes(":hover")),
);

describe("list rows on hover", () => {
	it("has row hover rules to check", () => {
		assert.ok(rowHoverRules.length > 0);
	});

	it("puts every row hover behind (hover: hover)", () => {
		for (const rule of rowHoverRules) {
			assert.ok(
				rule.at.some((at) => at.startsWith("@media (hover: hover)")),
				`${rule.selector} hovers outside (hover: hover)`,
			);
		}
	});

	it("never fills the row itself", () => {
		for (const rule of rowHoverRules) {
			const onRow = selectors(rule.selector).some((s) => /\.(?:callout-studio-row|cs-callout-row|cs-recovery-row)[^\s>+~]*:hover$/.test(s));
			if (!onRow) continue;
			assert.equal(valueOf(rule, "background"), undefined, `${rule.selector} fills the row`);
			assert.equal(valueOf(rule, "background-color"), undefined, `${rule.selector} fills the row`);
		}
	});

	it("sharpens the row's own icon buttons with Obsidian's opacity steps", () => {
		const sharpen = rowHoverRules.find((rule) => valueOf(rule, "--icon-opacity") !== undefined);
		assert.ok(sharpen, "no rule sharpens a hovered row's icons");
		assert.equal(valueOf(sharpen, "--icon-opacity"), "var(--icon-opacity-hover)");
		assert.match(sharpen.selector, /:not\([^)]*\[aria-disabled="true"\]/, "a blocked button must stay dim");
	});

	it("lets the plugin's own row icons read --icon-opacity", () => {
		for (const selector of [".callout-studio-row-buttons button svg", ".cs-drag-handle svg"]) {
			const rule = rules.find((r) => r.selector === selector && r.at.length === 0);
			assert.ok(rule, `${selector} is missing`);
			assert.equal(valueOf(rule, "opacity"), "var(--icon-opacity)", `${selector} ignores --icon-opacity`);
		}
	});

	it("has no transition left on the row surface", () => {
		for (const rule of rules) {
			if (!selectors(rule.selector).some((s) => /^(?:\.modal \.cs-recovery-rows > )?\.(?:callout-studio-row|cs-recovery-row)(?:\.setting-item:not\(\.setting-item-heading\))?$/.test(s))) continue;
			assert.equal(valueOf(rule, "transition"), undefined, `${rule.selector} still animates a fill`);
		}
	});
});
