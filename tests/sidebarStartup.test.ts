import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, WorkspaceLeaf } from "obsidian";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { initializeSidebarTabs } from "../src/ui/initializeSidebarTabs";

function harness() {
	const storage = new Map<string, string>();
	let failStorage = false;
	let failCreation = false;
	Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => {
			if (failStorage) throw new Error("Storage unavailable");
			storage.set(key, value);
		},
	} } });
	const events: unknown[][] = [];
	const leaves: WorkspaceLeaf[] = [];
	const leaf = {
		loadIfDeferred: () => { throw new Error("The background tab must remain deferred"); },
		setViewState: () => { throw new Error("The background tab must keep its saved state"); },
	} as unknown as WorkspaceLeaf;
	const app = { vault: { getName: () => "sidebar-test" }, workspace: {
		detachLeavesOfType: (type: string) => { events.push(["detach", type]); },
		getLeavesOfType: () => leaves,
		ensureSideLeaf: async (type: string, side: string, options: unknown) => {
			assert.equal(new DeviceLocalStore(app).hasOfferedOccurrencesTab, true,
				"the once-only marker must survive a reload before tab creation finishes");
			events.push(["ensure", type, side, options]);
			if (failCreation) throw new Error("Tab creation failed");
			leaves.push(leaf);
			return leaf;
		},
		revealLeaf: () => { throw new Error("The sidebar must remain hidden"); },
	} } as unknown as App;
	const host = { app, localState: new DeviceLocalStore(app), settings: { welcomeSeen: false } };
	return {
		host, events, leaves, leaf,
		reload: () => { host.localState = new DeviceLocalStore(app); },
		failStorage: () => { failStorage = true; },
		failCreation: () => { failCreation = true; },
	};
}

const cleanup = ["detach", "callout-studio-portable-conversion"];

describe("sidebar tabs at startup", () => {
	it("offers only an inactive, unrevealed tab on the first installation", async () => {
		const h = harness();
		await initializeSidebarTabs(h.host, true);
		assert.deepEqual(h.events, [cleanup,
			["ensure", "callout-studio-occurrences", "right", { active: false, reveal: false }],
		]);
		assert.equal(h.host.localState.hasInitialized, false);
		assert.equal(h.host.localState.hasSeenWelcome, false);
	});

	it("keeps a closed tab absent after reload even when no settings file or welcome marker exists", async () => {
		const h = harness();
		await initializeSidebarTabs(h.host, true);
		h.leaves.length = 0;
		h.events.length = 0;
		h.reload();
		await initializeSidebarTabs(h.host, true);
		assert.deepEqual(h.events, [cleanup]);
		assert.equal(h.leaves.length, 0);
	});

	for (const priorUse of ["existing settings", "synced welcome", "local welcome"] as const) {
		it(`does not add a tab on upgrade with ${priorUse}`, async () => {
			const h = harness();
			if (priorUse === "synced welcome") h.host.settings.welcomeSeen = true;
			if (priorUse === "local welcome") h.host.localState.markWelcomeSeen();
			await initializeSidebarTabs(h.host, priorUse !== "existing settings");
			assert.deepEqual(h.events, [cleanup]);
			assert.equal(h.leaves.length, 0);
		});
	}

	it("preserves a restored or manually opened tab wherever the workspace placed it", async () => {
		const h = harness();
		h.leaves.push(h.leaf);
		await initializeSidebarTabs(h.host, true);
		assert.deepEqual(h.events, [cleanup]);
		assert.deepEqual(h.leaves, [h.leaf]);
		// The user can close this existing tab without receiving a later offer.
		h.leaves.length = 0;
		h.reload();
		h.events.length = 0;
		await initializeSidebarTabs(h.host, true);
		assert.deepEqual(h.events, [cleanup]);
	});

	it("leaves a tab restored by a saved workspace intact after the initial offer", async () => {
		const h = harness();
		await initializeSidebarTabs(h.host, true);
		h.reload();
		h.events.length = 0;
		await initializeSidebarTabs(h.host, false);
		assert.deepEqual(h.events, [cleanup]);
		assert.deepEqual(h.leaves, [h.leaf]);
	});

	it("skips an automatic tab when its once-only marker cannot be saved", async () => {
		const h = harness();
		h.failStorage();
		await initializeSidebarTabs(h.host, true);
		h.reload();
		await initializeSidebarTabs(h.host, true);
		assert.deepEqual(h.events, [cleanup, cleanup]);
	});

	it("does not retry an unsuccessful automatic offer on later launches", async () => {
		const h = harness();
		h.failCreation();
		await assert.rejects(initializeSidebarTabs(h.host, true), /Tab creation failed/);
		h.reload();
		h.events.length = 0;
		await initializeSidebarTabs(h.host, true);
		assert.deepEqual(h.events, [cleanup]);
	});
});
