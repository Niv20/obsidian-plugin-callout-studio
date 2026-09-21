/**
 * settings/ImportSourceModal.ts — Chooser shown by the settings tab's Import
 * button: Callout Studio's own file format, the competing "Callout Manager"
 * plugin's callouts, or the "Admonition" plugin's admonitions.
 *
 * Owns only the choice between the three; each source's own flow (file
 * picker, paste box) lives in its own module.
 */
import { Modal, setIcon } from "obsidian";
import { t } from "../i18n";
import { processImportedJSON } from "./sections/DataManagementSection";
import { AdmonitionImportModal } from "./AdmonitionImportModal";
import { CalloutManagerImportModal } from "./CalloutManagerImportModal";
import { applyModalChrome } from "./modalChrome";
import type { SettingsSectionContext } from "./sections/types";

interface SourceRow {
	icon: string;
	title: string;
	desc: string;
	onClick: () => void;
}

export class ImportSourceModal extends Modal {
	private fileInput!: HTMLInputElement;

	constructor(private readonly ctx: SettingsSectionContext) {
		super(ctx.app);
	}

	onOpen(): void {
		this.modalEl.addClass("callout-studio-import-source-modal");
		// No footer: every row here IS the action.
		applyModalChrome(this);
		this.setTitle(t("import.chooseSource"));

		// Created once, attached to the DOM, and hidden — like ImagePanel's
		// "Custom Icons" add button. A file input built fresh (and left
		// detached) inside the row's click handler was unreliable for
		// actually showing Chromium's file chooser; calling .click() on a
		// real, DOM-connected input directly from the trusted click listener
		// is not. Its own 'change' handler closes this modal, rather than the
		// row's onClick — closing any earlier risks tearing down focus before
		// the (asynchronous) dialog-opening request lands.
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

		const list = this.contentEl.createDiv({ cls: "cs-import-source-list" });

		const rows: SourceRow[] = [
			{
				icon: "paintbrush",
				title: t("import.sourceStudio"),
				desc: t("import.sourceStudioDesc"),
				onClick: () => this.fileInput.click(),
			},
			{
				icon: "file",
				title: t("import.sourceCalloutManager"),
				desc: t("import.sourceCalloutManagerDesc"),
				onClick: () => {
					this.close();
					new CalloutManagerImportModal(this.ctx).open();
				},
			},
			{
				icon: "message-square-quote",
				title: t("import.sourceAdmonition"),
				desc: t("import.sourceAdmonitionDesc"),
				onClick: () => {
					this.close();
					new AdmonitionImportModal(this.ctx).open();
				},
			},
		];

		for (const row of rows) this.renderRow(list, row);
	}

	private renderRow(container: HTMLElement, row: SourceRow): void {
		const item = container.createDiv({ cls: "cs-import-source-item" });
		item.setAttribute("role", "button");
		item.setAttribute("tabindex", "0");

		const iconEl = item.createDiv({ cls: "cs-import-source-item-icon" });
		setIcon(iconEl, row.icon);

		const textEl = item.createDiv({ cls: "cs-import-source-item-text" });
		textEl.createDiv({
			cls: "cs-import-source-item-title",
			text: row.title,
		});
		textEl.createDiv({ cls: "cs-import-source-item-desc", text: row.desc });

		item.addEventListener("click", row.onClick);
		item.addEventListener("keydown", (ev) => {
			if (ev.key !== "Enter" && ev.key !== " ") return;
			ev.preventDefault();
			row.onClick();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
