import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Modal } from "obsidian";
import { asEl, FakeDocument, fakeDom, type FakeElement } from "./support/fakeDom";
import { must, ruleFor, valueOf } from "./support/cssInjectorHarness";
import { readRepoFile } from "./support/sourceScan";
import { TestKeymap, TestScope } from "./support/fakeKeymap";
import { mountIconSourcePicker } from "../src/settings/iconpicker/sourcePicker";
import { t } from "../src/i18n";
import type { MenuLibraries } from "../src/icons/iconLibraries";
import { ICON_SOURCE_IDS, getSource } from "../src/icons/registry";
import type { PickerSourceId } from "../src/settings/iconpicker/allSources";
import { installModalMenuScope, removeModalMenuScope } from "../src/ui/menuEscape";

/** Every library, none left to download: the menu as it is with a full device. */
const EVERYTHING_HERE: MenuLibraries = { current: null, libraries: ICON_SOURCE_IDS, toDownload: [] };

function mount(sources: () => MenuLibraries = () => EVERYTHING_HERE, value: PickerSourceId = "lucide") {
	fakeDom.light();
	const doc = new FakeDocument();
	const host = doc.createElement("div");
	const keymap = new TestKeymap();
	const scope = new TestScope();
	let modalCloses = 0;
	scope.register(null, "Escape", () => { modalCloses++; return false; });
	keymap.pushScope(scope);
	const modal = { modalEl: host, app: { keymap }, scope } as unknown as Modal;
	installModalMenuScope(modal);
	const committed: PickerSourceId[] = [];
	const popup = mountIconSourcePicker(asEl(host), {
		value,
		sources,
		countFor: () => 12,
		onPick: (id) => committed.push(id),
	});
	const input = host.querySelector(".cs-combobox-input")!;
	const menu = host.querySelector(".cs-combobox-menu")!;
	input.focus();
	input.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
	const rows = menu.querySelectorAll(".icon-picker-source-menu-item");
	return {
		popup, input, menu, rows, committed, keymap, doc,
		modalCloses: () => modalCloses,
		key: (key: string) => {
			let prevented = false;
			let stopped = false;
			const event = { key, target: input,
				preventDefault: () => { prevented = true; },
				stopPropagation: () => { stopped = true; },
			};
			const handled = keymap.handle(event as unknown as KeyboardEvent);
			if (handled !== false && !stopped) input.fire("keydown", event);
			return { prevented, stopped };
		},
		destroy: () => {
			popup.destroy();
			removeModalMenuScope(modal);
			keymap.popScope(scope);
		},
	};
}

