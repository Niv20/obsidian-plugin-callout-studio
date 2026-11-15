/**
 * tests/settingsBootRest.test.ts — which launches may take their first read of
 * `data.json` as it stands, and what such a launch still owes.
 *
 * Every launch used to read the file, wait 150 ms inside `onload`, and read it
 * again (`readSettledSettingsFile`), with Obsidian waiting behind it. The
 * window is there so a sync snapshot is seen twice before it is adopted, and
 * it has to stay for every launch that has one to adopt. Two do not:
 *
 * - the file is what this device last accepted, which its recovery copy knows
 *   without a second read;
 * - there is no file and no sign there ever was one, which leaves the launch
 *   provisionally fresh and frozen until `confirmFreshInstall` has read again.
 *
 * So this file pins three things: that those two launches do not wait, that
 * every other launch waits exactly as it did (issues #41 and #53 came from
 * launches that did not), and that what a rested launch skipped is still
 * paid once the layout is ready: the second read of a file, through the
 * ordinary external-change path, and the pause before a fresh install is
 * confirmed.
 *
 * And a fourth, which is not about the window. Obsidian starts watching the
 * configuration folder only after every community plugin has loaded, so a file
 * replaced after launch's last read and before then is reported to no one. A
 * launch that settled has that gap as much as one that rested, and takes the
 * same look at layout-ready, unless it ended paused.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { confirmLaunchRead } from "../src/manager/settingsLateArrival";
import { SYNC_KEY } from "../src/manager/syncTree";
import { definition } from "./support/discoveryHarness";
import {
	PLUGIN_DIR,
	fileFromAnotherDevice,
	forgetDevice,
	launchDevice,
	newWorld,
	resetCounters,
	usedWorld,
	type World,
} from "./support/launchWorld";

const CONFLICT_COPY = `${PLUGIN_DIR}/data.sync-conflict-20261115-101010-ABCDEFG.json`;

/** The same settings with the top-level keys in the opposite order. */
function reordered(text: string): string {
	return JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(text) as Record<string, unknown>).reverse()));
}

function quiet(context: { mock: { method(object: object, name: string, body: () => void): unknown } }): void {
	for (const level of ["error", "warn", "debug"]) context.mock.method(console, level, () => {});
}

