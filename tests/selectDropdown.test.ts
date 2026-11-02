/**
 * tests/selectDropdown.test.ts — a plain choice is a field that opens
 * Obsidian's own menu.
 *
 * `SelectDropdown` draws Obsidian's own dropdown (a `div.dropdown`,
 * ui/dropdownField.ts) and, on a click or a key, builds an Obsidian `Menu` of
 * its options: a ✓ on the current one, icons only when every option has one,
 * opened under the field. The menu here
 * is the test stub (`support/obsidianStub.ts`), which records what it was
 * told instead of drawing it; `support/selectDropdown.ts` clicks through it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Platform } from "obsidian";
import { SelectDropdown } from "../src/ui/selectDropdown";
import { asEl, el, fakeDom, type FakeElement } from "./support/fakeDom";
import { createdMenus } from "./support/obsidianStub";
import { dropdownButton, dropdownOptions, dropdownValue, openDropdownMenu, pickDropdown } from "./support/selectDropdown";
import { buildHeadingLevelRow, buildActionRow } from "../src/settings/command/optionRows";
import { buildFoldStateRow } from "../src/settings/command/foldStateRow";
import { buildPaletteBgStyleRow } from "../src/settings/paletteBgStyleRow";
import { buildQuickInsertToolbar } from "../src/settings/quickInsertToolbar";
import { t } from "../src/i18n";

/** A dropdown with three options, Beta chosen, recording every change. */
function mount() {
	fakeDom.light();
	const host = el();
	const changed: string[] = [];
	const select = new SelectDropdown(asEl(host), "Choices")
		.addOptions({ a: "Alpha", b: "Beta", c: "Gamma" })
		.setValue("b").onChange((value) => changed.push(value));
	const button = dropdownButton(select.el);
	return { host, select, button, changed };
}

/** A key press on the field. `preventDefault` is recorded, as the real one would act. */
function press(target: FakeElement, key: string): { prevented: boolean } {
	const result = { prevented: false };
	target.fire("keydown", { key, preventDefault: () => { result.prevented = true; } });
	return result;
}

describe("SelectDropdown — the field", () => {
	it("is Obsidian's dropdown showing the current option, named for screen readers without a tooltip", () => {
		const { host, select, button } = mount();
		try {
			assert.equal(host.querySelector("select"), null, "not the operating system's <select>");
			assert.equal(host.querySelector("input"), null);
			assert.equal(button as unknown, select.el as unknown, "the field is the dropdown's own element");
			assert.equal(button.tagName.toLowerCase(), "div", "a <button> would take Obsidian's button rules over .dropdown");
			assert.ok(button.hasClass("dropdown"), "Obsidian's own class draws it");
			assert.equal(button.getAttribute("tabindex"), "0");
			assert.equal(button.getAttribute("role"), "button");
			assert.equal(button.getAttribute("aria-haspopup"), "menu");
			assert.equal(button.getAttribute("aria-expanded"), "false");
			assert.equal(dropdownValue(select.el), "Beta");
			assert.equal(host.querySelector(".cs-dropdown-width-sizer"), null, "as wide as its words, as Obsidian's <select> is");
			// The name is the hidden label followed by the value: "Choices, Beta".
			const [labelId, valueId] = (button.getAttribute("aria-labelledby") ?? "").split(" ");
			const label = host.querySelector(`#${labelId}`);
			assert.equal(label?.textContent, "Choices");
			assert.equal(label?.hasAttribute("hidden"), true);
			assert.equal(host.querySelector(`#${valueId}`)?.textContent, "Beta");
			assert.equal(button.hasAttribute("aria-label"), false, "aria-label would become a tooltip");
			assert.equal(button.hasAttribute("title"), false);
			assert.equal(select.getValue(), "b");
		} finally { select.destroy(); }
	});
});

