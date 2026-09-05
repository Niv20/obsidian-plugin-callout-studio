/**
 * editor/CustomCommandManager.ts — Keeps user-built commands in sync.
 *
 * The plugin registers six fixed commands (editor/commands.ts); everything
 * here was created by the user in the command builder and must appear in, and
 * disappear from, Obsidian's command palette as that list changes.
 *
 * The whole design is one idempotent pass, `syncAll()`, subscribed to the
 * registry's change event. That event carries no payload — a listener cannot
 * tell a delete from an update from an add — and a callout id "rename" is
 * really a remove followed by an add, so per-event handlers cannot work.
 * Re-deriving the desired set from the registry every time converges from any
 * starting state instead, which is what makes deletion, editing,
 * importing, startup and re-enabling all fall out of the same code path.
 *
 * Rename is the one thing a sweep genuinely cannot infer, since the old id is
 * simply gone; `migrateCalloutId()` is called from the rename site itself.
 */
import { Notice, type Editor, type Plugin } from "obsidian";
import { t } from "../i18n";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { CustomCommand, PluginSettings } from "../types";
import {
	describeCommand,
	generateCommandId,
	isSuspendedByTheme,
	obsidianCommandId,
	resolveAction,
	resolveHeadingLevel,
	sanitizeCustomCommands,
} from "../utils/customCommands";
import {
	insertEmptyCallout,
	insertHeadingCallout,
	insertInlineCallout,
	wrapSelectionInCallout,
} from "./CalloutBlockTools";

/** Everything the manager needs from the plugin, structurally. */
export type CustomCommandHostPlugin = Plugin & {
	registry: CalloutRegistry;
	settings: PluginSettings;
	saveSettings(): Promise<void>;
};

/** A command as the builder hands it over — identity is minted here. */
export type CustomCommandDraft = Omit<CustomCommand, "id">;

export class CustomCommandManager {
	/**
	 * Command id → the name it was last registered under.
	 *
	 * The name is kept because re-registering is how a renamed callout's
	 * command gets a correct palette label, and re-registering when nothing
	 * changed is pure waste: every `addCommand` appends a teardown callback to
	 * the plugin's event list that only unwinds on unload.
	 */
	private registered = new Map<string, string>();

	/**
	 * Whether a sweep has already run. The first one happens at startup, where
	 * dropping entries is expected housekeeping and a popup would be noise;
	 * later ones follow a user action, where silence would be mystifying.
	 */

	constructor(private plugin: CustomCommandHostPlugin) {}

	/** The user's commands, in creation order. */
	list(): readonly CustomCommand[] {
		return this.plugin.settings.customCommands;
	}

	/** Whether any command depends on this callout. */
	hasCommandFor(calloutId: string): boolean {
		return this.plugin.settings.customCommands.some(
			(command) => command.calloutId === calloutId,
		);
	}

	async add(draft: CustomCommandDraft): Promise<CustomCommand> {
		const command: CustomCommand = { id: generateCommandId(), ...draft };
		this.plugin.settings.customCommands.push(command);
		this.syncAll();
		await this.plugin.saveSettings();
		return command;
	}

	/**
	 * Replace a command's configuration, keeping its identity — and therefore
	 * whatever hotkey the user bound to it.
	 */
	async update(id: string, draft: CustomCommandDraft): Promise<boolean> {
		const list = this.plugin.settings.customCommands;
		const index = list.findIndex((command) => command.id === id);
		if (index < 0) return false;
		list[index] = { id, ...draft };
		this.syncAll();
		await this.plugin.saveSettings();
		return true;
	}

	async remove(id: string): Promise<boolean> {
		const list = this.plugin.settings.customCommands;
		const index = list.findIndex((command) => command.id === id);
		if (index < 0) return false;
		list.splice(index, 1);
		this.syncAll();
		await this.plugin.saveSettings();
		return true;
	}

	/**
	 * Point commands at a callout's new id after it was renamed.
	 *
	 * Must run while the registry is inside a `batch()` around the rename's
	 * remove/add pair: the sweep that follows would otherwise see commands
	 * referring to an id that no longer exists and correctly — but very
	 * unhelpfully — delete them. Saving is left to the rename flow.
	 */
	migrateCalloutId(oldId: string, newId: string): void {
		if (oldId === newId) return;
		for (const command of this.plugin.settings.customCommands) {
			if (command.calloutId === oldId) command.calloutId = newId;
		}
	}

