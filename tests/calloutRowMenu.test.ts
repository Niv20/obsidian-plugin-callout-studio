import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rowMenuHarness, settleMenu } from "./support/calloutRowMenuHarness";
import { fakeDom } from "./support/fakeDom";

type Harness = ReturnType<typeof rowMenuHarness>;

describe("callout row menu lifetime", () => {
	it("shows ready counts in the click stack and keeps the click's owner window", async () => {
		const h = rowMenuHarness();
		await h.ready();
		const opening = h.open();
		assert.equal(h.builds(), 1, "a ready menu does not yield before showing");
		assert.equal(h.menu().shown, true);
		assert.equal(h.menu().showEvent, h.event);
		assert.equal(h.reads(), 1);
		await opening;
		h.cleanup();
		h.assertClean();
	});

	for (const axis of ["vertical", "horizontal RTL"] as const) {
		it(`dismisses on actual ${axis} ancestor scroll and leaves scrolling untouched`, async () => {
			const h = rowMenuHarness();
			await h.ready();
			await h.open();
			h.scroll(h.scroller, axis === "vertical" ? 75 : 0, axis === "horizontal RTL" ? -25 : 0);
			assert.equal(h.menu().shown, false);
			assert.equal(h.menu().hideCalls, 1);
			assert.equal(h.scroller.scrollTop, axis === "vertical" ? 75 : 0);
			h.assertClean();
			h.cleanup();
		});
	}

	it("closes for an outer ancestor as well as the callout list", async () => {
		const h = rowMenuHarness();
		await h.ready();
		await h.open();
		h.scroll(h.outer);
		assert.equal(h.menu().shown, false);
		h.assertClean();
		h.cleanup();
	});

	it("maps document scroll events to the document's scrolling element", async () => {
		const h = rowMenuHarness();
		await h.ready();
		await h.open();
		h.document.documentElement.scrollTop = 100;
		h.document.fire("scroll", { target: h.document });
		assert.equal(h.menu().shown, false);
		h.assertClean();
		h.cleanup();
	});

	it("ignores a queued scroll whose position has not changed since opening", async () => {
		const h = rowMenuHarness();
		h.scroller.scrollTop = 45;
		await h.ready();
		await h.open();
		h.scroll(h.scroller, 45);
		assert.equal(h.menu().shown, true);
		h.scroll(h.scroller, 46);
		assert.equal(h.menu().shown, false);
		h.cleanup();
	});

	it("allows scrolling the menu, a submenu, another settings section and a row child", async () => {
		const h = rowMenuHarness();
		await h.ready();
		await h.open();
		const menu = h.document.body.createDiv({ cls: "menu" });
		const submenu = menu.createDiv({ cls: "menu-submenu" });
		const sibling = h.outer.createDiv();
		const preview = h.row.createDiv();
		for (const scroller of [menu, submenu, sibling, preview]) {
			h.scroll(scroller);
			assert.equal(h.menu().shown, true);
		}
		h.document.flushMutations();
		assert.equal(h.menu().shown, true, "unrelated DOM updates leave the anchor intact");
		h.cleanup();
	});

	it("keeps an open menu for pointer, touch, wheel and scroll keys without movement", async () => {
		const h = rowMenuHarness();
		await h.ready();
		await h.open();
		for (const type of ["pointerdown", "touchstart", "touchmove", "wheel", "keydown"]) {
			h.document.fire(type, { type, target: h.scroller, key: "PageDown" });
			assert.equal(h.menu().shown, true, `${type} is not proof of scrolling`);
		}
		h.cleanup();
	});

	const changes: Array<[string, (h: Harness) => void]> = [
		["window resize", (h) => h.view.fire("resize")],
		["tablet orientation change", (h) => h.view.fire("orientationchange")],
		["visual viewport resize", (h) => { h.view.visualViewport.height -= 10; h.view.fire("visualViewport:resize"); }],
		["visual viewport movement", (h) => {
			Object.assign(h.view.visualViewport, { offsetTop: 10 }); h.view.fire("visualViewport:scroll");
		}],
		["settings disposal", (h) => h.dispose()],
		["button removal", (h) => { h.anchor.isConnected = false; h.anchor.remove(); h.document.flushMutations(); }],
		["button reparenting", (h) => { h.outer.appendChild(h.anchor); h.document.flushMutations(); }],
		["a refresh moving the row", (h) => {
			const previous = h.anchor.getBoundingClientRect();
			h.anchor.getBoundingClientRect = () => ({ ...previous, top: previous.top + 20 });
			h.scroller.createDiv();
			h.document.flushMutations();
		}],
	];
	for (const [label, change] of changes) {
		it(`dismisses an open menu on ${label}`, async () => {
			const h = rowMenuHarness();
			await h.ready();
			await h.open();
			change(h);
			assert.equal(h.menu().shown, false);
			h.assertClean();
			h.cleanup();
		});
		it(`cancels a pending menu on ${label} without allowing it to appear later`, async () => {
			const h = rowMenuHarness();
			const opening = h.open();
			await settleMenu();
			change(h);
			await opening;
			assert.equal(h.builds(), 0);
			h.assertClean();
			h.view.flushTimers();
			h.release();
			await h.index.ensureFresh();
			assert.equal(h.builds(), 0);
			h.cleanup();
		});
	}

	it("cancels a pending menu when scrolling starts while usage counts are loading", async () => {
		const h = rowMenuHarness();
		const opening = h.open();
		await settleMenu();
		h.scroll(h.scroller);
		await opening;
		assert.equal(h.builds(), 0);
		h.assertClean();
		h.release();
		await h.index.ensureFresh();
		assert.equal(h.builds(), 0);
		h.cleanup();
	});

	it("ignores unchanged and unrelated scroll while preparing counts", async () => {
		const h = rowMenuHarness();
		const opening = h.open();
		h.scroll(h.scroller, 0);
		h.scroll(h.outer.createDiv());
		h.release();
		await opening;
		assert.equal(h.builds(), 1);
		assert.equal(h.menu().shown, true);
		h.cleanup();
	});

	it("ignores queued viewport notifications with unchanged geometry while pending and open", async () => {
		const h = rowMenuHarness();
		const opening = h.open();
		h.view.fire("visualViewport:scroll");
		h.view.fire("visualViewport:resize");
		h.release();
		await opening;
		assert.equal(h.builds(), 1);
		h.view.fire("visualViewport:scroll");
		h.view.fire("visualViewport:resize");
		assert.equal(h.menu().shown, true);
		h.cleanup();
	});

	for (const [label, cancel] of changes.filter(([name]) => name !== "button removal")) {
		it(`honors ${label} after readiness resolves but before its await resumes`, async () => {
			const h = rowMenuHarness();
			const opening = h.open();
			const unsubscribe = h.index.subscribe(() => { if (h.index.status === "ready") cancel(h); });
			h.release();
			await opening;
			assert.equal(h.builds(), 0, "same-notification invalidation must win over readiness");
			h.assertClean();
			unsubscribe();
			h.cleanup();
		});
	}

	it("honors ancestor scroll after readiness but before the waiting click resumes", async () => {
		const h = rowMenuHarness();
		const opening = h.open();
		const unsubscribe = h.index.subscribe(() => { if (h.index.status === "ready") h.scroll(h.scroller); });
		h.release();
		await opening;
		assert.equal(h.builds(), 0);
		h.assertClean();
		unsubscribe();
		h.cleanup();
	});

	it("keeps only the newest menu, including when the first request is still pending", async () => {
		const h = rowMenuHarness();
		const first = h.open();
		const second = h.open();
		await first;
		assert.equal(h.builds(), 0);
		h.release();
		await second;
		assert.equal(h.builds(), 1);
		const oldMenu = h.menu();
		await h.open();
		assert.equal(oldMenu.shown, false);
		assert.equal(oldMenu.hideCalls, 1);
		assert.equal(h.menu().shown, true);
		h.scroll(h.scroller);
		assert.equal(h.menu().shown, false, "old cleanup does not remove the newer menu's hooks");
		h.assertClean();
		h.cleanup();
	});

	it("preserves the usage item's hide callback and removes its count subscription", async () => {
		const h = rowMenuHarness();
		await h.ready();
		await h.open();
		const menu = h.menu();
		assert.equal(menu.items.length, 1);
		assert.equal(h.subscriptions(), 1);
		const changesBeforeHide = menu.items[0]!.titles.length;
		h.scroll(h.scroller);
		assert.equal(h.subscriptions(), 0, "hide really unsubscribes, rather than leaving an inactive listener");
		h.index.invalidate();
		assert.equal(menu.items[0]!.titles.length, changesBeforeHide);
		h.assertClean();
		h.cleanup();
	});

	it("cleans its hooks on natural menu hide without calling hide recursively", async () => {
		const h = rowMenuHarness();
		await h.ready();
		let hidden = 0;
		await h.open((menu) => menu.onHide(() => { hidden++; }));
		h.menu().hide();
		assert.equal(hidden, 1);
		assert.equal(h.menu().hideCalls, 1);
		h.assertClean();
		h.dispose();
		assert.equal(h.menu().hideCalls, 1);
		h.cleanup();
	});

	it("uses only the owner document when another window is active", async () => {
		const h = rowMenuHarness();
		await h.ready();
		await h.open();
		fakeDom.document.fire("scroll", { type: "scroll", target: fakeDom.document.body });
		fakeDom.document.fire("pointerdown", { target: fakeDom.document.body });
		assert.equal(h.menu().shown, true);
		h.view.fire("resize");
		assert.equal(h.menu().shown, false);
		h.assertClean();
		h.cleanup();
	});

	it("cleans a menu hidden before Obsidian has loaded its component", async () => {
		const h = rowMenuHarness();
		await h.ready();
		await h.open();
		const menu = h.menu();
		const updates = menu.items[0]!.titles.length;
		menu.earlyHide();
		h.assertClean();
		assert.equal(h.subscriptions(), 0);
		h.index.invalidate();
		assert.equal(menu.items[0]!.titles.length, updates);
		h.cleanup();
		assert.equal(menu.hideCalls, 1);
	});

	it("keeps the new menu open when an older phone close animation finishes", async () => {
		const h = rowMenuHarness();
		await h.ready();
		await h.open();
		const oldMenu = h.menu();
		oldMenu.delayHideCallback = true;
		await h.open();
		const newMenu = h.menu();
		assert.equal(oldMenu.shown, false);
		assert.equal(newMenu.shown, true);
		assert.equal(h.subscriptions(), 2, "the older phone callback is still pending");
		oldMenu.finishHide();
		assert.equal(h.subscriptions(), 1, "the older callback only removes its own subscription");
		assert.equal(newMenu.shown, true);
		h.scroll(h.scroller);
		assert.equal(newMenu.shown, false);
		h.assertClean();
		h.cleanup();
	});

	it("cleans observers, opening timers and subscriptions if building an item throws", async () => {
		const h = rowMenuHarness();
		await h.ready();
		await assert.rejects(h.open(() => { throw new Error("menu builder failed"); }), /menu builder failed/);
		h.assertClean();
		h.cleanup();
	});
});
