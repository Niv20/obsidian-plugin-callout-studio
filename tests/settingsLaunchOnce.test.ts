/**
 * tests/settingsLaunchOnce.test.ts — what an ordinary launch no longer works
 * out twice, and everything that must still be worked out.
 *
 * With the settling pause gone from `onload` (`settingsBootRest.test.ts`), what
 * was left of a launch was almost all the settings file being gone over again:
 * its sync envelope checked five times, its text parsed four, and the file
 * joined with a recovery copy already found equal to it. On a file with a long
 * history of stamps that was most of the plugin's load time.
 *
 * Three things are done once now, and this file pins both halves of each: that
 * the repeat is gone, and that nothing which needed the work has lost it.
 *
 * - **The join with an equal recovery copy** (`rejoinsAsItself`). Skipped only
 *   where the join would hand the file back; the older envelopes it rewrites,
 *   and a conflict copy beside the file, still go through it.
 * - **The envelope check on adoption** (`isCheckedRead`). Skipped only for the
 *   text `readSettingsFile` checked itself; anything assembled elsewhere is
 *   checked as it always was.
 * - **The parse of the adopted text** (`SettingsWriter.adopt`). One parse
 *   serves the sync state, the write guard's baseline and the saved content.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { applySettingsRead } from "../src/manager/settingsAdopt";
import { isCheckedRead, readSettingsFile, type SettingsRead } from "../src/manager/settingsFile";
import { rejoinsAsItself, SettingsSync, validSyncEnvelope } from "../src/manager/settingsSync";
import { syncFingerprint } from "../src/manager/syncFingerprint";
import { canonical, SYNC_KEY } from "../src/manager/syncTree";
import { SaveGuard } from "../src/utils/saveGuard";
import { definition } from "./support/discoveryHarness";
import {
	PLUGIN_DIR,
	fileFromAnotherDevice,
	launchDevice,
	usedWorld,
	type LaunchedDevice,
	type World,
} from "./support/launchWorld";

type Json = Record<string, unknown>;
interface Envelope {
	version: number;
	stamps: Record<string, [number, string]>;
	fingerprint?: string;
	[field: string]: unknown;
}

const CONFLICT_COPY = `${PLUGIN_DIR}/data.sync-conflict-20261115-101010-ABCDEFG.json`;
const envelope = (data: Json): Envelope => data[SYNC_KEY] as Envelope;
const path = (...parts: string[]): string => JSON.stringify(parts);

/** Make the envelope's checksum describe the data again after a change to either. */
function resealed<T extends Json>(data: T): T {
	const meta = envelope(data);
	meta.fingerprint = syncFingerprint(data, meta.stamps);
	return data;
}

/** The same settings with every object's keys in the opposite order. */
function reordered(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(reordered);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value as Json)
			.reverse()
			.map(([key, child]) => [key, reordered(child)]),
	);
}

function quiet(context: { mock: { method(object: object, name: string, body: () => void): unknown } }): void {
	for (const level of ["error", "warn", "debug"]) context.mock.method(console, level, () => {});
}

/** A stamped file as a device saves it: two rows, one of them since deleted, one edited. */
function stampedFile(): Json {
	const sync = new SettingsSync("this-device");
	const row = (id: string) => ({ id, displayName: id, icon: { type: "lucide", value: "lucide-star" } });
	let data = sync.prepare({ version: 5, callouts: [row("kept"), row("gone")], settings: { language: "en" } });
	sync.adopt(data);
	data = sync.prepare({
		version: 5,
		callouts: [{ ...row("kept"), icon: { type: "lucide", value: "lucide-flame" } }],
		settings: { language: "he" },
	});
	return data as Json;
}

/** The join launch makes between a file and this device's recovery copy. */
function joinedWithCopy(file: Json, copy: Json): unknown {
	const writer = new SettingsWriter({ mergeConcurrent: true, build: () => ({}), write: async () => {} });
	return writer.recover(file, copy);
}

// ---------------------------------------------------------------------------

