/**
 * The notices under the settings title point at rows far below them. They take
 * the reader there the same way: a smooth scroll to the middle of the page,
 * then a short pulse once the row is in view. The import prompt did this for
 * Import; the saving banner's Go to version history now does it for Version
 * history › Earlier versions, instead of opening the window over the banner.
 */
import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import type { App } from "obsidian";
import { t } from "../src/i18n";
import { SettingsSaveStatus } from "../src/manager/settingsSaveStatus";
import { SettingsRecoveryModal } from "../src/settings/SettingsRecoveryModal";
import { renderBackupSection } from "../src/settings/sections/DataManagementSection";
import { renderReadOnlyBanner } from "../src/settings/sections/ReadOnlyBanner";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { createTargetHighlighter } from "../src/settings/targetHighlighter";
import { fakeDom, type FakeElement } from "./support/fakeDom";

const win = fakeDom.window;
/** What `prefers-reduced-motion: reduce` answers; a test may flip it. */
let reducedMotion = false;
before(() => {
	Object.defineProperty(win, "getComputedStyle", {
		configurable: true, value: () => ({ backgroundColor: "rgb(1, 2, 3)", boxShadow: "none" }),
	});
	Object.defineProperty(win, "matchMedia", {
		configurable: true, value: () => ({ matches: reducedMotion }),
	});
});
after(() => {
	Reflect.deleteProperty(win, "getComputedStyle");
	Reflect.deleteProperty(win, "matchMedia");
});
afterEach(() => { win.clearTimers(); reducedMotion = false; });

/** A row whose `scrollIntoView` calls are recorded rather than ignored. */
function row(): { el: FakeElement; scrolls: unknown[] } {
	const el = fakeDom.document.body.createDiv({ cls: "setting-item" });
	const scrolls: unknown[] = [];
	el.scrollIntoView = (options?: unknown) => { scrolls.push(options); };
	return { el, scrolls };
}

describe("taking the reader to a settings row", () => {
	it("marks the row, and scrolls it smoothly to the middle of the page", () => {
		const { el, scrolls } = row();
		const highlighter = createTargetHighlighter(el as unknown as HTMLElement);
		try {
			assert.ok(el.hasClass("cs-scroll-target"));
			highlighter.run();
			assert.deepEqual(scrolls, [{ behavior: "smooth", block: "center" }]);
			assert.ok(!el.hasClass("cs-scroll-target-highlight"), "no pulse before the row is in view");
		} finally { highlighter.dispose(); el.remove(); }
	});

	it("pulses once the scroll has had time to settle, then settles back to the row's own paint", () => {
		const { el } = row();
		const highlighter = createTargetHighlighter(el as unknown as HTMLElement);
		try {
			highlighter.run();
			win.flushTimers();
			assert.ok(el.hasClass("cs-scroll-target-highlight"));
			assert.equal(el.style.getPropertyValue("--cs-scroll-target-rest-bg"), "rgb(1, 2, 3)");
			assert.equal(el.style.getPropertyValue("--cs-scroll-target-rest-shadow"), "none");
			win.flushTimers();
			assert.ok(!el.hasClass("cs-scroll-target-highlight"));
			assert.equal(win.pendingTimers(), 0);
		} finally { highlighter.dispose(); el.remove(); }
	});

	it("pulses as soon as most of the row is in view, without waiting for the fallback", () => {
		const saved = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver");
		let notify: ((entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void) | null = null;
		let disconnected = 0;
		Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: class {
			constructor(callback: typeof notify) { notify = callback; }
			observe(): void {}
			disconnect(): void { disconnected++; }
		} });
		const { el } = row();
		const highlighter = createTargetHighlighter(el as unknown as HTMLElement);
		try {
			highlighter.run();
			notify!([{ isIntersecting: true, intersectionRatio: 0.5 }]);
			assert.ok(!el.hasClass("cs-scroll-target-highlight"), "half in view is not in view");
			notify!([{ isIntersecting: true, intersectionRatio: 0.9 }]);
			assert.ok(el.hasClass("cs-scroll-target-highlight"));
			assert.equal(disconnected, 1);
			assert.equal(win.pendingTimers(), 1, "only the pulse's own timer is left; the fallback is gone");
		} finally {
			highlighter.dispose(); el.remove();
			if (saved) Object.defineProperty(globalThis, "IntersectionObserver", saved);
			else Reflect.deleteProperty(globalThis, "IntersectionObserver");
		}
	});

	it("jumps instead of gliding when reduced motion is asked for, and still pulses", () => {
		reducedMotion = true;
		const { el, scrolls } = row();
		const highlighter = createTargetHighlighter(el as unknown as HTMLElement);
		try {
			highlighter.run();
			assert.deepEqual(scrolls, [{ behavior: "auto", block: "center" }]);
			win.flushTimers();
			assert.ok(el.hasClass("cs-scroll-target-highlight"), "a colour fade, not motion");
		} finally { highlighter.dispose(); el.remove(); }
	});

	it("moves keyboard focus to a focusable row, without a scroll of its own", () => {
		// Obsidian 1.13 gives every settings row tabindex="-1".
		const { el } = row();
		el.setAttribute("tabindex", "-1");
		const highlighter = createTargetHighlighter(el as unknown as HTMLElement);
		try {
			highlighter.run();
			assert.equal(fakeDom.document.activeElement, el);
			assert.deepEqual(el.lastFocusOptions, { preventScroll: true, focusVisible: false }, "no ring after a mouse click");
			highlighter.run(true);
			assert.deepEqual(el.lastFocusOptions, { preventScroll: true, focusVisible: true }, "a ring after a key press");
		} finally { highlighter.dispose(); el.remove(); }
	});

	it("focuses the row's first usable control where the row itself cannot take focus", () => {
		// Before Obsidian 1.13, rows had no tabindex.
		const { el } = row();
		const control = el.createDiv({ cls: "setting-item-control" });
		const disabled = control.createEl("button");
		disabled.setAttribute("disabled", "");
		const button = control.createEl("button");
		const highlighter = createTargetHighlighter(el as unknown as HTMLElement);
		try {
			highlighter.run();
			assert.equal(fakeDom.document.activeElement, button);
			assert.equal(disabled.focusCount, 0);
		} finally { highlighter.dispose(); el.remove(); }
	});

	it("leaves focus alone on an inert row, as the Import row is while saving is paused", () => {
		const { el } = row();
		el.setAttribute("tabindex", "-1");
		el.setAttribute("inert", "");
		const highlighter = createTargetHighlighter(el as unknown as HTMLElement);
		try {
			highlighter.run();
			assert.equal(el.focusCount, 0);
		} finally { highlighter.dispose(); el.remove(); }
	});

	it("stops waiting and removes the pulse when the page goes away", () => {
		const { el } = row();
		const highlighter = createTargetHighlighter(el as unknown as HTMLElement);
		try {
			highlighter.run();
			win.flushTimers();
			assert.ok(el.hasClass("cs-scroll-target-highlight"));
			highlighter.dispose();
			assert.ok(!el.hasClass("cs-scroll-target-highlight"));
			assert.equal(win.pendingTimers(), 0);
		} finally { el.remove(); }
	});
});

