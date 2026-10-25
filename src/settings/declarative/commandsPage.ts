/**
 * settings/declarative/commandsPage.ts — Commands and shortcuts, as a settings
 * page in place of its window (CommandBuilderModal.ts).
 *
 * Who calls it. The settings tab, for the main page's Menus and commands box
 * ({@link commandsPage}).
 *
 * The main idea. The page opens with a sentence about ⊕ (not on a phone,
 * where ⊕ is hidden), as Obsidian's own pages open with one
 * (`pageIntroBox`, rowParts.ts), then two of Obsidian's boxes, the user's own
 * commands first:
 * - **Your commands** is one of Obsidian's lists: a + that opens the command
 *   editor, Obsidian's ✕ (and the Delete key), which asks first, and a grey
 *   row while there is none. A row is the callout's icon, the command's name,
 *   its shortcuts, ⊕, and ✎. A command the theme has suspended (or whose
 *   callout is gone) says so under its name.
 * - **Built-in commands**: a row per built-in command with its shortcuts, ⊕
 *   and a switch; ↺ in the heading turns them all back on.
 * The shortcuts are drawn as Obsidian's Hotkeys page draws them, and ⊕ opens
 * that page on the command (hidden on a phone, as in Obsidian). A built-in
 * command switched off keeps its row as it is: only its shortcuts and ⊕ go,
 * since it has nothing to bind while it is off.
 *
 * Every change goes through the window's own flows (command/commandFlows.ts).
 * While saving is paused nothing changes: +, ✕ and ↺ say why, ✎ is dimmed and
 * says why, and the built-in rows are greyed.
 */
import { Platform } from "obsidian";
import { t } from "../../i18n";
import { FIXED_COMMAND_IDS, FIXED_COMMAND_NAME_KEYS, isFixedCommandEnabled, type FixedCommandId } from "../../editor/commands";
import { paintCalloutListIcon } from "../../manager/theme/calloutListIcon";
import type { CustomCommand } from "../../types";
import { addBlockableIconButton } from "../../ui/blockedButton";
import { isSuspendedByTheme, obsidianCommandId } from "../../utils/customCommands";
import {
	allFixedCommandsEnabled,
	commandName,
	createCommand,
	deleteCommand,
	editCommand,
	enableAllFixedCommands,
} from "../command/commandFlows";
import { addHotkeyExtraButton, addObsidianHotkeyChips } from "../command/hotkeyRow";
import { disabledWhilePaused, refuseWhilePaused } from "./pausedGuards";
import { boxResetButton, pageIntroBox, paintBoxReset, pausedReason } from "./rowParts";
import { guardRender } from "./safeTree";
import type { CsGroup, CsList, CsPage, CsRender, TreeContext } from "./types";

/** The ids of the page, its boxes and its opening sentence. */
export const COMMANDS_PAGE = {
	page: "commands",
	intro: "commands-intro",
	mine: "commands-mine",
	builtIn: "commands-builtin",
} as const;

/** The row that opens Commands and shortcuts, and the page. */
export function commandsPage(ctx: TreeContext): CsPage {
	return {
		type: "page",
		id: COMMANDS_PAGE.page,
		name: t("commandBuilder.title"),
		desc: t("settings.customCommandsDesc"),
		items: [
			// The sentence is about ⊕, which a phone hides as Obsidian hides its
			// own hotkey buttons there, so a phone leaves the sentence out too.
			...(Platform.isPhone ? [] : [pageIntroBox(COMMANDS_PAGE.intro, t("commandBuilder.pageDesc"))]),
			yourCommandsList(ctx),
			builtInCommandsBox(ctx),
		],
	};
}

/* ---- Your commands ---- */

/** The user's own commands, in the order they were made, with +, ✕ and a grey row while none. */
function yourCommandsList(ctx: TreeContext): CsList {
	const plugin = ctx.plugin;
	const writer = plugin.settingsWriter;
	const commands = plugin.customCommands.list();
	/** Draw the page again once a flow has changed something. */
	const redrawIf = (changed: boolean): void => { if (changed) ctx.display(); };
	return {
		type: "list",
		id: COMMANDS_PAGE.mine,
		heading: t("commandBuilder.yourCommands"),
		emptyState: t("commandBuilder.empty"),
		addItem: {
			name: t("commandBuilder.newCommand"),
			action: refuseWhilePaused(writer, () => { void createCommand(ctx.app, plugin).then(redrawIf); }),
		},
		// The rows are in the order of `commands`, so an index is a place in it.
		onDelete: refuseWhilePaused(writer, (index: number) => {
			const command = commands[index];
			if (command) void deleteCommand(ctx.app, plugin, command).then(redrawIf);
		}),
		items: commands.map((command) => customCommandRow(ctx, command, redrawIf)),
	};
}

