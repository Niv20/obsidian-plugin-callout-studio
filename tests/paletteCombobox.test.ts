import assert from "node:assert";
import { afterEach, describe, it } from "node:test";
import { PaletteCombobox } from "../src/settings/paletteCombobox";
import type { PaletteEntry } from "../src/settings/paletteCombobox";
import { resolveCurrentModeColors } from "../src/ui/ColorCircles";
import { ListboxPopup } from "../src/ui/listboxPopup";
import { asEl, el, fakeDom } from "./support/fakeDom";
import type { FakeElement } from "./support/fakeDom";

const DELETED_LABEL = "Deleted color";
const FORM_COLORS = { accent: "#a14571", bg: "#f4dae5" };
const SAVED: PaletteEntry = {
	id: "custom:blue",
	name: "Ocean",
	group: "custom",
	palette: {
		id: "blue",
		name: "Ocean",
		group: "custom",
		colorLight: "#2468ac",
		colorDark: "#75ade5",
		bgColorLight: "#daeafa",
		bgColorDark: "#20364c",
	},
};

const mounted: Array<{ destroy(): void }> = [];
afterEach(() => {
	for (const picker of mounted.splice(0)) picker.destroy();
});

function required(host: FakeElement, selector: string): FakeElement {
	const found = host.querySelector(selector);
	assert.ok(found, `missing ${selector}`);
	return found;
}

function mount() {
	fakeDom.light();
	const host = el();
	const committed: string[] = [];
	const created: string[] = [];
	const previews: Array<string | null> = [];
	const box = new PaletteCombobox(asEl(host), {
		entries: () => [SAVED],
		onPreview: (palette) => previews.push(palette?.id ?? null),
		onCommit: (entry) => {
			committed.push(entry.id);
			box.setSelection(entry.id, entry.name);
			box.renderLead(resolveCurrentModeColors(entry.palette));
		},
		onNewColor: (name) => created.push(name),
	});
	mounted.push(box);
	box.setSelection("", DELETED_LABEL);
	box.renderLead(FORM_COLORS);
	const input = required(host, ".cs-combobox-input");
	const menu = required(host, ".cs-combobox-menu");
	return {
		box,
		host,
		input,
		menu,
		committed,
		created,
		previews,
		root: required(host, ".cs-combobox"),
		lead: required(host, ".cs-combobox-lead"),
		rows: () => menu.querySelectorAll(".cs-combobox-option"),
		open: () => input.fire("focus"),
		type: (text: string) => {
			input.value = text;
			input.fire("input");
		},
		key: (key: string) => input.fire("keydown", {
			key,
			preventDefault: () => {},
			stopPropagation: () => {},
		}),
	};
}

type Harness = ReturnType<typeof mount>;

function assertDeleted(h: Harness): void {
	assert.strictEqual(h.input.value, DELETED_LABEL);
	// The empty-state class hides the lead slot in the shared combobox CSS.
	assert.ok(!h.root.classList.contains("is-empty"));
	assert.strictEqual(
		required(h.lead, ".cs-color-circle-l").style.backgroundColor,
		FORM_COLORS.accent,
	);
	assert.strictEqual(
		required(h.lead, ".cs-color-circle-r").style.backgroundColor,
		FORM_COLORS.bg,
	);
	assert.deepStrictEqual(h.committed, []);
	assert.deepStrictEqual(h.created, []);
}

