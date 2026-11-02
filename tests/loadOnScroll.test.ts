/**
 * Loading results as the list scrolls (ui/loadOnScroll.ts, finding S10-07):
 * the list ends in an empty marker instead of "Show 100 more", and the next
 * page is drawn when the marker comes within a screen of view. Where the
 * window cannot watch the marker, the list keeps its button.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canLoadOnScroll, LoadOnScroll, LOAD_MORE_SENTINEL } from "../src/ui/loadOnScroll";
import { OccurrenceResults } from "../src/usage/occurrenceResults";
import { scanCalloutOccurrences } from "../src/usage/scanCalloutOccurrences";
import { installFakeDom } from "./support/fakeDom";

const dom = installFakeDom();

/** A stand-in IntersectionObserver that lets a test say when its target comes into view. */
class FakeObserver {
	static all: FakeObserver[] = [];
	readonly targets: unknown[] = [];
	disconnected = false;
	constructor(
		readonly callback: (entries: Array<{ isIntersecting: boolean }>) => void,
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
	/** The marker came within reach (or not). */
	fire(isIntersecting: boolean): void {
		this.callback([{ isIntersecting }]);
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

describe("loading results as the list scrolls", () => {
	it("keeps the Show more button where the window cannot watch the list's end", () => {
		const content = dom.document.createElement("div") as unknown as HTMLElement;
		assert.equal(canLoadOnScroll(content.ownerDocument), false);
		const cards = new OccurrenceResults(100);
		cards.render(
			content,
			scanCalloutOccurrences("a.md", "[!note]\n".repeat(150)),
			100,
			true,
			() => {},
			() => {},
		);
		assert.ok(content.querySelector('button[data-action="more"]'));
		assert.equal(cards.sentinel, null);
	});

	it("ends the list in an empty marker instead of a button, and none once everything is drawn", () => {
		withObserver(() => {
			const content = dom.document.createElement("div") as unknown as HTMLElement;
			const cards = new OccurrenceResults(100);
			const results = scanCalloutOccurrences("a.md", "[!note]\n".repeat(150));
			cards.render(
				content,
				results,
				100,
				true,
				() => {},
				() => {},
			);
			assert.equal(content.querySelector('button[data-action="more"]'), null, "no button to press");
			assert.ok(cards.sentinel?.classList.contains(LOAD_MORE_SENTINEL));
			assert.equal(cards.sentinel?.getAttribute("aria-hidden"), "true");
			assert.equal(content.lastElementChild, cards.sentinel, "at the very end of the list");
			cards.render(
				content,
				results,
				200,
				true,
				() => {},
				() => {},
			);
			assert.equal(cards.sentinel, null, "all 150 drawn: nothing left to load");
		});
	});

	it("loads the next page when the marker comes within a screen of view, once per marker", () => {
		withObserver(() => {
			const scroller = dom.document.createElement("div") as unknown as HTMLElement;
			Object.defineProperty(scroller, "clientHeight", { value: 400 });
			let loads = 0;
			const loader = new LoadOnScroll(
				() => scroller,
				() => {
					loads++;
				},
			);
			const sentinel = dom.document.createElement("div") as unknown as HTMLElement;
			loader.watch(sentinel);
			const observer = FakeObserver.all[0]!;
			assert.equal(observer.options.root, scroller, "watched inside the list's own scroller");
			assert.equal(observer.options.rootMargin, "0px 0px 100% 0px", "a screen early");
			assert.deepEqual(observer.targets, [sentinel]);
			observer.fire(false);
			assert.equal(loads, 0, "not yet in reach");
			observer.fire(true);
			assert.equal(loads, 1);
			assert.equal(observer.disconnected, true, "let go before the next page is drawn");
		});
	});

	it("never loads from a hidden tab, and lets go of an old marker on every redraw and on stop", () => {
		withObserver(() => {
			const scroller = dom.document.createElement("div") as unknown as HTMLElement;
			Object.defineProperty(scroller, "clientHeight", { value: 0 });
			let loads = 0;
			const loader = new LoadOnScroll(
				() => scroller,
				() => {
					loads++;
				},
			);
			loader.watch(dom.document.createElement("div") as unknown as HTMLElement);
			FakeObserver.all[0]!.fire(true);
			assert.equal(loads, 0, "a hidden tab lays out at zero height: nothing is being scrolled");
			loader.watch(dom.document.createElement("div") as unknown as HTMLElement);
			assert.equal(FakeObserver.all[0]!.disconnected, true);
			loader.watch(null);
			assert.equal(FakeObserver.all[1]!.disconnected, true, "everything drawn: nothing watched");
			assert.equal(FakeObserver.all.length, 2);
		});
	});
});
