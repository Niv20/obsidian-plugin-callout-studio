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

	it("ignores key order, which carries no meaning and never settles", () => {
		// This used to assert the opposite, on the reasoning that order is a
		// real signal worth surfacing. It is not: two builds of this plugin
		// order the same settings differently — a field the newer one names in
		// DEFAULT_SETTINGS' order is re-emitted by the older one, which does
		// not know it, from `collectUnknownSettings` and therefore from a
		// different position. Compared by raw bytes those two files disagree
		// forever, each rewriting the other's, which is issue #41's file-sync
		// tennis. See utils/stableJson.ts.
		const guard = new SaveGuard();
		guard.commit(guard.prepare({ a: 1, b: 2 })!);

		assert.strictEqual(guard.prepare({ b: 2, a: 1 }), null);
	});

	it("ignores key order at depth, and inside array entries", () => {
		// A callout row is an object inside an array, and two builds name its
		// fields in their own order too.
		const guard = new SaveGuard();
		guard.commit(guard.prepare({ callouts: [{ id: "a", icon: "x" }] })!);

		assert.strictEqual(
			guard.prepare({ callouts: [{ icon: "x", id: "a" }] }),
			null,
		);
	});

	it("still hears a change that array order carries", () => {
		// Order within an array is the user's own — the context menu they
		// arranged, the list they sorted — so it must keep counting.
		const guard = new SaveGuard();
		guard.commit(guard.prepare({ items: ["a", "b"] })!);

		assert.notStrictEqual(guard.prepare({ items: ["b", "a"] }), null);
	});

	it("recognises a file written in another build's key order", () => {
		// The half `prepare` alone cannot do: `adopt` and `matches` are handed
		// text somebody else serialized, so they normalize it the same way.
		const guard = new SaveGuard();
		guard.adopt(JSON.stringify({ settings: { b: 2, a: 1 }, version: 4 }));

		assert.strictEqual(
			guard.matches(JSON.stringify({ version: 4, settings: { a: 1, b: 2 } })),
			true,
		);
		assert.strictEqual(guard.prepare({ version: 4, settings: { a: 1, b: 2 } }), null);
	});

	it("treats text that is not JSON as nothing it could have written", () => {
		const guard = new SaveGuard();
		guard.commit(guard.prepare({ a: 1 })!);

		assert.strictEqual(guard.matches("{ truncated"), false);
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
		// The canonical spelling rather than `JSON.stringify(data)` — the two
		// differ whenever the payload's keys are not already sorted, and the
		// value that was compared has to be the value that gets recorded or
		// the next save is written twice.
		const guard = new SaveGuard();
		const data = payload();
		const prepared = guard.prepare(data);
		assert.notStrictEqual(prepared, null);
		guard.commit(prepared!);
		assert.strictEqual(guard.prepare(payload()), null);
	});
});
