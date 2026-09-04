/**
 * tests/syncMobileWipe.test.ts — issue #53, and the device shape the rest of
 * the suite could not express.
 *
 * `syncPingPong.test.ts` models two desktops. Both of its devices expose
 * `adoptExternalSettings`, because on desktop Obsidian watches the config
 * folder and calls `onExternalSettingsChange` when a synced file lands. A phone
 * has no such watcher — `adapter.watchHiddenRecursive` is guarded by
 * `adapter instanceof FileSystemAdapter`, and the Capacitor adapter is not one —
 * so a phone reads `data.json` exactly once, at `onload`, and never again.
 *
 * That is the whole of the reporter's bug. Everything the desktop path does to
 * protect a file it could not read is irrelevant on a device that only ever
 * takes the startup path, and the startup path had two ways to decide there was
 * nothing to protect:
 *
 * - the file was **unreadable** — half-synced, truncated, 0 bytes — which
 *   `manager/settingsFile.ts` already tells apart from a fresh vault, and
 * - the file was **absent**, which it did not, and which is what a sync client
 *   leaves behind while it renames the local copy aside to make room for the
 *   remote one.
 *
 * Both end with a registry holding nothing but the shipped built-ins. The
 * question these tests ask is only ever the same one: does that emptiness reach
 * the file?
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App, EventRef, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { loadSettingsInto } from "../src/manager/settingsBoot";
import type { ExternalReloadHost } from "../src/manager/settingsBoot";
import { stillFreshInstall } from "../src/manager/settingsLateArrival";
import { maybeShowWelcomeOnLaunch } from "../src/settings/welcomeRouting";
import type { CalloutDefinition } from "../src/types";
import { installFakeDom } from "./support/fakeDom";

// The missing-file notice builds its escape hatch out of `createFragment` and
// `createEl`, which are Obsidian globals rather than DOM standards.
installFakeDom();

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

/** The one `data.json`. `null` means the file is not there. */
class Disk {
	content: string | null = null;
	writes = 0;

	save(json: string): void {
		this.writes++;
		this.content = json;
	}
}

/**
 * A phone. Deliberately missing `adopt` — the point of the file is that this
 * device has no way back to the settings file after `onload`.
 */
function phone(name: string, disk: Disk) {
	const app = {
		appId: name,
		vault: {
			getName: () => "shared-vault",
			configDir: ".obsidian",
			adapter: {
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
			disk.save(JSON.stringify(data, undefined, 2));
			return Promise.resolve();
		},
	});

	// `main.ts`: every registry change asks for a save. This is the wire that
	// turns "the registry came up empty" into "the file is now empty".
	registry.onChange(() => {
		void writer.save();
	});

	const host: ExternalReloadHost = {
		app,
		manifest: {
			id: "callout-studio",
			dir: ".obsidian/plugins/callout-studio",
		} as PluginManifest,
		// `Vault.readJson`: null only for a missing file, undefined for one it
		// could not parse.
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
		resyncThemeRows: () => undefined,
		customCommands: { syncAll: () => undefined },
		refreshCallouts: () => undefined,
	};

	return {
		registry,
		localState,
		host,
		writer,
		boot: () => loadSettingsInto(host),
		save: () => writer.save(),
	};
}

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

/** What a desktop had built and synced over, as bytes on the shared disk. */
function vaultWithUserCallouts(): Disk {
	const disk = new Disk();
	const seed = new CalloutRegistry();
	seed.load(null);
	seed.add(authored("insight"));
	seed.add(authored("warning-plus"));
	disk.content = JSON.stringify(seed.toSaveData(), undefined, 2);
	disk.writes = 0;
	return disk;
}

describe("a phone whose data.json has not arrived", () => {
	it("writes nothing when the file is missing on a device that has run before", async () => {
		// Issue #53. The phone has used this vault before — so it has a device
		// index — and opens to find no settings file, because the sync client
		// has the local copy renamed aside mid-swap. Every custom callout is
		// missing from the registry; none of that may reach the disk.
		storage.clear();
		const disk = vaultWithUserCallouts();
		const settingsOnDisk = disk.content;

		const first = phone("phone", disk);
		await first.boot();
		assert.ok(first.registry.get("insight"), "the file was there to read");

		// Second launch, and this time the file is gone.
		disk.content = null;
		const second = phone("phone", disk);
		assert.ok(second.localState.hasIndex, "the device remembers itself");
		await second.boot();

		assert.strictEqual(disk.writes, 0, "wrote over a file it never read");
		assert.strictEqual(disk.content, null, "created a file from nothing");

		// And nothing later in the session may undo that, either — the phone
		// cannot re-read, so it stays wrong for as long as it is open.
		second.registry.add(authored("made-while-blind"));
		await second.save();
		assert.strictEqual(disk.writes, 0, "a frozen writer wrote");

		// The desktop's settings are untouched, which is the whole point.
		disk.content = settingsOnDisk;
		const third = phone("phone", disk);
		await third.boot();
		assert.ok(third.registry.get("insight"), "the callouts survived");
		assert.ok(third.registry.get("warning-plus"), "the callouts survived");
	});

	it("still lets a genuine fresh install save its first callout", async () => {
		// The other direction, and the more common one by far. Refusing to write
		// here would be its own data loss: nothing the user makes is ever kept.
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);

		const boot = await p.boot();
		assert.strictEqual(boot.isFreshInstall, true);

		p.registry.add(authored("first-one"));
		await p.save();
		assert.ok(disk.writes > 0, "a fresh install could not save");
		assert.ok(
			(disk.content ?? "").includes("first-one"),
			"the callout did not reach the file",
		);
	});

	it("creates no file at all on a launch that only found built-ins", async () => {
		// A fresh install writes when it has something to say, not merely
		// because it started. On a device a synced vault is still reaching,
		// that ceremonial write is precisely the payload that must not exist.
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);

		await p.boot();

		assert.strictEqual(disk.writes, 0, "startup created a settings file");
		assert.strictEqual(disk.content, null);
	});
});