describe("icon library pointer navigation", () => {
	it("handles the first Escape before the modal scope and removes its child scope on teardown", () => {
		const h = mount();
		try {
			assert.equal(h.keymap.scopes.length, 2);
			assert.deepEqual(h.key("Escape"), { prevented: true, stopped: true });
			assert.equal(h.modalCloses(), 0);
			assert.equal(h.input.getAttribute("aria-expanded"), "false");
			assert.equal(h.doc.activeElement, h.input);
			assert.equal(h.keymap.scopes.length, 1, "closing restores the original modal scope");
			assert.deepEqual(h.key("Escape"), { prevented: true, stopped: false });
			assert.equal(h.modalCloses(), 1, "the next Escape reaches the containing modal");
			h.input.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
			assert.equal(h.keymap.scopes.length, 2, "reopening adds only one temporary menu scope");
			assert.deepEqual(h.key("Escape"), { prevented: true, stopped: true });
			assert.equal(h.modalCloses(), 1, "reopening registers the source menu again");
			assert.equal(h.keymap.scopes.length, 1, "closing removes that temporary scope again");
		} finally { h.destroy(); }
		assert.equal(h.keymap.scopes.length, 0, "modal teardown removes its child and parent scopes");
	});

	for (const exit of ["row", "menu"] as const) {
		it(`clears All sources hover on ${exit} exit without changing the selected library`, () => {
			const h = mount();
			try {
				const all = h.rows[0]!;
				all.fire("mouseenter");
				assert.ok(all.classList.contains("is-active"));
				(exit === "row" ? all : h.menu).fire("mouseleave");
				assert.ok(h.rows.every((row) => !row.classList.contains("is-active")));
				assert.equal(h.input.getAttribute("aria-activedescendant"), null);
				assert.equal(h.rows[1]?.getAttribute("aria-selected"), "true");
				assert.equal(h.input.getAttribute("aria-expanded"), "true");
			} finally { h.destroy(); }
		});
	}

	it("keeps keyboard navigation active after the mouse leaves", () => {
		const h = mount();
		try {
			h.rows[0]!.fire("mouseenter");
			h.key("ArrowDown");
			h.rows[0]!.fire("mouseleave");
			h.menu.fire("mouseleave");
			assert.ok(h.rows[1]?.classList.contains("is-active"));
			assert.equal(h.input.getAttribute("aria-activedescendant"), h.rows[1]?.id);
			h.key("Escape");
			assert.equal(h.input.getAttribute("aria-expanded"), "false");
		} finally { h.destroy(); }
	});

	it("returns to the library under the mouse when it moves after an arrow key", () => {
		const h = mount();
		try {
			const [all, lucide] = h.rows;
			assert.ok(all && lucide);
			all.fire("mouseenter");
			h.key("ArrowDown");
			assert.ok(lucide.classList.contains("is-active"));
			assert.ok(!all.classList.contains("is-active"));

			// The pointer stays within All sources, so there is no second enter.
			all.fire("mousemove");
			assert.ok(all.classList.contains("is-active"));
			assert.ok(!lucide.classList.contains("is-active"));
			assert.equal(h.rows.filter((row) => row.classList.contains("is-active")).length, 1);
			assert.equal(h.input.getAttribute("aria-activedescendant"), all.id);
			assert.equal(lucide.getAttribute("aria-selected"), "true");
		} finally { h.destroy(); }
	});

	it("does not move the scroll position just because a row is hovered", () => {
		const h = mount();
		try {
			let scrolls = 0;
			for (const row of h.rows) row.scrollIntoView = () => { scrolls++; };
			h.rows[0]!.fire("mouseenter");
			assert.equal(scrolls, 0);
			h.key("ArrowDown");
			assert.equal(scrolls, 1);
		} finally { h.destroy(); }
	});
	it("commits a source through the shared listbox and retains its rich menu rows", () => {
		const h = mount();
		try {
			assert.equal(h.popup.inputEl.readOnly, true);
			assert.ok(h.rows[1]?.querySelector(".icon-picker-source-menu-item-emblem"));
			h.rows[0]!.fire("click");
			assert.deepEqual(h.committed, ["all"]);
			assert.equal(h.input.getAttribute("aria-expanded"), "false");
			h.input.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
			assert.equal(h.menu.querySelectorAll(".icon-picker-source-menu-item")[0]
				?.getAttribute("aria-selected"), "true");
		} finally { h.destroy(); }
	});

});


describe("icon library menu headings", () => {
	const SOME_TO_DOWNLOAD: MenuLibraries = {
		current: null,
		libraries: ["lucide", "material", "emoji", "image"],
		toDownload: ["tabler", "octicons"],
	};
	const headings = (menu: FakeElement): string[] =>
		menu.querySelectorAll(".cs-combobox-group-label").map((label) => label.textContent);
	const names = (group: FakeElement | undefined): string[] =>
		must(group, "group").querySelectorAll(".cs-source-name").map((name) => name.textContent);
	const label = (id: PickerSourceId): string =>
		t(id === "all" ? "iconPicker.allSources" : getSource(id).labelKey);

	it("heads All sources and the libraries apart, even with every library on the device", () => {
		// All sources is a search, not a library, so it never shares a heading
		// with them — and with nothing left to download there is still a heading
		// over each.
		const h = mount();
		try {
			assert.deepEqual(headings(h.menu), [t("iconPicker.groupSearch"), t("iconPicker.groupLibraries")]);
			const [search, libraries] = h.menu.querySelectorAll(".cs-combobox-group");
			assert.deepEqual(names(search), [label("all")]);
			assert.deepEqual(names(libraries), ICON_SOURCE_IDS.map(label));
			assert.ok(h.menu.hasClass("cs-combobox-menu-grouped"));
		} finally { h.destroy(); }
	});

	it("lists only the libraries it is given — never one to download — with no status on any row", () => {
		const h = mount(() => SOME_TO_DOWNLOAD);
		try {
			const listed = h.menu.querySelectorAll(".cs-source-name").map((name) => name.textContent);
			assert.deepEqual(listed, ["all", ...SOME_TO_DOWNLOAD.libraries].map((id) => label(id as PickerSourceId)));
			assert.ok(!listed.includes(label("tabler")) && !listed.includes(label("octicons")));
			assert.equal(h.menu.textContent.includes(t("iconPicker.notDownloaded")), false);
			assert.equal(headings(h.menu).includes(t("iconPicker.librariesToDownload")), false);
			assert.equal(headings(h.menu).includes(t("iconPicker.librariesAvailable")), false);
		} finally { h.destroy(); }
	});

	it("pins each heading to the top of the scrolling menu", () => {
		const css = readRepoFile("styles.css");
		const heading = ruleFor(css, ".cs-combobox-group-label");
		assert.equal(valueOf(heading, "position"), "sticky");
		assert.equal(valueOf(heading, "top"), "0");
		assert.ok(valueOf(heading, "background"), "an opaque ground, or rows would show through it");
		// Each heading is held inside its own group, so the next one takes over.
		assert.equal(valueOf(ruleFor(css, ".cs-combobox-group"), "position"), "relative");
	});
});

