import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IconPack, IconVariantState } from "../src/icons/types";
import { PackPanel, type PackPanelHost } from "../src/settings/iconpicker/PackPanel";
import { PackToolbarFilters } from "../src/settings/iconpicker/PackToolbarFilters";
import { t } from "../src/i18n";
import { asEl, el, fakeDom } from "./support/fakeDom";

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
	const choose = (className: string, index: number) => {
		const root = picker(className);
		root.querySelector(".cs-combobox-input")!.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
		root.querySelectorAll(".cs-combobox-option")[index]!.fire("click");
	};
	return {
		host, filters, categoryChanges, variantChanges, beforeListeners,
		picker, choose,
		destroy: () => filters.destroy(),
	};
}

describe("icon pack toolbar filters", () => {
	it("uses selection-only listboxes for every category and variant filter", () => {
		const h = mount();
		try {
			assert.equal(h.host.querySelectorAll("select").length, 0);
			assert.equal(h.host.querySelectorAll(".icon-picker-filter").length, 4);
			for (const root of h.host.querySelectorAll(".icon-picker-filter")) {
				const input = root.querySelector(".cs-combobox-input")!;
				assert.equal(input.readOnly, true);
				assert.equal(input.getAttribute("aria-autocomplete"), "none");
			}
			assert.equal(h.filters.setCategories(["Animals", "Food"]), "Animals");
			assert.equal(
				h.picker("icon-picker-category-picker").querySelector(".cs-combobox-input")?.value,
				t("iconPicker.cat.Animals"),
			);
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
			const weightPicker = h.host.querySelectorAll(".icon-picker-variant-picker")[1]!;
			weightPicker.querySelector(".cs-combobox-input")!.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
			weightPicker.querySelectorAll(".cs-combobox-option")[0]!.fire("click");
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
			assert.equal(
				h.picker("icon-picker-category-picker").querySelector(".cs-combobox-input")?.value,
				t("iconPicker.allCategories"),
			);
			h.filters.setEnabled(false);
			for (const root of h.host.querySelectorAll(".icon-picker-filter")) {
				const input = root.querySelector(".cs-combobox-input")!;
				assert.equal(input.disabled, true);
				input.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
				assert.equal(input.getAttribute("aria-expanded"), "false");
			}
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
		for (const picker of pickers) {
			const input = picker.querySelector(".cs-combobox-input")!;
			assert.equal(input.disabled, true);
			input.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
			assert.equal(input.getAttribute("aria-expanded"), "false");
		}
		assert.deepEqual(saved, []);
	} finally { panel.dispose(); }
	assert.equal(fakeDom.document.listeners.get("click")?.length ?? 0, beforeListeners);
});
