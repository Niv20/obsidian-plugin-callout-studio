/**
 * settings/pluginImport/PluginImportModal.ts — the one window that imports from
 * another callout plugin, Admonition and Callout Manager alike.
 *
 * One screen: three options, stacked, and exactly one Import, in the footer:
 *
 *   ┌──────────────────────────────────────────┐
 *   │ Import from Admonition                 ✕ │
 *   ├──────────────────────────────────────────┤
 *   │ ┃▣ This vault  (👍 Recommended)        ┃ │  ← active: accent border
 *   │ ┃  12 custom admonitions found.        ┃ │
 *   │  ▢ A file                                │
 *   │  ▢ Copied JSON                           │
 *   ├──────────────────────────────────────────┤
 *   │                       [Cancel] [Import]  │
 *   └──────────────────────────────────────────┘
 *
 * When the other plugin's data is not in this vault, "This vault" stays on
 * screen, greyed out, saying why. Each box is its own button: there is nothing
 * else on it to press (see `activate`).
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
	IMPORT_OPTIONS,
	activeOption,
	canImport,
	initialFlow,
	isFilled,
	type ImportOption,
} from "./pluginImportFlow";
import {
	probeVault,
	type PluginImportBatch,
	type PluginImportParse,
	type PluginImportSource,
} from "./pluginImportSource";
import {
	markActive,
	renderOptions,
	vaultStatus,
	type OptionsRefs,
} from "./pluginImportViews";

/** Where focus goes after the body is redrawn; null leaves it alone. */
type FocusIntent = ImportOption | "import" | null;

export class PluginImportModal extends Modal {
	private flow = initialFlow();
	private vaultBatch: PluginImportBatch | null = null;
	private stagedFile: File | null = null;
	private pasteText = "";
	/** i18n key: why the last clipboard read brought nothing back. */
	private pasteError: string | null = null;
	/** Bumped on every open and close, so late async work can tell it is stale. */
	private generation = 0;

	private fileInput!: HTMLInputElement;
	private announcer!: HTMLElement;
	private viewEl!: HTMLElement;
	private importBtn!: HTMLButtonElement;
	private options: OptionsRefs | null = null;

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
		this.pasteError = null;

		const { copy } = this.source;
		this.modalEl.addClass(this.source.modalClass);
		this.setTitle(t(copy.title));

		this.contentEl.createEl("p", {
			text: t(copy.instructions),
			cls: "cs-import-instructions",
		});

		// Created once and attached for the window's whole life, outside the
		// part that is redrawn, for the reason ImportSourceModal spells out: a
		// file input built fresh and left detached does not reliably open
		// Chromium's file chooser.
		this.fileInput = this.contentEl.createEl("input", {
			cls: "cs-import-file-input",
			type: "file",
			attr: { accept: this.source.fileAccept },
		});
		this.fileInput.addEventListener("change", () => {
			const file = this.fileInput.files?.[0];
			// Reset so picking the same file again still fires `change`.
			this.fileInput.value = "";
			if (file) this.stageFile(file);
		});

		// Says what the probe found, and why a clipboard read brought nothing back.
		// Created empty, before the probe starts, because a live region only
		// reliably announces changes made after it exists — and outside the
		// redrawn part, so a redraw cannot cut it off.
		this.announcer = this.contentEl.createDiv({
			cls: "cs-import-announcer",
			attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
		});

		// The part that is redrawn: the three options and nothing else.
		this.viewEl = this.contentEl.createDiv();

		const footer = applyModalChrome(this, { footer: true });
		footer
			.createEl("button", { text: t(copy.cancel) })
			.addEventListener("click", () => this.close());
		this.importBtn = footer.createEl("button", {
			text: t(copy.importButton),
			cls: "mod-cta",
		});
		this.importBtn.addEventListener("click", () => void this.runImport());

