/**
 * tests/subheaderRowWrapping.test.ts — what a settings sub-header does when the
 * pane is too narrow to hold its title and its buttons on one line.
 *
 * Two rows ask the question: "My callout types", with **Scan for callouts** and
 * **Add new callout**, and "Saved color palettes", with **New palette**.
 * Obsidian's own answer is to crush the title — `.setting-item` is `nowrap`, so
 * the info box shrinks and shrinks while the buttons stay put, and at a phone
 * width the palettes heading was stacking one word per line beside a button
 * that had not moved. These rows answer the other way: the actions drop whole
 * to a line of their own and the title takes the width back.
 *
 * Three things carry that, and each one is invisible in the place it would
 * break:
 *
 * **The wrap is on `.cs-subheader-row`, not on one of the two rows.** Both rows
 * want it, and a second `flex-wrap` written next to the row that happens to be
 * under discussion is how the two drift apart.
 *
 * **`margin-inline-start: auto` is what keeps the wrapped line trailing.** A
 * flex item that wraps starts the next line at its *leading* edge, which put
 * the buttons under the "M" of "My callout types" instead of out at the pane's
 * trailing edge where they had been a pixel earlier. The auto margin is inert
 * on the unwrapped line — flexing has already eaten the free space there — so
 * it states the pinning once for both states, and it is logical, so RTL is not
 * a second rule but the same one read the other way.
 *
 * **`wrap-reverse` is what puts the CTA on top of the stack, and it reads DOM
 * order to do it.** The buttons stack when even a line of their own is too
 * narrow for both, and the accent button leads the stack the same way it sits
 * furthest out in the horizontal row. `wrap-reverse` gets that by hanging the
 * *last* line at the top — so it is true only while **Add new callout** is last
 * in the control. Nothing about swapping those two `addButton` calls looks like
 * a visual change, `.mod-cta` still renders, every other test stays green, and
 * the stack silently inverts. That coupling is the DOM half below.
 *
 * The pixels are not checked here and cannot be: the fake DOM has no layout
 * engine (see `tests/support/fakeDom.ts`). They were settled in a browser
 * against Obsidian's real `app.css` at pane widths from 900 down to 220, in
 * both directions and with a German-length translation. What is guarded here is
 * the shape that would make those pixels wrong.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCalloutListsScaffold } from "../src/settings/sections/calloutListsScaffold";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { installFakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

installFakeDom();

/* -------------------------------------------------------------------------- */
/* The DOM                                                                    */
/* -------------------------------------------------------------------------- */

function buildMyCalloutTypesHeading(): HTMLElement {
	const ctx = {
		plugin: {
			settingsWriter: { isFrozen: false },
			localState: { isExpanded: () => true, setExpanded: () => {} },
		},
		display: () => {},
		registerDisposer: () => {},
	} as unknown as SettingsSectionContext;
	const host = createDiv();
	buildCalloutListsScaffold(ctx, host, () => Promise.resolve());
	const heading = host.querySelector<HTMLElement>(".cs-callout-list-heading");
	assert.ok(heading, "the scaffold no longer builds a .cs-callout-list-heading");
	return heading;
}

