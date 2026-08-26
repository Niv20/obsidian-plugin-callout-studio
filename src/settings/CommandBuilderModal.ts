/**
 * settings/CommandBuilderModal.ts — Every Callout Studio command, in one place.
 *
 * Two lists. The six fixed commands are shown as plain lines, because there is
 * nothing to do to them but bind a key; the user's own commands get real rows
 * with add / edit / delete. Both carry the same two things, and they are
 * deliberately separate: pills beside the name that *read* what Obsidian has
 * bound, and a button in the row's button group that *opens* the pane changing
 * it. A shortcut is a fact about the row, not a control, so it does not wear
 * one — and a row can hold several, because a command can be bound more than
 * once.
 *
 * Everything saves itself, matching the plugin's save-on-change convention, so
 * there is no OK/Cancel.
 *
 * The list subscribes to the registry while it is open: deleting a callout from
 * another surface removes the commands that depended on it, and this window has
 * to stop showing them at the same moment rather than offering rows that no
 * longer exist.
 */
import { Modal, Setting, ToggleComponent, setIcon } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import {
	FIXED_COMMAND_IDS,
	FIXED_COMMAND_NAME_KEYS,
	isFixedCommandEnabled,
	type FixedCommandId,
} from "../editor/commands";
import type { CustomCommandManager } from "../editor/CustomCommandManager";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { CustomCommand, PluginSettings } from "../types";
import { paintCalloutListIcon } from "../manager/theme/calloutListIcon";
import {
	commandSignature,
	describeCommand,
	isSuspendedByTheme,
	obsidianCommandId,
} from "../utils/customCommands";
import { ConfirmModal } from "../utils/ConfirmModal";
import { CommandEditorModal } from "./CommandEditorModal";
import { addHotkeyButton, addHotkeyChips } from "./command/hotkeyRow";
import { applyModalChrome } from "./modalChrome";

/** Narrow structural host — the plugin instance satisfies this. */
export interface CommandBuilderHost {
	registry: CalloutRegistry;
	settings: PluginSettings;
	customCommands: CustomCommandManager;
	/** Both halves are needed: the id keys a hotkey, the name prefixes it. */
	manifest: { id: string; name: string };
	isKnownZeroUsageFallback(id: string): boolean;
	setFixedCommandEnabled(id: FixedCommandId, enabled: boolean): Promise<void>;
}

export class CommandBuilderModal extends Modal {
	private listEl?: HTMLElement;
	private fixedListEl?: HTMLElement;
	private readonly onRegistryChange = (): void => {
		this.renderList();
	};

	constructor(
		app: App,
		private readonly host: CommandBuilderHost,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		// On `modalEl`, not `contentEl`: the window's width is set from here,
		// and `--dialog-width` is read by `.modal` itself.
		this.modalEl.addClass("cs-command-builder");
		// No footer: adding, editing and deleting each save themselves.
		applyModalChrome(this);
		this.titleEl.setText(t("commandBuilder.title"));
		contentEl.createEl("p", {
			text: t("commandBuilder.desc"),
			cls: "setting-item-description",
		});

		// The user's own commands come first. They are the only part of this
		// window that can be acted on, and the five built-ins never change, so
		// putting them on top would push the list that matters below the fold.
		new Setting(contentEl)
			.setName(t("commandBuilder.yourCommands"))
			.setHeading()
			.addButton((btn) =>
				btn
					.setButtonText(t("commandBuilder.newCommand"))
					.setCta()
					.onClick(() => void this.createCommand()),
			);

		// Created once and re-rendered in place, so nothing bound to the
		// container is lost on every mutation.
		this.listEl = contentEl.createDiv({ cls: "cs-command-list" });
		this.renderList();

		new Setting(contentEl).setName(t("commandBuilder.builtIn")).setHeading();
		this.fixedListEl = contentEl.createDiv({ cls: "cs-command-fixed-list" });
		this.renderFixedList();

		this.host.registry.onChange(this.onRegistryChange);
	}

	onClose(): void {
		this.host.registry.offChange(this.onRegistryChange);
		this.contentEl.empty();
	}

	/** Signatures already in use, optionally ignoring the command being edited. */
	private takenSignatures(exceptId?: string): Set<string> {
		const taken = new Set<string>();
		for (const command of this.host.customCommands.list()) {
			if (command.id === exceptId) continue;
			taken.add(commandSignature(command));
		}
		return taken;
	}

	private async createCommand(): Promise<void> {
		const draft = await new CommandEditorModal(this.app, this.host, {
			takenSignatures: this.takenSignatures(),
		}).openAndWait();
		if (!draft) return;
		await this.host.customCommands.add(draft);
		this.renderList();
	}

	private async editCommand(command: CustomCommand): Promise<void> {
		const draft = await new CommandEditorModal(this.app, this.host, {
			existing: command,
			takenSignatures: this.takenSignatures(command.id),
		}).openAndWait();
		if (!draft) return;
		// Same identity, so the command is re-registered in place and whatever
		// hotkey the user bound to it survives the edit.
		await this.host.customCommands.update(command.id, draft);
		this.renderList();
	}

	private async deleteCommand(command: CustomCommand): Promise<void> {
		const def = this.host.registry.get(command.calloutId);
		const name = def
			? describeCommand(command, def)
			: t("commandBuilder.unknownCommand");
		const ok = await new ConfirmModal(
			this.app,
			t("confirm.titleDeleteCommand"),
			t("commandBuilder.deleteConfirm", { name }),
		).confirm();
		if (!ok) return;
		await this.host.customCommands.remove(command.id);
		this.renderList();
	}