describe("icon library menu — the line counting libraries to download", () => {
	const libraries: readonly PickerSourceId[] = ["lucide", "material", "emoji", "image"];
	const withToDownload = (toDownload: MenuLibraries["toDownload"]): MenuLibraries =>
		({ current: null, libraries: libraries as MenuLibraries["libraries"], toDownload });
	const note = (menu: FakeElement): FakeElement | undefined =>
		menu.querySelector(".cs-combobox-footer-note") ?? undefined;

	it("closes the list with how many libraries are left to download", () => {
		const h = mount(() => withToDownload(["tabler", "octicons", "fa"]));
		try {
			const line = must(note(h.menu), "closing line");
			assert.equal(line.textContent, t("iconPicker.moreToDownload", { count: 3 }));
			assert.equal(t("iconPicker.moreToDownload", { count: 3 }), "3 more libraries available for download");
			assert.equal(h.menu.children[h.menu.children.length - 1], line, "it is the very last thing in the list");
		} finally { h.destroy(); }
	});

	it("says one library in the singular", () => {
		const h = mount(() => withToDownload(["simple-icons"]));
		try {
			assert.equal(must(note(h.menu), "closing line").textContent, "1 more library available for download");
		} finally { h.destroy(); }
	});

	it("says nothing once every library is on the device", () => {
		const h = mount(() => withToDownload([]));
		try {
			assert.equal(note(h.menu), undefined);
		} finally { h.destroy(); }
	});

	it("follows a download or a deletion while the menu is open", () => {
		let menu = withToDownload(["tabler", "octicons"]);
		const h = mount(() => menu);
		try {
			menu = { ...withToDownload(["octicons"]), libraries: [...libraries, "tabler"] as MenuLibraries["libraries"] };
			h.popup.setItems();
			assert.equal(must(note(h.menu), "closing line").textContent, t("iconPicker.moreToDownloadOne"));
			menu = withToDownload([]);
			h.popup.setItems();
			assert.equal(note(h.menu), undefined);
			menu = withToDownload(["tabler"]);
			h.popup.setItems();
			assert.ok(note(h.menu), "deleting a library brings the line back");
		} finally { h.destroy(); }
	});

	it("is text, not a row: no role, out of the arrow keys' reach, and a press changes nothing", () => {
		const h = mount(() => withToDownload(["tabler", "octicons"]));
		try {
			const line = must(note(h.menu), "closing line");
			assert.equal(line.getAttribute("role"), null);
			assert.equal(line.hasClass("cs-combobox-option"), false);

			h.key("End");
			const rows = h.menu.querySelectorAll(".cs-combobox-option");
			const last = must(rows[rows.length - 1], "last row");
			assert.ok(last.hasClass("is-active"), "End stops on the last library");
			h.key("ArrowDown");
			assert.ok(last.hasClass("is-active"), "and so does going past it");
			assert.equal(h.input.getAttribute("aria-activedescendant"), last.id);
			assert.ok(!line.hasClass("is-active"));

			line.dispatchEvent({ type: "click", bubbles: true });
			assert.deepEqual(h.committed, []);
			assert.equal(h.input.getAttribute("aria-expanded"), "true", "the menu stays open");
		} finally { h.destroy(); }
	});

	it("looks like the end of the list, not like a row to press", () => {
		const css = readRepoFile("styles.css");
		const rule = ruleFor(css, ".cs-combobox-footer-note");
		assert.equal(valueOf(rule, "cursor"), "default");
		assert.ok(valueOf(rule, "border-top"), "a rule above it, as between groups");
		assert.doesNotMatch(css, /\.cs-combobox-footer-note:hover/, "nothing to answer a pointer with");
	});
});

