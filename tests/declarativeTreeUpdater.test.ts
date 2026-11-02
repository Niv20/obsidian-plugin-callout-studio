/**
 * tests/declarativeTreeUpdater.test.ts — when the settings tree is rebuilt
 * (settings/declarative/treeUpdater.ts).
 *
 * Every `update()` redraws every row of the open settings page, so updates are
 * kept rare and harmless: coalesced to one per frame, skipped when nothing the
 * pages show changed, held while a menu is open or a drag is under way, and
 * still delivered when the settings window cannot give a frame.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fakeDom, installFakeDom, type FakeWindow } from "./support/fakeDom";
import { TreeUpdater, interactionInProgress, nextFrameOrSoon, type Scheduler } from "../src/settings/declarative/treeUpdater";

installFakeDom();

/** A scheduler the test drives: `tick()` runs whatever is waiting. */
function manualScheduler() {
	const waiting: Array<() => void> = [];
	const schedule: Scheduler = (run) => {
		waiting.push(run);
		return () => {
			const at = waiting.indexOf(run);
			if (at >= 0) waiting.splice(at, 1);
		};
	};
	return {
		schedule,
		tick(): void { for (const run of waiting.splice(0)) run(); },
		get pending(): number { return waiting.length; },
	};
}

/** An updater over a signature the test sets, counting its updates. */
function updaterFor(state: { signature: string; busy?: boolean }) {
	const clock = manualScheduler();
	let updates = 0;
	const updater = new TreeUpdater({
		signature: () => state.signature,
		update: () => { updates++; },
		isBusy: () => state.busy === true,
		schedule: clock.schedule,
	});
	return { updater, clock, updates: () => updates };
}

describe("TreeUpdater", () => {
	it("makes one update out of many requests, at the next tick", () => {
		const { updater, clock, updates } = updaterFor({ signature: "a" });
		updater.request();
		updater.request();
		updater.request();
		assert.equal(updates(), 0, "never on the spot");
		clock.tick();
		assert.equal(updates(), 1);
	});

	it("skips an update when the signature is the one already drawn, unless forced", () => {
		const state = { signature: "a" };
		const { updater, clock, updates } = updaterFor(state);
		updater.markDrawn();
		updater.request();
		clock.tick();
		assert.equal(updates(), 0);
		updater.request(true);
		clock.tick();
		assert.equal(updates(), 1, "a forced request runs anyway");
		state.signature = "b";
		updater.request();
		clock.tick();
		assert.equal(updates(), 2);
	});

	it("waits while the user is busy, and updates once they are done", () => {
		const state = { signature: "a", busy: true };
		const { updater, clock, updates } = updaterFor(state);
		updater.request();
		clock.tick();
		clock.tick();
		assert.equal(updates(), 0);
		assert.equal(clock.pending, 1, "still waiting");
		state.busy = false;
		clock.tick();
		assert.equal(updates(), 1);
	});

	it("does not wait for ever on something that never ends", () => {
		const { updater, clock, updates } = updaterFor({ signature: "a", busy: true });
		updater.request();
		for (let i = 0; i < 100 && updates() === 0; i++) clock.tick();
		assert.equal(updates(), 1);
	});

	it("drops what is waiting when disposed", () => {
		const { updater, clock, updates } = updaterFor({ signature: "a" });
		updater.request();
		updater.dispose();
		clock.tick();
		assert.equal(updates(), 0);
		assert.equal(clock.pending, 0);
	});
});

describe("nextFrameOrSoon", () => {
	const win = (): FakeWindow => window as unknown as FakeWindow;

	it("runs once, at the frame, and drops the backup timer", () => {
		let runs = 0;
		nextFrameOrSoon(() => fakeDom.document.body as unknown as Element)(() => { runs++; });
		win().flushFrames();
		win().flushTimers();
		assert.equal(runs, 1);
		assert.equal(win().pendingTimers(), 0);
	});

	it("runs from the timer when no frame comes (a hidden or closed window)", () => {
		let runs = 0;
		nextFrameOrSoon(() => fakeDom.document.body as unknown as Element)(() => { runs++; });
		win().flushTimers();
		win().flushFrames();
		assert.equal(runs, 1);
	});

	it("runs neither once cancelled", () => {
		let runs = 0;
		const cancel = nextFrameOrSoon(() => fakeDom.document.body as unknown as Element)(() => { runs++; });
		cancel();
		win().flushFrames();
		win().flushTimers();
		assert.equal(runs, 0);
	});
});

describe("interactionInProgress", () => {
	it("sees an open menu, an open picker list and a drag, and nothing else", () => {
		const doc = fakeDom.document as unknown as Document;
		assert.equal(interactionInProgress(doc), false);
		const hiddenList = fakeDom.document.body.createDiv({ cls: "cs-combobox-popup cs-combobox-popup-hidden" });
		assert.equal(interactionInProgress(doc), false, "a closed picker list does not count");
		hiddenList.removeClass("cs-combobox-popup-hidden");
		assert.equal(interactionInProgress(doc), true);
		hiddenList.remove();
		const menu = fakeDom.document.body.createDiv({ cls: "menu" });
		assert.equal(interactionInProgress(doc), true);
		menu.remove();
		fakeDom.document.body.addClass("is-grabbing");
		assert.equal(interactionInProgress(doc), true);
		fakeDom.document.body.removeClass("is-grabbing");
	});

	it("sees a field being typed in or slid on a settings page, and only there", () => {
		const doc = fakeDom.document as unknown as Document;
		const page = fakeDom.document.body.createDiv({ cls: "vertical-tab-content" });
		const slider = page.createEl("input", { attr: { type: "range" } });
		slider.focus();
		assert.equal(interactionInProgress(doc), true);
		const note = fakeDom.document.body.createEl("input");
		note.focus();
		assert.equal(interactionInProgress(doc), false, "a field outside the settings does not count");
		page.createDiv({ cls: "setting-item" }).focus();
		assert.equal(interactionInProgress(doc), false, "a focused row is not a field");
		page.remove();
		note.remove();
	});
});