describe("a data.json that turns up after startup", () => {
	it("is adopted rather than replaced with the defaults", async () => {
		// The remaining shape of #53: a device this vault has only just reached,
		// so there is no device index to say the file ever existed. It arrives
		// between `onload` and the first write, and the first write is what
		// `stillFreshInstall` gates. See settings/welcomeRouting.ts.
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);

		const boot = await p.boot();
		assert.strictEqual(boot.isFreshInstall, true, "nothing was there yet");

		// The sync client finishes delivering the plugin folder.
		const arrived = vaultWithUserCallouts();
		disk.content = arrived.content;

		assert.strictEqual(
			await stillFreshInstall(p.host),
			false,
			"still believed it was a fresh install",
		);
		assert.ok(p.registry.get("insight"), "the arriving file was not adopted");
		assert.strictEqual(disk.writes, 0, "wrote over the file that arrived");
	});

	it("goes read-only when what turned up cannot be read", async () => {
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);
		await p.boot();

		disk.content = '{"version":4,"callouts":[{"id":"tru';

		assert.strictEqual(await stillFreshInstall(p.host), false);
		p.registry.add(authored("made-after-the-failure"));
		await p.save();
		assert.strictEqual(disk.writes, 0, "replaced a file it could not read");
		assert.strictEqual(
			disk.content,
			'{"version":4,"callouts":[{"id":"tru',
			"the file changed",
		);
	});

	it("stops the welcome flow from creating one over it", async () => {
		// The wiring, not just the check. `welcomeSeen` is the first thing a
		// fresh install writes, so if this seam does not hold, nothing else
		// downstream gets the chance to.
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);
		const boot = await p.boot();

		const arrived = vaultWithUserCallouts();
		disk.content = arrived.content;
		const fileBefore = disk.content;

		// `main.ts` exposes `settings` off the registry, and the routing reads
		// `welcomeSeen` from it. `WelcomeModal` is never constructed on this
		// path — the function returns before it — so the rest of the host only
		// has to satisfy the type.
		const welcomeHost = {
			...p.host,
			get settings() {
				return p.registry.settings;
			},
		};
		await maybeShowWelcomeOnLaunch(
			welcomeHost as unknown as Parameters<
				typeof maybeShowWelcomeOnLaunch
			>[0],
			boot.isFreshInstall,
		);

		assert.strictEqual(disk.writes, 0, "welcome wrote over the real file");
		assert.strictEqual(disk.content, fileBefore, "the file changed");
		assert.ok(p.registry.get("insight"), "the real settings were not adopted");
	});

	it("goes on writing when nothing turned up after all", async () => {
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);
		await p.boot();

		assert.strictEqual(await stillFreshInstall(p.host), true);
		p.registry.add(authored("first-one"));
		await p.save();
		assert.ok(disk.writes > 0, "a real fresh install was blocked");
	});
});

describe("the way out of a frozen session", () => {
	it("writes once the user asks for it explicitly", async () => {
		// A user who deleted `data.json` themselves to start over gets the same
		// freeze as a sync victim, because nothing can tell them apart. The
		// notice carries the escape hatch; this is what its button does.
		storage.clear();
		const disk = vaultWithUserCallouts();
		const first = phone("phone", disk);
		await first.boot();

		disk.content = null;
		const second = phone("phone", disk);
		await second.boot();

		second.registry.add(authored("starting-over"));
		await second.save();
		assert.strictEqual(disk.writes, 0, "wrote while frozen");

		second.writer.thaw();
		await second.save();
		assert.ok(disk.writes > 0, "thaw did not release the writer");
		assert.ok(
			(disk.content ?? "").includes("starting-over"),
			"the user's callout was not saved",
		);
	});
});
