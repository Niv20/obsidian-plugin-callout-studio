import assert from "node:assert/strict";
import { setImmediate as nextTurn } from "node:timers/promises";
import { describe, it } from "node:test";
import { discoveryHarness, definition } from "./support/discoveryHarness";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CURRENT_DATA_VERSION } from "../src/constants";
import { readRepoFile, repoFileExists } from "./support/sourceScan";

function gate() {
	let release!: () => void;
	const promise = new Promise<void>((resolve) => { release = resolve; });
	return { promise, release };
}

describe("manual discovery is an explicit additive transaction", () => {
	it("does no work until requested", () => {
		const h = discoveryHarness({ "a.md": "> [!found]" });
		assert.equal(h.state.reads, 0);
		assert.equal(h.state.writes, 0);
		assert.equal(h.registry.get("found"), undefined);
	});
	it("finds all roles, ignores code/frontmatter and deduplicates aliases and spelling", async () => {
		const h = discoveryHarness({ "a.md": '---\nx: "[!yaml]"\n---\n> [!block]\n## [!heading]\na [!inline] pill\n`[!code]`\n```\n> [!fenced]\n```\n> [!two words]\n> [!two-words]\n> [!known-alias]\n> [!note]' });
		h.registry.add(definition({ id: "owned", aliases: ["known alias"] })); h.syncBaseline();
		assert.equal(await h.discovery.run(), 4);
		assert.deepEqual(h.registry.getUserDefined().map(d => d.id).sort(), ["block", "heading", "inline", "owned", "two words"]);
		assert.equal(h.state.writes, 1);
	});
	it("adds current theme ids only on request and preserves an existing definition", async () => {
		const h = discoveryHarness(); h.state.themes.add("themed"); h.state.themes.add("owned");
		h.registry.add(definition({ id: "owned", displayName: "My work", colorLight: "#abcdef" })); h.syncBaseline();
		const owned = structuredClone(h.registry.get("owned"));
		assert.equal(await h.discovery.run(), 1);
		assert.deepEqual(h.registry.get("owned"), owned);
		h.state.themes.clear();
		assert.equal(await h.discovery.run(), 0);
		assert.ok(h.registry.get("themed"));
	});
	it("persists uncustomized results across restart, JSON export, and another device", async () => {
		const h = discoveryHarness({ "a.md": "> [!saved]" });
		await h.discovery.run();
		assert.equal(h.state.disk?.version, CURRENT_DATA_VERSION);
		const other = new CalloutRegistry(); other.load(h.state.disk);
		assert.ok(other.get("saved"));
		assert.ok(other.toSaveData().callouts.some(d => d.id === "saved"));
		const exported = JSON.parse(other.exportToJSONv2()) as { callouts: { id: string }[] };
		assert.ok(exported.callouts.some(d => d.id === "saved"));
		assert.equal(await h.discovery.run(), 0);
		assert.equal(h.state.writes, 1);
	});
	it("never prunes previously saved results when a later scan finds an empty vault", async () => {
		const h = discoveryHarness({ "a.md": "> [!keep]" }); await h.discovery.run();
		h.vault.remove("a.md"); await h.discovery.run();
		assert.ok(h.registry.get("keep")); assert.equal(h.state.writes, 1);
	});
	it("coalesces double clicks and withholds partial rows until persistence succeeds", async () => {
		const h = discoveryHarness({ "a.md": "> [!pending]" }); const g = gate();
		h.state.duringWrite = () => g.promise;
		const first = h.discovery.run(); const second = h.discovery.run();
		assert.equal(first, second);
		await nextTurn();
		assert.equal(h.registry.get("pending"), undefined);
		g.release(); assert.equal(await first, 1); assert.equal(h.state.writes, 1);
	});
	it("aborts the entire scan on an unreadable note, then allows retry", async () => {
		const h = discoveryHarness({ "a.md": "> [!first]", "b.md": "> [!second]" });
		h.state.duringRead = () => { if (h.state.reads === 2) h.state.failRead = true; };
		await assert.rejects(h.discovery.run());
		assert.equal(h.registry.getUserDefined().length, 0); assert.equal(h.state.writes, 0);
		h.state.failRead = false; h.state.duringRead = null;
		assert.equal(await h.discovery.run(), 2);
	});
	it("leaves no phantom result after a failed settings write", async () => {
		const h = discoveryHarness({ "a.md": "> [!retry]" }); const before = structuredClone(h.state.disk);
		h.state.failWrite = true; await assert.rejects(h.discovery.run());
		assert.equal(h.registry.get("retry"), undefined); assert.deepEqual(h.state.disk, before);
		h.state.failWrite = false; assert.equal(await h.discovery.run(), 1);
	});
	it("does not overwrite settings changed by another device while scanning", async () => {
		const h = discoveryHarness({ "a.md": "> [!local]" });
		h.state.duringRead = () => { h.state.disk!.callouts.push(definition({ id: "remote" })); };
		await assert.rejects(h.discovery.run());
		assert.equal(h.state.writes, 0); assert.equal(h.registry.get("local"), undefined);
		assert.ok(h.state.disk?.callouts.some(d => d.id === "remote"));
		h.state.duringRead = null; h.registry.load(h.state.disk); h.writer.adopt(JSON.stringify(h.state.disk));
		assert.equal(await h.discovery.run(), 1);
		assert.deepEqual(h.state.disk?.callouts.map(d => d.id).sort(), ["local", "remote"]);
	});
	it("does not overwrite an edit to the same callout on another device", async () => {
		const h = discoveryHarness({ "a.md": "> [!new]" });
		h.registry.add(definition({ id: "existing" })); h.syncBaseline();
		h.state.duringRead = () => { h.state.disk!.callouts[0]!.displayName = "Remote edit"; };
		await assert.rejects(h.discovery.run());
		assert.equal(h.state.disk?.callouts[0]?.displayName, "Remote edit"); assert.equal(h.state.writes, 0);
	});
	for (const fault of ["missing", "unreadable", "frozen", "preview", "changed note", "deleted note", "unloaded", "local edit"] as const) {
		it(`aborts without publishing when ${fault}`, async () => {
			const h = discoveryHarness({ "a.md": "> [!new]" });
			h.state.duringRead = () => {
				if (fault === "missing") h.state.disk = null;
				if (fault === "unreadable") h.state.failSettingsRead = true;
				if (fault === "frozen") h.writer.freeze();
				if (fault === "preview") h.state.editable = false;
				if (fault === "changed note") h.vault.write("a.md", "> [!edited]");
				if (fault === "deleted note") h.vault.remove("a.md");
				if (fault === "unloaded") h.discovery.destroy();
				if (fault === "local edit") h.registry.add(definition({ id: "mine" }));
			};
			await assert.rejects(h.discovery.run());
			assert.equal(h.registry.get("new"), undefined); assert.equal(h.state.writes, 0);
		});
	}
	it("rejects a frozen session before reading any notes", async () => {
		const h = discoveryHarness({ "a.md": "> [!new]" }); h.writer.freeze();
		await assert.rejects(h.discovery.run()); assert.equal(h.state.reads, 0);
	});
	it("publishes before queued normal saves so a local edit during the write survives", async () => {
		const h = discoveryHarness({ "a.md": "> [!new]" }); const g = gate();
		h.state.duringWrite = () => g.promise;
		h.registry.onChange(() => { void h.writer.save(); });
		const scan = h.discovery.run(); await nextTurn();
		h.registry.add(definition({ id: "typed-during-save" }));
		g.release(); await scan; await h.writer.save();
		assert.deepEqual(h.state.disk?.callouts.map(d => d.id).sort(), ["new", "typed-during-save"]);
	});
});