describe("SelectDropdown — Obsidian's menu", () => {
	it("opens under the field with every option and a ✓ on the current one", () => {
		const { select, button } = mount();
		try {
			const menu = openDropdownMenu(select.el);
			assert.deepEqual(menu.items.map((item) => item.title), ["Alpha", "Beta", "Gamma"]);
			assert.deepEqual(menu.items.map((item) => item.checked), [false, true, false]);
			// Opened at the field's bottom edge and as wide as it, as Obsidian
			// opens its own menus under a button.
			assert.equal(menu.showPosition?.overlap, true);
			assert.equal(typeof menu.showPosition?.width, "number");
			// Tied to the field, which Obsidian marks while the menu is open.
			assert.equal(menu.parentEl, button as unknown as HTMLElement);
			assert.ok(button.hasClass("has-active-menu"));
			assert.equal(button.hasClass("is-open"), false, "Obsidian's <select> shows nothing while open");
			assert.equal(button.getAttribute("aria-expanded"), "true");
		} finally { select.destroy(); }
	});

	it("reports a different pick through onChange, and the same pick not at all", () => {
		const { select, button, changed } = mount();
		try {
			pickDropdown(select.el, "Beta");
			assert.deepEqual(changed, []);
			assert.equal(button.getAttribute("aria-expanded"), "false", "a pick closes the menu");
			pickDropdown(select.el, "Gamma");
			assert.deepEqual(changed, ["c"]);
			assert.equal(select.getValue(), "c");
			assert.equal(dropdownValue(select.el), "Gamma");
			// The ✓ follows the choice the next time the menu opens.
			assert.deepEqual(dropdownOptions(select.el).map((item) => item.checked), [false, false, true]);
			// A value set by code is shown, but is not a user's change.
			select.close();
			select.setValue("a");
			assert.equal(dropdownValue(select.el), "Alpha");
			assert.deepEqual(changed, ["c"]);
		} finally { select.destroy(); }
	});

	it("reports every pick, the current one included, through onPick", () => {
		const { select } = mount();
		const picked: string[] = [];
		select.onPick((value) => picked.push(value));
		try {
			pickDropdown(select.el, "Beta");
			pickDropdown(select.el, "Alpha");
			assert.deepEqual(picked, ["b", "a"]);
		} finally { select.destroy(); }
	});

	it("closes on a second click on the field, as Obsidian's menus do", () => {
		const { select, button } = mount();
		try {
			const menu = openDropdownMenu(select.el);
			button.fire("click");
			assert.equal(menu.shown, false);
			assert.equal(button.getAttribute("aria-expanded"), "false");
			assert.equal(button.hasClass("is-open"), false);
			assert.equal(button.hasClass("has-active-menu"), false);
		} finally { select.destroy(); }
	});

	it("opens on ↓, ↑, Enter or Space, and leaves the keys to the menu once it is open", () => {
		const { select, button } = mount();
		try {
			const down = press(button, "ArrowDown");
			assert.ok(down.prevented, "the arrow must not also scroll the window");
			const menu = createdMenus[createdMenus.length - 1]!;
			assert.ok(menu.shown);
			const before = createdMenus.length;
			const again = press(button, "ArrowDown");
			assert.equal(again.prevented, false, "Obsidian's menu handles the arrow, not the field");
			assert.equal(createdMenus.length, before, "no second menu");
			select.close();
			press(button, "ArrowUp");
			assert.ok(createdMenus[createdMenus.length - 1]!.shown);
			// A `div` has no click for Enter and Space of its own, as a <select> does.
			for (const key of ["Enter", " "]) {
				select.close();
				assert.ok(press(button, key).prevented, `${key} opens the menu`);
				assert.ok(createdMenus[createdMenus.length - 1]!.shown);
			}
			select.close();
			assert.equal(press(button, "a").prevented, false, "other keys are left alone");
		} finally { select.destroy(); }
	});

	it("is an icon button with no caret: words hidden and a tooltip alone, words shown and no tooltip with showValue", () => {
		fakeDom.light();
		const alone = new SelectDropdown(asEl(el()), "Choices", { icon: "globe" }).addOptions({ a: "Alpha" }).setValue("a");
		const labelled = new SelectDropdown(asEl(el()), "Choices", { icon: "globe", showValue: true })
			.addOptions({ a: "Alpha" }).setValue("a");
		try {
			for (const select of [alone, labelled]) {
				assert.ok(select.el.querySelector(".cs-select-icon"));
				assert.equal(select.el.querySelector(".cs-dropdown-caret"), null, "no caret");
				assert.equal(select.el.querySelector(".cs-dropdown-width-sizer"), null, "no width to hold steady");
			}
			assert.equal(alone.el.querySelector(".cs-select-value")?.hasClass("cs-visually-hidden"), true);
			assert.equal(dropdownButton(alone.el).dataset.csTooltip, "Choices");
			assert.equal(labelled.el.querySelector(".cs-select-value")?.hasClass("cs-visually-hidden"), false);
			assert.equal(labelled.el.querySelector(".cs-select-value")?.textContent, "Alpha");
			assert.equal(dropdownButton(labelled.el).dataset.csTooltip, undefined);
		} finally { alone.destroy(); labelled.destroy(); }
	});

	it("draws icons only when every option has one", () => {
		fakeDom.light();
		const withIcons = new SelectDropdown(asEl(el()), "Levels")
			.setOptions([{ value: "1", label: "H1", icon: "heading-1" }, { value: "2", label: "H2", icon: "heading-2" }]);
		const mixed = new SelectDropdown(asEl(el()), "Mixed")
			.setOptions([{ value: "1", label: "H1", icon: "heading-1" }, { value: "x", label: "Other" }]);
		try {
			const full = openDropdownMenu(withIcons.el);
			assert.deepEqual(full.items.map((item) => item.icon), ["heading-1", "heading-2"]);
			assert.equal(full.noIcon, false);
			const partial = openDropdownMenu(mixed.el);
			assert.deepEqual(partial.items.map((item) => item.icon), [undefined, undefined]);
			// No icon column at all, so the words start at the row's edge.
			assert.equal(partial.noIcon, true);
		} finally { withIcons.destroy(); mixed.destroy(); }
	});

	it("gives focus back to the field when a pick leaves it nowhere", () => {
		const { select, button } = mount();
		try {
			(button as unknown as HTMLElement).focus();
			const menu = openDropdownMenu(select.el);
			// What a click on a menu row does to focus in the app.
			fakeDom.document.activeElement = null;
			menu.clickItem("Alpha");
			assert.equal(fakeDom.document.activeElement, button);
		} finally { select.destroy(); }
	});
});

