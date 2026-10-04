/**
 * settings/pluginImport/PluginImportModal.ts — the one window that imports from
 * another callout plugin, Admonition and Callout Manager alike.
 *
 * One screen, at most two options, and exactly one Import, in the footer:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ Import from Callout Manager                ✕ │
 *   ├──────────────────────────────────────────────┤
 *   │  ▣ This vault  (Recommended)             (•) │
 *   │    12 customized callouts found.             │
 *   │                                              │
 *   │  ▣ Copied styles               [Paste]   ( ) │
 *   │    What Callout Manager's Copy button…       │
 *   │  ┌────────────────────────────────────────┐  │
 *   │  │ a text box, pasted into or filled by   │  │
 *   │  │ the Paste button                       │  │
 *   │  └────────────────────────────────────────┘  │
 *   ├──────────────────────────────────────────────┤
 *   │                           [Cancel] [Import]  │
 *   └──────────────────────────────────────────────┘
 *
 * The second option is the source's one fallback (`source.manual`): that paste
 * card for Callout Manager, a file card with an Upload button for Admonition.
 * When the other plugin's data is not in this vault, "This vault" is simply
 * not there — no greyed-out card and no line saying why — and the fallback
 * stands alone, with nothing to choose between.
 *
 * What the footer Import acts on is decided in one place, pluginImportFlow.ts,
 * from state rather than from which control was touched last. This class keeps
 * that state, draws it (pluginImportViews.ts) and runs the import; everything
 * specific to one plugin comes from its PluginImportSource.
 */
import { Modal, Notice } from "obsidian";
import { t } from "../../i18n";
import { ImportReportModal } from "../../utils/ImportReportModal";
import { assertImportSize, assertImportTextSize, ImportLimitError } from "../../utils/importLimits";
import { markCompetitorImportBannerHandled } from "../competitorImportState";
import { applyModalChrome, removeModalChrome } from "../modalChrome";
import { blockedWhilePaused } from "../pausedGuard";
import { writeSettingsBackup } from "../../manager/settingsBackup";
import type { SettingsSectionContext } from "../sections/types";
import {
	activeOption,
	canImport,
	initialFlow,
	isFilled,
	vaultOffered,
	type ImportOption,
} from "./pluginImportFlow";
import {
	probeVault,
	type PluginImportBatch,
	type PluginImportParse,
	type PluginImportSource,
} from "./pluginImportSource";
import { renderOptions, type OptionsView } from "./pluginImportViews";

export class PluginImportModal extends Modal {
	private flow = initialFlow();
	private vaultBatch: PluginImportBatch | null = null;
	private stagedFile: File | null = null;
	private pasteText = "";
	/** Bumped on every open and close, so late async work can tell it is stale. */
	private generation = 0;

	/** The file picker; null in a window whose fallback is pasted text. */
	private fileInput: HTMLInputElement | null = null;
	private announcer!: HTMLElement;
	private importBtn!: HTMLButtonElement;
	private view: OptionsView | null = null;

	constructor(
		private readonly ctx: SettingsSectionContext,
		private readonly source: PluginImportSource,
	) {
		super(ctx.app);
	}

