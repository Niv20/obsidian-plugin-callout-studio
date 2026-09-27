/**
 * A Callout Studio import replaces same-id callouts and whole setting groups.
 * It used to do that without a word when the file validated cleanly, with no
 * way back, even while saving was paused — and an older export reset every
 * setting group it predated to the shipped defaults. These pin the guardrails.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { processImportedJSON } from "../src/settings/sections/DataManagementSection";
import { content } from "../src/manager/syncTree";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { en } from "../src/i18n/en";
import { definition } from "./support/discoveryHarness";
import { memoryVault, PLUGIN_MANIFEST, savingWriter, stubConfirm } from "./support/importSafetyStubs";

(globalThis as { __CS_ICON_IDS__?: string[] }).__CS_ICON_IDS__ = ["lucide-pencil", "pencil"];

function vault(edit: (registry: CalloutRegistry) => void = () => {}): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	edit(registry);
	return registry;
}

function run(registry: CalloutRegistry, writer = savingWriter()) {
	const notices: string[] = [];
	(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
	const files = memoryVault();
	let saves = 0;
	const ctx = {
		app: {} as App,
		plugin: {
			registry, app: files.app, manifest: PLUGIN_MANIFEST, settingsWriter: writer,
			customCommands: { syncAll: () => {} },
			saveSettings: () => { saves++; return Promise.resolve(); },
			refreshRenderModes: () => {}, ensureIconArtworkFor: () => Promise.resolve(),
		},
		display: () => {},
	} as unknown as SettingsSectionContext;
	return { ctx, notices, files: files.files, get saves() { return saves; } };
}

const fileOf = (json: string) => new File([json], "backup.json", { type: "application/json" });
const backups = (files: Map<string, string>) => [...files.entries()].filter(([path]) => /\/backups\/data-/.test(path));

describe("importing a Callout Studio backup", () => {
	it("asks first, and saves a verified backup of the current setup before applying", async () => {
		const confirm = stubConfirm(true);
		try {
			const target = vault(r => { r.add(definition({ id: "mine", displayName: "Before" })); });
			const before = content(target.toSaveData());
			const source = vault(r => { r.add(definition({ id: "mine", displayName: "After" })); });
			const h = run(target);
			await processImportedJSON(h.ctx, fileOf(source.exportToJSONv2()));
			assert.deepEqual(confirm.asked, [en["import.confirmTitle"]]);
			const copies = backups(h.files);
			assert.equal(copies.length, 1, "no backup was written before the import");
			assert.deepEqual(content(JSON.parse(copies[0]![1])), before);
			assert.equal(target.get("mine")?.displayName, "After");
		} finally { confirm.restore(); }
	});

	it("changes nothing when the confirmation is declined", async () => {
		const confirm = stubConfirm(false);
		try {
			const target = vault(r => { r.add(definition({ id: "mine", displayName: "Before" })); });
			const source = vault(r => { r.add(definition({ id: "mine", displayName: "After" })); });
			const h = run(target);
			await processImportedJSON(h.ctx, fileOf(source.exportToJSONv2()));
			assert.equal(target.get("mine")?.displayName, "Before");
			assert.equal(h.saves, 0);
			assert.equal(backups(h.files).length, 0);
		} finally { confirm.restore(); }
	});

	it("leaves setting groups an older export does not carry as they are", async () => {
		const confirm = stubConfirm(true);
		try {
			const target = vault(r => { r.settings.headingCallouts.enabled = false; r.settings.language = "he"; });
			const file = JSON.parse(vault(r => { r.settings.globalStyle.borderRadius = 9; }).exportToJSONv2()) as { settings: Record<string, unknown> };
			delete file.settings.headingCallouts;
			delete file.settings.language;
			const h = run(target);
			await processImportedJSON(h.ctx, fileOf(JSON.stringify(file)));
			assert.equal(target.settings.headingCallouts.enabled, false, "a group the file lacks was reset to its default");
			assert.equal(target.settings.language, "he", "a group the file lacks was reset to its default");
			assert.equal(target.settings.globalStyle.borderRadius, 9, "a group the file carries was not restored");
		} finally { confirm.restore(); }
	});

	it("applies nothing while saving is paused", async () => {
		const confirm = stubConfirm(true);
		try {
			const target = vault(r => { r.add(definition({ id: "mine", displayName: "Before" })); });
			const source = vault(r => { r.add(definition({ id: "mine", displayName: "After" })); });
			const h = run(target, { ...savingWriter(), isFrozen: true });
			await processImportedJSON(h.ctx, fileOf(source.exportToJSONv2()));
			assert.equal(target.get("mine")?.displayName, "Before");
			assert.ok(h.notices.includes(en["notice.blockedWhilePaused"]!));
		} finally { confirm.restore(); }
	});

	it("says the import is not saved when the settings file does not hold it", async () => {
		const confirm = stubConfirm(true);
		try {
			const target = vault();
			const source = vault(r => { r.add(definition({ id: "new-one", displayName: "New" })); });
			const h = run(target, { ...savingWriter(), persists: () => false });
			await processImportedJSON(h.ctx, fileOf(source.exportToJSONv2()));
			assert.ok(h.notices.includes(en["import.notSaved"]!), "a failed save was reported as an import");
			assert.ok(!h.notices.some(notice => notice.startsWith("Imported")));
		} finally { confirm.restore(); }
	});
});
