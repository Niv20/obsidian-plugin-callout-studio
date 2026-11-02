/**
 * tests/accentButtons.test.ts — purple (CTA) buttons hover the way Obsidian's do.
 *
 * Obsidian hovers `button.mod-cta` to `--interactive-accent-hover`, a lighter
 * purple in both modes. The plugin used to derive a hover of its own from the
 * resting accent — darker in light mode — across the settings tab, every window
 * and the editor. That is gone, so Save and Confirm hover exactly like
 * Obsidian's. This file keeps it gone.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseRules } from "./support/cssInjectorHarness";

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8");
const rules = parseRules(css);

/** A selector with its `:not(…)` arguments removed: what it actually selects. */
const selecting = (selector: string): string => selector.replace(/:not\([^()]*\)/g, "");

describe("the accent hover is Obsidian's", () => {
	it("declares no accent hover token of its own", () => {
		assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /--cs-btn-accent-face-hover/);
	});

	it("repaints no CTA button under the pointer", () => {
		const hovering = rules.filter((rule) => {
			const selected = selecting(rule.selector);
			return /\.mod-cta\b/.test(selected) && selected.includes(":hover");
		});
		assert.deepStrictEqual(
			hovering.map((rule) => rule.selector),
			[],
		);
	});
});