describe("a launch that finds the file at rest does not wait for it", () => {
	it("takes the file this device last wrote on a single read", async () => {
		const world = await usedWorld();
		const device = launchDevice(world);

		const boot = await device.boot();

		assert.deepEqual(boot, { isFreshInstall: false, confirmLater: true });
		assert.equal(world.waits, 0, "an ordinary launch spent a settling pause inside onload");
		assert.equal(world.reads, 1);
		assert.equal(world.writes, 0);
		assert.ok(device.registry.get("mine"));
		assert.equal(device.host.settingsWriter.isFrozen, false);
		device.close();
	});

	it("knows the file whatever order its keys come back in", async () => {
		const world = await usedWorld();
		world.disk = reordered(world.disk!);
		const device = launchDevice(world);

		const boot = await device.boot();

		assert.equal(world.waits, 0);
		assert.equal(boot.confirmLater, true);
		assert.ok(device.registry.get("mine"));
		device.close();
	});

	it("still flushes a load-time migration, through the freshness guard", async () => {
		// An old build's file: unstamped, and autocomplete switched off, which
		// this build normalizes and writes back. The recovery copy is that file.
		const world = await usedWorld();
		const legacy = JSON.parse(world.disk!) as Record<string, unknown> & { settings: Record<string, unknown> };
		delete legacy[SYNC_KEY];
		legacy.settings.autocomplete = { enabled: false };
		world.disk = JSON.stringify(legacy);
		world.checkpoint = structuredClone(legacy);
		const device = launchDevice(world);

		await device.boot();

		assert.equal(world.waits, 0);
		assert.equal(world.writes, 1, "the migration was not written");
		const saved = JSON.parse(world.disk) as { settings: { autocomplete: { enabled: boolean } } };
		assert.equal(saved.settings.autocomplete.enabled, true);
		assert.ok(world.disk.includes(SYNC_KEY), "the rewrite is stamped");
		device.close();
	});

	it("still joins a conflict copy left beside the file", async () => {
		const world = await usedWorld();
		world.files.set(
			CONFLICT_COPY,
			await fileFromAnotherDevice(world, (registry) => registry.add(definition({ id: "theirs" }))),
		);
		const device = launchDevice(world);

		await device.boot();

		assert.equal(world.waits, 0);
		assert.ok(device.registry.get("theirs"), "the conflict copy's row was left behind");
		assert.ok(device.registry.get("mine"));
		device.close();
	});

	it("takes the file as known with the device marker gone, on the recovery copy alone", async () => {
		const world = await usedWorld();
		forgetDevice(world);
		const device = launchDevice(world);

		const boot = await device.boot();

		assert.equal(world.waits, 0);
		assert.equal(boot.confirmLater, true);
		assert.ok(device.registry.get("mine"));
		device.close();
	});

	it("takes no file on a device that never had one, and leaves it frozen for layout-ready", async () => {
		const world = newWorld();
		const device = launchDevice(world);

		const boot = await device.boot();

		assert.deepEqual(boot, { isFreshInstall: true, confirmLater: true });
		assert.equal(world.waits, 0, "a first launch spent a settling pause inside onload");
		assert.equal(world.reads, 1);
		assert.equal(device.host.settingsWriter.isFrozen, true, "nothing may be written before the second look");
		assert.equal(device.host.settingsWriter.isVisiblyPaused, false);

		assert.equal(await device.layoutReady(boot), true);
		assert.equal(world.waits, 2, "the skipped pause, then the confirmation's own");
		assert.equal(device.host.settingsWriter.isFrozen, false);
		assert.equal(world.writes, 0);
		assert.equal(world.disk, null);
		device.close();
	});

	it("looks for an arriving file exactly as late as a launch that waited in onload", async (context) => {
		// The file lands 160 ms into the launch. A launch that settled in
		// `onload` confirmed over 150-300 ms and saw it; the skipped pause is
		// spent at layout-ready so this one confirms over the same stretch.
		quiet(context);
		const source = await usedWorld();
		const world = newWorld();
		world.script = [{ at: 160, disk: source.disk }];
		const device = launchDevice(world);
		const boot = await device.boot();
		assert.equal(world.waits, 0);

		assert.equal(await device.layoutReady(boot), false, "confirmed a fresh install before the file landed");
		assert.ok(device.registry.get("mine"));
		device.close();
	});

	it("takes no file again on an install that was greeted and never changed", async () => {
		const world = newWorld();
		const first = launchDevice(world);
		await first.layoutReady(await first.boot());
		first.host.localState.markWelcomeSeen();
		first.close();
		resetCounters(world);
		const device = launchDevice(world);

		const boot = await device.boot();

		assert.deepEqual(boot, { isFreshInstall: true, confirmLater: true });
		assert.equal(world.waits, 0);
		device.close();
	});

	it("adopts a file that arrives before layout-ready instead of greeting", async (context) => {
		// The shape of #53, with the pause that used to sit in `onload` now
		// spent at layout-ready, ahead of the confirmation.
		quiet(context);
		const source = await usedWorld();
		const world = newWorld();
		const device = launchDevice(world);
		const boot = await device.boot();
		assert.equal(boot.isFreshInstall, true);

		world.disk = source.disk;

		assert.equal(await device.layoutReady(boot), false, "greeted an existing vault");
		assert.ok(device.registry.get("mine"), "the arriving file was not adopted");
		assert.ok(world.disk?.includes('"mine"'), "wrote the defaults over the file that arrived");
		device.close();
	});
});

interface Settled {
	name: string;
	arrange: (world: World) => Promise<void> | void;
	/** How many settling pauses the launch makes: as many as before the shortcut existed. */
	waits: number;
	/** Ends with a file loaded and saving not paused, so it owes the look at layout-ready. */
	owesLook?: true;
	check: (world: World, device: ReturnType<typeof launchDevice>) => void;
}

