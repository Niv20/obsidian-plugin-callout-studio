/**
 * tests/settingsBackup.test.ts — the copy taken just before settings are lost.
 *
 * Issue #53 opens with "I don't have a backup cause I never thought an issue
 * like this could have happened". Everything else in the sync work is about
 * making that loss impossible; this is the admission that a bug nobody has
 * found yet will eventually make it possible anyway.
 *
 * Three properties matter more than the writing itself, and all are pinned
 * here: the folder cannot grow without bound (it lives in a synced directory),
 * one device's tidying never evicts a copy another device or another step of
 * the same operation relies on, and nothing it does may fail the operation it
 * is protecting — a backup that throws must not be the reason a user's
 * settings failed to load.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { SHARED_DEVICE_ID, pruneSettingsBackups, writeSettingsBackup } from "../src/manager/settingsBackup";

const DIR = ".obsidian/plugins/callout-studio/backups";

/** A vault adapter over an in-memory file map, as seen by one device. */
function vault(initial: Record<string, string> = {}, device = "mac00001") {
	const files = new Map(Object.entries(initial));
	const folders = new Set<string>();
	const calls: string[] = [];
	const fail = { write: false, list: false, mkdir: false, garble: false };

	const adapter = {
		exists: (path: string) =>
			Promise.resolve(folders.has(path) || files.has(path)),
		mkdir: (path: string) => {
			if (fail.mkdir) return Promise.reject(new Error("read-only"));
			calls.push(`mkdir ${path}`);
			folders.add(path);
			return Promise.resolve();
		},
		write: (path: string, text: string) => {
			if (fail.write) return Promise.reject(new Error("disk full"));
			files.set(path, fail.garble ? text.slice(0, 5) : text);
			return Promise.resolve();
		},
		read: (path: string) => Promise.resolve(files.get(path) ?? ""),
		list: (path: string) => {
			if (fail.list) return Promise.reject(new Error("gone"));
			return Promise.resolve({
				files: [...files.keys()].filter((f) => f.startsWith(`${path}/`)),
				folders: [],
			});
		},
		remove: (path: string) => {
			files.delete(path);
			return Promise.resolve();
		},
	};

	const host = (id = device) => ({
		app: { vault: { adapter, configDir: ".obsidian" } } as unknown as App,
		manifest: {
			id: "callout-studio",
			dir: ".obsidian/plugins/callout-studio",
		} as PluginManifest,
		localState: { deviceId: id },
	});

	return {
		host: host(),
		as: host,
		files,
		folders,
		calls,
		fail,
		/** Only the backups, oldest first. */
		backups: () =>
			[...files.keys()]
				.filter((f) => f.includes("/backups/data-"))
				.sort(),
		/** The `n` each of this device's remaining copies holds, oldest first. */
		kept: (id = device) =>
			[...files.keys()].filter((f) => f.includes(`-${id}-`)).sort()
				.map((p) => (JSON.parse(files.get(p)!) as { n: number }).n),
	};
}

/** Distinct, ordered timestamps without reaching for a clock. */
const at = (minute: number): Date =>
	new Date(Date.UTC(2026, 0, 1, 12, minute, 0));
const day = (offset: number, minute = 0): Date =>
	new Date(Date.UTC(2026, 0, 1, 12, minute, 0) + offset * 86_400_000);

