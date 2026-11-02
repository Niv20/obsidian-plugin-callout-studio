/**
 * Import's source chooser and Export's format chooser (finding S9-09): each
 * choice is a row of one of Obsidian's setting groups, with its icon, name and
 * a line about it, and a button at the end that does it. Only the button
 * acts; a double-click's second click does not act again.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { t } from "../src/i18n";
import { ExportFormatModal } from "../src/settings/ExportFormatModal";
import { ImportSourceModal } from "../src/settings/ImportSourceModal";
import type { SettingsContext } from "../src/settings/sections/types";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

/** Only the shell Obsidian supplies; no registry or import/export side effects. */
function mountChooser(ModalClass: typeof ImportSourceModal | typeof ExportFormatModal): {
	content: FakeElement;
	destroy: () => void;
} {
	const app = { keymap: new TestKeymap(), scope: new TestScope() };
	const modal = new ModalClass({ app } as unknown as SettingsContext);
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
		close: () => {},
	});
	modal.onOpen();
	return {
		content,
		destroy: () => { modal.onClose(); container.remove(); },
	};
}

/** What a group shows: its heading (or null) and each row's name and button. */
function readGroups(content: FakeElement) {
	return content.querySelectorAll(".setting-group").map((group) => ({
		heading: group.querySelector(".setting-item-heading")?.querySelector(".setting-item-name")?.textContent ?? null,
		rows: group.querySelectorAll(".cs-choice-row").map((row) => ({
			name: row.querySelector(".setting-item-name")?.textContent,
			button: row.querySelector(".clickable-icon")?.dataset.csText,
		})),
	}));
}

describe("Import and Export choose with a button per row", () => {
	it("Import: your own backup, then the other plugins under their heading", () => {
		const h = mountChooser(ImportSourceModal);
		try {
			assert.deepEqual(readGroups(h.content), [
				{ heading: null, rows: [{ name: t("import.sourceStudio"), button: t("import.upload") }] },
				{
					heading: t("import.sourceOtherPlugins"),
					rows: [
						{ name: t("import.sourceCalloutManager"), button: t("settings.import") },
						{ name: t("import.sourceAdmonition"), button: t("settings.import") },
					],
				},
			]);
		} finally {
			h.destroy();
		}
	});

	it("Export: one group, the backup recommended", () => {
		const h = mountChooser(ExportFormatModal);
		try {
			const groups = readGroups(h.content);
			assert.equal(groups.length, 1);
			// The backup's name line also holds the Recommended tag.
			assert.ok(groups[0]!.rows[0]!.name?.startsWith(t("export.formatJson")));
			assert.equal(groups[0]!.rows[0]!.button, t("settings.export"));
			assert.equal(groups[0]!.rows[1]!.name, t("export.formatCss"));
			assert.equal(groups[0]!.rows[1]!.button, t("export.formatCssAction"));
			const flair = h.content.querySelectorAll(".flair.mod-flat");
			assert.equal(flair.length, 1);
			assert.equal(flair[0]!.textContent, t("settings.recommended"));
		} finally {
			h.destroy();
		}
	});

	for (const [name, ModalClass] of [["Import", ImportSourceModal], ["Export", ExportFormatModal]] as const) {
		it(`${name}: each row starts with its icon, and only its button is a control`, () => {
			const h = mountChooser(ModalClass);
			try {
				for (const row of h.content.querySelectorAll(".cs-choice-row")) {
					assert.ok(row.children[0]!.hasClass("setting-item-icon"), "the emblem comes first");
					for (const attr of ["role", "tabindex", "aria-label"]) {
						assert.equal(row.hasAttribute(attr), false, `the row has no ${attr}`);
					}
					// Read out with the row's name, so two "Import…" buttons differ.
					const button = row.querySelector(".clickable-icon")!;
					const [buttonId, nameId] = (button.getAttribute("aria-labelledby") ?? "").split(" ");
					assert.equal(buttonId, button.id);
					assert.equal(row.querySelector(".setting-item-name")!.id, nameId);
				}
			} finally {
				h.destroy();
			}
		});
	}

	it("opens Import's file chooser once for a double-click, from a mounted input", () => {
		const h = mountChooser(ImportSourceModal);
		try {
			const input = h.content.querySelector(".cs-import-file-input");
			const button = h.content.querySelector(".cs-choice-row")?.querySelector(".clickable-icon");
			assert.ok(input && button);
			let pickerOpens = 0;
			Object.assign(input, { click: () => { pickerOpens++; } });
			button.fire("click", { type: "click", detail: 1 });
			button.fire("click", { type: "click", detail: 2 });
			assert.equal(pickerOpens, 1);
			button.fire("click", { type: "click", detail: 0 });
			assert.equal(pickerOpens, 2, "a key press or an assistive click still opens it");
			assert.equal(h.content.contains(input), true, "opening the picker keeps its input mounted");
		} finally {
			h.destroy();
		}
	});
});