describe("SelectDropdown — the page scrolling behind the menu", () => {
	/**
	 * A dropdown inside a scrolling element inside the page. The menu is placed
	 * once, so a scroll that moves the field must close it
	 * (ui/menuAnchorScroll.ts).
	 */
	function mountScrolling() {
		fakeDom.light();
		const doc = fakeDom.document;
		const outer = doc.body.createDiv();
		const scroller = outer.createDiv();
		const sibling = outer.createDiv();
		for (const element of [doc.documentElement, doc.body, outer, scroller, sibling]) {
			Object.assign(element, { scrollLeft: 0 });
		}
		const select = new SelectDropdown(asEl(scroller), "Choices")
			.addOptions({ a: "Alpha", b: "Beta" }).setValue("a");
		/** A scroll event, which does not bubble: the capture listener on the document sees it. */
		const scroll = (target: FakeElement | typeof doc, y: number): void => {
			if (target === doc) doc.documentElement.scrollTop = y;
			else (target as FakeElement).scrollTop = y;
			doc.fire("scroll", { type: "scroll", target });
		};
		const scrollListeners = (): number => doc.listeners.get("scroll")?.length ?? 0;
		const done = (): void => { select.destroy(); outer.remove(); };
		return { doc, scroller, sibling, outer, select, scroll, scrollListeners, done };
	}

	it("closes when an element holding the field scrolls, and takes its listener back", () => {
		const { select, scroller, scroll, scrollListeners, done } = mountScrolling();
		try {
			const menu = openDropdownMenu(select.el);
			assert.equal(scrollListeners(), 1);
			scroll(scroller, 75);
			assert.equal(menu.shown, false);
			assert.equal(menu.hideCalls, 1);
			assert.equal(dropdownButton(select.el).getAttribute("aria-expanded"), "false");
			assert.equal(scrollListeners(), 0, "no document hook is left behind");
		} finally { done(); }
	});

	it("closes when the page itself scrolls", () => {
		const { select, doc, scroll, scrollListeners, done } = mountScrolling();
		try {
			const menu = openDropdownMenu(select.el);
			scroll(doc, 120);
			assert.equal(menu.shown, false);
			assert.equal(scrollListeners(), 0);
		} finally { done(); }
	});

	it("keeps the menu for a scroll that moved nothing, the menu's own list, or an unrelated element", () => {
		const { select, scroller, sibling, scroll, done } = mountScrolling();
		try {
			scroller.scrollTop = 45;
			const menu = openDropdownMenu(select.el);
			// A scroll queued before the click: same position as when it opened.
			scroll(scroller, 45);
			assert.equal(menu.shown, true, "a scroll that moved nothing is not a scroll");
			// The wheel on the menu's list (the languages) is how a long menu is used.
			const list = asEl(el()) as unknown as FakeElement;
			scroll(list, 30);
			scroll(sibling, 30);
			assert.equal(menu.shown, true);
		} finally { done(); }
	});

	it("stops watching once a pick has closed the menu", () => {
		const { select, scroller, scroll, scrollListeners, done } = mountScrolling();
		try {
			openDropdownMenu(select.el).clickItem("Beta");
			assert.equal(scrollListeners(), 0);
			scroll(scroller, 10);
			assert.equal(select.getValue(), "b");
		} finally { done(); }
	});

	it("leaves a phone's bottom sheet alone: it never uses the field's position", () => {
		const { select, scroller, scroll, scrollListeners, done } = mountScrolling();
		const was = Platform.isPhone;
		Platform.isPhone = true;
		try {
			const menu = openDropdownMenu(select.el);
			assert.equal(scrollListeners(), 0);
			scroll(scroller, 75);
			assert.equal(menu.shown, true);
		} finally { Platform.isPhone = was; done(); }
	});
});

