/**
 * webPanel/siteActions.ts — the Publish to the web panel's buttons that lead
 * somewhere else: Digital Garden's and Quartz Syncer's Publication Center,
 * Obsidian Publish's **Publish changes**, a file in the system's file
 * manager, the site's note, a help page.
 *
 * Who calls it. `WebPanelView.ts`: once per drawing, to learn which of them
 * can run here (`actionsHere`), and on a press, to run one (`runAction`).
 * `webPanelCopy.ts` then words each step with a button where there is one,
 * and in words where there is not.
 *
 * The main idea. A step used to say "open the command palette and run
 * Digital Garden: Open Publication Center". A button that does it is
 * shorter, and cannot be mistyped. But each of these reaches something that
 * is not Callout Studio's own, so each is looked for each time the panel is
 * drawn, and offered only where it is there now. Where it is not, the step
 * says it in words, as before, and nothing is lost.
 *
 * - **Digital Garden**: the Digital Garden plugin's own `openGardenPlugins`,
 *   which is what its deep link `obsidian://digital-garden?open=plugins`
 *   (used by the forestry.md gallery) runs. It opens **Site → Plugins →
 *   Browse & install**, with the Callout Studio garden plugin selected once
 *   it is in the list; it also says so itself when no garden is connected. Its
 *   `activatePublicationCenter({ tab: "notes" })` opens the **Notes** tab.
 *   An older Digital Garden without them still has the command **Open
 *   Publication Center** (`digitalgarden:dg-open-publish-modal`), which opens
 *   the center where it was left; the step's words then say where to go.
 * - **Obsidian Publish**: the core plugin's **Publish changes** command
 *   (`publish:view-changes`), there while the core plugin is on.
 * - **Quartz Syncer**: its **Open Publication Center** command
 *   (`quartz-syncer:open-publish-modal`, read in its 2.2.0 source), on every
 *   platform. Enveloppe has no window to open: its step is words.
 * - **Show in Finder** (or the system's explorer): `app.showInFolder`, on a
 *   desktop only. publish.js and publish.css are not in Obsidian's file
 *   list, so this is the one way to see them from Obsidian.
 *   The vault's own folder (`VAULT_FOLDER`) can be shown too, as Obsidian's
 *   list of vaults does: the file manager then opens the folder that holds
 *   the vault, which is how the panel leads to a Quartz configuration file
 *   that is one level above it. That is as far as it goes. Read 2026-11-16
 *   in Obsidian 1.15.1: `showInFolder` returns at once anywhere but a
 *   desktop, both it and `openWithDefaultApp` refuse a path with `..` in it
 *   ("outside the vault"), and a phone or tablet has no way to open its
 *   Files app at a folder. So there the steps are words.
 * - **Open note**: `openWebNote.ts`, in Reading view beside the panel.
 * - **A help page**: in the browser, as every link out of Callout Studio.
 *
 * None of it is in Obsidian's typings (`app.commands`, `app.plugins`,
 * `app.showInFolder` and the Digital Garden plugin's methods), so each is
 * read through a type of its own and checked before it is called, as
 * `app.setting` is elsewhere (`settings/declarative/jumpToRow.ts`).
 */
import { Platform, type App } from "obsidian";
import { GARDEN_PLUGIN_ID } from "../manager/web/targets";
import { openWebNote } from "./openWebNote";

/** What a button on the panel does. */
export type PanelAction =
	/** Digital Garden's list of garden plugins, on Browse & install. */
	| { kind: "gardenPlugins" }
	/** Digital Garden's Publication Center, on its Notes tab. */
	| { kind: "gardenNotes" }
	/** Obsidian Publish's Publish changes. */
	| { kind: "publishChanges" }
	/** Quartz Syncer's Publication Center. */
	| { kind: "syncerCenter" }
	/** The file or folder at `path`, selected in the system's file manager; {@link VAULT_FOLDER} is the vault itself. */
	| { kind: "reveal"; path: string }
	/** The note at `path`, in a tab beside the panel. */
	| { kind: "openNote"; path: string }
	/** A page on the web, in the browser. */
	| { kind: "openPage"; href: string };

/** The vault's own folder, as `app.showInFolder` takes it. */
export const VAULT_FOLDER = "";