const frozenAs = (reason: string) => (world: World, device: ReturnType<typeof launchDevice>) => {
	assert.equal(device.host.settingsWriter.status.frozenReason, reason);
	assert.equal(world.writes, 0, "a paused launch wrote");
	// Nothing was written, so every read is launch's own: one, and one per pause.
	assert.equal(world.reads, world.waits + 1, "the settling window read the file more often than it used to");
};

const settled: Settled[] = [
	{
		name: "a file another device changed while this one was closed",
		arrange: async (world) => {
			world.disk = await fileFromAnotherDevice(world, (registry) => registry.add(definition({ id: "theirs" })));
		},
		waits: 1,
		owesLook: true,
		check: (_world, device) => {
			assert.ok(device.registry.get("theirs"));
			assert.ok(device.registry.get("mine"));
			assert.equal(device.host.settingsWriter.isFrozen, false);
		},
	},
	{
		name: "a file this device holds no recovery copy of",
		arrange: (world) => {
			world.checkpoint = undefined;
		},
		waits: 1,
		owesLook: true,
		check: (_world, device) => assert.ok(device.registry.get("mine")),
	},
	{
		name: "a synced file on a device that has never run the plugin",
		arrange: (world) => {
			world.checkpoint = undefined;
			forgetDevice(world);
		},
		waits: 1,
		owesLook: true,
		check: (_world, device) => assert.ok(device.registry.get("mine")),
	},
	{
		name: "a recovery copy that is ahead of the file",
		arrange: async (world) => {
			// The copy was written, and the file write behind it never landed.
			const before = world.disk;
			const session = launchDevice(world);
			await session.boot();
			session.registry.add(definition({ id: "unsaved-here" }));
			await session.host.saveSettings();
			session.close();
			world.disk = before;
		},
		waits: 1,
		owesLook: true,
		check: (_world, device) => assert.ok(device.registry.get("unsaved-here"), "the unsaved change was dropped"),
	},
	{
		name: "recovery storage that does not answer",
		arrange: (world) => {
			world.checkpointFails = true;
		},
		waits: 1,
		check: frozenAs("recovery-read"),
	},
	{
		name: "a recovery copy that is not valid settings",
		arrange: (world) => {
			world.checkpoint = { callouts: "nonsense" };
		},
		waits: 1,
		check: frozenAs("recovery-read"),
	},
	{
		name: "a file from a later build that this build cannot read, even one the recovery copy matches",
		arrange: (world) => {
			// Its checksum covers the old version number, so the shape gate rejects it.
			const later = { ...(JSON.parse(world.disk!) as Record<string, unknown>), version: 99 };
			world.disk = JSON.stringify(later);
			world.checkpoint = structuredClone(later);
		},
		waits: 1,
		check: frozenAs("newer-version"),
	},
	{
		name: "a file from a later build that this build can read, even one the recovery copy matches",
		arrange: (world) => {
			const later: Record<string, unknown> = {
				...(JSON.parse(world.disk!) as Record<string, unknown>),
				version: 99,
			};
			delete later[SYNC_KEY];
			world.disk = JSON.stringify(later);
			world.checkpoint = structuredClone(later);
		},
		waits: 1,
		check: frozenAs("newer-version"),
	},
	{
		name: "a missing file on a device that has run before",
		arrange: (world) => {
			world.disk = null;
		},
		waits: 1,
		check: (world, device) => {
			frozenAs("missing")(world, device);
			assert.equal(device.host.settingsWriter.isVisiblyPaused, true);
			assert.equal(world.disk, null, "created a file from nothing");
		},
	},
	{
		name: "a missing file with only the recovery copy to say there was one",
		arrange: (world) => {
			world.disk = null;
			forgetDevice(world);
		},
		waits: 1,
		check: (world, device) => {
			frozenAs("missing")(world, device);
			assert.ok(device.registry.get("mine"), "the recovery copy is what a missing file shows");
		},
	},
	{
		name: "a missing file with only the device marker to say there was one",
		arrange: (world) => {
			world.disk = null;
			world.checkpoint = undefined;
		},
		waits: 1,
		check: frozenAs("missing"),
	},
	{
		name: "a truncated file",
		arrange: (world) => {
			world.disk = world.disk!.slice(0, 40);
		},
		waits: 3,
		check: frozenAs("unreadable"),
	},
	{
		name: "a stamped file edited by hand, whose checksum no longer agrees",
		arrange: (world) => {
			const edited = JSON.parse(world.disk!) as { settings: Record<string, unknown> };
			edited.settings.fallbackCalloutId = "warning";
			world.disk = JSON.stringify(edited);
		},
		waits: 3,
		check: frozenAs("unreadable"),
	},
];

