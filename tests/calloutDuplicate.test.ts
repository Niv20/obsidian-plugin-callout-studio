import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { Menu } from "obsidian";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { addDuplicateItem, handleCalloutDuplicate } from "../src/settings/sections/duplicateCallout";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import type { CalloutDefinition, PluginData } from "../src/types";

const notices: string[] = [];
beforeEach(() => {
	(globalThis as unknown as { __CS_NOTICES__: string[] }).__CS_NOTICES__ = notices;
	notices.length = 0;
});
afterEach(() => { notices.length = 0; });

function definition(overrides: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "quiet", displayName: "Quiet", icon: { type: "lucide", value: "star" },
		colorLight: "#336699", colorDark: "#88bbee", foldable: true,
		defaultFolded: false, builtIn: false, source: "user", ...overrides,
	};
}

function gate() {
	let release!: () => void;
	const promise = new Promise<void>(resolve => { release = resolve; });
	return { promise, release };
}

function harness(source = definition(), checkpoint = false) {
	const registry = new CalloutRegistry();
	registry.load(null);
	registry.add(source);
	const state = {
		disk: structuredClone(registry.toSaveData()), writes: 0,
		failWrite: false, failRead: false, checkpointWrites: 0, failCheckpointAt: 0,
		onRead: null as (() => void | Promise<void>) | null,
		onWrite: null as (() => void | Promise<void>) | null,
		refreshes: 0, displays: 0, revealed: [] as string[],
	};
	const writer = new SettingsWriter({
		mergeConcurrent: true,
		build: () => registry.toSaveData(),
		readCurrent: async () => {
			await state.onRead?.();
			if (state.failRead) throw new Error("Settings are unreadable");
			return JSON.stringify(state.disk);
		},
		write: async data => {
			await state.onWrite?.();
			if (state.failWrite) throw new Error("Write failed");
			state.writes++;
			state.disk = structuredClone(data) as PluginData;
		},
		...(checkpoint ? { checkpoint: {
			read: () => Promise.resolve(null),
			write: () => {
				state.checkpointWrites++;
				return state.checkpointWrites === state.failCheckpointAt
					? Promise.reject(new Error("Checkpoint failed")) : Promise.resolve();
			},
		} } : {}),
	});
	writer.adopt(JSON.stringify(state.disk));
	const ctx = {
		plugin: {
			registry, settingsWriter: writer, settingsEditOpen: false,
			saveSettings: () => writer.save(),
			refreshCallouts: () => { state.refreshes++; },
		},
		display: () => { state.displays++; },
		revealCallout: (def: CalloutDefinition) => { state.revealed.push(def.id); },
	} as unknown as SettingsSectionContext;
	return {
		registry, writer, state, ctx,
		run: (id = source.id) => handleCalloutDuplicate(ctx, id),
		autoSave: () => registry.onChange(() => { void writer.save().catch(() => undefined); }),
	};
}

function assertFailure(): void {
	assert.deepEqual(notices, [t("notice.calloutDuplicateFailed")]);
}

