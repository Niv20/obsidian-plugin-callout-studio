/**
 * tests/sectionFoldAnchor.test.ts — folding a pinned heading without the page
 * jumping out from under it.
 *
 * `keepHeadingInPlace` exists for one moment: a section whose heading is stuck
 * to the top of the settings pane is folded shut, the content it was pinned over
 * goes away, and the heading drops back to its own place — which is above the
 * fold, so it vanishes upward and everything below it lurches up by the height
 * of what was removed. The correction is the difference between the heading's
 * box before and after, handed back to the scroller.
 *
 * The direction is the whole of it, and it is the thing worth pinning down: a
 * sign error here does not fail quietly, it doubles the jump. So the case that
 * matters most below is the one that says *by how much, and which way*.
 *
 * Nothing here measures a real layout, and it must not — the fake DOM has no
 * layout engine, and its own header says no test may assert on one. Every number
 * in these cases is one this file wrote onto a stub, which is exactly what makes
 * the arithmetic checkable in isolation from it.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { keepHeadingInPlace } from "../src/settings/sections/foldAnchor";
import { installFakeDom } from "./support/fakeDom";

installFakeDom();

type Rig = {
	headingEl: HTMLElement;
	scroller: HTMLElement;
	/** What the heading's box will report on the next read. */
	setTop: (top: number) => void;
};

/**
 * A settings pane with one section heading in it.
 *
 * The scroller is given `vertical-tab-content`, the class Obsidian puts on the
 * settings pane and the one `scrollParentOf` looks for first, so the lookup this
 * exercises is the same one that runs in the app.
 */
function rig(withRect = true): Rig {
	const scroller = createDiv({ cls: "vertical-tab-content" });
	const wrapEl = scroller.createDiv({ cls: "cs-sticky-section" });
	const headingEl = wrapEl.createDiv({ cls: "cs-sticky-heading" });
	scroller.scrollTop = 1000;

	let top = 0;
	if (withRect) {
		headingEl.getBoundingClientRect = () =>
			({ top }) as unknown as DOMRect;
	}
	return { headingEl, scroller, setTop: (next: number) => (top = next) };
}

describe("keepHeadingInPlace", () => {
	it("pulls a heading that came unpinned back under the pointer", () => {
		// The case it is for. Parked on the pane's top edge at 0; folded, it
		// stops being stuck and falls back to its flow position 400px above the
		// fold. Scrolling back by that 400 is what puts it where it was clicked.
		const { headingEl, scroller, setTop } = rig();
		setTop(0);
		keepHeadingInPlace(headingEl, () => setTop(-400));
		assert.strictEqual(
			scroller.scrollTop,
			600,
			"the heading moved up 400, so the scroller has to come back 400 — " +
				"the other sign would shove it a further 400 off the top",
		);
	});

	it("leaves a heading that did not move alone", () => {
		// Every fold that is not of a pinned heading: the section below the
		// heading changes, the heading itself does not, and there is nothing to
		// correct. This is what lets the anchor sit on the shared toggle rather
		// than only on the three sticky headings.
		const { headingEl, scroller, setTop } = rig();
		setTop(220);
		keepHeadingInPlace(headingEl, () => setTop(220));
		assert.strictEqual(scroller.scrollTop, 1000);
	});

	it("leaves the browser's own scroll clamp alone", () => {
		// Folding near the bottom makes the page shorter, and the browser pulls
		// `scrollTop` back to the new maximum by itself — which moves everything
		// *down*, the opposite sign. It has already done the right thing by the
		// time the second reading is taken, so the correction stays out of it.
		const { headingEl, scroller, setTop } = rig();
		setTop(0);
		keepHeadingInPlace(headingEl, () => setTop(120));
		assert.strictEqual(scroller.scrollTop, 1000);
	});

	it("still folds where there is nothing to measure with", () => {
		// The suites run against a DOM with no layout at all, so
		// `getBoundingClientRect` is simply absent. That has to be a no-op and
		// not a throw, or every fold test in the repo dies on a missing method.
		const { headingEl, scroller } = rig(false);
		let folded = false;
		keepHeadingInPlace(headingEl, () => {
			folded = true;
		});
		assert.strictEqual(folded, true, "the fold itself must still happen");
		assert.strictEqual(scroller.scrollTop, 1000);
	});

	it("folds a heading that is in nothing scrollable", () => {
		// A disclosure built outside the settings pane — no scroll parent to
		// correct against, and no reason to look further than saying so.
		const detached = createDiv();
		const headingEl = detached.createDiv({ cls: "cs-sticky-heading" });
		let top = 0;
		headingEl.getBoundingClientRect = () => ({ top }) as unknown as DOMRect;
		let folded = false;
		keepHeadingInPlace(headingEl, () => {
			folded = true;
			top = -400;
		});
		assert.strictEqual(folded, true);
	});
});
