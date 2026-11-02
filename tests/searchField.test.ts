/**
 * tests/searchField.test.ts — the plugin's search boxes are Obsidian's search
 * field (`ui/searchField.ts`, findings S6-15 and S4-10).
 *
 * Obsidian's `SearchComponent` draws the magnifier and the ×; the helper hands
 * back the outer `div` for layout and wires one callback that hears typing AND
 * the × — which empties the field without an `input` event, so a plain
 * `input` listener would leave the list filtered by text that is gone.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import { createSearchField } from "../src/ui/searchField";
import { readRepoFile } from "./support/sourceScan";

function mount(value?: string) {
	fakeDom.document.body.empty();
	const queries: string[] = [];
	const field = createSearchField(asEl(fakeDom.document.body), {
		placeholder: "Search…",
		fieldCls: "cs-test-search-field",
		inputCls: "cs-test-search",
		value,
		onChange: (query) => queries.push(query),
	});
	return { field, queries };
}

describe("the plugin's search field", () => {
	it("is Obsidian's search field, with the caller's classes on the right parts", () => {
		const { field } = mount("star");
		const container = field.containerEl as unknown as FakeElement;
		assert.ok(container.hasClass("search-input-container"));
		assert.ok(container.hasClass("cs-test-search-field"), "the layout class is on the outer div");
		const input = field.inputEl as unknown as FakeElement & { value: string };
		assert.equal(input.getAttribute("type"), "search");
		assert.ok(input.hasClass("cs-test-search"), "the hook class is on the text box");
		assert.equal(input.getAttribute("placeholder"), "Search…");
		assert.equal(input.value, "star");
		assert.ok(container.querySelector(".search-input-clear-button"), "Obsidian's ×");
	});

	it("reports typing, and the × too", () => {
		const { field, queries } = mount();
		const input = field.inputEl as unknown as FakeElement & { value: string };
		input.value = "sta";
		input.fire("input");
		(field.search.clearButtonEl as unknown as FakeElement).fire("click");
		assert.equal(input.value, "");
		assert.equal(queries[0], "sta");
		assert.equal(queries.at(-1), "", "the × filters the list back to everything");
	});

	it("is what the four search boxes are built with", () => {
		for (const file of [
			"src/settings/quickInsertToolbar.ts",
			"src/utils/ReplaceCalloutModal.ts",
			"src/settings/iconpicker/PackPanel.ts",
			"src/settings/iconpicker/ImagePanel.ts",
		]) {
			const source = readRepoFile(file);
			assert.match(source, /createSearchField\(/, file);
			assert.doesNotMatch(source, /createEl\("input", \{\s*type: "text"/, `${file}: no plain text box`);
		}
	});

	it("leaves Quick insert's 'nothing found' to Obsidian's suggestion-empty line", () => {
		const source = readRepoFile("src/settings/QuickInsertModal.ts");
		assert.match(source, /cls: "suggestion-empty", text: empty/);
	});
});
