/**
 * Delete removes a callout's definition and never touches a note. Notes that
 * still write `[!id]` keep it and fall back to the default style. A callout
 * nothing uses goes at once; one in use, or the default fallback callout,
 * asks first. Undo puts the type back — and, for the fallback, its place.
 *
 * Turning the uses into plain text is a separate action on every row, and its
 * confirmation says truthfully who keeps the type afterwards.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App, Menu } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import {
	handleCalloutDelete,
	handleClearCalloutUsages,
} from "../src/settings/sections/calloutVaultActions";
import { addConvertUsesItem, addDeleteItem } from "../src/settings/sections/rowOwnership";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { DEFAULT_SETTINGS } from "../src/constants";
import { en } from "../src/i18n/en";
import { t } from "../src/i18n";
import { Notice } from "./support/obsidianStub";
import { definition } from "./support/discoveryHarness";
import { savingWriter, stubConfirm } from "./support/importSafetyStubs";
import { readRepoFile } from "./support/sourceScan";
import { fakeDom, FakeElement, type FakeDocumentFragment } from "./support/fakeDom";

fakeDom.light();

function vault(notes: Record<string, string>, opts: { unreadable?: string; theme?: string } = {}) {
	const contents = new Map(Object.entries(notes));
	const handles = [...contents.keys()].map(path => ({ path }));
	const app = {
		customCss: { theme: opts.theme ?? "" },
		vault: {
			getMarkdownFiles: () => handles,
			getAbstractFileByPath: (path: string) => handles.find(file => file.path === path) ?? null,
			cachedRead: (file: { path: string }) => file.path === opts.unreadable
				? Promise.reject(new Error("EIO"))
				: Promise.resolve(contents.get(file.path)!),
			process: (file: { path: string }, fn: (text: string) => string) => {
				contents.set(file.path, fn(contents.get(file.path)!));
				return Promise.resolve();
			},
		},
	} as unknown as App;
	const registry = new CalloutRegistry(); registry.load(null);
	const def = definition({ id: "owned", displayName: "Owned" });
	registry.add(def);
	const writer = savingWriter();
	let saves = 0, refreshes = 0;
	const ctx = { app, display: () => {}, plugin: {
		registry, settingsWriter: writer, saveSettings: () => { saves++; return Promise.resolve(); },
		refreshCallouts: () => { refreshes++; },
	} } as unknown as SettingsSectionContext;
	return { ctx, def, registry, contents, writer, get saves() { return saves; }, get refreshes() { return refreshes; } };
}

function collectNotices(): { notices: string[]; done(): void } {
	const notices: string[] = [];
	(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
	Notice.last = null;
	return { notices, done: () => { delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__; } };
}

/** The text of the most recent notice, whether a plain string or a fragment. */
function lastNoticeText(): string {
	const message = Notice.last?.message;
	if (typeof message === "string") return message;
	const frag = message as FakeDocumentFragment | undefined;
	return frag?.childNodes.map(node => node.textContent ?? "").join(" ") ?? "";
}

/** Press the Undo link in the most recent notice. */
async function undo(): Promise<void> {
	const message = Notice.last?.message as FakeDocumentFragment | undefined;
	const link = message?.childNodes.find((node): node is FakeElement => node instanceof FakeElement && node.hasClass("cs-notice-action"));
	assert.ok(link, "the notice offers no Undo");
	link.fire("click", { type: "click", preventDefault: () => {} });
	for (let i = 0; i < 5; i++) await setImmediate();
}

