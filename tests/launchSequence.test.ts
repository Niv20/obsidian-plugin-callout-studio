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
 * - **The welcome writes no synced settings.** Missing settings may still be in
 *   transit, so a greeting is no reason to publish defaults or mark a device
 *   initialized. Its once-only marker is device-local instead.
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
import { markCompetitorImportBannerHandled, shouldShowCompetitorImportBanner } from "../src/settings/competitorImportState";

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
	localWelcomeSeen?: boolean;
	tutorialWelcomeSeen?: boolean;
	localTutorialWelcomeSeen?: boolean;
	tutorialMarkFails?: boolean;
	competitorImportBannerHandled?: boolean;
	/** Dismissed on this device while it had no settings file to record it in. */
	localBannerHandled?: boolean;
	sidebarRejects?: boolean;
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
		welcomeMarks: 0,
		tutorialWelcomeMarks: 0,
		sidebarOffers: 0,
		sidebarMarks: 0,
		conversionCleanups: 0,
	};
	let localWelcomeSeen = options.localWelcomeSeen ?? false;
	let localTutorialWelcomeSeen = options.localTutorialWelcomeSeen ?? false;
	let localBannerHandled = options.localBannerHandled ?? false;
	let tabOffered = false;

	const app = {
		vault: {
			configDir: ".obsidian",
			adapter: { exists: () => Promise.resolve(false) },
			getMarkdownFiles: () => [],
		},
		workspace: {
			detachLeavesOfType: () => { seen.conversionCleanups++; },
			getLeavesOfType: () => [],
			ensureSideLeaf: () => {
				assert.strictEqual(settingsWriter.isFrozen, false, "confirm first installation before offering a tab");
				assert.strictEqual(tabOffered, true);
				seen.sidebarOffers++;
				return options.sidebarRejects ? Promise.reject(new Error("No sidebar")) : Promise.resolve({});
			},
		},
	} as unknown as App;

	const settingsWriter = new SettingsWriter({
		build: () => registry.toSaveData(),
		write: () => Promise.resolve(),
	});
	if (options.frozen ?? true) settingsWriter.freeze();

	registry.settings.welcomeSeen = options.welcomeSeen ?? false;
	// Unrelated launch checks do not need a modal; routing cases opt in below.
	registry.settings.tutorialWelcomeSeen = options.tutorialWelcomeSeen ?? true;
	registry.settings.competitorImportBannerHandled =
		options.competitorImportBannerHandled ?? false;

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
		waitForSettingsSettle: () => Promise.resolve(),
		saveSettings: (): Promise<void> => {
			seen.saves += 1;
			return options.saveRejects
				? Promise.reject(new Error("the disk said no"))
				: Promise.resolve();
		},
		localState: {
			get hasOfferedOccurrencesTab(): boolean { return tabOffered; },
			markOccurrencesTabOffered: (): boolean => { tabOffered = true; seen.sidebarMarks++; return true; },
			firstRunCompleted: options.firstRunCompleted ?? true,
			markInitialized: (): void => { seen.initialized++; },
			get hasSeenWelcome(): boolean { return localWelcomeSeen; },
			markWelcomeSeen: (): void => {
				localWelcomeSeen = true;
				seen.welcomeMarks++;
			},
			get hasSeenTutorialWelcome(): boolean { return localTutorialWelcomeSeen; },
			markTutorialWelcomeSeen: (): boolean => {
				seen.tutorialWelcomeMarks++;
				if (options.tutorialMarkFails) return false;
				localTutorialWelcomeSeen = true;
				return true;
			},
			get hasHandledImportBanner(): boolean { return localBannerHandled; },
			markImportBannerHandled: (): void => { localBannerHandled = true; },
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
		// The tutorial marker is already up so the welcome modal stays out of this
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

	it("does not offer tutorials while a previously used device's settings remain missing", async () => {
		const l = launch({ welcomeSeen: false, tutorialWelcomeSeen: false });

		await l.run(false);

		assert.strictEqual(
			l.seen.saves,
			0,
			"a tutorial offer must not write settings",
		);
		assert.strictEqual(l.plugin.settings.welcomeSeen, false);
		assert.strictEqual(l.plugin.settings.tutorialWelcomeSeen, false);
		assert.strictEqual(l.seen.tutorialWelcomeMarks, 0);
		assert.strictEqual(shouldShowCompetitorImportBanner(l.plugin), false);
		assert.strictEqual(l.seen.sidebarOffers, 0);
		assert.strictEqual(l.seen.conversionCleanups, 1);
	});
	it("records the welcome locally without creating data.json or marking a prior save", async () => {
		const prompt = Object.getOwnPropertyDescriptor(WelcomeModal.prototype, "prompt")!;
		WelcomeModal.prototype.prompt = () => Promise.resolve();
		try {
			const l = launch({ welcomeSeen: false, tutorialWelcomeSeen: false });
			await l.run(true);
			assert.strictEqual(l.plugin.settings.welcomeSeen, true);
			assert.strictEqual(l.plugin.settings.tutorialWelcomeSeen, true);
			assert.strictEqual(shouldShowCompetitorImportBanner(l.plugin), true);
			assert.strictEqual(l.seen.saves, 0);
			assert.strictEqual(l.seen.initialized, 0);
			assert.strictEqual(l.seen.welcomeMarks, 1);
			assert.strictEqual(l.seen.tutorialWelcomeMarks, 1);
			assert.strictEqual(l.seen.sidebarOffers, 1);
			assert.strictEqual(l.seen.sidebarMarks, 1);
		} finally { Object.defineProperty(WelcomeModal.prototype, "prompt", prompt); }
	});
	it("re-arms an unhandled import banner after reload without reopening the welcome", async () => {
		const prompt = Object.getOwnPropertyDescriptor(WelcomeModal.prototype, "prompt")!;
		let prompts = 0;
		WelcomeModal.prototype.prompt = () => { prompts++; return Promise.resolve(); };
		try {
			const l = launch({ localWelcomeSeen: true, welcomeSeen: false });
			await l.run(true);
			assert.strictEqual(prompts, 0);
			assert.strictEqual(l.seen.welcomeMarks, 0);
			assert.strictEqual(l.seen.sidebarOffers, 0);
			assert.strictEqual(shouldShowCompetitorImportBanner(l.plugin), true);
		} finally { Object.defineProperty(WelcomeModal.prototype, "prompt", prompt); }
	});
	it("does not re-arm the import banner after dismissal or a successful import", async () => {
		const l = launch({
			localWelcomeSeen: true,
			competitorImportBannerHandled: true,
		});
		await l.run(true);
		assert.strictEqual(shouldShowCompetitorImportBanner(l.plugin), false);
	});
	it("does not re-arm an import banner this device dismissed before it had a settings file", async () => {
		const l = launch({ localWelcomeSeen: true, localBannerHandled: true });
		await l.run(true);
		assert.strictEqual(shouldShowCompetitorImportBanner(l.plugin), false);
	});
	it("remembers a dismissal on the device as well as in the synced setting", async () => {
		const l = launch({ localWelcomeSeen: true });
		await l.run(true);
		assert.strictEqual(shouldShowCompetitorImportBanner(l.plugin), true);
		await markCompetitorImportBannerHandled(l.plugin);
		assert.strictEqual(l.plugin.localState.hasHandledImportBanner, true);
		assert.strictEqual(l.plugin.settings.competitorImportBannerHandled, true);
		assert.strictEqual(shouldShowCompetitorImportBanner(l.plugin), false);
	});
	it("does not show a queued welcome after the plugin unloads", async () => {
		const l = launch({ welcomeSeen: false });
		l.settingsWriter.destroy();
		await l.run(true);
		assert.strictEqual(l.plugin.settings.welcomeSeen, false);
		assert.strictEqual(l.seen.saves, 0);
		assert.strictEqual(l.seen.sidebarOffers, 0);
		assert.strictEqual(l.seen.conversionCleanups, 0);
	});
	it("continues welcome onboarding when the automatic sidebar offer fails", async () => {
		const prompt = Object.getOwnPropertyDescriptor(WelcomeModal.prototype, "prompt")!;
		const warn = console.warn;
		WelcomeModal.prototype.prompt = () => Promise.resolve();
		console.warn = () => undefined;
		try {
			const l = launch({ sidebarRejects: true, tutorialWelcomeSeen: false });
			await l.run(true);
			assert.strictEqual(l.seen.sidebarOffers, 1);
			assert.strictEqual(l.seen.welcomeMarks, 1);
			assert.strictEqual(l.seen.saves, 0);
		} finally {
			Object.defineProperty(WelcomeModal.prototype, "prompt", prompt);
			console.warn = warn;
		}
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

describe("the tutorial welcome is offered only once", () => {
	for (const welcomeSeen of [false, true]) {
		it(`offers an upgrade once even when legacy welcomeSeen is ${welcomeSeen}`, async () => {
			const prompt = Object.getOwnPropertyDescriptor(WelcomeModal.prototype, "prompt")!;
			const l = launch({ frozen: false, welcomeSeen, tutorialWelcomeSeen: false });
			let prompts = 0;
			WelcomeModal.prototype.prompt = () => {
				prompts++;
				assert.strictEqual(l.plugin.localState.hasSeenTutorialWelcome, true, "record before opening");
				return Promise.resolve();
			};
			try {
				await l.run(false);
				await l.run(false);
				assert.strictEqual(prompts, 1);
				assert.strictEqual(l.seen.tutorialWelcomeMarks, 1);
				assert.strictEqual(l.plugin.settings.tutorialWelcomeSeen, true);
				assert.strictEqual(l.plugin.settings.welcomeSeen, welcomeSeen);
				assert.strictEqual(l.seen.welcomeMarks, 0);
				assert.strictEqual(shouldShowCompetitorImportBanner(l.plugin), welcomeSeen);
				assert.strictEqual(l.seen.sidebarOffers, 0);
				assert.strictEqual(l.seen.saves, 0);
			} finally { Object.defineProperty(WelcomeModal.prototype, "prompt", prompt); }
		});
	}

	it("does not repeat after a fresh installation is later reloaded or upgraded", async () => {
		const prompt = Object.getOwnPropertyDescriptor(WelcomeModal.prototype, "prompt")!;
		let prompts = 0;
		WelcomeModal.prototype.prompt = () => { prompts++; return Promise.resolve(); };
		try {
			const first = launch({ tutorialWelcomeSeen: false });
			await first.run(true);
			assert.strictEqual(prompts, 1);
			// No authored settings file exists yet: only local memory survives.
			const untouchedReload = launch({ tutorialWelcomeSeen: false,
				localWelcomeSeen: true, localTutorialWelcomeSeen: first.plugin.localState.hasSeenTutorialWelcome });
			await untouchedReload.run(true);
			const upgraded = launch({ frozen: false, welcomeSeen: true, tutorialWelcomeSeen: false,
				localTutorialWelcomeSeen: first.plugin.localState.hasSeenTutorialWelcome });
			await upgraded.run(false);
			assert.strictEqual(prompts, 1);
			assert.strictEqual(upgraded.plugin.settings.tutorialWelcomeSeen, true);
			assert.strictEqual(first.seen.saves + untouchedReload.seen.saves + upgraded.seen.saves, 0);
		} finally { Object.defineProperty(WelcomeModal.prototype, "prompt", prompt); }
	});

	it("mirrors synced tutorial history locally so older settings cannot reopen it", async () => {
		const prompt = Object.getOwnPropertyDescriptor(WelcomeModal.prototype, "prompt")!;
		WelcomeModal.prototype.prompt = () => { assert.fail("already seen tutorials must stay closed"); };
		try {
			const l = launch({ frozen: false, tutorialWelcomeSeen: true });
			await l.run(false);
			assert.strictEqual(l.plugin.localState.hasSeenTutorialWelcome, true);
			l.plugin.settings.tutorialWelcomeSeen = false;
			await l.run(false);
			assert.strictEqual(l.plugin.settings.tutorialWelcomeSeen, true);
			assert.strictEqual(l.seen.tutorialWelcomeMarks, 1);
			assert.strictEqual(l.seen.saves, 0);
		} finally { Object.defineProperty(WelcomeModal.prototype, "prompt", prompt); }
	});

	it("skips the automatic offer if its marker cannot survive a restart", async () => {
		const prompt = Object.getOwnPropertyDescriptor(WelcomeModal.prototype, "prompt")!;
		WelcomeModal.prototype.prompt = () => { assert.fail("cannot promise a once-only offer without storage"); };
		try {
			const l = launch({ frozen: false, tutorialWelcomeSeen: false, tutorialMarkFails: true });
			await l.run(false);
			assert.strictEqual(l.seen.tutorialWelcomeMarks, 1);
			assert.strictEqual(l.plugin.settings.tutorialWelcomeSeen, false);
			assert.strictEqual(l.seen.saves, 0);
		} finally { Object.defineProperty(WelcomeModal.prototype, "prompt", prompt); }
	});
});