/** Which kinds of button can do their work in this Obsidian, now. */
export interface ActionsHere {
	/** Digital Garden is installed and on: its plugin object or its Publication Center command is there. */
	gardenInstalled: boolean;
	gardenPlugins: boolean;
	gardenNotes: boolean;
	publishChanges: boolean;
	/** Quartz Syncer is on: its Publication Center command is there. */
	syncerCenter: boolean;
	/** Whether a file can be shown in the system's file manager, and which one it is, for the button's words. */
	reveal: false | "finder" | "explorer";
}

/** None of them: what a test or a picture gets where it says nothing. */
export const NO_ACTIONS: ActionsHere = {
	// "Says nothing" must not tell anyone to install a plugin that may be there.
	gardenInstalled: true,
	gardenPlugins: false,
	gardenNotes: false,
	publishChanges: false,
	syncerCenter: false,
	reveal: false,
};

const GARDEN_PLUGIN = "digitalgarden";
const GARDEN_CENTER_COMMAND = "digitalgarden:dg-open-publish-modal";
const PUBLISH_CHANGES_COMMAND = "publish:view-changes";
const SYNCER_CENTER_COMMAND = "quartz-syncer:open-publish-modal";

/** The parts of Obsidian's `App` that are not in its typings. */
interface AppInternals {
	commands?: {
		findCommand?(id: string): unknown;
		executeCommandById?(id: string): boolean;
	};
	plugins?: { getPlugin?(id: string): unknown };
	showInFolder?(path: string): unknown;
}

/** The Digital Garden plugin, as far as the panel calls it. */
interface GardenPlugin {
	openGardenPlugins?(pluginId?: string): unknown;
	activatePublicationCenter?(target?: { tab: string }): unknown;
}

const internals = (app: App): AppInternals => app as unknown as AppInternals;

function gardenPlugin(app: App): GardenPlugin | null {
	const plugin = internals(app).plugins?.getPlugin?.(GARDEN_PLUGIN);
	return plugin && typeof plugin === "object" ? plugin : null;
}

/** Whether the command `id` is there: a plugin's commands go when it is turned off. */
function hasCommand(app: App, id: string): boolean {
	const commands = internals(app).commands;
	return typeof commands?.executeCommandById === "function" && Boolean(commands.findCommand?.(id));
}

function runCommand(app: App, id: string): boolean {
	return internals(app).commands?.executeCommandById?.(id) === true;
}

/** Which buttons can do their work here. Read once for each drawing of the panel. */
export function actionsHere(app: App): ActionsHere {
	try {
		const garden = gardenPlugin(app);
		const center = hasCommand(app, GARDEN_CENTER_COMMAND);
		return {
			gardenInstalled: garden !== null || center,
			gardenPlugins: typeof garden?.openGardenPlugins === "function",
			gardenNotes: typeof garden?.activatePublicationCenter === "function" || center,
			publishChanges: hasCommand(app, PUBLISH_CHANGES_COMMAND),
			syncerCenter: hasCommand(app, SYNCER_CENTER_COMMAND),
			reveal:
				Platform.isDesktopApp && typeof internals(app).showInFolder === "function"
					? Platform.isMacOS
						? "finder"
						: "explorer"
					: false,
		};
	} catch {
		return NO_ACTIONS;
	}
}

/**
 * Run `action`. Resolves to whether it ran; a button whose work went away
 * since the panel was drawn (a plugin turned off) does nothing, and the
 * caller says so. Never throws.
 */
export async function runAction(app: App, action: PanelAction): Promise<boolean> {
	try {
		switch (action.kind) {
			case "gardenPlugins": {
				const garden = gardenPlugin(app);
				if (typeof garden?.openGardenPlugins !== "function") return false;
				await garden.openGardenPlugins(GARDEN_PLUGIN_ID);
				return true;
			}
			case "gardenNotes": {
				const garden = gardenPlugin(app);
				if (typeof garden?.activatePublicationCenter === "function") {
					await garden.activatePublicationCenter({ tab: "notes" });
					return true;
				}
				return runCommand(app, GARDEN_CENTER_COMMAND);
			}
			case "publishChanges":
				return runCommand(app, PUBLISH_CHANGES_COMMAND);
			case "syncerCenter":
				return runCommand(app, SYNCER_CENTER_COMMAND);
			case "reveal": {
				const shown = internals(app);
				if (typeof shown.showInFolder !== "function") return false;
				await shown.showInFolder(action.path);
				return true;
			}
			case "openNote":
				await openWebNote(app, action.path);
				return true;
			case "openPage":
				window.open(action.href, "_blank", "noopener");
				return true;
		}
	} catch (e) {
		console.warn(`[CalloutStudio] the panel's ${action.kind} button failed`, e);
		return false;
	}
}