describe("which files a join with an equal copy hands back", () => {
	it("a version 2 file, deletions and all", () => {
		const file = stampedFile();
		assert.ok(path("callouts", "gone") in envelope(file).stamps, "the fixture has lost its tombstone");

		assert.equal(rejoinsAsItself(file), true);
		assert.equal(canonical(joinedWithCopy(file, reordered(file) as Json)), canonical(file));
	});

	it("a file that was never stamped", () => {
		const file = { version: 5, callouts: [{ id: "old", displayName: "Old" }], settings: {} };

		assert.equal(rejoinsAsItself(file), true);
		assert.equal(canonical(joinedWithCopy(file, structuredClone(file))), canonical(file));
	});

	it("not one whose envelope is version 1: the join brings it up to version 2", () => {
		const file = stampedFile();
		envelope(file).version = 1;
		delete envelope(file).fingerprint;
		assert.ok(validSyncEnvelope(file));

		assert.equal(rejoinsAsItself(file), false);
		assert.notEqual(canonical(joinedWithCopy(file, structuredClone(file))), canonical(file));
	});

	it("not one with a stamp on a field inside an icon: the join folds it into the icon", () => {
		const file = stampedFile();
		envelope(file).stamps[path("callouts", "kept", "icon", "value")] = [9, "an-older-build"];
		resealed(file);
		assert.ok(validSyncEnvelope(file));

		assert.equal(rejoinsAsItself(file), false);
		const joined = joinedWithCopy(file, structuredClone(file)) as Json;
		assert.notEqual(canonical(joined), canonical(file));
		assert.deepEqual(envelope(joined).stamps[path("callouts", "kept", "icon")], [9, "an-older-build"]);
	});

	it("not one whose envelope carries a field of its own: the join writes the three it knows", () => {
		const file = stampedFile();
		envelope(file).later = true;
		assert.ok(validSyncEnvelope(file));

		assert.equal(rejoinsAsItself(file), false);
		assert.notEqual(canonical(joinedWithCopy(file, structuredClone(file))), canonical(file));
	});

	it("is not misled by an icon's own stamp, or by a row or a field that is only named like one", () => {
		const file = stampedFile();
		const stamps = envelope(file).stamps;
		// The icon as a whole, a row called "icon", a row whose name spells out
		// the text looked for, and an "icon" that is not a callout's.
		stamps[path("callouts", "kept", "icon")] = [9, "this-device"];
		stamps[path("callouts", "icon", "displayName")] = [9, "this-device"];
		stamps[path("callouts", 'a","icon","b', "displayName")] = [9, "this-device"];
		stamps[path("settings", "x", "icon", "value")] = [9, "this-device"];
		resealed(file);

		assert.equal(rejoinsAsItself(file), true);
		assert.equal(canonical(joinedWithCopy(file, structuredClone(file))), canonical(file));
	});

	it("answers as the join itself does, across files a device's own sessions leave", () => {
		// Every file below is joined for real. Where the answer is yes the
		// join must return the file; the cuts that follow must each change it.
		let state = 20261115;
		const random = () => {
			state = (Math.imul(state, 1103515245) + 12345) >>> 0;
			return state / 2 ** 32;
		};
		const names = ["a", "b", "c", "note 2", 'q"uote', "עברית", "icon", 'x","icon","y'];
		let answeredYes = 0;
		for (let round = 0; round < 120; round++) {
			const sync = new SettingsSync(`device-${round % 3}`);
			let rows: { id: string; displayName: string; icon?: unknown; aliases?: string[] }[] = [];
			let file: Json = {};
			for (let save = 0; save < 1 + Math.floor(random() * 5); save++) {
				const id = names[Math.floor(random() * names.length)]!;
				if (random() < 0.3) rows = rows.filter((row) => row.id !== id);
				else if (rows.some((row) => row.id === id))
					rows = rows.map((row) => (row.id === id ? { ...row, displayName: `${id} ${save}` } : row));
				else
					rows = [
						...rows,
						{ id, displayName: id, icon: { type: "lucide", value: `lucide-${save}` }, aliases: ["z", "y"] },
					];
				file = sync.prepare({
					version: 5,
					callouts: rows,
					settings: {
						language: random() < 0.5 ? "en" : "he",
						customPalettes: [],
						nested: { deep: [1, { two: 2 }] },
					},
					iconSvgCache: random() < 0.5 ? [] : [{ pack: "p", name: `n${save}`, svg: "<svg/>" }],
				}) as Json;
				sync.adopt(file);
			}
			assert.equal(rejoinsAsItself(file), true, `round ${round}`);
			assert.equal(canonical(joinedWithCopy(file, reordered(file) as Json)), canonical(file), `round ${round}`);
			answeredYes++;

			const first = rows[0];
			if (!first) continue;
			const cut = structuredClone(file);
			envelope(cut).stamps[path("callouts", first.id, "icon", "type")] = [1, "an-older-build"];
			resealed(cut);
			assert.equal(rejoinsAsItself(cut), false, `round ${round}, cut`);
			assert.notEqual(
				canonical(joinedWithCopy(cut, structuredClone(cut))),
				canonical(cut),
				`round ${round}, cut`,
			);
		}
		assert.equal(answeredYes, 120);
	});
});

