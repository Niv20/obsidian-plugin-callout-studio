/**
 * "Reset everything" empties the whole setup, and the save after it replaces
 * this device's recovery copy too, so nothing on the device remembers what was
 * there. It used to do that behind a button labelled Delete, with no copy taken
 * first, while saving was paused, and it reported success whether or not the
 * settings file ever held the reset. These pin the guardrails.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Setting, TFile, type App, type ButtonComponent } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { content } from "../src/manager/syncTree";
import { renderResetSection } from "../src/settings/sections/DataManagementSection";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { t } from "../src/i18n";
import { en } from "../src/i18n/en";
import { definition } from "./support/discoveryHarness";
import { fakeDom } from "./support/fakeDom";
import { failWrites, memoryVault, PLUGIN_MANIFEST, savingWriter, stubConfirm } from "./support/importSafetyStubs";

function setup(writer = savingWriter()) {
	const notices: string[] = [];
	(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
	const registry = new CalloutRegistry();
	registry.load(null);
	registry.add(definition({ id: "mine", displayName: "Mine" }));
	const own = memoryVault();
	let saves = 0;
	const ctx = {
		app: { vault: { getMarkdownFiles: () => [] } } as unknown as App,
		plugin: {
			registry, app: own.app, manifest: PLUGIN_MANIFEST, settingsWriter: writer,
			cssInjector: { inject: () => {} },
			saveSettings: () => { saves++; return Promise.resolve(); },
		},
		display: () => {},
	} as unknown as SettingsSectionContext;
	const backups = () => [...own.files.entries()].filter(([path]) => /\/backups\/data-/.test(path));
	return { ctx, registry, notices, writer, own, backups, get saves() { return saves; } };
}

/** The Reset everything button's click handler, as the section wires it. */
function resetButton(ctx: SettingsSectionContext): () => Promise<void> {
	const root = fakeDom.document.body.createDiv();
	const original = Object.getOwnPropertyDescriptor(Setting.prototype, "addButton")!;
	let reset: (() => Promise<void>) | undefined;
	try {
		Setting.prototype.addButton = function (callback): Setting {
			let label = "";
			const button = {
				buttonEl: root.createEl("button"),
				setButtonText(text: string) { label = text; return this; },
				setWarning() { return this; },
				onClick(action: () => Promise<void>) { if (label === t("settings.resetAllButton")) reset = action; return this; },
			} as unknown as ButtonComponent;
			callback(button);
			return this;
		};
		renderResetSection(ctx, root as unknown as HTMLElement);
	} finally { Object.defineProperty(Setting.prototype, "addButton", original); root.remove(); }
	assert.ok(reset, "the section draws a Reset everything button");
	return reset;
}

/** The text of every `tag` element in a confirmation message, in order. */
function textsOf(message: unknown, tag: "LI" | "P"): string[] {
	type Node = { tagName?: string; childNodes?: Node[]; textContent: string };
	const found: string[] = [];
	const walk = (node: Node): void => {
		if (node.tagName === tag) found.push(node.textContent);
		node.childNodes?.forEach(walk);
	};
	walk(message as Node);
	return found;
}
const bullets = (message: unknown): string[] => textsOf(message, "LI");

