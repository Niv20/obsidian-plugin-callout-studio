/**
 * tests/importBoxStyles.test.ts — the shared import/export option boxes, the
 * plugin import window's paste box and links, and the Recommended pill, as
 * styles.css draws them.
 *
 * pluginImportModal.test.ts drives the window on the fake DOM, which has no
 * cascade, so none of this is visible to it. Each rule here is one a tidy-up
 * would plausibly "restore":
 *
 * - A card is drawn as Obsidian draws its own radio cards (finding S9-10): a
 *   2px outline in the border colour, no fill, no hover, and the chosen card's
 *   outline in the accent. Its radio is Obsidian's own, drawn by app.css.
 * - Chrome stays grey-lit. The accent belongs to the chosen card (and the tint
 *   a dragged file lands in), and nothing on a card turns green: a file that
 *   was uploaded is confirmed by a notice, not by its icon. The purple icons
 *   the boxes used to wear, and the green one after them, are the regressions
 *   this guards.
 * - The paste box has one fixed height and scrolls: it neither grows with what
 *   is pasted nor can be dragged larger.
 * - "Recommended" is Obsidian's own flat flair, painted by Obsidian: the plugin
 *   sets no fill, colour, corners or size for it, only drops the flair's margin
 *   where the title line's gap already spaces it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseRules, valueOf, type CssRule } from "./support/cssInjectorHarness";

const rules = parseRules(readFileSync(join(process.cwd(), "styles.css"), "utf8"));


/** Every rule whose selector list names `selector` as one of its entries. */
function rulesNaming(selector: string): CssRule[] {
	return rules.filter((r) => r.selector.split(",").map((s) => s.trim()).includes(selector));
}

function only(selector: string): CssRule {
	const hits = rulesNaming(selector);
	assert.equal(hits.length, 1, `expected one rule for ${selector}, found ${hits.length}`);
	return hits[0]!;
}

describe("the shared import/export boxes at rest", () => {
	it("draws a card as an outline with no fill, as Obsidian's radio cards are", () => {
		const box = only(".cs-option-box");
		assert.equal(valueOf(box, "border"), "2px solid var(--background-modifier-border)");
		assert.equal(valueOf(box, "border-radius"), "var(--radius-m)");
		assert.equal(valueOf(box, "corner-shape"), "var(--corner-shape)");
		assert.equal(valueOf(box, "background"), undefined, "no fill of its own");
	});

	it("sets the icon in the icon grey, with no tile", () => {
		const icon = only(".cs-option-box-icon");
		assert.equal(valueOf(icon, "color"), "var(--text-muted)");
		assert.equal(valueOf(icon, "background"), undefined);
	});

	it("spends the accent only on the active card and on a file's drop target", () => {
		const accented = rules
			.filter((r) => /\.cs-option-|\.cs-import-(?:vault|manual|radio|action|paste)/.test(r.selector))
			.filter((r) => r.decls.some((d) => /--(?:interactive-accent|text-accent|checkbox-color)\b/.test(d)));
		assert.ok(accented.length > 0);
		for (const rule of accented) {
			assert.match(rule.selector, /\.cs-option-box\.is-(?:selected|drop-target)\b/, rule.selector);
		}
	});

	it("never turns a box, or anything on it, green", () => {
		const green = rules
			.filter((r) => /\.cs-(?:option|import)-/.test(r.selector))
			.filter((r) => r.decls.some((d) => /--(?:text-success|color-green|background-modifier-success)\b/.test(d)));
		assert.deepEqual(green.map((r) => r.selector), [], "success is a notice, not a colour");
		assert.deepEqual(
			rules.filter((r) => r.selector.includes(".is-filled") && r.selector.includes(".cs-option-")).map((r) => r.selector),
			[],
		);
	});

	it("leaves the radio to Obsidian, but for its margin and a disabled one's fade", () => {
		const radio = only(".cs-option-radio");
		assert.deepEqual(radio.props, ["margin"]);
		const disabled = only(".cs-option-radio:disabled");
		assert.equal(valueOf(disabled, "pointer-events"), "none", "a click on it reaches its card");
	});

	it("outlines the chosen card in the accent, with no wash and no ring", () => {
		const chosen = only(".cs-option-box.is-selected");
		assert.deepEqual(chosen.props, ["border-color"]);
		assert.equal(valueOf(chosen, "border-color"), "var(--interactive-accent)");
	});

	it("sets the plugin import window's instructions as a caption, not body text", () => {
		const intro = only(".cs-import-instructions");
		assert.equal(valueOf(intro, "font-size"), "var(--font-ui-small)");
		assert.equal(valueOf(intro, "color"), "var(--text-muted)");
	});
});

