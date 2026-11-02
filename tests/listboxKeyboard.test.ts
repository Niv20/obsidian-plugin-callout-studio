import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Platform } from "obsidian";
import { ListboxPopup } from "../src/ui/listboxPopup";
import { asEl, el, FakeDocument, fakeDom } from "./support/fakeDom";

function mount(searchable = false, choices = ["Alpha", "Beta", "Bravo", "Gamma"], doc?: FakeDocument) {
	fakeDom.light();
	const host = doc?.createElement("div") ?? el();
	const commits: string[] = [];
	const previews: Array<string | null> = [];
	const queries: string[] = [];
	const popup = new ListboxPopup(asEl(host), {
		ariaLabel: "Choices",
		placeholder: "Search",
		searchable,
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
	// The field (Obsidian's dropdown) and, for a searchable picker, the search
	// box at the top of its list.
	const field = host.querySelector(".cs-dropdown-field")!;
	const input = host.querySelector(".cs-combobox-input");
	const menu = host.querySelector(".cs-combobox-menu")!;
	const rows = () => menu.querySelectorAll(".cs-combobox-option");
	return {
		popup,
		field,
		input,
		menu,
		rows,
		commits,
		previews,
		queries,
		open: () => field.getAttribute("aria-expanded") === "true",
		label: () => field.querySelector(".cs-dropdown-field-label")?.textContent ?? "",
		active: () => rows().findIndex((row) => row.classList.contains("is-active")),
		key: (key: string, modifiers: Partial<KeyboardEvent> = {}, target = field) => {
			let prevented = false;
			let stopped = false;
			target.fire("keydown", {
				key,
				...modifiers,
				preventDefault: () => {
					prevented = true;
				},
				stopPropagation: () => {
					stopped = true;
				},
			});
			return { prevented, stopped };
		},
	};
}

describe("select-only popup keyboard", () => {
	it("has no search box, stays closed on focus, and toggles on clicking the field", () => {
		const h = mount();
		try {
			assert.equal(h.input, null, "a select-only list has no search box");
			assert.equal(h.field.getAttribute("role"), "combobox", "so the field itself is the combobox");
			h.field.fire("focus");
			assert.equal(h.open(), false);
			h.field.fire("click");
			assert.equal(h.open(), true);
			h.field.fire("click");
			assert.equal(h.open(), false);
			assert.equal(h.label(), "Beta");
			assert.deepEqual(h.commits, []);
		} finally {
			h.popup.destroy();
		}
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
			} finally {
				h.popup.destroy();
			}
		});
	}

	it("jumps by pages and to list endpoints without wrapping", () => {
		const h = mount(
			false,
			Array.from({ length: 25 }, (_, index) => `Choice ${index}`),
		);
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
		} finally {
			h.popup.destroy();
		}
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
			assert.equal(h.label(), "Beta");
			assert.equal(h.rows().length, 4, "typeahead does not filter options");
			assert.deepEqual(h.commits, []);
			h.key("Enter");
			assert.deepEqual(h.commits, ["Alpha"]);
		} finally {
			h.popup.destroy();
		}
	});

	it("leaves modified shortcuts and IME input alone", () => {
		const h = mount();
		try {
			for (const modifier of ["ctrlKey", "metaKey", "altKey", "isComposing"]) {
				assert.deepEqual(h.key("b", { [modifier]: true }), { prevented: false, stopped: false });
				assert.equal(h.open(), false);
			}
		} finally {
			h.popup.destroy();
		}
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
			assert.equal(h.label(), "Beta");
			assert.deepEqual(h.commits, []);
		} finally {
			h.popup.destroy();
		}
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
		} finally {
			h.popup.destroy();
		}
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
			h.field.fire("click");
			staleRow.fire("click");
			assert.equal(h.open(), false);
			assert.deepEqual(h.commits, []);
		} finally {
			h.popup.destroy();
		}
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
		assert.ok(h.field.hasClass("mod-disabled"), "still Obsidian's disabled dropdown");
		h.field.fire("click");
		h.field.fire("focus");
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
		doc.fire("click", { target: h.field });
		assert.equal(h.open(), true);
		doc.fire("click", { target: doc.body });
		assert.equal(h.open(), false);
		assert.deepEqual(h.commits, []);
		h.popup.destroy();
		assert.equal(doc.listeners.get("click")?.length, 0);
	});
});

