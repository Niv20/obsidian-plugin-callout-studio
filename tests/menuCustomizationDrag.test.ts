import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ToggleComponent, type App } from "obsidian";
import { MenuCustomizationModal } from "../src/settings/MenuCustomizationModal";
import type { ContextMenuItemConfig, PluginSettings } from "../src/types";
import { asEl, el, installFakeDom, type FakeElement } from "./support/fakeDom";

installFakeDom();
// This suite operates the handles; toggles only need to accept their setup.
Object.assign(ToggleComponent.prototype, {
	setValue() { return this; },
	onChange() { return this; },
});
Object.assign(window, { matchMedia: () => ({ matches: true }) });

function mount() {
	const items: ContextMenuItemConfig[] = [
		{ id: "edit", enabled: true },
		{ id: "openSettings", enabled: true },
		{ id: "copyMarkdown", enabled: true },
	];
	let saves = 0;
	const modal = new MenuCustomizationModal({} as App, {
		settings: { contextMenu: { items: { regular: items } } } as PluginSettings,
		saveSettings: async () => { saves++; },
	});
	const content = el();
	modal.contentEl = asEl(content);
	(modal as unknown as { renderRole(role: string): void }).renderRole("regular");
	const list = content.querySelector(".cs-menu-customize-list")!;
	asEl(list).setPointerCapture = () => {};
	asEl(list).releasePointerCapture = () => {};
	const rows = list.querySelectorAll(".cs-menu-row");
	for (const row of rows) {
		Object.assign(row, { instanceOf: (ctor: typeof FakeElement) => row instanceof ctor });
		Object.defineProperty(row, "nextElementSibling", {
			get: () => list.children[list.children.indexOf(row) + 1] ?? null,
		});
		row.style.removeProperty = (name: string) => { delete row.style[name]; };
		row.getBoundingClientRect = () => {
			const top = list.children.indexOf(row) * 40;
			return {
				x: 0, y: top, top, bottom: top + 36, left: 0, right: 240,
				width: 240, height: 36, toJSON: () => ({}),
			};
		};
	}
	const drag = (row: FakeElement, toY: number) => {
		const target = row.querySelector(".cs-drag-handle")!;
		const event = { pointerId: 1, button: 0, target, preventDefault: () => {} };
		list.fire("pointerdown", { ...event, clientY: row.getBoundingClientRect().top + 18 });
		list.fire("pointermove", { ...event, clientY: toY });
		list.fire("pointerup", event);
	};
	return {
		modal, rows, list, items, drag,
		saves: () => saves,
		order: () => list.querySelectorAll(".cs-menu-row").map((row) => row.dataset.csItemId),
	};
}

describe("menu customization after pointer reordering", () => {
	it("keeps the row nodes available for repeated drags and saves each move", () => {
		const h = mount();
		try {
			h.drag(h.rows[0]!, 110);
			assert.equal(h.rows[0]!.parentElement, h.list, "dropping must preserve the next handle target");
			assert.deepEqual(h.order(), ["openSettings", "copyMarkdown", "edit"]);
			h.drag(h.rows[0]!, 8);
			assert.deepEqual(h.order(), ["edit", "openSettings", "copyMarkdown"]);
			assert.deepEqual(h.items.map((item) => item.id), h.order());
			assert.equal(h.saves(), 2);
		} finally { h.modal.onClose(); }
	});

	it("uses a handle's current position for keyboard movement after a drag", () => {
		const h = mount();
		try {
			h.drag(h.rows[0]!, 110);
			h.rows[0]!.querySelector(".cs-drag-handle")!.fire("keydown", {
				key: "ArrowUp", preventDefault: () => {},
			});
			assert.deepEqual(h.order(), ["openSettings", "edit", "copyMarkdown"]);
			assert.deepEqual(h.items.map((item) => item.id), h.order());
			assert.equal(h.saves(), 2);
			assert.equal(h.list.querySelectorAll(".cs-drag-handle")[1]!.focusCount, 1);
		} finally { h.modal.onClose(); }
	});
});
