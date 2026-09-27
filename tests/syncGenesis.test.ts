/**
 * A device that has never received the synced settings must not reset them.
 *
 * A new phone, a reinstalled app or a re-added vault can load the plugin before
 * `data.json` arrives. Its first file used to stamp every shipped default as a
 * fresh edit, and those stamps outranked every value a long-time user had not
 * touched since 2.13.1 introduced sync history — so the new device's defaults
 * replaced everyone's settings, on every device, often without a single click.
 *
 * Three layers now stand in the way, and each is pinned here:
 * - a first file stamps only real edits, never an untouched default;
 * - a merge rescues a value from a default that won by accident, including the
 *   genesis files that released 2.13.1–2.14.1 builds still write;
 * - a device with no settings file never creates one of defaults alone.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { SettingsSync } from "../src/manager/settingsSync";
import { settingsGenesis } from "../src/manager/settingsGenesis";
import { canonical, content } from "../src/manager/syncTree";
import { SettingsSync as ReleasedSync, validSyncEnvelope as releasedEnvelope } from "./fixtures/sync-2.14.1/settingsSync";
import { definition } from "./support/discoveryHarness";
import { device } from "./support/syncReplicaHarness";
import type { PluginData, PluginSettings } from "../src/types";

interface Merger { adopt(data: unknown): void; prepare(data: unknown): unknown; merge(incoming: unknown, local: unknown): unknown }

function saved(edit: (registry: CalloutRegistry) => void = () => {}): PluginData {
	const registry = new CalloutRegistry();
	registry.load(null);
	edit(registry);
	return registry.toSaveData();
}

/** A long-time user's setup, saved before sync history existed. */
const legacyX = saved(registry => {
	const settings = registry.settings;
	settings.headingCallouts.enabled = false;
	settings.iconSources.materialStyleDefault = "sharp";
	settings.iconSources.materialWeightDefault = 400;
	settings.contextMenu.items.regular = [...settings.contextMenu.items.regular].reverse()
		.map(item => item.id === "edit" ? { ...item, enabled: false } : item);
	settings.disabledFixedCommands = ["insert-callout"];
	settings.fallbackCalloutId = "info";
	registry.add(definition({ id: "zeta", displayName: "Zeta" }));
	registry.add(definition({ id: "alpha", displayName: "Alpha" }));
});
const expectedMenu = [...legacyX.settings.contextMenu.items.regular].map(item => `${item.id}:${item.enabled}`);

function settingsOf(data: unknown): PluginSettings {
	return (content(data) as Partial<PluginData>).settings!;
}

function assertKeepsX(data: unknown, label: string): void {
	const settings = settingsOf(data);
	assert.equal(settings.headingCallouts.enabled, false, `${label}: heading callouts were switched back on`);
	assert.equal(settings.iconSources.materialStyleDefault, "sharp", `${label}: icon style reverted`);
	assert.equal(settings.iconSources.materialWeightDefault, 400, `${label}: icon weight reverted`);
	assert.deepEqual(settings.contextMenu.items.regular.map(item => `${item.id}:${item.enabled}`), expectedMenu, `${label}: menu order or switches reverted`);
	assert.deepEqual(settings.disabledFixedCommands, ["insert-callout"], `${label}: disabled commands came back`);
	assert.equal(settings.fallbackCalloutId, "info", `${label}: fallback reverted`);
	assert.deepEqual((content(data) as Partial<PluginData>).callouts!.map(row => row.id), ["zeta", "alpha"], `${label}: callout rows or order lost`);
}

function replica(sync: Merger, initial?: unknown) {
	let file = initial;
	if (initial !== undefined) sync.adopt(initial);
	return {
		get file() { return file; },
		edit(next: unknown) { file = sync.prepare(next); sync.adopt(file); return file; },
		receive(incoming: unknown) { file = sync.merge(incoming, content(file ?? incoming)); sync.adopt(file); return file; },
	};
}

/** X after one post-upgrade edit: an envelope stamping only that edit. */
function upgradedX(sync: Merger = new SettingsSync("x", settingsGenesis)) {
	const x = replica(sync, legacyX);
	x.edit({ ...content(x.file), settings: { ...settingsOf(x.file), language: "he" } });
	return x;
}

/** A device that never received the synced file makes one deliberate edit. */
const freshEdit = () => saved(registry => { registry.settings.globalStyle.borderRadius = 9; });

describe("a new device's first file", () => {
	it("stamps only what its user changed, never an untouched default or the root", () => {
		const f = replica(new SettingsSync("f", settingsGenesis));
		const file = f.edit(freshEdit()) as { calloutStudioSync: { stamps: Record<string, unknown> } };
		assert.deepEqual(Object.keys(file.calloutStudioSync.stamps), [JSON.stringify(["settings", "globalStyle", "borderRadius"])]);
	});

	it("adopts a legacy file whole instead of minting history for it", () => {
		const f = new SettingsSync("f", settingsGenesis);
		assert.equal(canonical(f.merge(legacyX, settingsGenesis())), canonical(legacyX));
	});
});

