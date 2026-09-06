import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pair } from "./support/syncReplicaHarness";
import { definition } from "./support/discoveryHarness";
import { canonical, content } from "../src/manager/syncTree";

describe("concurrent settings through two filesystem replicas", () => {
	it("merges offline saves, persists the result, and stops writing after duplicate delivery", async () => {
		await pair(async (a, b) => {
			a.registry.update("shared", { colorLight: "#112233" }); a.registry.add(definition({ id: "left" }));
			b.registry.update("shared", { colorDark: "#445566" }); b.registry.add(definition({ id: "right" }));
			await Promise.all([a.host.saveSettings(), b.host.saveSettings()]);
			const left = await a.read(), right = await b.read();
			await Promise.all([a.deliver(right), b.deliver(left)]);
			// Registry migrations can emit one further convergent repair.
			for (let round = 0; round < 4 && canonical(await a.read()) !== canonical(await b.read()); round++) {
				const x = await a.read(), y = await b.read();
				await Promise.all([a.deliver(y), b.deliver(x)]);
			}
			assert.equal(canonical(await a.read()), canonical(await b.read()));
			for (const d of [a, b]) {
				assert.ok(d.registry.get("left")); assert.ok(d.registry.get("right"));
				assert.equal(d.registry.get("shared")?.colorLight, "#112233");
				assert.equal(d.registry.get("shared")?.colorDark, "#445566");
				assert.equal(d.host.settingsWriter.matchesLastWrite(JSON.stringify(d.registry.toSaveData()), true), true);
			}
			const count = a.writes + b.writes, merged = await a.read();
			await a.deliver(merged); await b.deliver(merged);
			await Promise.all([a.host.saveSettings(), b.host.saveSettings()]);
			assert.equal(a.writes + b.writes, count);
		});
	});
	it("merges an unsaved stale edit after the active editor releases the registry", async () => {
		await pair(async (a, b) => {
			a.registry.add(definition({ id: "remote" })); await a.host.saveSettings();
			b.host.settingsEditOpen = true; b.registry.update("shared", { colorLight: "#123456" });
			await b.deliver(await a.read()); await b.host.saveSettings();
			assert.equal(b.queue.isPending, true); assert.equal(b.registry.get("remote"), undefined);
			b.host.settingsEditOpen = false; await b.queue.run();
			assert.ok(b.registry.get("remote")); assert.equal(b.registry.get("shared")?.colorLight, "#123456");
			assert.equal(canonical(content(await b.read())), canonical(content(b.registry.toSaveData())));
		});
	});
	it("preserves both same-field versions in the result and recovery copies", async () => {
		await pair(async (a, b) => {
			a.registry.update("shared", { displayName: "From A" }); b.registry.update("shared", { displayName: "From B" });
			await Promise.all([a.host.saveSettings(), b.host.saveSettings()]);
			const left = await a.read(), right = await b.read();
			await Promise.all([a.deliver(right), b.deliver(left)]);
			// Registry migrations can emit one further convergent repair.
			for (let round = 0; round < 4 && canonical(await a.read()) !== canonical(await b.read()); round++) {
				const x = await a.read(), y = await b.read();
				await Promise.all([a.deliver(y), b.deliver(x)]);
			}
			assert.equal(canonical(await a.read()), canonical(await b.read()));
			const copies = [await a.read(), ...await a.backups(), ...await b.backups()];
			const names = copies.flatMap(value => (content(value).callouts as { id: string; displayName: string }[]).filter(row => row.id === "shared").map(row => row.displayName));
			assert.ok(names.includes("From A")); assert.ok(names.includes("From B"));
		});
	});
	it("keeps the registry intact if the required conflict backup fails", async () => {
		await pair(async (a, b) => {
			a.registry.update("shared", { displayName: "From A" }); b.registry.update("shared", { displayName: "From B" });
			await Promise.all([a.host.saveSettings(), b.host.saveSettings()]);
			const original = canonical(b.registry.toSaveData()); b.backupFailure();
			await b.deliver(await a.read());
			assert.equal(canonical(b.registry.toSaveData()), original); assert.equal(b.queue.isPending, true);
		});
	});
	it("does not report an unsaved merged snapshot as persisted after write failure", async () => {
		await pair(async (a, b) => {
			a.registry.add(definition({ id: "left" })); b.registry.add(definition({ id: "right" }));
			await Promise.all([a.host.saveSettings(), b.host.saveSettings()]);
			b.writeFailure(true); await b.deliver(await a.read());
			assert.equal(b.host.settingsWriter.matchesLastWrite(JSON.stringify(b.registry.toSaveData()), true), false);
			b.writeFailure(false); await b.host.saveSettings();
			assert.ok(b.registry.get("left")); assert.ok(b.registry.get("right"));
			assert.equal(b.host.settingsWriter.matchesLastWrite(JSON.stringify(b.registry.toSaveData()), true), true);
		});
	});
});
