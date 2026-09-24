import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListboxPopup } from "../src/ui/listboxPopup";
import { asEl, el, fakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

function mount(withFooter = false) {
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
		footerRow: withFooter ? {
			icon: "plus",
			label: "New color",
			onClick: () => created.push("footer"),
		} : undefined,
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
	it("keeps its accessible field name without a hover tooltip", () => {
		const h = mount();
		try {
			assert.equal(h.input.getAttribute("aria-label"), null);
			assert.equal(h.input.getAttribute("title"), null);
			const labelId = h.input.getAttribute("aria-labelledby");
			assert.ok(labelId);
			assert.equal(h.input.parentElement?.querySelector(`#${labelId}`)?.textContent, "Choices");
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

	it("suppresses stationary footer hover while arrows navigate options", () => {
		const h = mount(true);
		try {
			const footer = h.menu.querySelector(".cs-combobox-footer-row");
			assert.ok(footer);
			footer.fire("mouseenter");
			assert.ok(!h.menu.classList.contains("is-keyboard-active"));

			h.key("ArrowDown");
			assert.ok(h.rows()[0]?.classList.contains("is-active"));
			assert.ok(h.menu.classList.contains("is-keyboard-active"));
			assert.equal(h.input.getAttribute("aria-activedescendant"), h.rows()[0]?.id);

			// Still over the footer: movement restores mouse mode without re-entering.
			footer.fire("mousemove");
			assert.ok(!h.menu.classList.contains("is-keyboard-active"));
			assert.ok(h.rows().every((row) => !row.classList.contains("is-active")));
			assert.equal(h.input.getAttribute("aria-activedescendant"), null);
			assert.deepEqual(h.previews, [null, "Alpha", null]);
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
	for (const [, selector] of css.matchAll(/([^,{}]*\.cs-palette-menu-item:hover)\b/g)) {
		assert.ok(selector);
		assert.match(selector, /\.cs-fold-menu\b/);
	}
	assert.match(
		css,
		/\.cs-combobox-menu\.is-keyboard-active\s+\.cs-combobox-footer-row:hover\s*\{[^}]*background-color:\s*transparent/,
	);
});

it("selected options still show a visible pointer state", () => {
	const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
	for (const selector of [
		".cs-combobox-option.is-selected.is-active",
		".cs-fold-menu .cs-palette-menu-item.is-selected:hover",
	]) {
		assert.ok(css.includes(`${selector} {`), `${selector} must override the resting selected fill`);
	}
});