	onOpen(): void {
		const generation = ++this.generation;
		this.flow = initialFlow();
		this.vaultBatch = null;
		this.stagedFile = null;
		this.pasteText = "";

		const { copy } = this.source;
		this.modalEl.addClass(this.source.modalClass);
		this.setTitle(t(copy.title));

		this.contentEl.createEl("p", {
			text: t(copy.instructions),
			cls: "cs-import-instructions",
		});

		// Created once and attached for the window's whole life, for the reason
		// ImportSourceModal spells out: a file input built fresh and left
		// detached does not reliably open Chromium's file chooser.
		this.fileInput = null;
		if (this.source.manual.kind === "file") {
			const input = this.contentEl.createEl("input", {
				cls: "cs-import-file-input",
				type: "file",
				attr: { accept: this.source.manual.accept },
			});
			input.addEventListener("change", () => {
				const file = input.files?.[0];
				// Reset so picking the same file again still fires `change`.
				input.value = "";
				if (file) this.stageFile(file);
			});
			this.fileInput = input;
		}

		// Says what the probe found. Created empty, before the probe starts,
		// because a live region only reliably announces changes made after it
		// exists.
		this.announcer = this.contentEl.createDiv({
			cls: "cs-import-announcer",
			attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
		});

		// Drawn once; from here on `update()` writes what changes in place.
		this.view = renderOptions(this.contentEl, this.titleEl, copy, this.source.manual, {
			onChoose: (option) => this.choose(option, true),
			onPasteFocus: () => this.choose("manual", false),
			onUpload: () => this.openPicker(),
			onPaste: () => void this.pasteFromClipboard(),
			onPasteInput: (text) => this.setPaste(text),
		});
		if (this.source.manual.kind === "file") this.bindFileDrop(this.view.manualEl);

		const footer = applyModalChrome(this, { footer: true });
		footer
			.createEl("button", { text: t(copy.cancel) })
			.addEventListener("click", () => this.close());
		this.importBtn = footer.createEl("button", {
			text: t(copy.importButton),
			cls: "mod-cta",
		});
		this.importBtn.addEventListener("click", () => void this.runImport());

		this.update();
		void this.probe(generation);
	}

	/**
	 * Stale from the moment the window is asked to close, not from `onClose`:
	 * on a phone Obsidian slides the window out first and only then calls
	 * `onClose`, and an import that settles during the slide must neither
	 * apply nor re-arm Import for a second tap.
	 */
	close(): void {
		this.generation++;
		super.close();
	}

	onClose(): void {
		this.generation++;
		this.view = null;
		removeModalChrome(this);
		this.contentEl.empty();
	}

	/* -------------------------------------------------------------- *
	 * Drawing
	 * -------------------------------------------------------------- */

	/** The file card accepts the same File that the picker passes to stageFile. */
	private bindFileDrop(box: HTMLElement): void {
		box.addEventListener("dragover", (ev) => {
			if (!ev.dataTransfer?.types.includes("Files")) return;
			ev.preventDefault();
			if (!this.flow.busy) {
				ev.dataTransfer.dropEffect = "copy";
				box.addClass("is-drop-target");
			}
		});
		box.addEventListener("dragleave", (ev) => {
			// Crossing a child inside the card is not leaving the drop target.
			if (box.contains(ev.relatedTarget as Node | null)) return;
			box.removeClass("is-drop-target");
		});
		box.addEventListener("drop", (ev) => {
			box.removeClass("is-drop-target");
			const file = ev.dataTransfer?.files?.[0];
			if (!file) return;
			ev.preventDefault();
			this.stageFile(file);
		});
	}

	/**
	 * Bring the cards and the footer Import in line with state. The only writer
	 * of either, so which card is active, Import's label, its readiness and
	 * what it says it would import cannot disagree.
	 *
	 * Import is soft-disabled — `aria-disabled` and `cs-btn-disabled`, like the
	 * callout editor's Save — rather than `disabled`. It stays focusable, so it
	 * can still be read out with what it would import, and so Obsidian can hand
	 * focus back to it when the stacked report closes; a disabled button would
	 * refuse that focus and drop it on the page.
	 */
	private update(): void {
		if (!this.view) return;
		this.view.update({
			flow: this.flow,
			vaultCount: this.vaultBatch?.size ?? 0,
			fileName: this.stagedFile?.name ?? null,
		});

		const ready = canImport(this.flow);
		this.importBtn.setText(
			t(this.flow.busy ? "import.importing" : this.source.copy.importButton),
		);
		this.importBtn.setAttribute("aria-disabled", ready ? "false" : "true");
		this.importBtn.toggleClass("cs-btn-disabled", !ready);
		const active = activeOption(this.flow);
		if (active) this.importBtn.setAttribute("aria-describedby", this.view.describedBy(active));
		else this.importBtn.removeAttribute("aria-describedby");
	}

	/* -------------------------------------------------------------- *
	 * State changes
	 * -------------------------------------------------------------- */

