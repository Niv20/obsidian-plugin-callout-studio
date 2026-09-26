/** Shared chooser interaction: every box is one pointer and keyboard target. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { t } from "../src/i18n";
import { ExportFormatModal } from "../src/settings/ExportFormatModal";
import { ImportSourceModal } from "../src/settings/ImportSourceModal";
import {
	renderOptionBox,
	renderOptionList,
	type OptionBoxAvailability,
} from "../src/settings/optionBox";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

function press(box: FakeElement, key: string, repeat = false): boolean {
	let prevented = false;
	box.fire("keydown", {
		type: "keydown",
		key,
		repeat,
		preventDefault: () => { prevented = true; },
	});
	return prevented;
}

function mountBox(
	role: "button" | "radio",
	availability: OptionBoxAvailability = "enabled",
): { box: FakeElement; calls: () => number; destroy: () => void } {
	const host = fakeDom.document.body.createDiv();
	let calls = 0;
	const { el } = renderOptionBox(renderOptionList(host as unknown as HTMLElement), {
		role,
		icon: "file-json",
		title: "Choose a file",
		desc: "Choose a JSON backup.",
		availability,
		onActivate: () => { calls++; },
	});
	return {
		box: el as unknown as FakeElement,
		calls: () => calls,
		destroy: () => host.remove(),
	};
}

describe("shared option box activation", () => {
	for (const role of ["button", "radio"] as const) {
		it(`${role}: click, Enter and Space each act once, while other keys do nothing`, () => {
			const h = mountBox(role);
			try {
				assert.equal(h.box.getAttribute("role"), role);
				assert.equal(h.box.getAttribute("tabindex"), "0");
				h.box.fire("click", { type: "click", detail: 1 });
				assert.equal(h.calls(), 1);
				assert.equal(press(h.box, "Enter"), true);
				assert.equal(h.calls(), 2);
				assert.equal(press(h.box, " "), true, "Space must not also scroll the window");
				assert.equal(h.calls(), 3);
				assert.equal(press(h.box, "Escape"), false);
				assert.equal(press(h.box, "a"), false);
				assert.equal(h.calls(), 3);
			} finally {
				h.destroy();
			}
		});

		it(`${role}: double-clicks and held keys cannot reopen a picker or repeat an action`, () => {
			const h = mountBox(role);
			try {
				h.box.fire("click", { type: "click", detail: 1 });
				h.box.fire("click", { type: "click", detail: 2 });
				assert.equal(h.calls(), 1);
				for (const key of ["Enter", " "]) {
					const before = h.calls();
					press(h.box, key);
					assert.equal(press(h.box, key, true), true);
					assert.equal(press(h.box, key, true), true);
					assert.equal(h.calls(), before + 1);
				}
				h.box.fire("click", { type: "click", detail: 0 });
				assert.equal(h.calls(), 4, "assistive or programmatic clicks still activate");
			} finally {
				h.destroy();
			}
		});

		for (const availability of ["disabled", "pending"] as const) {
			it(`${role}: ${availability} options cannot activate from pointer or keyboard`, () => {
				const h = mountBox(role, availability);
				try {
					assert.equal(h.box.getAttribute("aria-disabled"), "true");
					assert.equal(h.box.hasAttribute("tabindex"), false);
					h.box.fire("click", { type: "click", detail: 1 });
					assert.equal(press(h.box, "Enter"), false);
					assert.equal(press(h.box, " "), false);
					assert.equal(h.calls(), 0);
				} finally {
					h.destroy();
				}
			});
		}
	}
});

/** Only the shell Obsidian supplies; no registry or import/export side effects. */
function mountChooser(ModalClass: typeof ImportSourceModal | typeof ExportFormatModal): {
	content: FakeElement;
	destroy: () => void;
} {
	const app = { keymap: new TestKeymap(), scope: new TestScope() };
	const modal = new ModalClass({ app } as unknown as SettingsSectionContext);
	const container = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = container.createDiv({ cls: "modal" });
	const title = modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
	const content = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, {
		app,
		scope: app.scope,
		containerEl: container,
		modalEl,
		titleEl: title,
		contentEl: content,
		setTitle: (text: string) => { title.setText(text); return modal; },
	});
	modal.onOpen();
	return {
		content,
		destroy: () => { modal.onClose(); container.remove(); },
	};
}

describe("Import and Export use the shared option box", () => {
	for (const [name, ModalClass, titles] of [
		["Import", ImportSourceModal, ["import.sourceStudio", "import.sourceCalloutManager", "import.sourceAdmonition"]],
		["Export", ExportFormatModal, ["export.formatJson", "export.formatCss"]],
	] as const) {
		it(`${name} exposes each choice as one named, described, focusable box`, () => {
			const h = mountChooser(ModalClass);
			try {
				const list = h.content.querySelector(".cs-option-list");
				assert.ok(list, "the choices share the same list spacing");
				const boxes = list.querySelectorAll(".cs-option-box");
				assert.equal(boxes.length, titles.length);
				for (const [index, box] of boxes.entries()) {
					assert.equal(box.getAttribute("role"), "button");
					assert.equal(box.getAttribute("tabindex"), "0");
					assert.equal(box.querySelector(".cs-option-box-title")?.textContent, t(titles[index]!));
					const nameId = box.getAttribute("aria-labelledby");
					const descriptionId = box.getAttribute("aria-describedby");
					assert.ok(nameId && box.querySelector(`#${nameId}`)?.textContent);
					assert.ok(descriptionId && box.querySelector(`#${descriptionId}`)?.textContent);
					assert.equal(box.querySelectorAll("button").length, 0, "the box has no competing inner button");
					assert.equal(box.getAttribute("aria-label"), null, "no Obsidian hover tooltip");
				}
			} finally {
				h.destroy();
			}
		});
	}

	it("opens Import's file chooser once for a double-click or held activation key", () => {
		const h = mountChooser(ImportSourceModal);
		try {
			const input = h.content.querySelector(".cs-import-file-input");
			const box = h.content.querySelector(".cs-option-box");
			assert.ok(input && box);
			let pickerOpens = 0;
			Object.assign(input, { click: () => { pickerOpens++; } });
			box.fire("click", { type: "click", detail: 1 });
			box.fire("click", { type: "click", detail: 2 });
			assert.equal(pickerOpens, 1);
			press(box, "Enter");
			press(box, "Enter", true);
			assert.equal(pickerOpens, 2);
			press(box, " ");
			press(box, " ", true);
			assert.equal(pickerOpens, 3);
			assert.equal(h.content.contains(input), true, "opening the picker keeps its input mounted");
		} finally {
			h.destroy();
		}
	});
});
