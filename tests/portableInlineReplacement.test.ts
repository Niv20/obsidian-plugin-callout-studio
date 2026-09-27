import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { t } from "../src/i18n";
import { PortableInlineReplacement } from "../src/portable/portableInlineReplacement";
import type { PortableReplacementField } from "../src/portable/portableReplacementEditor";
import { fakeDom } from "./support/fakeDom";

function harness(field: PortableReplacementField) {
	fakeDom.light();
	const saved: string[] = [];
	let failure: string | undefined, cancelled = 0;
	const changes: Array<{ changed: boolean; customized: boolean }> = [], refocusRequests: boolean[] = [];
	const host = fakeDom.document.body.createDiv();
	const editor = new PortableInlineReplacement(host as unknown as HTMLElement, field, (value, refocus) => {
		refocusRequests.push(refocus);
		if (!failure) { saved.push(value); editor.unload(); }
		return failure;
	}, refocus => { refocusRequests.push(refocus); cancelled++; editor.unload(); },
	() => changes.push({ changed: editor.changed, customized: editor.customized }));
	const input = host.querySelector("textarea.cs-portable-custom-input")!;
	const press = (key: string) => input.fire("keydown", { key, preventDefault: () => {}, stopPropagation: () => {} });
	return { editor, host, input, saved, press, changes, refocusRequests,
		save: () => press("Enter"),
		cancelled: () => cancelled,
		fail: (message: string) => { failure = message; },
		destroy: () => { editor.unload(); host.remove(); },
	};
}

