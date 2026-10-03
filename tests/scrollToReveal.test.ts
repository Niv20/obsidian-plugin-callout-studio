/**
 * tests/scrollToReveal.test.ts — scrolling a container just far enough to show
 * one thing in it.
 *
 * `scrollDeltaToReveal` is the arithmetic and `scrollToReveal` the two reads and
 * one write around it. The real layout cannot be had here (the fake DOM has
 * none), so the pieces are fed rectangles by hand; what the numbers add up to
 * on screen was checked in a browser against Obsidian's own CSS.
 *
 * What the suite holds it to:
 *
 * - **Nothing moves when the item already shows.** The window that uses it
 *   must scroll only when the row the person pressed went out of sight, so "in
 *   view" has to come back as exactly 0 and the scroller must not even be
 *   written to — an assignment of the same offset still cancels a momentum
 *   scroll on a touch screen.
 * - **It moves toward the item, and no further than the margin asks.**
 * - **The margin gives way before the item does**: a view barely taller than
 *   its row still has a place to scroll the row to, and a row taller than the
 *   view is scrolled to by its top.
 * - **The scrollport is the padding box**, not the border box.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	REVEAL_MARGIN_PX,
	scrollDeltaToReveal,
	scrollToReveal,
} from "../src/ui/scrollToReveal";

const VIEW = { top: 0, bottom: 300 };

describe("scrollDeltaToReveal", () => {
	it("is 0 for an item that sits inside the view with its margin to spare", () => {
		assert.equal(scrollDeltaToReveal({ top: 100, bottom: 150 }, VIEW, 40), 0);
		// Exactly on the margin is still inside it.
		assert.equal(scrollDeltaToReveal({ top: 40, bottom: 260 }, VIEW, 40), 0);
	});

	it("scrolls down by the distance the item's bottom is short of the margin", () => {
		// 330 is 70 below the 260 the margin leaves.
		assert.equal(scrollDeltaToReveal({ top: 280, bottom: 330 }, VIEW, 40), 70);
	});

	it("scrolls up by the distance the item's top is short of the margin", () => {
		// -20 is 60 above the 40 the margin leaves.
		assert.equal(scrollDeltaToReveal({ top: -20, bottom: 30 }, VIEW, 40), -60);
	});

	it("scrolls an item that shows, but sits inside the margin, just out of it", () => {
		assert.equal(scrollDeltaToReveal({ top: 250, bottom: 290 }, VIEW, 40), 30);
		assert.equal(scrollDeltaToReveal({ top: 10, bottom: 60 }, VIEW, 40), -30);
	});

	it("keeps no margin when it is 0", () => {
		assert.equal(scrollDeltaToReveal({ top: 250, bottom: 300 }, VIEW, 0), 0);
		assert.equal(scrollDeltaToReveal({ top: 260, bottom: 310 }, VIEW, 0), 10);
	});

	it("lets the margin shrink to what the room allows, so the item always has a place", () => {
		// 100px of view, an 80px item: 20px to spare, so 10px a side, not 40.
		const view = { top: 0, bottom: 100 };
		assert.equal(scrollDeltaToReveal({ top: 10, bottom: 90 }, view, 40), 0);
		assert.equal(scrollDeltaToReveal({ top: 95, bottom: 175 }, view, 40), 85);
		assert.equal(scrollDeltaToReveal({ top: -50, bottom: 30 }, view, 40), -60);
	});

	it("scrolls to the top of an item taller than the view", () => {
		const view = { top: 0, bottom: 100 };
		assert.equal(scrollDeltaToReveal({ top: -10, bottom: 200 }, view, 40), -10);
		assert.equal(scrollDeltaToReveal({ top: 30, bottom: 230 }, view, 40), 30);
		assert.equal(scrollDeltaToReveal({ top: 0, bottom: 200 }, view, 40), 0);
	});

	it("reads positions in whatever frame they come in, not from 0", () => {
		const view = { top: 500, bottom: 800 };
		assert.equal(scrollDeltaToReveal({ top: 780, bottom: 830 }, view, 40), 70);
		assert.equal(scrollDeltaToReveal({ top: 520, bottom: 570 }, view, 40), -20);
		assert.equal(scrollDeltaToReveal({ top: 600, bottom: 650 }, view, 40), 0);
	});
});

/** A scroller and an item that answer only what `scrollToReveal` asks. */
function setup(options: {
	scrollerTop: number;
	clientTop?: number;
	clientHeight: number;
	scrollTop?: number;
	item: { top: number; bottom: number };
}) {
	const writes: number[] = [];
	let scrollTop = options.scrollTop ?? 0;
	const clientTop = options.clientTop ?? 0;
	const scroller = {
		clientTop,
		clientHeight: options.clientHeight,
		// The border box: a border above and below the padding box.
		getBoundingClientRect: () => ({
			top: options.scrollerTop,
			bottom: options.scrollerTop + options.clientHeight + 2 * clientTop,
		}),
		get scrollTop() {
			return scrollTop;
		},
		set scrollTop(value: number) {
			writes.push(value);
			scrollTop = value;
		},
	};
	const item = { getBoundingClientRect: () => options.item };
	return {
		scroller: scroller as unknown as HTMLElement,
		item: item as unknown as HTMLElement,
		writes,
		scrollTop: () => scrollTop,
	};
}

describe("scrollToReveal", () => {
	it("defaults to a margin that leaves room for a group caption above a row", () => {
		// A caption (about 21px) and the line above it (about 11px) sit over a
		// group's first row: the margin has to clear both.
		assert.ok(REVEAL_MARGIN_PX >= 36, `${REVEAL_MARGIN_PX}px would cut the caption off`);
	});

	it("does not touch the scroller when the item is already in view", () => {
		const h = setup({ scrollerTop: 100, clientHeight: 300, scrollTop: 50, item: { top: 200, bottom: 250 } });
		scrollToReveal(h.scroller, h.item);
		assert.deepEqual(h.writes, []);
		assert.equal(h.scrollTop(), 50);
	});

	it("scrolls down by how far the item is below, and adds to where the scroller already was", () => {
		// View 100..400, margin 40: the item's bottom may reach 360; it is at 430.
		const h = setup({ scrollerTop: 100, clientHeight: 300, scrollTop: 50, item: { top: 380, bottom: 430 } });
		scrollToReveal(h.scroller, h.item);
		assert.deepEqual(h.writes, [120]);
	});

	it("scrolls up by how far the item is above", () => {
		// The item's top may reach 140; it is at 90.
		const h = setup({ scrollerTop: 100, clientHeight: 300, scrollTop: 200, item: { top: 90, bottom: 140 } });
		scrollToReveal(h.scroller, h.item);
		assert.deepEqual(h.writes, [150]);
	});

	it("measures the view from inside the border, not from the border box", () => {
		// A 2px border: the scrollport starts at 102 and is 300 tall.
		const h = setup({ scrollerTop: 100, clientTop: 2, clientHeight: 300, item: { top: 100, bottom: 150 } });
		scrollToReveal(h.scroller, h.item);
		// Top 100 is 42 short of the 142 the margin leaves.
		assert.deepEqual(h.writes, [-42]);
	});

	it("takes the margin it is given", () => {
		const h = setup({ scrollerTop: 0, clientHeight: 300, item: { top: 250, bottom: 300 } });
		scrollToReveal(h.scroller, h.item, 0);
		assert.deepEqual(h.writes, []);
		scrollToReveal(h.scroller, h.item, 20);
		assert.deepEqual(h.writes, [20]);
	});
});
