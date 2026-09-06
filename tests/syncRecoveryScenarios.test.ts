import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pair, device } from "./support/syncReplicaHarness";
import { definition } from "./support/discoveryHarness";
import { canonical, content, SYNC_KEY } from "../src/manager/syncTree";
import { hasSafeSettingsFileShape } from "../src/manager/settingsFileShape";

describe("recovery from adverse sync delivery", () => {
	it("recovers local edits overwritten while the plugin was closed", async () => {
		await pair(async (a, b) => {
			a.registry.add(definition({ id: "left", icon: { type: "lucide", value: "star" } }));
			b.registry.add(definition({ id: "right", icon: { type: "lucide", value: "star" } }));
			await Promise.all([a.host.saveSettings(), b.host.saveSettings()]);
			a.close(); await a.replaceDisk(await b.read());
			const restarted = await device(a.dir);
			try {
				assert.ok(restarted.registry.get("left")); assert.ok(restarted.registry.get("right"));
				await b.deliver(await restarted.read());
				assert.equal(canonical(await b.read()), canonical(await restarted.read()));
			} finally { restarted.close(); }
		});
	});
	it("rejects a provider's mixed body and revision metadata without overwriting the file", async () => {
		await pair(async (a, b) => {
			a.registry.update("shared", { displayName: "Edited on A" });
			b.registry.update("shared", { colorLight: "#654321" });
			await Promise.all([a.host.saveSettings(), b.host.saveSettings()]);
			const left = await a.read() as Record<string, unknown>, right = await b.read() as Record<string, unknown>;
			const mixed = { ...left, callouts: right.callouts };
			assert.equal(hasSafeSettingsFileShape(mixed), false);
			const before = canonical(a.registry.toSaveData()), writes = a.writes;
			await a.deliver(mixed);
			assert.equal(canonical(a.registry.toSaveData()), before); assert.equal(a.writes, writes);
			assert.equal(canonical(await a.read()), canonical(mixed));
			await a.deliver(right); assert.equal(a.registry.get("shared")?.displayName, "Edited on A");
		});
	});
	it("rejects metadata-only mixing even when the checksum's body was retained", async () => {
		await pair(async (a, b) => {
			a.registry.update("shared", { displayName: "Edited on A" });
			b.registry.update("shared", { colorLight: "#654321" });
			await Promise.all([a.host.saveSettings(), b.host.saveSettings()]);
			const left = await a.read() as Record<string, unknown>, right = await b.read() as Record<string, unknown>;
			const am = left[SYNC_KEY] as { stamps: object }, bm = right[SYNC_KEY] as { stamps: object };
			const mixed = { ...left, [SYNC_KEY]: { ...am, stamps: { ...am.stamps, ...bm.stamps } } };
			assert.equal(hasSafeSettingsFileShape(mixed), false);
		});
	});
	it("shows the durable local copy read-only when startup finds truncated JSON", async () => {
		await pair(async a => {
			a.registry.add(definition({ id: "protected", icon: { type: "lucide", value: "star" } }));
			await a.host.saveSettings(); a.close(); await a.replaceRaw('{"callouts":');
			const restarted = await device(a.dir);
			try {
				assert.ok(restarted.registry.get("protected")); assert.equal(restarted.host.settingsWriter.isFrozen, true);
				await restarted.host.saveSettings(); assert.equal(restarted.writes, 0);
			} finally { restarted.close(); }
		});
	});
	it("does not overwrite the synced file if durable recovery storage is full", async () => {
		await pair(async a => {
			const before = canonical(await a.read()); a.checkpointFailure(true);
			a.registry.add(definition({ id: "pending" }));
			await assert.rejects(() => a.host.saveSettings(), /quota/);
			assert.equal(canonical(await a.read()), before);
			a.checkpointFailure(false); await a.host.saveSettings();
			assert.ok((content(await a.read()).callouts as { id: string }[]).some(row => row.id === "pending"));
		});
	});
	it("keeps a corrupt recovery copy from being silently replaced on startup", async () => {
		await pair(async a => {
			const before = canonical(await a.read()); a.close(); await a.checkpointRaw('{"broken":');
			const restarted = await device(a.dir);
			try {
				assert.equal(restarted.host.settingsWriter.isFrozen, true);
				await restarted.host.saveSettings(); assert.equal(canonical(await restarted.read()), before);
				await restarted.checkpointRaw(JSON.stringify(await restarted.read()));
				await restarted.queue.run(); assert.equal(restarted.host.settingsWriter.isFrozen, false);
			} finally { restarted.close(); }
		});
	});
	it("recovers a checkpoint saved just before the data file write failed", async () => {
		await pair(async a => {
			a.registry.add(definition({ id: "pending", icon: { type: "lucide", value: "star" } }));
			a.writeFailure(true); await assert.rejects(() => a.host.saveSettings()); a.close();
			const restarted = await device(a.dir);
			try { assert.ok(restarted.registry.get("pending")); assert.ok(restarted.writes > 0); }
			finally { restarted.close(); }
		});
	});
	it("rechecks the data file if a remote version arrives while the checkpoint is saving", async () => {
		await pair(async (a, b) => {
			a.registry.add(definition({ id: "remote", icon: { type: "lucide", value: "star" } })); await a.host.saveSettings();
			const remote = await a.read(); b.registry.add(definition({ id: "pending", icon: { type: "lucide", value: "star" } }));
			const writes = b.writes; b.duringCheckpoint(() => b.replaceDisk(remote));
			await b.host.saveSettings(); assert.equal(b.writes, writes);
			assert.equal(canonical(await b.read()), canonical(remote));
			await b.queue.run(); assert.ok(b.registry.get("remote")); assert.ok(b.registry.get("pending"));
		});
	});

	it("retains the local branch when launch occurs in a missing-file window and remote data arrives later", async () => {
		await pair(async (a, b) => {
			a.registry.add(definition({ id: "left", icon: { type: "lucide", value: "star" } }));
			b.registry.add(definition({ id: "right", icon: { type: "lucide", value: "star" } }));
			await Promise.all([a.host.saveSettings(), b.host.saveSettings()]);
			a.close(); await a.removeDisk(); const restarted = await device(a.dir);
			try {
				assert.equal(restarted.host.settingsWriter.isFrozen, true);
				await restarted.deliver(await b.read());
				assert.ok(restarted.registry.get("left")); assert.ok(restarted.registry.get("right"));
				assert.equal(restarted.host.settingsWriter.isFrozen, false);
			} finally { restarted.close(); }
		});
	});

	it("does not restore reset callouts from the checkpoint or a stale remote snapshot", async () => {
		await pair(async (a, b) => {
			a.registry.add(definition({ id: "deleted-by-reset", icon: { type: "lucide", value: "star" } }));
			await a.host.saveSettings(); const stale = await a.read(); await b.deliver(stale);
			a.registry.resetAll(); await a.host.saveSettings(); a.close();
			const restarted = await device(a.dir);
			try { await restarted.deliver(stale); assert.equal(restarted.registry.get("deleted-by-reset"), undefined); }
			finally { restarted.close(); }
		});
	});

});
