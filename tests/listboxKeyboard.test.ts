import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListboxPopup } from "../src/ui/listboxPopup";
import { asEl, el, FakeDocument, fakeDom } from "./support/fakeDom";

function mount(searchable = false, choices = ["Alpha", "Beta", "Bravo", "Gamma"], doc?: FakeDocument) {
	fakeDom.light();
	const host = doc?.createElement("div") ?? el();
	const commits: string[] = [];
	const previews: Array<string | null> = [];
	const queries: string[] = [];
	const popup = new ListboxPopup(asEl(host), {
		ariaLabel: "Choices", placeholder: "Search", searchable,
		itemsFor: (query) => {
			queries.push(query);
			return choices.filter((item) => item.toLowerCase().includes(query.toLowerCase()));
		},
		keyOf: (item) => item,
		labelOf: (item) => item,
		renderRow: (row, item) => row.setText(item),
		emptyText: () => "No matches",
		onCommit: (item) => commits.push(item),
		onHighlight: (item) => previews.push(item),
	});
	popup.setSelected(choices[1]!);
	const input = host.querySelector(".cs-combobox-input")!;
	const control = host.querySelector(".cs-combobox-control")!;
	const menu = host.querySelector(".cs-combobox-menu")!;
	const rows = () => menu.querySelectorAll(".cs-combobox-option");
	return {
		popup, input, control, menu, rows, commits, previews, queries,
		open: () => input.getAttribute("aria-expanded") === "true",
		active: () => rows().findIndex((row) => row.classList.contains("is-active")),
		key: (key: string, modifiers: Partial<KeyboardEvent> = {}) => {
			let prevented = false;
			let stopped = false;
			input.fire("keydown", {
				key, ...modifiers,
				preventDefault: () => { prevented = true; },
				stopPropagation: () => { stopped = true; },
			});
			return { prevented, stopped };
		},
	};
}

