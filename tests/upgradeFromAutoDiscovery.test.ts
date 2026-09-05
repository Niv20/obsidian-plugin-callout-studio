import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import type { PluginData } from "../src/types";
import { installFakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";
import { CSS_KEY, DATA_PATH, LOCAL_KEY, ORIGINAL_CSS, upgradeHarness } from "./support/upgradeHarness";

installFakeDom();
type HistoricalFixture = { saved: PluginData; legacyLocalRaw: string; oldReadOfNewerData: PluginData };
const fixture = (tag: string): HistoricalFixture => JSON.parse(readRepoFile(`tests/fixtures/upgrade-${tag}.json`)) as HistoricalFixture;
const legacy = fixture("2.12.2");

async function silence(body: () => Promise<void>): Promise<void> {
	const error = console.error;
	console.error = () => {};
	try { await body(); } finally { console.error = error; }
}

describe("upgrade from released automatic-discovery versions", () => {
	for (const tag of ["2.12.0", "2.12.1", "2.12.2"]) {
		it(`preserves actual ${tag} saved definitions, aliases, commands and CSS recovery without discovering`, async () => {
			const old = fixture(tag);
			assert.equal(old.saved.version, 4);
			const h = upgradeHarness(old.legacyLocalRaw, old.saved);
			h.css.persist("replacement before archive");
			assert.equal(h.local.get(CSS_KEY), ORIGINAL_CSS);
			const result = await h.archive();
			assert.equal(result.kind, "archived");
			if (result.kind !== "archived") throw new Error("Expected recovery copy");
			const copy = JSON.parse(h.disk.get(result.path)!) as { legacyDiscoveryRaw: string; startupCss: string };
			assert.equal(copy.legacyDiscoveryRaw, old.legacyLocalRaw);
			assert.equal(copy.startupCss, ORIGINAL_CSS);
			assert.equal(h.state.settingsWrites, 0);
			await h.boot();
			for (const def of old.saved.callouts) {
				const loaded = h.registry.get(def.id);
				assert.ok(loaded);
				assert.equal(loaded.colorLight, def.colorLight);
				assert.equal(loaded.colorDark, def.colorDark);
				assert.deepEqual(loaded.icon, def.icon);
				assert.deepEqual(loaded.aliases, def.aliases);
			}
			assert.deepEqual(h.registry.settings.customCommands, old.saved.settings.customCommands);
			assert.equal(h.registry.get("local-only"), undefined);
			assert.equal(h.registry.get("unclaimed"), undefined);
			assert.equal(h.state.noteReads, 0);
			assert.equal(h.registry.toSaveData().version, 5);
			assert.equal(h.localState.isExpanded("user"), false);
			assert.deepEqual(Object.keys(JSON.parse(h.local.get(LOCAL_KEY)!) as Record<string, unknown>).sort(), ["initialized", "listsExpanded", "v"]);
			h.css.persist("new live CSS"); assert.equal(h.local.get(CSS_KEY), "new live CSS");
			assert.equal(copy.startupCss, ORIGINAL_CSS, "the recovery archive remains independent of the new cache");
		});

		it(`records that released ${tag} cannot safely share new manual data`, () => {
			const old = fixture(tag);
			// Captured by running the historical registry against a version-5
			// payload, rather than assuming all old builds have the later guard.
			assert.equal(old.oldReadOfNewerData.version, 4);
			assert.equal(old.oldReadOfNewerData.callouts.some(def => def.id === "new-manual-result"), false);
		});
	}

	it("keeps a previously used device read-only while settings arrive later than the upgrade", async () => {
		const h = upgradeHarness(legacy.legacyLocalRaw);
		await h.archive();
		await silence(async () => { await h.boot(); });
		assert.equal(h.writer.isFrozen, true);
		await h.writer.save();
		assert.equal(h.state.settingsWrites, 0);
		assert.equal(h.disk.has(DATA_PATH), false);
		h.disk.set(DATA_PATH, JSON.stringify(legacy.saved));
		await h.adopt();
		assert.equal(h.writer.isFrozen, false);
		assert.equal(h.registry.get("kept-custom")?.colorLight, "#f1ab23");
		assert.equal(h.registry.get("local-only"), undefined);
	});

	it("removes retired automatic settings, preserves unknown preferences and retains old saved theme rows", () => {
		const registry = new CalloutRegistry();
		const saved = structuredClone(legacy.saved);
		Object.assign(saved.settings, { autoDiscoverCallouts: true, firstRunCompleted: true, retiredThemeIds: ["x"], ignoredCalloutIds: ["y"], futurePreference: { keep: true } });
		saved.callouts.push({ ...saved.callouts[0]!, id: "old-theme-row", aliases: undefined, source: "theme", customized: false });
		registry.load(saved);
		const first = registry.toSaveData();
		const settings = first.settings as unknown as Record<string, unknown>;
		for (const key of ["autoDiscoverCallouts", "firstRunCompleted", "retiredThemeIds", "ignoredCalloutIds"]) assert.equal(key in settings, false);
		assert.deepEqual(settings.futurePreference, { keep: true });
		assert.equal(first.callouts.find(def => def.id === "old-theme-row")?.source, "fallback");
		const second = new CalloutRegistry(); second.load(first);
		assert.deepEqual(second.toSaveData(), first, "repeated upgrade is idempotent");
	});
});

describe("legacy cleanup requires a durable verified recovery copy", () => {
	for (const fault of ["failArchiveWrite", "failArchiveRead", "corruptArchive"] as const) {
		it(`keeps original discovery and CSS when ${fault} occurs`, async () => {
			const h = upgradeHarness(legacy.legacyLocalRaw); h.state[fault] = true;
			await silence(async () => { assert.equal((await h.archive()).kind, "failed"); });
			h.localState.markInitialized(); h.localState.setExpanded("theme", false);
			h.css.persist("would erase original styles");
			assert.equal(h.local.get(LOCAL_KEY), legacy.legacyLocalRaw);
			assert.equal(h.local.get(CSS_KEY), ORIGINAL_CSS);
		});
	}

	it("retries a failed archive and reuses an already written verified copy", async () => {
		const h = upgradeHarness(legacy.legacyLocalRaw); h.state.failArchiveRead = true;
		await silence(async () => { assert.equal((await h.archive()).kind, "failed"); });
		assert.equal(h.state.archiveWrites, 1);
		h.state.failArchiveRead = false;
		assert.equal((await h.archive()).kind, "archived");
		assert.equal(h.state.archiveWrites, 1);
		assert.equal((await h.archive()).kind, "none");
		assert.equal((await new DeviceLocalStore(h.app).archiveLegacyDiscovery(h.manifest)).kind, "none");
	});

	it("recovers on retry after a partial archive write without overwriting the partial evidence", async () => {
		const h = upgradeHarness(legacy.legacyLocalRaw); h.state.corruptArchive = true;
		await silence(async () => { assert.equal((await h.archive()).kind, "failed"); });
		const partial = [...h.disk.entries()].find(([path]) => path.endsWith(".json"));
		assert.ok(partial);
		h.state.corruptArchive = false;
		assert.equal((await h.archive()).kind, "archived");
		assert.equal(h.state.archiveWrites, 2);
		assert.equal(h.disk.get(partial[0]), "partial");
	});

	it("coalesces simultaneous upgrade requests into one archive", async () => {
		const h = upgradeHarness(legacy.legacyLocalRaw);
		const first = h.archive(); const second = h.archive();
		assert.equal(first, second);
		assert.equal((await first).kind, "archived");
		assert.equal(h.state.archiveWrites, 1);
	});

	it("retains a verified recovery copy and old CSS when local cleanup is refused", async () => {
		const h = upgradeHarness(legacy.legacyLocalRaw); h.state.failLocalWrite = true;
		const first = await h.archive(); assert.equal(first.kind, "archived");
		h.css.persist("new style"); assert.equal(h.local.get(CSS_KEY), ORIGINAL_CSS);
		h.state.failLocalWrite = false;
		assert.equal((await new DeviceLocalStore(h.app).archiveLegacyDiscovery(h.manifest)).kind, "archived");
		assert.equal(h.state.archiveWrites, 1);
	});

	for (const key of [LOCAL_KEY, CSS_KEY]) {
		it(`does not clean up a ${key} changed by an old window while archiving`, async () => {
			const h = upgradeHarness(legacy.legacyLocalRaw);
			const replacement = key === LOCAL_KEY ? legacy.legacyLocalRaw.replace("local-only", "later-observation") : "later original CSS";
			h.state.duringArchiveWrite = () => { h.local.set(key, replacement); };
			assert.equal((await h.archive()).kind, "failed");
			h.localState.markInitialized(); h.css.persist("new style");
			assert.equal(h.local.get(key), replacement);
		});
	}

	it("preserves unrecognized and corrupt older storage without treating it as a new install", () => {
		for (const raw of ['{"v":99,"discovered":["keep"]}', '{"v":1,broken']) {
			const h = upgradeHarness(raw);
			assert.equal(h.localState.hasInitialized, true);
			h.localState.markInitialized(); h.css.persist("new style");
			assert.equal(h.local.get(LOCAL_KEY), raw);
			assert.equal(h.local.get(CSS_KEY), ORIGINAL_CSS);
		}
	});
});
