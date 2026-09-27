/**
 * The two ends of a session.
 *
 * Launch rebuilds the registry under a hold. An external settings event
 * arriving meanwhile used to start an adoption that rebuilt it again
 * underneath; it now waits for launch to finish. Unload used to destroy the
 * writer at once, cancelling the pass that carried a change made a moment
 * before closing; it now lets that write finish, writes once more if anything
 * changed since, and only then stops.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import CalloutStudioPlugin from "../src/main";
import { SettingsWriter } from "../src/manager/SettingsWriter";

function gate() {
	let release!: () => void;
	const promise = new Promise<void>(resolve => { release = resolve; });
	return { promise, release };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

describe("closing the writer on unload", () => {
	it("finishes the write under way, writes the change made after it, then stops", async () => {
		let state = { n: 1 };
		const writes: number[] = [];
		const first = gate();
		const writer = new SettingsWriter({
			build: () => state,
			write: async data => {
				if (writes.length === 0) await first.promise;
				writes.push((data as { n: number }).n);
			},
		});
		writer.adopt(JSON.stringify({ n: 0 }));
		void writer.save();
		await settle();
		state = { n: 2 };
		void writer.save();
		writer.close();
		assert.equal(writer.isDestroyed, true, "the rest of the plugin must see it gone at once");
		await writer.save();
		first.release();
		for (let i = 0; i < 5; i++) await settle();
		assert.deepEqual(writes, [1, 2]);
	});

	it("writes nothing when nothing changed", async () => {
		let writes = 0;
		const writer = new SettingsWriter({ build: () => ({ n: 1 }), write: async () => { writes++; } });
		writer.adopt(JSON.stringify({ n: 1 }));
		writer.close();
		for (let i = 0; i < 3; i++) await settle();
		assert.equal(writes, 0);
		assert.equal(writer.isDestroyed, true);
	});

	it("writes nothing while saving is paused", async () => {
		let writes = 0;
		const writer = new SettingsWriter({ build: () => ({ n: 2 }), write: async () => { writes++; } });
		writer.adopt(JSON.stringify({ n: 1 }));
		writer.freeze("missing");
		writer.close();
		for (let i = 0; i < 3; i++) await settle();
		assert.equal(writes, 0);
	});
});

describe("settings events during launch", () => {
	it("wait for launch to finish loading before any adoption starts", async () => {
		const launch = gate();
		let runs = 0;
		const self = { booted: launch.promise, reloads: { run: () => { runs++; return Promise.resolve(); } } };
		const event = CalloutStudioPlugin.prototype.onExternalSettingsChange.call(self as unknown as CalloutStudioPlugin);
		await settle();
		assert.equal(runs, 0, "an adoption started while launch was still loading");
		launch.release();
		await event;
		assert.equal(runs, 1);
	});
});
