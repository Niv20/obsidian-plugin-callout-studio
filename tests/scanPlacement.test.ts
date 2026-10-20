/**
 * tests/scanPlacement.test.ts — when **Scan for callouts** leaves the "My
 * callout types" heading for the foot of the list.
 *
 * The fake DOM has no layout, so the heading's two boxes are given one here: the
 * control shares the title's line unless `room` says the line cannot hold the
 * title and both buttons — and only while Scan is actually laid out in the
 * heading. With Scan gone the line always has room, which is the trap: an
 * answer read off that state brings Scan straight back, and the heading flips
 * on every frame.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { followScanPlacement } from "../src/settings/sections/scanPlacement";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { installFakeDom } from "./support/fakeDom";

const turn = (): Promise<void> => Promise.resolve();

function harness(withObserver = true) {
	const dom = installFakeDom();
	let resize = (): void => {};
	const observed: unknown[] = [];
	let disconnected = false;
	class Observer {
		constructor(callback: () => void) { resize = callback; }
		observe(element: unknown): void { observed.push(element); }
		disconnect(): void { disconnected = true; }
	}
	if (withObserver) Object.assign(dom.window, { ResizeObserver: Observer });

	const disposers: (() => void)[] = [];
	const ctx = {
		registerDisposer: (dispose: () => void) => disposers.push(dispose),
	} as unknown as SettingsSectionContext;

	const pane = dom.document.body.createDiv();
	const titleRow = pane.createDiv({ cls: "setting-item cs-header-row" });
	const section = pane.createDiv({ cls: "cs-sticky-section" });
	const heading = section.createDiv({ cls: "setting-item cs-callout-list-heading" });
	const info = heading.createDiv({ cls: "setting-item-info" });
	const control = heading.createDiv({ cls: "setting-item-control" });

	const layout = { room: true, laidOut: true, readings: [] as boolean[] };
	const base = info.getBoundingClientRect();
	const box = (top: number, height: number): DOMRect =>
		layout.laidOut
			? { ...base, top, bottom: top + height, height }
			: { ...base, top: 0, bottom: 0, height: 0, width: 0 };
	const scanInHeading = (): boolean =>
		heading.hasClass("cs-scan-measure") || !section.hasClass("cs-scan-below");
	info.getBoundingClientRect = () => {
		layout.readings.push(heading.hasClass("cs-scan-measure"));
		return box(10, 22);
	};
	// Centred beside a shorter title on one line; under it, past the row gap, on two.
	control.getBoundingClientRect = () =>
		box(layout.room || !scanInHeading() ? 6 : 40, 30);

	const placement = followScanPlacement(
		ctx,
		section as unknown as HTMLElement,
		heading as unknown as HTMLElement,
		titleRow as unknown as HTMLElement,
	);
	return {
		dom, section, heading, titleRow, layout, placement, observed,
		resize: () => resize(),
		dispose: () => { for (const d of disposers) d(); },
		disconnected: () => disconnected,
	};
}

const below = (h: ReturnType<typeof harness>): boolean => h.section.hasClass("cs-scan-below");

describe("Scan's place follows the room on the heading's line", () => {
	it("goes under the list when the line cannot hold it, and stays there", async () => {
		const h = harness();
		try {
			await turn();
			assert.equal(below(h), false, "a line with room lost its Scan");

			h.layout.room = false;
			h.resize();
			assert.equal(below(h), true);
			// Without Scan the line has room. Read that, and Scan comes back, the
			// line overflows, and Scan goes again — every frame.
			h.resize();
			h.resize();
			assert.equal(below(h), true, "Scan came back to a line that cannot hold it");

			h.layout.room = true;
			h.resize();
			assert.equal(below(h), false, "a widened pane did not bring Scan back");
		} finally { h.dom.restore(); }
	});

	it("reads the heading with Scan laid out, and leaves it as it was", async () => {
		const h = harness();
		try {
			h.layout.room = false;
			h.resize();
			h.resize();
			await turn();
			assert.ok(h.layout.readings.length >= 3);
			assert.ok(h.layout.readings.every(Boolean), "a reading was taken without Scan in the heading");
			assert.equal(h.heading.hasClass("cs-scan-measure"), false, "the measuring state was left on");
		} finally { h.dom.restore(); }
	});

	it("watches the tab's title row, not the heading it moves Scan out of", () => {
		const h = harness();
		try {
			// The heading changes height when Scan moves, and an observer whose
			// target resizes inside its own callback reports a loop error.
			assert.deepEqual(h.observed, [h.titleRow]);
		} finally { h.dom.restore(); }
	});

	it("keeps its last answer while nothing is laid out", () => {
		const h = harness();
		try {
			h.layout.room = false;
			h.resize();
			assert.equal(below(h), true);
			h.layout.laidOut = false;
			h.resize();
			assert.equal(below(h), true, "a tab with no layout was read as having room");
		} finally { h.dom.restore(); }
	});

	it("asks after the build, once, when the painter changes the title", async () => {
		const h = harness();
		try {
			await turn();
			const before = h.layout.readings.length;
			h.layout.room = false;
			h.placement.request();
			h.placement.request();
			// Not during the call: the painter runs inside `display()`, before the
			// sections under it exist, and a layout read there is of half a page.
			assert.equal(h.layout.readings.length, before, "the layout was read mid-build");
			assert.equal(below(h), false);
			await turn();
			assert.equal(h.layout.readings.length, before + 1, "two requests in one turn read twice");
			assert.equal(below(h), true);
		} finally { h.dom.restore(); }
	});

	it("stops with the tab", async () => {
		const h = harness();
		try {
			await turn();
			h.dispose();
			assert.equal(h.disconnected(), true);
			h.layout.room = false;
			h.resize();
			h.placement.request();
			await turn();
			assert.equal(below(h), false, "a disposed tab went on measuring");
		} finally { h.dom.restore(); }
	});

	it("still places Scan where ResizeObserver is missing", async () => {
		const h = harness(false);
		try {
			h.layout.room = false;
			h.placement.request();
			await turn();
			assert.equal(below(h), true);
		} finally { h.dom.restore(); }
	});
});
