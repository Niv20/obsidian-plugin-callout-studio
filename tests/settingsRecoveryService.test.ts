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
import { SettingsRecoveryService } from "../src/manager/settingsRecoveryService";
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