describe("inline replacement editor boundaries", () => {
	it("selects the entire replacement on request and preserves the caret on ordinary refocus", () => {
		const h = harness({ source: "[!note]", value: "Custom note" });
		try {
			h.editor.focus(true);
			assert.deepEqual([h.input.selectionStart, h.input.selectionEnd], [0, 11]);
			assert.equal(h.input.ownerDocument.activeElement, h.input);
			h.input.setSelectionRange(3, 7); h.editor.focus();
			assert.deepEqual([h.input.selectionStart, h.input.selectionEnd], [3, 7]);
			assert.deepEqual(h.input.lastFocusOptions, { preventScroll: true });
		} finally { h.destroy(); }
	});
	it("compares live reset eligibility with the default separately from the opening saved text", () => {
		const h = harness({ source: "[!note]", value: "Saved note", defaultValue: "note" });
		try {
			assert.equal(h.editor.changed, false); assert.equal(h.editor.customized, true);
			for (const value of ["New note", "note", "Saved note"]) { h.input.value = value; h.input.fire("input"); }
			assert.deepEqual(h.changes, [
				{ changed: true, customized: true }, { changed: true, customized: false }, { changed: false, customized: true },
			]);
		} finally { h.destroy(); }
	});
	it("submits a blurred field without asking to return keyboard focus", () => {
		for (const value of ["note", "New note"]) {
			const h = harness({ source: "[!note]", value: "note" });
			try {
				h.input.value = value; h.input.fire("input"); h.editor.submit(false);
				assert.deepEqual(h.refocusRequests, [false]);
				assert.deepEqual(h.saved, value === "note" ? [] : [value]);
				assert.equal(h.cancelled(), value === "note" ? 1 : 0);
			} finally { h.destroy(); }
		}
	});
	it("closes unchanged drafts with Enter without committing, including existing custom text", () => {
		for (const value of ["note", "Existing custom text"]) {
			const h = harness({ source: "[!note]", value });
			try {
				h.input.value += "!"; h.input.fire("input");
				h.input.value = value; h.input.fire("input");
				h.save();
				assert.deepEqual(h.saved, []); assert.equal(h.cancelled(), 1);
				assert.equal(h.host.querySelector("textarea"), null);
			} finally { h.destroy(); }
		}
	});
	it("preserves exact changed text without trimming replacement whitespace", () => {
		const h = harness({ source: "[!note]", value: "Existing custom text" });
		try {
			h.input.value += " "; h.input.fire("input"); h.save();
			assert.deepEqual(h.saved, ["Existing custom text "]);
			assert.equal(h.cancelled(), 0);
		} finally { h.destroy(); }
	});
	it("shows only the replacement in one wrapping, labelled text field", () => {
		const h = harness({ source: "[!note]{First}", value: "First" });
		try {
			assert.equal(h.host.querySelectorAll("textarea").length, 1);
			assert.equal(h.host.querySelector("input"), null);
			assert.equal(h.host.querySelector("button"), null, "editing has no separate Save or Cancel controls");
			assert.equal(h.input.value, "First");
			assert.equal(h.input.getAttribute("aria-label"), t("portable.replacement"));
			assert.equal(h.host.querySelector(".cs-portable-custom-markers"), null);
			h.input.value = "Custom first"; h.input.fire("input"); h.save();
			assert.deepEqual(h.saved, ["Custom first"]);
		} finally { h.destroy(); }
	});
	it("keeps heading level, container prefix and closing markers outside the editable title", () => {
		const h = harness({ source: "> ## [!note] Title ##", value: "Title", before: "> ## ", after: " ##", heading: true });
		try {
			assert.equal(h.input.value, "Title");
			assert.deepEqual(h.host.querySelectorAll(".cs-portable-custom-markers").map(el => el.textContent), ["> ## ", " ##"]);
			assert.equal(h.host.querySelectorAll(".cs-portable-custom-markers").length, 2);
			h.input.value = "New title"; h.save(); assert.deepEqual(h.saved, ["New title"]);
		} finally { h.destroy(); }
	});
	it("saves with Enter and cancels with Escape without leaking their keyboard events", () => {
		for (const key of ["Enter", "Escape"]) {
			const h = harness({ source: "[!note]", value: "note" });
			try {
				h.input.value = "Custom note"; h.input.fire("input");
				let prevented = false, stopped = false;
				h.input.fire("keydown", { key, preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; } });
				assert.equal(prevented, true); assert.equal(stopped, true);
				assert.deepEqual(h.saved, key === "Enter" ? ["Custom note"] : []);
				assert.equal(h.cancelled(), key === "Escape" ? 1 : 0);
				assert.equal(h.host.querySelector("textarea"), null);
			} finally { h.destroy(); }
		}
	});
	it("leaves input-method composition untouched even when the draft has changed", () => {
		const h = harness({ source: "[!note]", value: "note" });
		try {
			h.input.value = "正在"; h.input.fire("input");
			for (const key of ["Enter", "Escape"]) {
				let prevented = false;
				h.input.fire("keydown", { key, isComposing: true, preventDefault: () => { prevented = true; } });
				assert.equal(prevented, false);
			}
			assert.deepEqual(h.saved, []); assert.equal(h.cancelled(), 0);
			assert.equal(h.input.value, "正在");
		} finally { h.destroy(); }
	});
	it("saves with a virtual keyboard Enter event even when no keydown is emitted", () => {
		for (const inputType of ["insertLineBreak", "insertParagraph"]) {
			const h = harness({ source: "[!note]", value: "note" });
			try {
				assert.equal(h.input.getAttribute("enterkeyhint"), "done");
				h.input.value = "Mobile custom"; h.input.fire("input");
				let prevented = false;
				h.input.fire("beforeinput", { inputType, isComposing: false, preventDefault: () => { prevented = true; } });
				assert.equal(prevented, true, "Enter must not insert a stored newline");
				assert.deepEqual(h.saved, ["Mobile custom"]); assert.equal(h.cancelled(), 0);
				assert.equal(h.host.querySelector("textarea"), null);
			} finally { h.destroy(); }
		}
	});
	it("blocks input-method line breaks and multiline pastes without saving", () => {
		const h = harness({ source: "[!note]", value: "note" });
		try {
			for (const [type, detail] of [
				["beforeinput", { inputType: "insertLineBreak", isComposing: true }],
				["beforeinput", { inputType: "insertParagraph", isComposing: true }],
				...["a\nb", "a\rb", "a\0b", "a\u2028b", "a\u2029b"].map(text =>
					["paste", { clipboardData: { getData: () => text } }] as const),
			] as const) {
				let prevented = false;
				h.input.fire(type, { ...detail, preventDefault: () => { prevented = true; } });
				assert.equal(prevented, true, type);
			}
			assert.deepEqual(h.saved, []); assert.equal(h.input.value, "note");
			assert.equal(h.input.getAttribute("aria-invalid"), "true");
			h.input.fire("input");
			assert.equal(h.host.querySelector("[role=alert]")!.textContent, "");
			assert.equal(h.input.getAttribute("aria-invalid"), null);
		} finally { h.destroy(); }
	});
	it("validates before saving even if a non-browser input contains newline characters", () => {
		const h = harness({ source: "[!note]", value: "note" });
		try {
			for (const value of ["a\nb", "a\rb", "a\0b", "a\u2028b", "a\u2029b"]) {
				h.input.value = value; h.save();
				assert.deepEqual(h.saved, []);
				assert.equal(h.host.querySelector("[role=alert]")!.textContent, t("portable.customInvalid"));
			}
		} finally { h.destroy(); }
	});
	it("keeps failed drafts editable and ignores Enter or Escape after unload", () => {
		const h = harness({ source: "[!note]", value: "note" });
		try {
			h.input.value = "Custom note"; h.input.fire("input");
			h.fail("Source changed"); h.save();
			assert.equal(h.input.value, "Custom note");
			assert.equal(h.host.querySelector("[role=alert]")!.textContent, "Source changed");
			assert.deepEqual(h.saved, []);
			h.editor.unload(); h.save(); h.press("Escape");
			assert.deepEqual(h.saved, []); assert.equal(h.cancelled(), 0);
		} finally { h.destroy(); }
	});
});
