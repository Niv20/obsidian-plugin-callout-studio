/**
 * tests/iconLibrariesUpgrade.test.ts — a vault coming from 2.15.0, before the
 * Manage icon libraries window existed, meets this build.
 *
 * Nothing is migrated, and that is the design rather than an omission. Whether
 * a downloadable library counts as *downloaded* was never a setting: it is
 * whether its files are in the plugin folder, and this build reads those files
 * exactly as 2.15.0 wrote them — same folder, same file names, same checksums.
 * What the window adds to the settings (`iconLibraries.order` and `.hidden`)
 * starts empty, and empty means "the catalog order, nothing hidden", which is
 * the list 2.15.0's menu showed. So the three claims worth holding are:
 *
 * - the files 2.15.0 left behind are recognised, and the rest are listed to
 *   download — with every library still listed somewhere;
 * - a released `data.json` loads to those defaults and asks for no migration
 *   write, so an upgrade changes nothing on disk by itself;
 * - nothing is deleted, hidden or fetched on the way, and the callouts that use
 *   a library keep being found, whether or not its files are here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { CURRENT_DATA_VERSION, DEFAULT_SETTINGS } from "../src/constants";
import { PACK_MANIFEST } from "../src/icons/data/packManifest";
import {
	calloutsUsingLibrary,
	isDownloaded,
	libraryOrder,
	menuLibraries,
	pickerSources,
} from "../src/icons/iconLibraries";
import { forgetPackData } from "../src/icons/packData";
import { PackDataStore } from "../src/icons/PackDataStore";
import { ICON_SOURCE_IDS } from "../src/icons/registry";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type {
	CalloutDefinition,
	IconPackId,
	PluginData,
	PluginSettings,
} from "../src/types";

const real = (id: IconPackId): string =>
	readFileSync(join(process.cwd(), "packs", `${id}.json`), "utf8");

/** The plugin folder 2.15.0 used: the id is `callout-studio`, packs live in `icon-packs`. */
const MANIFEST = { id: "callout-studio", dir: ".obsidian/plugins/callout-studio" } as PluginManifest;

/**
 * A plugin folder, as the released build left it: only the packs its owner had
 * downloaded. Records everything the code under test writes or removes.
 */
function pluginFolder(downloaded: readonly IconPackId[]) {
	const files = new Map<string, string>();
	const writes: string[] = [];
	const removes: string[] = [];
	const adapter = {
		exists: (path: string) => Promise.resolve(files.has(path)),
		read: (path: string) => files.has(path)
			? Promise.resolve(files.get(path)!)
			: Promise.reject(new Error("ENOENT")),
		write: (path: string) => { writes.push(path); return Promise.resolve(); },
		mkdir: () => Promise.resolve(),
		remove: (path: string) => { removes.push(path); return Promise.resolve(); },
	};
	const app = { vault: { adapter, configDir: ".obsidian" } } as unknown as App;
	const store = new PackDataStore(app, MANIFEST);
	for (const id of downloaded) files.set(store.packPath(id), real(id));
	return { store, files, writes, removes };
}

/** Packs are held in module-level memory; leave none behind for the next test. */
const ALL_PACKS = Object.keys(PACK_MANIFEST) as IconPackId[];
afterEach(() => { for (const id of ALL_PACKS) forgetPackData(id); });

function userCallout(id: string, icon: CalloutDefinition["icon"]): CalloutDefinition {
	return {
		id, displayName: id, icon, colorLight: "#3b82f6", colorDark: "#3b82f6",
		foldable: true, defaultFolded: false, builtIn: false, source: "user",
	};
}

/**
 * `data.json` as 2.15.0 wrote it: today's defaults without the one key this
 * release adds, plus a little of what a real vault accumulates — callouts using
 * icons from four libraries, and the picker's remembered category and tone.
 */
function released2150(): Partial<PluginData> {
	const settings: Partial<PluginSettings> = structuredClone(DEFAULT_SETTINGS);
	delete settings.iconLibraries;
	settings.iconSources = {
		...DEFAULT_SETTINGS.iconSources,
		lastCategory: { material: "Actions" },
		lastEmojiSkinTone: 3,
	};
	return {
		version: CURRENT_DATA_VERSION,
		callouts: [
			userCallout("alerts", { type: "octicons", value: "alert" }),
			userCallout("tips", { type: "tabler-outline", value: "bulb" }),
			userCallout("repo", { type: "fa-brands", value: "github" }),
			userCallout("plain", { type: "lucide", value: "star" }),
		],
		settings: settings as PluginSettings,
		iconSvgCache: [],
	};
}

