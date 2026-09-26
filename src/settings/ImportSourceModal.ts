/**
 * settings/ImportSourceModal.ts — Chooser shown by the settings tab's Import
 * button: Callout Studio's own file format, the competing "Callout Manager"
 * plugin's callouts, or the "Admonition" plugin's admonitions.
 *
 * Owns only the choice between the three. Callout Studio's own format goes
 * straight to the file picker; the other two open PluginImportModal with their
 * own PluginImportSource (settings/pluginImport/). Each source is one option
 * box (settings/optionBox.ts) — the same box Export's format chooser and the
 * plugin import window draw.
 */
import { Modal } from "obsidian";
import { t } from "../i18n";
import { processImportedJSON } from "./sections/DataManagementSection";
import { applyModalChrome } from "./modalChrome";
import { renderOptionBox, renderOptionList, type OptionBoxSpec } from "./optionBox";
import { PluginImportModal } from "./pluginImport/PluginImportModal";
import { ADMONITION_IMPORT } from "./pluginImport/admonitionImportSource";
import { CALLOUT_MANAGER_IMPORT } from "./pluginImport/calloutManagerImportSource";
import type { SettingsSectionContext } from "./sections/types";

export class ImportSourceModal extends Modal {
	private fileInput!: HTMLInputElement;

	constructor(private readonly ctx: SettingsSectionContext) {
		super(ctx.app);
	}

	onOpen(): void {
		this.modalEl.addClass("callout-studio-import-source-modal");
		// No footer: every box here IS the action.
		applyModalChrome(this);
		this.setTitle(t("import.chooseSource"));

		// Created once, attached to the DOM, and hidden — like ImagePanel's
		// "Custom Icons" add button. A file input built fresh (and left
		// detached) inside the box's click handler was unreliable for
		// actually showing Chromium's file chooser; calling .click() on a
		// real, DOM-connected input directly from the trusted click listener
		// is not. Its own 'change' handler closes this modal, rather than the
		// box's onActivate — closing any earlier risks tearing down focus
		// before the (asynchronous) dialog-opening request lands.
		this.fileInput = this.contentEl.createEl("input", {
			cls: "cs-import-file-input",
			type: "file",
			attr: { accept: ".json" },
		});
		this.fileInput.addEventListener("change", () => {
			const file = this.fileInput.files?.[0];
			this.fileInput.value = "";
			if (!file) return;
			this.close();
			void processImportedJSON(this.ctx, file);
		});

		const list = renderOptionList(this.contentEl);

		const sources: OptionBoxSpec[] = [
			{
				// The export chooser uses the same Lucide icon for this backup.
				icon: "paintbrush",
				title: t("import.sourceStudio"),
				desc: t("import.sourceStudioDesc"),
				onActivate: () => this.fileInput.click(),
			},
			{
				icon: "file",
				title: t("import.sourceCalloutManager"),
				desc: t("import.sourceCalloutManagerDesc"),
				onActivate: () => {
					this.close();
					new PluginImportModal(this.ctx, CALLOUT_MANAGER_IMPORT).open();
				},
			},
			{
				icon: "message-square-quote",
				title: t("import.sourceAdmonition"),
				desc: t("import.sourceAdmonitionDesc"),
				onActivate: () => {
					this.close();
					new PluginImportModal(this.ctx, ADMONITION_IMPORT).open();
				},
			},
		];

		for (const source of sources) renderOptionBox(list, source);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
