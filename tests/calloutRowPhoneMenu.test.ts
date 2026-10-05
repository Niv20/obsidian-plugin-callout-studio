import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, type TestContext } from "node:test";
import { type Menu, Platform } from "obsidian";
import { addUsageMenuItem } from "../src/usage/usageMenuItem";
import { rowMenuHarness, settleMenu } from "./support/calloutRowMenuHarness";

type Harness = ReturnType<typeof rowMenuHarness>;

const originalPlatform = { ...Platform };

beforeEach(() => {
	Object.assign(Platform, { isPhone: true, isTablet: false, isMobile: true, isDesktop: false });
});
afterEach(() => Object.assign(Platform, originalPlatform));

function harness(test: TestContext): Harness {
	const h = rowMenuHarness();
	test.after(() => { h.cleanup(); h.assertClean(); });
	return h;
}

/** Native phone presentation can hide the keyboard before show returns. */
function duringShow(menu: Menu, effect: () => void): void {
	const show = menu.showAtMouseEvent.bind(menu);
	menu.showAtMouseEvent = (event) => {
		const result = show(event);
		effect();
		return result;
	};
}

const geometryChanges: Array<[string, (h: Harness) => void]> = [
	["window resize", (h) => h.view.fire("resize")],
	["visual viewport resize", (h) => {
		h.view.visualViewport.height += 250;
		h.view.fire("visualViewport:resize");
	}],
	["visual viewport pan", (h) => {
		Object.assign(h.view.visualViewport, { offsetTop: 40 });
		h.view.fire("visualViewport:scroll");
	}],
	["ancestor scroll", (h) => h.scroll(h.scroller)],
	["anchor movement during a DOM update", (h) => {
		const previous = h.anchor.getBoundingClientRect();
		h.anchor.getBoundingClientRect = () => ({ ...previous, top: previous.top + 40 });
		h.scroller.createDiv();
		h.document.flushMutations();
	}],
];

describe("phone callout row sheets", () => {
	for (const [label, change] of geometryChanges) {
		it(`survives ${label} while native presentation is still running`, async (test) => {
			const h = harness(test);
			await h.ready();
			await h.open((menu) => {
				addUsageMenuItem(menu, h.app, ["note"]);
				duringShow(menu, () => change(h));
			});
			assert.equal(h.menu().shown, true);
			assert.equal(h.menu().hideCalls, 0);
			assert.equal(h.subscriptions(), 1, "the live usage item remains subscribed");
		});

		it(`survives delayed ${label} after the keyboard starts closing`, async (test) => {
			const h = harness(test);
			await h.ready();
			await h.open();
			change(h);
			assert.equal(h.menu().shown, true);
			assert.equal(h.menu().hideCalls, 0);
		});

		it(`still cancels a pending phone opening on ${label}`, async (test) => {
			const h = harness(test);
			const opening = h.open();
			await settleMenu();
			change(h);
			await opening;
			assert.equal(h.builds(), 0);
			h.assertClean();
			h.release();
			await h.index.ensureFresh();
			assert.equal(h.builds(), 0, "counts arriving later cannot revive the cancelled opening");
		});

		it(`still dismisses a positioned tablet menu on ${label}`, async (test) => {
			Object.assign(Platform, { isPhone: false, isTablet: true });
			const h = harness(test);
			await h.ready();
			await h.open();
			change(h);
			assert.equal(h.menu().shown, false);
			assert.equal(h.menu().hideCalls, 1);
			h.assertClean();
		});
	}

	const dismissals: Array<[string, (h: Harness) => void]> = [
		["button removal", (h) => {
			h.anchor.isConnected = false;
			h.anchor.remove();
			h.document.flushMutations();
		}],
		["button reparenting", (h) => {
			h.outer.appendChild(h.anchor);
			h.document.flushMutations();
		}],
		["settings disposal", (h) => h.dispose()],
		["orientation change", (h) => h.view.fire("orientationchange")],
		["window blur", (h) => h.view.fire("blur")],
		["page hide", (h) => h.view.fire("pagehide")],
	];
	for (const [label, dismiss] of dismissals) {
		it(`closes a presented phone sheet on ${label}`, async (test) => {
			const h = harness(test);
			await h.ready();
			await h.open();
			dismiss(h);
			assert.equal(h.menu().shown, false);
			assert.equal(h.menu().hideCalls, 1);
			assert.equal(h.subscriptions(), 0);
			h.assertClean();
		});
	}

	it("switches a cold opening to sheet behavior when its counts become ready", async (test) => {
		const h = harness(test);
		const opening = h.open();
		await settleMenu();
		assert.equal(h.builds(), 0);
		h.release();
		await opening;
		assert.equal(h.menu().shown, true);
		for (const [, change] of geometryChanges) {
			change(h);
			assert.equal(h.menu().shown, true);
		}
	});

	it("cleans a phone sheet dismissed synchronously during show without throwing", async (test) => {
		const h = harness(test);
		await h.ready();
		await h.open((menu) => {
			addUsageMenuItem(menu, h.app, ["note"]);
			duringShow(menu, () => h.view.fire("pagehide"));
		});
		assert.equal(h.menu().shown, false);
		assert.equal(h.menu().hideCalls, 1);
		assert.equal(h.subscriptions(), 0);
		h.assertClean();
	});
});
