/**
 * tests/mascotDent.test.ts — the dent a poke leaves in the brush mascot
 * (ui/mascot/mascotDent.ts).
 *
 * The dent is a spring and a matrix. These tests check the two promises a user
 * can see: the side that was pressed goes in while the far side stays, and
 * after the press the brush pops back out a little and then lies flat again.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Dent } from "../src/ui/mascot/mascotDent";
import type { Vec } from "../src/ui/mascot/mascotFace";

/** Move the spring on `ms` of real time, in frames. */
function run(dent: Dent, ms: number): void {
	for (let t = 0; t < ms; t += 16) dent.step(16);
}

/** Where `matrix(a b c d e f)` takes a point: the browser's own arithmetic. */
function move(matrix: string, [x, y]: Vec): Vec {
	const [a, b, c, d, e, f] = (/matrix\(([^)]*)\)/.exec(matrix)?.[1] ?? "").split(" ").map(Number) as [number, number, number, number, number, number];
	return [a * x + c * y + e, b * x + d * y + f];
}

describe("the dent of a poke", () => {
	it("does nothing to the brush while it is not pressed", () => {
		const dent = new Dent([23, 13], 1);
		assert.equal(dent.matrix(), "matrix(1 0 0 1 0 0)");
	});

	it("goes in on the side that was pressed, and leaves the far side where it was", () => {
		const dent = new Dent([23, 13], 1); // the right edge
		run(dent, 600);
		assert.ok(dent.depth > 0.95, `pressed in (${dent.depth})`);
		const [nearX] = move(dent.matrix(), [22, 13]);
		const [farX] = move(dent.matrix(), [1, 13]);
		const nearMoved = 22 - nearX;
		const farMoved = Math.abs(farX - 1);
		assert.ok(nearMoved > 3, `the pressed side moved in (${nearMoved})`);
		// The far side is only shoved and leaned a little, never squashed.
		assert.ok(farMoved < 2 && farMoved < nearMoved / 2, `the far side stayed (${farMoved})`);
	});

	it("goes in from the top for a poke at the top", () => {
		const dent = new Dent([12, 2], 1);
		run(dent, 600);
		const [, topY] = move(dent.matrix(), [12, 3]);
		const [, footY] = move(dent.matrix(), [12, 23]);
		const topMoved = topY - 3;
		const footMoved = Math.abs(footY - 23);
		assert.ok(topMoved > 3, `the top moved down (${topMoved})`);
		assert.ok(footMoved < 2 && footMoved < topMoved / 2, `the foot stayed (${footMoved})`);
	});

	it("squashes a poke in the middle evenly, toward the feet", () => {
		const dent = new Dent([12, 13], 1);
		run(dent, 600);
		const [leftX] = move(dent.matrix(), [2, 13]);
		const [rightX] = move(dent.matrix(), [22, 13]);
		const [, topY] = move(dent.matrix(), [12, 3]);
		assert.ok(leftX > 2 && rightX < 22, "narrower");
		assert.ok(topY > 3, "lower");
	});

	it("presses harder when it is poked harder", () => {
		const gentle = new Dent([23, 13], 1);
		const hard = new Dent([23, 13], 1.5);
		run(gentle, 600);
		run(hard, 600);
		assert.ok(move(hard.matrix(), [22, 13])[0] < move(gentle.matrix(), [22, 13])[0]);
	});

	it("pops back out a little past flat when let go, then lies flat and stops", () => {
		const dent = new Dent([23, 13], 1);
		run(dent, 600);
		dent.release();
		let lowest = 0;
		let frames = 0;
		while (dent.step(16)) {
			lowest = Math.min(lowest, dent.depth);
			assert.ok(++frames < 200, "it settles within a few seconds");
		}
		assert.ok(lowest < -0.1, `it overshoots on the way back (${lowest})`);
		assert.ok(Math.abs(dent.depth) < 0.01);
	});

	it("does not overshoot much on the way in, so a press feels firm", () => {
		const dent = new Dent([23, 13], 1);
		let highest = 0;
		for (let t = 0; t < 400; t += 16) {
			dent.step(16);
			highest = Math.max(highest, dent.depth);
		}
		assert.ok(highest < 1.1, `(${highest})`);
	});

	it("carries on from where it is when pressed again while still springing back", () => {
		const dent = new Dent([23, 13], 1);
		run(dent, 600);
		dent.release();
		run(dent, 80);
		const before = dent.depth;
		dent.press([1, 13], 1.15); // the other side now
		assert.equal(dent.depth, before, "no jump");
		run(dent, 600);
		assert.ok(move(dent.matrix(), [2, 13])[0] > 2 + 1.5, "now the left side goes in");
	});

	it("survives a slow frame without blowing up", () => {
		const dent = new Dent([23, 13], 1);
		dent.step(2000);
		assert.ok(Number.isFinite(dent.depth) && Math.abs(dent.depth) < 2);
	});
});
