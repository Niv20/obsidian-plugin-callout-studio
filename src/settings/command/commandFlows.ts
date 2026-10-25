/**
 * settings/command/commandFlows.ts — making, changing and deleting the user's
 * own commands, and turning every built-in command back on.
 *
 * Who calls it. The Commands and shortcuts settings page
 * (declarative/commandsPage.ts).
 *
 * The main idea. Each flow asks what it needs (the command editor, or a yes to
 * a delete), changes the commands through the plugin's CustomCommandManager,
 * which registers them with Obsidian and saves, and returns whether anything
 * changed, so the caller knows to draw its list again.
 */
import type { App } from "obsidian";
import { t } from "../../i18n";
import { FIXED_COMMAND_IDS, isFixedCommandEnabled, type FixedCommandId } from "../../editor/commands";
import type { CustomCommandManager } from "../../editor/CustomCommandManager";
import type { CalloutDefinition, CustomCommand } from "../../types";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { commandSignature, describeCommand } from "../../utils/customCommands";
import { CommandEditorModal } from "../CommandEditorModal";
import type { CalloutEditorPlugin } from "../editor/types";

/**
 * What the flows need from the plugin (the plugin itself fits). It extends
 * `CalloutEditorPlugin` because the command editor's Callout type row can open
 * the callout editor.
 */
export interface CommandBuilderHost extends CalloutEditorPlugin {
	customCommands: CustomCommandManager;
	/** Both halves are needed: the id keys a hotkey, the name prefixes it. */
	manifest: { id: string; name: string };
	setFixedCommandEnabled(id: FixedCommandId, enabled: boolean): Promise<void>;
}

/**
 * A command's name on screen: what it does to which callout, or the callout's
 * id when that callout no longer exists.
 */
export function commandName(command: CustomCommand, def: CalloutDefinition | undefined): string {
	return def ? describeCommand(command, def) : command.calloutId;
}

/**
 * What every command already does, so the editor can refuse a second command
 * that does the same thing. `exceptId` leaves out the command being edited.
 */
function takenSignatures(host: CommandBuilderHost, exceptId?: string): Set<string> {
	const taken = new Set<string>();
	for (const command of host.customCommands.list()) {
		if (command.id === exceptId) continue;
		taken.add(commandSignature(command));
	}
	return taken;
}

/** New command: open the command editor, and add what it returns. */
export async function createCommand(app: App, host: CommandBuilderHost): Promise<boolean> {
	const draft = await new CommandEditorModal(app, host, {
		takenSignatures: takenSignatures(host),
	}).openAndWait();
	if (!draft) return false;
	await host.customCommands.add(draft);
	return true;
}

/** Edit `command` in the command editor. */
export async function editCommand(app: App, host: CommandBuilderHost, command: CustomCommand): Promise<boolean> {
	const draft = await new CommandEditorModal(app, host, {
		existing: command,
		takenSignatures: takenSignatures(host, command.id),
	}).openAndWait();
	if (!draft) return false;
	// Same identity, so the command is re-registered in place and whatever
	// hotkey the user bound to it survives the edit.
	await host.customCommands.update(command.id, draft);
	return true;
}

/** Delete `command` once the user confirms. */
export async function deleteCommand(app: App, host: CommandBuilderHost, command: CustomCommand): Promise<boolean> {
	const def = host.registry.get(command.calloutId);
	const name = def ? describeCommand(command, def) : t("commandBuilder.unknownCommand");
	const ok = await new ConfirmModal(
		app,
		t("confirm.titleDeleteCommand"),
		t("commandBuilder.deleteConfirm", { name }),
	).confirm();
	if (!ok) return false;
	await host.customCommands.remove(command.id);
	return true;
}

/** Whether every built-in command is on. */
export function allFixedCommandsEnabled(host: CommandBuilderHost): boolean {
	return FIXED_COMMAND_IDS.every((id) => isFixedCommandEnabled(host.settings, id));
}

/**
 * Turn every built-in command back on, through the path that registers each
 * one, so the command palette has them again at once. Obsidian offers no way
 * to clear the shortcuts a user bound, and turning a command back on keeps
 * them.
 */
export async function enableAllFixedCommands(host: CommandBuilderHost): Promise<void> {
	await Promise.all(FIXED_COMMAND_IDS
		.filter((id) => !isFixedCommandEnabled(host.settings, id))
		.map((id) => host.setFixedCommandEnabled(id, true)));
}
