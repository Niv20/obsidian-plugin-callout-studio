/**
 * tests/syncConflictRegression.test.ts — one vault, two devices, a sync client
 * between them.
 *
 * This is issue #41 as a test. Device A creates a callout and writes a note
 * using it. Both files sync. Device B has Obsidian open, so it sees the note
 * before — or after, the order turns out not to matter — it sees the settings.
 *
 * What used to happen: B discovered the id, minted a fully fallback-styled row
 * for it, and wrote that row into its own `data.json`. Merely *reading* a note
 * therefore edited the settings file, and edited it differently on each device.
 * Two files that should have been identical diverged on their own, and the sync
 * client could only keep one and rename the other `data.sync-conflict-*`.
 *
 * So the assertions are mostly about writes that must NOT happen, and about two
 * `toSaveData()` snapshots being byte-identical rather than merely equivalent —
 * byte-identical is what a file-level sync client actually compares.
 *
 * The devices here are two `CalloutRegistry` + `CalloutDiscovery` pairs over one
 * shared "disk". Each gets its own `localStorage` scope, because that is the
 * whole point: the discovery index is per machine and never travels.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { TFile } from "obsidian";
import type { App, EventRef } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutDiscovery } from "../src/manager/CalloutDiscovery";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { bootDiscoveryIndex } from "../src/manager/discoveryIndexBoot";
import type { CalloutDefinition, PluginData } from "../src/types";

/* -------------------------------------------------------------------------- */
/* The world                                                                  */
/* -------------------------------------------------------------------------- */

/** One `localStorage` for the whole process, scoped per device by `appId`. */
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

/** The synced vault: markdown notes, shared by every device. */
class Vault {
	readonly notes = new Map<string, string>();
	/**
	 * Stable handles. `scanFileNow` compares the file it was queued for against
	 * `getAbstractFileByPath` by identity — that is how it notices a rename —
	 * so a fake handing out a fresh object per call makes every scan bail.
	 */
	private readonly handles = new Map<string, TFile>();

	/** Bumped per write, so each handle gets a distinct, increasing mtime. */
	private clock = 1_700_000_000_000;

	write(path: string, content: string): void {
		this.notes.set(path, content);
		const existing = this.handles.get(path);
		// `stat` is not decoration: the scan memo keys on `mtime`, so a handle
		// without one makes every scan throw. See manager/discoveryScheduler.ts.
		if (existing) existing.stat.mtime = ++this.clock;
		else {
			this.handles.set(
				path,
				Object.assign(new TFile(), {
					path,
					extension: "md",
					stat: { ctime: this.clock, mtime: ++this.clock, size: 0 },
				}),
			);
		}
	}
	handle(path: string): TFile {
		this.write(path, this.notes.get(path) ?? "");
		return this.handles.get(path)!;
	}
	all(): TFile[] {
		return [...this.notes.keys()].map((p) => this.handles.get(p)!);
	}
}

/**
 * The one `data.json`, plus the only thing about a sync client that matters
 * here: it can only tell that two devices both wrote, never how to merge them.
 */
class Disk {
	content: string | null = null;
	/** Every write, by device, in order. */
	readonly writes: string[] = [];

	save(device: string, json: string): void {
		this.writes.push(device);
		this.content = json;
	}
	writesBy(device: string): number {
		return this.writes.filter((d) => d === device).length;
	}
}

function device(name: string, vault: Vault, disk: Disk) {
	let reads = 0;
	const app = {
		appId: name,
		vault: {
			getName: () => "shared-vault",
			getMarkdownFiles: () => vault.all(),
			cachedRead: (file: { path: string }) => {
				reads++;
				return Promise.resolve(vault.notes.get(file.path) ?? "");
			},
			getAbstractFileByPath: (path: string) =>
				vault.notes.has(path) ? vault.handle(path) : null,
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
			disk.save(name, JSON.stringify(data));
			return Promise.resolve();
		},
	});
	const saveSettings = () => writer.save();

	const discovery = new CalloutDiscovery({
		app,
		registry,
		settings: registry.settings,
		localState,
		saveSettings,
		refreshCallouts: () => undefined,
		registerEvent: () => undefined,
	});

	const self = {
		name,
		registry,
		localState,
		discovery,
		saveSettings,
		/** Start (or restart) the session from whatever is on disk. */
		launch(): void {
			const saved = disk.content
				? (JSON.parse(disk.content) as Partial<PluginData>)
				: null;
			registry.load(saved);
			bootDiscoveryIndex(registry, localState, saved);
			writer.invalidate();
		},
		/** The scan the incremental watcher would run for one changed note. */
		open(path: string): Promise<void> {
			return (
				discovery as unknown as { scanFileNow(f: TFile): Promise<void> }
			).scanFileNow(vault.handle(path));
		},
		/** How many notes this device has read. */
		reads: () => reads,
		/** What this device would write to `data.json` right now. */
		snapshot: () => JSON.stringify(registry.toSaveData()),
	};
	return self;
}

/** A callout the user made and styled — authoritative, by every rule. */
const authored = (id: string): CalloutDefinition => ({
	id,
	displayName: "Tip Plus",
	icon: { type: "lucide", value: "star" },
	colorLight: "#7b2ff7",
	colorDark: "#c9a3ff",
	foldable: true,
	defaultFolded: false,
	builtIn: false,
	source: "user",
	customized: true,
});

function world() {
	storage.clear();
	const vault = new Vault();
	const disk = new Disk();
	const a = device("A", vault, disk);
	const b = device("B", vault, disk);
	a.launch();
	b.launch();
	return { vault, disk, a, b };
}

