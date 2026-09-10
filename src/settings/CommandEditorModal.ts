/**
 * settings/CommandEditorModal.ts — Build or edit one custom command.
 *
 * A small form: which format to write, which callout, and — where the format
 * gives a real choice — the heading level, the action and the fold state.
 * Returns the draft to its caller, which owns the list and mints the identity;
 * this modal never touches settings itself.
 *
 * The format-specific rows are built unconditionally and hidden by class, the
 * same way the palette editor handles its gradient rows: one sync function
 * decides visibility so the controls can never disagree about the format.
 */
import { Modal } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import { getLocale } from "../i18n";
import type { CustomCommandDraft } from "../editor/CustomCommandManager";
import type {
	CalloutDefinition,
	CalloutRenderRole,
	CustomCommand,
	CustomCommandAction,
	CustomCommandFold,
} from "../types";
import {
	DEFAULT_HEADING_LEVEL,
	commandSignature,
	describeCommand,
	resolveAction,
	resolveFold,
	resolveHeadingLevel,
} from "../utils/customCommands";
import { sortCalloutsByDisplayName } from "../utils/sorting";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import { buildCalloutRow, type CalloutRow } from "./command/calloutRow";
import type { CalloutEditorPlugin } from "./editor/types";
import { buildFormatRow, type FormatRow } from "./command/commandRoles";
import { buildFoldStateRow, type FoldStateRow } from "./command/foldStateRow";
import { buildActionRow, buildHeadingLevelRow } from "./command/optionRows";

/**
 * Narrow structural host — the plugin instance, which both call sites already
 * pass. It is `CalloutEditorPlugin` because the Callout type row can open the
 * callout editor for a callout the user has not created yet.
 */
export type CommandEditorHost = CalloutEditorPlugin;

export interface CommandEditorOptions {
	/** The command being edited; absent when creating a new one. */
	existing?: CustomCommand;
	/**
	 * Signatures already spoken for, so the same command can't be made twice.
	 * The command being edited must not contribute its own.
	 */
	takenSignatures?: ReadonlySet<string>;
}

export class CommandEditorModal extends Modal {
	private role: CalloutRenderRole;
	private calloutId: string;
	private headingLevel: number;
	private action: CustomCommandAction;
	private fold: CustomCommandFold;

	private resolve?: (result: CustomCommandDraft | null) => void;
	private resolved = false;

	private headingRowEl?: HTMLElement;
	private actionRowEl?: HTMLElement;
	private formatRow?: FormatRow;
	private foldRow?: FoldStateRow;
	private calloutRow?: CalloutRow;
	private previewEl?: HTMLElement;
	private errorEl?: HTMLElement;
	private saveBtnEl?: HTMLButtonElement;

	constructor(
		app: App,
		private readonly host: CommandEditorHost,
		private readonly options: CommandEditorOptions = {},
	) {
		super(app);
		const initialChoices = this.getChoices();

		const existing = options.existing;
		this.role = existing?.role ?? "regular";
		this.headingLevel = existing
			? resolveHeadingLevel(existing)
			: DEFAULT_HEADING_LEVEL;
		this.action = existing ? resolveAction(existing) : "insert";
		this.fold = existing ? resolveFold(existing) : "none";
		this.calloutId = existing?.calloutId ?? initialChoices[0]?.id ?? "";
	}

	private getChoices(): CalloutDefinition[] {
		const offerable = this.host.registry.getAll();

		// A command pins the callout it uses, which is exactly why a discovered
		// row with no remaining vault usage can still be behind one: the prune
		// skips it. That row is filtered out of the offerable list, so without
		// this an existing command could not be edited without also being
		// re-pointed at a different callout.
		const pinned = this.options.existing
			? this.host.registry.get(this.options.existing.calloutId)
			: undefined;
		if (pinned && !offerable.some((def) => def.id === pinned.id)) {
			offerable.push(pinned);
		}
		return sortCalloutsByDisplayName(offerable, getLocale());
	}

	openAndWait(): Promise<CustomCommandDraft | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("cs-command-editor");
		const footer = applyModalChrome(this, { footer: true });
		this.setTitle(
			this.options.existing
				? t("commandBuilder.editTitle")
				: t("commandBuilder.newTitle"),
		);

		if (this.getChoices().length === 0) {
			contentEl.createDiv({
				cls: "callout-studio-empty-state",
				text: t("commandBuilder.noCallouts"),
			});
		}

