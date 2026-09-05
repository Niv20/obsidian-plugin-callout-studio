import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { backUpBeforeAdoption, settingsWouldDiscardRows } from "../src/manager/settingsConflictBackup";
import { definition } from "./support/discoveryHarness";
import { writeSettingsBackup } from "../src/manager/settingsBackup";

function fixture() {
	const registry = new CalloutRegistry(); registry.load(null);
	registry.add(definition({ id: "local" }));
	const current = registry.toSaveData();
	const files = new Map<string, string>();
	let fail = false;
	const host = { manifest: { id: "callout-studio", dir: ".obsidian/plugins/callout-studio" } as PluginManifest,
		app: { vault: { adapter: {
			exists: () => Promise.resolve(true),
			write: (path: string, text: string) => { if (fail) return Promise.reject(new Error("disk full")); files.set(path, text); return Promise.resolve(); },
			list: () => Promise.resolve({ files: [...files.keys()], folders: [] }),
			remove: (path: string) => { files.delete(path); return Promise.resolve(); },
		} } } as unknown as App };
	return { current, files, host, fail: () => { fail = true; } };
}

describe("conflicting device settings retain a recovery copy", () => {
	it("detects different ids with the same row count", async () => {
		const h = fixture(); const remote = { ...h.current, callouts: [definition({ id: "remote" })] };
		assert.equal(settingsWouldDiscardRows(h.current, remote), true);
		assert.equal(await backUpBeforeAdoption(h.host, h.current, remote), true);
		assert.equal(h.files.size, 1);
		assert.deepEqual(JSON.parse([...h.files.values()][0]!), JSON.parse(JSON.stringify(h.current)));
	});
	it("detects an edit to the same id, even when the other device adds more rows", () => {
		const h = fixture();
		assert.equal(settingsWouldDiscardRows(h.current, { callouts: [definition({ id: "local", displayName: "remote edit" }), definition({ id: "new" })] }), true);
	});
	it("does not back up a strictly additive update with identical existing rows", async () => {
		const h = fixture(); const incoming = { callouts: [...h.current.callouts, definition({ id: "new" })] };
		assert.equal(await backUpBeforeAdoption(h.host, h.current, incoming), true);
		assert.equal(h.files.size, 0);
	});
	it("blocks adoption when a required recovery copy cannot be written", async () => {
		const h = fixture(); h.fail();
		assert.equal(await backUpBeforeAdoption(h.host, h.current, { callouts: [] }), false);
	});
	it("two devices backing up at the same instant cannot overwrite one another", async () => {
		const h = fixture(); const time = new Date("2026-09-06T10:00:00Z");
		const a = await writeSettingsBackup(h.host, { from: "A" }, time);
		const b = await writeSettingsBackup(h.host, { from: "B" }, time);
		assert.notEqual(a, b); assert.equal(h.files.size, 2);
	});
	it("backs up settings-only edits even when all callout rows remain identical", async () => {
		const h = fixture();
		h.current.settings.disabledFixedCommands = ["wrap-selection"];
		const incoming = { ...h.current, settings: { ...h.current.settings, disabledFixedCommands: [] } };
		assert.equal(settingsWouldDiscardRows(h.current, incoming), false);
		assert.equal(await backUpBeforeAdoption(h.host, h.current, incoming), true);
		assert.equal(h.files.size, 1);
		const saved = JSON.parse([...h.files.values()][0]!) as { settings: { disabledFixedCommands: string[] } };
		assert.deepEqual(saved.settings.disabledFixedCommands, ["wrap-selection"]);
	});
});