describe("the shared cards under the pointer", () => {
	it("do not answer it: only a card's own controls do, as Obsidian's", () => {
		const hovering = rules.filter((r) => /\.cs-option-/.test(r.selector) && r.selector.includes(":hover"));
		assert.deepEqual(hovering.map((r) => r.selector), []);
	});
});

describe("the plugin import window's cards", () => {
	it("gives the paste box one fixed height that scrolls and cannot be dragged larger", () => {
		const box = only(".cs-import-paste-input.cs-text-control");
		assert.match(valueOf(box, "height") ?? "", /^\d+px$/, "a fixed height, not auto and not a share of the content");
		assert.equal(valueOf(box, "resize"), "none");
		assert.equal(valueOf(box, "overflow"), "auto");
		for (const grows of ["field-sizing", "min-height", "max-height"]) {
			assert.equal(box.props.includes(grows), false, `${grows}: nothing that lets it grow with its text`);
		}
		assert.equal(valueOf(box, "flex"), "0 0 100%", "a line of its own, across the card");
		assert.equal(valueOf(box, "direction"), "ltr", "code reads left to right, even in a right-to-left window");
		// Nothing else of the plugin's sets a text field's height any more (the
		// face is Obsidian's), so two classes clear Obsidian's `textarea` (0,0,1).
		assert.deepStrictEqual(
			rules.filter((r) => r.selector.includes(".cs-text-control") && r.props.includes("height")).map((r) => r.selector),
			[".cs-import-paste-input.cs-text-control"],
		);
		assert.equal(valueOf(only(".cs-import-manual"), "flex-wrap"), "wrap", "the card lets it take that line");
	});

	it("holds the vault card back while the probe runs, and says so to reduced motion", () => {
		const held = rulesNaming(".cs-import-vault.is-checking").find((r) => r.at.length === 0);
		assert.ok(held);
		assert.match(valueOf(held, "animation") ?? "", /^cs-import-reveal /);
		const calm = rulesNaming(".cs-import-vault.is-checking").find((r) =>
			r.at.includes("@media (prefers-reduced-motion: reduce)"),
		);
		assert.ok(calm);
	});

	it("leaves a card's own button to Obsidian, except that it never shrinks", () => {
		// Upload and Paste are Obsidian's own buttons (decision 14 of the
		// native-look plan). The only thing the plugin adds is layout: a long
		// file name must not squeeze them.
		const button = only(".cs-option-box .cs-import-action");
		assert.deepEqual(button.props, ["flex-shrink"]);
		assert.equal(valueOf(button, "flex-shrink"), "0");
		assert.deepEqual(rules.filter((r) => r.selector.includes(".cs-import-action") && r !== button).map((r) => r.selector), []);
	});
});

describe("the Recommended tag", () => {
	it("is Obsidian's flat flair, with no paint of the plugin's own", () => {
		const badgeRules = rules.filter((r) => r.selector.includes(".cs-recommended-badge"));
		assert.ok(badgeRules.length > 0);
		for (const rule of badgeRules) {
			for (const prop of ["background", "background-color", "color", "border-radius", "font-size", "padding"]) {
				assert.equal(valueOf(rule, prop), undefined, `${rule.selector} sets ${prop}`);
			}
		}
		assert.deepEqual(
			rules.filter((r) => r.selector.includes(".cs-recommended-badge") && r.selector.includes(":hover")),
			[],
		);
	});

	it("lets the title line's gap space it, instead of the flair's margin", () => {
		const head = only(".cs-option-box-head > .cs-recommended-badge");
		assert.equal(valueOf(head, "margin-inline-start"), "0");
	});
});
