import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { Notice } from "obsidian";
import { t } from "../src/i18n";
import { portableConversionViewHarness as harness } from "./support/portableConversionViewHarness";
import { deferred } from "./support/portableVaultHarness";

type Harness = ReturnType<typeof harness>;
const lastNotice = (): { message: string; hidden: boolean } | null => (Notice as unknown as { last: { message: string; hidden: boolean } | null }).last;

/** A real press: the view's own handler first, then the document-level one that commits a draft. */
function press(h: Harness, action: string): void {
	const event = { target: h.button(action), preventDefault: () => {}, stopPropagation: () => {} };
	h.root.fire("click", event); h.root.ownerDocument.fire("click", event);
}

/** Open the first row's replacement editor the way a click on its After text does. */
function openDraft(h: Harness) {
	const target = h.root.querySelectorAll(".cs-portable-after-button")[0]!;
	const event = { target, preventDefault: () => {}, stopPropagation: () => {} };
	h.root.fire("click", event); h.root.ownerDocument.fire("click", event);
	const input = h.root.querySelector("textarea.cs-portable-custom-input"); assert.ok(input);
	return { input, enter: () => input.fire("keydown", { key: "Enter", preventDefault: () => {}, stopPropagation: () => {} }) };
}

describe("Convert explains why it is blocked", () => {
	it("keeps the dimmed button clickable instead of disabling it", async () => {
		const h = harness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen();
			assert.equal(h.blocked("convert"), false);
			h.choose(0, false);
			const convert = h.button("convert");
			assert.equal(h.blocked("convert"), true);
			assert.equal(convert.hasClass("cs-btn-disabled"), true);
			assert.notEqual((convert as unknown as { disabled?: boolean }).disabled, true, "a disabled button would swallow the press");
		} finally { await h.destroy(); }
	});
	it("tells the user to press Enter while a replacement is still being typed, and keeps the draft", async () => {
		const h = harness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen();
			const draft = openDraft(h);
			draft.input.value = "Unsaved draft"; draft.input.fire("input");
			assert.equal(h.blocked("convert"), true);
			// The click moved focus onto the button, as a real press does.
			h.button("convert").focus();
			press(h, "convert");
			assert.equal(lastNotice()?.message, t("portable.blockedEditing"));
			assert.equal(h.confirmations.length, 0);
			// Pressing a dimmed button is not "clicking away": the draft is neither saved nor closed...
			assert.equal(h.root.querySelector("textarea.cs-portable-custom-input"), draft.input);
			assert.equal(draft.input.value, "Unsaved draft");
			assert.equal(h.blocked("convert"), true);
			// ...and the caret is back in it, so the Enter the notice asks for lands there.
			assert.equal(h.root.ownerDocument.activeElement, draft.input);
			draft.enter();
			assert.equal(h.root.querySelector("textarea.cs-portable-custom-input"), null);
			assert.equal(h.blocked("convert"), false);
			press(h, "convert");
			assert.equal(h.confirmations.length, 1, "once the draft is saved the same press converts");
		} finally { await h.destroy(); }
	});
	it("says the review is still updating while notes are being read", async () => {
		const h = harness(), read = deferred();
		h.app.vault.read = async () => { await read.promise; return h.contents.get("a.md")!; };
		try {
			const opening = h.view.onOpen();
			press(h, "convert");
			assert.equal(lastNotice()?.message, t("portable.blockedUpdating"));
			assert.equal(h.confirmations.length, 0);
			read.resolve(); await opening;
			assert.equal(h.blocked("convert"), false);
		} finally { read.resolve(); await h.destroy(); }
	});
	it("asks for a selection when every replacement is unchecked", async () => {
		const h = harness({ "a.md": "[!note]\n[!tip]" });
		try {
			await h.view.onOpen();
			h.choose(0, false); h.choose(1, false);
			press(h, "convert");
			assert.equal(lastNotice()?.message, t("portable.blockedNothingSelected"));
			assert.equal(h.confirmations.length, 0);
		} finally { await h.destroy(); }
	});
	it("says there is nothing to convert when the vault holds no eligible callout", async () => {
		const h = harness({ "a.md": "Just a plain note." });
		try {
			await h.view.onOpen();
			press(h, "convert");
			assert.equal(lastNotice()?.message, t("portable.empty"));
		} finally { await h.destroy(); }
	});
	it("repeats the review's own error when it failed, rather than a generic line", async () => {
		const h = harness({ "a.md": "[!note]", "b.md": "[!tip]" });
		const editor = h.open("a.md");
		try {
			await h.view.onOpen();
			editor.text = "Changed [!note]";
			h.workspaceEvents.emit("editor-change", {}, { file: h.handles.get("a.md") });
			await h.settle();
			assert.equal(h.status(), t("portable.errorEditor"));
			press(h, "convert");
			assert.equal(lastNotice()?.message, t("portable.errorEditor"));
		} finally { await h.destroy(); }
	});
	it("says a conversion is running while the notes are being rewritten", async () => {
		const h = harness(), write = deferred();
		h.hooks.confirm = async () => true;
		h.hooks.beforeProcess = () => write.promise;
		try {
			await h.view.onOpen();
			press(h, "convert");
			// Wait until the first note is actually being processed: past the confirmation, mid-write.
			for (let i = 0; i < 50 && h.processes.length === 0; i++) await sleep(2);
			assert.equal(h.processes.length, 1);
			press(h, "convert");
			assert.equal(lastNotice()?.message, t("portable.blockedConverting"));
			assert.equal(h.confirmations.length, 1, "the second press must not ask again");
			write.resolve(); await h.tasks[h.tasks.length - 1]; await h.settle();
		} finally { write.resolve(); await h.destroy(); }
	});
	it("replaces its own notice on a second press instead of stacking another", async () => {
		const h = harness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen(); h.choose(0, false);
			press(h, "convert");
			const first = lastNotice();
			press(h, "convert");
			assert.equal(first?.hidden, true);
			assert.notEqual(lastNotice(), first);
			assert.equal(lastNotice()?.message, t("portable.blockedNothingSelected"));
		} finally { await h.destroy(); }
	});
	it("shows nothing when Convert can act", async () => {
		const h = harness({ "a.md": "[!note]" });
		try {
			await h.view.onOpen();
			const before = lastNotice();
			press(h, "convert");
			assert.equal(lastNotice(), before);
			assert.equal(h.confirmations.length, 1);
		} finally { await h.destroy(); }
	});
});
