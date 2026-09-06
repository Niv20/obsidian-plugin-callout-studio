import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pair, device } from "./support/syncReplicaHarness";
import { definition } from "./support/discoveryHarness";
import { isSettingsConflictFile } from "../src/manager/settingsConflictFiles";
import { canonical } from "../src/manager/syncTree";
const syncthing = "data.sync-conflict-20260906-120000-ABCDEFG.json";

describe("settings conflict files", () => {
	it("recognizes specific conflict patterns without mistaking backups and other plugin files for settings", () => {
		assert.equal(isSettingsConflictFile(syncthing), true);
		assert.equal(isSettingsConflictFile("data (Conflicted copy My Mac 202609061200).json"), true);
		for (const name of ["data.json", "data-notes.json", "data-backup.json", "data (2).json", "settings.sync-conflict-20260906-120000-ABCDEFG.json", "../data.json"]) assert.equal(isSettingsConflictFile(name), false);
	});
	it("merges an independently delivered conflict even when the main settings file has not changed", async () => {
		await pair(async (a, b) => {
			a.registry.add(definition({ id: "left", icon: { type: "lucide", value: "star" } }));
			b.registry.add(definition({ id: "right", icon: { type: "lucide", value: "star" } }));
			await Promise.all([a.host.saveSettings(), b.host.saveSettings()]);
			const right = await b.read(); await a.conflict(syncthing, right); await a.queue.run();
			assert.ok(a.registry.get("left")); assert.ok(a.registry.get("right"));
			const writes = a.writes; await a.queue.run(); await a.queue.run(); assert.equal(a.writes, writes);
			assert.equal(canonical(JSON.parse(await readFile(join(a.dir, syncthing), "utf8"))), canonical(right));
		});
	});
	it("finds a conflict file during a cold launch", async () => {
		await pair(async (a, b) => {
			b.registry.add(definition({ id: "conflict-only", icon: { type: "lucide", value: "star" } })); await b.host.saveSettings();
			a.close(); await a.conflict(syncthing, await b.read());
			const restarted = await device(a.dir);
			try { assert.ok(restarted.registry.get("conflict-only")); } finally { restarted.close(); }
		});
	});
	it("leaves malformed and unversioned copies untouched for manual recovery", async () => {
		await pair(async a => {
			await a.conflict(syncthing, { callouts: [{ id: "untrusted" }] });
			await a.conflict("data (Conflicted copy Mobile 202609061200).json", { callouts: [] });
			const before = canonical(a.registry.toSaveData()), writes = a.writes;
			await a.queue.run(); assert.equal(canonical(a.registry.toSaveData()), before); assert.equal(a.writes, writes);
			assert.ok(await readFile(join(a.dir, syncthing), "utf8"));
		});
	});
});