describe("icon library menu — the edited icon's library when the picker does not offer it", () => {
	// Edit a callout whose icon came from a library since deleted (or never
	// downloaded on this device): the picker opens on that library, so the
	// closed menu names it, and the open menu shows it first, under a heading of
	// its own rather than among the libraries on the device.
	const EDITING_TABLER: MenuLibraries = {
		current: "tabler",
		libraries: ["lucide", "material", "emoji", "image"],
		toDownload: ["octicons", "fa", "rpg-awesome", "simple-icons"],
	};
	const groups = (menu: FakeElement): FakeElement[] => menu.querySelectorAll(".cs-combobox-group");

	it("names it in the closed menu", () => {
		const h = mount(() => EDITING_TABLER, "tabler");
		try {
			h.key("Escape");
			assert.equal((h.input as unknown as HTMLInputElement).value, t("iconPicker.tabler"));
			assert.equal(h.popup.value, "tabler");
		} finally { h.destroy(); }
	});

	it("lists it first, alone under Current icon, with the check", () => {
		const h = mount(() => EDITING_TABLER, "tabler");
		try {
			const [current, search, libraries] = groups(h.menu);
			assert.equal(must(current, "current").querySelector(".cs-combobox-group-label")?.textContent, t("iconPicker.groupCurrent"));
			assert.deepEqual(must(current, "current").querySelectorAll(".cs-source-name").map((n) => n.textContent), [t("iconPicker.tabler")]);
			assert.ok(must(current, "current").querySelector(".cs-source-check"), "it is the library on screen");
			assert.equal(must(search, "search").querySelector(".cs-combobox-group-label")?.textContent, t("iconPicker.groupSearch"));
			assert.equal(must(libraries, "libraries").querySelectorAll(".cs-source-name").length, 4);
			assert.ok(h.rows[0]?.hasClass("is-active"), "the menu opens on it");
		} finally { h.destroy(); }
	});

	it("keeps it there after another library is chosen, as the way back", () => {
		const h = mount(() => EDITING_TABLER, "tabler");
		try {
			const lucide = must(h.menu.querySelectorAll(".icon-picker-source-menu-item")
				.find((row) => row.textContent.includes(t("iconPicker.lucide"))), "Lucide row");
			lucide.fire("click");
			assert.deepEqual(h.committed, ["lucide"]);
			h.input.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
			const [current] = groups(h.menu);
			const tabler = must(must(current, "current").querySelector(".icon-picker-source-menu-item") ?? undefined, "Tabler row");
			assert.equal(tabler.querySelector(".cs-source-check"), null, "no longer the one on screen");
			tabler.fire("click");
			assert.deepEqual(h.committed, ["lucide", "tabler"]);
		} finally { h.destroy(); }
	});

	it("has no Current icon heading once the library is back among the others", () => {
		let menu = EDITING_TABLER;
		const h = mount(() => menu, "tabler");
		try {
			menu = { current: null, libraries: ["lucide", "tabler", "material", "emoji", "image"], toDownload: EDITING_TABLER.toDownload };
			h.popup.setItems();
			const labels = h.menu.querySelectorAll(".cs-combobox-group-label").map((el) => el.textContent);
			assert.deepEqual(labels, [t("iconPicker.groupSearch"), t("iconPicker.groupLibraries")]);
			const checked = h.menu.querySelectorAll(".cs-source-check").map((check) => check.parentElement?.textContent ?? "");
			assert.equal(checked.length, 1);
			assert.ok(checked[0]?.includes(t("iconPicker.tabler")), "downloaded from its prompt, it is still the one chosen");
		} finally { h.destroy(); }
	});
});
