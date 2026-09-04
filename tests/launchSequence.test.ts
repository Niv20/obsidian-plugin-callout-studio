/**
 * tests/launchSequence.test.ts — the three steps `onLayoutReady` runs, and the
 * order they have to run in.
 *
 * `manager/launchSequence.ts` is one function rather than three
 * `onLayoutReady` callbacks because its steps are not independent, and two of
 * its rules are the kind that a reasonable refactor undoes without noticing.
 *
 * - **`confirmFreshInstall` is only for the fresh-install freeze.** Two
 *   different launches reach here holding a frozen writer, and from inside that
 *   function they look identical: a brand-new device whose folder really is
 *   empty, and a device that has run in this vault before and whose `data.json`
 *   has since gone missing. Both report "still nothing there". Thawing the
 *   second one writes the shipped built-ins over settings that are merely in
 *   transit, which is issue #53 with the guard removed — so the call is gated on
 *   `boot.isFreshInstall` at the call site, and only there.
 * - **The watchers are registered in a `finally`.** A modal the user dismissed
 *   oddly, or a read that failed, costs that step. It must not cost the rest of
 *   the session's discovery, which has no other place to be wired up.
 *
 * The adoption branch — a file that turned up between `onload` and here — is
 * covered by `syncMobileWipe.test.ts` against a whole device. What is pinned
 * here is the branching, which that file reaches only through the one path.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { runLaunchSequence } from "../src/manager/launchSequence";
import type { SettingsBootResult } from "../src/manager/settingsBoot";
import type CalloutStudioPlugin from "../src/main";
import { installFakeDom } from "./support/fakeDom";

installFakeDom();

/**
 * A launch, with a `data.json` that is not there.
 *
 * The absent file is the whole point: it is the read both frozen launches make,
 * and the one that tells them apart is the flag they were booted with, never
 * anything on disk.
 */
function launch(options: {
	frozen?: boolean;
	firstRunCompleted?: boolean;
	welcomeSeen?: boolean;
	saveRejects?: boolean;
} = {}) {
	const registry = new CalloutRegistry();
	registry.load(null);

	const seen = {
		saves: 0,
		scans: 0,
		prunes: [] as (number | undefined)[],
		watchers: 0,
	};

	const app = {
		vault: {
			configDir: ".obsidian",
			adapter: { exists: () => Promise.resolve(false) },
			getMarkdownFiles: () => [],
		},
	} as unknown as App;

	const settingsWriter = new SettingsWriter({
		build: () => registry.toSaveData(),
		write: () => Promise.resolve(),
	});
	if (options.frozen ?? true) settingsWriter.freeze();

	registry.settings.welcomeSeen = options.welcomeSeen ?? false;

	const plugin = {
		app,
		manifest: {
			id: "callout-studio",
			dir: ".obsidian/plugins/callout-studio",
		} as PluginManifest,
		registry,
		settings: registry.settings,
		settingsWriter,
		// Nothing is on disk, which is what makes both frozen launches read the
		// same way.
		loadData: () => Promise.resolve(null),
		saveSettings: (): Promise<void> => {
			seen.saves += 1;
			return options.saveRejects
				? Promise.reject(new Error("the disk said no"))
				: Promise.resolve();
		},
		localState: {
			firstRunCompleted: options.firstRunCompleted ?? true,
			completeFirstRun: (): void => {},
		},
		runVaultScan: (): Promise<number> => {
			seen.scans += 1;
			return Promise.resolve(0);
		},
		discovery: {
			schedulePrune: (delayMs?: number): void => {
				seen.prunes.push(delayMs);
			},
			registerIncrementalWatchers: (): void => {
				seen.watchers += 1;
			},
		},
	} as unknown as CalloutStudioPlugin;

	const run = (isFreshInstall: boolean) =>
		runLaunchSequence(plugin, { isFreshInstall } as SettingsBootResult);

	return { plugin, settingsWriter, seen, run };
}

describe("the fresh-install freeze is settled at onLayoutReady", () => {
	it("thaws a launch whose folder really is still empty", async () => {
		// `welcomeSeen` is already up so the splash itself stays out of this
		// file — what it would then do with the thawed writer is
		// `syncMobileWipe.test.ts`'s subject. The thaw happens in
		// `confirmFreshInstall`, before the greeting either way.
		const l = launch({ welcomeSeen: true });

		await l.run(true);

		assert.strictEqual(
			l.settingsWriter.isFrozen,
			false,
			"a genuine fresh install has to be able to save its first callout",
		);
	});

	it("leaves a device whose settings merely went missing frozen", async () => {
		// The same absent read, the same "still nothing there" — and the
		// opposite treatment, because boot did not call this one fresh.
		const l = launch();

		await l.run(false);

		assert.strictEqual(
			l.settingsWriter.isFrozen,
			true,
			"thawing here writes the built-ins over settings still in transit",
		);
	});

	it("greets nobody on a launch that was not a fresh install", async () => {
		const l = launch({ welcomeSeen: false });

		await l.run(false);

		assert.strictEqual(
			l.seen.saves,
			0,
			"the welcome flag is the first write a fresh install makes",
		);
		assert.strictEqual(l.plugin.settings.welcomeSeen, false);
	});
});

describe("what the launch does once the freeze is settled", () => {
	it("prunes rather than scans on a device that has run here before", async () => {
		const l = launch({ firstRunCompleted: true });

		await l.run(false);

		assert.strictEqual(l.seen.scans, 0);
		assert.deepStrictEqual(
			l.seen.prunes,
			[2000],
			"a launch still owes a prune for rows an earlier session orphaned",
		);
	});

	it("scans rather than prunes on a device with no index of its own", async () => {
		const l = launch({ firstRunCompleted: false, welcomeSeen: true });

		await l.run(false);

		assert.strictEqual(l.seen.scans, 1);
		assert.deepStrictEqual(l.seen.prunes, []);
	});

	it("registers the incremental watchers on the ordinary path", async () => {
		const l = launch();

		await l.run(false);

		assert.strictEqual(l.seen.watchers, 1);
	});

	it("registers them anyway when a step throws", async () => {
		// The welcome screen's own write is the easiest step to break, and a
		// modal dismissed oddly is the real-world version of it.
		const l = launch({ welcomeSeen: false, saveRejects: true });

		await assert.rejects(() => l.run(true));

		assert.strictEqual(
			l.seen.watchers,
			1,
			"a failed step must not cost the session its discovery",
		);
	});
});