	/**
	 * A card or its radio dot was pressed: make that option the one Import acts
	 * on. Only an option that holds something can be chosen — an empty one is
	 * filled first, by its own button or its text box, and pressing it while
	 * "This vault" is there to choose instead says so in a notice. Alone, the
	 * fallback is not being chosen against anything, and a click on its card
	 * says nothing; nor does focus entering an empty paste box (`explain`).
	 */
	private choose(option: ImportOption, explain: boolean): void {
		if (this.flow.busy) return;
		if (!isFilled(this.flow, option)) {
			if (explain && option === "manual" && vaultOffered(this.flow.probe)) this.noticeFillFirst();
			return;
		}
		this.flow.chosen = option;
		this.update();
	}

	/** The fallback is empty: say what fills it — a paste, or an upload. */
	private noticeFillFirst(): void {
		new Notice(t(this.source.manual.kind === "file" ? "import.uploadFirst" : "import.pasteFirst"));
	}

	/** Upload, or Replace: open the file picker. */
	private openPicker(): void {
		if (this.flow.busy) return;
		this.fileInput?.click();
	}

	/**
	 * Uploading a file only stages it, replacing any file staged before — the
	 * footer Import is still the one thing that imports. The card is rewritten
	 * in place, so its Upload button is the button that now reads Replace, and
	 * a notice says which of the two just happened. The file becomes the
	 * active option and focus goes to Import: the next thing to press.
	 */
	private stageFile(file: File): void {
		if (this.flow.busy) return;
		const replaced = this.stagedFile !== null;
		this.stagedFile = file;
		this.flow.hasManual = true;
		this.flow.chosen = "manual";
		this.update();
		new Notice(t(replaced ? "import.fileReplaced" : "import.fileUploaded", { name: file.name }));
		this.importBtn.focus({ preventScroll: true });
	}

	/**
	 * The paste box changed. Kept as typed and handed to the source only when
	 * Import is pressed, as a file's text is; whitespace alone is nothing to
	 * import. Typing in the box is choosing it.
	 */
	private setPaste(text: string): void {
		this.pasteText = text;
		this.flow.hasManual = text.trim().length > 0;
		this.flow.chosen = "manual";
		this.update();
	}

	/**
	 * The Paste button: put the clipboard's text in the box, in place of
	 * whatever was there. The one clipboard read in the window, and only ever
	 * at this button — what it brought is then on screen, in the box, to see
	 * and to edit. A clipboard that is empty, unreadable or too large says so
	 * in a notice and leaves the box as it was.
	 */
	private async pasteFromClipboard(): Promise<void> {
		const input = this.view?.pasteInput;
		if (this.flow.busy || !input) return;
		const generation = this.generation;
		let text: string;
		try {
			text = await navigator.clipboard.readText();
		} catch {
			if (generation === this.generation) new Notice(t("import.clipboardBlocked"));
			return;
		}
		if (generation !== this.generation || this.flow.busy) return;
		if (text.trim() === "") {
			new Notice(t("import.clipboardEmpty"));
			return;
		}
		try {
			assertImportTextSize(text);
		} catch (error) {
			new Notice(t(error instanceof ImportLimitError ? error.messageKey : "import.err.processingFailed"));
			return;
		}
		input.value = text;
		this.setPaste(text);
		this.importBtn.focus({ preventScroll: true });
	}

	private async probe(generation: number): Promise<void> {
		const result = await probeVault(this.app, this.source);
		if (generation !== this.generation) return;

		this.flow.probe = result.kind;
		this.vaultBatch = result.kind === "found" ? result.batch : null;
		// The vault card's own status line, word for word. A vault with nothing
		// to import is not announced: its card just goes.
		if (this.vaultBatch) {
			this.announcer.setText(t(this.source.copy.vaultFound, { count: this.vaultBatch.size }));
		}
		this.update();
	}

	/* -------------------------------------------------------------- *
	 * Import
	 * -------------------------------------------------------------- */

