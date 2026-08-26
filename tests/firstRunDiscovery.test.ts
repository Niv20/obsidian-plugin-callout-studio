/**
 * tests/firstRunDiscovery.test.ts — the once-per-install vault scan, and what
 * happens when it fails.
 *
 * `runFirstRunDiscovery` marks `settings.firstRunCompleted = true` right after
 * its chosen path finishes, whether that path threw or not — a caught scan
 * failure is not the crash-mid-await case `internals-docs/03-plugin-lifecycle.md`
 * describes as "safely re-runs on the next launch." A vault read error here
 * never retries automatically, so a `Notice` is the only way the user ever
 * learns the scan didn't happen; before this suite, neither failure path
 * (the silent small-vault auto-scan, and the large-vault consent modal's
 * "Scan now" button) surfaced anything but a `console.error`.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import {
	runFirstRunDiscovery,
	type FirstRunDiscoveryHost,
} from "../src/manager/firstRunDiscovery";
import { FirstRunScanModal } from "../src/utils/FirstRunScanModal";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { en } from "../src/i18n/en";
import { t } from "../src/i18n";

/**
 * Notices raised by anything under test, newest last. The stub `Notice`
 * records into whatever array is parked on this global (see
 * tests/support/obsidianStub.ts).
 */
const notices: string[] = [];
(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;

/** Run `body` with `console.error` swallowed, and hand back what it was told. */
async function withQuietErrors(
	body: () => Promise<void>,
): Promise<unknown[][]> {
	const seen: unknown[][] = [];
	const real = console.error;
	console.error = (...args: unknown[]) => {
		seen.push(args);
	};
	try {
		await body();
	} finally {
		console.error = real;
	}
	return seen;
}

interface Harness {
	host: FirstRunDiscoveryHost;
	saves(): number;
}

function harness(opts: {
	fileCount?: number;
	runVaultScan?: () => Promise<number>;
}): Harness {
	const registry = new CalloutRegistry();
	registry.load(null);
	const handles = Array.from({ length: opts.fileCount ?? 1 }, (_, i) => ({
		path: `note-${i}.md`,
	}));
	const app = {
		vault: { getMarkdownFiles: () => handles },
	} as unknown as App;
	let saves = 0;
	const host: FirstRunDiscoveryHost = {
		app,
		settings: registry.settings,
		registry: { settings: registry.settings },
		runVaultScan: opts.runVaultScan ?? (() => Promise.resolve(0)),
		saveSettings: () => {
			saves++;
			return Promise.resolve();
		},
	};
	return { host, saves: () => saves };
}

describe("runFirstRunDiscovery — small vault (silent auto-scan)", () => {
	it("stays quiet and still completes when nothing new was found", async () => {
		notices.length = 0;
		const h = harness({ fileCount: 3, runVaultScan: () => Promise.resolve(0) });
		await runFirstRunDiscovery(h.host);
		assert.deepStrictEqual(notices, []);
		assert.strictEqual(h.host.settings.firstRunCompleted, true);
		assert.strictEqual(h.saves(), 1);
	});

	it("announces what it found on success", async () => {
		notices.length = 0;
		const h = harness({ fileCount: 3, runVaultScan: () => Promise.resolve(2) });
		await runFirstRunDiscovery(h.host);
		assert.deepStrictEqual(notices, [
			t("firstRun.autoScanComplete", { count: "2" }),
		]);
		assert.strictEqual(h.host.settings.firstRunCompleted, true);
	});

	it("surfaces a Notice when the scan throws, and still marks first-run done", async () => {
		notices.length = 0;
		const h = harness({
			fileCount: 3,
			runVaultScan: () => Promise.reject(new Error("vault read failed")),
		});
		const errors = await withQuietErrors(() => runFirstRunDiscovery(h.host));

		// The developer-facing trace is unchanged...
		assert.strictEqual(errors.length, 1);
		// ...but the user is no longer left with silence: this is the fix.
		assert.deepStrictEqual(notices, [en["firstRun.autoScanFailed"]]);
		// No retry loop: a caught failure still completes first-run, exactly
		// like a caught success does. Only an actual crash mid-await (which
		// never reaches this line at all) re-runs the flow on next launch.
		assert.strictEqual(h.host.settings.firstRunCompleted, true);
		assert.strictEqual(h.saves(), 1);
	});
});

describe("FirstRunScanModal — the large-vault consent modal's Scan now button", () => {
	/** Access the private bits this suite needs without a real DOM/open(). */
	type Testable = { handleScan(): Promise<void>; close(): void };

	it("surfaces a Notice when the scan throws, instead of failing silently", async () => {
		notices.length = 0;
		const modal = new FirstRunScanModal(
			{} as unknown as App,
			600,
			() => Promise.reject(new Error("scan boom")),
		) as unknown as Testable;
		let closed = false;
		modal.close = () => {
			closed = true;
		};

		const errors = await withQuietErrors(() => modal.handleScan());

		assert.strictEqual(errors.length, 1);
		assert.deepStrictEqual(notices, [en["firstRun.scanFailed"]]);
		// The modal must still close — a stuck "Scanning…" button would be a
		// second bug layered on top of the silent-failure one.
		assert.strictEqual(closed, true);
	});

	it("stays quiet and closes normally when the scan succeeds", async () => {
		notices.length = 0;
		const modal = new FirstRunScanModal(
			{} as unknown as App,
			600,
			() => Promise.resolve(),
		) as unknown as Testable;
		let closed = false;
		modal.close = () => {
			closed = true;
		};

		await modal.handleScan();

		assert.deepStrictEqual(notices, []);
		assert.strictEqual(closed, true);
	});
});