describe("writing a settings backup", () => {
	it("puts a copy beside data.json, named for its time, its device and its content", async () => {
		const v = vault();

		const path = await writeSettingsBackup(v.host, { callouts: ["a"] }, { now: at(0) });

		assert.ok(path);
		assert.match(path, /^\.obsidian\/plugins\/callout-studio\/backups\/data-2026-01-01T12-00-00-000Z-mac00001-[a-f0-9]{16}\.json$/);
		assert.deepStrictEqual(
			JSON.parse(v.files.get(path)!) as unknown,
			{ callouts: ["a"] },
		);
	});

	it("keeps the content only, never a sync envelope from another moment", async () => {
		const v = vault();
		const path = await writeSettingsBackup(v.host, { callouts: [], calloutStudioSync: { version: 2 } }, { now: at(0) });
		assert.deepStrictEqual(JSON.parse(v.files.get(path!)!) as unknown, { callouts: [] });
	});

	it("creates the folder the first time and not after", async () => {
		const v = vault();

		await writeSettingsBackup(v.host, { n: 0 }, { now: at(0) });
		await writeSettingsBackup(v.host, { n: 1 }, { now: at(1) });

		assert.deepStrictEqual(v.calls, [`mkdir ${DIR}`]);
	});

	it("names copies so that sorting them by name orders them by time", async () => {
		// Pruning reads the name as the timestamp, so a name that sorts wrong
		// deletes the wrong file. `:` and `.` cannot appear in a Windows file
		// name, and the substitution has to be fixed-width to keep the order.
		const v = vault();

		await writeSettingsBackup(v.host, { n: 2 }, { now: at(2) });
		await writeSettingsBackup(v.host, { n: 10 }, { now: at(10) });
		await writeSettingsBackup(v.host, { n: 1 }, { now: at(1) });

		assert.deepStrictEqual(v.kept(), [1, 2, 10]);
		assert.ok(!v.backups().some((p) => p.includes(":")), "no colons in a name");
	});

	it("does not save the same content twice", async () => {
		const v = vault();

		const first = await writeSettingsBackup(v.host, { n: 1, b: [1] }, { now: at(0) });
		const again = await writeSettingsBackup(v.host, { b: [1], n: 1 }, { now: at(5) });

		assert.strictEqual(again, first);
		assert.strictEqual(v.backups().length, 1);
	});

	it("writes a fresh copy when the one with the same content no longer reads back", async () => {
		const v = vault();
		const first = await writeSettingsBackup(v.host, { n: 1 }, { now: at(0) });
		v.files.set(first!, "{ truncated");

		const second = await writeSettingsBackup(v.host, { n: 1 }, { now: at(1) });

		assert.ok(second && second !== first);
		assert.deepStrictEqual(JSON.parse(v.files.get(second)!) as unknown, { n: 1 });
	});
});

