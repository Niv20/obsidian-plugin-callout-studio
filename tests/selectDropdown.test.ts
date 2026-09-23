import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SelectDropdown } from "../src/ui/selectDropdown";
import { asEl, el, fakeDom, type FakeElement } from "./support/fakeDom";
import { dropdownOptions, pickDropdown } from "./support/selectDropdown";
import { buildHeadingLevelRow, buildActionRow } from "../src/settings/command/optionRows";
import { buildFoldStateRow } from "../src/settings/command/foldStateRow";
import { buildPaletteBgStyleRow } from "../src/settings/paletteBgStyleRow";
import { buildQuickInsertToolbar } from "../src/settings/quickInsertToolbar";
import { t } from "../src/i18n";

function mount() {
	fakeDom.light();
	const host = el();
	const changed: string[] = [];
	const select = new SelectDropdown(asEl(host), "Choices")
		.addOptions({ a: "Alpha", b: "Beta", c: "Gamma" })
		.setValue("b").onChange((value) => changed.push(value));
	return { host, select, changed };
}

describe("SelectDropdown", () => {
	it("uses the custom menu and commits only a changed user choice", () => {
		const { host, select, changed } = mount();
		try {
			assert.equal(host.querySelector("select"), null);
			assert.equal(select.inputEl.value, "Beta");
			assert.equal(select.inputEl.readOnly, true);
			const labelId = select.inputEl.getAttribute("aria-labelledby");
			const label = host.querySelector(`#${labelId}`);
			assert.equal(label?.textContent, "Choices");
			assert.equal(label?.hasAttribute("hidden"), true);
			assert.equal(select.inputEl.hasAttribute("aria-label"), false);
			assert.equal(select.inputEl.hasAttribute("title"), false);
			pickDropdown(select.el, "Beta");
			assert.deepEqual(changed, []);
			pickDropdown(select.el, "Gamma");
			assert.deepEqual(changed, ["c"]);
			assert.equal(select.getValue(), "c");
			assert.equal(select.inputEl.getAttribute("aria-expanded"), "false");
			select.setValue("a");
			assert.equal(select.inputEl.value, "Alpha");
			assert.deepEqual(changed, ["c"]);
		} finally { select.destroy(); }
	});

	it("replaces live options, selected labels and width sizing without synthetic changes", () => {
		const { select, changed } = mount();
		try {
			dropdownOptions(select.el);
			select.setOptions([{ value: "b", label: "Renamed beta" }, { value: "d", label: "Delta" }]);
			assert.equal(select.inputEl.value, "Renamed beta");
			assert.equal(select.getValue(), "b");
			assert.deepEqual(dropdownOptions(select.el).map((row) => row.textContent), ["Renamed beta", "Delta"]);
			select.setValue("d");
			assert.equal(dropdownOptions(select.el).find((row) => row.getAttribute("aria-selected") === "true")?.textContent, "Delta");
			select.setOptions([{ value: "e", label: "Epsilon" }]);
			assert.equal(select.getValue(), "e");
			assert.equal(select.el.querySelector(".cs-dropdown-width-sizer")?.textContent, "Epsilon");
			select.setOptions([]);
			assert.equal(select.getValue(), "");
			assert.equal(select.inputEl.value, "");
			assert.deepEqual(changed, []);
		} finally { select.destroy(); }
	});

	it("closes immediately when disabled and refuses mouse and keyboard reopening", () => {
		const { host, select, changed } = mount();
		try {
			dropdownOptions(select.el);
			select.setDisabled(true);
			assert.equal(select.inputEl.disabled, true);
			assert.equal(select.inputEl.getAttribute("aria-expanded"), "false");
			host.querySelector(".cs-combobox-control")!.fire("click", { target: select.inputEl });
			(select.inputEl as unknown as FakeElement).fire("keydown", { key: "ArrowDown" });
			assert.equal(select.inputEl.getAttribute("aria-expanded"), "false");
			select.setDisabled(false);
			pickDropdown(select.el, "Alpha");
			assert.deepEqual(changed, ["a"]);
		} finally { select.destroy(); }
	});

	it("returns document listeners after repeated destruction", () => {
		const documentCount = () => [...fakeDom.document.listeners.values()].reduce((sum, listeners) => sum + listeners.length, 0);
		const initial = documentCount();
		const { select } = mount();
		dropdownOptions(select.el);
		assert.ok(documentCount() > initial);
		select.destroy();
		select.destroy();
		assert.equal(documentCount(), initial);
		assert.equal(select.inputEl.getAttribute("aria-expanded"), "false");
	});
});

describe("migrated choice rows", () => {
	it("keeps numeric heading, action, fold and palette callback values", () => {
		const host = asEl(el());
		const changed: Array<string | number> = [];
		const heading = buildHeadingLevelRow(host, 2, (value) => changed.push(value));
		const action = buildActionRow(host, "insert", (value) => changed.push(value));
		const foldHost = host.createDiv();
		const fold = buildFoldStateRow(foldHost, "none", (value) => changed.push(value));
		const palette = buildPaletteBgStyleRow(host, "solid", (value) => changed.push(value));
		try {
			pickDropdown(heading.dropdown.el, "H4");
			pickDropdown(action.dropdown.el, t("commandBuilder.actionWrap"));
			pickDropdown(foldHost, t("commandBuilder.foldCollapsed"));
			pickDropdown(palette.el, t("palette.bgGradient"));
			assert.deepEqual(changed, [4, "wrap", "collapsed", "gradient"]);
			dropdownOptions(foldHost);
			fold.sync("heading");
			assert.equal(foldHost.querySelector("input")?.getAttribute("aria-expanded"), "false");
		} finally {
			heading.dropdown.destroy(); action.dropdown.destroy(); fold.destroy(); palette.destroy();
		}
	});

	it("source-menu keys never drive quick-insert search navigation", () => {
		const host = asEl(el());
		const searchKeys: string[] = [];
		const toolbar = buildQuickInsertToolbar(host, {
			filter: "all", themeLabel: "Nord", onQuery: () => {}, onFilter: () => {},
			onKey: (event) => searchKeys.push(event.key),
		});
		try {
			const key = (key: string) => (toolbar.filter.inputEl as unknown as FakeElement).fire("keydown", {
				key, preventDefault: () => {}, stopPropagation: () => {},
			});
			key("ArrowDown"); key("ArrowDown"); key("Enter");
			assert.deepEqual(searchKeys, []);
			assert.equal(toolbar.filter.getValue(), "builtin");
			(toolbar.search as unknown as FakeElement).fire("keydown", { key: "ArrowDown" });
			assert.deepEqual(searchKeys, ["ArrowDown"]);
		} finally { toolbar.destroy(); }
	});
});