describe("every other launch settles as it always did", () => {
	for (const launch of settled) {
		it(launch.name, async (context) => {
			quiet(context);
			const world = await usedWorld();
			await launch.arrange(world);
			resetCounters(world);
			const device = launchDevice(world);

			const boot = await device.boot();

			assert.equal(world.waits, launch.waits, "the settling window is not what it was");
			// Settling is what it was. What a launch owes afterwards is decided by
			// how it ended: a file loaded and saving not paused owes the look.
			assert.deepEqual(
				boot,
				launch.owesLook ? { isFreshInstall: false, confirmLater: true } : { isFreshInstall: false },
				launch.owesLook ? "a file was loaded and nothing looks at it again" : "a paused launch owes no look",
			);
			assert.equal(device.host.settingsWriter.isFrozen, !launch.owesLook);
			launch.check(world, device);
			device.close();
		});
	}

	it("a file still arriving: an empty object first, the whole file after", async (context) => {
		// What `settingsRecoverySafety.test.ts` pins against a device with no
		// recovery copy, here against one whose copy is a different file.
		quiet(context);
		const world = await usedWorld();
		const theirs = await fileFromAnotherDevice(world, (registry) => registry.add(definition({ id: "theirs" })));
		world.disk = "{}";
		world.script = [{ at: 100, disk: theirs }];
		const device = launchDevice(world);

		await device.boot();

		assert.ok(world.waits >= 2, "the first object was taken without a second look");
		assert.ok(device.registry.get("theirs"));
		assert.ok(device.registry.get("mine"));
		device.close();
	});

	it("a launch that ends paused owes no second read", async (context) => {
		// At rest, but the conflict copy beside it cannot be kept before the
		// merge: the launch pauses, and a paused session is rechecked by its
		// own means (`pausedRecheck.ts`).
		quiet(context);
		const world = await usedWorld();
		world.files.set(CONFLICT_COPY, await fileFromAnotherDevice(world, (registry) => registry.remove("mine")));
		world.backupFails = true;
		const device = launchDevice(world);

		const boot = await device.boot();

		assert.equal(world.waits, 0);
		assert.equal(device.host.settingsWriter.isFrozen, true);
		assert.deepEqual(boot, { isFreshInstall: false });
		device.close();
	});
});