describe("keeping the folder from growing", () => {
	it("keeps this device's newest ten from one busy day", async () => {
		const v = vault();

		for (let i = 0; i < 15; i++) {
			await writeSettingsBackup(v.host, { n: i }, { now: at(i) });
		}

		assert.deepStrictEqual(v.kept(), [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
	});

	it("keeps only ten across many days, without extra daily copies", async () => {
		const v = vault();

		for (let d = 0; d < 20; d++) {
			// Several copies a day; only the last of each day can outlive the ten.
			for (let m = 0; m < 3; m++) await writeSettingsBackup(v.host, { n: d * 10 + m }, { now: day(d, m) });
		}

		// The newest ten span days 19 to 16; older daily copies no longer remain.
		assert.deepStrictEqual(v.kept(), [
			162, 170, 171, 172, 180, 181, 182, 190, 191, 192,
		]);
	});

	it("leaves unrecognized files and legacy copies within their limit alone", async () => {
		// The folder is inside the plugin directory, which syncs. Anything else
		// in there belongs to the user, another tool, or an older build.
		const legacy = `${DIR}/data-2026-01-01T00-00-00-000Z-4c6ac6e0-4032-4541-9446-9a06b9655ab3.json`;
		const v = vault({ [`${DIR}/notes-of-my-own.json`]: "{}", [`${DIR}/data-my-recovery.json`]: "{}", [legacy]: "{}" });
		v.folders.add(DIR);

		for (let i = 0; i < 15; i++) {
			await writeSettingsBackup(v.host, { n: i }, { now: at(i) });
		}

		assert.ok(v.files.has(`${DIR}/notes-of-my-own.json`));
		assert.ok(v.files.has(`${DIR}/data-my-recovery.json`));
		assert.ok(v.files.has(legacy));
	});

	it("leaves another device's copies alone while that device is in use", async () => {
		const v = vault();
		for (let i = 0; i < 12; i++) await writeSettingsBackup(v.as("phone001"), { n: 100 + i }, { now: at(i) });
		const phone = v.kept("phone001");

		for (let i = 0; i < 15; i++) await writeSettingsBackup(v.host, { n: i }, { now: at(20 + i) });

		assert.deepStrictEqual(v.kept("phone001"), phone, "a busy Mac evicted the phone's copies");
		assert.strictEqual(phone.length, 10, "the phone tidies its own");
	});

	it("thins a device that has saved nothing for ninety days to its newest copy", async () => {
		const v = vault();
		for (let i = 0; i < 4; i++) await writeSettingsBackup(v.as("oldphone"), { n: 100 + i }, { now: day(0, i) });

		await writeSettingsBackup(v.host, { n: 1 }, { now: day(91) });

		assert.deepStrictEqual(v.kept("oldphone"), [103]);
	});

	it("keeps every copy one operation relies on", async () => {
		// One adoption can back up the local setup, the recovery copy and each
		// conflict copy. Tidying after the last must not delete the first.
		const v = vault();
		const batch = new Set<string>();

		for (let i = 0; i < 13; i++) {
			await writeSettingsBackup(v.host, { n: i }, { now: at(i), batch });
		}

		assert.strictEqual(v.kept().length, 13);
		assert.strictEqual(batch.size, 13);
	});

	it("keeps the new recovery copy when this device's own clock ran ahead before", async () => {
		const v = vault();
		for (let i = 10; i < 22; i++) await writeSettingsBackup(v.host, { n: i }, { now: at(i) });

		const recovery = await writeSettingsBackup(v.host, { rescued: true }, { now: at(0) });

		assert.ok(recovery && v.files.has(recovery));
		assert.strictEqual(v.backups().length, 10, "the protected copy takes a slot within the limit");
	});

	it("names copies from a device that cannot remember itself with one shared name", async () => {
		const v = vault();
		const path = await writeSettingsBackup({ ...v.host, localState: undefined }, { n: 1 }, { now: at(0) });
		assert.ok(path?.includes(`-${SHARED_DEVICE_ID}-`));
	});
});

describe("applying retention to existing backups", () => {
	function seed(v: ReturnType<typeof vault>, device: string | null, count = 25) {
		v.folders.add(DIR);
		return Array.from({ length: count }, (_, n) => {
			const time = day(n).toISOString().replace(/[:.]/g, "-");
			const suffix = device ? `-${device}-${n.toString(16).padStart(16, "0")}`
				: n % 2 ? "-4c6ac6e0-4032-4541-9446-9a06b9655ab3" : "";
			const path = `${DIR}/data-${time}${suffix}.json`;
			v.files.set(path, JSON.stringify({ n }));
			return path;
		});
	}

	it("deletes existing excess from this device and both legacy name formats without creating a backup", async () => {
		const v = vault();
		const own = seed(v, "mac00001"), legacy = seed(v, null), phone = seed(v, "phone001");
		const untouched = [`${DIR}/notes.json`, `${DIR}/unreadable-old.txt`, `${DIR}/recovery-copy-old.txt`,
			`${DIR}/nested/data-2026-01-01T12-00-00-000Z.json`];
		for (const path of untouched) v.files.set(path, "kept");
		await pruneSettingsBackups(v.host);
		assert.deepStrictEqual(v.backups().filter(path => own.includes(path)), own.slice(-10));
		assert.deepStrictEqual(v.backups().filter(path => legacy.includes(path)), legacy.slice(-10));
		assert.ok(phone.every(path => v.files.has(path)), "other devices enforce their own limit on upgrade");
		assert.ok(untouched.every(path => v.files.has(path)));
		const remaining = [...v.files];
		await pruneSettingsBackups(v.host);
		assert.deepStrictEqual([...v.files], remaining, "cleanup is idempotent");
	});

	it("does not thin old backups from another device when this installation has none of its own", async () => {
		const v = vault();
		const phone = seed(v, "phone001");
		await pruneSettingsBackups(v.host);
		assert.ok(phone.every(path => v.files.has(path)));
	});

	it("also cleans up when identical content reuses an existing backup", async () => {
		const v = vault();
		const first = await writeSettingsBackup(v.host, { original: true }, { now: at(0) });
		seed(v, "mac00001");
		const again = await writeSettingsBackup(v.host, { original: true }, { now: day(30) });
		assert.strictEqual(again, first);
		assert.ok(v.files.has(first!));
		assert.strictEqual(v.backups().length, 10);
	});

	it("reduces a completed oversized batch on the next cleanup", async () => {
		const v = vault(), batch = new Set<string>();
		for (let n = 0; n < 13; n++) await writeSettingsBackup(v.host, { n }, { now: at(n), batch });
		await pruneSettingsBackups(v.host);
		assert.deepStrictEqual(v.kept(), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
	});

	it("does not reuse or overwrite a path whose removal is still pending", async () => {
		const v = vault();
		const first = await writeSettingsBackup(v.host, { original: true }, { now: at(0) });
		seed(v, "mac00001");
		let finishRemove: () => void = () => {};
		let started: () => void = () => {};
		const removing = new Promise<void>(resolve => { started = resolve; });
		let cancelled = false;
		const remove = v.host.app.vault.adapter.remove.bind(v.host.app.vault.adapter);
		v.host.app.vault.adapter.remove = async path => {
			if (path === first) {
				started();
				await new Promise<void>(resolve => { finishRemove = resolve; });
			}
			await remove(path);
		};
		const pruning = pruneSettingsBackups(v.host, new Set(), () => cancelled);
		await removing;
		cancelled = true;
		const replacement = await writeSettingsBackup(v.host, { original: true }, { now: at(0) });
		finishRemove();
		await pruning;
		assert.ok(replacement && replacement !== first);
		assert.ok(v.files.has(replacement));
		assert.ok(!v.files.has(first!));
	});

	it("does not create a backup directory just to prune it", async () => {
		const v = vault();
		await pruneSettingsBackups(v.host);
		assert.deepStrictEqual(v.calls, []);
	});
});

describe("why a copy was kept", () => {
	const LABELS = `${DIR}/labels-mac00001.json`;
	type Labels = { reasons?: Record<string, string> };
	const labels = (v: ReturnType<typeof vault>, path = LABELS) => JSON.parse(v.files.get(path) ?? "{}") as Labels;
	const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

	it("says why a new copy was taken, beside it, and leaves a reused copy's reason alone", async () => {
		const v = vault();
		const path = (await writeSettingsBackup(v.host, { n: 1 }, { now: at(0), reason: "before-import" }))!;
		assert.deepEqual(labels(v).reasons, { [fileName(path)]: "before-import" });
		assert.deepStrictEqual(JSON.parse(v.files.get(path)!) as unknown, { n: 1 }, "the copy itself carries no label");
		assert.equal(await writeSettingsBackup(v.host, { n: 1 }, { now: at(5), reason: "before-reset" }), path);
		assert.deepEqual(labels(v).reasons, { [fileName(path)]: "before-import" }, "the same content keeps its first reason");
	});

	it("forgets the reasons of the copies it prunes, and only its own", async () => {
		const v = vault();
		v.files.set(`${DIR}/labels-pho00001.json`, JSON.stringify({ reasons: { "data-gone.json": "before-sync" } }));
		for (let n = 0; n <= 11; n++) await writeSettingsBackup(v.host, { n }, { now: at(n), reason: "before-import" });
		assert.deepStrictEqual(Object.keys(labels(v).reasons ?? {}).sort(), v.backups().map(fileName).sort());
		assert.deepEqual(labels(v, `${DIR}/labels-pho00001.json`).reasons, { "data-gone.json": "before-sync" }, "another device's file is its own to tidy");
	});

	it("still counts a copy as written when its label could not be", async t => {
		t.mock.method(console, "error", () => undefined);
		const v = vault();
		const adapter = v.host.app.vault.adapter;
		const write = adapter.write.bind(adapter);
		adapter.write = (path, text) => path.includes("/labels-") ? Promise.reject(new Error("read-only")) : write(path, text);
		const path = await writeSettingsBackup(v.host, { n: 1 }, { now: at(0), reason: "before-reset" });
		assert.ok(path);
		assert.equal(v.backups().length, 1);
	});
});

describe("a backup that cannot be written", () => {
	it("reports null rather than throwing", async () => {
		// The caller is mid-adoption. A backup is the safety net, and a safety
		// net that can break the operation is worse than none.
		const v = vault();
		v.fail.write = true;

		assert.strictEqual(await writeSettingsBackup(v.host, {}, { now: at(0) }), null);
	});

	it("reports null when the copy does not read back as written", async () => {
		const v = vault();
		v.fail.garble = true;

		assert.strictEqual(await writeSettingsBackup(v.host, { n: 1 }, { now: at(0) }), null);
	});

	it("reports null when the folder cannot be created either", async () => {
		const v = vault();
		v.fail.mkdir = true;

		assert.strictEqual(await writeSettingsBackup(v.host, {}, { now: at(0) }), null);
	});

	it("still counts as written when only listing and tidying failed", async () => {
		// The copy exists; pruning is the part nobody is depending on.
		const v = vault();
		v.fail.list = true;

		const path = await writeSettingsBackup(v.host, { kept: true }, { now: at(0) });

		assert.ok(path);
		assert.ok(v.files.has(path));
	});

	it("contains a timestamp-generation failure rather than rejecting adoption", async () => {
		assert.strictEqual(await writeSettingsBackup(vault().host, {}, { now: new Date(NaN) }), null);
	});

	it("captures recovery data before awaited adapter work can mutate it", async () => {
		const v = vault();
		const data = { callouts: [{ id: "original" }] };
		const originalExists = v.host.app.vault.adapter.exists.bind(v.host.app.vault.adapter);
		v.host.app.vault.adapter.exists = async path => {
			data.callouts[0]!.id = "changed during await";
			return originalExists(path);
		};
		const path = await writeSettingsBackup(v.host, data, { now: at(0) });
		assert.ok(path);
		const saved = JSON.parse(v.files.get(path)!) as { callouts: Array<{ id: string }> };
		assert.strictEqual(saved.callouts[0]!.id, "original");
	});
});