describe("the actions on the My callout types heading", () => {
	it("puts the CTA last, which is what stacks it on top", () => {
		const heading = buildMyCalloutTypesHeading();
		const control = heading.querySelector<HTMLElement>(".setting-item-control");
		assert.ok(control);
		// `children`, not `querySelectorAll("button")`: the fake DOM matches
		// classes, not bare tag names, and the control holds nothing but these two.
		const buttons = [...control.children] as HTMLElement[];
		assert.equal(buttons.length, 2, "the heading no longer carries exactly two actions");
		assert.ok(
			buttons[0]?.hasClass("cs-discover-callouts-btn"),
			"Scan for callouts is no longer the first action in the control. Two " +
				"things ride on that order and both fail silently: the CTA lands on " +
				"the row's outer edge because it is last, and `flex-wrap: wrap-reverse` " +
				"stacks the CTA on top because it is last. Swap them and the accent " +
				"button moves inboard and drops under the grey one.",
		);
		assert.ok(
			!buttons[1]?.hasClass("cs-discover-callouts-btn"),
			"both actions are the discovery button",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* The stylesheet                                                             */
/* -------------------------------------------------------------------------- */

/** Comments stripped, then whitespace flattened so multi-line selectors match. */
const css = readRepoFile("styles.css")
	.replace(/\/\*[\s\S]*?\*\//g, "")
	.replace(/\s+/g, " ");

/** The declarations of the rule whose flattened selector is exactly `selector`. */
function ruleFor(selector: string): string {
	const at = css.indexOf(`${selector} {`);
	assert.notEqual(at, -1, `no rule for "${selector}"`);
	const open = at + selector.length + 1;
	return css.slice(open + 1, css.indexOf("}", open));
}

const ROW = ".callout-studio-settings .cs-subheader-row.setting-item";
const ROW_CONTROL = ".callout-studio-settings .cs-subheader-row .setting-item-control";
const LIST_CONTROL =
	".callout-studio-settings .cs-callout-list-heading .setting-item-control";
const ROW_BUTTON =
	".callout-studio-settings .cs-subheader-row .setting-item-control > button";

describe("a sub-header row wraps its actions instead of crushing its title", () => {
	it("declares the wrap once, for every row that has actions", () => {
		assert.match(
			ruleFor(ROW),
			/flex-wrap:\s*wrap\s*;/,
			`${ROW} no longer wraps. Without it Obsidian's nowrap row shrinks the ` +
				"title toward nothing while the buttons hold their width",
		);
		assert.doesNotMatch(
			ruleFor(".callout-studio-settings .cs-callout-list-heading.setting-item"),
			/flex-wrap/,
			"the callout-list heading declares its own flex-wrap again. It shares " +
				`${ROW} with the palettes heading; two writers is how the two rows ` +
				"stop agreeing about when to wrap",
		);
	});

	it("pins the wrapped line to the trailing edge, in both directions", () => {
		assert.match(
			ruleFor(ROW_CONTROL),
			/margin-inline-start:\s*auto\s*;/,
			`${ROW_CONTROL} no longer pins its actions. A wrapped flex item starts ` +
				"the next line at the leading edge, which parks the buttons under the " +
				"first letter of the title",
		);
	});

	it("stacks the CTA on top, with every line still trailing", () => {
		const rule = ruleFor(LIST_CONTROL);
		assert.match(
			rule,
			/flex-wrap:\s*wrap-reverse\s*;/,
			"the two actions no longer stack CTA-first. `wrap-reverse` hangs the " +
				"last line at the top, and the CTA is last — see the DOM half above",
		);
		assert.match(
			rule,
			/justify-content:\s*flex-end\s*;/,
			"the control no longer states its own alignment. It is per-line, so it " +
				"is what holds a stacked Scan to the trailing edge under a stacked Add",
		);
	});

	it("lets every action button shrink below its longest word", () => {
		const rule = ruleFor(ROW_BUTTON);
		assert.match(rule, /min-inline-size:\s*0\s*;/);
		assert.match(rule, /overflow-wrap:\s*anywhere\s*;/);
		assert.equal(
			css.includes(`${LIST_CONTROL} > button {`),
			false,
			"the button sizing is scoped back to the callout-list heading. Obsidian's " +
				"`button` is nowrap with a fixed height, so its min-content width is " +
				"the whole label: scoped narrowly, a long translation of New palette " +
				"runs off the trailing edge of the pane instead of wrapping in place",
		);
	});

	it("says trailing in logical properties, so RTL needs no rule of its own", () => {
		for (const selector of [ROW, ROW_CONTROL, LIST_CONTROL, ROW_BUTTON]) {
			assert.doesNotMatch(
				ruleFor(selector),
				/(?<![-\w])(?:margin|padding|inset|border)?-?(?:left|right)\s*:/,
				`${selector} reaches for a physical side. These four rules are the ` +
					"whole of the responsive header layout and all of it is logical, " +
					"which is the only reason RTL is the same code path and not a copy",
			);
		}
	});
});
