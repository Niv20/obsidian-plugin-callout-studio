/**
 * tests/dangerButtons.test.ts — every red button is Obsidian's red button.
 *
 * One vocabulary (`src/ui/destructiveButton.ts`): a destructive action is
 * `mod-destructive mod-cta` — `setDestructive().setCta()` on a
 * `ButtonComponent`, `DESTRUCTIVE_BUTTON_CLASSES` on a raw `<button>` — which
 * Obsidian paints solid red on every device. Never the older `mod-warning`,
 * which `.is-mobile` paints grey with bold red text, so the same button was red
 * on a desktop and grey on a phone; and never `ButtonComponent.setWarning()`,
 * which 1.13 deprecates (it is `setDestructive().setCta()` now).
 *
 * And nothing of ours repaints one. Obsidian's hover for it paints
 * `--background-modifier-error-hover`, which is the resting red, so a red button
 * does not change under the pointer — exactly like Obsidian's own Delete. The
 * plugin used to step it darker with a token of its own; this file keeps that
 * from coming back.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DESTRUCTIVE_BUTTON_CLASSES } from "../src/ui/destructiveButton";
import { parseRules } from "./support/cssInjectorHarness";
import { at, literals, pluginSourceFiles, report } from "./support/sourceScan";

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8");
const rules = parseRules(css);

/** A selector with its `:not(…)` arguments removed: what it actually selects. */
const selecting = (selector: string): string => selector.replace(/:not\([^()]*\)/g, "");

describe("a red button's classes", () => {
	it("are Obsidian's destructive confirmation", () => {
		assert.deepStrictEqual(DESTRUCTIVE_BUTTON_CLASSES, ["mod-destructive", "mod-cta"]);
	});

	it("never include mod-warning anywhere in src/", () => {
		const found: string[] = [];
		for (const file of pluginSourceFiles()) {
			for (const literal of literals(file.text)) {
				if (/\bmod-warning\b/.test(literal.value)) found.push(at(file, literal.start));
			}
		}
		assert.deepStrictEqual(found, [], report("mod-warning is grey with red text on mobile", found));
	});

	it("never come from ButtonComponent.setWarning()", () => {
		// MenuItem.setWarning(true) is the menu API and stays; only the button's
		// argument-less form is the deprecated one.
		const found: string[] = [];
		for (const file of pluginSourceFiles()) {
			for (const match of file.code.matchAll(/\.setWarning\(\s*\)/g)) found.push(at(file, match.index ?? 0));
		}
		assert.deepStrictEqual(found, [], report("use setDestructive().setCta()", found));
	});
});

describe("styles.css leaves red buttons to Obsidian", () => {
	it("has no rule for the legacy mod-warning class", () => {
		const named = rules.filter((rule) => /\.mod-warning\b/.test(rule.selector));
		assert.deepStrictEqual(named.map((rule) => rule.selector), []);
	});

	it("repaints no red button, at rest or under the pointer", () => {
		const painting = rules.filter((rule) => /\.mod-destructive\b/.test(selecting(rule.selector)));
		assert.deepStrictEqual(painting.map((rule) => rule.selector), []);
	});

	it("declares no red hover token of its own", () => {
		assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /--cs-btn-danger-face-hover/);
	});
});