	private async runImport(): Promise<void> {
		const target = activeOption(this.flow);
		if (this.flow.busy) return;
		if (!canImport(this.flow) || !target) {
			// Nothing in this vault and nothing handed over yet: say what to do
			// first. Not while the probe is still looking — the vault may yet
			// turn up and arm Import by itself.
			if (this.flow.probe !== "checking") this.noticeFillFirst();
			return;
		}

		const generation = this.generation;
		this.setBusy(true);
		try {
			const parsed = await this.read(target);
			if (generation !== this.generation) return;
			if ("errorKey" in parsed) {
				await this.reportFatal(parsed.errorKey);
				return;
			}
			await this.apply(parsed.batch, generation);
		} catch (error) {
			if (generation === this.generation) {
				await this.reportFatal(error instanceof ImportLimitError ? error.messageKey : "import.err.processingFailed");
			}
		} finally {
			if (generation === this.generation) this.setBusy(false);
		}
	}

	private async read(target: ImportOption): Promise<PluginImportParse> {
		if (target === "vault") {
			return this.vaultBatch
				? { batch: this.vaultBatch }
				: { errorKey: "import.err.parseFailed" };
		}
		if (this.source.manual.kind === "paste") {
			try {
				assertImportTextSize(this.pasteText);
			} catch (error) {
				return { errorKey: error instanceof ImportLimitError ? error.messageKey : "import.err.processingFailed" };
			}
			return this.source.fromText(this.pasteText);
		}

		// Read only now, not when staged: a file uploaded and then replaced is
		// never opened at all.
		const file = this.stagedFile;
		if (!file) return { errorKey: "import.err.fileUnreadable" };
		let text: string;
		try {
			assertImportSize(file.size);
			text = await file.text();
			assertImportTextSize(text);
		} catch (error) {
			return { errorKey: error instanceof ImportLimitError ? error.messageKey : "import.err.fileUnreadable" };
		}
		return this.source.fromText(text);
	}

	/** Where every route converges, once its entries are in hand. */
	private async apply(
		batch: PluginImportBatch,
		generation: number,
	): Promise<void> {
		const plan = await batch.plan(this.ctx);
		if (generation !== this.generation) return;

		// Nothing recognized at all is fatal: there is no "import the valid
		// ones" to offer. Both planners also say so as an issue.
		const fatal = batch.size === 0;
		if (plan.issues.length > 0 || fatal) {
			const choice = await new ImportReportModal(
				this.app,
				plan.issues,
				plan.applyCount,
				batch.size,
				fatal,
			).prompt();
			if (choice === "cancel" || generation !== this.generation) return;
		}
		if (plan.applyCount === 0) return;
		// The banner can open this window straight away; saving may be paused.
		if (blockedWhilePaused(this.ctx.plugin.settingsWriter)) return;
		// An import updates existing callouts in place: keep a way back.
		if (!await writeSettingsBackup(this.ctx.plugin, this.ctx.plugin.registry.toSaveData(), { reason: "before-import" })) {
			new Notice(t("import.backupFailed"), 10000);
			return;
		}
		if (generation !== this.generation) return;

		const { created, updated } = plan.apply();
		await markCompetitorImportBannerHandled(this.ctx.plugin);
		await this.ctx.plugin.saveSettings();
		if (this.ctx.plugin.settingsWriter.persists?.(this.ctx.plugin.registry.toSaveData()) === false) {
			new Notice(t("import.notSaved"), 10000);
		} else new Notice(t(this.source.copy.notice, { created, updated }));
		this.ctx.display();
		this.close();
		plan.afterApply?.();
	}

	private setBusy(busy: boolean): void {
		this.flow.busy = busy;
		if (busy) this.view?.manualEl.removeClass("is-drop-target");
		this.update();
	}

	/** The report modal in its "nothing usable here" mode. */
	private async reportFatal(messageKey: string): Promise<void> {
		await new ImportReportModal(
			this.app,
			[{ index: -1, entryLabel: "", level: "error", messageKey }],
			0,
			0,
			true,
		).prompt();
	}
}
