/**
 * tests/syncPingPong.test.ts — two devices, and the question of whether they
 * ever stop talking.
 *
 * `syncConflictRegression.test.ts` proved the first half of issue #41: a device
 * that merely *reads* a synced note no longer edits `data.json`. It could not
 * prove the second half, because its "disk" has no subscribers — a write by one
 * device is never delivered to the other, so a runaway exchange between them is
 * exactly the thing that harness cannot see.
 *
 * This file adds the missing wire. Every write is handed to the other device as
 * an external change, through the **real** `adoptExternalSettings`, and the loop
 * keeps going until nobody writes back. The central assertion is therefore not
 * about content at all — it is that the exchange **terminates**.
 *
 * What it is reproducing, from the reporter's own screenshot: two devices
 * writing `data.json` alternately every few seconds, one of them producing
 * 0-byte files, until the settings were gone.
 *
 * Obsidian is modelled only where it is load bearing, and then exactly:
 *
 * - `saveData` writes `JSON.stringify(data, undefined, 2)` — pretty-printed —
 *   while the write guard compares compact output. If the parse/stringify
 *   round-trip in `settingsFile.ts` did not normalize that, every adopt would
 *   look like a change and none of this would settle.
 * - `loadData` answers `null` for a missing file and `undefined` for one it
 *   could not parse. That distinction is the whole of `manager/settingsFile.ts`.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App, EventRef, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import {
	adoptExternalSettings,
	loadSettingsInto,
} from "../src/manager/settingsBoot";
import type { ExternalReloadHost } from "../src/manager/settingsBoot";
import type { CalloutDefinition, IconSvgCacheEntry } from "../src/types";

/** One `localStorage` for the process, scoped per device by `appId`. */
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
	setTimeout: () => 0,
	clearTimeout: () => undefined,
	localStorage: {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => {
			storage.set(key, value);
		},
	},
};

/* -------------------------------------------------------------------------- */
/* The world                                                                  */
/* -------------------------------------------------------------------------- */

/** The one `data.json`, and a queue of writes waiting to be synced. */
class Disk {
	/** `null` means the file does not exist. */
	content: string | null = null;
	/** Every write, by device, in order. */
	readonly writes: string[] = [];
	/** Writes the sync client has not delivered yet. */
	readonly pending: string[] = [];

	save(device: string, json: string): void {
		this.writes.push(device);
		this.pending.push(device);
		this.content = json;
	}

	writesBy(device: string): number {
		return this.writes.filter((d) => d === device).length;
	}
}

type Device = ReturnType<typeof device>;

function device(name: string, disk: Disk) {
	const app = {
		appId: name,
		vault: {
			getName: () => "shared-vault",
			configDir: ".obsidian",
			adapter: {
				// The file is there whenever the disk holds anything at all,
				// including the empty string — which is the case that matters.
				exists: () => Promise.resolve(disk.content !== null),
			},
			getMarkdownFiles: () => [],
			on: () => ({}) as EventRef,
		},
		metadataCache: { on: () => ({}) as EventRef },
		workspace: { activeEditor: null },
	} as unknown as App;

	const registry = new CalloutRegistry();
	const localState = new DeviceLocalStore(app);
	const writer = new SettingsWriter({
		build: () => registry.toSaveData(),
		write: (data) => {
			// Exactly what Obsidian's `Vault.writeJson` puts on disk.
			disk.save(name, JSON.stringify(data, undefined, 2));
			return Promise.resolve();
		},
	});

	// `main.ts:295-300`, and the reason this file exists: EVERY registry change
	// asks for a save. The reload re-adds this device's discovered rows, that
	// counts as a change, and so a reload always asks — which is what made the
	// old cleared baseline write the incoming file straight back out.
	registry.onChange(() => {
		void writer.save();
	});

	let themeSweeps = 0;

	const host: ExternalReloadHost = {
		app,
		manifest: {
			id: "callout-studio",
			dir: ".obsidian/plugins/callout-studio",
		} as PluginManifest,
		// `Vault.readJson`, faithfully: null only for a missing file, undefined
		// for anything it could not parse.
		loadData: () => {
			if (disk.content === null) return Promise.resolve(null);
			try {
				return Promise.resolve(JSON.parse(disk.content) as unknown);
			} catch {
				return Promise.resolve(undefined);
			}
		},
		registry,
		localState,
		settingsWriter: writer,
		saveSettings: () => writer.save(),
		pruneSuspended: false,
		resyncThemeRows: () => {
			themeSweeps++;
		},
		customCommands: { syncAll: () => undefined },
		refreshCallouts: () => undefined,
	};

	return {
		name,
		registry,
		localState,
		host,
		writer,
		/** The startup path. */
		boot: () => loadSettingsInto(host),
		/** The sync client landing the other device's file here. */
		adopt: () => adoptExternalSettings(host),
		save: () => writer.save(),
		themeSweeps: () => themeSweeps,
		/** What this device would write right now. */
		snapshot: () => JSON.stringify(registry.toSaveData()),
	};
}