		this.render(null);
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
		this.options = null;
		removeModalChrome(this);
		this.contentEl.empty();
	}

	/* -------------------------------------------------------------- *
	 * Drawing
	 * -------------------------------------------------------------- */

	/** Redraw the three options, then bring the footer in line. */
	private render(focus: FocusIntent): void {
		this.viewEl.empty();
		this.options = renderOptions(
			this.viewEl,
			this.titleEl,
			this.source.copy,
			{
				probe: this.flow.probe,
				vaultCount: this.vaultBatch?.size ?? 0,
				fileName: this.stagedFile?.name ?? null,
				pasted: this.flow.hasPaste,
				pasteError: this.pasteError,
			},
			{ onActivate: (option) => this.activate(option) },
		);
		this.bindFileDrop();
		this.sync();
		this.focus(focus);
	}

	/** The file box accepts the same File that the picker passes to stageFile. */
	private bindFileDrop(): void {
		const box = this.options?.file.el;
		if (!box) return;
		box.addEventListener("dragover", (ev) => {
			if (!ev.dataTransfer?.types.includes("Files")) return;
			ev.preventDefault();
			if (!this.flow.busy) {
				ev.dataTransfer.dropEffect = "copy";
				box.addClass("is-drop-target");
			}
		});
		box.addEventListener("dragleave", (ev) => {
			// Crossing a child inside the box is not leaving the drop target.
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
	 * Everything that changes without a redraw: which option is active, and the
	 * footer Import. The only writer of either, so they cannot disagree.
	 *
	 * Import is soft-disabled — `aria-disabled` and `cs-btn-disabled`, like the
	 * callout editor's Save — rather than `disabled`. It stays focusable, so it
	 * can still be read out with what it would import, and so Obsidian can hand
	 * focus back to it when the stacked report closes; a disabled button would
	 * refuse that focus and drop it on the page.
	 */
	private sync(): void {
		const active = activeOption(this.flow);
		if (this.options) markActive(this.options, active);

		const ready = canImport(this.flow);
		this.importBtn.setText(
			t(this.flow.busy ? "import.importing" : this.source.copy.importButton),
		);
		this.importBtn.setAttribute("aria-disabled", ready ? "false" : "true");
		this.importBtn.toggleClass("cs-btn-disabled", !ready);
		if (active && this.options) {
			this.importBtn.setAttribute("aria-describedby", this.options[active].describedBy);
		} else {
			this.importBtn.removeAttribute("aria-describedby");
		}
	}

	private focus(intent: FocusIntent): void {
		if (intent === null) return;
		if (intent === "import") {
			this.importBtn.focus({ preventScroll: true });
			return;
		}
		this.options?.[intent].el.focus({ preventScroll: true });
	}

	/** Which option's box has focus now, so a redraw can put it back. */
	private focusInView(): FocusIntent {
		const active = this.viewEl.ownerDocument.activeElement;
		if (!this.options || !active) return null;
		return IMPORT_OPTIONS.find((option) => this.options?.[option].el === active) ?? null;
	}

	/* -------------------------------------------------------------- *
	 * State changes
	 * -------------------------------------------------------------- */

	/**
	 * A click on an option's box. One that holds something but is not the
	 * active one becomes active — no redraw, so focus stays put. An empty one is
	 * filled instead, which chooses it once there is something in it. And the
	 * active one is filled again: the box is the only thing to press, so a
	 * second click on it is how a file is swapped for another or a paste
	 * brought up to date. The vault is filled by the probe alone.
	 */
	private activate(option: ImportOption): void {
		if (this.flow.busy) return;
		const filled = isFilled(this.flow, option);
		if (option !== "vault" && (!filled || activeOption(this.flow) === option)) {
			if (option === "file") this.chooseFile();
			else void this.paste();
		} else if (filled) {
			this.flow.chosen = option;
			this.sync();
		}
	}

	private chooseFile(): void {
		if (!this.flow.busy) this.fileInput.click();
	}

	/**
	 * Picking a file only stages it, replacing any file staged before — the
	 * footer Import is still the one thing that imports. Focus goes there, with
	 * the file as its description: Import is the next thing to press.
	 */
	private stageFile(file: File): void {
		if (this.flow.busy) return;
		this.stagedFile = file;
		this.flow.hasFile = true;
		this.flow.chosen = "file";
		this.render("import");
	}

	/**
	 * Read the clipboard straight into the paste option. Read now, from the
	 * click, rather than at Import: the clipboard is the user's, and what was
	 * on it when they clicked is what they meant.
	 */
	private async paste(): Promise<void> {
		if (this.flow.busy) return;
		const generation = this.generation;
		let text: string | null;
		try {
			text = await navigator.clipboard.readText();
		} catch {
			text = null;
		}
		if (generation !== this.generation || this.flow.busy) return;
		if (text !== null) {
			try {
				assertImportTextSize(text);
			} catch {
				this.pasteError = "import.err.tooLarge";
				this.announcer.setText(t(this.pasteError));
				if (!this.flow.hasPaste) this.render("paste");
				return;
			}
		}

		if (text === null || text.trim().length === 0) {
			const error = text === null ? "import.clipboardUnreadable" : "import.clipboardEmpty";
			this.announcer.setText(t(error));
			// A second read that brings nothing back — an emptied clipboard, or a
			// phone's paste prompt dismissed — leaves the paste already held, and
			// still ready, as it was.
			if (this.flow.hasPaste) return;
			this.pasteError = error;
			this.render(this.focusInView());
			return;
		}
		this.pasteText = text;
		this.pasteError = null;
		this.flow.hasPaste = true;
		this.flow.chosen = "paste";
		this.render("import");
	}

	private async probe(generation: number): Promise<void> {
		const result = await probeVault(this.app, this.source);
		if (generation !== this.generation) return;

		this.flow.probe = result.kind;
		this.vaultBatch = result.kind === "found" ? result.batch : null;
		// The vault box's own status line, word for word.
		this.announcer.setText(
			vaultStatus(this.source.copy, result.kind, this.vaultBatch?.size ?? 0),
		);
		this.render(this.focusInView());
	}

	/* -------------------------------------------------------------- *
	 * Import
	 * -------------------------------------------------------------- */

	private async runImport(): Promise<void> {
		const target = activeOption(this.flow);
		if (this.flow.busy || !canImport(this.flow) || !target) return;

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
		if (target === "paste") return this.source.fromText(this.pasteText);

		// Read only now, not when staged: a file picked and then replaced is
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
		if (!await writeSettingsBackup(this.ctx.plugin, this.ctx.plugin.registry.toSaveData())) {
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
		if (busy) this.options?.file.el.removeClass("is-drop-target");
		this.sync();
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
