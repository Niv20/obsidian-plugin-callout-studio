/**
 * Convert uses to plain text asks for a complete conversion. A note that
 * cannot be written stops it with a notice, the notes already converted stay
 * converted, and running it again finishes the rest. The type is never
 * touched — removing it is Delete's job, not this one's.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { handleClearCalloutUsages } from "../src/settings/sections/calloutVaultActions";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import type { CalloutDefinition } from "../src/types";
import { en } from "../src/i18n/en";
import { savingWriter, stubConfirm } from "./support/importSafetyStubs";
// The completion notice is a fragment with an Undo link.
import "./support/fakeDom";

describe("converting uses after a failed write", () => {
	it("keeps what converted, reports the rest, and completes on a retry", async () => {
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		const registry = new CalloutRegistry(); registry.load(null);
		const def: CalloutDefinition = {
			id: "owned", displayName: "Owned", icon: { type: "emoji", value: "📝" },
			colorLight: "#123456", colorDark: "#123456", foldable: true,
			defaultFolded: false, builtIn: false, source: "user",
		};
		registry.add(def);
		const contents = new Map([["first.md", "> [!owned] First"], ["second.md", "> [!owned] Second"]]);
		const handles = [...contents.keys()].map(path => ({ path }));
		let failing = true, saves = 0;
		const app = { vault: {
			getMarkdownFiles: () => handles,
			getAbstractFileByPath: (path: string) => handles.find(file => file.path === path),
			cachedRead: async (file: { path: string }) => contents.get(file.path)!,
			process: async (file: { path: string }, transform: (text: string) => string) => {
				if (failing && file.path === "second.md") throw new Error("EPERM");
				contents.set(file.path, transform(contents.get(file.path)!));
			},
		} } as unknown as App;
		const ctx = { app, display: () => {}, plugin: {
			registry, settingsWriter: savingWriter(), saveSettings: async () => { saves++; },
		} } as unknown as SettingsSectionContext;
		const confirm = stubConfirm(true), warn = console.warn;
		console.warn = () => {};
		try {
			await handleClearCalloutUsages(ctx, def);
			assert.ok(notices.includes(en["notice.calloutDeleteIncomplete"]!));
			assert.equal(contents.get("first.md"), "First");
			assert.equal(contents.get("second.md"), "> [!owned] Second");
			failing = false;
			await handleClearCalloutUsages(ctx, def);
			assert.equal(contents.get("first.md"), "First");
			assert.equal(contents.get("second.md"), "Second");
			assert.equal(registry.has("owned"), true, "converting never removes the type");
			assert.equal(saves, 0, "nothing about the type changed, so nothing is saved");
		} finally {
			confirm.restore(); console.warn = warn;
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
		}
	});
});
