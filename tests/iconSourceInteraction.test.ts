import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Modal } from "obsidian";
import { asEl, FakeDocument, fakeDom } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";
import { IconPicker } from "../src/settings/iconpicker/IconPickerModal";
import type { IconPickerPlugin } from "../src/settings/iconpicker/IconPickerModal";
import { installModalMenuScope, removeModalMenuScope } from "../src/ui/menuEscape";

function mount() {
	fakeDom.light();
	const doc = new FakeDocument();
	const picker = new IconPicker({
		registry: { getUserImages: () => [] },
	} as unknown as IconPickerPlugin, { type: "lucide", value: "star" });
	const host = doc.createElement("div");
	const keymap = new TestKeymap();
	const scope = new TestScope();
	let modalCloses = 0;
	scope.register(null, "Escape", () => { modalCloses++; return false; });
	keymap.pushScope(scope);
	const modal = { modalEl: host, app: { keymap }, scope } as unknown as Modal;
	installModalMenuScope(modal);
	picker.contentEl = asEl(host);
	const source = picker as unknown as {
		buildSourcePicker(host: HTMLElement): void;
		closeSourceMenu(): void;
		sourceMenuOutsideClick: EventListener;
	};
	source.buildSourcePicker(asEl(host));
	const button = host.querySelector(".icon-picker-source-button")!;
	const menu = host.querySelector(".icon-picker-source-menu")!;
	button.fire("click");
	const rows = menu.querySelectorAll(".icon-picker-source-menu-item");
	return {
		button, menu, rows, keymap, doc,
		modalCloses: () => modalCloses,
		key: (key: string) => {
			let prevented = false;
			let stopped = false;
			const event = { key, target: menu,
				preventDefault: () => { prevented = true; },
				stopPropagation: () => { stopped = true; },
			};
			const handled = keymap.handle(event as unknown as KeyboardEvent);
			if (handled !== false && !stopped) menu.fire("keydown", event);
			return { prevented, stopped };
		},
		destroy: () => {
			source.closeSourceMenu();
			removeModalMenuScope(modal);
			keymap.popScope(scope);
			activeDocument.removeEventListener("click", source.sourceMenuOutsideClick);
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
			assert.equal(h.button.getAttribute("aria-expanded"), "false");
			assert.equal(h.doc.activeElement, h.button);
			assert.equal(h.keymap.scopes.length, 1, "closing restores the original modal scope");
			assert.deepEqual(h.key("Escape"), { prevented: true, stopped: false });
			assert.equal(h.modalCloses(), 1, "the next Escape reaches the containing modal");
			h.button.fire("click");
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
				assert.equal(h.menu.getAttribute("aria-activedescendant"), null);
				assert.equal(h.rows[1]?.getAttribute("aria-selected"), "true");
				assert.equal(h.button.getAttribute("aria-expanded"), "true");
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
			assert.equal(h.menu.getAttribute("aria-activedescendant"), h.rows[1]?.id);
			h.key("Escape");
			assert.equal(h.button.getAttribute("aria-expanded"), "false");
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
			assert.equal(h.menu.getAttribute("aria-activedescendant"), all.id);
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
});
