import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OccurrenceResults } from "../src/usage/occurrenceResults";
import { scanCalloutOccurrences } from "../src/usage/scanCalloutOccurrences";
import { installFakeDom } from "./support/fakeDom";
import { t } from "../src/i18n";

const dom = installFakeDom();

function harness() {
	const content = dom.document.createElement("div") as unknown as HTMLElement;
	const cards = new OccurrenceResults(100);
	const render = (results: ReturnType<typeof scanCalloutOccurrences>, limit = 100): boolean =>
		cards.render(content, results, limit, true, () => {}, () => {});
	const rows = (): HTMLButtonElement[] => Array.from(content.querySelectorAll<HTMLButtonElement>(".cs-occurrences-result"));
	return { cards, content, render, rows };
}

describe("occurrence result identity", () => {
	it("says whether the list was drawn again, so the sidebar knows when its groups are new", () => {
		const h = harness();
		const results = scanCalloutOccurrences("a.md", "[!note]\n[!tip]");
		assert.equal(h.render(results), true, "first draw");
		assert.equal(h.render(results), false, "same results, same page: nothing is drawn");
		assert.equal(h.render(results, 1), true, "another page size draws it again");
		assert.equal(h.render([...results]), true, "a new result list draws it again");
	});

	it("keeps a folded note folded when the list is drawn again, until the next search", () => {
		const h = harness();
		const a = scanCalloutOccurrences("a.md", "[!note]\n[!tip]");
		const b = scanCalloutOccurrences("b.md", "[!note]");
		h.render([...a, ...b]);
		const folded = (): boolean[] => Array.from(h.content.querySelectorAll<HTMLElement>(".cs-sidebar-file"), (section) => section.hasClass("is-collapsed"));
		assert.deepEqual(folded(), [false, false]);
		const triangle = h.content.querySelector<HTMLElement>(".cs-sidebar-fold")!;
		(triangle as unknown as { fire(type: string): void }).fire("click");
		assert.deepEqual(folded(), [true, false], "folded in place, with nothing drawn again");
		// More results arrive: every group is drawn from scratch, and a folded one is still folded.
		h.render([...a, ...b, ...scanCalloutOccurrences("c.md", "[!info]")]);
		assert.deepEqual(folded(), [true, false, false]);
		// A new search starts with every note showing.
		h.cards.fold.clear();
		h.render([...a, ...b]);
		assert.deepEqual(folded(), [false, false]);
	});

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
			// The title row is Obsidian's tree row; in it, the fold triangle and the note's name.
			const head = section.children[0]!;
			assert.equal(head.tagName, "DIV");
			for (const cls of ["tree-item-self", "search-result-file-title", "is-clickable"]) assert.ok(head.hasClass(cls), cls);
			assert.deepEqual(Array.from(head.children, (child) => child.hasClass("collapse-icon") ? "fold" : child.tagName), ["fold", "BUTTON"]);
			const link = head.querySelector(".cs-sidebar-file-link")!;
			assert.equal(link.tagName, "BUTTON");
			assert.equal(link.getAttribute("aria-label"), null, "the visible file name must not create a redundant hover popup");
			assert.equal(link.getAttribute("title"), null);
			assert.equal(head.querySelector(".collapse-icon")?.getAttribute("aria-label"), null, "nor must the triangle");
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
	it("says nothing was found in Obsidian's quiet empty line, as Search does", () => {
		const h = harness();
		h.render([]);
		const empty = h.content.querySelector(".search-empty-state");
		assert.equal(empty?.textContent, t("usage.empty"));
		assert.equal(h.content.querySelector("p"), null, "not a paragraph of body text");
	});
});
