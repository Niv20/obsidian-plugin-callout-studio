/**
 * The import report's "Import valid only" is dimmed, not disabled, when no
 * entry is valid — pressing it says there is nothing to import.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { t } from "../src/i18n";
import { ImportReportModal, type ImportReportChoice } from "../src/utils/ImportReportModal";
import type { ValidationIssue } from "../src/utils/importValidator";
import { fakeDom } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";
import { Notice } from "./support/obsidianStub";

const issue: ValidationIssue = { index: 0, entryLabel: "note", level: "error", messageKey: "import.err.notRecognized" };

function open(validCount: number, fatal = false) {
	fakeDom.light();
	const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
	const modal = new ImportReportModal(app, [issue], validCount, 3, fatal);
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const titleEl = modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, { containerEl, modalEl, titleEl, contentEl, app, scope: app.scope,
		setTitle: (title: string) => { titleEl.setText(title); return modal; },
		open: () => modal.onOpen(), close: () => modal.onClose() });
	let answer: ImportReportChoice | undefined;
	void modal.prompt().then((choice) => { answer = choice; });
	const importButton = modalEl.querySelector(".cs-modal-footer button.mod-cta");
	return { importButton, answer: () => answer, destroy: () => { modal.onClose(); containerEl.remove(); } };
}

describe("the import report's Import valid only", () => {
	it("imports on a press when some entries are valid", async () => {
		const h = open(2);
		try {
			assert.ok(h.importButton);
			assert.equal(h.importButton.getAttribute("aria-disabled"), "false");
			h.importButton.fire("click");
			await setImmediate();
			assert.equal(h.answer(), "importValid");
		} finally { h.destroy(); }
	});
	it("is dimmed, not disabled, when nothing is valid, and says there is nothing to import", async () => {
		const h = open(0);
		try {
			assert.ok(h.importButton);
			assert.equal(h.importButton.getAttribute("aria-disabled"), "true");
			assert.equal(h.importButton.hasClass("cs-btn-disabled"), true);
			assert.notEqual((h.importButton as unknown as { disabled?: boolean }).disabled, true, "a disabled button would swallow the press");
			h.importButton.fire("click");
			await setImmediate();
			assert.equal(String(Notice.last?.message), t("import.nothingValid"));
			assert.equal(h.answer(), undefined, "the report stays open");
		} finally { h.destroy(); }
	});
	it("offers no import button at all for a fatal report", () => {
		const h = open(0, true);
		try { assert.equal(h.importButton, null); } finally { h.destroy(); }
	});
});
