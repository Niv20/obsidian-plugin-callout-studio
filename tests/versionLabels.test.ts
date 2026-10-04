/**
 * Why vault backups were kept: one labels file per device, so no two devices
 * write the same file, and every device reads them all. Malformed entries
 * are skipped, concurrent changes both land, and a failure is false.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DataAdapter } from "obsidian";
import { getLocale, setLocale, t } from "../src/i18n";
import { mergeVersions, versionCategory } from "../src/manager/setupVersions";
import { forgetBackupReasons, readVersionLabels, recordBackupReason } from "../src/manager/versionLabels";
import { versionName } from "../src/settings/versionRow";

const DIR = ".obsidian/plugins/callout-studio/backups";
const BACKUP = `${DIR}/data-2026-10-03T12-00-00-000Z-mac00001-aaaaaaaaaaaaaaaa.json`;
const OTHER = `${DIR}/data-2026-10-03T13-00-00-000Z-pho00001-bbbbbbbbbbbbbbbb.json`;
const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

function vault(initial: Record<string, string> = {}) {
	const files = new Map(Object.entries(initial));
	const fail = { write: false };
	const adapter = {
		exists: (path: string) => Promise.resolve(files.has(path) || [...files.keys()].some(file => file.startsWith(`${path}/`))),
		mkdir: () => Promise.resolve(),
		list: (path: string) => Promise.resolve({ files: [...files.keys()].filter(file => file.startsWith(`${path}/`)), folders: [] }),
		read: (path: string) => files.has(path) ? Promise.resolve(files.get(path)!) : Promise.reject(new Error("ENOENT")),
		write: (path: string, text: string) => {
			if (fail.write) return Promise.reject(new Error("read-only"));
			files.set(path, text);
			return Promise.resolve();
		},
	} as unknown as DataAdapter;
	const own = (device: string) => JSON.parse(files.get(`${DIR}/labels-${device}.json`) ?? "{}") as {
		reasons?: Record<string, string>;
	};
	return { adapter, files, fail, own };
}

describe("version labels", () => {
	it("are written to this device's file only, and read from every device's", async () => {
		const v = vault();
		assert.equal(await recordBackupReason(v.adapter, DIR, "mac00001", BACKUP, "before-import"), true);
		assert.equal(await recordBackupReason(v.adapter, DIR, "pho00001", OTHER, "before-reset"), true);
		assert.deepEqual([...v.files.keys()].sort(), [`${DIR}/labels-mac00001.json`, `${DIR}/labels-pho00001.json`]);
		assert.deepEqual(v.own("mac00001").reasons, { [fileName(BACKUP)]: "before-import" });
		const labels = await readVersionLabels(v.adapter, DIR);
		assert.deepEqual([...labels.reasons].sort(), [[fileName(BACKUP), "before-import"], [fileName(OTHER), "before-reset"]]);
	});

	it("preserve a meaningful automatic-backup title when the same version also has a newer sync copy", async () => {
		const previousLocale = getLocale(); setLocale("en");
		try {
			const v = vault();
			await recordBackupReason(v.adapter, DIR, "mac00001", BACKUP, "before-import");
			const labels = await readVersionLabels(v.adapter, DIR);
			const data = { callouts: [] };
			const [version] = mergeVersions([
				{ kind: "backup", time: 1000, path: BACKUP, historyHash: null, origin: "this-device", data,
					reason: labels.reasons.get(fileName(BACKUP)) },
				{ kind: "copy", time: 2000, path: `${DIR}/../data 2.json`, historyHash: null, origin: null, data },
			]);
			assert.equal(versionCategory(version!), "automatic");
			assert.equal(versionName(version!), t("versions.reason.beforeImport"));
			assert.equal(version!.copies.length, 2, "the title does not discard either stored copy");
		} finally { setLocale(previousLocale); }
	});

	it("skip malformed entries and unrelated metadata instead of trusting or throwing on it", async () => {
		const v = vault({
			[`${DIR}/labels-mac00001.json`]: JSON.stringify({
				names: { aaaaaaaaaaaaaaaa: { name: "Ignored", at: 1 } },
				reasons: { "data-ok.json": "before-import", "../escape.json": "before-reset", "data-number.json": 7 },
			}).replace('"reasons":{', '"reasons":{"__proto__":"Polluting",'),
			[`${DIR}/labels-pho00001.json`]: "{ truncated",
			[`${DIR}/labels-not-a-device.json`]: JSON.stringify({ reasons: { "data-ignored.json": "before-reset" } }),
		});
		const labels = await readVersionLabels(v.adapter, DIR);
		assert.deepEqual([...labels.reasons], [["data-ok.json", "before-import"]]);
		assert.equal(Object.hasOwn(labels, "names"), false);
	});

	it("read as empty when there is no folder or it cannot be listed", async () => {
		const v = vault();
		assert.equal((await readVersionLabels(v.adapter, DIR)).reasons.size, 0);
		const broken = { ...v.adapter, exists: () => Promise.reject(new Error("offline")) } as unknown as DataAdapter;
		assert.equal((await readVersionLabels(broken, DIR)).reasons.size, 0);
	});

	it("keep two changes in a row on one device: neither overwrites the other", async () => {
		const v = vault();
		await Promise.all([
			recordBackupReason(v.adapter, DIR, "mac00001", BACKUP, "before-import"),
			recordBackupReason(v.adapter, DIR, "mac00001", OTHER, "before-reset"),
		]);
		assert.deepEqual(v.own("mac00001").reasons, { [fileName(BACKUP)]: "before-import", [fileName(OTHER)]: "before-reset" });
	});

	it("resolve to false, never throw, when the file cannot be written, and the next change still lands", async t => {
		t.mock.method(console, "error", () => undefined);
		const v = vault();
		v.fail.write = true;
		assert.equal(await recordBackupReason(v.adapter, DIR, "mac00001", BACKUP, "before-import"), false);
		v.fail.write = false;
		assert.equal(await recordBackupReason(v.adapter, DIR, "mac00001", BACKUP, "before-import"), true);
		assert.equal(v.own("mac00001").reasons?.[fileName(BACKUP)], "before-import");
	});

	it("never replace a labels file that is only unavailable", async t => {
		t.mock.method(console, "error", () => undefined);
		const v = vault({ [`${DIR}/labels-mac00001.json`]: JSON.stringify({ reasons: { [fileName(BACKUP)]: "before-import" } }) });
		const read = v.adapter.read.bind(v.adapter);
		v.adapter.read = () => Promise.reject(new Error("still downloading"));
		assert.equal(await recordBackupReason(v.adapter, DIR, "mac00001", OTHER, "before-reset"), false);
		v.adapter.read = read;
		assert.deepEqual(v.own("mac00001").reasons, { [fileName(BACKUP)]: "before-import" });
	});

	it("forget only the reasons of the backups that are gone, and write nothing when there are none", async () => {
		const v = vault();
		await recordBackupReason(v.adapter, DIR, "mac00001", BACKUP, "before-import");
		await recordBackupReason(v.adapter, DIR, "mac00001", OTHER, "before-reset");
		await forgetBackupReasons(v.adapter, DIR, "mac00001", [BACKUP]);
		assert.deepEqual(v.own("mac00001").reasons, { [fileName(OTHER)]: "before-reset" });
		const before = v.files.get(`${DIR}/labels-mac00001.json`);
		let writes = 0;
		const write = v.adapter.write.bind(v.adapter);
		v.adapter.write = (path, text) => { writes++; return write(path, text); };
		await forgetBackupReasons(v.adapter, DIR, "mac00001", [BACKUP]);
		assert.equal(writes, 0, "nothing changed, so nothing was written");
		assert.equal(v.files.get(`${DIR}/labels-mac00001.json`), before);
	});
});