describe("merging a new device with a long-time user", () => {
	for (const order of ["the long-time device first", "the new device first"]) {
		it(`keeps every untouched customization and the new device's real edit, receiving ${order}`, () => {
			const x = upgradedX(), f = replica(new SettingsSync("f", settingsGenesis));
			f.edit(freshEdit());
			if (order === "the long-time device first") { x.receive(f.file); f.receive(x.file); }
			else { f.receive(x.file); x.receive(f.file); }
			x.receive(f.file); f.receive(x.file);
			for (const [label, file] of [["long-time", x.file], ["new", f.file]] as const) {
				assertKeepsX(file, `${order}, ${label} device`);
				assert.equal(settingsOf(file).language, "he", `${label}: the long-time device's stamped edit was lost`);
				assert.equal(settingsOf(file).globalStyle.borderRadius, 9, `${label}: the new device's real edit was lost`);
			}
			assert.equal(canonical(content(x.file)), canonical(content(f.file)));
		});
	}

	it("rescues the long-time settings from a genesis file a released build wrote", () => {
		const x = upgradedX(), released = replica(new ReleasedSync("f"));
		const genesis = released.edit(freshEdit()) as { calloutStudioSync: { stamps: Record<string, unknown> } };
		assert.ok(JSON.stringify([]) in genesis.calloutStudioSync.stamps, "the released genesis stamps the root");
		x.receive(released.file);
		assertKeepsX(x.file, "after the rescue");
		// The released build honours the rescue's stamps without knowing about it.
		released.receive(x.file);
		assertKeepsX(released.file, "on the released build");
		assert.ok(releasedEnvelope(x.file as Record<string, unknown>), "a released build rejects the rescued envelope");
		assert.equal(canonical(content(x.file)), canonical(content(released.file)));
	});

	it("settles a mixed fleet of released and current builds without ping-pong", () => {
		const current = upgradedX();
		const releasedX = replica(new ReleasedSync("o"), current.file);
		const releasedNew = replica(new ReleasedSync("f"));
		releasedNew.edit(freshEdit());
		const fleet = [current, releasedX, releasedNew];
		let rounds = 0;
		for (let changed = true; changed; rounds++) {
			assert.ok(rounds < 6, "the fleet never went quiet");
			changed = false;
			const files = fleet.map(member => member.file);
			for (const member of fleet) {
				for (const file of files) {
					const before = canonical(member.file);
					member.receive(file);
					if (canonical(member.file) !== before) changed = true;
				}
			}
		}
		for (const member of fleet) assertKeepsX(member.file, "mixed fleet");
		assert.equal(new Set(fleet.map(member => canonical(content(member.file)))).size, 1);
	});

	it("never resurrects a row a real edit deleted", () => {
		const deleting = upgradedX();
		deleting.edit({ ...content(deleting.file), callouts: [] });
		const released = replica(new ReleasedSync("f"));
		released.edit(freshEdit());
		deleting.receive(released.file);
		const again = replica(new SettingsSync("y", settingsGenesis), legacyX);
		again.receive(deleting.file);
		for (const file of [deleting.file, again.file]) {
			assert.deepEqual((content(file) as Partial<PluginData>).callouts, []);
		}
	});
});

describe("a device with no settings file", () => {
	it("creates none for onboarding, theme sweeps or artwork, and only its real edits once it does", async () => {
		const notices: string[] = [];
		(globalThis as unknown as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		const dir = await mkdtemp(join(tmpdir(), "callout-genesis-"));
		const phone = await device(join(dir, "phone"));
		try {
			assert.equal(phone.boot.isFreshInstall, true);
			// Before layout-ready the provisional freeze meets a background save:
			// that is not a lost change, so nobody is told a file went missing.
			await phone.host.saveSettings();
			assert.deepEqual(notices, []);
			assert.equal(await phone.launch(), true);
			phone.registry.settings.welcomeSeen = true;
			phone.registry.settings.competitorImportBannerHandled = true;
			phone.setTheme("theme-callout");
			await phone.host.saveSettings();
			await assert.rejects(phone.rawText(), "a device with no edit created a settings file");
			phone.registry.settings.globalStyle.borderRadius = 9;
			await phone.host.saveSettings();
			const written = JSON.parse(await phone.rawText()) as { calloutStudioSync: { stamps: Record<string, unknown> } };
			assert.ok(!(JSON.stringify([]) in written.calloutStudioSync.stamps), "the first file stamped the root");
			assert.ok(JSON.stringify(["settings", "globalStyle", "borderRadius"]) in written.calloutStudioSync.stamps);
			assert.ok(!(JSON.stringify(["settings", "fallbackCalloutId"]) in written.calloutStudioSync.stamps), "an untouched default was stamped");
		} finally {
			phone.close();
			delete (globalThis as unknown as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
			await rm(dir, { recursive: true, force: true });
		}
	});
});
