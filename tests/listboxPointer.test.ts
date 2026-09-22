import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListboxPopup } from "../src/ui/listboxPopup";
import { asEl, el, fakeDom } from "./support/fakeDom";

function mount() {
	fakeDom.light();
	const host = el();
	const previews: Array<string | null> = [];
	const committed: string[] = [];
	const created: string[] = [];
	const popup = new ListboxPopup(asEl(host), {
		ariaLabel: "Choices",
		placeholder: "Search",
		itemsFor: (query) => ["Alpha", "Beta", "Gamma"].filter((item) => item.includes(query)),
		keyOf: (item) => item,
		labelOf: (item) => item,
		renderRow: (row, item) => row.setText(item),
		emptyText: () => "No matches",
		onCommit: (item) => committed.push(item),
		onHighlight: (item) => previews.push(item),
		emptyAction: {
			label: (query) => query,
			onSelect: (query) => created.push(query),
		},
	});
	popup.setSelected("Beta");
	const input = host.querySelector(".cs-combobox-input")!;
	const menu = host.querySelector(".cs-combobox-menu")!;
	input.fire("focus");
	return {
		popup, input, menu, previews, committed, created,
		rows: () => menu.querySelectorAll(".cs-combobox-option"),
		key: (key: string) => input.fire("keydown", {
			key, preventDefault: () => {}, stopPropagation: () => {},
		}),
	};
}

describe("ListboxPopup — pointer and keyboard highlights", () => {
	for (const exit of ["row", "menu"] as const) {
		it(`clears the pointer highlight and color preview when leaving the ${exit}`, () => {
			const h = mount();
			try {
				const row = h.rows()[0]!;
				row.fire("mouseenter");
				assert.deepEqual(h.previews, ["Alpha"]);
				assert.ok(row.classList.contains("is-active"));
				(exit === "row" ? row : h.menu).fire("mouseleave");
				assert.ok(h.rows().every((item) => !item.classList.contains("is-active")));
				assert.equal(h.input.getAttribute("aria-activedescendant"), null);
				assert.deepEqual(h.previews, ["Alpha", null]);
				assert.ok(h.rows()[1]?.classList.contains("is-selected"));
				assert.equal(h.popup.value, "Beta");
				assert.ok(!h.menu.classList.contains("cs-combobox-menu-hidden"));
				h.key("Enter");
				assert.deepEqual(h.committed, []);
				h.key("ArrowDown");
				h.key("Enter");
				assert.deepEqual(h.committed, ["Alpha"]);
			} finally {
				h.popup.destroy();
			}
		});
	}

	it("preserves a keyboard highlight when the pointer subsequently leaves", () => {
		const h = mount();
		try {
			h.rows()[0]!.fire("mouseenter");
			h.key("ArrowDown");
			h.rows()[0]!.fire("mouseleave");
			h.menu.fire("mouseleave");
			assert.ok(h.rows()[1]?.classList.contains("is-active"));
			assert.equal(h.input.getAttribute("aria-activedescendant"), h.rows()[1]?.id);
			h.key("Enter");
			assert.deepEqual(h.committed, ["Beta"]);
		} finally {
			h.popup.destroy();
		}
	});

	it("does not scroll hovered rows into view, while keyboard navigation still does", () => {
		const h = mount();
		try {
			let scrolls = 0;
			for (const row of h.rows()) row.scrollIntoView = () => { scrolls++; };
			h.rows()[0]!.fire("mouseenter");
			assert.equal(scrolls, 0);
			h.key("ArrowDown");
			assert.equal(scrolls, 1);
		} finally {
			h.popup.destroy();
		}
	});

	it("clears a hovered create action before Enter can accidentally invoke it", () => {
		const h = mount();
		try {
			h.input.value = "New";
			h.input.fire("input");
			const row = h.rows()[0]!;
			row.fire("mouseenter");
			row.fire("mouseleave");
			h.key("Enter");
			assert.deepEqual(h.created, []);
			h.key("ArrowDown");
			h.key("Enter");
			assert.deepEqual(h.created, ["New"]);
		} finally {
			h.popup.destroy();
		}
	});
});