describe("SelectDropdown — options, disabling and teardown", () => {
	it("replaces live options without reporting a change", () => {
		const { select, changed } = mount();
		try {
			select.setOptions([{ value: "b", label: "Renamed beta" }, { value: "d", label: "Delta" }]);
			assert.equal(dropdownValue(select.el), "Renamed beta");
			assert.equal(select.getValue(), "b");
			assert.deepEqual(dropdownOptions(select.el).map((item) => item.title), ["Renamed beta", "Delta"]);
			select.close();
			select.setOptions([{ value: "e", label: "Epsilon" }]);
			assert.equal(select.getValue(), "e", "the first option when the old value is gone");
			assert.equal(dropdownValue(select.el), "Epsilon");
			select.setOptions([]);
			assert.equal(select.getValue(), "");
			assert.equal(dropdownValue(select.el), "");
			assert.deepEqual(changed, []);
		} finally { select.destroy(); }
	});

	it("opens no menu without options", () => {
		fakeDom.light();
		const empty = new SelectDropdown(asEl(el()), "Nothing");
		try {
			const before = createdMenus.length;
			dropdownButton(empty.el).fire("click");
			assert.equal(createdMenus.length, before);
		} finally { empty.destroy(); }
	});

	it("closes when disabled and refuses the mouse and the keyboard until enabled", () => {
		const { select, button, changed } = mount();
		try {
			const menu = openDropdownMenu(select.el);
			select.setDisabled(true);
			assert.equal(menu.shown, false);
			// Obsidian's disabled dropdown: app.css dims `.mod-disabled` and drops its hover.
			assert.ok(button.hasClass("mod-disabled"));
			assert.equal(button.getAttribute("aria-disabled"), "true");
			assert.equal(button.getAttribute("tabindex"), "-1", "out of the Tab order");
			assert.equal(button.getAttribute("aria-expanded"), "false");
			const before = createdMenus.length;
			button.fire("click");
			press(button, "ArrowDown");
			press(button, "Enter");
			assert.equal(createdMenus.length, before, "no menu while disabled");
			select.setDisabled(false);
			assert.equal(button.hasClass("mod-disabled"), false);
			assert.equal(button.hasAttribute("aria-disabled"), false);
			assert.equal(button.getAttribute("tabindex"), "0");
			pickDropdown(select.el, "Alpha");
			assert.deepEqual(changed, ["a"]);
		} finally { select.destroy(); }
	});

	it("closes its menu on destroy and stays disabled after it, however often called", () => {
		const { select, button } = mount();
		const menu = openDropdownMenu(select.el);
		select.destroy();
		select.destroy();
		select.setDisabled(false);
		assert.equal(menu.shown, false);
		assert.ok(button.hasClass("mod-disabled"));
		assert.equal(button.getAttribute("aria-expanded"), "false");
	});
});

