/**
 * tests/gradientDirectionMobileSize.test.ts — the palette editor's three
 * direction arrows keep their 26px square on a phone.
 *
 * Obsidian 1.13 sizes every button in a setting's control column with
 * `.is-phone .modal .setting-item-control button:not(.clickable-icon)
 * { width: 100% }`, which is **(0,4,1)**. The plugin's override sat at (0,4,0)
 * — four classes, no element — and so lost on the one element selector, and
 * nothing said so: in Chrome the rule's companion `flex: 0 0 26px` still laid
 * the buttons out at 26px, so every desktop check, and a Chrome-based phone
 * emulation, looked right.
 *
 * WebKit is where it showed. The row sits in a control column that shrink-wraps
 * (`.cs-row-inline`), and WebKit sizes that column from the buttons' own
 * `width` — `100%` of an unknown, so just the icon and borders: 16px each, 56px
 * for the row — then lays the buttons out at 26px. The third arrow stuck out
 * 16px past the card's right edge on an iPhone, at every width from 320 to 430.
 * With `width: 26px` actually winning, both engines measure the row at 86px.
 *
 * The pixels are not checked here and cannot be: the fake DOM has no layout
 * engine (see `tests/support/fakeDom.ts`). They were measured in Chrome and in
 * WebKit against Obsidian 1.13.7's real `app.css`. What is guarded is the
 * cascade shape that made them wrong.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";
import { readRepoFile } from "./support/sourceScan";

/**
 * Obsidian 1.13's `.is-phone .modal .setting-item-control
 * button:not(.clickable-icon)`. Re-count it from `app.css` when the app moves
 * on — a lower number here would let the override quietly lose again.
 */
const CORE_BUTTON_WIDTH = specificityOf(
	".is-phone .modal .setting-item-control button:not(.clickable-icon)",
);

const css = readRepoFile("styles.css")
	.replace(/\/\*[\s\S]*?\*\//g, "")
	.replace(/\s+/g, " ");

/** Every `selector { declarations }` whose selector mentions the arrows under `.is-mobile`. */
function mobileArrowRules(): { selector: string; body: string }[] {
	const rules: { selector: string; body: string }[] = [];
	for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selector = (m[1] ?? "").trim();
		if (
			selector.includes(".is-mobile") &&
			selector.includes(".cs-gradient-dir-btn") &&
			!selector.includes(",")
		) {
			rules.push({ selector, body: m[2] ?? "" });
		}
	}
	return rules;
}

describe("the gradient direction arrows on a phone", () => {
	it("counts Obsidian's own button width as (0,4,1)", () => {
		// The constant above is the whole premise; if the helper ever stops
		// counting `:not()` by its argument this test would pass for the wrong reason.
		assert.deepEqual(CORE_BUTTON_WIDTH, [0, 4, 1]);
	});

	it("pins their size with a rule that outranks Obsidian's width: 100%", () => {
		const sizing = mobileArrowRules().filter((r) => /(^|;|\s)width\s*:\s*26px/.test(r.body));
		assert.equal(sizing.length, 1, "expected exactly one .is-mobile rule pinning width: 26px on the arrows");
		const { selector, body } = sizing[0] ?? { selector: "", body: "" };
		assert.ok(
			compareSpecificity(specificityOf(selector), CORE_BUTTON_WIDTH) > 0,
			`${selector} no longer outranks Obsidian's (0,4,1) button width. It must: ` +
				"a rule that only ties-or-trails it loses `width: 26px`, Chrome hides the loss " +
				"through flex-basis, and on iOS the third arrow sticks out of the card.",
		);
		assert.match(body, /flex:\s*0 0 26px/, "the arrows no longer pin their flex-basis beside the width");
		assert.match(body, /padding:\s*0\s*;/, "the arrows no longer reset the padding Obsidian forces on mobile buttons");
	});
});
