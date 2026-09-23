import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { dragSortHarness } from "./support/dragSortHarness";

installFakeDom();

describe("drag reorder gesture lifetime", () => {
	it("persists the drop before its settling animation finishes", () => {
		const h = dragSortHarness();
		try {
			h.down(h.rows[0]!);
			h.move(110);
			h.up();
			assert.deepEqual(h.order(), ["b", "c", "a", "d"]);
			assert.deepEqual(h.model, h.order());
			assert.deepEqual(h.moves, [[0, 2]]);
			assert.ok(h.animations.some((animation) => animation.running));
			h.finishAnimations();
			assert.equal(h.moves.length, 1, "settling is cosmetic, with no later save");
		} finally { h.cleanup(); }
	});

	for (const next of ["same", "different"] as const) {
		it(`can grab the ${next} row again before the previous drop settles`, () => {
			const h = dragSortHarness();
			try {
				h.down(h.rows[0]!);
				h.move(110);
				h.up();
				const previous = [...h.animations];
				const picked = h.rows[next === "same" ? 0 : 1]!;
				h.down(picked);
				h.move(next === "same" ? 8 : 150);
				const transform = picked.style.transform;
				for (const animation of previous) animation.finish();
				assert.equal(picked.parentElement, h.list);
				assert.ok(picked.hasClass("is-dragging"));
				assert.equal(picked.style.transform, transform);
				h.up();
				assert.equal(h.moves.length, 2);
				assert.deepEqual(h.model, h.order());
				h.finishAnimations();
				assert.equal(h.moves.length, 2);
			} finally { h.cleanup(); }
		});
	}

	it("cancels a neighbour's slide when its handle is grabbed", () => {
		const h = dragSortHarness();
		try {
			h.down(h.rows[0]!);
			h.move(110);
			h.up();
			const neighbour = h.rows[1]!;
			const slide = h.animations.find((animation) => animation.row === neighbour)!;
			assert.ok(slide.running);
			h.down(neighbour);
			assert.ok(slide.cancelled, "a slide must not override the pointer transform");
			h.move(150);
			h.up();
			assert.deepEqual(h.model, h.order());
		} finally { h.cleanup(); }
	});

	it("ignores another pointer and recovers after capture is lost", () => {
		const h = dragSortHarness();
		try {
			h.down(h.rows[0]!, 7);
			h.move(150, 8);
			h.up(8);
			assert.deepEqual(h.order(), ["a", "b", "c", "d"]);
			assert.equal(h.captured(), 7);
			h.move(110, 7);
			h.loseCapture(7);
			assert.ok(!h.list.hasClass("cs-dragging"));
			assert.deepEqual(h.model, h.order());
			h.down(h.rows[0]!, 9);
			h.move(8, 9);
			h.up(9);
			assert.equal(h.moves.length, 2);
			assert.deepEqual(h.model, ["a", "b", "c", "d"]);
		} finally { h.cleanup(); }
	});

	it("can start a fresh gesture after pointer cancellation", () => {
		const h = dragSortHarness();
		try {
			h.down(h.rows[0]!);
			h.move(110);
			h.cancel();
			h.down(h.rows[0]!);
			h.move(8);
			h.up();
			assert.equal(h.moves.length, 2);
			assert.deepEqual(h.model, h.order());
		} finally { h.cleanup(); }
	});

	it("cleanup removes drag state and pending settling cannot save again", () => {
		const h = dragSortHarness();
		h.down(h.rows[0]!);
		h.move(110);
		h.up();
		assert.equal(h.moves.length, 1);
		h.cleanup();
		assert.ok(h.animations.every((animation) => !animation.running));
		h.finishAnimations();
		assert.equal(h.moves.length, 1);
		assert.ok(!h.list.hasClass("cs-dragging"));
		assert.ok(h.rows.every((row) => !row.hasClass("is-dragging")));
		h.down(h.rows[0]!);
		h.move(8);
		h.up();
		assert.equal(h.moves.length, 1, "listeners are detached");
	});

	it("cleanup during a drag releases capture and removes the floating row style", () => {
		const h = dragSortHarness();
		h.down(h.rows[0]!);
		h.move(110);
		h.cleanup();
		assert.equal(h.captured(), undefined);
		assert.ok(!h.list.hasClass("cs-dragging"));
		assert.ok(h.rows.every((row) => !row.hasClass("is-dragging")));
		assert.equal(h.rows[0]!.style.transform, undefined);
		h.up();
		h.finishAnimations();
		assert.equal(h.moves.length, 0, "closing discards the unfinished gesture");
	});

	for (const reducedMotion of [false, true]) {
		it(`reorders repeatedly within enabled/disabled bands with reduced motion ${reducedMotion}`, () => {
			const h = dragSortHarness({ reducedMotion, groups: [false, false, true, true] });
			try {
				for (let i = 0; i < 4; i++) {
					h.down(h.rows[0]!);
					h.move(i % 2 === 0 ? 500 : -100);
					h.up();
					assert.deepEqual(h.model, h.order());
					assert.deepEqual(h.order().slice(2), ["c", "d"]);
					h.finishAnimations();
				}
				assert.equal(h.moves.length, 4);
				if (reducedMotion) assert.equal(h.animations.length, 0);
			} finally { h.cleanup(); }
		});
	}
});
