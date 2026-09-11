/**
 * settings/AdmonitionImportModal.ts — Bringing custom types over from the
 * "Obsidian Admonition" plugin.
 *
 * Three ways in, because a user migrating has no reason to know which one they
 * have, and each is the shortest path for somebody:
 *
 * - **This vault** — Admonition is still installed, so its `data.json` is right
 *   there. One click, nothing to export first. Read-only and local: the file is
 *   opened, never written, and nothing is fetched.
 * - **A file** — an `admonitions.json` of the kind Admonition's own export
 *   button writes, or one of the community packs shared as that format.
 * - **Paste** — for anything else, including a `data.json` copied out of
 *   another vault.
 *
 * All three end at the same `runImport`, which plans (utils/admonitionImport.ts)
 * and then shows the shared ImportReportModal whenever there is anything to say,
 * exactly as the Callout Manager and JSON importers do.
 */
import { Modal, Notice, normalizePath, setIcon } from "obsidian";
import { t } from "../i18n";
import {
	parseAdmonitionExport,
	type AdmonitionRaw,
} from "../utils/admonitionFormat";
import { planAdmonitionImport } from "../utils/admonitionImport";
import { ImportReportModal } from "../utils/ImportReportModal";
import { applyModalChrome } from "./modalChrome";
import type { SettingsSectionContext } from "./sections/types";
import { markCompetitorImportBannerHandled } from "./competitorImportState";

/**
 * Admonition's plugin id, and so its folder name under the config directory.
 * Stable since the plugin's first release and unchanged through the handover to
 * its current maintainer.
 */
const ADMONITION_PLUGIN_ID = "obsidian-admonition";

export class AdmonitionImportModal extends Modal {
	private fileInput!: HTMLInputElement;
	private textareaEl!: HTMLTextAreaElement;
	private importBtn!: HTMLButtonElement;
	private vaultBtn!: HTMLButtonElement;
	private vaultStatusEl!: HTMLElement;
	/** What the vault probe found, kept so the button does not re-read on click. */
	private vaultEntries: AdmonitionRaw[] | null = null;

	constructor(private readonly ctx: SettingsSectionContext) {
		super(ctx.app);
	}

	onOpen(): void {
		this.modalEl.addClass("callout-studio-adm-import-modal");
		this.setTitle(t("import.admTitle"));

		this.contentEl.createEl("p", {
			text: t("import.admInstructions"),
			cls: "cs-import-instructions",
		});

		// Created once and attached to the DOM, for the reason ImportSourceModal
		// spells out: a file input built fresh inside the click handler and left
		// detached does not reliably open Chromium's file chooser.
		this.fileInput = this.contentEl.createEl("input", {
			cls: "cs-import-file-input",
			type: "file",
			attr: { accept: ".json" },
		});
		this.fileInput.addEventListener("change", () => {
			const file = this.fileInput.files?.[0];
			this.fileInput.value = "";
			if (file) void this.runImportFromFile(file);
		});

		this.renderVaultRow();
		this.renderFileRow();

		this.contentEl.createEl("p", {
			text: t("import.admPasteLabel"),
			cls: "cs-import-paste-label",
		});
		this.textareaEl = this.contentEl.createEl("textarea", {
			cls: "cs-import-textarea",
			attr: { placeholder: t("import.admPlaceholder") },
		});
		this.textareaEl.addEventListener("input", () => {
			this.importBtn.disabled =
				this.textareaEl.value.trim().length === 0;
		});

		const btnContainer = applyModalChrome(this, { footer: true });
		btnContainer
			.createEl("button", { text: t("import.admBtnCancel") })
			.addEventListener("click", () => this.close());

		this.importBtn = btnContainer.createEl("button", {
			text: t("import.admBtnImport"),
			cls: "mod-cta",
		});
		this.importBtn.disabled = true;
		this.importBtn.addEventListener("click", () => void this.runImportFromPaste());

		void this.probeVault();
	}

	/* -------------------------------------------------------------- *
	 * Rows
	 * -------------------------------------------------------------- */

	private renderVaultRow(): void {
		const row = this.contentEl.createDiv({ cls: "cs-import-row" });
		const icon = row.createDiv({ cls: "cs-import-row-icon" });
		setIcon(icon, "vault");

		const text = row.createDiv({ cls: "cs-import-row-text" });
		text.createDiv({
			cls: "cs-import-row-title",
			text: t("import.admFromVault"),
		});
		this.vaultStatusEl = text.createDiv({
			cls: "cs-import-row-desc",
			text: t("import.admVaultChecking"),
		});

		this.vaultBtn = row.createEl("button", {
			text: t("import.admBtnImport"),
			cls: "mod-cta",
		});
		this.vaultBtn.disabled = true;
		this.vaultBtn.addEventListener("click", () => {
			if (this.vaultEntries) void this.runImport(this.vaultEntries);
		});
	}

