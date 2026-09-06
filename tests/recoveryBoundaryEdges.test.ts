import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recoveryActionHarness } from "./support/recoveryActionHarness";
import { definition } from "./support/discoveryHarness";
import { retrySettingsRecovery, startFreshSettings } from "../src/manager/settingsRecoveryActions";
import { reloadFrom, tryAdoptExternalSettings } from "../src/manager/settingsAdopt";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CURRENT_DATA_VERSION } from "../src/constants";
import type { PluginData } from "../src/types";

function incoming(id: string) {
	const registry = new CalloutRegistry(); registry.load(null); registry.add(definition({ id }));
	const data = registry.toSaveData();
	return { kind: "loaded" as const, data, json: JSON.stringify(data) };
}

describe("recovery across missing files and awaited storage boundaries", () => {
	it("does not discard the checkpoint of a first save whose primary write failed", async () => {
		const h = recoveryActionHarness({ missing: true });
		h.state.checkpoint = incoming("first-unsaved").data;
		assert.equal((await h.boot()).isFreshInstall, false);
		assert.equal(h.host.settingsWriter.status.reason, "missing");
		assert.ok(h.host.registry.get("first-unsaved")); assert.equal(h.state.writes, 0);
		assert.equal(await startFreshSettings(h.host), true);
		const restart = new CalloutRegistry(); restart.load(JSON.parse(h.state.disk!) as PluginData);
		assert.ok(restart.get("first-unsaved")); h.host.settingsWriter.destroy();
	});
	it("protects a newer checkpoint even when the primary file is absent", async () => {
		const h = recoveryActionHarness({ missing: true });
		h.state.checkpoint = { ...incoming("future").data, version: CURRENT_DATA_VERSION + 1 };
		assert.equal((await h.boot()).isFreshInstall, false);
		assert.equal(h.host.settingsWriter.status.reason, "newer-version");
		assert.equal(await startFreshSettings(h.host), false); assert.equal(h.state.writes, 0);
		h.host.settingsWriter.destroy();
	});
	it("keeps the plugin loaded when the migration write fails, then retries it", async () => {
		const h = recoveryActionHarness(); h.state.disk = JSON.stringify({ callouts: [definition({ id: "legacy" })] });
		h.state.failWrite = true;
		await assert.doesNotReject(h.boot());
		assert.equal(h.host.settingsWriter.status.reason, "write");
		assert.ok(h.host.registry.get("legacy"));
		h.state.failWrite = false; assert.equal(await retrySettingsRecovery(h.host), true);
		h.host.settingsWriter.destroy();
	});
	it("does not replace local edits made while the adoption checkpoint is pending", async () => {
		const h = recoveryActionHarness(); await h.boot(); const remote = incoming("remote"); h.state.disk = remote.json;
		h.state.beforeCheckpoint = () => { h.host.registry.add(definition({ id: "typed-during-checkpoint" })); };
		assert.equal(await reloadFrom(h.host, remote), false);
		assert.ok(h.host.registry.get("typed-during-checkpoint")); assert.equal(h.host.registry.get("remote"), undefined);
		assert.equal(h.state.disk, remote.json); h.host.settingsWriter.destroy();
	});
	it("defers adoption when an editor opens while the checkpoint is pending", async () => {
		const h = recoveryActionHarness(); await h.boot(); const remote = incoming("remote"); h.state.disk = remote.json;
		h.state.beforeCheckpoint = () => { h.host.settingsEditOpen = true; };
		assert.equal(await reloadFrom(h.host, remote), false); assert.equal(h.host.registry.get("remote"), undefined);
		h.host.settingsWriter.destroy();
	});
	it("keeps a frozen session protected when the file vanishes during recovery", async () => {
		const h = recoveryActionHarness(); await h.boot(); h.host.settingsWriter.freeze("unreadable");
		const remote = incoming("remote"); h.state.disk = remote.json;
		h.state.beforeCheckpoint = () => { h.state.disk = null; };
		assert.equal(await reloadFrom(h.host, remote), false);
		assert.equal(h.host.settingsWriter.isFrozen, true);
		await h.host.saveSettings(); assert.equal(h.state.writes, 0); h.host.settingsWriter.destroy();
	});
	it("does not publish an older sync file arriving before the checkpoint finishes", async () => {
		const h = recoveryActionHarness(); await h.boot(); const remote = incoming("remote"); const newer = incoming("newer");
		h.state.disk = remote.json; h.state.beforeCheckpoint = () => { h.state.disk = newer.json; };
		assert.equal(await reloadFrom(h.host, remote), false);
		assert.equal(h.host.registry.get("remote"), undefined); assert.equal(h.state.disk, newer.json);
		h.state.beforeCheckpoint = null;
		assert.equal(await retrySettingsRecovery(h.host), true); assert.ok(h.host.registry.get("newer"));
		h.host.settingsWriter.destroy();
	});
});