describe("the rows built on it", () => {
	it("keep their numeric, action, fold and palette values", () => {
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
		} finally {
			heading.dropdown.destroy(); action.dropdown.destroy(); fold.destroy(); palette.destroy();
		}
	});

	it("give the heading levels and the fold states their icons, and the rest none", () => {
		const host = asEl(el());
		const heading = buildHeadingLevelRow(host, 1, () => {});
		const foldHost = host.createDiv();
		const fold = buildFoldStateRow(foldHost, "none", () => {});
		const action = buildActionRow(host, "wrap", () => {});
		try {
			assert.deepEqual(dropdownOptions(heading.dropdown.el).map((item) => item.icon),
				["heading-1", "heading-2", "heading-3", "heading-4", "heading-5", "heading-6"]);
			heading.dropdown.close();
			// The same three icons as the fold choices in a note's right-click menu.
			assert.deepEqual(dropdownOptions(foldHost).map((item) => item.icon), ["ban", "plus", "minus"]);
			fold.sync("regular");
			const actionMenu = openDropdownMenu(action.dropdown.el);
			assert.equal(actionMenu.noIcon, true);
		} finally { heading.dropdown.destroy(); fold.destroy(); action.dropdown.destroy(); }
	});

	it("close the fold menu when the row hides for a format without fold syntax", () => {
		const foldHost = asEl(el());
		const fold = buildFoldStateRow(foldHost, "none", () => {});
		try {
			const menu = openDropdownMenu(foldHost);
			fold.sync("heading");
			assert.equal(menu.shown, false);
			assert.equal(dropdownButton(foldHost).getAttribute("aria-expanded"), "false");
		} finally { fold.destroy(); }
	});

	it("keep Quick insert's source keys away from the search's list navigation", () => {
		const host = asEl(el());
		const searchKeys: string[] = [];
		const filters: string[] = [];
		const toolbar = buildQuickInsertToolbar(host, {
			filter: "all", themeLabel: "Nord", onQuery: () => {}, onFilter: (filter) => filters.push(filter),
			onKey: (event) => searchKeys.push(event.key),
		});
		try {
			press(toolbar.filter.controlEl as unknown as FakeElement, "ArrowDown");
			assert.deepEqual(searchKeys, [], "the source field's arrows open its own menu");
			openDropdownMenu(toolbar.filter.el).clickItem(t("quickInsert.sourceBuiltIn"));
			assert.equal(toolbar.filter.getValue(), "builtin");
			assert.deepEqual(filters, ["builtin"]);
			(toolbar.search as unknown as FakeElement).fire("keydown", { key: "ArrowDown" });
			assert.deepEqual(searchKeys, ["ArrowDown"]);
		} finally { toolbar.destroy(); }
	});
});
