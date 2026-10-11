/**
 * Deleting a custom callout removes its definition, and only that. While
 * saving is paused the removal cannot be kept — the type would come back on
 * the next launch as if Delete had never been pressed — so nothing starts:
 * not before the dialog, and not after it when saving paused while it was open.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { handleCalloutDelete } from "../src/settings/sections/calloutVaultActions";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { en } from "../src/i18n/en";
import { definition } from "./support/discoveryHarness";
import { savingWriter, stubConfirm } from "./support/importSafetyStubs";

function setup() {
	const notices: string[] = [];
	(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
	const registry = new CalloutRegistry();
	registry.load(null);
	const def = definition({ id: "owned", displayName: "Owned" });
	registry.add(def);
	const contents = new Map([["note.md", "> [!owned] Kept"]]);
	const handles = [...contents.keys()].map((path) => ({ path }));
	const app = { vault: {
		getMarkdownFiles: () => handles,
		getAbstractFileByPath: (path: string) => handles.find((file) => file.path === path),
		cachedRead: (file: { path: string }) => Promise.resolve(contents.get(file.path)!),
		process: (file: { path: string }, transform: (text: string) => string) => {
			contents.set(file.path, transform(contents.get(file.path)!));
			return Promise.resolve();
		},
	} } as unknown as App;
	const writer = savingWriter();
	const ctx = { app, display: () => {}, plugin: {
		registry, settingsWriter: writer, saveSettings: () => Promise.resolve(), refreshCallouts: () => {},
	} } as unknown as SettingsSectionContext;
	return { ctx, def, registry, contents, writer, notices };
}

describe("deleting a callout while saving is paused", () => {
	it("removes nothing and asks nothing", async () => {
		const h = setup();
		h.writer.isFrozen = true;
		const confirm = stubConfirm(true);
		try {
			await handleCalloutDelete(h.ctx, h.def);
			assert.equal(confirm.asked.length, 0);
			assert.equal(h.contents.get("note.md"), "> [!owned] Kept");
			assert.equal(h.registry.has("owned"), true);
			assert.ok(h.notices.includes(en["notice.blockedWhilePaused"]!));
		} finally { confirm.restore(); }
	});

	it("removes nothing when saving paused while the dialog was open", async () => {
		const h = setup();
		const confirm = stubConfirm(() => { h.writer.isFrozen = true; return true; });
		try {
			await handleCalloutDelete(h.ctx, h.def);
			assert.equal(confirm.asked.length, 1);
			assert.equal(h.contents.get("note.md"), "> [!owned] Kept");
			assert.equal(h.registry.has("owned"), true);
		} finally { confirm.restore(); }
	});
});
