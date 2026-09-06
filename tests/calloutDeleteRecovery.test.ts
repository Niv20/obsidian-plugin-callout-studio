import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { handleCalloutDelete } from "../src/settings/sections/calloutVaultActions";
import { DeleteCalloutModal } from "../src/utils/DeleteCalloutModal";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import type { CalloutDefinition } from "../src/types";

describe("delete after complete conversion", () => {
	it("keeps the definition on a failed write and completes an idempotent retry", async () => {
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
			registry, saveSettings: async () => { saves++; },
		} } as unknown as SettingsSectionContext;
		const prompt = Object.getOwnPropertyDescriptor(DeleteCalloutModal.prototype, "prompt")!, warn = console.warn;
		DeleteCalloutModal.prototype.prompt = async () => "delete"; console.warn = () => {};
		try {
			await handleCalloutDelete(ctx, def, { fileCount: 2, totalCount: 2 });
			assert.equal(registry.has("owned"), true); assert.equal(saves, 0);
			assert.equal(contents.get("first.md"), "First");
			assert.equal(contents.get("second.md"), "> [!owned] Second");
			failing = false;
			// Even a stale zero-usage menu must run the final conversion pass.
			await handleCalloutDelete(ctx, def, { fileCount: 0, totalCount: 0 });
			assert.equal(registry.has("owned"), false); assert.equal(saves, 1);
			assert.equal(contents.get("first.md"), "First");
			assert.equal(contents.get("second.md"), "Second");
		} finally { Object.defineProperty(DeleteCalloutModal.prototype, "prompt", prompt); console.warn = warn; }
	});
});
