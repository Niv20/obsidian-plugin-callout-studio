import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { addManualDiscoveryButton } from "../src/settings/sections/manualDiscoveryButton";
import { buildCalloutListsScaffold } from "../src/settings/sections/calloutListsScaffold";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { installFakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

installFakeDom();
const notices: string[] = [];
(globalThis as unknown as { __CS_NOTICES__: string[] }).__CS_NOTICES__ = notices;
afterEach(() => { notices.length = 0; });

const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const click = (button: HTMLButtonElement): void => {
	button.dispatchEvent(new Event("click", { bubbles: true }));
};
function pending() {
	let resolve!: (count: number) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<number>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}
function harness(scan: () => Promise<number> = () => Promise.resolve(2)) {
	let calls = 0;
	let displays = 0;
	const plugin = {
		settingsWriter: { isFrozen: false },
		localState: { isExpanded: () => true, setExpanded: () => {} },
		// The theme section's switch reads it.
		registry: { settings: { themeCalloutStyles: { enabled: true } } },
		runVaultScan: () => { calls++; return scan(); },
	};
	const mount = (scaffold = false) => {
		const disposers: (() => void)[] = [];
		const ctx = {
			plugin,
			display: () => { displays++; },
			registerDisposer: (fn: () => void) => disposers.push(fn),
		} as unknown as SettingsSectionContext;
		const host = createDiv();
		if (scaffold) buildCalloutListsScaffold(ctx, host, () => Promise.resolve());
		else addManualDiscoveryButton(ctx, host);
		const button = host.querySelector<HTMLButtonElement>(".cs-discover-callouts-btn");
		assert.ok(button);
		return { host, button, dispose: () => disposers.forEach((fn) => fn()) };
	};
	return { plugin, mount, calls: () => calls, displays: () => displays };
}

describe("the manual discovery header action", () => {
	it("sits beside Add new callout, and again under the list, and never folds the list", async () => {
		const h = harness();
		const { host, button } = h.mount(true);
		// Two copies, one per placement; the stylesheet shows one of them, by
		// whether the heading's line has room (`scanPlacement.ts`). The first in
		// the DOM is the heading's.
		const all = host.querySelectorAll(".cs-discover-callouts-btn");
		assert.equal(all.length, 2);
		assert.equal(all[0], button);
		assert.ok(all[1]?.closest(".cs-discover-footer"), "the second copy is not in the footer");
		const heading = button.closest(".cs-callout-list-heading");
		assert.ok(heading);
		assert.equal(button.parentElement?.children.length, 2);
		const name = heading.querySelector(".setting-item-name");
		assert.equal(name?.getAttribute("aria-expanded"), "true");
		assert.equal(h.calls(), 0, "rendering must not discover anything");
		click(button);
		await turn();
		assert.equal(name?.getAttribute("aria-expanded"), "true");
		assert.equal(h.calls(), 1);
		assert.doesNotMatch(readRepoFile("src/settings/sections/DataManagementSection.ts"), /runVaultScan|rescanVaultHintAction/);
	});

	it("shares one scan between the two copies", async () => {
		const p = pending();
		const h = harness(() => p.promise);
		const { host } = h.mount(true);
		const [heading, footer] = Array.from(
			host.querySelectorAll<HTMLButtonElement>(".cs-discover-callouts-btn"),
		);
		assert.ok(heading && footer);
		click(footer);
		assert.equal(heading.disabled, true, "a scan started from the footer leaves the heading's copy live");
		assert.equal(footer.disabled, true);
		assert.equal(footer.textContent, "Scanning…");
		click(heading);
		assert.equal(h.calls(), 1, "the second copy started a second scan");
		p.resolve(2); await turn();
		assert.equal(heading.disabled, false);
		assert.equal(footer.disabled, false);
		assert.equal(heading.textContent, "Scan for callouts");
		assert.equal(notices.length, 1, "one scan, one notice");
	});

	it("shows progress, blocks repeated activation, and does not redraw or scroll settings", async () => {
		const p = pending();
		const h = harness(() => p.promise);
		const { host, button } = h.mount();
		host.scrollTop = 900;
		button.focus({ preventScroll: true });
		click(button); click(button);
		assert.equal(h.calls(), 1);
		assert.equal(button.disabled, true);
		assert.equal(button.getAttribute("aria-busy"), "true");
		assert.equal(button.textContent, "Scanning…");
		// The visible text is the accessible name; no aria-label, so the
		// descriptive tooltip is not shadowed by a repeat of the label.
		assert.equal(button.getAttribute("aria-label"), null);
		assert.match(button.dataset.csTooltip ?? "", /Adds callout types used in your notes/);
		p.resolve(3); await turn();
		assert.equal(button.disabled, false);
		assert.equal(button.getAttribute("aria-busy"), "false");
		assert.equal(button.textContent, "Scan for callouts");
		assert.equal(h.displays(), 0);
		assert.equal(host.scrollTop, 900);
		assert.equal(document.activeElement, button);
		assert.equal(notices.length, 1);
	});

	it("keeps a reopened button busy until the original operation settles", async () => {
		const p = pending();
		const h = harness(() => p.promise);
		const first = h.mount(); click(first.button); first.dispose();
		const second = h.mount();
		assert.equal(second.button.disabled, true);
		click(second.button); click(first.button);
		assert.equal(h.calls(), 1);
		p.resolve(1); await turn();
		assert.equal(second.button.disabled, false);
		assert.equal(first.button.disabled, true, "a removed control is no longer repainted");
		assert.equal(notices.length, 1);
	});

	it("never starts from a disposed control", async () => {
		const h = harness(); const view = h.mount();
		view.dispose(); click(view.button); await turn();
		assert.equal(h.calls(), 0);
	});

	it("rejects activation while read-only, even if freezing happened after rendering", async () => {
		const h = harness(); const first = h.mount();
		h.plugin.settingsWriter.isFrozen = true;
		click(first.button); await turn();
		assert.equal(h.calls(), 0);
		assert.equal(h.mount().button.disabled, true);
	});

	it("remains disabled if saving becomes frozen during the scan", async () => {
		const p = pending(); const h = harness(() => p.promise);
		const { button } = h.mount(); click(button);
		h.plugin.settingsWriter.isFrozen = true;
		p.resolve(0); await turn();
		assert.equal(button.disabled, true);
		assert.equal(button.textContent, "Scan for callouts");
	});

	for (const synchronous of [false, true]) {
		it(`contains a ${synchronous ? "synchronous" : "rejected"} scan failure and allows retry`, async () => {
			let fail = true;
			const h = harness(() => {
				if (!fail) return Promise.resolve(1);
				if (synchronous) throw new Error("cannot read notes");
				return Promise.reject(new Error("cannot save settings"));
			});
			const { button } = h.mount();
			const originalError = console.error;
			try {
				console.error = () => {};
				click(button); await turn();
			} finally { console.error = originalError; }
			assert.equal(button.disabled, false);
			assert.match(notices[0] ?? "", /Discovery was not saved/);
			assert.equal(h.displays(), 0);
			fail = false; click(button); await turn();
			assert.equal(h.calls(), 2);
			assert.equal(notices.length, 2);
		});
	}

	it("does not share progress between different plugin instances", async () => {
		const p = pending(); const first = harness(() => p.promise);
		click(first.mount().button);
		const second = harness(); const { button } = second.mount();
		assert.equal(button.disabled, false);
		click(button); await turn(); assert.equal(second.calls(), 1);
		p.resolve(0); await turn();
	});
});
