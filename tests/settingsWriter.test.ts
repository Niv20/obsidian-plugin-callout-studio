/**
 * tests/settingsWriter.test.ts — the write policy, without a plugin.
 *
 * Two things used to be true of `saveSettings()` and are the reason this class
 * exists, so both are pinned here rather than described:
 *
 * - **Concurrent saves raced.** Most callers are `void saveSettings()`, so two
 *   could be in flight at once, each carrying a snapshot taken at its own
 *   moment, and `data.json` was left to whichever finished last. The fix is not
 *   "queue the snapshots" but "queue the *passes*" — a follow-up builds its own
 *   payload when it runs, so the file always ends up holding the final state.
 * - **Byte-identical payloads were written anyway**, and on a synced vault a
 *   rewrite of `data.json` is a file event. See `utils/saveGuard.ts`.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { SettingsWriter } from "../src/manager/SettingsWriter";

/** A deferred promise, so a test can hold a write open. */
function deferred<T>() {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** A writer over a mutable payload, recording every write it performs. */
function harness(initial: Record<string, unknown> = { n: 1 }) {
	const state = { ...initial };
	const writes: string[] = [];
	let builds = 0;
	let gate: { promise: Promise<void>; resolve: (v: void) => void } | null = null;

	const writer = new SettingsWriter({
		build: () => {
			builds++;
			return { ...state };
		},
		write: async (data) => {
			writes.push(JSON.stringify(data));
			if (gate) await gate.promise;
		},
	});

	return {
		writer,
		state,
		writes,
		builds: () => builds,
		/** Hold every subsequent write open until `release()`. */
		hold: () => {
			gate = deferred<void>();
		},
		release: () => {
			gate?.resolve();
			gate = null;
		},
	};
}

describe("SettingsWriter — the guard", () => {
	it("writes the first save of the session", async () => {
		const h = harness();
		await h.writer.save();
		assert.deepStrictEqual(h.writes, ['{"n":1}']);
	});

	it("skips a save whose payload is byte-identical", async () => {
		const h = harness();
		await h.writer.save();
		await h.writer.save();
		assert.strictEqual(h.writes.length, 1);
	});

	it("writes again once the payload changes", async () => {
		const h = harness();
		await h.writer.save();
		h.state.n = 2;
		await h.writer.save();
		assert.deepStrictEqual(h.writes, ['{"n":1}', '{"n":2}']);
	});

	it("suppresses a save that reproduces the file it adopted", async () => {
		// The reload path's whole reason for existing: adopting another device's
		// file must not provoke a write back at it. See utils/saveGuard.ts.
		const h = harness();
		h.writer.adopt(JSON.stringify({ n: 1 }));
		await h.writer.save();
		assert.strictEqual(h.writes.length, 0);
	});

	it("still writes when local state differs from the adopted file", async () => {
		const h = harness();
		h.writer.adopt(JSON.stringify({ n: 99 }));
		await h.writer.save();
		assert.deepStrictEqual(h.writes, ['{"n":1}']);
	});

	it("collapses every save made during a hold into one pass", async () => {
		// A reload provokes several independent `void saveSettings()` calls on
		// its way past. Only the settled state may reach the file.
		const h = harness();
		await h.writer.hold(async () => {
			await h.writer.save();
			h.state.n = 2;
			await h.writer.save();
			h.state.n = 3;
			assert.strictEqual(h.writes.length, 0, "nothing written while held");
		});
		assert.deepStrictEqual(h.writes, ['{"n":3}']);
	});

	it("writes nothing for a hold that asked for nothing", async () => {
		const h = harness();
		await h.writer.hold(async () => undefined);
		assert.strictEqual(h.writes.length, 0);
	});

	it("does not flush a hold whose body threw", async () => {
		// A body that threw may have left the registry half-rebuilt, and writing
		// that over the file it was being rebuilt from is the worst outcome.
		const h = harness();
		await assert.rejects(
			h.writer.hold(async () => {
				await h.writer.save();
				throw new Error("mid-reload");
			}),
		);
		assert.strictEqual(h.writes.length, 0);
		// The request must not leak into the next hold either.
		await h.writer.hold(async () => undefined);
		assert.strictEqual(h.writes.length, 0);
	});

	it("flushes once for nested holds, at the outermost release", async () => {
		const h = harness();
		await h.writer.hold(async () => {
			await h.writer.hold(async () => {
				await h.writer.save();
			});
			assert.strictEqual(h.writes.length, 0, "inner release must not flush");
			h.state.n = 7;
		});
		assert.deepStrictEqual(h.writes, ['{"n":7}']);
	});

	it("writes nothing at all once frozen", async () => {
		// The session that could not read data.json. Every save it could produce
		// would replace a file we failed to understand with one we know is wrong.
		const h = harness();
		h.writer.freeze();
		await h.writer.save();
		await h.writer.hold(async () => {
			await h.writer.save();
		});
		assert.strictEqual(h.writes.length, 0);
	});

	it("retries a write that threw", async () => {
		let fail = true;
		const writes: string[] = [];
		const writer = new SettingsWriter({
			build: () => ({ n: 1 }),
			write: async (data) => {
				if (fail) {
					fail = false;
					throw new Error("disk full");
				}
				writes.push(JSON.stringify(data));
			},
		});

		await assert.rejects(() => writer.save());
		await writer.save();
		assert.deepStrictEqual(writes, ['{"n":1}']);
	});
});

describe("SettingsWriter — coalescing", () => {
	it("does not start a second write while one is in flight", async () => {
		const h = harness();
		h.hold();

		const first = h.writer.save();
		h.state.n = 2;
		const second = h.writer.save();
		assert.strictEqual(h.writes.length, 1, "second write must wait");

		h.release();
		await Promise.all([first, second]);
		assert.deepStrictEqual(h.writes, ['{"n":1}', '{"n":2}']);
	});

	it("collapses many waiting callers into one follow-up pass", async () => {
		const h = harness();
		h.hold();

		const calls = [h.writer.save()];
		for (let i = 0; i < 5; i++) {
			h.state.n = i + 2;
			calls.push(h.writer.save());
		}
		h.release();
		await Promise.all(calls);

		// One write for the in-flight pass, one for everything that arrived
		// during it — not six.
		assert.deepStrictEqual(h.writes, ['{"n":1}', '{"n":6}']);
	});

	it("builds the follow-up payload when it runs, not when it was asked for", async () => {
		// The whole reason main.ts's listener ordering is no longer load
		// bearing: a queued pass carries the final state, not a stale snapshot.
		const h = harness();
		h.hold();

		const first = h.writer.save();
		h.state.n = 2;
		const second = h.writer.save();
		h.state.n = 99; // changed AFTER the second save was requested

		h.release();
		await Promise.all([first, second]);
		assert.deepStrictEqual(h.writes, ['{"n":1}', '{"n":99}']);
	});

	it("resolves every caller, including the ones that only waited", async () => {
		const h = harness();
		h.hold();
		const calls = [h.writer.save(), h.writer.save(), h.writer.save()];
		h.release();
		await assert.doesNotReject(() => Promise.all(calls));
	});

	it("still runs the follow-up when the in-flight write failed", async () => {
		// The queued state is unsaved either way; dropping the follow-up would
		// strand it until some unrelated mutation came along.
		let calls = 0;
		const writes: number[] = [];
		const gate = deferred<void>();
		let n = 1;
		const writer = new SettingsWriter({
			build: () => ({ n }),
			write: async () => {
				calls++;
				if (calls === 1) {
					await gate.promise;
					throw new Error("disk full");
				}
				writes.push(n);
			},
		});

		const first = writer.save();
		n = 2;
		const second = writer.save();
		gate.resolve();

		await assert.rejects(() => first);
		await second;
		assert.deepStrictEqual(writes, [2]);
	});

	it("reports busy while a pass is in flight", async () => {
		const h = harness();
		h.hold();
		const pending = h.writer.save();
		assert.strictEqual(h.writer.busy, true);
		h.release();
		await pending;
		assert.strictEqual(h.writer.busy, false);
	});

	it("does not build a payload before it is going to be used", async () => {
		const h = harness();
		assert.strictEqual(h.builds(), 0);
		await h.writer.save();
		assert.strictEqual(h.builds(), 1);
	});
});

describe("SettingsWriter — a session that is not writing", () => {
	/** A writer that records the saves a freeze threw away. */
	function frozenHarness() {
		const dropped: number[] = [];
		const writes: string[] = [];
		const writer = new SettingsWriter({
			build: () => ({ n: 1 }),
			write: async (data) => {
				writes.push(JSON.stringify(data));
			},
			onFrozenSave: () => dropped.push(writes.length),
		});
		return { writer, writes, dropped };
	}

	it("says so the first time a change is thrown away", async () => {
		// The launch notice announcing the freeze was shown before the user had
		// looked at the screen, and is long gone by the time they change a
		// colour. A change that silently does not stick is how a frozen session
		// gets reported as the plugin ignoring the user.
		const h = frozenHarness();
		h.writer.freeze();

		await h.writer.save();

		assert.deepStrictEqual(h.dropped, [0]);
		assert.deepStrictEqual(h.writes, []);
	});

	it("says it once, not on every save the session goes on making", async () => {
		const h = frozenHarness();
		h.writer.freeze();

		for (let i = 0; i < 5; i++) await h.writer.save();

		assert.strictEqual(h.dropped.length, 1);
	});

	it("says it again after a second freeze", async () => {
		// A session can recover and lose the file again — a sync client
		// swapping it twice is one file event each way.
		const h = frozenHarness();
		h.writer.freeze();
		await h.writer.save();
		h.writer.thaw();
		await h.writer.save();
		h.writer.freeze();
		await h.writer.save();

		assert.strictEqual(h.dropped.length, 2);
		assert.strictEqual(h.writes.length, 1, "the thawed save wrote");
	});

	it("stays quiet on a host that does not want to know", async () => {
		const writer = new SettingsWriter({
			build: () => ({ n: 1 }),
			write: () => Promise.resolve(),
		});
		writer.freeze();

		await writer.save();
	});
});

describe("SettingsWriter — unloading", () => {
	it("drops queued and later saves after unload", async () => {
		const h = harness(); h.hold();
		const first = h.writer.save();
		h.state.n = 2;
		const queued = h.writer.save();
		h.writer.destroy(); h.release();
		await Promise.all([first, queued]);
		await h.writer.save();
		assert.deepStrictEqual(h.writes, ['{"n":1}']);
	});
	it("does not begin a write if unloaded while checking disk freshness", async () => {
		const gate = deferred<string | null>(); let writes = 0;
		const writer = new SettingsWriter({ build: () => ({}), readCurrent: () => gate.promise,
			write: async () => { writes++; } });
		const pending = writer.save(); writer.destroy(); gate.resolve(null);
		await pending;
		assert.strictEqual(writes, 0);
	});
	it("does not publish a manual transaction after unload during its physical write", async () => {
		const gate = deferred<void>(); let published = 0;
		const writer = new SettingsWriter({ build: () => ({}), write: () => gate.promise });
		const pending = writer.commit({ n: 1 }, () => true, () => { published++; });
		writer.destroy(); gate.resolve();
		assert.strictEqual(await pending, false);
		assert.strictEqual(published, 0);
	});
});