// ---------------------------------------------------------------------------

/** Count the joins a launch runs, and what each adoption was told about its text. */
function watched(device: LaunchedDevice): { joins: number; adoptions: boolean[] } {
	const seen = { joins: 0, adoptions: [] as boolean[] };
	const writer = device.host.settingsWriter;
	const recover = writer.recover.bind(writer);
	writer.recover = (incoming: unknown, saved: unknown) => {
		seen.joins++;
		return recover(incoming, saved);
	};
	const adopt = writer.adopt.bind(writer);
	writer.adopt = (json: string, diskJson?: string, envelopeChecked?: boolean) => {
		seen.adoptions.push(envelopeChecked === true);
		adopt(json, diskJson, envelopeChecked);
	};
	return seen;
}

/** The same change to the file and to the recovery copy, so the two stay one state. */
function inBoth(world: World, change: (data: Json) => void): void {
	const file = JSON.parse(world.disk!) as Json;
	change(file);
	world.disk = JSON.stringify(file, undefined, 2);
	const copy = structuredClone(world.checkpoint) as Json;
	change(copy);
	world.checkpoint = copy;
}

describe("a launch at rest joins nothing, and checks its file once", () => {
	it("takes the file without joining it to the copy that equals it", async () => {
		const world = await usedWorld("mine", "other");
		const before = world.disk;
		const device = launchDevice(world);
		const seen = watched(device);

		const boot = await device.boot();

		assert.equal(seen.joins, 0, "an ordinary launch joined the file with its own copy");
		assert.deepEqual(seen.adoptions, [true], "the file's envelope was checked again on adoption");
		assert.deepEqual(boot, { isFreshInstall: false, confirmLater: true });
		assert.equal(world.writes, 0);
		assert.equal(world.disk, before);
		assert.equal(world.files.size, 0, "a launch with nothing to adopt left a backup");
		assert.ok(device.registry.get("mine") && device.registry.get("other"));
		assert.equal(device.host.settingsWriter.isFrozen, false);
		device.close();
	});

	it("leaves the device able to save: the next edit lands, stamped over the file it took", async () => {
		const world = await usedWorld();
		const device = launchDevice(world);
		await device.layoutReady(await device.boot());

		device.registry.add(definition({ id: "added" }));
		await device.host.saveSettings();
		await device.settle();

		assert.equal(world.writes, 1);
		const saved = JSON.parse(world.disk!) as Json;
		assert.ok(validSyncEnvelope(saved));
		assert.ok(path("callouts", "added") in envelope(saved).stamps);
		assert.ok(path("callouts", "mine") in envelope(saved).stamps, "the stamps the file came with were dropped");
		assert.equal(canonical(world.checkpoint), canonical(saved), "the recovery copy did not follow the save");
		device.close();
	});

	it("still joins a conflict copy, with the file as the snapshot beside it", async () => {
		const world = await usedWorld();
		world.files.set(
			CONFLICT_COPY,
			await fileFromAnotherDevice(world, (registry) => registry.add(definition({ id: "theirs" }))),
		);
		const device = launchDevice(world);
		const seen = watched(device);

		await device.boot();

		assert.equal(seen.joins, 2, "the copy and the conflict copy are each a join");
		assert.deepEqual(seen.adoptions, [false], "a merge's result was adopted as text already checked");
		assert.ok(device.registry.get("theirs") && device.registry.get("mine"));
		device.close();
	});

	it("still folds stamps from inside an icon, and writes the file that results", async () => {
		const world = await usedWorld();
		inBoth(world, (data) => {
			envelope(data).stamps[path("callouts", "mine", "icon", "value")] = [40, "an-older-build"];
			resealed(data);
		});
		const device = launchDevice(world);
		const seen = watched(device);

		await device.boot();

		assert.equal(world.waits, 0, "the copy equals the file: this launch is at rest");
		assert.equal(seen.joins, 1);
		assert.equal(world.writes, 1, "the folded stamps were not written back");
		const stamps = envelope(JSON.parse(world.disk!) as Json).stamps;
		assert.equal(path("callouts", "mine", "icon", "value") in stamps, false);
		assert.deepEqual(stamps[path("callouts", "mine", "icon")], [40, "an-older-build"]);
		device.close();
	});

	it("still brings a version 1 envelope up to version 2", async () => {
		const world = await usedWorld();
		inBoth(world, (data) => {
			envelope(data).version = 1;
			delete envelope(data).fingerprint;
		});
		const device = launchDevice(world);
		const seen = watched(device);

		await device.boot();

		assert.equal(world.waits, 0);
		assert.equal(seen.joins, 1);
		assert.equal(world.writes, 1);
		const saved = JSON.parse(world.disk!) as Json;
		assert.equal(envelope(saved).version, 2);
		assert.ok(validSyncEnvelope(saved));
		device.close();
	});

	it("joins a file another device wrote exactly as before", async (context) => {
		quiet(context);
		const world = await usedWorld();
		world.disk = await fileFromAnotherDevice(world, (registry) => registry.add(definition({ id: "theirs" })));
		const device = launchDevice(world);
		const seen = watched(device);

		await device.boot();

		assert.equal(world.waits, 1, "a file this device has not seen was taken on one read");
		assert.equal(seen.joins, 1);
		assert.ok(device.registry.get("theirs") && device.registry.get("mine"));
		device.close();
	});
});

