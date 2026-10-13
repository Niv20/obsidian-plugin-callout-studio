/**
 * tests/quietGate.test.ts - act at once, then once more when a burst has ended.
 *
 * The gate keeps the theme claim check from running once per step while a
 * slider or a Style Settings colour is dragged (a real Obsidian, 180 `css-change`
 * events on Catppuccin: 10.5 s without the check, 26.7 s with it per event),
 * without making a lone theme switch wait for anything.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { QuietGate } from "../src/utils/quietGate";
import { manualClock } from "./support/manualClock";

const QUIET = 250;
const MAX = 2000;

function gate(clock = manualClock(), onRun: () => void = () => {}) {
	let runs = 0;
	const g = new QuietGate(
		() => {
			runs++;
			onRun();
		},
		QUIET,
		MAX,
		clock.schedule,
	);
	return { g, clock, runs: () => runs };
}

describe("a request that stands alone", () => {
	it("runs at once and leaves nothing behind", () => {
		const { g, clock, runs } = gate();
		g.request();
		assert.strictEqual(runs(), 1);
		clock.advance(10_000);
		assert.strictEqual(runs(), 1);
		assert.strictEqual(clock.pending(), 0);
	});

	it("runs at once again after the last burst has gone quiet", () => {
		const { g, clock, runs } = gate();
		g.request();
		clock.advance(QUIET);
		g.request();
		assert.strictEqual(runs(), 2);
	});
});

describe("a burst", () => {
	it("runs at once and once more when it goes quiet, however long it was", () => {
		const { g, clock, runs } = gate();
		for (let i = 0; i < 40; i++) {
			if (i > 0) clock.advance(40);
			g.request();
		}
		// 1.56 s of steps, one every 40 ms.
		assert.strictEqual(runs(), 1);
		clock.advance(QUIET - 1);
		assert.strictEqual(runs(), 1);
		clock.advance(1);
		assert.strictEqual(runs(), 2);
		clock.advance(10_000);
		assert.strictEqual(runs(), 2);
	});

	it("is answered every maxMs when it never goes quiet", () => {
		const { g, clock, runs } = gate();
		for (let i = 0; i < 200; i++) {
			g.request();
			clock.advance(50);
		}
		// 10 s of steps: one at once, then one per 2 s, not 200.
		assert.ok(runs() >= 5 && runs() <= 7, `ran ${runs()} times`);
	});

	it("treats the run it owes as the start of the next burst", () => {
		const { g, clock, runs } = gate();
		g.request();
		g.request();
		clock.advance(QUIET);
		assert.strictEqual(runs(), 2);
		// Still inside the trailing run's window: folded, not run at once.
		g.request();
		assert.strictEqual(runs(), 2);
		clock.advance(QUIET);
		assert.strictEqual(runs(), 3);
	});

	it("folds a request made from inside the run instead of recursing", () => {
		let again = true;
		const { g, clock, runs } = gate(manualClock(), () => {
			if (again) {
				again = false;
				g.request();
			}
		});
		g.request();
		assert.strictEqual(runs(), 1);
		clock.advance(QUIET);
		assert.strictEqual(runs(), 2);
	});
});

describe("an urgent request", () => {
	it("runs now inside a burst and owes nothing afterwards", () => {
		const { g, clock, runs } = gate();
		g.request();
		g.request();
		g.request(true);
		assert.strictEqual(runs(), 2);
		clock.advance(10_000);
		assert.strictEqual(runs(), 2);
	});

	it("is not ended early by a timer of the burst it replaced", () => {
		// Every timer is armed and none can be taken back.
		const { g, clock, runs } = gate(manualClock(false));
		g.request();
		clock.advance(100);
		g.request(true);
		g.request();
		assert.strictEqual(runs(), 2);
		// The first burst's quiet timer, armed at 0, falls due at 250 ms: the
		// second burst is only 200 ms old and still has a run owed.
		clock.advance(200);
		assert.strictEqual(runs(), 2);
		// Its own quiet timer, due at 350 ms, ends it.
		clock.advance(100);
		assert.strictEqual(runs(), 3);
	});
});

describe("destroy", () => {
	it("drops the run it owed and refuses later requests", () => {
		const { g, clock, runs } = gate();
		g.request();
		g.request();
		g.destroy();
		assert.strictEqual(clock.pending(), 0);
		clock.advance(10_000);
		g.request();
		assert.strictEqual(runs(), 1);
	});
});
