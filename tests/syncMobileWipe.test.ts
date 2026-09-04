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
import { confirmFreshInstall } from "../src/manager/settingsLateArrival";
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

	// The foreground listener the plugin registers, captured so a test can fire
	// it — this stands in for the user coming back to the app.
	let foreground: (() => void) | null = null;
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
		registerDomEvent: (_el, _type, callback) => {
			foreground = callback;
		},
	};

	return {
		registry,
		localState,
		host,
		writer,
		boot: () => loadSettingsInto(host),
		/**
		 * `main.ts`'s `onLayoutReady`, where a launch that found no settings
		 * file settles whether it really is a fresh install. Until it runs that
		 * launch is frozen and writes nothing, so the window between the two is
		 * where issue #53 lives — and a harness that goes straight from `boot()`
		 * to the welcome cannot see it.
		 */
		layoutReady: () => confirmFreshInstall(host),
		save: () => writer.save(),
		/** The user switches back to Obsidian. */
		returnToApp: async () => {
			foreground?.();
			// The listener is sync and starts an async adopt; let it finish.
			await new Promise((r) => setImmediate(r));
			await new Promise((r) => setImmediate(r));
		},
		watching: () => foreground !== null,
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
		assert.strictEqual(await p.layoutReady(), true, "was not let through");

		p.registry.add(authored("first-one"));
		await p.save();
		assert.ok(disk.writes > 0, "a fresh install could not save");
		assert.ok(
			(disk.content ?? "").includes("first-one"),
			"the callout did not reach the file",
		);
	});

	it("writes nothing before the launch has confirmed it is fresh", async () => {
		// The window issue #53 actually lives in, and the one the welcome-time
		// re-check could never see. `void icons.initialize()` runs unordered
		// against `onLayoutReady`, and `IconFetchManager` saves the moment it
		// has artwork — so a background write can create `data.json` from the
		// shipped defaults before anything has looked at the folder a second
		// time. A theme sweep reaching `registry.onChange` does the same.
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);
		await p.boot();

		await p.save();
		assert.strictEqual(disk.writes, 0, "a background save created the file");
		assert.strictEqual(disk.content, null, "the file exists too early");
	});

	it("leaves the next launch of a confirmed fresh install alone", async () => {
		// The other direction of the freeze, and the reason the welcome screen's
		// write is load bearing rather than ceremony. A launch that confirms it
		// is fresh must end up with a `data.json`: the device is marked indexed
		// either way, so a second launch that found no file would take the
		// `absent && hasIndex` branch instead — read-only, with a notice telling
		// the user their settings have gone missing when they never had any.
		storage.clear();
		const disk = new Disk();
		const first = phone("new-phone", disk);
		assert.strictEqual((await first.boot()).isFreshInstall, true);
		assert.strictEqual(await first.layoutReady(), true);

		// What `maybeShowWelcomeOnLaunch` does once the launch is confirmed.
		first.registry.settings.welcomeSeen = true;
		await first.save();
		assert.ok(disk.content !== null, "a confirmed fresh install wrote nothing");

		const second = phone("new-phone", disk);
		assert.strictEqual((await second.boot()).isFreshInstall, false);
		second.registry.add(authored("made-on-the-second-launch"));
		await second.save();
		assert.ok(
			(disk.content ?? "").includes("made-on-the-second-launch"),
			"the second launch came up read-only",
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
		// The shape of #53: a device this vault has only just reached, so there
		// is no device index to say the file ever existed. It arrives between
		// `onload` and `onLayoutReady` — the window the launch spends frozen,
		// waiting to find out which of the two it is.
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);

		const boot = await p.boot();
		assert.strictEqual(boot.isFreshInstall, true, "nothing was there yet");

		// The sync client finishes delivering the plugin folder.
		const arrived = vaultWithUserCallouts();
		disk.content = arrived.content;

		assert.strictEqual(
			await p.layoutReady(),
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

		assert.strictEqual(await p.layoutReady(), false);
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
		// The wiring, not just the check: `main.ts` runs the confirmation and
		// hands its answer to the welcome, which no longer re-reads anything of
		// its own. If that seam does not hold, `welcomeSeen` is written over the
		// file that just arrived and nothing downstream gets a chance to help.
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);
		const boot = await p.boot();

		const arrived = vaultWithUserCallouts();
		disk.content = arrived.content;
		const fileBefore = disk.content;

		const freshInstall = boot.isFreshInstall
			? await p.layoutReady()
			: false;
		assert.strictEqual(freshInstall, false, "greeted an existing vault");

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
			freshInstall,
		);

		assert.strictEqual(disk.writes, 0, "welcome wrote over the real file");
		assert.strictEqual(disk.content, fileBefore, "the file changed");
		assert.ok(p.registry.get("insight"), "the real settings were not adopted");
	});

	it("keeps watching after a file it could not read", async () => {
		// The other half of the freeze. A phone has no config-folder watcher, so
		// if the foreground listener is not registered here, a launch that
		// landed mid-write shows no callouts and can do nothing about it until
		// the user thinks to restart the app.
		storage.clear();
		const disk = new Disk();
		disk.content = '{"version":4,"callouts":[{"id":"tru';
		const p = phone("new-phone", disk);
		await p.boot();
		assert.strictEqual(p.watching(), true, "nothing was left watching");

		disk.content = vaultWithUserCallouts().content;
		await p.returnToApp();
		assert.ok(p.registry.get("insight"), "the repaired file was not adopted");

		// The content, not the write count: an adoption that wrote something of
		// its own would satisfy a bare `writes > 0` while the user's edit was
		// still being thrown away.
		p.registry.add(authored("made-after-recovery"));
		await p.save();
		assert.ok(
			(disk.content ?? "").includes("made-after-recovery"),
			"stayed read-only for the whole session",
		);
	});

	it("goes on watching after seeing a file it wrote itself", async () => {
		// Our own bytes on disk say only that nothing has landed *yet*. Treating
		// that as "settled" retires the one mechanism a phone has, and the file
		// this device is waiting for is usually still in flight.
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);
		await p.boot();
		await p.layoutReady();

		p.registry.add(authored("first-one"));
		await p.save();
		assert.ok(disk.writes > 0, "a real fresh install was blocked");

		// A foreground where the only thing on disk is what we just wrote.
		await p.returnToApp();

		// The vault's real settings finally reach the phone.
		disk.content = vaultWithUserCallouts().content;
		await p.returnToApp();
		assert.ok(
			p.registry.get("insight"),
			"stopped watching after seeing its own file",
		);
	});

	it("goes on writing when nothing turned up after all", async () => {
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);
		await p.boot();

		assert.strictEqual(await p.layoutReady(), true);
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

describe("waiting for settings that arrive during the session", () => {
	it("adopts them on a device that booted with the file missing", async () => {
		// Case A, recovering by itself. The phone froze at startup because its
		// settings file was gone; sync finishes while the user is away, and
		// coming back is enough to put everything right without a restart.
		storage.clear();
		const disk = vaultWithUserCallouts();
		const settingsOnDisk = disk.content;

		const first = phone("phone", disk);
		await first.boot();

		disk.content = null;
		const second = phone("phone", disk);
		await second.boot();
		assert.ok(second.watching(), "nothing was watching for the file");
		assert.ok(!second.registry.get("insight"), "started without the callouts");

		// Sync catches up while Obsidian is in the background.
		disk.content = settingsOnDisk;
		await second.returnToApp();

		assert.ok(second.registry.get("insight"), "the file was not adopted");
		assert.strictEqual(disk.writes, 0, "adopting wrote something back");

		// And the session can save again, because the file is real now.
		second.registry.add(authored("made-after-recovery"));
		await second.save();
		assert.ok(disk.writes > 0, "still frozen after the file came back");
	});

	it("adopts them on a brand-new device rather than overwriting", async () => {
		// Case B, past the welcome window. A device the vault has only just
		// reached, whose data.json turns up minutes later. On mobile nothing
		// else is watching, so without this the phone would keep its
		// built-ins-only registry and publish it at the next save.
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);
		await p.boot();

		const arrived = vaultWithUserCallouts();
		disk.content = arrived.content;
		await p.returnToApp();

		assert.ok(p.registry.get("insight"), "the arriving file was not adopted");
		assert.ok(p.registry.get("warning-plus"));
		assert.strictEqual(disk.writes, 0, "wrote over the file that arrived");

		// A save now carries the real settings forward, not the defaults.
		p.registry.add(authored("added-later"));
		await p.save();
		assert.ok((disk.content ?? "").includes("insight"), "lost the real ones");
	});

	it("says nothing and changes nothing while the file is still missing", async () => {
		// This fires on every single foreground, so it has to be silent and
		// cheap when there is nothing to do.
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);
		await p.boot();

		await p.returnToApp();
		await p.returnToApp();

		assert.strictEqual(disk.writes, 0);
		assert.strictEqual(disk.content, null);
	});

	it("leaves the registry alone while the callout editor is open", async () => {
		storage.clear();
		const disk = new Disk();
		const p = phone("new-phone", disk);
		await p.boot();

		p.host.pruneSuspended = true;
		const arrived = vaultWithUserCallouts();
		disk.content = arrived.content;
		await p.returnToApp();
		assert.ok(!p.registry.get("insight"), "rebuilt under the open editor");

		// Closing it, the next return picks the file up.
		p.host.pruneSuspended = false;
		await p.returnToApp();
		assert.ok(p.registry.get("insight"), "never retried after the editor closed");
	});
});
