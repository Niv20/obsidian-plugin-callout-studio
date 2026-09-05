/**
 * tests/syncStaleOverwrite.test.ts — the write that must not happen.
 *
 * Every other sync suite in this repo starts from a device that *knows*
 * something changed: `onExternalSettingsChange` fired, or the boot read came
 * back `absent`/`unreadable`. This one starts from the case none of them cover,
 * which is also the one issue #53 is made of — a device where **every read
 * succeeded** and nothing ever told it the file had moved on:
 *
 * 1. A phone launches, reads a good `data.json`, and seeds the guard from it.
 * 2. It sits in the background while a desktop adds ten callouts.
 * 3. The user comes back and changes one colour.
 *
 * At step 3 the payload is a snapshot of a registry built at step 1, the guard's
 * baseline agrees with it, and nothing in `freeze()`, `hold()` or `SaveGuard`
 * has an opinion — so the write lands and ten callouts are gone, everywhere.
 * Obsidian's own hook cannot help: its config-folder watcher is desktop-only.
 *
 * So the last question before a write is asked of the disk, not of memory.
 * These tests pin both halves of that: it stops the write that would destroy
 * something, and it stops *nothing else* — a host that cannot be checked, a
 * read that throws, and a file that is simply not there all write exactly as
 * they did before.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { installFakeDom } from "./support/fakeDom";

const dom = installFakeDom();

/** A settings file on disk, and a writer that checks it before writing. */
function device(initial: Record<string, unknown> = { n: 1 }) {
	const state: Record<string, unknown> = { ...initial };
	const writes: string[] = [];
	const stale: number[] = [];
	/** What `data.json` holds. `null` is "no readable file". */
	let disk: string | null = JSON.stringify(initial);
	let readFails = false;

	const writer = new SettingsWriter({
		build: () => ({ ...state }),
		write: async (data) => {
			const json = JSON.stringify(data);
			writes.push(json);
			disk = json;
		},
		readCurrent: async () => {
			if (readFails) throw new Error("adapter is not answering");
			return disk;
		},
		onStaleWrite: () => {
			stale.push(writes.length);
		},
	});

	return {
		writer,
		state,
		writes,
		stale,
		/** Adopt what is on disk, as a launch that read it would. */
		adopt: () => {
			if (disk !== null) writer.adopt(disk);
		},
		/** Another device rewrote the file while we were not looking. */
		replaceOnDisk: (data: Record<string, unknown>) => {
			disk = JSON.stringify(data);
		},
		removeFromDisk: () => {
			disk = null;
		},
		breakReads: () => {
			readFails = true;
		},
		diskHolds: () => disk,
		/** Run the deferred report, as a later task would. */
		settle: () => {
			dom.window.flushTimers();
		},
	};
}

describe("a settings file another device replaced", () => {
	it("is not overwritten by a save carrying older state", async () => {
		const d = device({ n: 1 });
		d.adopt();
		d.replaceOnDisk({ n: 1, fromTheDesktop: true });

		d.state.n = 2;
		await d.writer.save();

		assert.deepStrictEqual(d.writes, [], "the write must be abandoned");
		assert.strictEqual(
			d.diskHolds(),
			JSON.stringify({ n: 1, fromTheDesktop: true }),
			"the other device's file must be untouched",
		);
	});

	it("is handed to the adopting path, on a later task", async () => {
		const d = device({ n: 1 });
		d.adopt();
		d.replaceOnDisk({ n: 9 });

		d.state.n = 2;
		await d.writer.save();

		assert.deepStrictEqual(
			d.stale,
			[],
			"reporting inside the pass is what deadlocks — see staleWriteGuard",
		);
		d.settle();
		assert.deepStrictEqual(d.stale, [0], "exactly one report");
	});

	it("is reported once however many saves pile up behind it", async () => {
		const d = device({ n: 1 });
		d.adopt();
		d.replaceOnDisk({ n: 9 });

		d.state.n = 2;
		await d.writer.save();
		d.state.n = 3;
		await d.writer.save();
		d.settle();

		assert.deepStrictEqual(d.writes, []);
		assert.strictEqual(d.stale.length, 1);
	});

	it("is reported again once the file is ours and diverges a second time", async () => {
		const d = device({ n: 1 });
		d.adopt();

		// A first divergence, adopted.
		d.replaceOnDisk({ n: 9 });
		d.state.n = 2;
		await d.writer.save();
		d.settle();
		d.adopt();

		// The save that follows the adoption writes normally.
		d.state.n = 3;
		await d.writer.save();
		assert.strictEqual(d.writes.length, 1, "the recovered session writes");

		// And a second divergence is announced rather than swallowed.
		d.replaceOnDisk({ n: 99 });
		d.state.n = 4;
		await d.writer.save();
		d.settle();
		assert.strictEqual(d.stale.length, 2);
	});
});

describe("a save the freshness check must not stop", () => {
	it("writes when the file on disk is still the one we adopted", async () => {
		const d = device({ n: 1 });
		d.adopt();

		d.state.n = 2;
		await d.writer.save();

		assert.deepStrictEqual(d.writes, ['{"n":2}']);
		assert.deepStrictEqual(d.stale, []);
	});

	it("writes when there is no file to lose", async () => {
		const d = device({ n: 1 });
		d.removeFromDisk();

		// A fresh install: nothing adopted, nothing on disk. Refusing here
		// would mean the user's first callout is never saved.
		d.state.n = 2;
		await d.writer.save();

		assert.deepStrictEqual(d.writes, ['{"n":2}']);
	});

	it("refuses a write when the freshness read throws", async () => {
		const d = device({ n: 1 });
		d.adopt();
		d.breakReads();

		d.state.n = 2;
		await d.writer.save();

		assert.deepStrictEqual(
			d.writes,
			[],
			"unreadable settings must never be overwritten",
		);
	});

	it("still skips a save whose payload changes nothing", async () => {
		const d = device({ n: 1 });
		d.adopt();

		await d.writer.save();

		assert.deepStrictEqual(d.writes, [], "the guard answers before the disk read");
	});
});

describe("a file this session has never read", () => {
	it("is not overwritten, even with nothing adopted", async () => {
		const d = device({ n: 1 });
		// No adopt(): the guard's baseline is null while a real file exists.
		// That is the same failure in its starkest form.
		d.state.n = 2;
		await d.writer.save();
		d.settle();

		assert.deepStrictEqual(d.writes, []);
		assert.strictEqual(d.stale.length, 1);
	});
});

describe("a host that cannot be checked", () => {
	it("starts its write without waiting for a task it does not need", () => {
		const writes: string[] = [];
		const writer = new SettingsWriter({
			build: () => ({ n: 1 }),
			write: async (data) => {
				writes.push(JSON.stringify(data));
			},
		});

		void writer.save();

		// Not a nicety: callers depend on the write having been *started* by
		// the time save() returns, and an await in front of it — even one
		// resolving immediately — pushes that to the next microtask.
		assert.deepStrictEqual(writes, ['{"n":1}']);
	});
});
