/**
 * Parking far file groups (ui/sidebarParking.ts). Every element drawn anywhere
 * in the window slows each key press in the editor, and a Find callouts list
 * that had grown to thousands of rows made the keys that enter or leave a
 * callout stick. A group more than a screen from the visible part of the list
 * keeps its height but not its rows; scrolling towards it draws it again.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PARKED_CLASS, SidebarParking, unparkGroupOf } from "../src/ui/sidebarParking";
import { SidebarFold } from "../src/ui/sidebarFold";
import { createSidebarFileGroup, revealSidebarCard } from "../src/ui/sidebarResults";
import { installFakeDom } from "./support/fakeDom";

const dom = installFakeDom();

/** What the browser reports about one group: is it near the screen, and how tall is it. */
interface FakeEntry {
	target: unknown;
	isIntersecting: boolean;
	boundingClientRect: { height: number };
}

/** A stand-in IntersectionObserver that lets a test say what the browser reports. */
class FakeObserver {
	static all: FakeObserver[] = [];
	readonly targets: unknown[] = [];
	disconnected = false;
	constructor(
		readonly callback: (entries: FakeEntry[]) => void,
		readonly options: { root?: unknown; rootMargin?: string },
	) {
		FakeObserver.all.push(this);
	}
	observe(target: unknown): void {
		this.targets.push(target);
	}
	disconnect(): void {
		this.disconnected = true;
	}
	report(entries: FakeEntry[]): void {
		this.callback(entries);
	}
}

/** Run `body` with the fake window able to watch, then take that away again. */
function withObserver(body: () => void): void {
	const view = dom.document.defaultView as unknown as Record<string, unknown>;
	view.IntersectionObserver = FakeObserver;
	FakeObserver.all = [];
	try {
		body();
	} finally {
		delete view.IntersectionObserver;
	}
}

/** A scroller (a laid-out one, `clientHeight` tall) holding a list of `count` note groups. */
function drawList(count: number, clientHeight = 400) {
	const scroller = dom.document.createElement("div") as unknown as HTMLElement;
	Object.defineProperty(scroller, "clientHeight", { value: clientHeight });
	const list = scroller.createDiv();
	const fold = new SidebarFold();
	const groups = Array.from({ length: count }, (_, i) =>
		createSidebarFileGroup(list, { path: `note ${i}.md`, count: 1, fold }),
	);
	return { scroller, list, groups, sections: groups.map((group) => group.section) };
}

const sizeOf = (section: HTMLElement): string =>
	(section as unknown as { getCssPropertyValue(name: string): string }).getCssPropertyValue("--cs-parked-size");
const reportFor = (target: HTMLElement, isIntersecting: boolean, height = 120): FakeEntry => ({
	target,
	isIntersecting,
	boundingClientRect: { height },
});

