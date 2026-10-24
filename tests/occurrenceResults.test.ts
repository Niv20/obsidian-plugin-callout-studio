import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OccurrenceResults } from "../src/usage/occurrenceResults";
import { scanCalloutOccurrences } from "../src/usage/scanCalloutOccurrences";
import { installFakeDom } from "./support/fakeDom";

const dom = installFakeDom();

function harness() {
	const content = dom.document.createElement("div") as unknown as HTMLElement;
	const cards = new OccurrenceResults(100);
	const render = (results: ReturnType<typeof scanCalloutOccurrences>, limit = 100): void =>
		cards.render(content, results, limit, true, () => {}, () => {});
	const rows = (): HTMLButtonElement[] => Array.from(content.querySelectorAll<HTMLButtonElement>(".cs-occurrences-result"));
	return { cards, content, render, rows };
}

describe("occurrence result identity", () => {
	it("draws each file as Obsidian's Search pane does: a title row over one box of result rows", () => {
		const h = harness();
		const a = scanCalloutOccurrences("folder/a.md", "[!note]\n# [!note]\n[!tip]");
		const b = scanCalloutOccurrences("b.md", "[!note]");
		h.render([...a, ...b]);
		const sections = Array.from(h.content.querySelectorAll<HTMLElement>(".cs-sidebar-file"));
		assert.deepEqual(sections.map((section) => section.dataset.path), ["folder/a.md", "b.md"]);
		// The note's path without its `.md`, and the count in Obsidian's faint flair.
		assert.deepEqual(sections.map((section) => section.querySelector(".cs-sidebar-file-name")?.textContent), ["folder/a", "b"]);
		assert.deepEqual(sections.map((section) => section.querySelector(".tree-item-flair")?.textContent), ["3", "1"]);
		assert.deepEqual(sections.map((section) => section.querySelector<HTMLButtonElement>('button[data-action="file"]')?.dataset.path),
			["folder/a.md", "b.md"]);
		assert.deepEqual(sections.map((section) => section.querySelector(".cs-sidebar-file-link")?.textContent),
			["folder/a 3", "b 1"], "the accessible name has the count, after a space");
		assert.deepEqual(sections.map((section) => section.querySelector(".search-result-file-matches")?.children.length), [3, 1]);
		for (const section of sections) {
			assert.ok(section.hasClass("tree-item") && section.hasClass("search-result"), "Obsidian's search group");
			assert.equal(section.children.length, 2, "the title row, then the box");
			const link = section.children[0]!;
			assert.equal(link.tagName, "BUTTON");
			for (const cls of ["tree-item-self", "search-result-file-title", "is-clickable"]) assert.ok(link.hasClass(cls), cls);
			assert.equal(link.getAttribute("aria-label"), null, "the visible file name must not create a redundant hover popup");
			assert.equal(link.getAttribute("title"), null);
			for (const row of Array.from(section.children[1]!.children)) {
				assert.ok(row.classList.contains("search-result-file-match"), "each result is a match row of the box");
			}
		}
		assert.deepEqual(h.rows().map((row) => h.cards.getOccurrence(row)?.line), [0, 1, 2, 0]);
		assert.equal(h.content.querySelectorAll("button.cs-sidebar-result").length, 4);
		assert.equal(h.content.querySelectorAll(".cs-sidebar-location").length, 4);
	});
	it("clears a previous file's selection in place, retaining selection for the same note", () => {
		const h = harness();
		const results = [...scanCalloutOccurrences("Claude Warm.md", "[!note]"),
			...scanCalloutOccurrences("Colored Candy.md", "[!note]")];
		h.render(results);
		const row = h.rows()[1]!;
		h.cards.select(results[1]!);
		h.cards.setActiveFile("Colored Candy.md");
		assert.equal(row.getAttribute("aria-current"), "true");
		h.cards.setActiveFile("Claude Warm.md");
		assert.equal(row.getAttribute("aria-current"), "false");
		assert.equal(h.rows()[1], row);
		assert.equal(h.content.querySelector('[aria-current="true"]'), null);
	});
	it("clears the selected card when the document context disappears", () => {
		const h = harness();
		const results = scanCalloutOccurrences("a.md", "[!note]");
		h.render(results);
		h.cards.select(results[0]!);
		h.cards.setActiveFile(null);
		assert.equal(h.content.querySelector('[aria-current="true"]'), null);
	});
	it("keeps focus and selection on the same occurrence when an earlier file adds results", () => {
		const h = harness();
		const target = scanCalloutOccurrences("b.md", "[!note]");
		h.render([...scanCalloutOccurrences("a.md", "[!note]"), ...target]);
		h.rows()[1]!.focus();
		h.cards.select(target[0]!);
		h.render([...scanCalloutOccurrences("a.md", "[!note] [!note]"), ...target]);
		assert.equal(dom.document.activeElement, h.rows()[2]);
		assert.equal(h.rows()[2]!.getAttribute("aria-current"), "true");
		assert.equal(h.cards.getOccurrence(h.rows()[2]!), target[0]);
	});
	it("does not transfer selection or focus to another occurrence at deleted coordinates", () => {
		const h = harness();
		const original = scanCalloutOccurrences("a.md", "> [!note] First\n> [!note] Second");
		h.render(original);
		const oldRow = h.rows()[0]!;
		oldRow.focus();
		h.cards.select(original[0]!);
		h.render(scanCalloutOccurrences("a.md", "> [!note] Second"));
		assert.equal(h.content.querySelector('[aria-current="true"]'), null);
		assert.notEqual(dom.document.activeElement, h.rows()[0]);
		assert.equal(h.cards.getOccurrence(oldRow), undefined, "detached cards cannot navigate another result");
	});
	it("preserves cards through status-only updates and keeps complete file counts while paging", () => {
		const h = harness();
		const results = scanCalloutOccurrences("a.md", "[!note]\n".repeat(205));
		h.render(results);
		const first = h.rows()[0];
		h.cards.render(h.content, results, 100, false, () => {}, () => {});
		assert.equal(h.rows()[0], first);
		assert.match(h.content.querySelector(".search-result-file-title")?.textContent ?? "", /205/);
		h.render(results, 200);
		assert.equal(h.rows().length, 200);
		assert.equal(h.cards.getOccurrence(h.rows()[199]!), results[199]);
	});
	it("never restores focus from an unrelated control with matching data attributes", () => {
		const h = harness();
		const foreign = dom.document.createElement("button");
		foreign.dataset.action = "result";
		foreign.dataset.result = "0";
		foreign.focus();
		h.render(scanCalloutOccurrences("a.md", "[!note]"));
		assert.equal(dom.document.activeElement, foreign);
	});
});
