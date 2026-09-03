/**
 * tests/saveGuard.test.ts — what the guard may and may not suppress.
 *
 * The guard's whole job is to stop `data.json` being rewritten with content it
 * already holds, because on a synced vault every rewrite is a file event. The
 * risk it carries is the mirror image: suppressing a write that genuinely
 * needed to happen. Both halves are here, and the two that matter most are the
 * failure paths — a write that threw must be retryable, and a baseline that has
 * stopped describing the file must be corrected rather than trusted.
 *
 * The correction is `adopt()`, and it replaced an `invalidate()` that nulled the
 * baseline so the next save wrote unconditionally. That was issue #41's second
 * failure: the reload path called it, the reload's own `onChange` then asked for
 * a save, and the guard — just switched off — wrote the incoming file straight
 * back at the device that had sent it. The two cases below are what must hold
 * instead, and they are the whole fix.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { SaveGuard } from "../src/utils/saveGuard";

const payload = (over: Record<string, unknown> = {}) => ({
	version: 4,
	callouts: [],
	settings: { language: "auto" },
	...over,
});

describe("SaveGuard", () => {
	it("writes the first payload of the session", () => {
		// The null baseline. This is the call that flushes a load-time migration.
		assert.notStrictEqual(new SaveGuard().prepare(payload()), null);
	});

	it("suppresses a payload identical to the last committed write", () => {
		const guard = new SaveGuard();
		const first = guard.prepare(payload());
		assert.notStrictEqual(first, null);
		guard.commit(first!);

		assert.strictEqual(guard.prepare(payload()), null);
	});

	it("writes a payload that differs", () => {
		const guard = new SaveGuard();
		guard.commit(guard.prepare(payload())!);

		assert.notStrictEqual(guard.prepare(payload({ version: 5 })), null);
	});

	it("compares serialized form, so key order counts", () => {
		// Not a quirk to work around — it is the reason settingsMerge names its
		// fields in DEFAULT_SETTINGS' order. A guard that ignored order would
		// hide that divergence here and let it surface as file churn instead.
		const guard = new SaveGuard();
		guard.commit(guard.prepare({ a: 1, b: 2 })!);

		assert.notStrictEqual(guard.prepare({ b: 2, a: 1 }), null);
	});

	it("keeps the old baseline when a write is never committed", () => {
		// `prepare()` must not move the baseline on its own: a write that threw
		// would otherwise be suppressed as a duplicate on every retry, and the
		// change would never reach disk at all.
		const guard = new SaveGuard();
		guard.commit(guard.prepare(payload())!);

		const retryable = guard.prepare(payload({ version: 5 }));
		assert.notStrictEqual(retryable, null); // "write" throws here
		assert.notStrictEqual(guard.prepare(payload({ version: 5 })), null);
	});

	it("suppresses a save that reproduces the file it adopted", () => {
		// The loop, in three lines. Another device's file arrives, we adopt it,
		// and the reload it triggers asks for a save carrying exactly what that
		// file already says. Writing it would send a file event back to the
		// device that sent us one — which is what both devices then did, forever.
		const guard = new SaveGuard();
		guard.commit(guard.prepare(payload({ version: 1 }))!);

		guard.adopt(JSON.stringify(payload()));
		assert.strictEqual(guard.prepare(payload()), null);
	});

	it("still writes when local state differs from the file it adopted", () => {
		// The half `invalidate()` existed to protect, and it survives: adopting
		// is a claim about the file, never a claim that we agree with it.
		const guard = new SaveGuard();
		guard.adopt(JSON.stringify(payload()));

		assert.notStrictEqual(guard.prepare(payload({ version: 9 })), null);
	});

	it("recognises its own last write coming back", () => {
		// Obsidian re-fires the config watcher for saves we make ourselves, so
		// the reload path asks this before rebuilding anything.
		const guard = new SaveGuard();
		const written = guard.prepare(payload())!;
		guard.commit(written);

		assert.strictEqual(guard.matches(JSON.stringify(payload())), true);
		assert.strictEqual(guard.matches(JSON.stringify(payload({ version: 9 }))), false);
	});

	it("does not treat an adopted baseline as a write that landed", () => {
		// `adopt` records what someone else put on disk. If our next payload
		// differs it must still be written — an adopted baseline is not a
		// licence to skip the write that follows it.
		const guard = new SaveGuard();
		guard.adopt(JSON.stringify(payload()));
		const next = guard.prepare(payload({ version: 5 }));
		assert.notStrictEqual(next, null);
		// ...and it stays writable until a commit says the write landed.
		assert.notStrictEqual(guard.prepare(payload({ version: 5 })), null);
	});

	it("returns the exact string commit() expects", () => {
		const guard = new SaveGuard();
		const data = payload();
		assert.strictEqual(guard.prepare(data), JSON.stringify(data));
	});
});
