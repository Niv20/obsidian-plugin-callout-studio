/**
 * tests/dangerButtons.test.ts — every red button is Obsidian's quiet red button.
 *
 * One vocabulary (`src/ui/destructiveButton.ts`): a destructive action is
 * `mod-destructive` alone — `setDestructive()` on a `ButtonComponent`,
 * `DESTRUCTIVE_BUTTON_CLASSES` on a raw `<button>` — which Obsidian paints as red
 * words on a light red wash on every device, the look of its own Log out button
 * and of our Reset everything. Never `setCta()` beside it (that is the solid
 * red, which the plugin no longer wears), never the older `mod-warning`, which
 * `.is-mobile` paints grey with bold red text, so the same button was red on a
 * desktop and grey on a phone, and never `ButtonComponent.setWarning()`, which
 * 1.13 deprecates. `mod-warning` on a paragraph is something else — Obsidian's
 * warning-coloured line, as in its own "Delete file?" — and stays allowed.
 *
 * And nothing of ours repaints one. A locked red button is Obsidian's 70% dim
 * of the same face (`aria-disabled`), and a lit one has no hover of its own: the
 * plugin used to step the solid red darker with a token of its own, and this
 * file keeps that from coming back. The two small ✕ badges the stylesheet does
 * paint (the icon tile's and the image panel's) wear the same quiet red by the
 * same tokens, never the palette's solid `--color-red`.
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
	it("are Obsidian's quiet destructive button, with no solid-red mod-cta", () => {
		assert.deepStrictEqual(DESTRUCTIVE_BUTTON_CLASSES, ["mod-destructive"]);
	});

	it("never pair setDestructive() with setCta(), which is the solid red", () => {
		const found: string[] = [];
		for (const file of pluginSourceFiles()) {
			for (const match of file.code.matchAll(/\.setDestructive\(\s*\)\s*\.setCta\(\s*\)/g))
				found.push(at(file, match.index ?? 0));
		}
		assert.deepStrictEqual(found, [], report("a red button is setDestructive() alone", found));
	});

	it("never include mod-warning, which only ever classes a warning paragraph", () => {
		const found: string[] = [];
		for (const file of pluginSourceFiles()) {
			for (const literal of literals(file.text)) {
				if (!/\bmod-warning\b/.test(literal.value)) continue;
				// The createEl call this literal is an option of, in the same statement.
				const before = file.text.slice(0, literal.start);
				const call = before.slice(before.lastIndexOf("createEl("));
				const tag = call.includes(";") ? undefined : /^createEl\(\s*"(\w+)"/.exec(call)?.[1];
				if (tag !== "p") found.push(at(file, literal.start));
			}
		}
		assert.deepStrictEqual(found, [], report("mod-warning is grey with red text on a mobile button", found));
	});

	it("never come from ButtonComponent.setWarning()", () => {
		// MenuItem.setWarning(true) is the menu API and stays; only the button's
		// argument-less form is the deprecated one.
		const found: string[] = [];
		for (const file of pluginSourceFiles()) {
			for (const match of file.code.matchAll(/\.setWarning\(\s*\)/g)) found.push(at(file, match.index ?? 0));
		}
		assert.deepStrictEqual(found, [], report("use setDestructive() alone", found));
	});
});

describe("styles.css leaves red buttons to Obsidian", () => {
	it("has no rule for the legacy mod-warning class", () => {
		const named = rules.filter((rule) => /\.mod-warning\b/.test(rule.selector));
		assert.deepStrictEqual(
			named.map((rule) => rule.selector),
			[],
		);
	});

	it("repaints no red button, at rest or under the pointer", () => {
		const painting = rules.filter((rule) => /\.mod-destructive\b/.test(selecting(rule.selector)));
		assert.deepStrictEqual(
			painting.map((rule) => rule.selector),
			[],
		);
	});

	it("declares no red hover token of its own", () => {
		assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /--cs-btn-danger-face-hover/);
	});

	it("paints its two ✕ badges in the quiet red, with no solid red, white glyph or hover of their own", () => {
		const badges = rules.filter((rule) =>
			/\b(?:cs-icon-tile-clear|icon-picker-image-delete)\b/.test(rule.selector),
		);
		assert.ok(badges.length >= 2, "the badge rules are found");
		const painted = badges.filter((rule) => rule.props.includes("background-color"));
		assert.equal(painted.length, 2, "one painting rule per badge");
		for (const rule of badges) {
			const text = rule.decls.join(";");
			assert.doesNotMatch(text, /--color-red|#fff\b|#e93147/, `${rule.selector} wears no solid red`);
			// The reveal rules (`:hover` on the tile) only fade the badge in; a colour on hover is what is banned.
			if (rule.props.some((prop) => prop === "color" || prop.startsWith("background"))) {
				assert.doesNotMatch(rule.selector, /:hover/, `${rule.selector} has no hover colour`);
			}
		}
		for (const rule of painted) {
			const text = rule.decls.join(";");
			assert.match(text, /--background-modifier-error/, `${rule.selector}: Obsidian's red wash`);
			assert.match(text, /color:\s*var\(--text-error\)/, `${rule.selector}: Obsidian's red words`);
		}
	});
});
