/**
 * utils/FirstRunScanModal.ts — First-install vault scan prompt.
 *
 * Shown exactly once, on the first install, when the vault is large enough
 * that a silent background scan might feel intrusive (threshold set in
 * constants.ts). Gives the user a choice to scan now or skip; the scan
 * itself is executed via the runScan callback passed by main.ts.
 */
import { Modal, Notice } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import { applyModalChrome } from "../settings/modalChrome";

/**
 * One-time first-install modal that asks the user whether to scan the
 * vault for existing callouts. Shown only when the vault is large enough
 * to make a silent auto-scan feel intrusive (see `HEAVY_VAULT_FILE_THRESHOLD`).
 *
 * The modal does not run the scan itself — the caller passes a `runScan`
 * function. The promise returned by {@link prompt} resolves once the user
 * has made a choice (and the scan, if any, has finished).
 */
export class FirstRunScanModal extends Modal {
	private resolved = false;
	private resolve: () => void = () => {};
	private busy = false;
	private scanBtn: HTMLButtonElement | null = null;
	private skipBtn: HTMLButtonElement | null = null;

	constructor(
		app: App,
		private readonly fileCount: number,
		private readonly runScan: () => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText(t("firstRun.title"));

		contentEl.createEl("p", { text: t("firstRun.body") });

		contentEl.createEl("p", {
			text: t("firstRun.heavyVaultNote", {
				count: String(this.fileCount),
			}),
			cls: "callout-studio-firstrun-heavy-note",
		});

		contentEl.createEl("p", {
			text: t("firstRun.laterHint"),
			cls: "callout-studio-firstrun-later-hint",
		});

		const btnContainer = applyModalChrome(this, { footer: true });

		this.skipBtn = btnContainer.createEl("button", {
			text: t("firstRun.noThanks"),
		});
		this.skipBtn.addEventListener("click", () => {
			if (this.busy) return;
			this.finish();
		});

		this.scanBtn = btnContainer.createEl("button", {
			text: t("firstRun.scanNow"),
			cls: "mod-cta",
		});
		this.scanBtn.addEventListener("click", () => {
			void this.handleScan();
		});
	}

	private async handleScan(): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		if (this.scanBtn) {
			this.scanBtn.disabled = true;
			this.scanBtn.setText(t("firstRun.scanning"));
		}
		if (this.skipBtn) this.skipBtn.disabled = true;

		try {
			await this.runScan();
		} catch (e) {
			console.error("[CalloutStudio] first-run scan failed", e);
			new Notice(t("firstRun.scanFailed"));
		} finally {
			this.finish();
		}
	}

	private finish(): void {
		if (this.resolved) return;
		this.resolved = true;
		this.resolve();
		this.close();
	}

	onClose(): void {
		// If the user dismissed the modal (Esc / click-out) without
		// pressing a button, treat it the same as "No thanks" so the
		// caller can still flip the first-run flag and move on.
		if (!this.resolved) {
			this.resolved = true;
			this.resolve();
		}
		this.contentEl.empty();
	}

	prompt(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}
