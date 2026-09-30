/**
 * tests/importBoxStyles.test.ts — the shared import/export option boxes, the
 * plugin import window's paste box and links, and the Recommended pill, as
 * styles.css draws them.
 *
 * pluginImportModal.test.ts drives the window on the fake DOM, which has no
 * cascade, so none of this is visible to it. Each rule here is one a tidy-up
 * would plausibly "restore":
 *
 * - A box is drawn as the settings lists draw a callout row: a borderless pill
 *   on the raised surface, its icon on a tile of the window's own colour. Both
 *   are the `--cs-surface` pair, which is what keeps them apart on mobile dark.
 * - Chrome stays grey-lit. The accent belongs to one thing, the active card of
 *   the plugin import window (and the dashed outline a dragged file lands in),
 *   and nothing on a box turns green: a file that was uploaded is confirmed by
 *   a notice, not by its icon. The purple icons the boxes used to wear, and
 *   the green one after them, are the regressions this guards.
 * - A box that a click would act on answers the pointer with a neutral step of
 *   its own fill; nothing else does.
 * - Every hover sits behind `(hover: hover)`, so a tapped box on a phone
 *   doesn't stay lit.
 * - The paste box has one fixed height and scrolls: it neither grows with what
 *   is pasted nor can be dragged larger.
 * - The pill's word is trimmed to cap height and baseline. Without that, a UI
 *   font with a deep line box below the baseline (Ploni, and most Hebrew faces)
 *   sets the word visibly high in the pill.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseRules, valueOf, type CssRule } from "./support/cssInjectorHarness";

const rules = parseRules(readFileSync(join(process.cwd(), "styles.css"), "utf8"));

const HOVER_MEDIA = "@media (hover: hover)";
const TEXT_BOX = "@supports (text-box: trim-both cap alphabetic)";
/** The window's own colour, and the shade raised off it. */
const SURFACE = "var(--cs-surface, var(--background-primary))";
const RAISED = "var(--cs-surface-raised, var(--background-secondary))";

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
	it("draws a box as a borderless pill on the raised surface, like a callout row", () => {
		const box = only(".cs-option-box");
		assert.equal(valueOf(box, "background"), RAISED);
		assert.equal(valueOf(box, "border-radius"), "8px");
		assert.deepEqual(
			box.props.filter((p) => p.startsWith("border") && p !== "border-radius"),
			[],
			"no border: the fill is what makes it a box",
		);
		const row = rulesNaming(".callout-studio-row").find((r) => r.at.length === 0 && r.props.includes("background"));
		assert.ok(row);
		assert.equal(valueOf(row, "background"), RAISED, "the row it is modelled on");
	});

	it("sets the icon on a tile of the window's own colour, in the icon grey", () => {
		const tile = only(".cs-option-box-icon");
		assert.equal(valueOf(tile, "background"), SURFACE);
		assert.equal(valueOf(tile, "color"), "var(--text-muted)");
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

	it("marks a chooser's box with a quiet chevron and a plugin import card with a radio dot", () => {
		assert.equal(valueOf(only(".cs-option-box-mark"), "color"), "var(--text-faint)");
		const dot = only(".cs-import-radio");
		assert.equal(valueOf(dot, "border-radius"), "50%");
		assert.equal(valueOf(dot, "color"), "transparent", "its check is there, and uncoloured, until chosen");
		const chosen = only(".cs-option-box.is-selected .cs-import-radio");
		assert.equal(valueOf(chosen, "background"), "var(--checkbox-color)");
		assert.equal(valueOf(chosen, "color"), "var(--text-on-accent)");
	});

	it("rings the active card in the accent without moving anything", () => {
		const chosen = only(".cs-option-box.is-selected");
		assert.equal(valueOf(chosen, "box-shadow"), "inset 0 0 0 2px var(--interactive-accent)");
		assert.match(valueOf(chosen, "background") ?? "", /^color-mix\( in srgb, var\(--interactive-accent\) \d+%, /);
	});

	it("sets the plugin import window's instructions as a caption, not body text", () => {
		const intro = only(".cs-import-instructions");
		assert.equal(valueOf(intro, "font-size"), "var(--font-ui-small)");
		assert.equal(valueOf(intro, "color"), "var(--text-muted)");
	});
});

describe("the shared import/export boxes on hover", () => {
	it("steps an enabled box's own fill toward the text colour", () => {
		const rule = only('.cs-option-box[tabindex="0"]:hover');
		assert.deepEqual(rule.at, [HOVER_MEDIA]);
		assert.match(
			valueOf(rule, "background") ?? "",
			/^color-mix\( in srgb, var\(--cs-surface-raised, var\(--background-secondary\)\) \d+%, var\(--text-normal\) \)$/,
		);
	});

	it("reserves hover feedback for boxes a click would act on, on hover-capable devices", () => {
		const hovering = rules.filter(
			(r) => r.selector.includes(".cs-option-box") && r.selector.includes(":hover"),
		);
		assert.ok(hovering.length > 0);
		for (const rule of hovering) {
			assert.deepEqual(rule.at, [HOVER_MEDIA]);
			// A chooser's box (`[tabindex="0"]`), a card that a click would
			// choose (`is-choosable`), and a card's own button. The active card
			// and an empty one stay as they are under the pointer.
			assert.match(
				rule.selector,
				/^\.cs-option-box(?:\[tabindex="0"\]:hover(?: \.cs-option-box-mark)?|\.is-choosable:hover| \.cs-import-action:hover)$/,
				rule.selector,
			);
		}
	});

	it("steps a choosable card the same way a chooser's box steps", () => {
		const box = only('.cs-option-box[tabindex="0"]:hover');
		const card = only(".cs-option-box.is-choosable:hover");
		assert.equal(valueOf(card, "background"), valueOf(box, "background"));
	});
});

describe("the plugin import window's cards", () => {
	it("gives the paste box one fixed height that scrolls and cannot be dragged larger", () => {
		const box = only(".cs-import-paste-input.cs-text-control.cs-text-control.cs-text-control.cs-text-control");
		assert.match(valueOf(box, "height") ?? "", /^\d+px$/, "a fixed height, not auto and not a share of the content");
		assert.equal(valueOf(box, "resize"), "none");
		assert.equal(valueOf(box, "overflow"), "auto");
		for (const grows of ["field-sizing", "min-height", "max-height"]) {
			assert.equal(box.props.includes(grows), false, `${grows}: nothing that lets it grow with its text`);
		}
		assert.equal(valueOf(box, "flex"), "0 0 100%", "a line of its own, across the card");
		assert.equal(valueOf(box, "direction"), "ltr", "code reads left to right, even in a right-to-left window");
		// `.cs-text-control` sets `height: auto` from four classes; this has to
		// outweigh it rather than rely on coming later in the file.
		const base = rulesNaming(".cs-text-control.cs-text-control.cs-text-control.cs-text-control")
			.find((r) => r.props.includes("height"));
		assert.ok(base);
		assert.equal(valueOf(base, "height"), "auto");
		assert.equal(
			box.selector.split(".").length - 1,
			5,
			"one class more than the four of the rule whose height it takes back",
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

	it("gives a card's own button a face of its own, so it stays a button on a phone", () => {
		const button = only(".cs-option-box .cs-import-action");
		assert.equal(valueOf(button, "flex-shrink"), "0", "never squeezed by a long file name");
		assert.equal(valueOf(button, "background-color"), "var(--cs-btn-face, var(--interactive-normal))");
		assert.match(valueOf(button, "border") ?? "", /^1px solid /);
	});
});

describe("the Recommended pill", () => {
	it("centres its word on the capitals, where text-box is supported", () => {
		const word = only(".cs-recommended-badge-text");
		assert.deepEqual(word.at, [TEXT_BOX]);
		assert.equal(valueOf(word, "text-box"), "trim-both cap alphabetic");
		const pill = rulesNaming(".cs-recommended-badge").find((r) => r.at.includes(TEXT_BOX));
		assert.ok(pill, "the trimmed pill sets its own block padding");
		assert.ok(valueOf(pill, "padding-block"), "with the line box gone, padding is the pill's height");
	});

	it("sets its word a step below the UI's smaller size", () => {
		const pill = rulesNaming(".cs-recommended-badge").find((r) => r.at.length === 0);
		assert.ok(pill);
		assert.equal(valueOf(pill, "font-size"), "calc(var(--font-ui-smaller) - 1px)");
	});

	it("is a chip of the window's own colour, so it needs no hover fill of its own", () => {
		const pill = rulesNaming(".cs-recommended-badge").find((r) => r.at.length === 0);
		assert.ok(pill);
		assert.equal(valueOf(pill, "background"), SURFACE);
		assert.deepEqual(
			rules.filter((r) => r.selector.includes(".cs-recommended-badge") && r.selector.includes(":hover")),
			[],
		);
	});
});