describe("duplicate callouts are persisted before they become visible", () => {
	it("publishes, reveals, and announces the copy only after its settings write", async () => {
		const h = harness(); const started = gate(); const finish = gate();
		h.state.onWrite = () => { started.release(); return finish.promise; };
		const pending = h.run();
		await started.promise;
		assert.equal(h.registry.get("quiet copy"), undefined);
		assert.equal(h.state.disk.callouts.length, 1);
		assert.deepEqual(notices, []);
		assert.equal(h.state.refreshes, 0);
		finish.release(); await pending;
		assert.ok(h.registry.get("quiet copy"));
		assert.ok(h.state.disk.callouts.some(row => row.id === "quiet copy"));
		assert.equal(h.state.refreshes, 1);
		assert.deepEqual(h.state.revealed, ["quiet copy"]);
		assert.equal(h.state.displays, 0);
		assert.deepEqual(notices, [t("notice.calloutDuplicated", { name: "Quiet copy" })]);
	});

	it("preserves deleted-palette state, all nested fields, and independent references through a restart", async () => {
		const source = definition({
			aliases: ["gentle", "calm"], paletteId: "cp-deleted", customized: true,
			icon: { type: "material", value: "star", style: "rounded", weight: 300 },
			hideIcon: true, iconOffsetX: 2, iconOffsetY: -1, iconSize: 1.2,
			iconAdjust: { regular: { offsetX: 3 }, inline: { size: 0.8 } },
			bgColorLight: "#e1eff7", bgColorDark: "#182534",
			textColorLight: "#123456", textColorDark: "#abcdef",
			bgGradient: { angleDeg: 41, toColorLight: "#f1eeee", toColorDark: "#413131",
				textGradient: true, textToColorLight: "#735353", textToColorDark: "#d1baba" },
			metadata: { origin: "keep this state" }, defaultFolded: true,
		});
		const future = { preferences: { enabled: true }, values: [1, 2] };
		Object.assign(source, { future });
		const h = harness(source);
		await h.run();
		const duplicate = h.registry.get("quiet copy")!;
		assert.deepEqual(duplicate, { ...source, id: "quiet copy", displayName: "Quiet copy",
			aliases: ["gentle copy", "calm copy"] });
		assert.notEqual(duplicate.icon, source.icon);
		assert.notEqual(duplicate.iconAdjust, source.iconAdjust);
		assert.notEqual(duplicate.iconAdjust?.regular, source.iconAdjust?.regular);
		assert.notEqual(duplicate.bgGradient, source.bgGradient);
		assert.notEqual(duplicate.metadata, source.metadata);
		assert.notEqual(duplicate.aliases, source.aliases);
		assert.notEqual((duplicate as CalloutDefinition & { future: unknown }).future, future);
		const reloaded = new CalloutRegistry(); reloaded.load(h.state.disk);
		assert.deepEqual(reloaded.get("quiet copy"), duplicate);
		const deletedGroup = reloaded.listOrphanPaletteGroups().find(group => group.paletteId === "cp-deleted");
		assert.equal(deletedGroup?.count, 2);
		duplicate.icon.value = "changed";
		duplicate.bgGradient!.angleDeg = 90;
		duplicate.metadata!.origin = "changed";
		assert.equal(source.icon.value, "star");
		assert.equal(source.bgGradient?.angleDeg, 41);
		assert.equal(source.metadata?.origin, "keep this state");
	});

	it("refreshes the list when a caller has no reveal hook", async () => {
		const h = harness(); delete h.ctx.revealCallout;
		await h.run();
		assert.equal(h.state.displays, 1);
		assert.equal(h.state.refreshes, 1);
	});
});

describe("failed duplication leaves no speculative row", () => {
	for (const failure of ["write", "read", "frozen", "validation", "missing source", "editing"] as const) {
		it(`keeps registry and storage intact after ${failure} failure`, async context => {
			context.mock.method(console, "error", () => undefined);
			const h = harness(failure === "validation" ? definition({ id: "!!!" }) : definition());
			const before = structuredClone(h.registry.toSaveData());
			if (failure === "write") h.state.failWrite = true;
			if (failure === "read") h.state.failRead = true;
			if (failure === "frozen") h.writer.freeze();
			if (failure === "editing") h.ctx.plugin.settingsEditOpen = true;
			await h.run(failure === "missing source" ? "missing" : undefined);
			assert.deepEqual(h.registry.toSaveData(), before);
			assert.deepEqual(h.state.disk, before);
			assert.equal(h.state.writes, 0);
			assert.equal(h.state.refreshes, 0);
			assert.deepEqual(h.state.revealed, []);
			assertFailure();
		});
	}

	it("does not overwrite settings that arrived from another device", async context => {
		context.mock.method(console, "error", () => undefined);
		const h = harness();
		h.state.disk.callouts.push(definition({ id: "remote", displayName: "Remote" }));
		const remote = structuredClone(h.state.disk);
		await h.run();
		assert.deepEqual(h.state.disk, remote);
		assert.equal(h.state.writes, 0);
		assert.equal(h.registry.get("quiet copy"), undefined);
		assertFailure();
	});

	it("cancels a stale candidate when local state changes before the write", async context => {
		context.mock.method(console, "error", () => undefined);
		const h = harness(); const disk = structuredClone(h.state.disk);
		h.state.onRead = () => { h.registry.update("quiet", { displayName: "Edited" }); };
		await h.run();
		assert.equal(h.registry.get("quiet")?.displayName, "Edited");
		assert.equal(h.registry.get("quiet copy"), undefined);
		assert.deepEqual(h.state.disk, disk);
		assert.equal(h.state.writes, 0);
		assertFailure();
	});

	it("does not publish into an unloaded plugin after a write has started", async context => {
		context.mock.method(console, "error", () => undefined);
		const h = harness(); const started = gate(); const finish = gate();
		h.state.onWrite = () => { started.release(); return finish.promise; };
		const pending = h.run(); await started.promise;
		h.writer.destroy(); finish.release(); await pending;
		assert.equal(h.registry.get("quiet copy"), undefined);
		assert.equal(h.state.refreshes, 0);
		assertFailure();
	});

	it("retains and refreshes a durable copy when only the final recovery checkpoint fails", async context => {
		context.mock.method(console, "error", () => undefined);
		const h = harness(definition(), true); h.state.failCheckpointAt = 2;
		await h.run();
		assert.ok(h.registry.get("quiet copy"));
		assert.ok(h.state.disk.callouts.some(row => row.id === "quiet copy"));
		assert.equal(h.state.writes, 1);
		assert.equal(h.writer.status.reason, "recovery-write");
		assert.equal(h.state.refreshes, 1);
		assert.equal(h.state.displays, 1);
		assertFailure();
	});
});