function loaded(data: Partial<PluginData>): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(data);
	return registry;
}

describe("upgrading from 2.15.0 — the settings", () => {
	it("loads a data.json without the new key to the defaults, and asks for no migration write", () => {
		const registry = loaded(released2150());
		assert.deepEqual(registry.settings.iconLibraries, { order: [], hidden: [] });
		// The merge fills a missing key itself; a fresh install gets
		// DEFAULT_SETTINGS. Two routes to one answer, held together here so that
		// changing one default alone cannot make an upgrade differ from an install.
		assert.deepEqual(registry.settings.iconLibraries, DEFAULT_SETTINGS.iconLibraries);
		assert.equal(registry.needsSaveAfterLoad(), false, "an upgrade must not rewrite the file by itself");
		// The first ordinary save then writes the key — with the defaults, so a
		// device still on 2.15.0 reading the file later finds nothing it minds.
		assert.deepEqual(registry.toSaveData().settings.iconLibraries, { order: [], hidden: [] });
	});

	it("leaves everything else the released build saved as it was", () => {
		const saved = released2150();
		const registry = loaded(saved);
		assert.deepEqual(registry.settings.iconSources.lastCategory, { material: "Actions" });
		assert.equal(registry.settings.iconSources.lastEmojiSkinTone, 3);
		for (const def of saved.callouts!) {
			assert.deepEqual(registry.get(def.id)?.icon, def.icon, `${def.id} keeps its icon`);
		}
	});

	it("keeps the list a release adds beside iconSources, not inside it", () => {
		// An older build rebuilds `iconSources` from the fields it knows and would
		// drop two more on its next save; a whole top-level key it does not know
		// is handed back untouched by foreignFields.ts. That is what lets two
		// devices one release apart keep each other's order.
		assert.ok("iconLibraries" in DEFAULT_SETTINGS);
		assert.ok(!("order" in DEFAULT_SETTINGS.iconSources));
		assert.ok(!("hidden" in DEFAULT_SETTINGS.iconSources));
	});

	it("starts as the order 2.15.0's menu listed, so no library moves", () => {
		assert.deepEqual(libraryOrder(loaded(released2150()).settings.iconLibraries), [...ICON_SOURCE_IDS]);
	});
});

describe("upgrading from 2.15.0 — the libraries on the device", () => {
	it("recognises what was downloaded, from the files alone, and lists the rest to download", async () => {
		// Octicons and all three Font Awesome files; Tabler's outline file only
		// (its filled one was never needed); nothing else.
		const { store } = pluginFolder(["octicons", "fa-solid", "fa-regular", "fa-brands", "tabler-outline"]);
		const prefs = loaded(released2150()).settings.iconLibraries;

		// What the picker does when it opens.
		await store.loadAllFromDisk();

		const menu = menuLibraries(prefs, store);
		assert.deepEqual(menu.libraries, ["lucide", "material", "emoji", "octicons", "fa", "image"]);
		assert.deepEqual(menu.toDownload, ["tabler", "rpg-awesome", "simple-icons"]);
		assert.deepEqual(pickerSources(prefs, store), menu.libraries);
		assert.equal(isDownloaded("octicons", store), true);
		assert.equal(isDownloaded("fa", store), true);
		assert.equal(isDownloaded("tabler", store), false, "half a library is not offered, in 2.15.0 or now");
	});

	it("lists or counts every library, and none twice", async () => {
		// 2.15.0 hid nothing, so each library is either in the menu or counted by
		// its closing line as one to download.
		const { store } = pluginFolder(["octicons"]);
		await store.loadAllFromDisk();
		const menu = menuLibraries(loaded(released2150()).settings.iconLibraries, store);
		const accounted = [...menu.libraries, ...menu.toDownload];
		assert.deepEqual([...accounted].sort(), [...ICON_SOURCE_IDS].sort());
		assert.equal(new Set(accounted).size, accounted.length);
	});

	it("deletes, writes and downloads nothing on the way", async () => {
		const { store, writes, removes } = pluginFolder(["octicons", "tabler-outline", "tabler-filled"]);
		const registry = loaded(released2150());
		await store.loadAllFromDisk();
		menuLibraries(registry.settings.iconLibraries, store);
		pickerSources(registry.settings.iconLibraries, store);
		assert.deepEqual(writes, []);
		assert.deepEqual(removes, []);
		assert.equal(store.state("octicons"), "ready");
		assert.equal(store.state("rpg-awesome"), "unavailable", "and it is not fetched because it is listed");
	});

	it("still finds the callouts that use a library whose files are not on this device", async () => {
		// A callout can come from another device through sync. Its library counts
		// as one to download here — the files really are absent — and the
		// callout is found all the same, so deleting or re-downloading is asked
		// about correctly. It draws from the artwork saved in data.json, and
		// editing it shows its library in the menu, set apart from the others.
		const { store } = pluginFolder([]);
		await store.loadAllFromDisk();
		const registry = loaded(released2150());
		const menu = menuLibraries(registry.settings.iconLibraries, store);
		assert.ok(menu.toDownload.includes("octicons"));
		assert.equal(menuLibraries(registry.settings.iconLibraries, store, "octicons").current, "octicons");
		assert.deepEqual(calloutsUsingLibrary(registry.getCommitted(), "octicons").map((def) => def.id), ["alerts"]);
		assert.deepEqual(calloutsUsingLibrary(registry.getCommitted(), "fa").map((def) => def.id), ["repo"]);
	});
});

