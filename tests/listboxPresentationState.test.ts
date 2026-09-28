import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListboxPopup } from "../src/ui/listboxPopup";
import type { ListboxPopupOptions } from "../src/ui/listboxPopupTypes";
import { asEl, el, fakeDom } from "./support/fakeDom";

interface Choice { name: string; group: string; }
const CHOICES: Choice[] = [
	{ name: "All types", group: "browse" },
	{ name: "Alpha", group: "custom" },
	{ name: "Amber", group: "custom" },
	{ name: "Beta", group: "preset" },
];

function mount(options: Partial<ListboxPopupOptions<Choice>> = {}) {
	fakeDom.light();
	const host = el();
	let choices = CHOICES;
	const popup = new ListboxPopup<Choice>(asEl(host), {
		ariaLabel: "Choices", placeholder: "", emptyText: () => "No matches",
		itemsFor: (query) => choices.filter((choice) => choice.name.toLowerCase().includes(query.toLowerCase())),
		keyOf: (choice) => choice.name,
		labelOf: (choice) => choice.name,
		groupOf: (choice) => ({ key: choice.group, label: choice.group }),
		renderRow: (row, choice) => row.createSpan({ text: choice.name }),
		onCommit: () => {},
		...options,
	});
	const input = host.querySelector(".cs-combobox-input")!;
	const menu = host.querySelector(".cs-combobox-menu")!;
	const type = (query: string) => { input.value = query; input.fire("input"); };
	const expectGroups = (...labels: string[]) => {
		assert.deepEqual(menu.querySelectorAll(".cs-combobox-group-label").map((heading) => heading.textContent), labels);
		assert.equal(menu.hasClass("cs-combobox-menu-grouped"), labels.length > 0,
			"menu padding must follow the groups actually present after every rebuild");
	};
	return {
		popup, input, menu, type, expectGroups,
		setChoices: (next: Choice[]) => { choices = next; popup.setItems(); },
	};
}

describe("ListboxPopup — rendered group presentation", () => {
	it("drops and restores grouped padding while searching through one group, no results and all groups", () => {
		const h = mount({ footerRow: { icon: "plus", label: "New choice", onClick: () => {} } });
		try {
			h.expectGroups();
			h.input.fire("focus");
			h.expectGroups("browse", "custom", "preset");
			h.type("am");
			h.expectGroups("custom");
			h.type("missing");
			h.expectGroups();
			assert.ok(h.menu.querySelector(".callout-studio-empty-state"));
			assert.ok(h.menu.querySelector(".cs-combobox-footer-row"));
			h.popup.close();
			h.input.fire("focus");
			h.expectGroups("browse", "custom", "preset");
		} finally { h.popup.destroy(); }
	});

	it("distinguishes hidden single-group headings from an explicitly retained scope heading", () => {
		const h = mount({ hideSingleGroup: true, showSingleGroupKey: "browse" });
		try {
			h.input.fire("focus");
			h.expectGroups("browse", "custom", "preset");
			h.type("am");
			h.expectGroups();
			assert.equal(h.menu.querySelector(".cs-combobox-option")?.textContent, "Amber");
			h.type("All types");
			h.expectGroups("browse");
			h.type("");
			h.expectGroups("browse", "custom", "preset");
		} finally { h.popup.destroy(); }
	});

	it("removes stale groups when choices change in an open select-only menu", () => {
		const h = mount({ searchable: false, hideSingleGroup: true });
		try {
			h.input.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
			h.expectGroups("browse", "custom", "preset");
			h.setChoices([CHOICES[1]!, CHOICES[2]!]);
			h.expectGroups();
			h.setChoices([]);
			h.expectGroups();
			h.setChoices(CHOICES);
			h.expectGroups("browse", "custom", "preset");
		} finally { h.popup.destroy(); }
	});

	it("leaves a create-only result ungrouped after filtering out every real option", () => {
		const h = mount({ emptyAction: { label: (query) => query, onSelect: () => {} } });
		try {
			h.input.fire("focus");
			h.expectGroups("browse", "custom", "preset");
			h.type("New choice");
			h.expectGroups();
			assert.ok(h.menu.querySelector(".callout-studio-suggestion-create-new"));
			h.type("");
			h.expectGroups("browse", "custom", "preset");
		} finally { h.popup.destroy(); }
	});

	it("keeps a picker without group headings flat through search and rebuilding", () => {
		const h = mount({ groupOf: undefined });
		try {
			h.input.fire("focus");
			h.expectGroups();
			h.type("am");
			h.expectGroups();
			h.setChoices(CHOICES);
			h.expectGroups();
			assert.equal(h.menu.querySelector(".cs-combobox-option")?.textContent, "Amber");
		} finally { h.popup.destroy(); }
	});
});
