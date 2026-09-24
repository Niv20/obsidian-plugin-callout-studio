import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { t } from "../src/i18n";
import { PortableCustomReplacementModal, type PortableReplacementField } from "../src/portable/PortableCustomReplacementModal";
import { fakeDom } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

function harness(fields: readonly PortableReplacementField[]) {
	fakeDom.light();
	const saved: (readonly string[])[] = [];
	let failure: string | undefined;
	const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
	const modal = new PortableCustomReplacementModal(app, fields, values => { if (!failure) saved.push(values); return failure; });
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" }), titleEl = modalEl.createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, { containerEl, modalEl, titleEl, contentEl, app, scope: app.scope,
		setTitle: (title: string) => { titleEl.setText(title); return modal; }, close: () => modal.onClose() });
	modal.onOpen();
	return { modal, modalEl, contentEl, saved,
		inputs: contentEl.querySelectorAll("input"),
		saveButton: modalEl.querySelector(".mod-cta")!,
		save: () => modalEl.querySelector(".mod-cta")!.fire("click"),
		fail: (message: string) => { failure = message; },
		destroy: () => { modal.onClose(); containerEl.remove(); },
	};
}

describe("custom replacement editor boundaries", () => {
	it("enables Save only while text differs from the value on opening, including existing custom text", () => {
		const h = harness([{ source: "[!note]{First}", value: "Existing custom text" }]);
		try {
			const input = h.inputs[0]!;
			assert.equal(h.saveButton.disabled, true);
			h.save();
			assert.deepEqual(h.saved, [], "an unchanged draft cannot invoke Save even through a synthetic click");
			input.value += "!"; input.fire("input");
			assert.equal(h.saveButton.disabled, false);
			input.value = "Existing custom text"; input.fire("input");
			assert.equal(h.saveButton.disabled, true);
			h.save(); assert.deepEqual(h.saved, []);
			input.value += " "; input.fire("input");
			assert.equal(h.saveButton.disabled, false, "compare exact text without trimming the user's replacement");
			h.save();
			assert.deepEqual(h.saved, [["Existing custom text "]]);
		} finally { h.destroy(); }
	});
	it("shows only Before and After for one inline, with immutable source and nearby context", () => {
		const h = harness([
			{ source: "[!note]{First}", value: "First", before: "One two three", after: "four five six" },
		]);
		try {
			assert.equal(h.inputs.length, 1);
			assert.equal(h.contentEl.querySelector("textarea"), null);
			assert.equal(h.contentEl.querySelector("legend"), null);
			assert.deepEqual(h.contentEl.querySelectorAll(".cs-portable-custom-label").map(el => el.textContent),
				[t("portable.before"), t("portable.after")]);
			assert.deepEqual(h.inputs.map(input => input.value), ["First"]);
			assert.ok(h.inputs.every(input => input.getAttribute("type") === "text"));
			assert.deepEqual(h.contentEl.querySelectorAll(".cs-portable-custom-editor .cs-portable-custom-fixed").map(el => el.textContent),
				["One two three", "four five six"]);
			assert.deepEqual(h.contentEl.querySelectorAll(".cs-portable-custom-editor .cs-portable-custom-outer-word").map(el => el.textContent), ["One", "six"]);
			assert.deepEqual(h.contentEl.querySelectorAll("code").map(el => el.textContent), ["[!note]{First}"]);
			h.inputs[0]!.value = "Custom first";
			h.save();
			assert.deepEqual(h.saved, [["Custom first"]]);
		} finally { h.destroy(); }
	});
	it("keeps heading level, container prefix and closing markers outside the editable title", () => {
		const h = harness([{ source: "> ## [!note] Title ##", value: "Title", before: "> ## ", after: " ##", heading: true }]);
		try {
			assert.equal(h.inputs.length, 1); assert.equal(h.inputs[0]!.value, "Title");
			assert.deepEqual(h.contentEl.querySelectorAll(".cs-portable-custom-fixed").map(el => el.textContent), ["> ## ", " ##"]);
			assert.equal(h.contentEl.querySelectorAll(".cs-portable-custom-markers").length, 2);
			h.inputs[0]!.value = "New title"; h.save();
			assert.deepEqual(h.saved, [["New title"]]);
		} finally { h.destroy(); }
	});
	it("blocks Enter, input-method line breaks and multiline pastes without saving", () => {
		const h = harness([{ source: "[!note]", value: "note" }]);
		try {
			const input = h.inputs[0]!;
			for (const [type, detail] of [
				["keydown", { key: "Enter" }], ["beforeinput", { inputType: "insertLineBreak" }],
				["beforeinput", { inputType: "insertParagraph" }],
				...["a\nb", "a\rb", "a\0b", "a\u2028b", "a\u2029b"].map(text =>
					["paste", { clipboardData: { getData: () => text } }] as const),
			] as const) {
				let prevented = false;
				input.fire(type, { ...detail, preventDefault: () => { prevented = true; } });
				assert.equal(prevented, true, type);
			}
			assert.deepEqual(h.saved, []);
			assert.equal(input.value, "note");
			let compositionBlocked = false;
			input.fire("keydown", { key: "Enter", isComposing: true, preventDefault: () => { compositionBlocked = true; } });
			assert.equal(compositionBlocked, false, "input-method composition must remain usable");
			assert.deepEqual(h.saved, []);
			assert.equal(input.getAttribute("aria-invalid"), "true");
			input.fire("input");
			assert.equal(h.contentEl.querySelector("[role=alert]")!.textContent, "");
			assert.equal(input.getAttribute("aria-invalid"), null);
		} finally { h.destroy(); }
	});
	it("validates before saving even if a non-browser input contains newline characters", () => {
		const h = harness([{ source: "[!note]", value: "note" }]);
		try {
			for (const value of ["a\nb", "a\rb", "a\0b", "a\u2028b", "a\u2029b"]) {
				h.inputs[0]!.value = value; h.save();
				assert.deepEqual(h.saved, []);
				assert.equal(h.contentEl.querySelector("[role=alert]")!.textContent, t("portable.customInvalid"));
			}
		} finally { h.destroy(); }
	});
	it("keeps a failed draft open and prevents a detached Save button from committing after close", () => {
		const h = harness([{ source: "[!note]", value: "note" }]);
		try {
			h.inputs[0]!.value = "Custom note"; h.inputs[0]!.fire("input");
			h.fail("Source changed"); h.save();
			assert.equal(h.inputs[0]!.value, "Custom note");
			assert.equal(h.contentEl.querySelector("[role=alert]")!.textContent, "Source changed");
			assert.deepEqual(h.saved, []);
			const button = h.modalEl.querySelector(".mod-cta")!;
			h.modal.onClose(); button.fire("click");
			assert.deepEqual(h.saved, []);
		} finally { h.destroy(); }
	});
});
