/**
 * tests/scrollRestore.test.ts — the settings page rebuilding under a reader.
 *
 * `display()` empties its container and renders every section again, and it is
 * not only called when somebody opens the tab: an external `data.json` landing
 * re-runs it, and so does a locale download. Restoring `scrollTop` once, at the
 * end of that synchronous pass, is the obvious fix and is not enough — rows
 * carry icons and images that resolve afterwards, each one makes the page
 * taller, and a position assigned past the end of the shorter page is clamped
 * by the browser. The clamped value is what the reader is left at, which reads
 * exactly like the page jumping to the top on its own.
 *
 * Two issue reports described that while scrolling a long callout list.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { captureScroll } from "../src/settings/sections/scrollRestore";
import { installFakeDom } from "./support/fakeDom";

const dom = installFakeDom();

/**
 * A scroller whose height the test controls.
 *
 * `scrollTop` clamps to `max`, exactly as a browser clamps to the scrollable
 * height — which is the whole behaviour under test.
 */
function scroller(max: number, at = 0) {
	const el = {
		isConnected: true,
		max,
		_top: Math.min(at, max),
		get scrollTop() {
			return this._top;
		},
		set scrollTop(value: number) {
			this._top = Math.min(value, this.max);
		},
	};
	return el as typeof el & HTMLElement;
}

describe("putting the reader back where they were", () => {
	it("restores the position once the sections are in", () => {
		const el = scroller(1000, 400);
		const restore = captureScroll(el);
		el.scrollTop = 0; // display() empties the container

		restore();

		assert.strictEqual(el.scrollTop, 400);
	});

	it("corrects a restore the short page clamped", () => {
		// The real failure. At restore time only half the rows have their
		// artwork, so the page is shorter than it was and 400 becomes 150.
		const el = scroller(1000, 400);
		const restore = captureScroll(el);
		el.scrollTop = 0;
		el.max = 150;

		restore();
		assert.strictEqual(el.scrollTop, 150, "clamped, as a browser would");

		// The icons land and the page is its full height again.
		el.max = 1000;
		dom.window.flushFrames();

		assert.strictEqual(el.scrollTop, 400);
	});

	it("leaves a reader who scrolled further down alone", () => {
		// The correction only ever moves *up* to the remembered position, so a
		// deliberate scroll inside that one frame is not fought.
		const el = scroller(1000, 400);
		const restore = captureScroll(el);
		restore();
		el.scrollTop = 700;

		dom.window.flushFrames();

		assert.strictEqual(el.scrollTop, 700);
	});

	it("does nothing at all for a pane that was at the top", () => {
		// A freshly opened tab. The restore has to be a no-op there, or every
		// open would schedule a frame for nothing.
		const el = scroller(1000, 0);
		const restore = captureScroll(el);
		el.scrollTop = 250;

		restore();
		dom.window.flushFrames();

		assert.strictEqual(el.scrollTop, 250);
	});

	it("does not touch a container that has since been detached", () => {
		const el = scroller(1000, 400);
		const restore = captureScroll(el);
		el.scrollTop = 0;
		el.isConnected = false;

		restore();
		dom.window.flushFrames();

		assert.strictEqual(el.scrollTop, 0);
	});
});
