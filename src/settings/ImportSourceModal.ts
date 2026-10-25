/**
 * settings/ImportSourceModal.ts — Chooser shown by the settings tab's Import
 * button: Callout Studio's own file format, the competing "Callout Manager"
 * plugin's callouts, or the "Admonition" plugin's admonitions.
 *
 * Owns only the choice between the three. Callout Studio's own format goes
 * straight to the file picker; the other two open PluginImportModal with their
 * own PluginImportSource (settings/pluginImport/). Each source is a row with
 * its own button (settings/choiceRow.ts), as Export's format chooser draws
 * its formats. The window is two of Obsidian's setting groups: your own
 * backup, then the other plugins under the heading "From another plugin", so
 * it reads as "your own backup, or somebody else's data" rather than as three
 * equal rows.
 */
import { Modal, SettingGroup } from "obsidian";
import { t } from "../i18n";
import { processImportedJSON } from "./sections/backupImport";
import { applyModalChrome } from "./modalChrome";
import { addChoiceRow, type ChoiceRowSpec } from "./choiceRow";
import { PluginImportModal } from "./pluginImport/PluginImportModal";
import { ADMONITION_IMPORT } from "./pluginImport/admonitionImportSource";
import { CALLOUT_MANAGER_IMPORT } from "./pluginImport/calloutManagerImportSource";
import type { SettingsContext } from "./sections/types";

export class ImportSourceModal extends Modal {
	private fileInput!: HTMLInputElement;

	constructor(private readonly ctx: SettingsContext) {
		super(ctx.app);
	}

	onOpen(): void {
		this.modalEl.addClass("callout-studio-import-source-modal");
		// No footer: each row's button is the action.
		applyModalChrome(this);
		this.setTitle(t("import.chooseSource"));

		// Created once, attached to the DOM, and hidden — like ImagePanel's
		// "Custom Icons" add button. A file input built fresh (and left
		// detached) inside the box's click handler was unreliable for
		// actually showing Chromium's file chooser; calling .click() on a
		// real, DOM-connected input directly from the trusted click listener
		// is not. Its own 'change' handler closes this modal, rather than the
		// button's onActivate — closing any earlier risks tearing down focus
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

		// Your own backup, in a group with no heading. The export chooser uses
		// the same Lucide icon for this backup.
		addChoiceRow(new SettingGroup(this.contentEl), {
			icon: "paintbrush",
			title: t("import.sourceStudio"),
			desc: t("import.sourceStudioDesc"),
			buttonText: t("import.upload"),
			onActivate: () => this.fileInput.click(),
		});

		const others = new SettingGroup(this.contentEl).setHeading(t("import.sourceOtherPlugins"));
		const plugins: ChoiceRowSpec[] = [
			{
				icon: "file",
				title: t("import.sourceCalloutManager"),
				desc: t("import.sourceCalloutManagerDesc"),
				buttonText: t("settings.import"),
				onActivate: () => {
					this.close();
					new PluginImportModal(this.ctx, CALLOUT_MANAGER_IMPORT).open();
				},
			},
			{
				icon: "message-square-quote",
				title: t("import.sourceAdmonition"),
				desc: t("import.sourceAdmonitionDesc"),
				buttonText: t("settings.import"),
				onActivate: () => {
					this.close();
					new PluginImportModal(this.ctx, ADMONITION_IMPORT).open();
				},
			},
		];
		for (const plugin of plugins) addChoiceRow(others, plugin);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