describe("automatic discovery is removed from production wiring", () => {
	it("has no scheduler, prune, startup scanner or local index module", () => {
		for (const name of ["CalloutDiscovery", "CalloutPrune", "discoveryScheduler", "rediscoveryHold", "discoveryIndexBoot", "firstRunDiscovery"]) {
			assert.equal(repoFileExists(`src/manager/${name}.ts`), false, name);
		}
	});
	it("only the settings button calls the manual scan", () => {
		assert.doesNotMatch(readRepoFile("src/manager/launchSequence.ts"), /discovery|runVaultScan|schedulePrune/);
		assert.doesNotMatch(readRepoFile("src/settings/SettingsTab.ts"), /scanOpenEditors|schedulePrune/);
		assert.doesNotMatch(readRepoFile("src/utils/VaultCalloutStatisticsModal.ts"), /runVaultScan/);
	});
});

 it("does not serialize all settings once per note in a large scan", async () => {
  const h = discoveryHarness(Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`${i}.md`, "> [!new]"])));
  const original = h.registry.toSaveData.bind(h.registry); let snapshots = 0;
  h.registry.toSaveData = () => { snapshots++; return original(); };
  assert.equal(await h.discovery.run(), 1);
  assert.ok(snapshots < 10, `serialized settings ${snapshots} times`);
 });
 it("does not publish into an unloaded plugin after a write already started", async () => {
  const h = discoveryHarness({ "a.md": "> [!saved]" }); const g = gate();
  h.state.duringWrite = () => g.promise;
  const scan = h.discovery.run(); await nextTurn(); h.discovery.destroy(); g.release();
  await scan;
  assert.equal(h.registry.get("saved"), undefined);
  assert.ok(h.state.disk?.callouts.some(row => row.id === "saved"));
 });
 it("preserves legacy saved rows and drops obsolete discovery preferences", () => {
  const h = discoveryHarness(); const data = h.registry.toSaveData();
  const old = { ...data, version: 4, callouts: [definition({ id: "old", source: "fallback" }), definition({ id: "theme-old", source: "theme" })],
   settings: { ...data.settings, autoDiscoverCallouts: true, ignoredCalloutIds: ["old"], firstRunCompleted: true, retiredThemeIds: ["x"] } };
  h.registry.load(old); const saved = h.registry.toSaveData();
  assert.deepEqual(saved.callouts.map(row => row.id).sort(), ["old", "theme-old"]);
  for (const key of ["autoDiscoverCallouts", "ignoredCalloutIds", "firstRunCompleted", "retiredThemeIds"]) assert.equal(key in saved.settings, false);
 });
