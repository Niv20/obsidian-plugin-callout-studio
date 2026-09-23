import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { ToggleComponent } from "obsidian";
import type { App } from "obsidian";
import { DEFAULT_SETTINGS } from "../src/constants";
import { FIXED_COMMAND_IDS, type FixedCommandId } from "../src/editor/commands";
import { CommandBuilderModal, type CommandBuilderHost } from "../src/settings/CommandBuilderModal";
import { installFakeDom } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

installFakeDom();

// The shared Obsidian stub has no toggle implementation. Record its value and
// callback locally; these tests check retained DOM nodes, not browser layout.
const values = new WeakMap<ToggleComponent, boolean>();
const toggles: { component: ToggleComponent; change: (value: boolean) => Promise<void> }[] = [];
const toggleMethods = {
	setValue(this: ToggleComponent, value: boolean): ToggleComponent {
		values.set(this, value);
		return this;
	},
	setTooltip(this: ToggleComponent): ToggleComponent { return this; },
	onChange(this: ToggleComponent, change: (value: boolean) => Promise<void>): ToggleComponent {
		toggles.push({ component: this, change });
		return this;
	},
};
const originalDescriptors = Object.getOwnPropertyDescriptors(ToggleComponent.prototype);
before(() => { Object.assign(ToggleComponent.prototype, toggleMethods); });
after(() => {
	for (const key of Object.keys(toggleMethods)) {
		const original = originalDescriptors[key];
		if (original) Object.defineProperty(ToggleComponent.prototype, key, original);
		else Reflect.deleteProperty(ToggleComponent.prototype, key);
	}
});
beforeEach(() => {
	document.body.empty();
	toggles.length = 0;
});

function descendants(el: Element): Element[] {
	return Array.from(el.children).flatMap((child) => [child, ...descendants(child)]);
}

function openBuilder(id: FixedCommandId, enabled: boolean, save = () => Promise.resolve()) {
	const settings = structuredClone(DEFAULT_SETTINGS);
	settings.disabledFixedCommands = enabled ? [] : [id];
	const changes: [FixedCommandId, boolean][] = [];
	const host = {
		settings,
		manifest: { id: "callout-studio", name: "Callout Studio" },
		registry: { onChange: () => {}, offChange: () => {} },
		customCommands: { list: () => [] },
		setFixedCommandEnabled: (id: FixedCommandId, enabled: boolean): Promise<void> => {
			changes.push([id, enabled]);
			settings.disabledFixedCommands = settings.disabledFixedCommands.filter((item) => item !== id);
			if (!enabled) settings.disabledFixedCommands.push(id);
			return save();
		},
	} as unknown as CommandBuilderHost;
	const app = { keymap: new TestKeymap() } as unknown as App;
	const modal = new CommandBuilderModal(app, host);
	const containerEl = document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const titleEl = modalEl.createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, { app, scope: new TestScope(), containerEl, modalEl, titleEl, contentEl });
	modal.onOpen();
	const rows = Array.from(contentEl.querySelectorAll<HTMLElement>(".cs-command-fixed-row"));
	const index = FIXED_COMMAND_IDS.indexOf(id);
	const row = rows[index];
	const toggle = toggles[index];
	assert.ok(row && toggle);
	const control = row.querySelector<HTMLElement>(".cs-command-row-toggle");
	const hotkey = row.querySelector<HTMLButtonElement>("button");
	const chips = Array.from(row.querySelectorAll<HTMLElement>(".cs-hotkey-chip"));
	assert.ok(control && hotkey);
	control.focus({ preventScroll: true });
	const originalNodes = descendants(contentEl);
	return {
		row, hotkey, chips, settings, changes,
		value: () => values.get(toggle.component),
		change: (value: boolean) => {
			toggle.component.setValue(value);
			return toggle.change(value);
		},
		assertStable: () => {
			const currentNodes = descendants(contentEl);
			assert.equal(currentNodes.length, originalNodes.length);
			currentNodes.forEach((node, i) => assert.ok(node === originalNodes[i], `node ${i} was replaced`));
			assert.equal(toggles.length, FIXED_COMMAND_IDS.length, "no toggle was reconstructed");
			assert.strictEqual(document.activeElement, control);
			assert.ok(contentEl.contains(control), "the focused control remains attached");
		},
	};
}

describe("command toggles keep their existing rows and focus", () => {
	for (const id of FIXED_COMMAND_IDS) {
		for (const enabled of [true, false]) {
			it(`${id}: ${enabled ? "OFF" : "ON"} keeps every node in place`, async () => {
				const h = openBuilder(id, enabled);
				assert.equal(h.hotkey.disabled, !enabled);
				await h.change(!enabled);
				h.assertStable();
				assert.equal(h.row.hasClass("is-disabled"), enabled);
				assert.equal(h.hotkey.disabled, enabled);
				assert.ok(h.chips.length > 0);
				assert.ok(h.chips.every((chip) => chip.hidden === enabled));
				assert.equal(h.value(), !enabled);
				assert.equal(h.settings.disabledFixedCommands.includes(id), enabled);
				assert.deepEqual(h.changes, [[id, !enabled]]);
			});
		}
	}

	it("keeps the latest state when rapid toggles finish saving out of order", async () => {
		const saves: (() => void)[] = [];
		const id = FIXED_COMMAND_IDS[0];
		assert.ok(id);
		const h = openBuilder(id, true, () => new Promise<void>((resolve) => saves.push(resolve)));
		const off = h.change(false);
		const on = h.change(true);
		assert.equal(saves.length, 2);
		saves[1]?.();
		await on;
		saves[0]?.();
		await off;
		h.assertStable();
		assert.equal(h.row.hasClass("is-disabled"), false);
		assert.equal(h.hotkey.disabled, false);
		assert.equal(h.value(), true);
	});
});
