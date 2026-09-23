import assert from "node:assert/strict";
import type { FakeElement } from "./fakeDom";

/** Exercise the visible custom choice menu, including its actual commit event. */
export function dropdownOptions(root: HTMLElement): FakeElement[] {
	const input = root.querySelector<HTMLInputElement>("input")!;
	assert.ok(input);
	if (input.getAttribute("aria-expanded") !== "true") {
		(input as unknown as FakeElement).fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
	}
	return Array.from(root.querySelectorAll(".cs-combobox-option")) as unknown as FakeElement[];
}
export function pickDropdown(root: HTMLElement, label: string): void {
	const option = dropdownOptions(root).find((row) => row.textContent === label);
	assert.ok(option, `missing choice ${label}`);
	option.fire("click");
}
