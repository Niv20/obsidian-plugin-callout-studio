/**
 * Deleting a custom callout converts its notes first and removes the row after.
 * While saving is paused the removal cannot be kept: the notes would lose their
 * callouts now, and the type would come back on the next launch with nothing
 * left to style. So neither half starts — before the dialog, or after it when
 * saving paused while it was open.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { handleCalloutDelete } from "../src/settings/sections/calloutVaultActions";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { DeleteCalloutModal } from "../src/utils/DeleteCalloutModal";
import { en } from "../src/i18n/en";
import { definition } from "./support/discoveryHarness";
import { savingWriter } from "./support/importSafetyStubs";

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
		registry, settingsWriter: writer, saveSettings: () => Promise.resolve(),
	} } as unknown as SettingsSectionContext;
	return { ctx, def, registry, contents, writer, notices };
}

function stubPrompt(answer: () => "delete"): { prompts: () => number; restore(): void } {
	const saved = Object.getOwnPropertyDescriptor(DeleteCalloutModal.prototype, "prompt")!;
	let prompts = 0;
	DeleteCalloutModal.prototype.prompt = () => { prompts++; return Promise.resolve(answer()); };
	return { prompts: () => prompts, restore: () => Object.defineProperty(DeleteCalloutModal.prototype, "prompt", saved) };
}

describe("deleting a callout while saving is paused", () => {
	it("converts no note and asks nothing", async () => {
		const h = setup();
		h.writer.isFrozen = true;
		const prompt = stubPrompt(() => "delete");
		try {
			await handleCalloutDelete(h.ctx, h.def, { fileCount: 1, totalCount: 1 });
			assert.equal(prompt.prompts(), 0);
			assert.equal(h.contents.get("note.md"), "> [!owned] Kept");
			assert.equal(h.registry.has("owned"), true);
			assert.ok(h.notices.includes(en["notice.blockedWhilePaused"]!));
		} finally { prompt.restore(); }
	});

	it("converts no note when saving paused while the dialog was open", async () => {
		const h = setup();
		const prompt = stubPrompt(() => { h.writer.isFrozen = true; return "delete"; });
		try {
			await handleCalloutDelete(h.ctx, h.def, { fileCount: 1, totalCount: 1 });
			assert.equal(prompt.prompts(), 1);
			assert.equal(h.contents.get("note.md"), "> [!owned] Kept");
			assert.equal(h.registry.has("owned"), true);
		} finally { prompt.restore(); }
	});
});