describe("duplication reconciles edits made during a physical write", () => {
	it("preserves unrelated local edits together with the duplicate in the queued save", async () => {
		const h = harness(); const started = gate(); const finish = gate();
		h.autoSave();
		h.state.onWrite = () => { started.release(); return finish.promise; };
		const pending = h.run(); await started.promise;
		const other = definition({ id: "unrelated", displayName: "Local edit" });
		h.registry.add(other);
		finish.release(); await pending; await h.writer.save();
		assert.deepEqual(h.registry.get("unrelated"), other);
		assert.deepEqual(h.state.disk.callouts.find(row => row.id === "unrelated"), other);
		assert.ok(h.state.disk.callouts.some(row => row.id === "quiet copy"));
		assert.deepEqual(notices, [t("notice.calloutDuplicated", { name: "Quiet copy" })]);
	});

	for (const conflict of ["id", "alias", "display name"] as const) {
		it(`keeps a newer local ${conflict} owner and removes the staged duplicate from storage`, async context => {
			context.mock.method(console, "error", () => undefined);
			const h = harness(); const started = gate(); const finish = gate();
			h.autoSave();
			h.state.onWrite = () => { started.release(); return finish.promise; };
			const pending = h.run(); await started.promise;
			const authored = definition({ id: conflict === "id" ? "quiet copy" : "new owner",
				displayName: conflict === "display name" ? "Quiet-Copy" : "Authored during save",
				...(conflict === "alias" ? { aliases: ["quiet-copy"] } : {}) });
			assert.equal(h.registry.add(authored), true);
			finish.release(); await pending; await h.writer.save();
			assert.deepEqual(h.registry.get(authored.id), authored);
			assert.deepEqual(h.state.disk.callouts.find(row => row.id === authored.id), authored);
			assert.equal(h.state.disk.callouts.length, 2);
			if (conflict !== "id") assert.equal(h.registry.get("quiet copy"), undefined);
			assert.equal(h.state.refreshes, 0);
			assertFailure();
		});
	}
});

class MenuItemStub {
	title = "";
	icon = "";
	click: (() => Promise<void>) | undefined;
	setTitle(value: string): this { this.title = value; return this; }
	setIcon(value: string): this { this.icon = value; return this; }
	onClick(callback: () => Promise<void>): this { this.click = callback; return this; }
}

describe("the Duplicate menu action", () => {
	it("uses the copy icon and invokes duplication for a custom style", async () => {
		const h = harness(); const items: MenuItemStub[] = [];
		const menu = { addItem: (fill: (item: MenuItemStub) => void) => {
			const item = new MenuItemStub(); fill(item); items.push(item);
		} } as unknown as Menu;
		addDuplicateItem(menu, h.ctx, h.registry.get("quiet")!);
		assert.equal(items.length, 1);
		assert.equal(items[0]!.title, t("settings.duplicateAction"));
		assert.equal(items[0]!.icon, "copy");
		await items[0]!.click!();
		assert.ok(h.registry.get("quiet copy"));
	});

	it("omits the action for built-in and theme-only definitions", () => {
		const h = harness(); let items = 0;
		const menu = { addItem: () => { items++; } } as unknown as Menu;
		for (const source of [definition({ builtIn: true }), definition({ source: "builtin" }), definition({ source: "theme" })]) {
			addDuplicateItem(menu, h.ctx, source);
		}
		assert.equal(items, 0);
	});
});