/* -------------------------------------------------------------------------- */
/* The report                                                                 */
/* -------------------------------------------------------------------------- */

describe("two devices, one vault — the reported failure", () => {
	it("B writes nothing when a synced note names a callout it has never seen", async () => {
		const { vault, disk, a, b } = world();

		// A makes the callout and a note using it, and both sync.
		a.registry.add(authored("tip-plus"));
		await a.saveSettings();
		vault.write("Note.md", "> [!tip-plus] Hello");

		// B still holds the settings it launched with, and opens the note.
		const before = disk.writesBy("B");
		await b.open("Note.md");

		assert.strictEqual(
			disk.writesBy("B"),
			before,
			"opening a note must not edit the settings file",
		);
		assert.ok(b.registry.get("tip-plus"), "the row still exists for B");
		assert.deepStrictEqual(
			b.registry.toSaveData().callouts,
			[],
			"and data.json still says nothing about it",
		);
	});

	it("converges when the note arrives before the settings", async () => {
		const { vault, a, b } = world();

		a.registry.add(authored("tip-plus"));
		vault.write("Note.md", "> [!tip-plus] Hello");
		await b.open("Note.md"); // B discovers it first, from the note alone
		await a.saveSettings(); // ...and only now does A's file land

		// Both read the file back — convergence is about what the two devices
		// hold once each has seen it, not about one of them holding a snapshot
		// it has never round-tripped.
		a.launch();
		b.launch();

		assert.strictEqual(a.snapshot(), b.snapshot());
		assert.strictEqual(b.registry.get("tip-plus")?.colorLight, "#7b2ff7");
	});

	it("converges when the settings arrive before the note", async () => {
		const { vault, disk, a, b } = world();

		a.registry.add(authored("tip-plus"));
		await a.saveSettings();
		b.launch();
		vault.write("Note.md", "> [!tip-plus] Hello");

		const before = disk.writesBy("B");
		await b.open("Note.md");

		// The id is simply known now, so there is nothing to discover at all.
		assert.strictEqual(disk.writesBy("B"), before);
		a.launch();
		assert.strictEqual(a.snapshot(), b.snapshot());
	});

	it("keeps the two files identical when each device discovers a different id", async () => {
		const { vault, a, b } = world();

		vault.write("A.md", "> [!from-a] x");
		vault.write("B.md", "> [!from-b] y");
		await a.open("A.md");
		await b.open("B.md");

		assert.ok(a.registry.get("from-a"));
		assert.ok(b.registry.get("from-b"));
		assert.strictEqual(a.snapshot(), b.snapshot());
	});

	it("lets an explicit configuration take a name a placeholder was holding", async () => {
		const { vault, a, b } = world();

		// B has met the id in a note; A configures it deliberately.
		vault.write("Note.md", "> [!tip-plus] Hello");
		await b.open("Note.md");
		assert.strictEqual(b.registry.get("tip-plus")?.customized, undefined);

		a.registry.add(authored("tip-plus"));
		await a.saveSettings();
		b.launch();

		const row = b.registry.get("tip-plus");
		assert.strictEqual(row?.customized, true);
		assert.strictEqual(row?.colorLight, "#7b2ff7");
	});
});

describe("two devices, one vault — the writes that remain", () => {
	it("writes when the user actually configures something", async () => {
		const { disk, a } = world();
		const before = disk.writesBy("A");
		a.registry.add(authored("tip-plus"));
		await a.saveSettings();
		assert.strictEqual(disk.writesBy("A"), before + 1);
	});

	it("does not rewrite the file when nothing changed", async () => {
		const { disk, a } = world();
		a.registry.add(authored("tip-plus"));
		await a.saveSettings();
		const before = disk.writesBy("A");
		await a.saveSettings();
		await a.saveSettings();
		assert.strictEqual(disk.writesBy("A"), before);
	});

	it("re-asserts local state after an external change, identical or not", async () => {
		// The guard's baseline describes what WE last wrote. Once another
		// device's file is on disk it is a lie, and leaving it standing lets a
		// byte-identical comparison suppress the write that would fix things.
		const { disk, a } = world();
		a.registry.add(authored("tip-plus"));
		await a.saveSettings();

		a.launch(); // stands in for onExternalSettingsChange's reload
		const before = disk.writesBy("A");
		a.registry.update("tip-plus", { colorLight: "#111111" });
		await a.saveSettings();
		assert.strictEqual(disk.writesBy("A"), before + 1);
	});
});

describe("two devices, one vault — surviving a restart", () => {
	it("puts the discovered rows back without reading a single note", async () => {
		// The reason the index is persisted at all. Re-deriving these rows from
		// the vault would mean a whole-vault scan on every single launch.
		const { vault, b } = world();
		vault.write("Note.md", "> [!seen] x");
		await b.open("Note.md");

		const before = b.reads();
		b.launch();

		assert.ok(b.registry.get("seen"), "restored from the index");
		assert.strictEqual(b.reads(), before, "and nothing was read to do it");
	});

	it("does not resurrect a row the user deliberately deleted", async () => {
		const { vault, b } = world();
		vault.write("Note.md", "> [!seen] x");
		await b.open("Note.md");

		// The delete flow: hold rediscovery, then remove.
		b.discovery.suppressRediscovery(["seen"]);
		b.registry.remove("seen");
		await b.saveSettings();

		b.launch();
		assert.strictEqual(b.registry.get("seen"), undefined);
	});
});
