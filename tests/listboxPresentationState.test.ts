import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListboxPopup } from "../src/ui/listboxPopup";
import type { ListboxPopupOptions } from "../src/ui/listboxPopupTypes";
import { asEl, el, fakeDom } from "./support/fakeDom";

interface Choice {
	name: string;
	group: string;
}
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
		ariaLabel: "Choices",
		placeholder: "",
		emptyText: () => "No matches",
		itemsFor: (query) => choices.filter((choice) => choice.name.toLowerCase().includes(query.toLowerCase())),
		keyOf: (choice) => choice.name,
		labelOf: (choice) => choice.name,
		groupOf: (choice) => ({ key: choice.group, label: choice.group }),
		renderRow: (row, choice) => row.createSpan({ text: choice.name }),
		onCommit: () => {},
		...options,
	});
	const field = host.querySelector(".cs-dropdown-field")!;
	const input = host.querySelector(".cs-combobox-input");
	const menu = host.querySelector(".cs-combobox-menu")!;
	const type = (query: string) => {
		input!.value = query;
		input!.fire("input");
	};
	/** A click on the field, which opens the list, or closes it when it is open. */
	const open = () => field.fire("click");
	const expectGroups = (...labels: string[]) => {
		assert.deepEqual(
			menu.querySelectorAll(".cs-combobox-group-label").map((heading) => heading.textContent),
			labels,
		);
		assert.equal(
			menu.hasClass("cs-combobox-menu-grouped"),
			labels.length > 0,
			"menu padding must follow the groups actually present after every rebuild",
		);
	};
	return {
		popup,
		field,
		input,
		menu,
		type,
		open,
		expectGroups,
		setChoices: (next: Choice[]) => {
			choices = next;
			popup.setItems();
		},
	};
}

describe("ListboxPopup — rendered group presentation", () => {
	it("drops and restores grouped padding while searching through one group, no results and all groups", () => {
		const h = mount();
		try {
			h.expectGroups();
			h.open();
			h.expectGroups("browse", "custom", "preset");
			h.type("am");
			h.expectGroups("custom");
			h.type("missing");
			h.expectGroups();
			assert.ok(h.menu.querySelector(".callout-studio-empty-state"));
			h.popup.close();
			h.open();
			h.expectGroups("browse", "custom", "preset");
		} finally {
			h.popup.destroy();
		}
	});

	it("distinguishes hidden single-group headings from an explicitly retained scope heading", () => {
		const h = mount({ hideSingleGroup: true, showSingleGroupKey: "browse" });
		try {
			h.open();
			h.expectGroups("browse", "custom", "preset");
			h.type("am");
			h.expectGroups();
			assert.equal(h.menu.querySelector(".cs-combobox-option")?.textContent, "Amber");
			h.type("All types");
			h.expectGroups("browse");
			h.type("");
			h.expectGroups("browse", "custom", "preset");
		} finally {
			h.popup.destroy();
		}
	});

	it("removes stale groups when choices change in an open select-only menu", () => {
		const h = mount({ searchable: false, hideSingleGroup: true });
		try {
			h.field.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
			h.expectGroups("browse", "custom", "preset");
			h.setChoices([CHOICES[1]!, CHOICES[2]!]);
			h.expectGroups();
			h.setChoices([]);
			h.expectGroups();
			h.setChoices(CHOICES);
			h.expectGroups("browse", "custom", "preset");
		} finally {
			h.popup.destroy();
		}
	});

	it("leaves a create-only result ungrouped after filtering out every real option", () => {
		const h = mount({ emptyAction: { label: (query) => query, onSelect: () => {} } });
		try {
			h.open();
			h.expectGroups("browse", "custom", "preset");
			h.type("New choice");
			h.expectGroups();
			assert.ok(h.menu.querySelector(".callout-studio-suggestion-create-new"));
			h.type("");
			h.expectGroups("browse", "custom", "preset");
		} finally {
			h.popup.destroy();
		}
	});

	it("keeps a picker without group headings flat through search and rebuilding", () => {
		const h = mount({ groupOf: undefined });
		try {
			h.open();
			h.expectGroups();
			h.type("am");
			h.expectGroups();
			h.setChoices(CHOICES);
			h.expectGroups();
			assert.equal(h.menu.querySelector(".cs-combobox-option")?.textContent, "Amber");
		} finally {
			h.popup.destroy();
		}
	});
});

describe("ListboxPopup — the ✓ on the committed row", () => {
	/**
	 * The rows of the open list that carry a check, by their name.
	 *
	 * `querySelectorAll(...).filter(...)` keeps only the rows that contain a
	 * `.cs-combobox-check`, and `map` turns each into the name it shows.
	 */
	const checkedNames = (menu: ReturnType<typeof mount>["menu"]): string[] =>
		menu
			.querySelectorAll(".cs-combobox-option")
			.filter((row) => row.querySelector(".cs-combobox-check") !== null)
			.map((row) => row.textContent);

	it("marks the committed row, and only it, with one check at the very end", () => {
		const h = mount();
		try {
			h.popup.setSelected("Amber");
			h.open();
			assert.deepEqual(checkedNames(h.menu), ["Amber"]);
			const amber = h.menu.querySelectorAll(".cs-combobox-option").find((row) => row.textContent === "Amber")!;
			// Last child: it sits after whatever the caller drew in the row.
			const check = amber.lastElementChild!;
			assert.ok(check.hasClass("cs-combobox-check"));
			assert.equal(amber.querySelectorAll(".cs-combobox-check").length, 1);
			// `aria-selected` already tells a screen reader which row is chosen,
			// so the icon itself is hidden from it.
			assert.equal(check.getAttribute("aria-hidden"), "true");
			assert.equal(amber.getAttribute("aria-selected"), "true");
		} finally {
			h.popup.destroy();
		}
	});

	it("moves the check when another row is committed", () => {
		const h = mount();
		try {
			h.popup.setSelected("Amber");
			h.open();
			const beta = h.menu.querySelectorAll(".cs-combobox-option").find((row) => row.textContent === "Beta")!;
			beta.fire("click");
			h.open();
			assert.deepEqual(checkedNames(h.menu), ["Beta"]);
		} finally {
			h.popup.destroy();
		}
	});

	it("draws no check while nothing is committed, and none on the arrow-key highlight", () => {
		const h = mount();
		try {
			h.open();
			assert.deepEqual(checkedNames(h.menu), []);
			// The first row is highlighted (`is-active`), which is not a choice.
			assert.ok(h.menu.querySelector(".cs-combobox-option.is-active"));
		} finally {
			h.popup.destroy();
		}
	});
});