/** One of the user's commands: its callout's icon, its name, shortcuts, ⊕ and ✎. */
function customCommandRow(ctx: TreeContext, command: CustomCommand, redrawIf: (changed: boolean) => void): CsRender {
	const plugin = ctx.plugin;
	const def = plugin.registry.get(command.calloutId);
	const name = commandName(command, def);
	// Said under the name: otherwise the command just stops appearing in the
	// command palette while it still sits in this list.
	const paused = !def || isSuspendedByTheme(plugin.registry, command);
	return {
		id: `command-${command.id}`,
		name,
		desc: paused ? t(def ? "commandBuilder.commandSuspended" : "commandBuilder.missingCallout") : undefined,
		render: guardRender(name, (setting) => {
			// First in the row, where a list row's icon goes; drawn at the end and
			// moved to the front, because `createDiv` always appends.
			const rowEl = setting.settingEl;
			const iconEl = rowEl.createDiv({ cls: "callout-studio-row-icon" });
			rowEl.insertBefore(iconEl, rowEl.firstChild);
			// The icon the reader sees beside the callout, the theme's one too.
			if (def) paintCalloutListIcon(iconEl, def, plugin.registry, activeDocument.body.hasClass("theme-dark"));
			addObsidianHotkeyChips(ctx.app, plugin.manifest.id, setting.controlEl, obsidianCommandId(command.id));
			addHotkeyExtraButton(setting, ctx.app, plugin.manifest.name, name);
			addBlockableIconButton(setting, {
				icon: "pencil",
				label: t("commandBuilder.editAria", { name }),
				blockedReason: () => pausedReason(plugin.settingsWriter),
				onClick: () => { void editCommand(ctx.app, plugin, command).then(redrawIf); },
			});
			// The icon sits outside the controls, which a redraw empties, so the
			// row's cleanup takes it away before the next draw.
			return () => iconEl.remove();
		}),
	};
}

/* ---- Built-in commands ---- */

/** The built-in commands, each with a switch; ↺ in the heading turns them all on. */
function builtInCommandsBox(ctx: TreeContext): CsGroup {
	const heading = t("commandBuilder.builtIn");
	return {
		type: "group",
		id: COMMANDS_PAGE.builtIn,
		heading,
		extraButtons: [boxResetButton(ctx.plugin.settingsWriter, heading, () => {
			void enableAllFixedCommands(ctx.plugin).then(() => ctx.display());
		})],
		items: FIXED_COMMAND_IDS.map((id) => fixedCommandRow(ctx, id)),
	};
}

/** One built-in command: its name, its shortcuts and ⊕ while it is on, and a switch. */
function fixedCommandRow(ctx: TreeContext, id: FixedCommandId): CsRender {
	const plugin = ctx.plugin;
	const name = t(FIXED_COMMAND_NAME_KEYS[id]);
	return {
		id: `command-${id}`,
		name,
		disabled: disabledWhilePaused(plugin.settingsWriter),
		render: guardRender(name, (setting, group) => {
			const enabled = isFixedCommandEnabled(plugin.settings, id);
			if (enabled) {
				addObsidianHotkeyChips(ctx.app, plugin.manifest.id, setting.controlEl, id);
				addHotkeyExtraButton(setting, ctx.app, plugin.manifest.name, name);
			}
			setting.addToggle((toggle) => {
				toggle
					.setValue(enabled)
					.setTooltip(t("commandBuilder.toggleAria", { name }))
					.onChange(async (value) => {
						// Registers or unregisters the command, then saves.
						await plugin.setFixedCommandEnabled(id, value);
						ctx.display();
					});
			});
			paintBoxReset(group, !allFixedCommandsEnabled(plugin));
		}),
	};
}