/**
 * Deliver every queued write to the other device, and keep going for as long as
 * that provokes more writes.
 *
 * Throws rather than hanging when it does not settle — a runaway exchange is the
 * bug, so it has to fail loudly and quickly rather than time the suite out.
 */
async function settle(
	disk: Disk,
	devices: Device[],
	maxRounds = 12,
): Promise<number> {
	let rounds = 0;
	while (disk.pending.length > 0) {
		if (++rounds > maxRounds) {
			throw new Error(
				`data.json is still being rewritten after ${maxRounds} rounds: ` +
					`${disk.writes.join(" → ")}`,
			);
		}
		const from = disk.pending.shift() as string;
		for (const d of devices) {
			if (d.name !== from) await d.adopt();
		}
	}
	return rounds;
}

/** A callout the user made and styled — authoritative, by every rule. */
const authored = (id: string): CalloutDefinition => ({
	id,
	displayName: id,
	icon: { type: "lucide", value: "star" },
	colorLight: "#336699",
	colorDark: "#336699",
	builtIn: false,
	source: "user",
	customized: true,
	aliases: [],
	foldable: false,
	defaultFolded: false,
});

const art = (name: string): IconSvgCacheEntry => ({
	pack: "lucide",
	name,
	variant: "",
	svg: `<svg id="${name}"/>`,
});

/** Two booted devices over one disk. */
async function world() {
	storage.clear();
	const disk = new Disk();
	const a = device("A", disk);
	const b = device("B", disk);
	await a.boot();
	await b.boot();
	return { disk, a, b, all: [a, b] };
}

/* -------------------------------------------------------------------------- */
/* The runaway loop                                                           */
/* -------------------------------------------------------------------------- */

describe("two devices exchanging data.json", () => {
	it("writes nothing when it adopts a file that changes nothing", async () => {
		// Root cause A, at its smallest. B has discovered ids of its own, so the
		// reload re-adds those rows and fires `onChange` — which asks for a save.
		// The old `invalidate()` made that save unconditional, so B rewrote the
		// file A had just sent it, and A then did the same back.
		const { disk, a, b } = await world();
		a.localState.remember(["seen-one"]);
		b.localState.remember(["seen-one", "seen-two"]);

		a.registry.add(authored("tip-plus"));
		await a.save();
		const before = disk.writesBy("B");

		await b.adopt();
		assert.strictEqual(disk.writesBy("B"), before);
	});

	it("settles after one device changes something", async () => {
		const { disk, a, b, all } = await world();
		// BOTH devices have seen the callouts written in the synced notes —
		// which is the normal state, and the state the loop needs: a reload
		// re-adds these rows, that counts as a change, and so every reload on
		// every device asks for a save.
		a.localState.remember(["seen-one"]);
		b.localState.remember(["seen-one"]);

		a.registry.add(authored("tip-plus"));
		await a.save();

		const rounds = await settle(disk, all);
		assert.ok(rounds <= 2, `settled in ${rounds} rounds`);
		assert.strictEqual(disk.writesBy("A"), 1);
		assert.strictEqual(disk.writesBy("B"), 0);
		assert.strictEqual(a.snapshot(), b.snapshot());
	});

	it("settles when both devices changed something while apart", async () => {
		// The reporter's scenario: X configures a callout while Y is asleep, and
		// Y has its own local state when it wakes.
		const { disk, a, b, all } = await world();
		a.localState.remember(["seen-on-a", "shared"]);
		b.localState.remember(["seen-on-b", "shared"]);

		a.registry.add(authored("from-a"));
		await a.save();
		b.registry.add(authored("from-b"));
		await b.save();

		await settle(disk, all);
		assert.strictEqual(a.snapshot(), b.snapshot());
		// Byte-identical is the thing a file-level sync client compares.
		assert.strictEqual(a.snapshot(), JSON.stringify(JSON.parse(disk.content!)));
	});

	it("recognises its own write coming back without rebuilding", async () => {
		// Obsidian re-fires the config watcher for our own saves: it restores
		// `_lastDataModifiedTime` to the value it read *before* awaiting the
		// handler, so the stamp `saveData` set during it is rolled back.
		const { disk, a } = await world();
		a.registry.add(authored("tip-plus"));
		await a.save();
		const sweeps = a.themeSweeps();
		const writes = disk.writesBy("A");

		await a.adopt();
		assert.strictEqual(disk.writesBy("A"), writes, "wrote its own file back");
		assert.strictEqual(a.themeSweeps(), sweeps, "rebuilt for its own write");
	});

	it("does not diverge over the order artwork was cached in", async () => {
		// Root cause C. `iconSvgCache` is appended to in fetch order, so two
		// devices holding the same artwork used to serialize different bytes —
		// a real difference that no write suppression can help with, and the
		// last thing keeping the conflict copies coming.
		const { a, b } = await world();
		for (const name of ["alpha", "beta", "gamma"]) a.registry.addIconSvg(art(name));
		for (const name of ["gamma", "alpha", "beta"]) b.registry.addIconSvg(art(name));

		assert.strictEqual(a.snapshot(), b.snapshot());
	});
});

