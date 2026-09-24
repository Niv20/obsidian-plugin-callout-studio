import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";
import { recoveryActionHarness } from "./support/recoveryActionHarness";
import { definition } from "./support/discoveryHarness";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { retrySettingsRecovery, startFreshSettings } from "../src/manager/settingsRecoveryActions";
import { tryAdoptExternalSettings } from "../src/manager/settingsAdopt";
import { SettingsSync } from "../src/manager/settingsSync";
import { CURRENT_DATA_VERSION } from "../src/constants";
import type { PluginData } from "../src/types";

function settings(...ids: string[]): PluginData {
	const registry = new CalloutRegistry();
	registry.load(null);
	for (const id of ids) registry.add(definition({ id }));
	return registry.toSaveData();
}

function harness(t: TestContext, missing = false) {
	const h = recoveryActionHarness({ missing, legacy: missing });
	t.after(() => h.host.settingsWriter.destroy());
	return h;
}

async function running(t: TestContext) {
	const h = harness(t);
	h.state.disk = JSON.stringify(settings("personal"));
	await h.boot();
	h.state.writes = 0;
	return h;
}

async function missingAtBoot(t: TestContext) {
	const h = harness(t, true);
	h.state.checkpoint = settings("personal");
	await h.boot();
	return h;
}

describe("settings missing after a successful launch", () => {
	it("protects runtime disappearance and exposes the same recovery state as a missing-file launch", async t => {
		const h = await running(t);
		h.state.disk = null;
		assert.equal(await tryAdoptExternalSettings(h.host), "unavailable");
		assert.equal(h.host.settingsWriter.isFrozen, true);
		assert.equal(h.host.settingsWriter.status.frozenReason, "missing");
		assert.ok(h.host.registry.get("personal"));
		assert.equal(await retrySettingsRecovery(h.host), false);
		assert.equal(h.state.disk, null);
		assert.equal(h.state.writes, 0, "checking for sync must not recreate a file");
	});

	it("protects disappearance first observed by a real settings edit", async t => {
		const h = await running(t);
		h.state.disk = null;
		h.host.registry.add(definition({ id: "unsaved-edit" }));
		await h.host.saveSettings();
		assert.equal(h.host.settingsWriter.status.frozenReason, "missing");
		assert.equal(h.state.disk, null);
		assert.equal(await startFreshSettings(h.host), true);
		const restored = new CalloutRegistry(); restored.load(JSON.parse(h.state.disk!) as PluginData);
		assert.ok(restored.get("personal"));
		assert.ok(restored.get("unsaved-edit"));
	});

	it("physically restores unchanged settings despite the former write baseline", async t => {
		const h = await running(t);
		const original = h.state.disk;
		h.state.disk = null;
		await tryAdoptExternalSettings(h.host);
		assert.equal(await startFreshSettings(h.host), true);
		assert.equal(h.state.writes, 1);
		assert.notEqual(h.state.disk, null, "historical baseline equality is not a saved file");
		assert.deepEqual(JSON.parse(h.state.disk!) as unknown, JSON.parse(original!) as unknown);
		assert.equal(h.host.settingsWriter.isFrozen, false);
		assert.equal(h.host.settingsWriter.status.reason, null);
	});

	it("adopts an identical returning file without rewriting it", async t => {
		const h = await running(t);
		const original = h.state.disk;
		h.state.disk = null; await tryAdoptExternalSettings(h.host);
		h.state.disk = original;
		assert.equal(await retrySettingsRecovery(h.host), true);
		assert.equal(h.host.settingsWriter.isFrozen, false);
		assert.equal(h.host.settingsWriter.status.reason, null);
		assert.equal(h.state.writes, 0);
		assert.equal(h.state.disk, original);
	});

	it("keeps a fresh install writable when a foreground check precedes its first edit", async t => {
		const h = harness(t); h.state.disk = null;
		await h.boot();
		assert.equal(h.host.localState.hasInitialized, false);
		await tryAdoptExternalSettings(h.host);
		assert.equal(h.host.settingsWriter.isFrozen, false);
		h.host.registry.add(definition({ id: "first-edit" }));
		await h.host.saveSettings();
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "first-edit"));
		assert.equal(h.host.localState.hasInitialized, true);
	});

	it("does not create defaults when Retry is invoked on an untouched fresh install", async t => {
		const h = harness(t); h.state.disk = null;
		await h.boot();
		assert.equal(await retrySettingsRecovery(h.host), false);
		assert.equal(h.state.disk, null);
		assert.equal(h.state.checkpoint, null);
		assert.equal(h.state.writes, 0);
		assert.equal(h.host.localState.hasInitialized, false);
		assert.equal(h.host.settingsWriter.isFrozen, false);
	});

	it("retries a failed first-ever settings write without requiring replacement confirmation", async t => {
		const h = harness(t); h.state.disk = null;
		await h.boot();
		h.host.registry.add(definition({ id: "first-unsaved-edit" }));
		h.state.failWrite = true;
		await assert.rejects(h.host.saveSettings());
		assert.equal(h.host.localState.hasInitialized, false);
		assert.equal(h.state.disk, null);
		h.state.failWrite = false;
		assert.equal(await retrySettingsRecovery(h.host), true);
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "first-unsaved-edit"));
		assert.equal(h.host.localState.hasInitialized, true);
		assert.equal(h.host.settingsWriter.status.reason, null);
	});
});

