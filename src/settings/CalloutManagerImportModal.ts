/**
 * settings/CalloutManagerImportModal.ts — Bringing callouts over from the
 * competing "Obsidian Callout Manager" plugin.
 *
 * Two ways in, because each is the shortest path for somebody:
 *
 * - **This vault** — Callout Manager is (or was) installed here, so its
 *   `data.json` is right there. One click, nothing to copy first. Read-only and
 *   local: the file is opened, never written, and nothing is fetched.
 * - **Paste** — the styles its Copy button puts on the clipboard, which is what
 *   somebody moving between vaults or following a shared snippet has. The box
 *   takes a `data.json` pasted as text too, since there is no file row here and
 *   that is otherwise a dead end.
 *
 * The vault route is not merely the convenient one, it is the *complete* one.
 * The Copy button emits the stylesheet already resolved for whichever colour
 * scheme was active, so it structurally cannot carry a callout stored with a
 * different light and dark colour — and a callout that was created but never
 * restyled emits no CSS at all and is invisible to it.
 *
 * Both end at the same `runImport`, which plans
 * (utils/calloutManagerImport.ts) and then shows the shared ImportReportModal
 * whenever there is anything to say, exactly as the Admonition and JSON
 * importers do.
 */
import { Modal, Notice, normalizePath, setIcon } from "obsidian";
import { t } from "../i18n";
import { parseCalloutManagerData } from "../utils/calloutManagerFormat";
import { parseCalloutManagerExport } from "../utils/calloutCssParse";
import {
	planCalloutManagerImport,
	toCalloutManagerEntries,
	type CalloutManagerEntry,
} from "../utils/calloutManagerImport";
import { ImportReportModal } from "../utils/ImportReportModal";
import { applyModalChrome } from "./modalChrome";
import type { SettingsSectionContext } from "./sections/types";

/**
 * Callout Manager's plugin id, and so its folder name under the config
 * directory. Unchanged since its first release.
 */
const CALLOUT_MANAGER_PLUGIN_ID = "callout-manager";

export class CalloutManagerImportModal extends Modal {
	private textareaEl!: HTMLTextAreaElement;
	private importBtn!: HTMLButtonElement;
	private vaultBtn!: HTMLButtonElement;
	private vaultStatusEl!: HTMLElement;
	/** What the vault probe found, kept so the button does not re-read on click. */
	private vaultEntries: CalloutManagerEntry[] | null = null;

	constructor(private readonly ctx: SettingsSectionContext) {
		super(ctx.app);
	}

	onOpen(): void {
		this.modalEl.addClass("callout-studio-cm-import-modal");
		this.setTitle(t("import.cmTitle"));

		this.contentEl.createEl("p", {
			text: t("import.cmInstructions"),
			cls: "cs-import-instructions",
		});

		this.renderVaultRow();

		this.contentEl.createEl("p", {
			text: t("import.cmPasteLabel"),
			cls: "cs-import-paste-label",
		});
		this.textareaEl = this.contentEl.createEl("textarea", {
			cls: "cs-import-textarea",
			attr: { placeholder: t("import.cmPlaceholder") },
		});
		this.textareaEl.addEventListener("input", () => {
			this.importBtn.disabled = this.textareaEl.value.trim().length === 0;
		});

		const btnContainer = applyModalChrome(this, { footer: true });
		btnContainer
			.createEl("button", { text: t("import.cmBtnCancel") })
			.addEventListener("click", () => this.close());

		this.importBtn = btnContainer.createEl("button", {
			text: t("import.cmBtnImport"),
			cls: "mod-cta",
		});
		this.importBtn.disabled = true;
		this.importBtn.addEventListener("click", () => void this.runImportFromPaste());

		void this.probeVault();
	}

	private renderVaultRow(): void {
		const row = this.contentEl.createDiv({ cls: "cs-import-row" });
		const icon = row.createDiv({ cls: "cs-import-row-icon" });
		setIcon(icon, "vault");

		const text = row.createDiv({ cls: "cs-import-row-text" });
		text.createDiv({
			cls: "cs-import-row-title",
			text: t("import.cmFromVault"),
		});
		this.vaultStatusEl = text.createDiv({
			cls: "cs-import-row-desc",
			text: t("import.cmVaultChecking"),
		});

		this.vaultBtn = row.createEl("button", {
			text: t("import.cmBtnImport"),
			cls: "mod-cta",
		});
		this.vaultBtn.disabled = true;
		this.vaultBtn.addEventListener("click", () => {
			if (this.vaultEntries) void this.runImport(this.vaultEntries);
		});
	}

