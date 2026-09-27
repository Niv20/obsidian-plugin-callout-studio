/**
 * What this device remembers for itself rather than in the synced settings.
 *
 * The icon picker's last category and emoji skin tone, and Quick Insert's
 * source filter, used to be settings: every glance at another category wrote
 * `data.json`, and every other device then adopted a new file for it, and
 * backed up its whole setup first. They are device memory now, seeded from the
 * synced value on a device that has none. The device's name, which backup files
 * carry, lives here too.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { DEFAULT_SETTINGS } from "../src/constants";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { SHARED_DEVICE_ID } from "../src/manager/settingsBackup";
import { IconPicker, type IconPickerPlugin } from "../src/settings/iconpicker/IconPickerModal";
import type { IconVariantState } from "../src/icons/types";
import { installFakeDom } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

const dom = installFakeDom();
const local = new Map<string, string>();
Object.defineProperty(dom.window, "localStorage", { value: {
	getItem: (key: string) => local.get(key) ?? null,
	setItem: (key: string, value: string) => { local.set(key, value); },
} });

let sequence = 0;
function device(appId = `device-memory-${sequence++}`) {
	const app = { appId, vault: { getName: () => appId } } as unknown as App;
	return { appId, app, store: () => new DeviceLocalStore(app) };
}

describe("the device's own name", () => {
	it("is chosen once and kept across launches", () => {
		const d = device();
		const id = d.store().deviceId;
		assert.match(id, /^[a-z0-9]{8}$/);
		assert.equal(d.store().deviceId, id);
		assert.notEqual(device().store().deviceId, id);
	});

	it("is the shared name when this device's storage cannot be written", () => {
		const d = device();
		local.set(`${d.appId}-callout-studio-local`, "{ not json");
		assert.equal(d.store().deviceId, SHARED_DEVICE_ID);
	});
});

describe("picker and Quick Insert memory", () => {
	it("survives a restart", () => {
		const d = device();
		const store = d.store();
		store.setIconCategory("material", "Social");
		store.setEmojiSkinTone(3);
		store.setQuickInsertSource("theme");
		const next = d.store();
		assert.equal(next.iconCategory("material"), "Social");
		assert.equal(next.emojiSkinTone, 3);
		assert.equal(next.quickInsertSource, "theme");
	});

	it("ignores stored values it cannot use", () => {
		const d = device();
		local.set(`${d.appId}-callout-studio-local`, JSON.stringify({
			v: 3, initialized: true, welcomeSeen: true, listsExpanded: {},
			deviceId: "../../etc", iconCategories: { material: 42 }, emojiSkinTone: 9, quickInsertSource: { all: true },
		}));
		const store = d.store();
		assert.equal(store.iconCategory("material"), undefined);
		assert.equal(store.emojiSkinTone, undefined);
		assert.equal(store.quickInsertSource, undefined);
		assert.match(store.deviceId, /^[a-z0-9]{8}$/);
	});
});

describe("the icon picker remembers on the device", () => {
	function picker(localState?: DeviceLocalStore) {
		let saves = 0;
		const settings = structuredClone(DEFAULT_SETTINGS);
		settings.iconSources.lastCategory = { material: "Synced" };
		settings.iconSources.lastEmojiSkinTone = 2;
		const plugin = {
			app: { keymap: new TestKeymap(), scope: new TestScope() }, settings, localState,
			saveSettings: () => { saves++; return Promise.resolve(); },
			registry: { getUserImages: () => [], getAll: () => [] },
		} as unknown as IconPickerPlugin;
		const modal = new IconPicker(plugin) as unknown as {
			lastCategoryFor(id: string): string;
			saveCategory(id: string, category: string): void;
			saveVariants(id: string, variants: IconVariantState): void;
			variantsFor(id: string): IconVariantState;
		};
		return { modal, settings, get saves() { return saves; } };
	}

	it("starts from the synced memory on a device that has none of its own", () => {
		const h = picker(device().store());
		assert.equal(h.modal.lastCategoryFor("material"), "Synced");
		assert.equal(h.modal.variantsFor("emoji").emojiSkinTone, 2);
	});

	it("keeps a category and a skin tone on the device without saving the settings", () => {
		const store = device().store();
		const h = picker(store);
		h.modal.saveCategory("material", "Social");
		h.modal.saveVariants("emoji", { emojiSkinTone: 4 });
		assert.equal(h.saves, 0, "remembering a glance wrote the settings file");
		assert.equal(h.settings.iconSources.lastCategory?.material, "Synced");
		assert.equal(h.modal.lastCategoryFor("material"), "Social");
		assert.equal(h.modal.variantsFor("emoji").emojiSkinTone, 4);
	});

	it("still saves a style default, which is a setting", () => {
		const h = picker(device().store());
		h.modal.saveVariants("material", { style: "sharp", weight: 400 });
		assert.equal(h.saves, 1);
		assert.equal(h.settings.iconSources.materialStyleDefault, "sharp");
	});
});
