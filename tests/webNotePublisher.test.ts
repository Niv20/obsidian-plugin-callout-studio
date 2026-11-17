/**
 * tests/webNotePublisher.test.ts — the plugin that publishes a Quartz site's
 * notes (`src/manager/web/notePublisher.ts`), and the properties a new Quartz
 * note is created with for it (`src/web/static/quartzNote.ts`).
 *
 * Quartz Syncer and Enveloppe are read from their own settings files in the
 * vault's configuration folder, with the field names and defaults their
 * sources have (Quartz Syncer 2.2.0, Enveloppe 7.8.2, read 2026-11-17). What
 * is checked here is that reading: which plugin, which property, which
 * folders — and that a plugin that is switched off, or settings that cannot
 * be read, never make the panel ask for something wrong.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import {
	ENVELOPPE_PLUGIN_ID,
	publishesFrom,
	readNotePublisher,
	type NotePublisher,
} from "../src/manager/web/notePublisher";
import { QUARTZ_NOTE_KEY, newQuartzNoteFrontmatter } from "../src/web/static/quartzNote";

const SYNCER = "quartz-syncer";

/** A vault with these community plugins switched on, and these files in it. */
function vault(enabled: string[], files: Record<string, string> = {}): App {
	const all = new Map(Object.entries(files));
	all.set(".obsidian/community-plugins.json", JSON.stringify(enabled));
	return {
		vault: {
			configDir: ".obsidian",
			adapter: {
				exists: (path: string) => Promise.resolve(all.has(path)),
				read: (path: string) => Promise.resolve(all.get(path) ?? ""),
			},
		},
	} as unknown as App;
}

const settings = (id: string, value: unknown): Record<string, string> => ({
	[`.obsidian/plugins/${id}/data.json`]: typeof value === "string" ? value : JSON.stringify(value),
});

describe("the plugin that publishes a Quartz site's notes", () => {
	it("is none where neither Quartz Syncer nor Enveloppe is switched on", async () => {
		assert.equal(await readNotePublisher(vault([])), null);
		assert.equal(await readNotePublisher(vault(["dataview"], settings(SYNCER, { vaultPath: "Public" }))), null);
	});

	it("is Quartz Syncer with its defaults where it has saved no settings, or settings that cannot be read", async () => {
		const defaults: NotePublisher = { id: "quartzSyncer", key: "publish", folder: "", excluded: [] };
		assert.deepEqual(await readNotePublisher(vault([SYNCER])), defaults);
		assert.deepEqual(await readNotePublisher(vault([SYNCER], settings(SYNCER, "{ not json"))), defaults);
		assert.deepEqual(await readNotePublisher(vault([SYNCER], settings(SYNCER, { vaultPath: "/" }))), defaults);
	});

	it("reads Quartz Syncer's property and the folder it publishes from", async () => {
		const app = vault(
			[SYNCER],
			settings(SYNCER, { publishFrontmatterKey: "share-me", vaultPath: "/Public/Site/" }),
		);
		assert.deepEqual(await readNotePublisher(app), {
			id: "quartzSyncer",
			key: "share-me",
			folder: "Public/Site",
			excluded: [],
		});
	});

	it("needs no property where Quartz Syncer publishes every note", async () => {
		const app = vault([SYNCER], settings(SYNCER, { allNotesPublishableByDefault: true }));
		assert.equal((await readNotePublisher(app))?.key, null);
	});

	it("reads Enveloppe's property and the folders it leaves out, patterns aside", async () => {
		const app = vault(
			[ENVELOPPE_PLUGIN_ID],
			settings(ENVELOPPE_PLUGIN_ID, {
				plugin: { shareKey: "web", excludedFolder: ["Private/", "/^tmp/i", "Drafts", 3] },
			}),
		);
		assert.deepEqual(await readNotePublisher(app), {
			id: "enveloppe",
			key: "web",
			folder: "",
			excluded: ["Private", "Drafts"],
		});
		const defaults = await readNotePublisher(vault([ENVELOPPE_PLUGIN_ID]));
		assert.deepEqual(defaults, { id: "enveloppe", key: "share", folder: "", excluded: [] });
		const all = vault(
			[ENVELOPPE_PLUGIN_ID],
			settings(ENVELOPPE_PLUGIN_ID, { plugin: { shareAll: { enable: true } } }),
		);
		assert.equal((await readNotePublisher(all))?.key, null, "it shares every note");
	});

	it("is Quartz Syncer where both are on: it is the one made for Quartz", async () => {
		assert.equal((await readNotePublisher(vault([ENVELOPPE_PLUGIN_ID, SYNCER])))?.id, "quartzSyncer");
	});

	it("publishes a note inside its folder, and none in a folder it leaves out", () => {
		const syncer: NotePublisher = { id: "quartzSyncer", key: "publish", folder: "Public", excluded: [] };
		assert.equal(publishesFrom(syncer, "Public/callout-studio-quartz.md"), true);
		assert.equal(publishesFrom(syncer, "Public/deep/callout-studio-quartz.md"), true);
		assert.equal(publishesFrom(syncer, "callout-studio-quartz.md"), false);
		assert.equal(publishesFrom(syncer, "Publicity/callout-studio-quartz.md"), false, "a folder, not a prefix");
		const envelope: NotePublisher = { id: "enveloppe", key: "share", folder: "", excluded: ["Private"] };
		assert.equal(publishesFrom(envelope, "callout-studio-quartz.md"), true);
		assert.equal(publishesFrom(envelope, "Private/callout-studio-quartz.md"), false);
	});
});

describe("a new Quartz note's properties", () => {
	it("are a draft and the note's own property, and the publishing plugin's property where there is one", () => {
		assert.equal(newQuartzNoteFrontmatter(), `---\ndraft: true\n${QUARTZ_NOTE_KEY}: 1\n---\n`);
		assert.equal(
			newQuartzNoteFrontmatter(["publish"]),
			`---\ndraft: true\npublish: true\n${QUARTZ_NOTE_KEY}: 1\n---\n`,
		);
	});

	it("never repeat a property, never undo the draft, and quote a name YAML would misread", () => {
		const text = newQuartzNoteFrontmatter(["share", "share", "draft", QUARTZ_NOTE_KEY, "my key", ""]);
		assert.equal(text, `---\ndraft: true\nshare: true\n"my key": true\n${QUARTZ_NOTE_KEY}: 1\n---\n`);
	});
});
