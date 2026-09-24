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
		assert.match(h.content.querySelector("h3")?.textContent ?? "", /205/);
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