describe("PaletteCombobox — deleted saved color", () => {
	it("keeps the form's color circles beside the deleted label", () => {
		assertDeleted(mount());
	});

	it("opens all saved colors without treating the deleted label as a query", () => {
		const h = mount();
		h.open();

		assert.strictEqual(
			required(h.menu, ".cs-palette-menu-item-label").textContent,
			SAVED.name,
		);
		assertDeleted(h);
	});

	it("opens without making the first saved color look hovered or previewing it", () => {
		const h = mount();
		h.open();

		assert.ok(h.rows().every((row) => !row.classList.contains("is-active")));
		assert.strictEqual(h.input.getAttribute("aria-activedescendant"), null);
		assert.deepStrictEqual(h.previews, []);
	});

	it("previews the first saved color only after the first ArrowDown", () => {
		const h = mount();
		h.open();
		assert.ok(h.rows().every((row) => !row.classList.contains("is-active")));

		h.key("ArrowDown");

		assert.ok(h.rows()[0]?.classList.contains("is-active"));
		assert.strictEqual(
			h.input.getAttribute("aria-activedescendant"),
			h.rows()[0]?.id,
		);
		assert.deepStrictEqual(h.previews, [SAVED.palette.id]);
		assertDeleted(h);
	});

	it("does not choose the first color on Enter until keyboard navigation starts", () => {
		const h = mount();
		h.open();

		h.key("Enter");
		assertDeleted(h);
		assert.ok(!h.menu.classList.contains("cs-combobox-menu-hidden"));

		h.key("ArrowDown");
		h.key("Enter");
		assert.deepStrictEqual(h.committed, [SAVED.id]);
		assert.strictEqual(h.input.value, SAVED.name);
		assert.ok(h.menu.classList.contains("cs-combobox-menu-hidden"));
	});

	it("still previews a saved color while the pointer hovers it", () => {
		const h = mount();
		h.open();
		const row = h.rows()[0];
		assert.ok(row);

		row.fire("mouseenter");
		assert.ok(row.classList.contains("is-active"));
		assert.deepStrictEqual(h.previews, [SAVED.palette.id]);

		row.fire("mouseleave");
		assert.ok(!row.classList.contains("is-active"));
		assert.deepStrictEqual(h.previews, [SAVED.palette.id, null]);
		assertDeleted(h);
	});

	it("still opens on a valid committed selection without previewing it", () => {
		const h = mount();
		h.box.setSelection(SAVED.id, SAVED.name);
		h.open();

		assert.ok(h.rows()[0]?.classList.contains("is-active"));
		assert.ok(h.rows()[0]?.classList.contains("is-selected"));
		assert.strictEqual(
			h.input.getAttribute("aria-activedescendant"),
			h.rows()[0]?.id,
		);
		assert.deepStrictEqual(h.previews, []);
	});

	const dismissals: Array<[string, (h: Harness) => void]> = [
		["blur", (h) => h.input.fire("blur")],
		["an outside click", () => fakeDom.document.fire("click", { target: el() })],
		["Escape", (h) => h.key("Escape")],
		["closing for the Restore dialog", (h) => h.box.close()],
	];
	for (const [name, dismiss] of dismissals) {
		it(`preserves the deleted label and circles after ${name}`, async () => {
			const h = mount();
			h.open();
			dismiss(h);
			await Promise.resolve();

			assertDeleted(h);
			assert.ok(h.menu.classList.contains("cs-combobox-menu-hidden"));
		});
	}

	it("discards an abandoned search and restores the deleted state", async () => {
		const h = mount();
		h.open();
		h.type("Oce");
		h.input.fire("blur");
		await Promise.resolve();

		assertDeleted(h);
		h.open();
		assert.strictEqual(
			required(h.menu, ".cs-palette-menu-item-label").textContent,
			SAVED.name,
		);
	});

	it("replaces the deleted state after an explicit saved-color selection", () => {
		const h = mount();
		h.open();
		h.menu.fire("mousedown", { preventDefault: () => {} });
		required(h.menu, ".cs-combobox-option").fire("click");

		assert.deepStrictEqual(h.committed, [SAVED.id]);
		assert.strictEqual(h.input.value, SAVED.name);
		assert.strictEqual(
			required(h.lead, ".cs-color-circle-l").style.backgroundColor,
			SAVED.palette.colorLight,
		);
		assert.ok(!h.root.classList.contains("is-empty"));
		assert.ok(h.menu.classList.contains("cs-combobox-menu-hidden"));
		h.open();
		h.type("abandoned search");
		h.key("Escape");
		assert.strictEqual(h.input.value, SAVED.name);
		assert.deepStrictEqual(h.committed, [SAVED.id]);
		assert.deepStrictEqual(h.created, []);
	});
});

describe("ListboxPopup — an unknown selection without a fallback label", () => {
	it("still reads as an empty picker before and after dismissal", () => {
		fakeDom.light();
		const host = el();
		const committed: string[] = [];
		const popup = new ListboxPopup<string>(asEl(host), {
			ariaLabel: "Choice",
			placeholder: "Search choices...",
			emptyText: () => "No matches",
			itemsFor: () => ["Known"],
			keyOf: (item) => item,
			labelOf: (item) => item,
			renderRow: (row, item) => { row.textContent = item; },
			onCommit: (item) => committed.push(item),
		});
		mounted.push(popup);
		popup.setSelected("missing");
		const input = required(host, ".cs-combobox-input");
		assert.strictEqual(input.value, "");
		assert.strictEqual(popup.value, undefined);
		assert.ok(required(host, ".cs-combobox").classList.contains("is-empty"));
		input.fire("focus");
		popup.close();
		assert.strictEqual(input.value, "");
		assert.deepStrictEqual(committed, []);
	});
});
