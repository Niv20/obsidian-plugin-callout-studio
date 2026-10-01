/**
 * The command editor's Save is dimmed, not disabled, while the form describes
 * nothing it can save — pressing it names what is wrong instead of going quiet.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { DEFAULT_SETTINGS } from "../src/constants";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CommandEditorModal, type CommandEditorHost, type CommandEditorOptions } from "../src/settings/CommandEditorModal";
import type { CustomCommandDraft } from "../src/editor/CustomCommandManager";
import { commandSignature } from "../src/utils/customCommands";
import { fakeDom } from "./support/fakeDom";
import { Notice } from "./support/obsidianStub";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

function open(options: CommandEditorOptions = {}) {
	fakeDom.light();
	const registry = new CalloutRegistry();
	registry.load(null);
	const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
	const host = { app, registry, settings: structuredClone(DEFAULT_SETTINGS) } as unknown as CommandEditorHost;
	const modal = new CommandEditorModal(app, host, options);
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const titleEl = modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, { containerEl, modalEl, titleEl, contentEl, app, scope: app.scope,
		setTitle: (title: string) => { titleEl.setText(title); return modal; },
		open: () => modal.onOpen(), close: () => modal.onClose() });
	let answer: CustomCommandDraft | null | undefined;
	void modal.openAndWait().then((result) => { answer = result; });
	const save = modalEl.querySelector(".cs-modal-footer button.mod-cta")!;
	assert.ok(save);
	return { modal, save, registry, answer: () => answer,
		choose: (id: string) => { (modal as unknown as { calloutId: string }).calloutId = id; (modal as unknown as { syncVisibility(): void }).syncVisibility(); },
		destroy: () => { modal.onClose(); containerEl.remove(); } };
}

describe("the command editor's Save", () => {
	it("is live for a callout that exists, and saves on a press", async () => {
		const h = open();
		try {
			assert.equal(h.save.getAttribute("aria-disabled"), "false");
			h.save.fire("click"); await setImmediate();
			assert.equal(h.answer()?.calloutId, "note");
		} finally { h.destroy(); }
	});
	it("is dimmed when no callout is chosen, and says to choose one", async () => {
		const h = open();
		try {
			h.choose("");
			assert.equal(h.save.getAttribute("aria-disabled"), "true");
			assert.equal(h.save.hasClass("cs-btn-disabled"), true);
			assert.notEqual((h.save as unknown as { disabled?: boolean }).disabled, true, "a disabled button would swallow the press");
			h.save.fire("click"); await setImmediate();
			assert.equal(String(Notice.last?.message), t("commandBuilder.noCalloutChosen"));
			assert.equal(h.answer(), undefined, "the window stays open");
		} finally { h.destroy(); }
	});
	it("is dimmed when the chosen callout was deleted while the window sat open", async () => {
		const h = open();
		try {
			h.choose("deleted-meanwhile");
			h.save.fire("click"); await setImmediate();
			assert.equal(String(Notice.last?.message), t("commandBuilder.noCalloutChosen"));
			assert.equal(h.answer(), undefined);
		} finally { h.destroy(); }
	});
	it("says there are no callouts to build from when the list is empty", () => {
		const none = {
			getBuiltIn: () => [], getUserDefined: () => [], getThemeProvided: () => [], get: () => undefined,
		};
		const modal = new CommandEditorModal({} as App, { registry: none } as unknown as CommandEditorHost);
		assert.equal((modal as unknown as { saveBlockedReason(): string | null }).saveBlockedReason(), t("commandBuilder.noCallouts"));
	});
	it("is dimmed for a command the user already has, and says so", async () => {
		const taken = commandSignature({ calloutId: "note", role: "regular", action: "insert" });
		const h = open({ takenSignatures: new Set([taken]) });
		try {
			assert.equal(h.save.getAttribute("aria-disabled"), "true");
			h.save.fire("click"); await setImmediate();
			assert.equal(String(Notice.last?.message), t("commandBuilder.duplicate"));
			assert.equal(h.answer(), undefined);
			// A different callout is a different command, so the same press now saves.
			h.choose("tip");
			assert.equal(h.save.getAttribute("aria-disabled"), "false");
			h.save.fire("click"); await setImmediate();
			assert.equal(h.answer()?.calloutId, "tip");
		} finally { h.destroy(); }
	});
});