describe("explicit missing-file restoration boundaries", () => {
	for (const phase of ["backup", "checkpoint"] as const) {
		it(`keeps a file arriving during the ${phase} untouched`, async t => {
			const h = await missingAtBoot(t);
			const remote = JSON.stringify(settings("remote"));
			if (phase === "checkpoint") h.state.beforeCheckpoint = () => { h.state.disk = remote; };
			else {
				const write = h.host.app.vault.adapter.write.bind(h.host.app.vault.adapter);
				h.host.app.vault.adapter.write = async (path, text) => { await write(path, text); h.state.disk = remote; };
			}
			assert.equal(await startFreshSettings(h.host), false);
			assert.equal(h.state.disk, remote);
			assert.equal(h.state.writes, 0);
		});
	}

	it("keeps restoration retryable after a checkpoint failure without authorizing ordinary saves", async t => {
		const h = await running(t);
		h.state.disk = null; await tryAdoptExternalSettings(h.host);
		h.state.failCheckpoint = true;
		assert.equal(await startFreshSettings(h.host), false);
		assert.equal(h.host.settingsWriter.isFrozen, true);
		assert.equal(h.host.settingsWriter.status.reason, "recovery-write");
		h.state.failCheckpoint = false;
		h.host.registry.add(definition({ id: "kept-draft" }));
		await h.host.saveSettings();
		assert.equal(h.state.disk, null);
		assert.equal(await startFreshSettings(h.host), true);
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "kept-draft"));
	});

	it("preserves the recovery copy when its backup cannot be verified", async t => {
		const h = await missingAtBoot(t);
		const checkpoint = structuredClone(h.state.checkpoint);
		h.host.app.vault.adapter.read = async () => "incomplete backup";
		assert.equal(await startFreshSettings(h.host), false);
		assert.deepEqual(h.state.checkpoint, checkpoint);
		assert.equal(h.state.disk, null);
		assert.equal(h.state.writes, 0);
		assert.equal(h.host.settingsWriter.status.reason, "backup");
	});

	it("does not authorize background recreation after a primary write failure", async t => {
		const h = await running(t);
		const original = h.state.disk;
		h.state.disk = null; await tryAdoptExternalSettings(h.host);
		h.state.failWrite = true;
		assert.equal(await startFreshSettings(h.host), false);
		assert.equal(h.host.settingsWriter.isFrozen, true);
		assert.equal(h.host.settingsWriter.matchesLastWrite(original!), true);
		h.state.failWrite = false;
		h.host.registry.add(definition({ id: "draft-after-failure" }));
		await h.host.saveSettings();
		assert.equal(h.state.disk, null);
		assert.equal(await startFreshSettings(h.host), true);
		assert.equal(h.state.writes, 1);
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "draft-after-failure"));
	});

	for (const interruption of ["editor", "preview", "edit", "unload"] as const) {
		it(`does not write when ${interruption} activity interrupts the restoration checkpoint`, async t => {
			const h = await missingAtBoot(t);
			h.state.beforeCheckpoint = () => {
				if (interruption === "editor") h.host.settingsEditOpen = true;
				if (interruption === "preview") h.host.registry.hasPreviewDefinition = () => true;
				if (interruption === "edit") h.host.registry.add(definition({ id: "typed-during-recovery" }));
				if (interruption === "unload") h.host.settingsWriter.destroy();
			};
			assert.equal(await startFreshSettings(h.host), false);
			assert.equal(h.state.disk, null);
			assert.equal(h.state.writes, 0);
			if (interruption === "edit") assert.ok(h.host.registry.get("typed-during-recovery"));
		});
	}

	it("rejects concurrent recreation and adoption while the authorized write is pending", async t => {
		const h = await missingAtBoot(t);
		let entered!: () => void, release!: () => void;
		const checkpointEntered = new Promise<void>(resolve => { entered = resolve; });
		const checkpointReleased = new Promise<void>(resolve => { release = resolve; });
		t.after(() => release());
		const remember = h.host.settingsWriter.remember.bind(h.host.settingsWriter);
		h.host.settingsWriter.remember = async data => { entered(); await checkpointReleased; await remember(data); };
		const first = startFreshSettings(h.host);
		await checkpointEntered;
		assert.equal(await startFreshSettings(h.host), false);
		assert.equal(await tryAdoptExternalSettings(h.host), "deferred");
		release();
		assert.equal(await first, true);
		assert.equal(h.state.writes, 1);
	});

	it("persists an edit made while the physical restoration write is pending", async t => {
		const h = await running(t);
		h.state.disk = null; await tryAdoptExternalSettings(h.host);
		let entered!: () => void, release!: () => void;
		const writeEntered = new Promise<void>(resolve => { entered = resolve; });
		const writeReleased = new Promise<void>(resolve => { release = resolve; });
		t.after(() => release());
		h.state.beforePrimaryWrite = async () => {
			h.state.beforePrimaryWrite = null;
			entered(); await writeReleased;
		};
		const restore = startFreshSettings(h.host);
		await writeEntered;
		h.host.registry.add(definition({ id: "edited-during-write" }));
		await h.host.saveSettings();
		release();
		assert.equal(await restore, true);
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "edited-during-write"));
		assert.equal(h.host.settingsWriter.status.reason, null);
	});
});

