/**
 * tests/menuScroll.test.ts — a long Obsidian menu scrolls with the wheel and
 * not with the mouse (ui/menuScroll.ts).
 *
 * Obsidian's own listeners are what move the list by themselves (a `mousemove`
 * on the list that sets the scroll from the pointer's height; a hover that
 * scrolls the row into view). The fix is a pair of listeners around them, so
 * these tests stand in for a browser: they run the capture listeners, then a
 * pretend Obsidian listener, then the bubble listeners, in the order a browser
 * would, and look at where the list ended up.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findOpenMenu, scrollMenuWithWheel } from "../src/ui/menuScroll";
import { asEl, fakeDom } from "./support/fakeDom";

interface Listener {
	type: string;
	capture: boolean;
	run: () => void;
}

/** A menu with a list of `rows` rows, 30px tall each, in a 200px window on the list. */
function menu(rowCount = 20) {
	const listeners: Listener[] = [];
	const classes = new Set<string>();
	const rows = Array.from({ length: rowCount }, (_, index) => ({
		index,
		getBoundingClientRect: () => ({ top: index * 30 - scroller.scrollTop, height: 30 }),
	}));
	const scroller = {
		scrollTop: 0,
		scrollHeight: rowCount * 30,
		clientHeight: 200,
		getBoundingClientRect: () => ({ top: 0, height: 200 }),
		querySelectorAll: () => rows,
	};
	const menuEl = {
		addClass: (cls: string) => classes.add(cls),
		querySelector: () => scroller,
		addEventListener: (type: string, run: () => void, capture?: boolean) =>
			listeners.push({ type, capture: capture === true, run }),
	};
	/** What a browser does for one event: capture listeners, Obsidian's, then bubble listeners. */
	function dispatch(type: string, obsidianDoes: () => void): void {
		for (const l of listeners) if (l.type === type && l.capture) l.run();
		obsidianDoes();
		for (const l of listeners) if (l.type === type && !l.capture) l.run();
	}
	return { menuEl: menuEl as unknown as HTMLElement, scroller, classes, listeners, dispatch };
}

describe("a menu that scrolls with the wheel", () => {
	it("is marked so styles.css can make its list scrollable", () => {
		const { menuEl, classes } = menu();
		scrollMenuWithWheel(menuEl, 0);
		assert.ok(classes.has("cs-wheel-menu"));
	});

	it("undoes the scroll Obsidian sets from the pointer's height", () => {
		const { menuEl, scroller, dispatch } = menu();
		scrollMenuWithWheel(menuEl, 0);
		scroller.scrollTop = 40; // the wheel got us here
		dispatch("mousemove", () => {
			scroller.scrollTop = 310;
		}); // Obsidian's `ME()` scrub
		assert.equal(scroller.scrollTop, 40);
	});

	it("undoes the scroll that landing on a half-hidden row causes", () => {
		const { menuEl, scroller, dispatch } = menu();
		scrollMenuWithWheel(menuEl, 0);
		scroller.scrollTop = 40;
		dispatch("pointerover", () => {
			scroller.scrollTop = 52;
		}); // `Menu.select` → scrollIntoView
		assert.equal(scroller.scrollTop, 40);
	});

	it("leaves the wheel, and a pointer that moves nothing, alone", () => {
		const { menuEl, scroller, dispatch } = menu();
		scrollMenuWithWheel(menuEl, 0);
		scroller.scrollTop = 40;
		dispatch("mousemove", () => {});
		assert.equal(scroller.scrollTop, 40);
		// A wheel step lands between two moves: the next move keeps the new place.
		scroller.scrollTop = 90;
		dispatch("mousemove", () => {
			scroller.scrollTop = 0;
		});
		assert.equal(scroller.scrollTop, 90);
	});

	it("writes the position down before Obsidian's listener, and puts it back after", () => {
		const { menuEl, listeners } = menu();
		scrollMenuWithWheel(menuEl, 0);
		for (const type of ["mousemove", "pointerover"]) {
			const own = listeners.filter((l) => l.type === type);
			assert.deepEqual(
				own.map((l) => l.capture),
				[true, false],
				`${type}: capture first, bubble second`,
			);
		}
	});

	it("opens a long list on the current choice, in the middle", () => {
		const { menuEl, scroller } = menu(20);
		scrollMenuWithWheel(menuEl, 10);
		// Row 10 spans 300–330; centred in 200px that is a scroll of 300 + 15 − 100.
		assert.equal(scroller.scrollTop, 215);
	});

	it("does not scroll a list that already fits", () => {
		const { menuEl, scroller } = menu(5);
		scroller.scrollHeight = 150;
		scrollMenuWithWheel(menuEl, 4);
		assert.equal(scroller.scrollTop, 0);
	});

	it("does nothing where Obsidian drew no list", () => {
		const bare = { addClass: () => assert.fail("marked a menu with no list"), querySelector: () => null };
		scrollMenuWithWheel(bare as unknown as HTMLElement, 0);
	});
});

describe("finding the menu that was just opened", () => {
	it("is the newest `.menu` on the page, and null when there is none", () => {
		const page = fakeDom.document;
		const doc = page as unknown as Document;
		assert.equal(findOpenMenu(doc), null);
		const first = page.body.createDiv({ cls: "menu" });
		const second = page.body.createDiv({ cls: "menu" });
		// Obsidian adds the menu's backdrop right after it; it is not a menu.
		page.body.createDiv({ cls: "suggestion-bg" });
		assert.notEqual(first, second);
		assert.equal(findOpenMenu(doc), asEl(second));
	});
});