describe("the read a rested launch did not wait for", () => {
	/** A rested launch, booted, with the counters back at zero. */
	async function rested(world: World) {
		const device = launchDevice(world);
		const boot = await device.boot();
		assert.equal(boot.confirmLater, true);
		resetCounters(world);
		return device;
	}

	it("costs one read, a settling pause after layout-ready, and rebuilds nothing", async () => {
		const world = await usedWorld();
		const device = await rested(world);

		await confirmLaunchRead(device.host);

		assert.equal(world.waits, 1, "it must not come sooner than the read it stands in for");
		assert.equal(world.reads, 1);
		assert.equal(world.rebuilds, 0, "an unchanged file rebuilt the registry");
		assert.equal(world.writes, 0);
		device.close();
	});

	it("adopts what another device wrote inside the old window", async (context) => {
		// The file is replaced 100 ms into the launch: after launch's read, and
		// before the read that used to follow it 150 ms later.
		quiet(context);
		const world = await usedWorld();
		const theirs = await fileFromAnotherDevice(world, (registry) => registry.add(definition({ id: "theirs" })));
		world.script = [{ at: 100, disk: theirs }];
		const device = launchDevice(world);
		const boot = await device.boot();
		assert.equal(device.registry.get("theirs"), undefined, "launch read the file before it was replaced");

		await device.layoutReady(boot);

		assert.ok(device.registry.get("theirs"), "the replaced file was never adopted");
		assert.ok(device.registry.get("mine"));
		assert.equal(device.host.settingsWriter.isFrozen, false);
		device.close();
	});

	it("rides out a file caught mid-write, without pausing the session", async (context) => {
		quiet(context);
		const world = await usedWorld();
		const theirs = await fileFromAnotherDevice(world, (registry) => registry.add(definition({ id: "theirs" })));
		world.script = [
			{ at: 100, disk: theirs.slice(0, 50) },
			{ at: 400, disk: theirs },
		];
		const device = launchDevice(world);

		await device.layoutReady(await device.boot());

		assert.ok(device.registry.get("theirs"));
		assert.equal(device.host.settingsWriter.isFrozen, false);
		assert.equal(device.host.settingsWriter.status.failure ?? null, null);
		device.close();
	});

	it("protects the session when the file has gone", async (context) => {
		quiet(context);
		const world = await usedWorld();
		const device = await rested(world);
		world.disk = null;

		await confirmLaunchRead(device.host);
		await device.settle();

		assert.equal(device.host.settingsWriter.status.frozenReason, "missing");
		assert.ok(device.registry.get("mine"), "the displayed setup was thrown away");
		device.registry.add(definition({ id: "made-while-missing" }));
		await device.host.saveSettings();
		assert.equal(world.writes, 0, "recreated a file it never saw removed");
		assert.equal(world.disk, null);
		device.close();
	});

	it("pauses on a file left unreadable, as a launch that read it that way would", async (context) => {
		quiet(context);
		const world = await usedWorld();
		const device = await rested(world);
		const whole = world.disk!;
		world.disk = whole.slice(0, 50);

		await confirmLaunchRead(device.host);
		await device.settle();

		assert.equal(device.host.settingsWriter.status.frozenReason, "unreadable");
		assert.equal(world.writes, 0);
		assert.equal(world.disk, whole.slice(0, 50), "the unreadable file was replaced");
		device.close();
	});

	it("leaves this session's own write alone", async () => {
		const world = await usedWorld();
		const device = await rested(world);
		device.registry.add(definition({ id: "added-at-once" }));
		await device.host.saveSettings();
		assert.equal(world.writes, 1);
		resetCounters(world);

		await confirmLaunchRead(device.host);

		assert.equal(world.reads, 1);
		assert.equal(world.rebuilds, 0, "the session's own file was adopted as someone else's");
		assert.equal(world.writes, 0);
		assert.ok(device.registry.get("added-at-once"));
		device.close();
	});

	it("waits its turn behind an open editor", async (context) => {
		quiet(context);
		const world = await usedWorld();
		const device = await rested(world);
		world.disk = await fileFromAnotherDevice(world, (registry) => registry.add(definition({ id: "theirs" })));
		device.host.settingsEditOpen = true;

		await confirmLaunchRead(device.host);
		assert.equal(device.registry.get("theirs"), undefined, "rebuilt the registry under an open editor");

		device.host.settingsEditOpen = false;
		device.queue.release();
		await device.settle();
		assert.ok(device.registry.get("theirs"), "the deferred adoption never ran");
		device.close();
	});

	it("does nothing once the plugin has unloaded", async () => {
		const world = await usedWorld();
		const device = await rested(world);
		device.close();

		await confirmLaunchRead(device.host);

		assert.equal(world.waits, 0);
		assert.equal(world.reads, 0);
	});

	it("stops at the pause if the plugin unloads during it", async () => {
		const world = await usedWorld();
		const device = await rested(world);
		const pause = device.host.waitForSettingsSettle!;
		device.host.waitForSettingsSettle = async () => {
			await pause();
			device.close();
		};

		await confirmLaunchRead(device.host);

		assert.equal(world.reads, 0);
	});
});

