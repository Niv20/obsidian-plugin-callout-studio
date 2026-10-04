/**
 * A change made on this device that never reached the settings file, replaced
 * by a newer one from another device when that device's file is adopted. The
 * merge is right to take the newer change, and the backup it writes first
 * keeps this device's version, but nothing used to say so. Now a notice does,
 * and only then: an adoption that replaces nothing unsaved says nothing.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tryAdoptExternalSettings } from "../src/manager/settingsAdopt";
import { SettingsSync } from "../src/manager/settingsSync";
import { unsavedChangesReplaced } from "../src/manager/setupDifference";
import { en } from "../src/i18n/en";
import type { PluginData } from "../src/types";
import { definition } from "./support/discoveryHarness";
import { recoveryActionHarness } from "./support/recoveryActionHarness";

const star = { type: "lucide" as const, value: "star" };

/** Another device's file: `displayName` edited twice, so its stamp is the newer one. */
function remoteEdit(disk: string, names: string[]): string {
	const sync = new SettingsSync("other-device");
	let data: unknown = JSON.parse(disk);
	sync.adopt(data);
	for (const name of names) {
		const next = structuredClone(data) as PluginData;
		next.callouts = next.callouts.map(row => row.id === "shared" ? { ...row, displayName: name } : row);
		data = sync.prepare(next);
		sync.adopt(data);
	}
	return JSON.stringify(data);
}

describe("unsaved changes replaced by another device", () => {
	it("are announced, and kept in a backup", async () => {
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		const h = recoveryActionHarness(); await h.boot();
		const error = console.error; console.error = () => {};
		try {
			h.host.registry.add(definition({ id: "shared", displayName: "Start", icon: star }));
			await h.host.saveSettings();
			h.state.failWrite = true;
			h.host.registry.update("shared", { displayName: "Mine, unsaved" });
			await assert.rejects(h.host.saveSettings());
			h.state.failWrite = false;
			h.state.disk = remoteEdit(h.state.disk!, ["Theirs", "Theirs again"]);
			assert.equal(await tryAdoptExternalSettings(h.host), "applied");
			assert.equal(h.host.registry.get("shared")?.displayName, "Theirs again");
			assert.ok(notices.includes(en["notice.unsavedChangesKept"]!));
			const backups = [...h.files.values()].filter(text => text.includes("Mine, unsaved"));
			assert.equal(backups.length, 1, "this device's version was not kept");
		} finally {
			console.error = error;
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
			h.host.settingsWriter.destroy();
		}
	});

	it("say nothing when the adoption replaced only what was already saved", async () => {
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		const h = recoveryActionHarness(); await h.boot();
		try {
			h.host.registry.add(definition({ id: "shared", displayName: "Start", icon: star }));
			await h.host.saveSettings();
			h.state.disk = remoteEdit(h.state.disk!, ["Theirs"]);
			assert.equal(await tryAdoptExternalSettings(h.host), "applied");
			assert.ok(!notices.includes(en["notice.unsavedChangesKept"]!));
		} finally {
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
			h.host.settingsWriter.destroy();
		}
	});

	it("are counted by callout type and settings group", () => {
		const row = (name: string) => definition({ id: "a", displayName: name });
		const saved: Partial<PluginData> = { callouts: [row("saved")] };
		assert.equal(unsavedChangesReplaced(saved, { callouts: [row("local")] }, { callouts: [row("remote")] }), 1);
		assert.equal(unsavedChangesReplaced(saved, { callouts: [row("local")] }, { callouts: [row("local")] }), 0, "the local change won");
		assert.equal(unsavedChangesReplaced(saved, saved, { callouts: [row("remote")] }), 0, "nothing was unsaved");
	});
});