	private renderFileRow(): void {
		const row = this.contentEl.createDiv({ cls: "cs-import-row" });
		const icon = row.createDiv({ cls: "cs-import-row-icon" });
		setIcon(icon, "file-json");

		const text = row.createDiv({ cls: "cs-import-row-text" });
		text.createDiv({
			cls: "cs-import-row-title",
			text: t("import.admFromFile"),
		});
		text.createDiv({
			cls: "cs-import-row-desc",
			text: t("import.admFromFileDesc"),
		});

		row.createEl("button", { text: t("import.admChooseFile") })
			.addEventListener("click", () => this.fileInput.click());
	}

	/* -------------------------------------------------------------- *
	 * Sources
	 * -------------------------------------------------------------- */

	/**
	 * Look for Admonition's own settings file in this vault.
	 *
	 * Deliberately reads the file rather than asking `app.plugins`: a user who
	 * has already disabled Admonition (a reasonable thing to do while moving off
	 * it) still has their admonitions on disk, and they are exactly the ones
	 * worth rescuing.
	 */
	private async probeVault(): Promise<void> {
		const path = normalizePath(
			`${this.app.vault.configDir}/plugins/${ADMONITION_PLUGIN_ID}/data.json`,
		);

		let entries: AdmonitionRaw[] | null = null;
		try {
			if (await this.app.vault.adapter.exists(path)) {
				entries = parseAdmonitionExport(
					JSON.parse(await this.app.vault.adapter.read(path)),
				);
			}
		} catch {
			// An unreadable or malformed file is the same outcome as no file:
			// this path is the convenience, and the other two still work.
			entries = null;
		}

		// The modal may already be closed — the probe is fire-and-forget.
		if (!this.vaultStatusEl.isConnected) return;

		if (!entries || entries.length === 0) {
			this.vaultStatusEl.setText(t("import.admVaultNotFound"));
			return;
		}

		this.vaultEntries = entries;
		this.vaultStatusEl.setText(
			t("import.admVaultFound", { count: entries.length }),
		);
		this.vaultBtn.disabled = false;
	}

	private async runImportFromFile(file: File): Promise<void> {
		await this.runImportFromText(await file.text());
	}

	private runImportFromPaste(): Promise<void> {
		return this.runImportFromText(this.textareaEl.value);
	}

	/** The file and paste routes, which both start from text of unknown shape. */
	private async runImportFromText(text: string): Promise<void> {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			await this.reportFatal("import.err.parseFailed");
			return;
		}
		const entries = parseAdmonitionExport(parsed);
		if (!entries) {
			await this.reportFatal("import.err.admNotRecognized");
			return;
		}
		await this.runImport(entries);
	}

	/* -------------------------------------------------------------- *
	 * Import
	 * -------------------------------------------------------------- */

	/** Where all three sources converge, once their entries are in hand. */
	private async runImport(entries: readonly AdmonitionRaw[]): Promise<void> {
		const { registry } = this.ctx.plugin;
		const plan = await planAdmonitionImport(
			entries,
			registry,
			registry.getUserImages(),
		);

		if (plan.issues.length > 0) {
			const choice = await new ImportReportModal(
				this.ctx.app,
				plan.issues,
				plan.toApply.length,
				entries.length,
				// Nothing recognized at all is fatal, as it is for the Callout
				// Manager paste: there is no "import the valid ones" to offer.
				entries.length === 0,
			).prompt();
			if (choice === "cancel") return;
		}
		if (plan.toApply.length === 0) return;

		// Saving is the registry's own doing: every add/update fires the change
		// callback the plugin already persists on.
		const { created, updated } = registry.applyAdmonitionImport(plan);
		await markCompetitorImportBannerHandled(this.ctx.plugin);
		new Notice(t("notice.importedAdmonition", { created, updated }));
		this.ctx.display();
		this.close();

		// An imported callout can name an icon from a library this vault has
		// never downloaded, and no file carries artwork. Fetch what is missing
		// rather than leaving those callouts undrawable — the same repair pass
		// the JSON importer runs.
		void this.ctx.plugin.ensureIconArtworkFor(
			plan.toApply
				.map((item) => item.entry.icon)
				.filter((icon): icon is NonNullable<typeof icon> => !!icon),
		);
	}

	/** The report modal in its "nothing usable here" mode. */
	private async reportFatal(messageKey: string): Promise<void> {
		await new ImportReportModal(
			this.ctx.app,
			[{ index: -1, entryLabel: "", level: "error", messageKey }],
			0,
			0,
			true,
		).prompt();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