describe("missing-file recovery storage retry", () => {
	it("allows recovery after the primary file and recovery store were both unavailable at boot", async () => {
		const h = recoveryActionHarness({ missing: true });
		h.state.failRead = true; h.state.checkpoint = incoming("recover-later").data;
		await h.boot(); assert.equal(h.host.settingsWriter.status.frozenReason, "recovery-read");
		h.state.failRead = false;
		assert.equal(await retrySettingsRecovery(h.host), false, "retry alone must not create a file");
		assert.equal(h.host.settingsWriter.status.reason, "missing");
		assert.ok(h.host.registry.get("recover-later")); assert.equal(h.state.writes, 0);
		assert.equal(await startFreshSettings(h.host), true); h.host.settingsWriter.destroy();
	});
	it("does not overwrite a newer recovery copy discovered after the reset dialog opened", async () => {
		const h = recoveryActionHarness({ missing: true, legacy: true }); await h.boot();
		const newer = { ...incoming("future").data, version: CURRENT_DATA_VERSION + 1 }; h.state.checkpoint = newer;
		assert.equal(await startFreshSettings(h.host), false);
		assert.equal(h.host.settingsWriter.status.reason, "newer-version");
		assert.deepEqual(h.state.checkpoint, newer); assert.equal(h.state.writes, 0); h.host.settingsWriter.destroy();
	});
});

it("does not let an older unstamped checkpoint undo new incoming callout types", async () => {
	const h = recoveryActionHarness(); await h.boot();
	const remote = incoming("new-personal-type"); h.state.disk = remote.json;
	assert.equal(await retrySettingsRecovery(h.host), true);
	assert.ok(h.host.registry.get("new-personal-type"));
	assert.ok((JSON.parse(h.state.disk) as PluginData).callouts.some(row => row.id === "new-personal-type"));
	h.host.settingsWriter.destroy();
});


it("clears a transient missing-file warning when the identical file returns", async () => {
	const h = recoveryActionHarness(); await h.boot(); const original = h.state.disk;
	h.state.disk = null;
	assert.equal(await tryAdoptExternalSettings(h.host), "unavailable");
	assert.equal(h.host.settingsWriter.status.reason, "missing");
	h.state.disk = original;
	assert.equal(await tryAdoptExternalSettings(h.host), "applied");
	assert.equal(h.host.settingsWriter.status.reason, null);
	assert.equal(h.state.writes, 0); h.host.settingsWriter.destroy();
});

it("does not checkpoint speculative incoming data when unloading during adoption preflight", async () => {
	const h = recoveryActionHarness(); await h.boot(); const saved = structuredClone(h.state.checkpoint);
	const remote = incoming("not-yet-adopted"); h.state.disk = remote.json;
	h.state.beforeCheckpoint = () => { h.host.settingsWriter.destroy(); };
	assert.equal(await reloadFrom(h.host, remote), false);
	assert.deepEqual(h.state.checkpoint, saved);
	assert.equal(h.host.registry.get("not-yet-adopted"), undefined);
});