describe("upgrading from 2.15.0 — the files 2.15.0 could have downloaded", () => {
	// The size and checksum of each of the seven packs the released build could
	// download, copied from its manifest and frozen here. A file on disk is
	// accepted only when it matches the manifest, so if one of these changed,
	// everything 2.15.0 users had downloaded would stop verifying: it would read
	// as damaged, drop out of the picker into "to download", and be fetched again
	// only if a callout needed it. Refreshing the artwork on purpose is fine —
	// but it is an upgrade decision, and this is where it is made, not discovered.
	const RELEASED_2150: Record<string, { bytes: number; sha256: string }> = {
		"tabler-outline": { bytes: 1193174, sha256: "aa8aca305403a64c2b7d2f6160461cf6c40a1311c2d7c5148de35b46b0ac908a" },
		"tabler-filled": { bytes: 515352, sha256: "9fd4edf7ef4eeb5f4734735bdcdd5325b73cc6ec9cecb7fc82c07335e484bca7" },
		octicons: { bytes: 384490, sha256: "8d34725983eee3d840da65e802fd29e583fc2845058923b88e8151fa418b852f" },
		"fa-solid": { bytes: 813460, sha256: "2c2f11e29443c4904baf60eb299dadb1804f5e52ae9b54ae24d4eaf881681f92" },
		"fa-regular": { bytes: 107068, sha256: "e066aa24f5c41926a7da616ec0da8c6e76c087543f1bfe2c747d1b76f5edd2ba" },
		"fa-brands": { bytes: 572059, sha256: "591d8baeba5b82513ce2393b9dc788e337576b7e272006e31a8625345cbe3df6" },
		"rpg-awesome": { bytes: 639853, sha256: "3f6bdf26563410a99d3d20638707ef9f4a530d7b6b87d93883a841e6eb1b9194" },
	};
	const ids = Object.keys(RELEASED_2150) as IconPackId[];

	it("are expected by this build with the same size and checksum", () => {
		for (const id of ids) {
			assert.equal(PACK_MANIFEST[id]?.bytes, RELEASED_2150[id]!.bytes, `${id} size`);
			assert.equal(PACK_MANIFEST[id]?.sha256, RELEASED_2150[id]!.sha256, `${id} checksum`);
		}
	});

	it("verify when read back from the plugin folder, all seven", async () => {
		const { store } = pluginFolder(ids);
		const results = await store.loadUsed(ids);
		for (const id of ids) assert.equal(results.get(id), "ready", `${id} verifies`);
	});

	it("leave Simple Icons as the one library 2.15.0 could not have downloaded", () => {
		// The manifest lists exactly the downloadable packs.
		assert.deepEqual(ALL_PACKS.filter((id) => !(id in RELEASED_2150)), ["simple-icons"]);
	});
});
