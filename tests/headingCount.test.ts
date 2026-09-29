/**
 * tests/headingCount.test.ts — the one "(N)" every counted heading ends with.
 *
 * The settings tab's lists, both setup-recovery windows and the two vault
 * sidebars each built their own count once, and it showed: one space from the
 * title here, a flex gap and a margin away there, in the heading's colour in
 * one place and grey in the next. `ui/headingCount.ts` and `.cs-heading-count`
 * are the single version now. The fake DOM has no cascade, so the look is
 * pinned from both ends — what the helpers build, and what `styles.css` does
 * with it. Each surface's own suite checks that it goes through them.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendHeadingCount, headingWithCount } from "../src/ui/headingCount";
import { parseRules, valueOf } from "./support/cssInjectorHarness";
import { installFakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

installFakeDom();

describe("a heading's count", () => {
	it("is one span that carries its own leading space", () => {
		const heading = createDiv();
		heading.appendText("Backups");
		const count = appendHeadingCount(heading, 3);
		assert.ok(count.hasClass("cs-heading-count"));
		assert.equal(count.textContent, " (3)");
		assert.equal(heading.textContent, "Backups (3)", "the heading reads as one phrase, space included");
	});

	it("groups digits the way the interface language does", () => {
		assert.equal(appendHeadingCount(createDiv(), 1234).textContent, " (1,234)");
	});

	// A foldable heading's name element is a flex row (chevron, then title), so
	// a bare title and count would be two flex items — the row's gap between
	// them, and a long title wrapping beside its count.
	it("keeps a Setting heading's title and count together in one span", () => {
		const fragment = headingWithCount("My callout types", 4);
		assert.equal(fragment.childNodes.length, 1, "one flex item, not two");
		const label = fragment.childNodes[0] as HTMLElement;
		assert.equal(label.tagName.toLowerCase(), "span");
		assert.equal(label.childNodes.length, 2);
		assert.equal(label.childNodes[0]?.textContent, "My callout types");
		assert.ok((label.childNodes[1] as HTMLElement).hasClass("cs-heading-count"));
		assert.equal(label.textContent, "My callout types (4)");
	});
});

describe("how styles.css draws a heading's count", () => {
	const rules = parseRules(readRepoFile("styles.css"));
	const naming = rules.filter((rule) => rule.selector.includes(".cs-heading-count"));

	// A rule of its own for one surface is how the four came apart before.
	it("is one rule for every surface, plus the mobile colour step", () => {
		assert.deepEqual(naming.map((rule) => rule.selector), [
			".cs-heading-count",
			".is-mobile .setting-item-heading .cs-heading-count",
		]);
	});

	it("sits a margin past its own space, muted, a step below its heading's size and at medium weight", () => {
		const base = naming[0]!;
		// `nowrap` would drop the leading space where the count opens a flex
		// item — the setup comparison's section titles.
		assert.equal(valueOf(base, "white-space"), "pre");
		assert.match(valueOf(base, "margin-inline-start") ?? "", /^\d*\.?\d+em$/, "in em, so it scales with the heading");
		assert.equal(valueOf(base, "color"), "var(--text-muted)");
		assert.equal(valueOf(base, "font-weight"), "var(--font-medium)");
		assert.match(valueOf(base, "font-size") ?? "", /^0?\.\d+em$/, "in em, a fraction of its heading's own size");
	});

	// Obsidian's mobile settings headings are `--text-muted` themselves.
	it("steps one shade lighter where the heading itself is muted", () => {
		assert.equal(valueOf(naming[1]!, "color"), "var(--text-faint)");
	});

	it("gets no extra flex gap in the setup comparison's title row", () => {
		const toggle = rules.filter((rule) => rule.selector === ".cs-recovery-comparison .cs-recovery-section-toggle");
		assert.equal(toggle.length, 1);
		assert.ok(!toggle[0]!.props.includes("gap"), "a gap would sit between the title and its count as well");
	});
});
