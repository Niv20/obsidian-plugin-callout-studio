import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IconPack, IconVariantState } from "../src/icons/types";
import { getSource, ICON_SOURCE_IDS } from "../src/icons/registry";
import { PackPanel, type PackPanelHost } from "../src/settings/iconpicker/PackPanel";
import { PackToolbarFilters } from "../src/settings/iconpicker/PackToolbarFilters";
import { t } from "../src/i18n";
import { asEl, el, fakeDom, type FakeElement } from "./support/fakeDom";
import { dropdownValue, openDropdownMenu } from "./support/selectDropdown";

/**
 * Assert that the filter under `root` is locked: greyed out, and a key that
 * would open it opens nothing. A plain choice is a button opening Obsidian's
 * menu; the skin-tone picker is the plugin's own select-only list.
 */
function assertLocked(root: FakeElement): void {
	const field = root.querySelector(".cs-select-button") ?? root.querySelector(".cs-combobox-input");
	assert.ok(field);
	assert.equal((field as unknown as HTMLButtonElement).disabled, true);
	field.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
	assert.equal(field.getAttribute("aria-expanded"), "false");
}

const pack = {
	hasCategories: true,
	variants: [
		{
			kind: "select", key: "style", labelKey: "iconPicker.materialStyle",
			options: ["outlined", "filled"],
			optionLabelKeys: ["iconPicker.materialStyleOutlined", "iconPicker.materialStyleFilled"],
		},
		{
			kind: "select", key: "weight", labelKey: "iconPicker.materialWeight",
			options: [100, 400],
			optionLabelKeys: ["iconPicker.materialWeight100", "iconPicker.materialWeight400"],
		},
		{ kind: "skin-tone" },
	],
} as unknown as IconPack;

function mount(category = "Animals") {
	fakeDom.light();
	const host = el();
	const categoryChanges: string[] = [];
	const variantChanges: Array<{ variants: IconVariantState; kind: string }> = [];
	const beforeListeners = fakeDom.document.listeners.get("click")?.length ?? 0;
	const filters = new PackToolbarFilters(
		asEl(host), pack,
		{ style: "outlined", weight: 400, emojiSkinTone: 2 }, category,
		{
			onCategory: (value) => categoryChanges.push(value),
			onVariant: (variants, kind) => variantChanges.push({ variants, kind }),
		},
	);
	const picker = (className: string) => host.querySelector(`.${className}`)!;
	/** Open a plain choice's menu and click its `index`-th item. */
	const choose = (className: string, index: number) => {
		openDropdownMenu(asEl(picker(className))).clickItemAt(index);
	};
	return {
		host, filters, categoryChanges, variantChanges, beforeListeners,
		picker, choose,
		destroy: () => filters.destroy(),
	};
}