describe("select-only popup keyboard", () => {
	it("keeps Tab focus closed and toggles on clicking the control", () => {
		const h = mount();
		try {
			h.input.select(); // Tab focus can select a readonly input in Chromium.
			h.input.fire("focus");
			assert.equal(h.open(), false);
			assert.equal(h.input.selectionStart, h.input.selectionEnd);
			h.control.fire("click", { target: h.input });
			assert.equal(h.open(), true);
			h.control.fire("click", { target: h.input });
			assert.equal(h.open(), false);
			assert.equal(h.input.value, "Beta");
			assert.deepEqual(h.commits, []);
		} finally { h.popup.destroy(); }
	});

	for (const opener of ["Enter", " ", "ArrowDown", "ArrowUp"]) {
		it(`${opener} opens at the committed row, then arrows and Space choose explicitly`, () => {
			const h = mount();
			try {
				assert.deepEqual(h.key(opener), { prevented: true, stopped: true });
				assert.equal(h.open(), true);
				assert.equal(h.active(), 1);
				assert.deepEqual(h.key("ArrowDown"), { prevented: true, stopped: true });
				assert.equal(h.active(), 2);
				assert.equal(h.popup.value, "Beta");
				h.key(" ");
				assert.equal(h.open(), false);
				assert.deepEqual(h.commits, ["Bravo"]);
			} finally { h.popup.destroy(); }
		});
	}

	it("jumps by pages and to list endpoints without wrapping", () => {
		const h = mount(false, Array.from({ length: 25 }, (_, index) => `Choice ${index}`));
		try {
			h.key("End");
			assert.equal(h.active(), 24);
			h.key("ArrowDown");
			assert.equal(h.active(), 24);
			h.key("PageUp");
			assert.equal(h.active(), 14);
			h.key("Home");
			assert.equal(h.active(), 0);
			h.key("ArrowUp");
			assert.equal(h.active(), 0);
			h.key("PageDown");
			assert.equal(h.active(), 10);
		} finally { h.popup.destroy(); }
	});

	it("cycles repeated letters, refines prefixes, and expires the typeahead buffer", (t) => {
		let now = 1000;
		t.mock.method(Date, "now", () => now);
		const h = mount();
		try {
			assert.deepEqual(h.key("b"), { prevented: true, stopped: true });
			assert.equal(h.active(), 2);
			h.key("b");
			assert.equal(h.active(), 1);
			h.key("r");
			assert.equal(h.active(), 2);
			now += 701;
			h.key("a");
			assert.equal(h.active(), 0);
			assert.equal(h.input.value, "Beta");
			assert.equal(h.rows().length, 4, "typeahead does not filter options");
			assert.deepEqual(h.commits, []);
			h.key("Enter");
			assert.deepEqual(h.commits, ["Alpha"]);
		} finally { h.popup.destroy(); }
	});

	it("leaves modified shortcuts and IME input alone", () => {
		const h = mount();
		try {
			for (const modifier of ["ctrlKey", "metaKey", "altKey", "isComposing"]) {
				assert.deepEqual(h.key("b", { [modifier]: true }), { prevented: false, stopped: false });
				assert.equal(h.open(), false);
			}
		} finally { h.popup.destroy(); }
	});

	it("dismisses Escape once, lets the next reach the modal, and leaves Tab's default intact", () => {
		const h = mount();
		try {
			h.key("End");
			assert.equal(h.previews[h.previews.length - 1], "Gamma");
			assert.deepEqual(h.key("Escape"), { prevented: true, stopped: true });
			assert.equal(h.previews[h.previews.length - 1], null);
			assert.deepEqual(h.key("Escape"), { prevented: false, stopped: false });
			h.key("Home");
			assert.deepEqual(h.key("Tab"), { prevented: false, stopped: true });
			assert.equal(h.open(), false);
			assert.equal(h.input.value, "Beta");
			assert.deepEqual(h.commits, []);
		} finally { h.popup.destroy(); }
	});

	it("refreshes every option rather than filtering by the closed label", () => {
		const h = mount();
		try {
			h.key("Enter");
			h.popup.setItems();
			assert.equal(h.queries[h.queries.length - 1], "");
			assert.equal(h.rows().length, 4);
			h.popup.setSelected("Gamma");
			assert.equal(h.active(), 3);
			assert.equal(h.rows()[3]?.getAttribute("aria-selected"), "true");
		} finally { h.popup.destroy(); }
	});

	it("ignores disabled gestures and stale row clicks", () => {
		const h = mount();
		try {
			h.key("Enter");
			const staleRow = h.rows()[0]!;
			h.popup.setDisabled(true);
			assert.equal(h.open(), false);
			for (const key of ["Enter", " ", "ArrowDown", "b"])
				assert.deepEqual(h.key(key), { prevented: false, stopped: false });
			h.control.fire("click");
			staleRow.fire("click");
			assert.equal(h.open(), false);
			assert.deepEqual(h.commits, []);
		} finally { h.popup.destroy(); }
	});

	it("destroy clears previews and permanently refuses stale gestures or re-enabling", () => {
		const h = mount();
		h.key("End");
		const staleRow = h.rows()[0]!;
		h.popup.destroy();
		assert.equal(h.open(), false);
		assert.equal(h.previews[h.previews.length - 1], null);
		assert.equal(fakeDom.document.listeners.get("click")?.length ?? 0, 0);
		h.popup.setDisabled(false);
		assert.equal(h.input.disabled, true);
		h.control.fire("click");
		h.input.fire("focus");
		h.key("Enter");
		staleRow.fire("click");
		assert.equal(h.open(), false);
		assert.deepEqual(h.commits, []);
		assert.equal(fakeDom.document.listeners.get("scroll")?.length ?? 0, 0);
	});

	it("dismisses inert outside clicks and cleans up in the popup's own document", () => {
		const doc = new FakeDocument();
		const h = mount(false, undefined, doc);
		h.key("Enter");
		assert.equal(doc.listeners.get("click")?.length, 1);
		doc.fire("click", { target: h.control });
		assert.equal(h.open(), true);
		doc.fire("click", { target: doc.body });
		assert.equal(h.open(), false);
		assert.deepEqual(h.commits, []);
		h.popup.destroy();
		assert.equal(doc.listeners.get("click")?.length, 0);
	});
});

it("searchable popups preserve text editing, full initial choices, and blur cancellation", () => {
	const h = mount(true);
	try {
		h.input.fire("focus");
		assert.equal(h.open(), true);
		assert.equal(h.rows().length, 4);
		for (const key of ["Home", "End", " ", "b"])
			assert.deepEqual(h.key(key), { prevented: false, stopped: false });
		h.input.value = "Ga";
		h.input.fire("input");
		assert.equal(h.rows().length, 1);
		h.input.fire("blur");
		assert.equal(h.input.value, "Beta");
		assert.deepEqual(h.commits, []);
		assert.deepEqual(h.key("Escape"), { prevented: false, stopped: false });
	} finally { h.popup.destroy(); }
});