describe("searchable popup keyboard", () => {
	it("opens on the field with an empty search box and every choice, and filters as you type", () => {
		const h = mount(true);
		try {
			h.field.fire("click");
			assert.equal(h.open(), true);
			assert.equal(fakeDom.document.activeElement, h.input, "the search box takes the focus");
			assert.equal(h.input!.value, "");
			assert.equal(h.rows().length, 4);
			// Keys that edit text are the search box's own.
			for (const key of ["Home", "End", " ", "b"])
				assert.deepEqual(h.key(key, {}, h.input!), { prevented: false, stopped: false });
			h.input!.value = "Ga";
			h.input!.fire("input");
			assert.equal(h.rows().length, 1);
			assert.equal(h.label(), "Beta", "the field goes on showing what is committed");
		} finally {
			h.popup.destroy();
		}
	});

	for (const opener of ["Enter", " ", "ArrowDown", "ArrowUp"]) {
		it(`${opener} on the field opens the list without searching`, () => {
			const h = mount(true);
			try {
				assert.deepEqual(h.key(opener), { prevented: true, stopped: true });
				assert.equal(h.open(), true);
				assert.equal(h.input!.value, "");
				assert.equal(h.active(), 1, "on the committed row");
			} finally {
				h.popup.destroy();
			}
		});
	}

	it("leaves the search box unfocused on a phone or tablet, so the keyboard stays down", () => {
		Platform.isMobile = true;
		const h = mount(true);
		try {
			h.field.fire("click");
			assert.equal(h.open(), true);
			assert.notEqual(fakeDom.document.activeElement, h.input);
		} finally {
			Platform.isMobile = false;
			h.popup.destroy();
		}
	});

	it("starts the search with a letter typed on the field, as Obsidian's combobox does", () => {
		const h = mount(true);
		try {
			assert.deepEqual(h.key("g"), { prevented: true, stopped: true });
			assert.equal(h.open(), true);
			assert.equal(h.input!.value, "g");
			assert.deepEqual(
				h.rows().map((row) => row.textContent),
				["Gamma"],
			);
			// A shortcut is not a letter.
			h.popup.close();
			assert.deepEqual(h.key("g", { metaKey: true }), { prevented: false, stopped: false });
			assert.equal(h.open(), false);
		} finally {
			h.popup.destroy();
		}
	});

	it("moves with the arrows and takes the row with Enter, then gives the focus back to the field", () => {
		const h = mount(true);
		try {
			h.field.fire("click");
			assert.deepEqual(h.key("ArrowDown", {}, h.input!), { prevented: true, stopped: true });
			assert.equal(h.active(), 2);
			assert.deepEqual(h.key("Enter", {}, h.input!), { prevented: true, stopped: true });
			assert.deepEqual(h.commits, ["Bravo"]);
			assert.equal(h.open(), false);
			assert.equal(h.label(), "Bravo");
			assert.equal(fakeDom.document.activeElement, h.field);
		} finally {
			h.popup.destroy();
		}
	});

	it("closes on Escape and on Tab without choosing, and the focus goes back to the field", () => {
		const h = mount(true);
		try {
			h.field.fire("click");
			h.key("ArrowDown", {}, h.input!);
			assert.deepEqual(h.key("Escape", {}, h.input!), { prevented: true, stopped: true });
			assert.equal(h.open(), false);
			assert.equal(fakeDom.document.activeElement, h.field);
			h.field.fire("click");
			// Tab is not stopped: the browser moves the focus on from the field.
			assert.deepEqual(h.key("Tab", {}, h.input!), { prevented: false, stopped: false });
			assert.equal(h.open(), false);
			assert.equal(fakeDom.document.activeElement, h.field);
			assert.deepEqual(h.commits, []);
		} finally {
			h.popup.destroy();
		}
	});

	it("never commits on blur, and a blur that stays inside the picker leaves it open", () => {
		const h = mount(true);
		try {
			h.field.fire("click");
			h.input!.value = "Ga";
			h.input!.fire("input");
			h.input!.fire("blur", { relatedTarget: h.field });
			assert.equal(h.open(), true, "a press on the field moves the focus, but stays inside");
			h.input!.fire("blur", { relatedTarget: null });
			assert.equal(h.open(), false);
			assert.equal(h.label(), "Beta");
			assert.deepEqual(h.commits, []);
		} finally {
			h.popup.destroy();
		}
	});
});
