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
 * - **The welcome writes nothing.** Missing settings may still be in transit,
 *   so a greeting is no reason to publish defaults or mark a device initialized.
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
import { WelcomeModal } from "../src/settings/WelcomeModal";

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
		initialized: 0,
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
			markInitialized: (): void => { seen.initialized++; },
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
	it("does not create data.json or mark it as previously saved when a fresh welcome closes", async () => {
		const prompt = Object.getOwnPropertyDescriptor(WelcomeModal.prototype, "prompt")!;
		WelcomeModal.prototype.prompt = () => Promise.resolve();
		try {
			const l = launch({ welcomeSeen: false });
			await l.run(true);
			assert.strictEqual(l.plugin.settings.welcomeSeen, true);
			assert.strictEqual(l.seen.saves, 0);
			assert.strictEqual(l.seen.initialized, 0);
		} finally { Object.defineProperty(WelcomeModal.prototype, "prompt", prompt); }
	});
	it("does not show a queued welcome after the plugin unloads", async () => {
		const l = launch({ welcomeSeen: false });
		l.settingsWriter.destroy();
		await l.run(true);
		assert.strictEqual(l.plugin.settings.welcomeSeen, false);
		assert.strictEqual(l.seen.saves, 0);
	});
});

describe("launch never discovers callouts", () => {
	it("does not scan, prune, or subscribe, even on a fresh device", async () => {
		for (const firstRunCompleted of [false, true]) {
			const h = launch({ firstRunCompleted, welcomeSeen: true });
			await h.run(true);
			assert.strictEqual(h.seen.scans, 0);
			assert.deepStrictEqual(h.seen.prunes, []);
			assert.strictEqual(h.seen.watchers, 0);
		}
	});
});
