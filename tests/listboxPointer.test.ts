import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListboxPopup } from "../src/ui/listboxPopup";
import { asEl, el, fakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

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
	const field = host.querySelector(".cs-dropdown-field")!;
	const input = host.querySelector(".cs-combobox-input")!;
	const popover = host.querySelector(".cs-combobox-popup")!;
	const menu = host.querySelector(".cs-combobox-menu")!;
	field.fire("click");
	return {
		popup, field, input, popover, menu, previews, committed, created,
		rows: () => menu.querySelectorAll(".cs-combobox-option"),
		key: (key: string) => input.fire("keydown", {
			key, preventDefault: () => {}, stopPropagation: () => {},
		}),
	};
}

describe("ListboxPopup — pointer and keyboard highlights", () => {
	it("draws no keyboard ring on the field after a pick made with the mouse", () => {
		const h = mount();
		try {
			h.menu.fire("mousedown", { preventDefault: () => {} });
			h.rows()[0]!.fire("click");
			assert.equal(fakeDom.document.activeElement, h.field, "the focus is back on the field");
			// Obsidian's mouse-focus: app.css draws no ring until the next Tab.
			assert.ok(h.field.hasClass("mouse-focus"));
		} finally { h.popup.destroy(); }
	});

	it("keeps the keyboard ring after a pick made with Enter", () => {
		const h = mount();
		try {
			h.key("ArrowDown");
			h.key("Enter");
			assert.equal(fakeDom.document.activeElement, h.field);
			assert.equal(h.field.hasClass("mouse-focus"), false);
		} finally { h.popup.destroy(); }
	});

	it("names its field and its search box without a hover tooltip", () => {
		const h = mount();
		try {
			for (const named of [h.field, h.input]) {
				assert.equal(named.getAttribute("aria-label"), null);
				assert.equal(named.getAttribute("title"), null);
				const labelId = named.getAttribute("aria-labelledby")?.split(" ")[0];
				assert.ok(labelId);
				assert.equal(named.parentElement?.querySelector(`#${labelId}`)?.textContent, "Choices");
			}
		} finally { h.popup.destroy(); }
	});

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
				assert.ok(!h.popover.classList.contains("cs-combobox-popup-hidden"));
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

	it("returns to the row under the mouse when it moves after an arrow key", () => {
		const h = mount();
		try {
			const [alpha, beta] = h.rows();
			assert.ok(alpha && beta);
			alpha.fire("mouseenter");
			h.key("ArrowDown");
			assert.ok(beta.classList.contains("is-active"));
			assert.ok(!alpha.classList.contains("is-active"));
			assert.deepEqual(h.previews, ["Alpha", "Beta"]);

			// The pointer is still inside Alpha: moving within it emits no new enter.
			alpha.fire("mousemove");
			assert.ok(alpha.classList.contains("is-active"));
			assert.ok(!beta.classList.contains("is-active"));
			assert.equal(h.rows().filter((row) => row.classList.contains("is-active")).length, 1);
			assert.equal(h.input.getAttribute("aria-activedescendant"), alpha.id);
			assert.deepEqual(h.previews, ["Alpha", "Beta", "Alpha"]);

			alpha.fire("mousemove");
			assert.deepEqual(h.previews, ["Alpha", "Beta", "Alpha"]);
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

it("dropdown option styling has no independent mouse hover highlight", () => {
	const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
	assert.doesNotMatch(
		css,
		/\.(?:cs-combobox-option|icon-picker-source-menu-item):hover\b/,
	);
});

it("selected options still show a visible pointer state", () => {
	// The chosen row used to have a fill of its own, and needed a second, darker
	// rule so the pointer could still be seen on it. Since 2026-10-23 a chosen
	// row has no fill — only a ✓ — so the ordinary highlight shows on it as on
	// any row, as long as nothing paints a chosen row's background.
	const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
	assert.doesNotMatch(
		css,
		/\.cs-combobox-option[^{,]*\.is-selected[^{,]*\{[^}]*background/,
		"a fill on the chosen row would hide the pointer highlight again",
	);
	assert.ok(css.includes(".cs-combobox-option.is-active {"), "the shared highlight covers every row");
});