describe("Go to version history in the saving banner", () => {
	function page() {
		const root = fakeDom.document.body.createDiv({ cls: "callout-studio-settings" });
		const slot = root.createDiv();
		const status = new SettingsSaveStatus();
		const disposers: (() => void)[] = [];
		const plugin = {
			recovery: {},
			retrySettingsRecovery: async () => false,
			startFreshSettings: async () => true,
			settingsWriter: {
				status, get isFrozen() { return status.frozenReason !== null; }, isDestroyed: false, hasRecoveryState: true,
			},
		};
		const ctx = {
			app: {} as App, plugin, display: () => {},
			registerDisposer: (dispose: () => void) => { disposers.push(dispose); },
		} as unknown as SettingsSectionContext;
		const target = renderBackupSection(ctx, root as unknown as HTMLElement) as unknown as FakeElement;
		const scrolls: unknown[] = [];
		target.scrollIntoView = (options?: unknown) => { scrolls.push(options); };
		renderReadOnlyBanner(ctx, slot as unknown as HTMLElement, target as unknown as HTMLElement);
		const button = (label: string) => slot.querySelectorAll("button").find(candidate => candidate.textContent === label);
		const dispose = () => { for (const run of disposers) run(); root.remove(); };
		return { root, slot, status, target, scrolls, button, dispose };
	}

	it("is the Version history section's Earlier versions row that it takes the reader to", () => {
		const p = page();
		try {
			assert.equal(p.target.dataset.csName, t("settings.versions"));
			assert.ok(p.target.hasClass("cs-paused-allowed"), "usable, and not faded, while saving is paused");
		} finally { p.dispose(); }
	});

	it("scrolls to Earlier versions and highlights it, and does not open Version history", () => {
		const p = page();
		let opened = 0;
		Object.defineProperty(SettingsRecoveryModal.prototype, "open", { configurable: true, value: () => { opened++; } });
		try {
			p.status.freeze("missing");
			const go = p.button("Go to version history");
			assert.ok(go, "the paused banner offers Go to version history");
			assert.ok(!go.hasClass("mod-cta"), "a way to look, not the step to take");
			go.fire("click");
			assert.deepEqual(p.scrolls, [{ behavior: "smooth", block: "center" }]);
			win.flushTimers();
			assert.ok(p.target.hasClass("cs-scroll-target-highlight"));
			assert.equal(opened, 0);
			// The row's own button is still the way into the window. (The stub
			// draws a Setting's button as `.clickable-icon`.)
			p.target.querySelector(".clickable-icon")!.fire("click");
			assert.equal(opened, 1);
		} finally {
			p.dispose();
			Reflect.deleteProperty(SettingsRecoveryModal.prototype, "open");
		}
		assert.ok(!p.target.hasClass("cs-scroll-target-highlight"), "the settings page's disposers end the pulse");
		assert.equal(win.pendingTimers(), 0);
	});

	it("tells the reader where earlier versions are, and that restoring one waits for saving", () => {
		const p = page();
		try {
			p.status.freeze("missing");
			assert.match(p.slot.textContent, /Once saving works again, you can also bring back an earlier version from Version history/);
		} finally { p.dispose(); }
	});
});