describe("missing-file recovery provenance", () => {
	it("restores displayed recovery settings after an unreadable primary disappears", async t => {
		const h = harness(t);
		h.state.disk = "{incomplete";
		h.state.checkpoint = settings("recovered-from-unreadable");
		await h.boot();
		assert.equal(h.host.settingsWriter.status.frozenReason, "unreadable");
		assert.ok(h.host.registry.get("recovered-from-unreadable"));
		h.state.disk = null;
		assert.equal(await retrySettingsRecovery(h.host), false);
		assert.equal(h.host.settingsWriter.status.frozenReason, "missing");
		assert.ok(h.host.registry.get("recovered-from-unreadable"));
		assert.equal(h.state.disk, null);
		assert.equal(await startFreshSettings(h.host), true);
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "recovered-from-unreadable"));
	});

	it("can restore after the primary disappears during a recovery-write pause", async t => {
		const h = harness(t);
		h.state.disk = JSON.stringify(settings("personal"));
		h.state.failCheckpoint = true;
		await h.boot();
		assert.equal(h.host.settingsWriter.status.frozenReason, "recovery-write");
		h.state.disk = null;
		await tryAdoptExternalSettings(h.host);
		h.state.failCheckpoint = false;
		assert.equal(h.host.settingsWriter.status.frozenReason, "missing");
		assert.equal(await startFreshSettings(h.host), true);
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "personal"));
	});

	it("can recover a read pause that began before the primary disappeared", async t => {
		const h = harness(t);
		h.state.disk = JSON.stringify(settings("personal"));
		h.state.checkpoint = JSON.parse(h.state.disk) as unknown;
		h.state.failRead = true;
		await h.boot();
		assert.equal(h.host.settingsWriter.status.frozenReason, "recovery-read");
		h.state.disk = null;
		await tryAdoptExternalSettings(h.host);
		h.state.failRead = false;
		assert.equal(await retrySettingsRecovery(h.host), false);
		assert.equal(h.host.settingsWriter.status.frozenReason, "missing");
		assert.ok(h.host.registry.get("personal"));
		assert.equal(h.state.disk, null);
		assert.equal(await startFreshSettings(h.host), true);
	});

	it("keeps a newer recovery copy protected after another missing-file check", async t => {
		const h = harness(t, true);
		h.state.checkpoint = { ...settings("future"), version: CURRENT_DATA_VERSION + 1 };
		await h.boot();
		await tryAdoptExternalSettings(h.host);
		assert.equal(h.host.settingsWriter.status.frozenReason, "newer-version");
		assert.equal(await startFreshSettings(h.host), false);
		assert.equal(h.state.disk, null);
	});

	it("can retry an unavailable checkpoint while the primary file remains missing", async t => {
		const h = harness(t, true);
		h.state.checkpoint = settings("recover-later"); h.state.failRead = true;
		await h.boot();
		await tryAdoptExternalSettings(h.host);
		assert.equal(h.host.settingsWriter.status.frozenReason, "recovery-read");
		h.state.failRead = false;
		assert.equal(await retrySettingsRecovery(h.host), false);
		assert.ok(h.host.registry.get("recover-later"));
		assert.equal(h.host.settingsWriter.status.frozenReason, "missing");
		assert.equal(h.state.disk, null);
		assert.equal(await startFreshSettings(h.host), true);
	});

	it("retains deletion history across a missing-file restart and later stale delivery", async t => {
		const sync = new SettingsSync("other-device");
		const stale = sync.prepare(settings("kept", "deleted"));
		sync.adopt(stale);
		const latest = sync.prepare(settings("kept"));
		const h = harness(t, true); h.state.checkpoint = latest;
		await h.boot();
		assert.equal(h.host.registry.get("deleted"), undefined);
		assert.equal(await startFreshSettings(h.host), true);
		h.state.disk = JSON.stringify(stale);
		assert.equal(await retrySettingsRecovery(h.host), true);
		assert.equal(h.host.registry.get("deleted"), undefined, "a restored deletion must defeat an older synced row");
		assert.ok(h.host.registry.get("kept"));
		assert.equal((JSON.parse(h.state.disk) as PluginData).callouts.some(row => row.id === "deleted"), false);
	});
});