describe("parking file groups that are far from the screen", () => {
	it("watches the groups straight inside the list, within a screen of the scroller's edge", () => {
		withObserver(() => {
			const { scroller, list, sections } = drawList(3);
			list.createDiv({ cls: "cs-load-more-sentinel" });
			new SidebarParking(() => scroller).watch(list);
			const observer = FakeObserver.all[0]!;
			assert.equal(observer.options.root, scroller, "measured inside the list's own scroller");
			assert.equal(observer.options.rootMargin, "100% 0px 100% 0px", "a screen above and a screen below");
			assert.deepEqual(observer.targets, sections, "the groups, not the end marker");
		});
	});

	it("parks a group that leaves the screen at the height it had, and draws it again when it comes back", () => {
		withObserver(() => {
			const { scroller, list, sections } = drawList(2);
			new SidebarParking(() => scroller).watch(list);
			const observer = FakeObserver.all[0]!;
			const [first, second] = sections as [HTMLElement, HTMLElement];
			observer.report([reportFor(first, true, 90), reportFor(second, false, 240)]);
			assert.equal(first.hasClass(PARKED_CLASS), false, "near the screen: drawn");
			assert.equal(second.hasClass(PARKED_CLASS), true, "far from the screen: parked");
			assert.equal(sizeOf(second), "240px", "keeps the height it measured, so nothing else moves");
			// Reported again while it is far: nothing to do.
			observer.report([reportFor(second, false, 1)]);
			assert.equal(sizeOf(second), "240px", "the parked box's own height is not measured again");
			observer.report([reportFor(second, true, 240)]);
			assert.equal(second.hasClass(PARKED_CLASS), false);
			assert.equal(sizeOf(second), "", "its own height again");
		});
	});

	it("leaves a group alone that has no height, that holds the focus, or that a redraw already threw away", () => {
		withObserver(() => {
			const { scroller, list, sections, groups } = drawList(3);
			new SidebarParking(() => scroller).watch(list);
			const [unmeasured, focused, gone] = sections as [HTMLElement, HTMLElement, HTMLElement];
			(groups[1]!.link as unknown as { focus(): void }).focus();
			gone.remove();
			FakeObserver.all[0]!.report([
				reportFor(unmeasured, false, 0),
				reportFor(focused, false),
				reportFor(gone, false),
			]);
			assert.equal(
				unmeasured.hasClass(PARKED_CLASS),
				false,
				"not laid out: there is nothing to keep the height of",
			);
			assert.equal(focused.hasClass(PARKED_CLASS), false, "an element that is not drawn cannot keep the focus");
			assert.equal(gone.hasClass(PARKED_CLASS), false);
		});
	});

	it("parks nothing from a hidden sidebar tab, which lays out at zero height", () => {
		withObserver(() => {
			const { scroller, list, sections } = drawList(1, 0);
			new SidebarParking(() => scroller).watch(list);
			FakeObserver.all[0]!.report([reportFor(sections[0]!, false)]);
			assert.equal(sections[0]!.hasClass(PARKED_CLASS), false, "nothing is near anything there");
		});
	});

	it("lets go of the old groups on every redraw and on stop, and does nothing where the window cannot watch", () => {
		withObserver(() => {
			const { scroller, list } = drawList(2);
			const parking = new SidebarParking(() => scroller);
			parking.watch(list);
			parking.watch(list);
			assert.equal(FakeObserver.all[0]!.disconnected, true, "the groups it watched are gone after a redraw");
			assert.equal(FakeObserver.all.length, 2);
			parking.stop();
			assert.equal(FakeObserver.all[1]!.disconnected, true);
		});
		// Outside withObserver the window has no IntersectionObserver, as in the tests' own windows.
		FakeObserver.all = [];
		const { scroller, list } = drawList(2);
		new SidebarParking(() => scroller).watch(list);
		assert.equal(FakeObserver.all.length, 0, "every group stays drawn");
		new SidebarParking(() => null).watch(list);
	});
});

describe("drawing a parked group again before it is measured", () => {
	it("draws the group of any element inside it, and only a parked one", () => {
		withObserver(() => {
			const { scroller, list, groups, sections } = drawList(2);
			new SidebarParking(() => scroller).watch(list);
			const row = groups[1]!.matches.createDiv();
			FakeObserver.all[0]!.report([reportFor(sections[1]!, false, 300)]);
			assert.equal(sections[1]!.hasClass(PARKED_CLASS), true);
			unparkGroupOf(groups[0]!.matches.createDiv());
			assert.equal(sections[1]!.hasClass(PARKED_CLASS), true, "another group's row does not draw it");
			unparkGroupOf(row);
			assert.equal(sections[1]!.hasClass(PARKED_CLASS), false);
			assert.equal(sizeOf(sections[1]!), "");
			unparkGroupOf(row);
			unparkGroupOf(null);
		});
	});

	it("is done by revealSidebarCard, so a row in a parked group can be scrolled to", () => {
		withObserver(() => {
			const { scroller, list, groups, sections } = drawList(1);
			new SidebarParking(() => scroller).watch(list);
			const row = groups[0]!.matches.createDiv();
			FakeObserver.all[0]!.report([reportFor(sections[0]!, false, 300)]);
			assert.equal(sections[0]!.hasClass(PARKED_CLASS), true);
			// A scroller 100px tall at the top of the page; the row is 500px down once its group is drawn.
			Object.assign(scroller, {
				clientTop: 0,
				scrollTop: 0,
				getBoundingClientRect: () => ({ top: 0, bottom: 100 }),
			});
			Object.assign(row, {
				getBoundingClientRect: () =>
					sections[0]!.hasClass(PARKED_CLASS) ? { top: 0, bottom: 0 } : { top: 500, bottom: 520 },
			});
			revealSidebarCard(scroller, row);
			assert.equal(sections[0]!.hasClass(PARKED_CLASS), false, "drawn again first");
			assert.ok(scroller.scrollTop > 0, "then measured where it really is, and scrolled to");
		});
	});
});