describe("Reset everything", () => {
	it("names itself, saves a verified backup of the current setup, then resets", async () => {
		const confirm = stubConfirm(true);
		try {
			const h = setup();
			const before = content(h.registry.toSaveData());
			await resetButton(h.ctx)();
			assert.deepEqual(confirm.asked, [en["confirm.titleResetEverything"]]);
			assert.deepEqual(confirm.labels, [en["settings.resetAllButton"]], "the button still says Delete");
			assert.deepEqual(confirm.acknowledgements, [en["confirm.acknowledge"]], "the reset is not gated behind a tick");
			const copies = h.backups();
			assert.equal(copies.length, 1, "no backup was written before the reset");
			assert.deepEqual(content(JSON.parse(copies[0]![1])), before);
			assert.equal(h.registry.has("mine"), false);
			assert.ok(h.notices.includes(en["notice.resetAllDone"]!));
		} finally { confirm.restore(); }
	});

	it("says there is nothing to reset the second time, and asks nothing", async () => {
		const confirm = stubConfirm(true);
		try {
			const h = setup();
			const reset = resetButton(h.ctx);
			await reset();
			await reset();
			assert.equal(confirm.asked.length, 1, "a reset of nothing still asked for a tick");
			assert.equal(h.backups().length, 1, "a reset of nothing backed up an empty setup");
			assert.equal(h.saves, 1);
			assert.ok(h.notices.includes(en["settings.resetNothing"]!));
		} finally { confirm.restore(); }
	});

	it("lists what it deletes as plain bullets, the notes that use a custom type last", async () => {
		const confirm = stubConfirm(false);
		try {
			const h = setup();
			const note = Object.assign(new TFile(), { path: "a.md", extension: "md", stat: { mtime: 1, size: 1 } });
			Object.assign(h.ctx.app, { vault: {
				getMarkdownFiles: () => [note],
				getAbstractFileByPath: () => note,
				cachedRead: () => Promise.resolve("> [!mine] One\n> text\n\n> [!mine] Two\n> text\n"),
			} });
			await resetButton(h.ctx)();
			assert.deepEqual(bullets(confirm.messages[0]), [
				t("settings.resetItemCallouts", { count: 1 }),
				t("settings.resetItemReferences", { count: 2 }),
			]);
			assert.equal(h.registry.has("mine"), true, "declining still reset it");
		} finally { confirm.restore(); }
	});

	it("opens with a reminder and a lead-in of their own before the list of what goes", async () => {
		const confirm = stubConfirm(false);
		try {
			const h = setup();
			await resetButton(h.ctx)();
			assert.deepEqual(textsOf(confirm.messages[0], "P").slice(0, 2), [
				en["settings.resetIntro"],
				en["settings.resetDeletes"],
			], "the lead-in is not a paragraph of its own");
		} finally { confirm.restore(); }
	});

	it("draws no reminder when nothing is deleted, only settings going back to defaults", async () => {
		const confirm = stubConfirm(false);
		try {
			const h = setup();
			h.registry.remove("mine");
			h.registry.settings.fallbackCalloutId = "tip";
			await resetButton(h.ctx)();
			const paragraphs = textsOf(confirm.messages[0], "P");
			assert.ok(!paragraphs.includes(en["settings.resetIntro"]!), "a reminder about what is deleted, with none");
			assert.ok(paragraphs.includes(en["settings.resetRestores"]!));
		} finally { confirm.restore(); }
	});

	it("leaves the notes line out when no note uses a custom type", async () => {
		const confirm = stubConfirm(false);
		try {
			const h = setup();
			await resetButton(h.ctx)();
			assert.deepEqual(bullets(confirm.messages[0]), [t("settings.resetItemCallouts", { count: 1 })]);
		} finally { confirm.restore(); }
	});

	it("refuses while saving is paused, before asking anything", async () => {
		const confirm = stubConfirm(true);
		try {
			const h = setup({ ...savingWriter(), isFrozen: true });
			await resetButton(h.ctx)();
			assert.deepEqual(confirm.asked, []);
			assert.equal(h.registry.has("mine"), true);
			assert.equal(h.backups().length, 0);
			assert.ok(h.notices.includes(en["notice.blockedWhilePaused"]!));
		} finally { confirm.restore(); }
	});

	it("resets nothing when saving paused while the dialog was open", async () => {
		const h = setup();
		const confirm = stubConfirm(() => { h.writer.isFrozen = true; return true; });
		try {
			await resetButton(h.ctx)();
			assert.equal(h.registry.has("mine"), true);
			assert.equal(h.saves, 0);
			assert.ok(h.notices.includes(en["notice.blockedWhilePaused"]!));
		} finally { confirm.restore(); }
	});

	it("resets nothing when the backup cannot be saved", async () => {
		const confirm = stubConfirm(true);
		const error = console.error;
		console.error = () => {};
		try {
			const h = setup();
			failWrites(h.own.app);
			await resetButton(h.ctx)();
			assert.equal(h.registry.has("mine"), true);
			assert.equal(h.saves, 0);
			assert.ok(h.notices.includes(en["settings.resetBackupFailed"]!));
		} finally { confirm.restore(); console.error = error; }
	});

	it("does not claim success when the settings file does not hold the reset", async () => {
		const confirm = stubConfirm(true);
		try {
			const h = setup({ ...savingWriter(), persists: () => false });
			await resetButton(h.ctx)();
			assert.ok(h.notices.includes(en["settings.resetNotSaved"]!));
			assert.ok(!h.notices.includes(en["notice.resetAllDone"]!), "a reset that was not saved was reported done");
		} finally { confirm.restore(); }
	});
});
