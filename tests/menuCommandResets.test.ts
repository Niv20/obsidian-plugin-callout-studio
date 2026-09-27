import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App, Modal } from "obsidian";
import { DEFAULT_CONTEXT_MENU_ITEMS, DEFAULT_SETTINGS } from "../src/constants";
import { FIXED_COMMAND_IDS, type FixedCommandId } from "../src/editor/commands";
import { CommandBuilderModal, type CommandBuilderHost } from "../src/settings/CommandBuilderModal";
import { MenuCustomizationModal } from "../src/settings/MenuCustomizationModal";
import type { CalloutRenderRole } from "../src/types";
import { asEl, el, installFakeDom, type FakeElement } from "./support/fakeDom";
import { createdToggles as toggles } from "./support/obsidianStub";

installFakeDom();
Object.assign(window, { matchMedia: () => ({ matches: true }) });

function mountModal(modal: Modal, app: App): FakeElement {
	toggles.length = 0;
	const container = el({ cls: "modal-container" });
	const modalEl = container.createDiv({ cls: "modal" });
	const content = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, {
		app,
		containerEl: asEl(container),
		modalEl: asEl(modalEl),
		contentEl: asEl(content),
		titleEl: asEl(modalEl.createDiv()),
	});
	void modal.onOpen();
	return content;
}

function resetButtons(content: FakeElement): FakeElement[] {
	return content.querySelectorAll(".cs-reset-heading")
		.map((heading) => heading.querySelector(".clickable-icon")!);
}

const roles: CalloutRenderRole[] = ["heading", "inline", "regular"];

describe("right-click category reset", () => {
	it("restores each category's enabled flags and exact order without touching another category", () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		for (const role of roles) {
			settings.contextMenu.items[role].reverse();
			settings.contextMenu.items[role][0]!.enabled = false;
		}
		const defaultsBefore = structuredClone(DEFAULT_CONTEXT_MENU_ITEMS);
		let saves = 0;
		const app = {} as App;
		const modal = new MenuCustomizationModal(app, {
			settings,
			saveSettings: async () => { saves++; },
		});
		const content = mountModal(modal, app);
		try {
			const buttons = resetButtons(content);
			assert.equal(buttons.length, 3);
			roles.forEach((role, index) => {
				const otherRoles = roles.filter((other) => other !== role);
				const untouched = otherRoles.map((other) => structuredClone(settings.contextMenu.items[other]));
				assert.equal(buttons[index]!.hasClass("cs-hidden"), false);
				buttons[index]!.fire("click");
				assert.deepEqual(settings.contextMenu.items[role], DEFAULT_CONTEXT_MENU_ITEMS[role]);
				assert.deepEqual(otherRoles.map((other) => settings.contextMenu.items[other]), untouched);
				assert.notEqual(settings.contextMenu.items[role], DEFAULT_CONTEXT_MENU_ITEMS[role]);
				assert.notEqual(settings.contextMenu.items[role][0], DEFAULT_CONTEXT_MENU_ITEMS[role][0]);
				assert.equal(buttons[index]!.hasClass("cs-hidden"), true);
				const list = content.querySelectorAll(".cs-menu-customize-list")[index]!;
				assert.deepEqual(list.querySelectorAll(".cs-menu-row").map((row) => row.dataset.csItemId),
					DEFAULT_CONTEXT_MENU_ITEMS[role].map((item) => item.id));
			});
			assert.equal(saves, 3);
			assert.deepEqual(DEFAULT_CONTEXT_MENU_ITEMS, defaultsBefore);
		} finally { modal.onClose(); }
	});

	it("shows the reset after a keyboard reorder or toggle and hides it after restoration", async () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		const app = {} as App;
		const modal = new MenuCustomizationModal(app, { settings, saveSettings: async () => {} });
		const content = mountModal(modal, app);
		try {
			const [reset] = resetButtons(content);
			assert.ok(reset);
			assert.equal(reset.hasClass("cs-hidden"), true);
			content.querySelector(".cs-drag-handle")!.fire("keydown", {
				key: "ArrowDown", preventDefault: () => {},
			});
			assert.equal(reset.hasClass("cs-hidden"), false);
			reset.fire("click");
			assert.equal(reset.hasClass("cs-hidden"), true);
			// The most recently rendered heading controls belong to the reset list.
			const first = toggles[toggles.length - DEFAULT_CONTEXT_MENU_ITEMS.heading.length]!;
			await first.commit(false);
			assert.equal(reset.hasClass("cs-hidden"), false);
			assert.equal(DEFAULT_CONTEXT_MENU_ITEMS.heading[0]!.enabled, true);
			reset.fire("click");
			assert.deepEqual(settings.contextMenu.items.heading, DEFAULT_CONTEXT_MENU_ITEMS.heading);
		} finally { modal.onClose(); }
	});
});

describe("built-in commands reset", () => {
	it("re-enables only disabled built-ins, refreshes their rows, and preserves user hotkeys", async () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		settings.disabledFixedCommands = [FIXED_COMMAND_IDS[1], FIXED_COMMAND_IDS[3]];
		const enabled: FixedCommandId[] = [];
		const customKeys = { "callout-studio:create-callout": [{ modifiers: ["Ctrl"], key: "K" }] };
		const app = { hotkeyManager: { customKeys } } as unknown as App;
		const host = {
			settings,
			manifest: { id: "callout-studio", name: "Callout Studio" },
			registry: { onChange() {}, offChange() {} },
			customCommands: { list: () => [] },
			setFixedCommandEnabled: async (id: FixedCommandId, value: boolean) => {
				if (value) {
					enabled.push(id);
					settings.disabledFixedCommands = settings.disabledFixedCommands.filter((disabled) => disabled !== id);
				} else settings.disabledFixedCommands.push(id);
			},
		} as unknown as CommandBuilderHost;
		const modal = new CommandBuilderModal(app, host);
		const content = mountModal(modal, app);
		try {
			const [reset] = resetButtons(content);
			assert.ok(reset && !reset.hasClass("cs-hidden"));
			assert.equal(content.querySelectorAll(".cs-command-fixed-row.is-disabled").length, 2);
			reset.fire("click");
			await setImmediate();
			assert.deepEqual(enabled, [FIXED_COMMAND_IDS[1], FIXED_COMMAND_IDS[3]]);
			assert.deepEqual(settings.disabledFixedCommands, []);
			assert.equal(content.querySelectorAll(".cs-command-fixed-row.is-disabled").length, 0);
			assert.equal(reset.hasClass("cs-hidden"), true);
			assert.deepEqual(customKeys, {
				"callout-studio:create-callout": [{ modifiers: ["Ctrl"], key: "K" }],
			});
			const first = toggles[toggles.length - FIXED_COMMAND_IDS.length]!;
			await first.commit(false);
			assert.equal(reset.hasClass("cs-hidden"), false);
		} finally { modal.onClose(); }
	});
});
