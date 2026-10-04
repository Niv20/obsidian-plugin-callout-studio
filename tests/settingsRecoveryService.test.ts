/**
 * Getting settings back without touching a file by hand.
 *
 * Restoring an earlier setup is an edit every device accepts, not a file-level
 * rollback that running devices merge straight back over. An unreadable file
 * can be replaced from the app, after an exact copy of it is kept. A recovery
 * copy that cannot be read can be discarded from the app, after the same.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SettingsRecoveryService, type RecoverySource } from "../src/manager/settingsRecoveryService";
import { SettingsSync } from "../src/manager/settingsSync";
import { canonical, content } from "../src/manager/syncTree";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { PluginData } from "../src/types";
import { definition } from "./support/discoveryHarness";
import { recoveryActionHarness } from "./support/recoveryActionHarness";
import { pair } from "./support/syncReplicaHarness";

const DIR = ".obsidian/plugins/callout-studio";
const star = { type: "lucide" as const, value: "star" };

function ids(data: unknown): string[] {
	return ((content(data) as Partial<PluginData>).callouts ?? []).map(row => row.id).sort();
}

describe("restoring an earlier setup", () => {
	it("sticks on a device that saw the newer setup, and keeps what it did not see", async () => {
		await pair(async (a, b) => {
			const before = a.registry.toSaveData();
			a.registry.add(definition({ id: "added-later", icon: star }));
			await a.host.saveSettings();
			await b.deliver(await a.read());
			assert.ok(b.registry.get("added-later"));
			b.registry.add(definition({ id: "made-on-b", icon: star }));
			await b.host.saveSettings();

			assert.equal(await new SettingsRecoveryService(a.host).restore(before), "restored");
			assert.equal(a.registry.get("added-later"), undefined);
			await b.deliver(await a.read());
			assert.equal(b.registry.get("added-later"), undefined, "the other device merged the old row back");
			assert.ok(b.registry.get("made-on-b"), "an edit the restore never saw was lost");
			await a.deliver(await b.read());
			assert.deepEqual(ids(await a.read()), ids(await b.read()));
		});
	});

	it("saves a verified backup of the current setup first", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const before = h.host.registry.toSaveData();
		h.host.registry.add(definition({ id: "current", icon: star }));
		await h.host.saveSettings();
		assert.equal(await new SettingsRecoveryService(h.host).restore(before), "restored");
		const backups = [...h.files.entries()].filter(([path]) => path.includes("/backups/data-"));
		assert.equal(backups.length, 1);
		assert.ok(ids(JSON.parse(backups[0]![1])).includes("current"));
		assert.ok(!ids(JSON.parse(h.state.disk!)).includes("current"));
		h.host.settingsWriter.destroy();
	});

	it("restores nothing while saving is paused, or when no backup can be saved", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const service = new SettingsRecoveryService(h.host);
		const old = { callouts: [definition({ id: "old", icon: star })] };
		h.state.failBackup = true;
		const error = console.error; console.error = () => {};
		try { assert.equal(await service.restore(old), "backup"); } finally { console.error = error; }
		h.state.failBackup = false;
		h.host.settingsWriter.freeze("unreadable");
		assert.equal(await service.restore(old), "paused");
		assert.equal(h.host.registry.get("old"), undefined);
		h.host.settingsWriter.destroy();
	});

	it("refuses what is not settings this build can read", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const service = new SettingsRecoveryService(h.host);
		assert.equal(await service.restore({ version: 99, callouts: "new shape" } as unknown as PluginData), "invalid");
		assert.equal(await service.restore({ callouts: [definition({ id: "a" }), definition({ id: "a" })] }), "invalid");
		h.host.settingsWriter.destroy();
	});
});

describe("deleting an earlier setup", () => {
	it("forgets a history entry through the writer, by its hash", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const service = new SettingsRecoveryService(h.host);
		const deleted: string[] = [];
		h.host.settingsWriter.deleteHistoryEntry = async (hash: string) => { deleted.push(hash); };
		const source: RecoverySource = { kind: "history", time: 1, path: null, historyHash: "abc123", origin: "this-device", data: null };
		assert.equal(await service.remove(source), true);
		assert.deepEqual(deleted, ["abc123"]);
		h.host.settingsWriter.destroy();
	});

	it("removes the file itself for a backup or a stray copy, the same primitive automatic pruning uses", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const service = new SettingsRecoveryService(h.host);
		const path = `${DIR}/backups/data-x.json`;
		h.files.set(path, "{}");
		const source: RecoverySource = { kind: "backup", time: 1, path, historyHash: null, origin: "this-device", data: null };
		assert.equal(await service.remove(source), true);
		assert.equal(h.files.has(path), false);
		h.host.settingsWriter.destroy();
	});

	it("refuses a history entry without a hash, and reports a failed removal instead of throwing", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const service = new SettingsRecoveryService(h.host);
		assert.equal(await service.remove({ kind: "history", time: 1, path: null, historyHash: null, origin: "this-device", data: null }), false);
		const error = console.error; console.error = () => {};
		try {
			h.host.app.vault.adapter.remove = () => Promise.reject(new Error("Disk full"));
			assert.equal(await service.remove({ kind: "copy", time: null, path: `${DIR}/data 2.json`, historyHash: null, origin: null, data: null }), false);
		} finally { console.error = error; }
		h.host.settingsWriter.destroy();
	});
});

describe("listing earlier setups", () => {
	it("finds backups from this device, another device and an older version, and stray copies of the file", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const service = new SettingsRecoveryService(h.host);
		const setup = (id: string) => JSON.stringify({ callouts: [definition({ id, icon: star })] });
		const mine = h.host.localState.deviceId;
		h.files.set(`${DIR}/backups/data-2026-09-01T10-00-00-000Z-${mine}-0123456789abcdef.json`, setup("mine"));
		h.files.set(`${DIR}/backups/data-2026-09-02T10-00-00-000Z-phone001-0123456789abcdef.json`, setup("phone"));
		h.files.set(`${DIR}/backups/data-2026-08-01T10-00-00-000Z-4c6ac6e0-4032-4541-9446-9a06b9655ab3.json`, setup("older"));
		h.files.set(`${DIR}/data 2.json`, setup("icloud-copy"));
		h.files.set(`${DIR}/data (conflicted copy).json`, "{ truncated");
		const sources = await service.listSources();
		const backups = sources.filter(source => source.kind === "backup");
		assert.deepEqual(backups.map(source => source.origin), ["other-device", "this-device", "older-version"]);
		assert.deepEqual(backups.map(source => ids(source.data)), [["phone"], ["mine"], ["older"]]);
		const copies = sources.filter(source => source.kind === "copy");
		assert.deepEqual(copies.map(source => source.path?.slice(DIR.length + 1)), ["data (conflicted copy).json", "data 2.json"]);
		assert.equal(copies[0]!.data, null, "an unreadable copy is listed, not offered");
		assert.ok(ids(copies[1]!.data).includes("icloud-copy"));
		h.host.settingsWriter.destroy();
	});

	it("lists sources that cannot be restored without accepting invalid or newer data", async () => {
		const h = recoveryActionHarness(); await h.boot();
		try {
			const history = { callouts: [definition({ id: "history", icon: star })], extra: { preserved: [1, 2, 3] } };
			h.host.settingsWriter.historyEntries = async () => [{ hash: "one", savedAt: 123, bytes: 100, data: history }];
			const raw = '  { "callouts": [], "calloutStudioSync": { "version": 2 }, "extra": "complete" }\n';
			const backup = `${DIR}/backups/data-2026-09-01T10-00-00-000Z-phone001-0123456789abcdef.json`;
			const newer = '{\n "version": 99, "callouts": "future shape", "unknown": [1, 2, 3]\n}\n';
			const cases = new Map([
				[backup, raw], [`${DIR}/data newer.json`, newer], [`${DIR}/data broken.json`, "{ truncated"],
				[`${DIR}/data invalid.json`, '{"callouts":[{"id":"missing-fields"}]}'], [`${DIR}/data empty.json`, ""],
			]);
			for (const [path, text] of cases) h.files.set(path, text);
			const unavailable = `${DIR}/data unavailable.json`;
			h.files.set(unavailable, "inaccessible");
			const read = h.host.app.vault.adapter.read.bind(h.host.app.vault.adapter);
			h.host.app.vault.adapter.read = path => path === unavailable ? Promise.reject(new Error("Offline")) : read(path);
			const sources = await new SettingsRecoveryService(h.host).listSources();
			assert.ok(sources[0]!.data?.callouts?.some(row => row.id === "history"));
			for (const path of cases.keys()) {
				const entry = sources.find(source => source.path === path);
				assert.ok(entry, `missing ${path}`);
				if (path !== backup) assert.equal(entry.data, null, `${path} cannot be restored`);
			}
			const unread = sources.find(source => source.path === unavailable);
			assert.equal(unread?.data, null);
		} finally { h.host.settingsWriter.destroy(); }
	});

	it("says how far each setup is from now", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const service = new SettingsRecoveryService(h.host);
		assert.equal(service.difference(h.host.registry.toSaveData()).changed, 0);
		const other = new CalloutRegistry(); other.load(null);
		other.add(definition({ id: "extra", icon: star }));
		other.settings.globalStyle.borderRadius = 12;
		assert.equal(service.difference(other.toSaveData()).changed, 2);
		h.host.settingsWriter.destroy();
	});
});

describe("versions: one row per setup, wherever its copies are", () => {
	const labelsOf = (h: ReturnType<typeof recoveryActionHarness>) =>
		JSON.parse(h.files.get(`${DIR}/backups/labels-${h.host.localState.deviceId}.json`) ?? "{}") as {
			reasons?: Record<string, string>;
		};

	it("lists a setup kept on this device and in the vault once, named by why the vault kept it", async () => {
		const h = recoveryActionHarness(); await h.boot();
		try {
			const service = new SettingsRecoveryService(h.host);
			const setup = { callouts: [definition({ id: "both", icon: star })] };
			h.host.settingsWriter.historyEntries = async () => [{ hash: "1111111111111111", savedAt: 200, bytes: 1, data: setup, reason: "edit" }];
			const backup = `${DIR}/backups/data-2026-09-01T10-00-00-000Z-phone001-0123456789abcdef.json`;
			h.files.set(backup, JSON.stringify(setup));
			h.files.set(`${DIR}/backups/labels-phone001.json`, JSON.stringify({ reasons: { [backup.slice(backup.lastIndexOf("/") + 1)]: "before-import" } }));
			const versions = (await service.listVersions()).filter(version => ids(version.data).includes("both"));
			assert.equal(versions.length, 1);
			assert.deepEqual(versions[0]!.copies.map(copy => copy.kind), ["backup", "history"]);
			assert.deepEqual(versions[0]!.copies.map(copy => copy.reason), ["before-import", "edit"]);
			assert.deepEqual(versions[0]!.reason, { kind: "backup", reason: "before-import" });
		} finally { h.host.settingsWriter.destroy(); }
	});

	it("dates a sync service's copy by when its file last changed, when the vault can say", async () => {
		const h = recoveryActionHarness(); await h.boot();
		try {
			h.files.set(`${DIR}/data 2.json`, JSON.stringify({ callouts: [] }));
			const adapter = h.host.app.vault.adapter as unknown as { stat(path: string): Promise<{ mtime: number } | null> };
			adapter.stat = path => Promise.resolve(path.endsWith("data 2.json") ? { mtime: 1_700_000_000_000 } : null);
			const copy = (await new SettingsRecoveryService(h.host).listSources()).find(source => source.kind === "copy");
			assert.equal(copy?.time, 1_700_000_000_000);
		} finally { h.host.settingsWriter.destroy(); }
	});

	it("deletes every copy of a version and forgets why the backup was kept", async () => {
		const h = recoveryActionHarness(); await h.boot();
		try {
			const service = new SettingsRecoveryService(h.host);
			const setup = { callouts: [definition({ id: "gone", icon: star })] };
			const deleted: string[] = [];
			h.host.settingsWriter.historyEntries = async () => deleted.length ? [] : [{ hash: "1111111111111111", savedAt: 200, bytes: 1, data: setup }];
			h.host.settingsWriter.deleteHistoryEntry = async (hash: string) => { deleted.push(hash); };
			const mine = h.host.localState.deviceId;
			const backup = `${DIR}/backups/data-2026-09-01T10-00-00-000Z-${mine}-0123456789abcdef.json`;
			h.files.set(backup, JSON.stringify(setup));
			h.files.set(`${DIR}/data 2.json`, JSON.stringify(setup));
			const find = async () => (await service.listVersions()).find(candidate => ids(candidate.data).includes("gone"))!;
			h.files.set(`${DIR}/backups/labels-${mine}.json`, JSON.stringify({
				reasons: { [backup.slice(backup.lastIndexOf("/") + 1)]: "before-reset" },
			}));
			const version = await find();
			assert.equal(version.copies.length, 3);
			assert.equal(await service.removeVersion(version), true);
			assert.deepEqual(deleted, ["1111111111111111"]);
			assert.ok(!h.files.has(backup));
			assert.ok(!h.files.has(`${DIR}/data 2.json`));
			assert.deepEqual(labelsOf(h).reasons, {});
			assert.equal((await service.listVersions()).filter(candidate => ids(candidate.data).includes("gone")).length, 0);
		} finally { h.host.settingsWriter.destroy(); }
	});

	it("reports a version as not fully deleted when one copy stayed", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const error = console.error; console.error = () => {};
		try {
			const service = new SettingsRecoveryService(h.host);
			const setup = { callouts: [definition({ id: "stuck", icon: star })] };
			h.host.settingsWriter.historyEntries = async () => [{ hash: "1111111111111111", savedAt: 200, bytes: 1, data: setup }];
			h.host.settingsWriter.deleteHistoryEntry = () => Promise.reject(new Error("Storage busy"));
			h.files.set(`${DIR}/data 2.json`, JSON.stringify(setup));
			const version = (await service.listVersions()).find(candidate => ids(candidate.data).includes("stuck"))!;
			assert.equal(await service.removeVersion(version), false);
			assert.ok(!h.files.has(`${DIR}/data 2.json`), "what could go, went");
		} finally { console.error = error; h.host.settingsWriter.destroy(); }
	});

	it("records Restore in the history as a restore, and its backup as taken before one", async () => {
		const h = recoveryActionHarness(); await h.boot();
		try {
			const before = h.host.registry.toSaveData();
			h.host.registry.add(definition({ id: "current", icon: star }));
			await h.host.saveSettings();
			assert.equal(await new SettingsRecoveryService(h.host).restore(before), "restored");
			assert.deepEqual(Object.values(labelsOf(h).reasons ?? {}), ["before-restore"]);
		} finally { h.host.settingsWriter.destroy(); }
	});
});

describe("replacing an unreadable settings file", () => {
	it("keeps an exact copy, then replaces a damaged file with the setup shown", async () => {
		const h = recoveryActionHarness();
		h.state.checkpoint = { callouts: [definition({ id: "remembered", icon: star })] };
		h.state.disk = '{"callouts": [';
		await h.boot();
		assert.equal(h.host.settingsWriter.status.frozenReason, "unreadable");
		assert.equal(await new SettingsRecoveryService(h.host).replaceUnreadable(), true);
		const copies = [...h.files.entries()].filter(([path]) => path.includes("/backups/unreadable-"));
		assert.deepEqual(copies.map(([, text]) => text), ['{"callouts": ['], "the damaged bytes were not kept exactly");
		assert.ok(ids(JSON.parse(h.state.disk ?? "null")).includes("remembered"));
		assert.equal(h.host.settingsWriter.isFrozen, false);
		h.host.settingsWriter.destroy();
	});

	it("keeps the settings inside a file whose sync metadata a sync service broke", async () => {
		const h = recoveryActionHarness();
		const registry = new CalloutRegistry(); registry.load(null);
		registry.add(definition({ id: "inside-the-file", icon: star }));
		const stamped = new SettingsSync("elsewhere").prepare(registry.toSaveData()) as Record<string, unknown>;
		h.state.disk = JSON.stringify({ ...stamped, callouts: [...(stamped.callouts as unknown[]), definition({ id: "merged-in", icon: star })] });
		await h.boot();
		assert.equal(h.host.settingsWriter.status.frozenReason, "unreadable");
		assert.equal(await new SettingsRecoveryService(h.host).replaceUnreadable(), true);
		const saved = ids(JSON.parse(h.state.disk ?? "null"));
		assert.ok(saved.includes("inside-the-file") && saved.includes("merged-in"));
		h.host.settingsWriter.destroy();
	});

	it("leaves a file alone that changed after the user decided", async () => {
		const h = recoveryActionHarness();
		h.state.disk = "";
		await h.boot();
		const arrived = JSON.stringify({ callouts: [definition({ id: "arrived", icon: star })] });
		const write = h.host.app.vault.adapter.write.bind(h.host.app.vault.adapter);
		h.host.app.vault.adapter.write = async (path: string, text: string) => {
			await write(path, text);
			if (path.includes("/unreadable-")) h.state.disk = arrived;
		};
		assert.equal(await new SettingsRecoveryService(h.host).replaceUnreadable(), false);
		assert.equal(h.state.disk, arrived);
		h.host.settingsWriter.destroy();
	});
});

describe("discarding an unreadable recovery copy", () => {
	it("preserves both damaged stores through separate explicit repairs", async () => {
		const h = recoveryActionHarness();
		const broken = { callouts: [{ id: "recoverable-original" }] };
		h.state.disk = "{ damaged primary";
		h.state.checkpoint = broken;
		h.state.invalidCheckpoint = true;
		await h.boot();
		const service = new SettingsRecoveryService(h.host);
		try {
			assert.equal(h.host.settingsWriter.status.frozenReason, "recovery-read");
			assert.equal(await service.replaceUnreadable(), false);
			assert.deepEqual(h.state.checkpoint, broken);
			assert.equal(h.state.disk, "{ damaged primary");
			assert.equal(await service.discardRecoveryCopy(), false, "the primary still needs repair");
			const recoveryCopies = [...h.files.entries()].filter(([path]) => path.includes("/backups/recovery-copy-"));
			assert.equal(recoveryCopies.length, 1);
			assert.deepEqual(JSON.parse(recoveryCopies[0]![1]), broken);
			assert.equal(h.host.settingsWriter.status.frozenReason, "unreadable");
			assert.equal(await service.replaceUnreadable(), true);
			const primaryCopies = [...h.files.entries()].filter(([path]) => path.includes("/backups/unreadable-"));
			assert.deepEqual(primaryCopies.map(([, text]) => text), ["{ damaged primary"]);
			assert.equal(h.host.settingsWriter.isFrozen, false);
		} finally { h.host.settingsWriter.destroy(); }
	});

	it("keeps an exact copy of it, replaces it with the setup shown, and resumes saving", async () => {
		const h = recoveryActionHarness();
		const broken = { callouts: [{ id: "no display name or icon" }] };
		h.state.checkpoint = broken;
		h.state.invalidCheckpoint = true;
		await h.boot();
		assert.equal(h.host.settingsWriter.status.frozenReason, "recovery-read");
		const error = console.error; console.error = () => {};
		try { assert.equal(await new SettingsRecoveryService(h.host).discardRecoveryCopy(), true); }
		finally { console.error = error; }
		const copies = [...h.files.entries()].filter(([path]) => path.includes("/backups/recovery-copy-"));
		assert.equal(copies.length, 1);
		assert.deepEqual(JSON.parse(copies[0]![1]), broken);
		assert.equal(h.host.settingsWriter.isFrozen, false);
		assert.equal(canonical(content(h.state.checkpoint)), canonical(content(JSON.parse(h.state.disk!))));
		h.host.settingsWriter.destroy();
	});
});

describe("sync diagnostics", () => {
	it("report states and counts, and nothing of the setup itself", async () => {
		const h = recoveryActionHarness(); await h.boot();
		h.host.registry.add(definition({ id: "private-name", displayName: "My secret callout", icon: star }));
		await h.host.saveSettings();
		h.files.set(`${DIR}/data 2.json`, "{}");
		const report = await new SettingsRecoveryService(h.host).diagnostics("desktop");
		assert.match(report, /^Callout Studio sync diagnostics$/m);
		assert.match(report, /^Saving: working$/m);
		assert.match(report, /^Settings file: readable, \d+ characters, envelope 2, \d+ stamps$/m);
		assert.match(report, /^Other copies of the settings file: 1$/m);
		assert.ok(!report.includes("secret") && !report.includes("private-name"), "the report leaked setup content");
		h.host.settingsWriter.freeze("unreadable");
		assert.match(await new SettingsRecoveryService(h.host).diagnostics("mobile"), /^Saving: paused \(unreadable\)$/m);
		h.host.settingsWriter.destroy();
	});
});
