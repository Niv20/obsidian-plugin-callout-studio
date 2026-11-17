/**
 * manager/web/notePublisher.ts — the plugin that publishes the user's notes to
 * their Quartz site, where one does.
 *
 * Who calls it. The Publish to the web panel (`webPanel/`) and the writer
 * (`writeTarget.ts`), for Quartz.
 *
 * The main idea. Most Quartz sites are built from the vault itself, and the
 * Quartz note (`web/static/quartzNote.ts`) reaches the build with every other
 * note. Some users publish with a plugin that copies only the notes they
 * chose; the two with many users are Quartz Syncer (made for Quartz, about
 * 14,000 downloads in 2026-11) and Enveloppe (any static site, about 78,000).
 * Where one of them is switched on, the note needs what that plugin publishes
 * a note by — a property set to `true` — and must sit where it publishes from,
 * and the panel has one more step: publish the note. The others (Pressroom,
 * Private Quartz Publish, GitHub Publish) have few users and work
 * differently; the panel names none of them, and a line under the note's
 * step says what to do with any such plugin.
 *
 * Read from each plugin's own settings file in the vault's configuration
 * folder, which is where Obsidian keeps them on every device: nothing outside
 * the vault, nothing over the network, and the plugin need not be running.
 * Field names and defaults are each plugin's own, read from its source:
 *
 * | plugin        | id                           | property (default)                  | folder                  |
 * | ------------- | ---------------------------- | ----------------------------------- | ----------------------- |
 * | Quartz Syncer | `quartz-syncer`              | `publishFrontmatterKey` (`publish`) | `vaultPath` (`/`)       |
 * | Enveloppe     | `obsidian-mkdocs-publisher`  | `plugin.shareKey` (`share`)         | `plugin.excludedFolder` |
 *
 * Quartz Syncer's `allNotesPublishableByDefault` and Enveloppe's
 * `plugin.shareAll.enable` publish every note, and then no property is needed.
 *
 * Nothing here writes, and nothing throws.
 */
import { normalizePath, type App } from "obsidian";
import { enabledCommunityPlugins, QUARTZ_SYNCER_PLUGIN_ID } from "./detectService";

export const ENVELOPPE_PLUGIN_ID = "obsidian-mkdocs-publisher";

export type NotePublisherId = "quartzSyncer" | "enveloppe";

export interface NotePublisher {
	id: NotePublisherId;
	/** The property it publishes a note by, set to `true` on a new note; `null` where it publishes every note. */
	key: string | null;
	/** The folder it publishes from, from the top of the vault; `""` for the whole vault. */
	folder: string;
	/** Folders it never publishes from. */
	excluded: readonly string[];
}

type Settings = Record<string, unknown>;

const asObject = (value: unknown): Settings | null =>
	value && typeof value === "object" && !Array.isArray(value) ? (value as Settings) : null;

const asText = (value: unknown, fallback: string): string =>
	typeof value === "string" && value.trim() ? value.trim() : fallback;

/** A folder setting as a vault path: no slash at either end, `""` for the top. */
const folderOf = (value: unknown): string => {
	const text = typeof value === "string" ? value.trim().replace(/^\/+|\/+$/g, "") : "";
	return text ? normalizePath(text) : "";
};

async function readSettings(app: App, id: string): Promise<Settings> {
	try {
		const path = `${app.vault.configDir}/plugins/${id}/data.json`;
		if (!(await app.vault.adapter.exists(path))) return {};
		return asObject(JSON.parse(await app.vault.adapter.read(path))) ?? {};
	} catch {
		// Unreadable settings are the plugin's defaults, which is what it runs with too.
		return {};
	}
}

function quartzSyncer(settings: Settings): NotePublisher {
	return {
		id: "quartzSyncer",
		key: settings.allNotesPublishableByDefault === true ? null : asText(settings.publishFrontmatterKey, "publish"),
		folder: folderOf(settings.vaultPath),
		excluded: [],
	};
}

function enveloppe(settings: Settings): NotePublisher {
	const plugin = asObject(settings.plugin) ?? {};
	const shareAll = asObject(plugin.shareAll);
	const excluded = Array.isArray(plugin.excludedFolder) ? plugin.excludedFolder : [];
	return {
		id: "enveloppe",
		key: shareAll?.enable === true ? null : asText(plugin.shareKey, "share"),
		folder: "",
		// A `/…/` entry is a pattern, which a path cannot be checked against here.
		excluded: excluded
			.filter((entry): entry is string => typeof entry === "string" && !/^\/.*\/[a-z]*$/.test(entry.trim()))
			.map(folderOf)
			.filter(Boolean),
	};
}

/** The plugin that publishes this vault's notes, Quartz Syncer first; `null` where neither is on. */
export async function readNotePublisher(app: App): Promise<NotePublisher | null> {
	const enabled = await enabledCommunityPlugins(app);
	if (enabled.has(QUARTZ_SYNCER_PLUGIN_ID)) return quartzSyncer(await readSettings(app, QUARTZ_SYNCER_PLUGIN_ID));
	if (enabled.has(ENVELOPPE_PLUGIN_ID)) return enveloppe(await readSettings(app, ENVELOPPE_PLUGIN_ID));
	return null;
}

const within = (path: string, folder: string): boolean => folder === "" || path.startsWith(`${folder}/`);

/** Whether `publisher` publishes a note at `path`: inside its folder, and in none it leaves out. */
export const publishesFrom = (publisher: NotePublisher, path: string): boolean =>
	within(path, publisher.folder) && !publisher.excluded.some((folder) => within(path, folder));
