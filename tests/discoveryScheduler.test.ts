/**
 * tests/discoveryScheduler.test.ts — the scheduler on its own.
 *
 * `tests/discoveryFileOpen.test.ts` drives it through `CalloutDiscovery`, which
 * is where the reported bugs live and where they are pinned. What is left here
 * is what a real scan cannot reach: the memo's eviction cap, which needs five
 * hundred files to provoke, and the "change beats open" rule in *both* arrival
 * orders, only one of which a plausible sequence of events produces.
 *
 * The clock and `window.setTimeout` come from discoveryHarness, which installs
 * them at module scope — importing it is what makes `window` exist at all.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { TFile } from "obsidian";
import type { App, EventRef } from "obsidian";
import {
	DiscoveryScheduler,
	SCAN_MEMO_MAX_ENTRIES,
	type ScanReason,
} from "../src/manager/discoveryScheduler";
import { discoveryHarness } from "./support/discoveryHarness";

/** `DiscoveryScheduler`'s per-file debounce, which is a private literal. */
const FILE_SCAN_MS = 300;

/** A note handle carrying the `stat.mtime` the memo keys on. */
function file(path: string, mtime = 1000): TFile {
	return Object.assign(new TFile(), {
		path,
		extension: "md",
		stat: { ctime: mtime, mtime, size: 0 },
	});
}

interface Rig {
	scheduler: DiscoveryScheduler;
	/** Every `(path, reason)` a scan actually ran with, in order. */
	scans: [string, ScanReason][];
	enabled: { value: boolean };
}

function rig(): Rig {
	const scans: [string, ScanReason][] = [];
	const enabled = { value: true };
	const host = {
		app: {
			metadataCache: { on: () => ({}) as EventRef },
			vault: { on: () => ({}) as EventRef },
			workspace: {
				on: () => ({}) as EventRef,
				getLeavesOfType: () => [],
			},
		} as unknown as App,
		registerEvent: () => {},
	};
	const scheduler = new DiscoveryScheduler(host, {
		scan: (f, reason) => scans.push([f.path, reason]),
		enabled: () => enabled.value,
	});
	return { scheduler, scans, enabled };
}

/** The shared virtual clock, reset per test by `discoveryHarness()`. */
const clock = discoveryHarness().clock;

/* ========================================================================== */
/* 102. The debounce, and which reason survives it                            */
/* ========================================================================== */

describe("DiscoveryScheduler.schedule", () => {
	it("coalesces repeated queues of one file into a single scan", () => {
		const r = rig();
		const f = file("a.md");
		r.scheduler.schedule(f);
		r.scheduler.schedule(f);
		r.scheduler.schedule(f);
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, [["a.md", "change"]]);
	});

	it("keeps separate timers per file", () => {
		const r = rig();
		r.scheduler.schedule(file("a.md"));
		r.scheduler.schedule(file("b.md"));
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans.map(([p]) => p).sort(), ["a.md", "b.md"]);
	});

	it("lets a change queued first survive a later open", () => {
		// The write is owed a prune; the open is not. Whichever arrives second,
		// the answer has to be the one that prunes.
		const r = rig();
		const f = file("a.md");
		r.scheduler.schedule(f, "change");
		r.scheduler.schedule(f, "open");
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, [["a.md", "change"]]);
	});

	it("lets a change queued second upgrade an earlier open", () => {
		const r = rig();
		const f = file("a.md");
		r.scheduler.schedule(f, "open");
		r.scheduler.schedule(f, "change");
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, [["a.md", "change"]]);
	});

	it("queues nothing at all while discovery is switched off", () => {
		const r = rig();
		r.enabled.value = false;
		r.scheduler.schedule(file("a.md"));
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, []);
	});

	it("drops every pending timer on destroy", () => {
		const r = rig();
		r.scheduler.schedule(file("a.md"));
		r.scheduler.destroy();
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, []);
	});
});

/* ========================================================================== */
/* 103. The memo                                                              */
/* ========================================================================== */

describe("DiscoveryScheduler's scan memo", () => {
	it("skips an open of a file scanned at this exact mtime", () => {
		const r = rig();
		const f = file("a.md");
		r.scheduler.markScanned(f);
		r.scheduler.schedule(f, "open");
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, []);
	});

	it("never skips a change, however fresh the memo is", () => {
		// A write path also schedules the prune. A memo hit here would quietly
		// skip that too, which is not what the memo is for.
		const r = rig();
		const f = file("a.md");
		r.scheduler.markScanned(f);
		r.scheduler.schedule(f, "change");
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, [["a.md", "change"]]);
	});

	it("does not skip an open once the mtime has moved", () => {
		const r = rig();
		r.scheduler.markScanned(file("a.md", 1000));
		r.scheduler.schedule(file("a.md", 2000), "open");
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, [["a.md", "open"]]);
	});

	it("does not skip an open that joins a scan already queued", () => {
		// The pending timer is the newer answer; a stale memo entry must not
		// take precedence over a scan that has not run yet.
		const r = rig();
		const f = file("a.md");
		r.scheduler.markScanned(f);
		r.scheduler.schedule(f, "change");
		r.scheduler.schedule(f, "open");
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, [["a.md", "change"]]);
	});

	it("forgets everything on forgetScanned", () => {
		const r = rig();
		const f = file("a.md");
		r.scheduler.markScanned(f);
		r.scheduler.forgetScanned();
		r.scheduler.schedule(f, "open");
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, [["a.md", "open"]]);
	});

	it("evicts the oldest entry rather than growing without bound", () => {
		// A long session walking a whole vault would otherwise hold an entry per
		// note ever opened, including every note deleted since.
		const r = rig();
		const first = file("0.md");
		r.scheduler.markScanned(first);
		for (let i = 1; i <= SCAN_MEMO_MAX_ENTRIES; i++) {
			r.scheduler.markScanned(file(`${i}.md`));
		}

		r.scheduler.schedule(first, "open");
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, [["0.md", "open"]], "aged out");
	});

	it("keeps the newest entries when it evicts", () => {
		const r = rig();
		for (let i = 0; i <= SCAN_MEMO_MAX_ENTRIES; i++) {
			r.scheduler.markScanned(file(`${i}.md`));
		}

		r.scheduler.schedule(file(`${SCAN_MEMO_MAX_ENTRIES}.md`), "open");
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, [], "still memoized");
	});

	it("re-marking a file makes it the newest, not the oldest", () => {
		// Insertion order is read as recency, so an entry refreshed in place
		// would age out ahead of files touched once and never again.
		const r = rig();
		const kept = file("kept.md");
		r.scheduler.markScanned(kept);
		for (let i = 0; i < SCAN_MEMO_MAX_ENTRIES - 1; i++) {
			r.scheduler.markScanned(file(`${i}.md`));
		}
		r.scheduler.markScanned(kept); // touched again, back to the newest
		r.scheduler.markScanned(file("last.md")); // now over the cap

		r.scheduler.schedule(kept, "open");
		clock.advance(FILE_SCAN_MS);
		assert.deepStrictEqual(r.scans, [], "survived the eviction");
	});
});