describe("settings writes require verified persistence", () => {
	it("accepts an exact write followed by rejection and marks the installation initialized", async t => {
		const h = harness(t); h.state.disk = null;
		await h.boot();
		h.host.registry.add(definition({ id: "actually-persisted" }));
		h.state.beforePrimaryWrite = async data => {
			h.state.disk = JSON.stringify(data);
			h.state.writes++;
			h.state.failWrite = true;
		};
		await assert.doesNotReject(h.host.saveSettings());
		assert.equal(h.host.localState.hasInitialized, true);
		assert.equal(h.host.settingsWriter.status.reason, null);
		assert.equal(h.state.writes, 1);
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "actually-persisted"));
	});

	it("does not mark a fresh installation initialized when saveData silently fails, and Retry can recover", async t => {
		const h = harness(t); h.state.disk = null;
		await h.boot();
		h.host.registry.add(definition({ id: "first-pending" }));
		h.state.skipPrimaryWrite = true;
		await assert.rejects(h.host.saveSettings());
		assert.equal(h.host.localState.hasInitialized, false);
		assert.equal(h.host.settingsWriter.status.reason, "write");
		assert.equal(h.state.disk, null);
		assert.equal(h.state.writes, 0);
		h.state.skipPrimaryWrite = false;
		assert.equal(await retrySettingsRecovery(h.host), true);
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "first-pending"));
		assert.equal(h.host.localState.hasInitialized, true);
	});

	it("keeps silent restoration failure paused and retryable", async t => {
		const h = await running(t);
		h.state.disk = null; await tryAdoptExternalSettings(h.host);
		h.state.skipPrimaryWrite = true;
		assert.equal(await startFreshSettings(h.host), false);
		assert.equal(h.host.settingsWriter.isFrozen, true);
		assert.equal(h.host.settingsWriter.status.reason, "write");
		assert.equal(h.state.disk, null);
		assert.equal(h.state.writes, 0);
		h.state.skipPrimaryWrite = false;
		assert.equal(await startFreshSettings(h.host), true);
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "personal"));
		assert.equal(h.host.settingsWriter.isFrozen, false);
	});

	for (const readback of ["different", "corrupt"] as const) {
		it(`does not report success when saveData resolves with ${readback} settings on disk`, async t => {
			const h = harness(t); h.state.disk = null;
			await h.boot();
			h.host.registry.add(definition({ id: "intended" }));
			const replacement = readback === "different" ? JSON.stringify(settings("other-device")) : "{incomplete";
			h.state.skipPrimaryWrite = true;
			h.state.beforePrimaryWrite = async () => { h.state.disk = replacement; };
			await assert.rejects(h.host.saveSettings());
			assert.equal(h.host.localState.hasInitialized, false);
			assert.equal(h.state.disk, replacement);
			assert.notEqual(h.host.settingsWriter.status.reason, null);
			assert.equal(h.host.settingsWriter.matchesLastWrite(JSON.stringify(h.host.registry.toSaveData()), true), false);
		});
	}

	it("recreates a missing plugin directory explicitly even without a recovery checkpoint", async t => {
		const h = harness(t, true);
		await h.boot();
		assert.equal(h.state.checkpoint, null);
		h.host.registry.add(definition({ id: "displayed-settings" }));
		const dir = ".obsidian/plugins/callout-studio";
		let directoryExists = false;
		const created: string[] = [];
		const exists = h.host.app.vault.adapter.exists.bind(h.host.app.vault.adapter);
		h.host.app.vault.adapter.exists = async path => path === dir ? directoryExists : exists(path);
		h.host.app.vault.adapter.mkdir = async path => { created.push(path); if (path === dir) directoryExists = true; };
		h.state.beforePrimaryWrite = async () => { assert.equal(directoryExists, true, "saveData requires its parent directory"); };
		assert.equal(await retrySettingsRecovery(h.host), false);
		assert.deepEqual(created, [], "checking for sync must not recreate a deleted directory");
		assert.equal(await startFreshSettings(h.host), true);
		assert.deepEqual(created, [dir]);
		assert.ok((JSON.parse(h.state.disk!) as PluginData).callouts.some(row => row.id === "displayed-settings"));
	});

	it("keeps restoration paused when its missing parent directory cannot be created", async t => {
		const h = harness(t, true);
		await h.boot();
		h.host.app.vault.adapter.mkdir = async () => { throw new Error("Directory creation denied"); };
		assert.equal(await startFreshSettings(h.host), false);
		assert.equal(h.state.checkpoint, null);
		assert.equal(h.state.disk, null);
		assert.equal(h.state.writes, 0);
		assert.equal(h.host.settingsWriter.isFrozen, true);
	});
});
