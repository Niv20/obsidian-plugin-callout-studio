/**
 * settings/CommandEditorModal.ts — Build or edit one custom command.
 *
 * A small form: which format to write, which callout, and — where the format
 * gives a real choice — the heading level and the action. Returns the draft to
 * its caller, which owns the list and mints the identity; this modal never
 * touches settings itself.
 *
 * Heading level and action are built unconditionally and hidden by class, the
 * same way the palette editor handles its gradient rows: one sync function
 * decides visibility so the two controls can never disagree about the format.
 */
import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import { getLocale } from "../i18n";
import type { CustomCommandDraft } from "../editor/CustomCommandManager";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type {
	CalloutDefinition,
	CalloutRenderRole,
	CustomCommand,
	CustomCommandAction,
	PluginSettings,
} from "../types";
import {
	DEFAULT_HEADING_LEVEL,
	HEADING_LEVELS,
	commandSignature,
	describeCommand,
	resolveAction,
	resolveHeadingLevel,
} from "../utils/customCommands";
import { sortCalloutsByDisplayName } from "../utils/sorting";
import { filterUsableCallouts } from "../utils/usableCallouts";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import { buildFormatRow, type FormatRow } from "./command/commandRoles";

/** Narrow structural host — the plugin instance satisfies this. */
export interface CommandEditorHost {
	registry: CalloutRegistry;
	settings: PluginSettings;
	isKnownZeroUsageFallback(id: string): boolean;
}

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

	private resolve?: (result: CustomCommandDraft | null) => void;
	private resolved = false;

	private headingRowEl?: HTMLElement;
	private actionRowEl?: HTMLElement;
	private formatRow?: FormatRow;
	private previewEl?: HTMLElement;
	private errorEl?: HTMLElement;
	private saveBtnEl?: HTMLButtonElement;

	private readonly choices: CalloutDefinition[];

	constructor(
		app: App,
		private readonly host: CommandEditorHost,
		private readonly options: CommandEditorOptions = {},
	) {
		super(app);
		const offerable = filterUsableCallouts(host.registry.getAll(), (id) =>
			host.isKnownZeroUsageFallback(id),
		);

		// A command pins the callout it uses, which is exactly why a discovered
		// row with no remaining vault usage can still be behind one: the prune
		// skips it. That row is filtered out of the offerable list, so without
		// this an existing command could not be edited without also being
		// re-pointed at a different callout.
		const pinned = options.existing
			? host.registry.get(options.existing.calloutId)
			: undefined;
		if (pinned && !offerable.some((def) => def.id === pinned.id)) {
			offerable.push(pinned);
		}
		this.choices = sortCalloutsByDisplayName(offerable, getLocale());

		const existing = options.existing;
		this.role = existing?.role ?? "regular";
		this.headingLevel = existing
			? resolveHeadingLevel(existing)
			: DEFAULT_HEADING_LEVEL;
		this.action = existing ? resolveAction(existing) : "insert";
		this.calloutId =
			existing?.calloutId ?? this.choices[0]?.id ?? "";
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

		if (this.choices.length === 0) {
			contentEl.createDiv({
				cls: "callout-studio-empty-state",
				text: t("commandBuilder.noCallouts"),
			});
		}

		this.formatRow = buildFormatRow(contentEl, (role) => {
			this.role = role;
			this.syncVisibility();
		});
		this.buildCalloutRow(contentEl);
		this.buildHeadingLevelRow(contentEl);
		this.buildActionRow(contentEl);
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
		this.contentEl.empty();
		// The footer is a sibling of contentEl, so empty() never reaches it.
		removeModalChrome(this);
		if (!this.resolved) {
			this.resolved = true;
			this.resolve?.(null);
		}
	}

	private buildCalloutRow(parent: HTMLElement): void {
		new Setting(parent)
			.setName(t("commandBuilder.callout"))
			.setDesc(t("commandBuilder.calloutDesc"))
			.addDropdown((dd) => {
				for (const def of this.choices) {
					dd.addOption(def.id, `${def.displayName} (${def.id})`);
				}
				dd.setValue(this.calloutId).onChange((value) => {
					this.calloutId = value;
					this.syncVisibility();
				});
				dd.setDisabled(this.choices.length === 0);
			});
	}

	private buildHeadingLevelRow(parent: HTMLElement): void {
		const setting = new Setting(parent)
			.setName(t("commandBuilder.headingLevel"))
			.setDesc(t("commandBuilder.headingLevelDesc"))
			.addDropdown((dd) => {
				for (const level of HEADING_LEVELS) {
					dd.addOption(String(level), `H${level}`);
				}
				dd.setValue(String(this.headingLevel)).onChange((value) => {
					this.headingLevel = Number(value);
					this.syncVisibility();
				});
			});
		this.headingRowEl = setting.settingEl;
	}

	private buildActionRow(parent: HTMLElement): void {
		const setting = new Setting(parent)
			.setName(t("commandBuilder.action"))
			.setDesc(t("commandBuilder.actionDesc"))
			.addDropdown((dd) => {
				dd.addOption("wrap", t("commandBuilder.actionWrap"));
				dd.addOption("insert", t("commandBuilder.actionInsert"));
				dd.setValue(this.action).onChange((value) => {
					this.action = value as CustomCommandAction;
					this.syncVisibility();
				});
			});
		this.actionRowEl = setting.settingEl;
	}

	private buildPreview(parent: HTMLElement): void {
		const box = parent.createDiv({ cls: "cs-command-preview" });
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
		this.headingRowEl?.toggleClass("cs-row-hidden", this.role !== "heading");
		// Heading and inline have exactly one sensible action, so the row is
		// hidden rather than shown as a dropdown with nothing to choose.
		this.actionRowEl?.toggleClass("cs-row-hidden", this.role !== "regular");

		const def = this.host.registry.get(this.calloutId);
		if (this.previewEl) {
			this.previewEl.setText(def ? describeCommand(this.draft(), def) : "—");
		}

		const duplicate =
			this.options.takenSignatures?.has(commandSignature(this.draft())) ===
			true;
		if (this.errorEl) {
			this.errorEl.setText(duplicate ? t("commandBuilder.duplicate") : "");
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
			save && this.host.registry.has(this.calloutId) ? this.draft() : null;
		this.resolved = true;
		this.close();
		this.resolve?.(result);
	}
}
