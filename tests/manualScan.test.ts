/**
 * tests/manualScan.test.ts — Scan for callouts, the vault scan started from
 * the settings (settings/sections/manualScan.ts).
 *
 * What is checked: one scan at a time per plugin, marked as running before it
 * first waits and cleared when it ends (failed or not), the scan handed the
 * wait that clears "Scanning…" before it saves, a notice with the count or the
 * failure, nothing while saving is paused, and two plugins never sharing a
 * scan.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { t } from "../src/i18n";
import { runManualScan, scanRunning } from "../src/settings/sections/manualScan";
import type { SettingsTabPlugin } from "../src/settings/sections/types";

const notices: string[] = [];
(globalThis as unknown as { __CS_NOTICES__: string[] }).__CS_NOTICES__ = notices;
afterEach(() => {
	notices.length = 0;
});

/** A promise the test settles by hand. */
function pending() {
	let resolve!: (count: number) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<number>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

/** What the scan awaits before it saves, as `runVaultScan` takes it. */
type BeforeSave = () => Promise<void>;

/** A plugin whose vault scan is `scan`, counting how often it runs. */
function fakePlugin(scan: (beforeSave?: BeforeSave) => Promise<number>) {
	let calls = 0;
	const plugin = {
		settingsWriter: { isFrozen: false },
		runVaultScan: (beforeSave?: BeforeSave) => {
			calls++;
			return scan(beforeSave);
		},
	};
	return { plugin, asPlugin: plugin as unknown as SettingsTabPlugin, calls: () => calls };
}

describe("Scan for callouts", () => {
	it("runs one scan at a time, marked as running from the call until it ends", async () => {
		const p = pending();
		const { asPlugin, calls } = fakePlugin(() => p.promise);
		const first = runManualScan(asPlugin);
		assert.equal(scanRunning(asPlugin), true, "running before the first wait");
		void runManualScan(asPlugin);
		// The scan starts once "Scanning…" has been drawn, one wait later.
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(calls(), 1, "a second press while one runs does nothing");
		p.resolve(3);
		await first;
		assert.equal(scanRunning(asPlugin), false);
		assert.deepEqual(notices, [t("settings.rescanComplete", { count: "3" })]);
	});

	it('hands the scan the wait that takes "Scanning…" away before anything is saved', async () => {
		let waited = 0;
		const { asPlugin } = fakePlugin(async (beforeSave) => {
			assert.ok(beforeSave, "the scan is given its wait");
			await beforeSave();
			waited++;
			assert.deepEqual(notices, [], "the result waits until the new callouts are saved");
			return 2;
		});
		await runManualScan(asPlugin);
		assert.equal(waited, 1);
		assert.deepEqual(notices, [t("settings.rescanComplete", { count: "2" })]);
	});

	it("says a scan failed, and lets the next press try again", async () => {
		const p = pending();
		// The first scan is the one that fails; the retry succeeds.
		const { asPlugin, calls } = fakePlugin(() => (calls() === 1 ? p.promise : Promise.resolve(0)));
		// The failure is logged too; that line is expected here.
		const error = console.error;
		console.error = () => {};
		try {
			const first = runManualScan(asPlugin);
			p.reject(new Error("vault unreadable"));
			await first;
		} finally {
			console.error = error;
		}
		assert.equal(scanRunning(asPlugin), false);
		assert.deepEqual(notices, [t("manualDiscovery.failed")]);
		await runManualScan(asPlugin);
		assert.equal(calls(), 2);
	});

	it("does nothing while saving is paused", async () => {
		const { plugin, asPlugin, calls } = fakePlugin(() => Promise.resolve(1));
		plugin.settingsWriter.isFrozen = true;
		await runManualScan(asPlugin);
		assert.equal(calls(), 0);
		assert.equal(scanRunning(asPlugin), false);
	});

	it("keeps each plugin's scan to itself", () => {
		const p = pending();
		const one = fakePlugin(() => p.promise);
		const two = fakePlugin(() => Promise.resolve(0));
		void runManualScan(one.asPlugin);
		assert.equal(scanRunning(one.asPlugin), true);
		assert.equal(scanRunning(two.asPlugin), false);
		p.resolve(0);
	});
});