describe("Delete removes only the definition", () => {
	it("deletes a callout nothing uses at once, and Undo brings it back", async () => {
		const h = vault({ "a.md": "plain text" });
		const confirm = stubConfirm(true), seen = collectNotices();
		try {
			await handleCalloutDelete(h.ctx, h.def);
			assert.equal(confirm.asked.length, 0, "nothing in use, so nothing to ask");
			assert.equal(h.registry.has("owned"), false);
			assert.ok(lastNoticeText().includes(t("notice.calloutDeleted", { name: "Owned" })));
			await undo();
			assert.equal(h.registry.has("owned"), true);
		} finally { confirm.restore(); seen.done(); }
	});

	it("asks before deleting a callout in use, and leaves every note as it was", async () => {
		const notes = { "a.md": "> [!owned] Kept\n> body", "b.md": "Text\n\n> [!owned]+ Two" };
		const h = vault(notes);
		const confirm = stubConfirm(true), seen = collectNotices();
		try {
			await handleCalloutDelete(h.ctx, h.def);
			assert.deepEqual(confirm.asked, [t("deleteModal.title", { name: "Owned" })]);
			assert.equal(confirm.labels[0], undefined, "the default red Delete");
			const message = confirm.messages[0] as string;
			assert.ok(message.includes(t("deleteModal.bodyInUse", { count: "2", files: "2" })));
			assert.ok(message.includes(en["deleteModal.notesUntouched"]!));
			assert.equal(h.registry.has("owned"), false);
			for (const [path, text] of Object.entries(notes)) assert.equal(h.contents.get(path), text);
			assert.equal(h.refreshes, 1, "the notes keep their callouts, so they are repainted");
		} finally { confirm.restore(); seen.done(); }
	});

	it("keeps the callout when the question is declined", async () => {
		const h = vault({ "a.md": "> [!owned] Kept" });
		const confirm = stubConfirm(false);
		try {
			await handleCalloutDelete(h.ctx, h.def);
			assert.equal(h.registry.has("owned"), true);
			assert.equal(h.saves, 0);
		} finally { confirm.restore(); }
	});

	it("neither asks nor deletes when the notes could not all be read", async () => {
		const h = vault({ "a.md": "plain", "b.md": "> [!owned] Kept" }, { unreadable: "b.md" });
		const confirm = stubConfirm(true), seen = collectNotices(), warn = console.warn;
		console.warn = () => {};
		try {
			await handleCalloutDelete(h.ctx, h.def);
			assert.equal(confirm.asked.length, 0);
			assert.equal(h.registry.has("owned"), true, "a partial count is never proof of no use");
			assert.ok(seen.notices.some(text => text.startsWith(en["notice.vaultScanFailed"]!.split("{{")[0]!)));
		} finally { confirm.restore(); seen.done(); console.warn = warn; }
	});

	it("asks before deleting the default fallback callout, and Undo makes it the fallback again", async () => {
		const h = vault({ "a.md": "plain text" });
		h.registry.settings.fallbackCalloutId = "owned";
		const confirm = stubConfirm(true), seen = collectNotices();
		try {
			await handleCalloutDelete(h.ctx, h.def);
			assert.equal(confirm.asked.length, 1, "unused, but every unknown callout changes with it");
			const message = confirm.messages[0] as string;
			assert.equal(message, t("deleteModal.fallbackTarget", { fallback: "Note" }),
				"nothing uses it, so only the fallback line");
			assert.equal(h.registry.has("owned"), false);
			assert.equal(h.registry.settings.fallbackCalloutId, DEFAULT_SETTINGS.fallbackCalloutId);
			await undo();
			assert.equal(h.registry.has("owned"), true);
			assert.equal(h.registry.settings.fallbackCalloutId, "owned");
		} finally { confirm.restore(); seen.done(); }
	});

	it("leaves a fallback picked since the delete alone on Undo", async () => {
		const h = vault({ "a.md": "plain text" });
		h.registry.settings.fallbackCalloutId = "owned";
		const confirm = stubConfirm(true), seen = collectNotices();
		try {
			await handleCalloutDelete(h.ctx, h.def);
			h.registry.settings.fallbackCalloutId = "tip";
			await undo();
			assert.equal(h.registry.has("owned"), true);
			assert.equal(h.registry.settings.fallbackCalloutId, "tip");
		} finally { confirm.restore(); seen.done(); }
	});

	it("does not overwrite a callout made again under the same id", async () => {
		const h = vault({ "a.md": "plain text" });
		const confirm = stubConfirm(true), seen = collectNotices();
		try {
			await handleCalloutDelete(h.ctx, h.def);
			h.registry.add(definition({ id: "owned", displayName: "Made again" }));
			await undo();
			assert.equal(h.registry.get("owned")?.displayName, "Made again");
		} finally { confirm.restore(); seen.done(); }
	});

	it("does not bring a callout back while saving is paused", async () => {
		const h = vault({ "a.md": "plain text" });
		const confirm = stubConfirm(true), seen = collectNotices();
		try {
			await handleCalloutDelete(h.ctx, h.def);
			h.writer.isFrozen = true;
			await undo();
			assert.equal(h.registry.has("owned"), false);
			assert.ok(seen.notices.includes(en["notice.blockedWhilePaused"]!));
		} finally { confirm.restore(); seen.done(); }
	});
});

