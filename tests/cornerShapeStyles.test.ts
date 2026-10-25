/**
 * tests/cornerShapeStyles.test.ts — the plugin's rounded chrome takes
 * Obsidian's corner tokens, as styles.css draws it.
 *
 * Obsidian rounds every surface from tokens: a radius (`--radius-s/m/l`,
 * `--button-radius`, `--input-radius`, …) and a corner shape (`--corner-shape`,
 * superellipse on macOS, or a component's own such as `--button-corner-shape`).
 * A hard-coded px radius, or a radius without a corner shape, leaves a plain
 * round corner beside Obsidian's squircles on macOS, and ignores the larger
 * touch radii on mobile.
 *
 * So, outside callout rendering, a `border-radius` is a token (or 0, 50% or
 * `inherit`), and the rule also sets a `corner-shape`. The exceptions below are
 * frozen: the list may only shrink.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseRules, valueOf } from "./support/cssInjectorHarness";

const rules = parseRules(readFileSync(join(process.cwd(), "styles.css"), "utf8"));

/** Selectors allowed to break the rule, each with its reason. Shrink only. */
const EXCEPTIONS = new Map<string, string>([
	[".cs-inline-callout", "callout rendering in notes, not plugin chrome"],
	[".cs-heading-callout", "callout rendering in notes, not plugin chrome"],
	[".cs-recovery-preview, .cs-recovery-heading-preview, .cs-recovery-inline-preview", "renders a callout as a note would"],
	[".cs-drag-placeholder", "Obsidian's own drop slot is a literal 5px"],
]);

const FREE = new Set(["0", "50%", "inherit"]);

describe("rounded chrome", () => {
	const rounded = rules.filter((rule) => valueOf(rule, "border-radius") !== undefined);

	it("has rounded rules to check", () => {
		assert.ok(rounded.length > 20);
	});

	it("takes its radius from Obsidian's tokens", () => {
		for (const rule of rounded) {
			if (EXCEPTIONS.has(rule.selector)) continue;
			const radius = valueOf(rule, "border-radius") ?? "";
			if (FREE.has(radius)) continue;
			assert.match(radius, /var\(--/, `${rule.selector} hard-codes border-radius: ${radius}`);
		}
	});

	it("sets a corner shape wherever it sets a radius", () => {
		for (const rule of rounded) {
			if (EXCEPTIONS.has(rule.selector)) continue;
			const radius = valueOf(rule, "border-radius") ?? "";
			if (radius === "0" || radius === "50%") continue;
			assert.ok(valueOf(rule, "corner-shape") !== undefined, `${rule.selector} has a radius but no corner-shape`);
		}
	});

	it("keeps every exception in use, so the list can only shrink", () => {
		for (const selector of EXCEPTIONS.keys()) {
			assert.ok(
				rounded.some((rule) => rule.selector === selector),
				`${selector} no longer needs its exception — remove it`,
			);
		}
	});
});
