/**
 * Naming why a settings file cannot be used. "Unreadable" covers causes with
 * different fixes, and the generic message could only send people into a
 * hidden folder. The diagnosis reads the raw bytes and changes nothing.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { inspectSettingsFile } from "../src/manager/settingsDiagnosis";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { SettingsSync } from "../src/manager/settingsSync";
import { definition } from "./support/discoveryHarness";

function host(raw: string | Error) {
	const app = { vault: { configDir: ".obsidian", adapter: {
		read: () => raw instanceof Error ? Promise.reject(raw) : Promise.resolve(raw),
	} } } as unknown as App;
	return { app, manifest: { id: "callout-studio", dir: ".obsidian/plugins/callout-studio" } as PluginManifest };
}

function settings(): Record<string, unknown> {
	const registry = new CalloutRegistry(); registry.load(null);
	registry.add(definition({ id: "kept" }));
	return registry.toSaveData() as unknown as Record<string, unknown>;
}

describe("diagnosing a settings file", () => {
	it("tells a file this device cannot open from one that is broken", async () => {
		assert.equal((await inspectSettingsFile(host(new Error("EIO")))).diagnosis, "unavailable");
	});

	it("names an empty file, merge markers and damaged JSON", async () => {
		assert.equal((await inspectSettingsFile(host("  \n"))).diagnosis, "empty");
		const conflicted = '<<<<<<< HEAD\n{"callouts":[]}\n=======\n{"callouts":[{"id":"x"}]}\n>>>>>>> theirs\n';
		assert.equal((await inspectSettingsFile(host(conflicted))).diagnosis, "merge-markers");
		assert.equal((await inspectSettingsFile(host('{"callouts": ['))).diagnosis, "damaged");
		assert.equal((await inspectSettingsFile(host("[1, 2]"))).diagnosis, "damaged");
	});

	it("recognizes settings a sync service wrapped in metadata that no longer matches, and offers them back", async () => {
		const body = settings();
		const stamped = new SettingsSync("device").prepare(body) as Record<string, unknown>;
		const combined = { ...stamped, callouts: [...(body.callouts as unknown[]), definition({ id: "from-the-other-device" })] };
		const found = await inspectSettingsFile(host(JSON.stringify(combined)));
		assert.equal(found.diagnosis, "combined");
		assert.ok((found.salvage?.callouts as { id: string }[]).some(row => row.id === "from-the-other-device"));
		assert.ok(!("calloutStudioSync" in found.salvage!));
	});

	it("names entries this build cannot use, a later build's file, and a file that is fine", async () => {
		const duplicate = { callouts: [definition({ id: "twice" }), definition({ id: "twice" })] };
		assert.equal((await inspectSettingsFile(host(JSON.stringify(duplicate)))).diagnosis, "invalid-entries");
		assert.equal((await inspectSettingsFile(host(JSON.stringify({ version: 99, callouts: "new shape" })))).diagnosis, "newer");
		assert.equal((await inspectSettingsFile(host(JSON.stringify(settings())))).diagnosis, "readable");
	});

	it("keeps the exact bytes it read", async () => {
		const raw = '\uFEFF{"callouts": [';
		assert.equal((await inspectSettingsFile(host(raw))).raw, raw);
	});
});