describe("Convert uses to plain text says who keeps the type", () => {
	it("says the type stays in your list for a callout of your own, theme or not", async () => {
		const h = vault({ "a.md": "> [!owned] Kept" }, { theme: "Minimal" });
		const confirm = stubConfirm(false);
		try {
			await handleClearCalloutUsages(h.ctx, h.def);
			assert.deepEqual(confirm.asked, [t("convertModal.title", { name: "Owned" })]);
			assert.equal(confirm.labels[0], en["convertModal.confirm"]);
			const message = confirm.messages[0] as string;
			assert.ok(message.includes(en["convertModal.typeStays"]!));
			assert.ok(!message.includes("Minimal"), "the theme does not own this one");
			assert.equal(h.contents.get("a.md"), "> [!owned] Kept", "declined, so nothing converted");
		} finally { confirm.restore(); }
	});

	it("says a built-in stays because Obsidian keeps it", async () => {
		const h = vault({ "a.md": "> [!tip] Kept" }, { theme: "Minimal" });
		const confirm = stubConfirm(false);
		try {
			await handleClearCalloutUsages(h.ctx, h.registry.get("tip")!);
			assert.ok((confirm.messages[0] as string).includes(en["deleteModal.keepsRowBuiltIn"]!));
		} finally { confirm.restore(); }
	});

	it("names the theme for a type the theme supplies", async () => {
		const h = vault({ "a.md": "> [!owned] Kept" }, { theme: "Minimal" });
		h.registry.themeOwns = () => true;
		const confirm = stubConfirm(false);
		try {
			await handleClearCalloutUsages(h.ctx, h.def);
			assert.ok((confirm.messages[0] as string).includes(t("deleteModal.keepsRowTheme", { theme: "Minimal" })));
		} finally { confirm.restore(); }
	});
});

describe("which rows offer which action", () => {
	function fakeMenu(): { menu: Menu; titles: string[] } {
		const titles: string[] = [];
		const item = {
			setTitle(title: string) { titles.push(title); return item; },
			setIcon() { return item; },
			setSection() { return item; },
			setWarning() { return item; },
			onClick() { return item; },
		};
		const menu = { addItem(build: (i: typeof item) => void) { build(item); return menu; } };
		return { menu: menu as unknown as Menu, titles };
	}

	it("offers Delete only where the definition can go", () => {
		const h = vault({});
		const own = fakeMenu(), builtIn = fakeMenu();
		addDeleteItem(own.menu, h.ctx, h.def);
		addDeleteItem(builtIn.menu, h.ctx, h.registry.get("note")!);
		assert.deepEqual(own.titles, [en["settings.deleteAction"]]);
		assert.deepEqual(builtIn.titles, []);
	});

	it("offers Convert unless the callout is known to be unused", () => {
		const h = vault({});
		const unknown = fakeMenu(), used = fakeMenu(), unused = fakeMenu();
		addConvertUsesItem(unknown.menu, h.ctx, h.def, undefined);
		addConvertUsesItem(used.menu, h.ctx, h.def, { fileCount: 1, totalCount: 1 });
		addConvertUsesItem(unused.menu, h.ctx, h.def, { fileCount: 0, totalCount: 0 });
		assert.deepEqual(unknown.titles, [en["settings.convertUsesAction"]]);
		assert.deepEqual(used.titles, [en["settings.convertUsesAction"]]);
		assert.deepEqual(unused.titles, []);
	});

	it("never puts Delete on a built-in row's menu", () => {
		const source = readRepoFile("src/settings/sections/CalloutRowActions.ts");
		const builtIn = source.slice(
			source.indexOf("export async function openBuiltInRowMenu"),
			source.indexOf("export async function openRowMenu"),
		);
		assert.ok(builtIn.includes("addConvertUsesItem"));
		assert.ok(!builtIn.includes("addDeleteItem"));
		assert.ok(!builtIn.includes("settings.deleteAction"));
	});
});