	/**
	 * The fixed commands, in the same row as the user's own.
	 *
	 * They carry no icon column: there is no callout behind a built-in
	 * command, and an empty icon slot would read as artwork that failed to
	 * load rather than as a column that was never there. What is left — the
	 * name, its shortcut pills, the button that binds one, and the on/off
	 * toggle — is all there is to do to them.
	 *
	 * A toggle turned off does not remove the row: the fixed commands are a
	 * fixed set the user is choosing among, not a list they're pruning, so a
	 * row moving or disappearing on toggle would make it hard to find again.
	 * It fades in place instead, and keeps showing whatever shortcut is
	 * already bound to it — turning it back on must not have lost that.
	 */
	private renderFixedList(): void {
		const listEl = this.fixedListEl;
		if (!listEl) return;
		listEl.empty();
		for (const id of FIXED_COMMAND_IDS) {
			const name = t(FIXED_COMMAND_NAME_KEYS[id]);
			const enabled = isFixedCommandEnabled(this.host.settings, id);
			const row = listEl.createDiv({
				cls: enabled
					? "callout-studio-row cs-command-row cs-command-fixed-row"
					: "callout-studio-row cs-command-row cs-command-fixed-row is-disabled",
			});
			const nameLine = row
				.createDiv({ cls: "callout-studio-row-info" })
				.createDiv({ cls: "callout-studio-row-name-line" });
			nameLine.createDiv({ cls: "callout-studio-row-name", text: name });
			// Still read, even switched off: the binding underneath survives the
			// toggle, and turning the command back on must not look like it lost
			// the shortcut.
			this.hotkeyChips(nameLine, id);

			// Blocked, not hidden: there is nowhere left for the click to lead
			// while the command isn't registered.
			const buttonsEl = row.createDiv({ cls: "callout-studio-row-buttons" });
			this.hotkeyButton(buttonsEl, name, !enabled);

			const toggleWrap = row.createDiv({ cls: "cs-command-row-toggle" });
			new ToggleComponent(toggleWrap)
				.setValue(enabled)
				.setTooltip(t("commandBuilder.toggleAria", { name }))
				.onChange(async (value) => {
					await this.host.setFixedCommandEnabled(id, value);
					this.renderFixedList();
				});
		}
	}

	/** @see addHotkeyChips */
	private hotkeyChips(nameLine: HTMLElement, shortId: string): void {
		addHotkeyChips(this.app, this.host.manifest.id, nameLine, shortId);
	}

	/** @see addHotkeyButton */
	private hotkeyButton(
		buttonsEl: HTMLElement,
		name: string,
		disabled = false,
	): void {
		addHotkeyButton(
			this.app,
			this.host.manifest.name,
			() => this.close(),
			buttonsEl,
			name,
			disabled,
		);
	}

	private renderList(): void {
		const listEl = this.listEl;
		if (!listEl) return;
		listEl.empty();

		const commands = this.host.customCommands.list();
		if (commands.length === 0) {
			listEl.createDiv({
				cls: "callout-studio-empty-state",
				text: t("commandBuilder.empty"),
			});
			return;
		}

		for (const command of commands) {
			const def = this.host.registry.get(command.calloutId);
			// A command whose callout is gone is pruned by the manager's sweep,
			// so a row here without one is a frame out of date at most.
			if (!def) continue;

			const name = describeCommand(command, def);
			const row = listEl.createDiv({
				cls: "callout-studio-row cs-command-row",
			});

			// A command can be built on a callout the theme owns, and the row
			// has to show the icon the reader will actually see beside it.
			const iconEl = row.createDiv({ cls: "callout-studio-row-icon" });
			paintCalloutListIcon(
				iconEl,
				def,
				this.host.registry,
				activeDocument.body.classList.contains("theme-dark"),
			);

			const infoEl = row.createDiv({ cls: "callout-studio-row-info" });
			const nameLine = infoEl.createDiv({
				cls: "callout-studio-row-name-line",
			});
			nameLine.createDiv({ cls: "callout-studio-row-name", text: name });
			this.hotkeyChips(nameLine, obsidianCommandId(command.id));
			// A heading or inline command on a callout the theme has taken over
			// is unregistered until the theme lets go. Said here because the
			// alternative is a command that silently stops appearing in the
			// palette while still sitting in this list.
			if (isSuspendedByTheme(this.host.registry, command)) {
				infoEl.createDiv({
					cls: "cs-command-suspended",
					text: t("commandBuilder.commandSuspended"),
				});
			}

			const buttonsEl = row.createDiv({
				cls: "callout-studio-row-buttons",
			});
			// First, where the shortcut itself used to sit.
			this.hotkeyButton(buttonsEl, name);

			const editBtn = buttonsEl.createEl("button", {
				attr: { "aria-label": t("commandBuilder.editAria", { name }) },
			});
			setIcon(editBtn, "pencil");
			editBtn.addEventListener("click", () => void this.editCommand(command));

			const deleteBtn = buttonsEl.createEl("button", {
				cls: "callout-studio-delete-btn",
				attr: { "aria-label": t("commandBuilder.deleteAria", { name }) },
			});
			setIcon(deleteBtn, "trash-2");
			deleteBtn.addEventListener(
				"click",
				() => void this.deleteCommand(command),
			);
		}
	}
}