		this.formatRow = buildFormatRow(contentEl, (role) => {
			this.role = role;
			this.syncVisibility();
		});
		this.calloutRow = buildCalloutRow(
			contentEl,
			this.host,
			() => this.getChoices(),
			this.calloutId,
			(id) => {
				this.calloutId = id;
				this.syncVisibility();
			},
		);
		this.headingRowEl = buildHeadingLevelRow(contentEl, this.headingLevel, (level) => {
			this.headingLevel = level;
			this.syncVisibility();
		});
		this.actionRowEl = buildActionRow(contentEl, this.action, (action) => {
			this.action = action;
			this.syncVisibility();
		});
		this.foldRow = buildFoldStateRow(contentEl, this.fold, (fold) => {
			this.fold = fold;
			this.syncVisibility();
		});
		this.buildPreview(contentEl);

		footer
			.createEl("button", { text: t("editor.cancel") })
			.addEventListener("click", () => this.finish(false));
		this.saveBtnEl = footer.createEl("button", {
			text: t("commandBuilder.save"),
			cls: "mod-cta",
		});
		this.saveBtnEl.addEventListener("click", () => this.finish(true));

		this.syncVisibility();
	}

	onClose(): void {
		// Before `empty()`: the teardown reaches a document-level listener.
		this.calloutRow?.destroy();
		this.calloutRow = undefined;
		this.contentEl.empty();
		// The footer is a sibling of contentEl, so empty() never reaches it.
		removeModalChrome(this);
		if (!this.resolved) {
			this.resolved = true;
			this.resolve?.(null);
		}
	}

	private buildPreview(parent: HTMLElement): void {
		// The wrapper carries the divider above the card, and only it can —
		// see `.cs-command-preview-row` in styles.css.
		const row = parent.createDiv({ cls: "cs-command-preview-row" });
		const box = row.createDiv({ cls: "cs-command-preview" });
		box.createDiv({
			cls: "cs-command-preview-label",
			text: t("commandBuilder.preview"),
		});
		this.previewEl = box.createDiv({ cls: "cs-command-preview-name" });
		this.errorEl = parent.createDiv({ cls: "cs-tag-error" });
	}

	/** The draft as the form currently stands. */
	private draft(): CustomCommandDraft {
		return {
			calloutId: this.calloutId,
			role: this.role,
			...(this.role === "heading"
				? { headingLevel: this.headingLevel }
				: {}),
			...(this.role === "regular" ? { action: this.action } : {}),
			// Omitted when it is the default, matching what the sanitizer
			// stores — otherwise a saved command and the same command reloaded
			// would differ by a key that means nothing.
			...(this.role === "regular" && this.fold !== "none"
				? { fold: this.fold }
				: {}),
		};
	}

	/**
	 * Show only the controls this format actually uses, refresh the preview and
	 * decide whether saving is allowed. Kept as one function so the rows and
	 * the save button can never disagree about the current format.
	 */
	private syncVisibility(): void {
		// The format control settles first: it may withdraw the current role
		// when the theme owns this callout, and every line below reads it.
		if (this.formatRow) {
			this.role = this.formatRow.sync(
				this.host.registry,
				this.host.settings,
				this.calloutId,
				this.role,
			);
		}
		this.headingRowEl?.toggleClass(
			"cs-row-hidden",
			this.role !== "heading",
		);
		// Heading and inline have exactly one sensible action, so the row is
		// hidden rather than shown as a dropdown with nothing to choose.
		this.actionRowEl?.toggleClass("cs-row-hidden", this.role !== "regular");
		this.foldRow?.sync(this.role);

		const def = this.host.registry.get(this.calloutId);
		if (this.previewEl) {
			this.previewEl.setText(
				def ? describeCommand(this.draft(), def) : "—",
			);
		}

		const duplicate =
			this.options.takenSignatures?.has(
				commandSignature(this.draft()),
			) === true;
		if (this.errorEl) {
			this.errorEl.setText(
				duplicate ? t("commandBuilder.duplicate") : "",
			);
			this.errorEl.toggleClass("is-visible", duplicate);
		}

		const valid = def !== undefined && !duplicate;
		if (this.saveBtnEl) {
			this.saveBtnEl.disabled = !valid;
			this.saveBtnEl.toggleClass("cs-btn-disabled", !valid);
		}
	}

	private finish(save: boolean): void {
		if (this.resolved) return;
		// Re-check rather than trusting the button: the callout could have been
		// deleted from another surface while this modal sat open.
		const result =
			save && this.host.registry.has(this.calloutId)
				? this.draft()
				: null;
		this.resolved = true;
		this.close();
		this.resolve?.(result);
	}
}