describe("icon pack toolbar filters", () => {
	it("sets layout markers from rendered filters for every source and clears them on reuse", () => {
		fakeDom.light();
		const toolbar = el();
		for (const sourceId of ICON_SOURCE_IDS) {
			const filters = new PackToolbarFilters(asEl(toolbar), getSource(sourceId), {}, "", {
				onCategory: () => {}, onVariant: () => {},
			});
			try {
				for (const key of ["tablerStyle", "weight"]) {
					assert.equal(toolbar.hasClass(`has-${key}-filter`),
						toolbar.querySelector(`.icon-picker-${key}-select`) !== null,
						`${sourceId}: layout follows the filter that is actually rendered`);
				}
				filters.setEnabled(false);
				for (const key of ["tablerStyle", "weight"]) {
					assert.equal(toolbar.hasClass(`has-${key}-filter`),
						toolbar.querySelector(`.icon-picker-${key}-select`) !== null,
						"locked filters keep the same layout while awaiting download");
				}
			} finally { filters.destroy(); }
			assert.equal(toolbar.hasClass("has-tablerStyle-filter"), false);
			assert.equal(toolbar.hasClass("has-weight-filter"), false);
			toolbar.empty();
		}
	});

	it("opens Obsidian's menu for the category and style filters, and keeps the tone picker select-only", () => {
		const h = mount();
		try {
			assert.equal(h.host.querySelectorAll("select").length, 0);
			assert.equal(h.host.querySelectorAll(".icon-picker-filter").length, 4);
			// Style, weight and category are plain choices: a button and a menu.
			assert.equal(h.host.querySelectorAll(".icon-picker-filter .cs-select-button").length, 3);
			// The tone picker draws emoji samples in its rows, which a menu cannot,
			// so it stays the plugin's own list, opened from a read-only field.
			const tone = h.picker("icon-picker-skin-tone-picker").querySelector(".cs-combobox-input")!;
			assert.equal(tone.readOnly, true);
			assert.equal(tone.getAttribute("aria-autocomplete"), "none");
			assert.equal(h.filters.setCategories(["Animals", "Food"]), "Animals");
			assert.equal(dropdownValue(asEl(h.picker("icon-picker-category-picker"))), t("iconPicker.cat.Animals"));
		} finally { h.destroy(); }
	});

	it("commits categories and numeric weights while keeping variant state", () => {
		const h = mount();
		try {
			h.filters.setCategories(["Animals", "Food"]);
			h.choose("icon-picker-category-picker", 2);
			assert.deepEqual(h.categoryChanges, ["Food"]);
			h.choose("icon-picker-variant-picker", 1);
			assert.deepEqual(h.variantChanges[0], {
				variants: { style: "filled", weight: 400, emojiSkinTone: 2 },
				kind: "select",
			});
			openDropdownMenu(asEl(h.host.querySelectorAll(".icon-picker-variant-picker")[1]!)).clickItemAt(0);
			assert.deepEqual(h.variantChanges[1], {
				variants: { style: "filled", weight: 100, emojiSkinTone: 2 },
				kind: "select",
			});
		} finally { h.destroy(); }
	});

	it("shows emoji samples and commits the chosen tone", () => {
		const h = mount();
		try {
			const tone = h.picker("icon-picker-skin-tone-picker");
			assert.equal(tone.querySelector(".cs-combobox-lead")?.textContent, "✋🏼");
			tone.querySelector(".cs-combobox-input")!.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
			const rows = tone.querySelectorAll(".cs-combobox-option");
			assert.equal(rows.length, 6);
			assert.equal(rows[4]?.querySelector(".icon-picker-skin-tone-sample")?.textContent, "✋🏾");
			rows[4].fire("click");
			assert.equal(tone.querySelector(".cs-combobox-lead")?.textContent, "✋🏾");
			assert.deepEqual(h.variantChanges, [{
				variants: { style: "outlined", weight: 400, emojiSkinTone: 4 },
				kind: "skin-tone",
			}]);
		} finally { h.destroy(); }
	});

	it("falls back from a removed category and locks and releases every picker", () => {
		const h = mount("Removed");
		try {
			assert.equal(h.filters.setCategories(["Animals"]), "");
			assert.equal(dropdownValue(asEl(h.picker("icon-picker-category-picker"))), t("iconPicker.allCategories"));
			h.filters.setEnabled(false);
			for (const root of h.host.querySelectorAll(".icon-picker-filter")) assertLocked(root);
		} finally { h.destroy(); }
		assert.equal(fakeDom.document.listeners.get("click")?.length ?? 0, h.beforeListeners);
	});
});

it("keeps every toolbar picker locked while a pack awaits download", async () => {
	fakeDom.light();
	const container = el();
	const beforeListeners = fakeDom.document.listeners.get("click")?.length ?? 0;
	const remotePack = {
		id: "tabler", kind: "bundledRemote", dataPacks: ["tabler-outline"],
		hasCategories: true, searchPlaceholderKey: "iconPicker.searchTabler",
		variants: [{
			kind: "select", key: "tablerStyle", labelKey: "iconPicker.tablerStyle",
			options: ["outline", "filled"],
		}],
		attribution: { title: "Tabler", licenses: [] },
		loadIndex: async () => ({ entries: [], categories: ["Animals"] }),
	} as unknown as IconPack;
	const saved: IconVariantState[] = [];
	const host = {
		packs: { state: () => "missing", info: () => ({ bytes: 1024 }) },
		variantsFor: () => ({ tablerStyle: "outline" }),
		saveVariants: (_source: string, variants: IconVariantState) => saved.push(variants),
		lastCategoryFor: () => "Animals",
		saveCategory: () => {},
		selectedIcon: () => null,
		onSelect: () => {},
	} as unknown as PackPanelHost;
	const panel = new PackPanel(asEl(container), remotePack, host);
	try {
		await panel.render();
		assert.equal(container.querySelector(".icon-picker-search-input")?.disabled, true);
		const pickers = container.querySelectorAll(".icon-picker-filter");
		assert.equal(pickers.length, 2);
		for (const picker of pickers) assertLocked(picker);
		assert.deepEqual(saved, []);
	} finally { panel.dispose(); }
	assert.equal(fakeDom.document.listeners.get("click")?.length ?? 0, beforeListeners);
});