// ---------------------------------------------------------------------------

function fileHost(raw: unknown): Parameters<typeof readSettingsFile>[0] {
	return {
		app: {
			vault: { configDir: ".obsidian", adapter: { exists: () => Promise.resolve(raw !== null) } },
		} as unknown as App,
		manifest: { id: "callout-studio", dir: PLUGIN_DIR } as unknown as PluginManifest,
		loadData: () => Promise.resolve(raw),
	};
}

describe("which text adoption may take as already checked", () => {
	it("a read of the file, as it was returned", async () => {
		const read = await readSettingsFile(fileHost(stampedFile()));

		assert.equal(read.kind, "loaded");
		assert.equal(isCheckedRead(read), true);
	});

	it("not the same read once its text is another", async () => {
		const read = (await readSettingsFile(fileHost(stampedFile()))) as Extract<SettingsRead, { kind: "loaded" }>;
		const other = structuredClone(stampedFile());
		envelope(other).fingerprint = "0123456789abcdef";

		read.json = JSON.stringify(other);

		assert.equal(isCheckedRead(read), false);
	});

	it("not a copy of a read, a read put together by hand, or a file that is not there", async () => {
		const file = stampedFile();
		const read = await readSettingsFile(fileHost(file));

		assert.equal(isCheckedRead({ ...read }), false);
		assert.equal(isCheckedRead({ kind: "loaded", data: file, json: JSON.stringify(file) }), false);
		assert.equal(isCheckedRead(await readSettingsFile(fileHost(null))), false);
		assert.equal(isCheckedRead({ kind: "unreadable" }), false);
	});

	it("a file with a broken envelope is never returned as loaded, so never as checked", async () => {
		const file = stampedFile();
		envelope(file).fingerprint = "0123456789abcdef";

		const read = await readSettingsFile(fileHost(file));

		assert.equal(read.kind, "unreadable");
		assert.equal(isCheckedRead(read), false);
	});

	it("a read put together by hand with a broken envelope is refused on adoption, as it always was", async (context) => {
		quiet(context);
		const world = await usedWorld();
		const device = launchDevice(world);
		await device.boot();
		const broken = JSON.parse(world.disk!) as Json;
		envelope(broken).fingerprint = "0123456789abcdef";

		await assert.rejects(
			() => applySettingsRead(device.host, { kind: "loaded", data: broken, json: JSON.stringify(broken) }),
			/envelope does not match/,
		);
		device.close();
	});
});

