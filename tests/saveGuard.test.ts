/**
 * tests/saveGuard.test.ts — what the guard may and may not suppress.
 *
 * The guard's whole job is to stop `data.json` being rewritten with content it
 * already holds, because on a synced vault every rewrite is a file event. The
 * risk it carries is the mirror image: suppressing a write that genuinely
 * needed to happen. Both halves are here, and the two that matter most are the
 * failure paths — a write that threw must be retryable, and a baseline that
 * describes someone else's file must not be trusted.
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

	it("writes again after invalidate(), even for identical content", () => {
		// The external-change case. Our in-memory state may serialize to exactly
		// what we last wrote while the file on disk now holds another device's
		// version — suppressing here would leave that version standing.
		const guard = new SaveGuard();
		guard.commit(guard.prepare(payload())!);
		assert.strictEqual(guard.prepare(payload()), null);

		guard.invalidate();
		assert.notStrictEqual(guard.prepare(payload()), null);
	});

	it("returns the exact string commit() expects", () => {
		const guard = new SaveGuard();
		const data = payload();
		assert.strictEqual(guard.prepare(data), JSON.stringify(data));
	});
});
