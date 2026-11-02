/**
 * tests/secondaryButtons.test.ts — who paints the plugin's grey buttons.
 *
 * Since decision 14 of the native-look plan, **Obsidian does**, every one. A
 * window's Cancel (a `<button class="mod-cancel">` in Obsidian's
 * `.modal-button-container`), the settings' buttons (Import, Export, Reset, …),
 * Pick an icon's **Manage libraries** and the import window's Upload/Paste get
 * no face, edge, hover or focus ring from the plugin: Obsidian's `button` rules
 * draw them, so they look exactly like Obsidian's own buttons (on macOS that is
 * a flat grey button with no hover step, as in Obsidian's own dialogs).
 *
 * The last grey face of the plugin's own, the style windows' row of border
 * sides (`.cs-border-side-btn`, on `--cs-btn-face`), went with those windows
 * on 2026-10-25: the style pages use Obsidian's switches.
 *
 * This file is arithmetic over the stylesheet, not a rendering test.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Rule = { selector: string; declarations: string };

/** Flattens `@media`/`@supports` rather than skipping them — hover rules live inside one. */
function parseRules(css: string): Rule[] {
	const out: Rule[] = [];
	let depth = 0;
	let buffer = "";
	let selector = "";
	let blockStart = 0;

	for (let i = 0; i < css.length; i++) {
		const char = css[i];
		if (char === "{") {
			if (depth === 0) {
				selector = buffer.trim();
				blockStart = i + 1;
			}
			depth++;
		} else if (char === "}") {
			depth--;
			if (depth === 0) {
				const body = css.slice(blockStart, i);
				if (selector.startsWith("@")) out.push(...parseRules(body));
				else out.push({ selector, declarations: body });
				buffer = "";
				continue;
			}
		}
		if (depth === 0) buffer += char;
	}
	return out;
}

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rules = parseRules(css);

/**
 * Selectors of grey buttons that Obsidian paints. None of them may appear in a
 * rule that sets a face, an edge or a shadow.
 */
const NATIVE_BUTTONS = [".modal-button-container", ".icon-picker-manage-libraries", ".cs-import-action"];

describe("Obsidian paints the plain grey buttons", () => {
	it("no rule of the plugin's gives them a face, an edge or a shadow", () => {
		const painted = rules.filter(
			(r) =>
				NATIVE_BUTTONS.some((b) => r.selector.replace(/\s+/g, " ").includes(b)) &&
				/(?:^|;)\s*(background(?:-color)?|border(?:-color)?|box-shadow)\s*:/.test(r.declarations),
		);
		assert.deepStrictEqual(
			painted.map((r) => r.selector.replace(/\s+/g, " ")),
			[],
		);
	});

	it("the settings' buttons carry no class of the plugin's to paint", () => {
		// They used to wear `.cs-settings-neutral-btn`; it is gone from both
		// sides, so a future rule cannot quietly bring the old face back.
		assert.ok(!css.includes("cs-settings-neutral-btn"));
	});

	it("the plugin declares no grey-button face of its own", () => {
		// `--cs-btn-face` and family were the face a button of the plugin's
		// drew itself with; a new one should be Obsidian's button instead.
		assert.doesNotMatch(css, /--cs-btn-(face|border)/);
	});
});