	/**
	 * Bring Obsidian's command list in line with the stored one.
	 *
	 * Safe to call at any time and as often as needed; it compares rather than
	 * assumes, so nothing is registered twice and nothing survives that
	 * shouldn't.
	 */
	syncAll(): void {
		const stored = this.plugin.settings.customCommands;

		// A corrupt or half-written entry is dropped on its own rather than
		// taken as a reason to give up on the rest of the list.
		const sanitized = sanitizeCustomCommands(stored);
		// Missing targets can be awaiting a manual scan or another device's
		// settings. Suspend registration while preserving the command and hotkey.
		const kept = sanitized;
		const invalidCount = stored.length - sanitized.length;
		if (invalidCount > 0) this.plugin.settings.customCommands = kept;

		const desiredNames = new Map<string, string>();
		for (const command of kept) {
			const def = this.plugin.registry.get(command.calloutId);
			if (!def) continue;
			// Suspended, not dropped — and the distinction is why this gate is
			// here rather than in `kept` above, which is written back to
			// `settings.customCommands` and would delete the command for good.
			// A theme claiming the callout is temporary; the command has to come
			// back, at the same id, when the theme lets go, so that the user's
			// own hotkey still fires it.
			if (isSuspendedByTheme(this.plugin.registry, command)) continue;
			desiredNames.set(command.id, describeCommand(command, def));
		}

		for (const id of [...this.registered.keys()]) {
			if (desiredNames.has(id)) continue;
			this.plugin.removeCommand(obsidianCommandId(id));
			this.registered.delete(id);
		}

		for (const command of kept) {
			const name = desiredNames.get(command.id);
			if (name === undefined) continue;
			// Only the rendered name decides whether a re-registration is
			// needed. An icon, colour or palette edit leaves it identical, so
			// those cost nothing; a display-name edit changes it, and the
			// re-register keeps the palette label honest. Obsidian drops only
			// the *default* hotkeys of a removed command, never the user's
			// own, so the binding survives this.
			if (this.registered.get(command.id) === name) continue;
			const commandId = obsidianCommandId(command.id);
			if (this.registered.has(command.id)) {
				this.plugin.removeCommand(commandId);
			}
			// A fresh object every time: addCommand mutates what it is given,
			// prefixing the id and name in place.
			this.plugin.addCommand({
				id: commandId,
				name,
				editorCallback: (editor: Editor) => {
					this.run(command.id, editor);
				},
			});
			this.registered.set(command.id, name);
		}

		if (invalidCount > 0) {
			void this.plugin.saveSettings();
			console.debug("[CalloutStudio] dropped malformed custom commands", invalidCount);
		}

	}

	/** Whether a title is only some callout's display name, not the user's. */
	private isKnownDisplayName = (title: string): boolean =>
		this.plugin.registry
			.getAll()
			.some((def) => def.displayName.toLowerCase() === title.toLowerCase());

	/**
	 * Run a command's editor action.
	 *
	 * Looks the command up by id at run time rather than closing over it, so an
	 * edited command behaves as it is configured now even if the registration
	 * itself was left in place.
	 */
	private run(commandId: string, editor: Editor): void {
		const command = this.plugin.settings.customCommands.find(
			(entry) => entry.id === commandId,
		);
		if (!command) return;

		const def = this.plugin.registry.get(command.calloutId);
		if (!def) {
			// The callout vanished without the registry announcing it. Tell the
			// user why nothing happened, then converge.
			new Notice(t("notice.customCommandMissingCallout"));
			this.syncAll();
			return;
		}

		if (command.role === "heading") {
			insertHeadingCallout(
				editor,
				def,
				resolveHeadingLevel(command),
				{ isKnownDisplayName: this.isKnownDisplayName },
			);
			return;
		}

		if (command.role === "inline") {
			insertInlineCallout(editor, def, {
				allowContent: this.plugin.settings.inlineCallouts.allowContent,
			});
			return;
		}

		if (resolveAction(command) === "wrap") {
			wrapSelectionInCallout(editor, { def });
			return;
		}
		insertEmptyCallout(editor, { def });
	}
}