	/**
	 * Look for Callout Manager's own settings file in this vault.
	 *
	 * Deliberately reads the file rather than asking `app.plugins`, the same
	 * choice the Admonition importer makes and for a reason that bites harder
	 * here: somebody migrating off Callout Manager has very likely disabled it
	 * already, and its `data.json` is then the only record of what they built.
	 */
	private async probeVault(): Promise<void> {
		const path = normalizePath(
			`${this.app.vault.configDir}/plugins/${CALLOUT_MANAGER_PLUGIN_ID}/data.json`,
		);

		let entries: CalloutManagerEntry[] | null = null;
		try {
			if (await this.app.vault.adapter.exists(path)) {
				const raws = parseCalloutManagerData(
					JSON.parse(await this.app.vault.adapter.read(path)),
				);
				entries = raws ? toCalloutManagerEntries(raws) : null;
			}
		} catch {
			// An unreadable or malformed file is the same outcome as no file:
			// this path is the convenience, and the paste box still works.
			entries = null;
		}

		// The modal may already be closed — the probe is fire-and-forget.
		if (!this.vaultStatusEl.isConnected) return;

		if (!entries || entries.length === 0) {
			this.vaultStatusEl.setText(t("import.cmVaultNotFound"));
			return;
		}

		this.vaultEntries = entries;
		this.vaultStatusEl.setText(
			t("import.cmVaultFound", { count: entries.length }),
		);
		this.vaultBtn.disabled = false;
	}

	/**
	 * The paste box, which now takes two languages.
	 *
	 * Which one it is, is decided by the first character rather than by
	 * trial-parsing: a stylesheet never opens with a brace (a rule opens with
	 * its selector), so the two are told apart without a failed `JSON.parse`
	 * being swallowed as "must have been CSS then" and the user losing the real
	 * syntax error.
	 */
	private async runImportFromPaste(): Promise<void> {
		const text = this.textareaEl.value.trim();

		if (text.startsWith("{") || text.startsWith("[")) {
			let parsed: unknown;
			try {
				parsed = JSON.parse(text);
			} catch {
				await this.reportFatal("import.err.parseFailed");
				return;
			}
			const raws = parseCalloutManagerData(parsed);
			if (!raws) {
				await this.reportFatal("import.err.cmNotRecognized");
				return;
			}
			if (raws.length === 0) {
				await this.reportFatal("import.err.cmNoEntries");
				return;
			}
			await this.runImport(toCalloutManagerEntries(raws));
			return;
		}

		// The clipboard export. An empty result is the planner's own to report,
		// via import.err.cmNoBlocksFound.
		await this.runImport(parseCalloutManagerExport(text));
	}

	/** Where both sources converge, once their entries are in hand. */
	private async runImport(
		entries: readonly CalloutManagerEntry[],
	): Promise<void> {
		const { toApply, issues } = planCalloutManagerImport(
			entries,
			this.ctx.plugin.registry,
		);
		const fatal = entries.length === 0;

		if (issues.length > 0 || fatal) {
			const choice = await new ImportReportModal(
				this.ctx.app,
				issues,
				toApply.length,
				entries.length,
				fatal,
			).prompt();
			if (choice === "cancel") return;
		}
		if (toApply.length === 0) return;

		// No ensureIconArtworkFor, unlike the Admonition and JSON importers, and
		// not an oversight: every icon this one can produce is `type: "lucide"`,
		// whose pack is `kind: "builtin"` and drawn by `setIcon`. There is no
		// artwork to fetch, and IconService.isFullyCached short-circuits builtin
		// to true anyway, so the call would only add a promise.
		const { created, updated } =
			this.ctx.plugin.registry.applyCalloutManagerImport(toApply);
		new Notice(t("notice.importedCalloutManager", { created, updated }));
		this.ctx.display();
		this.close();
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
