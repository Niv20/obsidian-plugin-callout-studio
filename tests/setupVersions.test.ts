/**
 * Every earlier setup as one timeline. The same setup is usually kept twice —
 * device history records it when it is saved, and a backup takes it again
 * just before something replaces it — so copies are merged into versions.
 *
 * Pinned here: copies are one version exactly when restoring either would give
 * the same settings, never because they were saved a moment apart; a copy that
 * cannot be read stands alone; and a version reads its time and reason
 * from the right copy.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RecoverySource } from "../src/manager/settingsRecoveryService";
import { mergeVersions, versionCategory, type VersionCategory } from "../src/manager/setupVersions";
import type { PluginData } from "../src/types";

const MINUTE = 60_000;
const T = Date.UTC(2026, 9, 3, 12);

function source(kind: RecoverySource["kind"], time: number | null, data: object | null, extra: Partial<RecoverySource> = {}): RecoverySource {
	const id = `${kind}-${time ?? "none"}-${Math.random()}`;
	return {
		kind, time, data: data as Partial<PluginData> | null, origin: kind === "copy" ? null : "this-device",
		path: kind === "history" ? null : `.obsidian/plugins/callout-studio/${kind === "backup" ? "backups/data-" : "data "}${id}.json`,
		historyHash: kind === "history" ? id : null,
		...extra,
	};
}

describe("one timeline of versions", () => {
	it("is one version for copies with the same settings, whatever order their keys were saved in", () => {
		const saved = source("history", T, { callouts: [{ id: "a" }], settings: { x: 1, y: 2 } });
		const backup = source("backup", T + MINUTE, { settings: { y: 2, x: 1 }, callouts: [{ id: "a" }] });
		const copy = source("copy", T - MINUTE, { callouts: [{ id: "a" }], settings: { y: 2, x: 1 } });
		const versions = mergeVersions([saved, backup, copy]);
		assert.equal(versions.length, 1);
		assert.deepEqual(versions[0]!.copies, [backup, saved, copy], "its copies, newest first");
		assert.equal(versionCategory(versions[0]!), "automatic");
	});

	for (const [kinds, category] of [
		[["history"], "automatic"],
		[["backup"], "automatic"],
		[["history", "backup"], "automatic"],
		[["copy"], "sync-copy"],
		[["history", "copy"], "automatic"],
		[["backup", "copy"], "automatic"],
		[["history", "backup", "copy"], "automatic"],
	] as [RecoverySource["kind"][], VersionCategory][]) {
		it(`presents ${kinds.join(" + ")} as one ${category} version, without dropping any copies`, () => {
			const copies = kinds.map((kind, index) => source(kind, T + index * MINUTE, { n: 1 }));
			for (const order of [copies, [...copies].reverse()]) {
				const [version, extra] = mergeVersions(order);
				assert.equal(extra, undefined);
				assert.equal(versionCategory(version!), category);
				assert.equal(version!.copies.length, copies.length);
				assert.equal(version!.time, T + (copies.length - 1) * MINUTE, "classification does not change the newest time");
			}
		});
	}

	// The case a time window would get wrong: Restore backs up the setup it
	// replaces, then records the one it restores, milliseconds later.
	it("keeps two copies saved a moment apart as two versions when their settings differ", () => {
		const replaced = source("backup", T, { callouts: [{ id: "replaced" }] }, { reason: "before-restore" });
		const restored = source("history", T + 3, { callouts: [{ id: "restored" }] }, { reason: "restore" });
		const versions = mergeVersions([replaced, restored]);
		assert.equal(versions.length, 2);
		assert.deepEqual(versions.map(version => version.reason.reason), ["restore", "before-restore"]);
	});

	it("never merges a copy that cannot be read, not even with another one", () => {
		const a = source("copy", T, null), b = source("copy", T, null), c = source("history", T, null);
		const versions = mergeVersions([a, b, c]);
		assert.equal(versions.length, 3);
		assert.ok(versions.every(version => version.copies.length === 1 && version.data === null));
		assert.equal(new Set(versions.map(version => version.key)).size, 3);
	});

	it("puts the newest first and a version that has no time last, in an order every listing repeats", () => {
		const undated = source("copy", null, { n: 0 });
		const old = source("history", T - 10 * MINUTE, { n: 1 });
		const fresh = source("backup", T, { n: 2 });
		const tie = source("history", T, { n: 3 });
		const versions = mergeVersions([undated, old, fresh, tie]);
		assert.deepEqual(versions.map(version => (version.data as { n: number }).n), [3, 2, 1, 0],
			"at the same moment, this device's history before a backup");
		assert.deepEqual(mergeVersions([tie, fresh, old, undated]).map(version => version.key), versions.map(version => version.key));
	});

	it("takes the newest copy's time, and its reason from the newest copy that recorded one", () => {
		// Recorded by a build that kept no reasons, then backed up before an import.
		const history = source("history", T + MINUTE, { n: 1 });
		const backup = source("backup", T, { n: 1 }, { reason: "before-import" });
		const [version] = mergeVersions([backup, history]);
		assert.equal(version!.time, T + MINUTE);
		assert.deepEqual(version!.reason, { kind: "backup", reason: "before-import" });
		const [unexplained] = mergeVersions([source("history", T, { n: 2 })]);
		assert.deepEqual(unexplained!.reason, { kind: "history", reason: null }, "the underlying source stays available without a recorded reason");
	});

	it("reads its settings from a copy that has them", () => {
		const [version] = mergeVersions([source("backup", T, { n: 7 })]);
		assert.deepEqual(version!.data, { n: 7 });
	});
});
