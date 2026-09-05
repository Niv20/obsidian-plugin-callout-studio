/**
 * tests/settingsBackup.test.ts — the copy taken just before settings are lost.
 *
 * Issue #53 opens with "I don't have a backup cause I never thought an issue
 * like this could have happened". Everything else in the sync work is about
 * making that loss impossible; this is the admission that a bug nobody has
 * found yet will eventually make it possible anyway.
 *
 * Two properties matter more than the writing itself, and both are pinned
 * here: the folder cannot grow without bound (it lives in a synced directory),
 * and nothing it does may fail the operation it is protecting — a backup that
 * throws must not be the reason a user's settings failed to load.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { writeSettingsBackup } from "../src/manager/settingsBackup";

/** A vault adapter over an in-memory file map. */
function vault(initial: Record<string, string> = {}) {
	const files = new Map(Object.entries(initial));
	const folders = new Set<string>();
	const calls: string[] = [];
	const fail = { write: false, list: false, mkdir: false };

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
			files.set(path, text);
			return Promise.resolve();
		},
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

	const host = {
		app: { vault: { adapter, configDir: ".obsidian" } } as unknown as App,
		manifest: {
			id: "callout-studio",
			dir: ".obsidian/plugins/callout-studio",
		} as PluginManifest,
	};

	return {
		host,
		files,
		folders,
		calls,
		fail,
		/** Only the backups, newest last. */
		backups: () =>
			[...files.keys()]
				.filter((f) => f.includes("/backups/data-"))
				.sort(),
	};
}

/** Distinct, ordered timestamps without reaching for a clock. */
const at = (minute: number): Date =>
	new Date(Date.UTC(2026, 0, 1, 12, minute, 0));

describe("writing a settings backup", () => {
	it("puts a copy beside data.json", async () => {
		const v = vault();

		const path = await writeSettingsBackup(v.host, { callouts: ["a"] }, at(0));

		assert.ok(path);
		assert.ok(
			path.startsWith(".obsidian/plugins/callout-studio/backups/data-"),
			path,
		);
		assert.deepStrictEqual(
			JSON.parse(v.files.get(path)!) as unknown,
			{ callouts: ["a"] },
		);
	});

	it("creates the folder the first time and not after", async () => {
		const v = vault();

		await writeSettingsBackup(v.host, {}, at(0));
		await writeSettingsBackup(v.host, {}, at(1));

		assert.deepStrictEqual(v.calls, [
			"mkdir .obsidian/plugins/callout-studio/backups",
		]);
	});

	it("names copies so that sorting them by name orders them by time", async () => {
		// `prune` reads the name as the timestamp, so a name that sorts wrong
		// deletes the wrong file. `:` and `.` cannot appear in a Windows file
		// name, and the substitution has to be fixed-width to keep the order.
		const v = vault();

		await writeSettingsBackup(v.host, { n: 2 }, at(2));
		await writeSettingsBackup(v.host, { n: 10 }, at(10));
		await writeSettingsBackup(v.host, { n: 1 }, at(1));

		const named = v.backups().map((p) => JSON.parse(v.files.get(p)!) as { n: number });
		assert.deepStrictEqual(
			named.map((entry) => entry.n),
			[1, 2, 10],
		);
		assert.ok(!v.backups().some((p) => p.includes(":")), "no colons in a name");
	});
});

describe("keeping the folder from growing", () => {
	it("keeps the newest five and drops the rest", async () => {
		const v = vault();

		for (let i = 0; i < 8; i++) {
			await writeSettingsBackup(v.host, { n: i }, at(i));
		}

		const kept = v
			.backups()
			.map((p) => (JSON.parse(v.files.get(p)!) as { n: number }).n);
		assert.deepStrictEqual(kept, [3, 4, 5, 6, 7]);
	});

	it("never touches a file it did not name", async () => {
		// The folder is inside the plugin directory, which syncs. Anything else
		// in there belongs to the user or to another tool.
		const dir = ".obsidian/plugins/callout-studio/backups";
		const v = vault({ [`${dir}/notes-of-my-own.json`]: "{}", [`${dir}/data-my-recovery.json`]: "{}" });
		v.folders.add(dir);

		for (let i = 0; i < 8; i++) {
			await writeSettingsBackup(v.host, { n: i }, at(i));
		}

		assert.ok(v.files.has(`${dir}/notes-of-my-own.json`));
		assert.ok(v.files.has(`${dir}/data-my-recovery.json`));
	});

	it("keeps the new recovery copy when another device's clock runs ahead", async () => {
		const v = vault();
		for (let i = 10; i < 16; i++) await writeSettingsBackup(v.host, { n: i }, at(i));
		const recovery = await writeSettingsBackup(v.host, { rescued: true }, at(0));
		assert.ok(recovery && v.files.has(recovery));
		assert.strictEqual(v.backups().length, 5);
	});
});

describe("a backup that cannot be written", () => {
	it("reports null rather than throwing", async () => {
		// The caller is mid-adoption. A backup is the safety net, and a safety
		// net that can break the operation is worse than none.
		const v = vault();
		v.fail.write = true;

		assert.strictEqual(await writeSettingsBackup(v.host, {}, at(0)), null);
	});

	it("reports null when the folder cannot be created either", async () => {
		const v = vault();
		v.fail.mkdir = true;

		assert.strictEqual(await writeSettingsBackup(v.host, {}, at(0)), null);
	});

	it("still counts as written when only the tidying failed", async () => {
		// The copy exists; pruning is the part nobody is depending on.
		const v = vault();
		v.fail.list = true;

		const path = await writeSettingsBackup(v.host, { kept: true }, at(0));

		assert.ok(path);
		assert.ok(v.files.has(path));
	});

	it("contains a timestamp-generation failure rather than rejecting adoption", async () => {
		assert.strictEqual(await writeSettingsBackup(vault().host, {}, new Date(NaN)), null);
	});

	it("captures recovery data before awaited adapter work can mutate it", async () => {
		const v = vault();
		const data = { callouts: [{ id: "original" }] };
		const originalExists = v.host.app.vault.adapter.exists.bind(v.host.app.vault.adapter);
		v.host.app.vault.adapter.exists = async path => {
			data.callouts[0]!.id = "changed during await";
			return originalExists(path);
		};
		const path = await writeSettingsBackup(v.host, data, at(0));
		assert.ok(path);
		const saved = JSON.parse(v.files.get(path)!) as { callouts: Array<{ id: string }> };
		assert.strictEqual(saved.callouts[0]!.id, "original");
	});
});