// ---------------------------------------------------------------------------

function syncWriter(): SettingsWriter {
	return new SettingsWriter({ mergeConcurrent: true, build: () => ({}), write: async () => {} });
}

describe("adopting a file's text", () => {
	it("checks the envelope unless told the read already has", () => {
		const broken = stampedFile();
		envelope(broken).fingerprint = "0123456789abcdef";
		const json = JSON.stringify(broken);

		assert.throws(() => syncWriter().adopt(json), /envelope does not match/);
		assert.throws(() => syncWriter().adopt(json, json, false), /envelope does not match/);
		// What the third argument is: the one place the check is not repeated.
		assert.doesNotThrow(() => syncWriter().adopt(json, json, true));
	});

	it("parses the text once when what is adopted is the file as it stands", (context) => {
		const json = JSON.stringify(stampedFile());
		const writer = syncWriter();
		const parse = JSON.parse.bind(JSON);
		let parses = 0;
		context.mock.method(JSON, "parse", (text: string, ...rest: []) => {
			if (text === json) parses++;
			return parse(text, ...rest) as unknown;
		});

		writer.adopt(json);

		assert.equal(parses, 1);
	});

	it("leaves the same baseline and saved content whichever way the text came", () => {
		const file = stampedFile();
		const json = JSON.stringify(file);
		const asWritten = JSON.stringify(reordered(file), undefined, 2);
		// The file as it stands; a merge's result over a file spelled differently; and the reverse.
		const direct = syncWriter();
		direct.adopt(json);
		const overDisk = syncWriter();
		overDisk.adopt(json, asWritten);
		const reversed = syncWriter();
		reversed.adopt(asWritten, json);

		for (const writer of [direct, overDisk, reversed]) {
			assert.equal(writer.matchesLastWrite(json), true);
			assert.equal(writer.matchesLastWrite(asWritten), true);
			assert.equal(writer.matchesLastWrite(json, true), true);
			assert.equal(writer.hasRecoveryState, true);
			assert.equal(canonical(writer.lastSaved), canonical(direct.lastSaved));
			assert.equal(writer.matchesLastWrite(JSON.stringify({ ...file, version: 6 })), false);
		}
		const { [SYNC_KEY]: _envelope, ...body } = file;
		assert.equal(canonical(direct.lastSaved), canonical(body));
	});

	it("keeps the file on disk as the baseline when it differs from what is adopted", () => {
		const onDisk = stampedFile();
		const merged = structuredClone(onDisk);
		(merged.settings as Json).language = "fr";
		resealed(merged);
		const writer = syncWriter();

		writer.adopt(JSON.stringify(merged), JSON.stringify(onDisk));

		assert.equal(writer.matchesLastWrite(JSON.stringify(onDisk)), true);
		assert.equal(writer.matchesLastWrite(JSON.stringify(merged)), false);
		assert.equal((writer.lastSaved as { settings: Json }).settings.language, "he");
	});
});

describe("SaveGuard.adoptParsed", () => {
	it("is adopt() for text already parsed", () => {
		const file = stampedFile();
		const text = JSON.stringify(reordered(file), undefined, 2);
		const fromText = new SaveGuard();
		fromText.adopt(text);
		const fromObject = new SaveGuard();
		fromObject.adoptParsed(JSON.parse(text));

		for (const guard of [fromText, fromObject]) {
			assert.equal(guard.hasBaseline, true);
			assert.equal(guard.matches(JSON.stringify(file)), true);
			assert.equal(guard.prepare(file), null, "a payload equal to the adopted file was not suppressed");
			assert.notEqual(guard.prepare({ ...file, version: 6 }), null);
		}
	});
});
