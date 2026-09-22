import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asEl, el, fakeDom } from "./support/fakeDom";
import { IconPicker } from "../src/settings/iconpicker/IconPickerModal";
import type { IconPickerPlugin } from "../src/settings/iconpicker/IconPickerModal";

function mount() {
	fakeDom.light();
	const picker = new IconPicker({
		registry: { getUserImages: () => [] },
	} as unknown as IconPickerPlugin, { type: "lucide", value: "star" });
	const host = el();
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
		button, menu, rows,
		key: (key: string) => menu.fire("keydown", { key, preventDefault: () => {} }),
		destroy: () => {
			source.closeSourceMenu();
			activeDocument.removeEventListener("click", source.sourceMenuOutsideClick);
		},
	};
}

describe("icon library pointer navigation", () => {
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
