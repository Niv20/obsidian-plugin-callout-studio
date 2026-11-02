/**
 * tests/portableTickAnimation.test.ts — a tick box that changes in Review
 * conversion starts from how it was (portable/portableConversionRows.ts).
 *
 * The rows are drawn again from nothing on every change, so a box that is new
 * has no "before" for styles.css to animate from. The renderer therefore draws
 * a box whose answer changed as it was last drawn, reads a measurement once so
 * the browser works that look out, and only then turns the box over. These tests
 * stand in for the browser: reading `offsetWidth` is when they take a snapshot.
 */
import { asEl, el, type FakeElement } from "./support/fakeDom";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderPortableConversionRows, portableConversionRows } from "../src/portable/portableConversionRows";
import type { PortableCalloutConversionPlan } from "../src/utils/portableCalloutVault";

/** A plan of three changes in one note, with `selected` ticked. */
function plan(selected: string[]): PortableCalloutConversionPlan {
	const changes = ["x1", "x2", "x3"].map((id, index) => ({
		id, path: "a.md", line: index + 1, before: "[!note]", after: "note", sourceLine: "[!note]", from: 0, to: 7,
		headingLine: false, contentFingerprint: id, replacement: "note", defaultReplacement: "note", custom: false,
		edits: [], count: 1, headings: 0, inline: 1,
	}));
	return { recovery: false, changes, selectedIds: selected, linkChanges: [], blockedChanges: [], skipped: 0, count: selected.length } as unknown as PortableCalloutConversionPlan;
}

/** A list the renderer draws into, recording what the boxes look like each time it reads a measurement. */
function list() {
	const root = el();
	const snapshots: boolean[][] = [];
	const boxes = (): (FakeElement & { checked: boolean })[] => root.querySelectorAll("input") as (FakeElement & { checked: boolean })[];
	Object.defineProperty(root, "offsetWidth", { get: () => { snapshots.push(boxes().map(box => box.checked)); return 0; } });
	const draw = (selected: string[]): void => {
		const p = plan(selected);
		renderPortableConversionRows(asEl(root), p, portableConversionRows(p), 100, false, undefined, () => {});
	};
	return { draw, snapshots, boxes, ticks: () => boxes().map(box => box.checked) };
}

describe("tick boxes that change", () => {
	it("are not animated the first time the list is drawn", () => {
		const { draw, snapshots, ticks } = list();
		draw(["x1", "x2"]);
		assert.deepEqual(ticks(), [true, true, false]);
		assert.deepEqual(snapshots, [], "nothing to animate from, so nothing to measure");
	});

	it("are drawn as they were, measured once, and then turned over", () => {
		const { draw, snapshots, ticks } = list();
		draw(["x1", "x2"]);
		draw(["x2", "x3"]);
		assert.deepEqual(snapshots, [[true, true, false]], "one measurement, with the changed boxes still as they were");
		assert.deepEqual(ticks(), [false, true, true], "and then as they are now");
	});

	it("are left alone when nothing changed", () => {
		const { draw, snapshots, ticks } = list();
		draw(["x2"]);
		draw(["x2"]);
		assert.deepEqual(snapshots, []);
		assert.deepEqual(ticks(), [false, true, false]);
	});

	it("go from what was drawn, not from what the page says now: a click has turned the old box over already", () => {
		const { draw, snapshots, boxes, ticks } = list();
		draw([]);
		// What a click on the first box does before anything is drawn again.
		boxes()[0]!.checked = true;
		draw(["x1"]);
		assert.deepEqual(snapshots, [[false, false, false]], "the new box starts empty, then ticks");
		assert.deepEqual(ticks(), [true, false, false]);
	});
});
