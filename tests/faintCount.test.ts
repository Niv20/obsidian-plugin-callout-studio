/**
 * tests/faintCount.test.ts — the one faint count every counted heading or line
 * ends with, drawn as Obsidian's Search pane draws a file's match count.
 *
 * The settings tab's lists, the setup comparison, Pick an icon's library
 * headings, the two vault sidebars and the row menu's "Find callouts" all show
 * how many things they hold. Since 2026-10-23 (item 57 of the native-look plan)
 * that is a small faint number at the end of the row, with no brackets, built
 * by `ui/faintCount.ts` and drawn by one rule, `.cs-faint-count`. The fake DOM
 * has no cascade, so the look is pinned from both ends — what the helpers
 * build, and what `styles.css` does with it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendFaintCount } from "../src/ui/faintCount";
import { parseRules, valueOf } from "./support/cssInjectorHarness";
import { installFakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

installFakeDom();

describe("a faint count", () => {
	it("is one span, no brackets, carrying its own leading space", () => {
		const heading = createDiv();
		heading.appendText("Backups");
		const count = appendFaintCount(heading, 3);
		assert.ok(count.hasClass("cs-faint-count"));
		assert.equal(count.textContent, " 3");
		// The space is in the text, so the heading still reads as one phrase.
		assert.equal(heading.textContent, "Backups 3");
	});

	it("groups digits the way the interface language does", () => {
		assert.equal(appendFaintCount(createDiv(), 1234).textContent, " 1,234");
	});
});

describe("how styles.css draws a faint count", () => {
	const rules = parseRules(readRepoFile("styles.css"));
	const naming = rules.filter((rule) => rule.selector.includes(".cs-faint-count"));

	// A rule of its own for one surface is how the counts came apart before.
	it("is one rule for every surface, plus a menu row's", () => {
		assert.deepEqual(naming.map((rule) => rule.selector), [
			".cs-faint-count",
			".menu-item-title > .cs-faint-count",
		]);
	});

	it("is Obsidian's `.tree-item-flair`: faint, a step smaller, at the end of its row", () => {
		const base = naming[0]!;
		assert.equal(valueOf(base, "color"), "var(--text-faint)");
		assert.equal(valueOf(base, "font-size"), "var(--font-ui-smaller)");
		assert.equal(valueOf(base, "margin-inline-start"), "auto");
		assert.equal(valueOf(base, "padding-inline-start"), "var(--size-4-1)");
		assert.equal(valueOf(base, "flex-shrink"), "0");
		// `pre` keeps the leading space in a flex row and the number on one line.
		assert.equal(valueOf(base, "white-space"), "pre");
	});

	it("floats to the end of a menu row, whose title is not a flex row", () => {
		assert.equal(valueOf(naming[1]!, "float"), "inline-end");
	});

	it("is the only count style left: no muted \"(N)\"", () => {
		assert.ok(!rules.some((rule) => rule.selector.includes("cs-heading-count")));
	});

	it("gets no extra flex gap in the setup comparison's title row", () => {
		const toggle = rules.filter((rule) => rule.selector === ".cs-recovery-comparison .cs-recovery-section-toggle");
		assert.equal(toggle.length, 1);
		assert.ok(!toggle[0]!.props.includes("gap"), "a gap would sit between the title and its count as well");
	});
});