/* -------------------------------------------------------------------------- */
/* A file we cannot read                                                      */
/* -------------------------------------------------------------------------- */

describe("a data.json that cannot be read", () => {
	it("leaves an adopting device's settings untouched, and writes nothing", async () => {
		// Root cause B, and the 0-byte files in the reporter's screenshot.
		// `JSON.parse("")` throws, Obsidian answers `undefined`, and treating
		// that as "no saved data" cleared the registry — which the reload then
		// wrote back out.
		const { disk, a } = await world();
		a.registry.add(authored("tip-plus"));
		await a.save();
		const writes = disk.writesBy("A");

		disk.content = "";
		assert.strictEqual(await a.adopt(), true, "stays pending, to retry");
		assert.ok(a.registry.get("tip-plus"), "the callout survived");
		assert.strictEqual(disk.writesBy("A"), writes, "wrote over an unread file");
	});

	it("survives a truncated file mid-transfer", async () => {
		const { disk, a } = await world();
		a.registry.add(authored("tip-plus"));
		await a.save();
		const writes = disk.writesBy("A");

		disk.content = '{"version":4,"callouts":[{"id":"tip-p';
		await a.adopt();
		assert.ok(a.registry.get("tip-plus"));
		assert.strictEqual(disk.writesBy("A"), writes);
	});

	it("does not adopt a file that has gone missing", async () => {
		// A sync client renames the local copy aside before writing the remote
		// one, so "absent" is a gap far more often than it is an instruction.
		const { disk, a } = await world();
		a.registry.add(authored("tip-plus"));
		await a.save();
		const writes = disk.writesBy("A");

		disk.content = null;
		await a.adopt();
		assert.ok(a.registry.get("tip-plus"));
		assert.strictEqual(disk.writesBy("A"), writes);
	});

	it("writes nothing for the whole session when startup could not read it", async () => {
		// At startup there is no earlier state to protect, so the registry does
		// come up empty — but the file must never be replaced with that.
		storage.clear();
		const disk = new Disk();
		disk.content = "}} not json {{";
		const a = device("A", disk);
		await a.boot();

		assert.strictEqual(disk.writesBy("A"), 0);
		a.registry.add(authored("made-after-the-failure"));
		await a.save();
		assert.strictEqual(disk.writesBy("A"), 0, "a frozen writer wrote");
		assert.strictEqual(disk.content, "}} not json {{", "the file changed");
	});

	it("still treats a genuinely missing file as a fresh install", async () => {
		storage.clear();
		const disk = new Disk();
		const a = device("A", disk);
		assert.strictEqual((await a.boot()).isFreshInstall, true);
	});

	it("does not treat an empty object as a fresh install", async () => {
		// A file somebody wrote — including a user whose data.json this very bug
		// emptied. Greeting them as new would write `welcomeSeen` over whatever
		// is about to arrive from the other device.
		storage.clear();
		const disk = new Disk();
		disk.content = "{}";
		const a = device("A", disk);
		assert.strictEqual((await a.boot()).isFreshInstall, false);
	});
});