describe("the look a settled launch takes once the layout is ready", () => {
	// Obsidian loads every community plugin and only then starts watching the
	// configuration folder. These launches read the file twice inside onload,
	// and then nothing would tell them about a file replaced while the other
	// plugins were still loading.

	/** A launch that settled on a file another device wrote, booted, counters at zero. */
	async function settledOn(world: World) {
		world.disk = await fileFromAnotherDevice(world, (registry) => registry.add(definition({ id: "theirs" })));
		const device = launchDevice(world);
		const boot = await device.boot();
		assert.equal(world.waits, 1, "this launch was meant to settle");
		assert.deepEqual(boot, { isFreshInstall: false, confirmLater: true });
		resetCounters(world);
		return { device, boot };
	}

	it("costs one read and one pause, and changes nothing when the file is what launch took", async (context) => {
		quiet(context);
		const world = await usedWorld();
		const { device, boot } = await settledOn(world);
		const disk = world.disk;
		const copy = JSON.stringify(world.checkpoint);

		await device.layoutReady(boot);

		assert.equal(world.reads, 1);
		assert.equal(world.waits, 1);
		assert.equal(world.writes, 0);
		assert.equal(world.rebuilds, 0, "an unchanged file rebuilt the registry");
		assert.equal(world.disk, disk);
		assert.equal(JSON.stringify(world.checkpoint), copy);
		assert.equal(world.files.size, 0, "an unchanged file left a backup");
		assert.equal(device.host.settingsWriter.isFrozen, false);
		assert.equal(device.host.settingsWriter.status.failure ?? null, null);
		device.close();
	});

	it("adopts a file replaced after launch's last read, which nothing else reports", async (context) => {
		quiet(context);
		const world = await usedWorld();
		const { device, boot } = await settledOn(world);
		// While the other plugins load: after both of launch's reads, before any watcher.
		world.disk = await fileFromAnotherDevice(world, (registry) => registry.add(definition({ id: "later" })));

		await device.layoutReady(boot);

		assert.ok(device.registry.get("later"), "the file replaced during startup was never adopted");
		assert.ok(device.registry.get("theirs") && device.registry.get("mine"), "adopting it dropped earlier rows");
		assert.equal(device.host.settingsWriter.isFrozen, false);
		assert.equal(device.host.settingsWriter.status.failure ?? null, null);
		device.close();
	});

	it("finds its own write after a load-time migration, and stops there", async (context) => {
		// An old build's file from another device: unstamped, autocomplete off.
		// Launch settles, normalizes it and writes it back; the look then reads
		// that write and has nothing to do.
		quiet(context);
		const world = await usedWorld();
		const legacy = JSON.parse(world.disk!) as Record<string, unknown> & { settings: Record<string, unknown> };
		delete legacy[SYNC_KEY];
		legacy.settings.autocomplete = { enabled: false };
		world.disk = JSON.stringify(legacy);
		world.checkpoint = undefined;
		const device = launchDevice(world);
		const boot = await device.boot();
		assert.equal(world.waits, 1);
		assert.equal(world.writes, 1, "the migration was not written");
		assert.equal(boot.confirmLater, true);
		resetCounters(world);

		await device.layoutReady(boot);

		assert.equal(world.reads, 1);
		assert.equal(world.writes, 0, "the look wrote the file again");
		assert.equal(world.rebuilds, 0);
		assert.equal(device.host.settingsWriter.isFrozen, false);
		device.close();
	});

	it("is not taken by a launch that settled and ended paused", async (context) => {
		quiet(context);
		const world = await usedWorld();
		world.checkpointFails = true;
		const device = launchDevice(world);
		const boot = await device.boot();
		assert.equal(device.host.settingsWriter.isFrozen, true);
		assert.deepEqual(boot, { isFreshInstall: false });
		resetCounters(world);

		await device.layoutReady(boot);

		assert.equal(world.reads, 0, "a paused launch looked at the file again at layout-ready");
		assert.equal(world.waits, 0);
		device.close();
	});
});
