/**
 * One step back for **Replace in vault** and **Delete**, which rewrite every
 * note using a callout and used to have no undo. Undo restores each note that
 * still holds what the rewrite left, skips one edited since, and after a
 * delete brings the callout type back with its notes.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { createIconResolver } from "../src/icons/resolver";
import { packFor } from "../src/icons/registry";
import { handleCalloutDelete, handleCalloutReplace } from "../src/settings/sections/calloutVaultActions";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { DeleteCalloutModal } from "../src/utils/DeleteCalloutModal";
import { ReplaceCalloutModal } from "../src/utils/ReplaceCalloutModal";
import { canUndo, keepForUndo, NoteRewriteJournal } from "../src/utils/noteRewriteUndo";
import { en } from "../src/i18n/en";
import { Notice } from "./support/obsidianStub";
import { definition } from "./support/discoveryHarness";
import { savingWriter } from "./support/importSafetyStubs";
import { fakeDom, FakeElement, type FakeDocumentFragment } from "./support/fakeDom";

fakeDom.light();

function vault(notes: Record<string, string>) {
	const contents = new Map(Object.entries(notes));
	const handles = [...contents.keys()].map(path => ({ path }));
	const app = { vault: {
		getMarkdownFiles: () => handles,
		getAbstractFileByPath: (path: string) => handles.find(file => file.path === path) ?? null,
		cachedRead: (file: { path: string }) => Promise.resolve(contents.get(file.path)!),
		process: (file: { path: string }, fn: (text: string) => string) => {
			contents.set(file.path, fn(contents.get(file.path)!));
			return Promise.resolve();
		},
	} } as unknown as App;
	const registry = new CalloutRegistry(); registry.load(null);
	const def = definition({ id: "owned", displayName: "Owned" });
	registry.add(def);
	let saves = 0;
	const ctx = { app, display: () => {}, plugin: {
		registry, settingsWriter: savingWriter(), saveSettings: () => { saves++; return Promise.resolve(); },
	} } as unknown as SettingsSectionContext;
	return { app, ctx, def, registry, contents, get saves() { return saves; } };
}

/** Press the Undo link in the most recent notice. */
async function undo(): Promise<void> {
	// A fragment is a bag of nodes, not a tree: the link is one of its children.
	const message = Notice.last?.message as FakeDocumentFragment | undefined;
	const link = message?.childNodes.find((node): node is FakeElement => node instanceof FakeElement && node.hasClass("cs-notice-action"));
	assert.ok(link, "the notice offers no Undo");
	assert.equal(link.textContent, en["vault.undoRewrite"]);
	link.fire("click", { type: "click", preventDefault: () => {} });
	for (let i = 0; i < 5; i++) await setImmediate();
}

describe("undoing a note rewrite", () => {
	it("puts back every note Replace in vault changed", async () => {
		const h = vault({ "a.md": "> [!owned] A", "b.md": "Before [!owned]{pill} after" });
		const before = new Map(h.contents);
		const prompt = Object.getOwnPropertyDescriptor(ReplaceCalloutModal.prototype, "prompt")!;
		ReplaceCalloutModal.prototype.prompt = () => Promise.resolve({ action: "replace", replaceWith: "note" });
		try {
			await handleCalloutReplace(h.ctx, h.def);
			assert.notEqual(h.contents.get("a.md"), before.get("a.md"));
			await undo();
			assert.deepEqual(h.contents, before);
		} finally { Object.defineProperty(ReplaceCalloutModal.prototype, "prompt", prompt); }
	});

	it("leaves a note edited since the rewrite as it is, and says so", async () => {
		const h = vault({ "a.md": "> [!owned] A", "b.md": "> [!owned] B" });
		const prompt = Object.getOwnPropertyDescriptor(ReplaceCalloutModal.prototype, "prompt")!;
		ReplaceCalloutModal.prototype.prompt = () => Promise.resolve({ action: "replace", replaceWith: "note" });
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		try {
			await handleCalloutReplace(h.ctx, h.def);
			h.contents.set("b.md", "typed after the rewrite");
			await undo();
			assert.equal(h.contents.get("a.md"), "> [!owned] A");
			assert.equal(h.contents.get("b.md"), "typed after the rewrite");
			assert.ok(notices.some(text => typeof text === "string" && text.startsWith("Restored 1 note(s). 1 note(s) changed after the rewrite")));
		} finally {
			Object.defineProperty(ReplaceCalloutModal.prototype, "prompt", prompt);
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
		}
	});

	it("brings a deleted callout type back with its notes", async () => {
		const h = vault({ "a.md": "> [!owned] Kept text" });
		const prompt = Object.getOwnPropertyDescriptor(DeleteCalloutModal.prototype, "prompt")!;
		DeleteCalloutModal.prototype.prompt = () => Promise.resolve("delete");
		try {
			await handleCalloutDelete(h.ctx, h.def, { fileCount: 1, totalCount: 1 });
			assert.equal(h.registry.has("owned"), false);
			assert.equal(h.contents.get("a.md"), "Kept text");
			await undo();
			assert.equal(h.contents.get("a.md"), "> [!owned] Kept text");
			assert.equal(h.registry.has("owned"), true);
		} finally { Object.defineProperty(DeleteCalloutModal.prototype, "prompt", prompt); }
	});

	it("undoes only the most recent rewrite, and never an empty one", () => {
		const first = new NoteRewriteJournal(), second = new NoteRewriteJournal();
		first.record("a.md", "x", "y");
		second.record("b.md", "x", "y");
		assert.equal(keepForUndo(first), true);
		assert.equal(keepForUndo(second), true);
		assert.equal(canUndo(first), false);
		assert.equal(canUndo(second), true);
		assert.equal(keepForUndo(new NoteRewriteJournal()), false);
	});

	it("restores a deleted callout's cached artwork without downloading it again", async () => {
		const h = vault({ "a.md": "> [!owned] Kept text" });
		const icon = { type: "material", value: "star", style: "outlined", weight: 400 } as const;
		h.registry.update("owned", { icon });
		const def = h.registry.get("owned")!;
		const artwork = { pack: icon.type, name: icon.value,
			variant: packFor(icon)!.cacheVariant(icon, "regular"),
			svg: '<svg viewBox="0 0 24 24"><path d="M0 0h24v24z"/></svg>' };
		h.registry.addIconSvg(artwork);
		const resolver = createIconResolver(h.registry);
		assert.equal(resolver.resolveSvg(icon, "regular"), artwork.svg);
		const prompt = Object.getOwnPropertyDescriptor(DeleteCalloutModal.prototype, "prompt")!;
		DeleteCalloutModal.prototype.prompt = () => Promise.resolve("delete");
		try {
			await handleCalloutDelete(h.ctx, def, { fileCount: 1, totalCount: 1 });
			assert.equal(resolver.resolveSvg(icon, "regular"), null, "unused artwork is cleaned up on delete");
			await undo();
			assert.equal(h.registry.has("owned"), true);
			assert.equal(resolver.resolveSvg(icon, "regular"), artwork.svg);
		} finally { Object.defineProperty(DeleteCalloutModal.prototype, "prompt", prompt); }
	});
});
