/**
 * tests/declarativePersistentParts.test.ts — the parts of a settings page that
 * survive a redraw, and the registry of rows the plugin can jump to
 * (settings/declarative/persistentParts.ts, rowRegistry.ts).
 *
 * Obsidian redraws a render row by running its cleanup, emptying it and
 * drawing it again. A part that holds state (a banner in the middle of a
 * restore, a preview being typed in) must be the same object after that, and
 * must go away only when its page does. These tests draw such a row through
 * the test renderer and redraw it many times.
 *
 * The fake DOM does not work out `isConnected` from the tree; as in every
 * suite, the test says whether an element is on the page.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fakeDom, installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, type LooseDef } from "./support/declarativeRenderer";
import { PluginSettingTab } from "./support/obsidianStub";
import { PersistentParts, type PersistentPart } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";

installFakeDom();

/** Delayed checks the test runs when it says so. */
function manualLater() {
	const waiting: Array<() => void> = [];
	return { later: (run: () => void) => { waiting.push(run); }, run: () => { for (const check of waiting.splice(0)) check(); } };
}

/** A part that counts how many times it was built and disposed; it starts on the page. */
function countingPart(counts: { built: number; disposed: number }): () => PersistentPart {
	return () => {
		counts.built++;
		const el = createDiv({ cls: "the-part" });
		setConnected(el, true);
		return { el, dispose: () => { counts.disposed++; } };
	};
}

/** A tab with one row showing the part, on a page the test can leave. */
function tabWithPartRow(parts: PersistentParts, counts: { built: number; disposed: number }) {
	const row: LooseDef = {
		id: "banner",
		name: "Banner",
		render: (setting) => {
			parts.mount("banner", setting.controlEl as unknown as HTMLElement, countingPart(counts));
			return () => parts.releaseLater("banner");
		},
	};
	let onPage = true;
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () => (onPage ? [row] : [{ name: "Other" }]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	const partEl = harness.row("Banner")!.settingEl.querySelector<HTMLElement>(".the-part")!;
	// Leaving the page: the row goes, and the part's element with it.
	const leave = (): void => {
		onPage = false;
		tab.update();
		setConnected(partEl, false);
	};
	return { tab, harness, leave };
}

describe("PersistentParts", () => {
	it("keeps one part through any number of redraws", () => {
		const counts = { built: 0, disposed: 0 };
		const clock = manualLater();
		const parts = new PersistentParts(clock.later);
		const { tab, harness } = tabWithPartRow(parts, counts);
		const first = harness.row("Banner")!.settingEl.querySelector(".the-part");
		for (let i = 0; i < 5; i++) tab.update();
		clock.run();
		assert.equal(counts.built, 1);
		assert.equal(counts.disposed, 0);
		assert.equal(harness.row("Banner")!.settingEl.querySelector(".the-part"), first, "the same element");
	});

	it("disposes the part once its row is gone for good", () => {
		const counts = { built: 0, disposed: 0 };
		const clock = manualLater();
		const parts = new PersistentParts(clock.later);
		const { leave } = tabWithPartRow(parts, counts);
		leave();
		clock.run();
		assert.equal(counts.disposed, 1);
		assert.equal(parts.has("banner"), false);
	});

	it("disposes everything when the settings close", () => {
		const counts = { built: 0, disposed: 0 };
		const parts = new PersistentParts(() => {});
		parts.mount("a", createDiv(), countingPart(counts));
		parts.mount("b", createDiv(), countingPart(counts));
		parts.disposeAll();
		assert.equal(counts.disposed, 2);
		assert.equal(parts.has("a"), false);
	});
});

/** An element the test says is on the page. */
function onPage(): HTMLElement {
	const el = fakeDom.document.body.createDiv() as unknown as HTMLElement;
	setConnected(el, true);
	return el;
}

/** Say whether `el` is on the page (the fake DOM keeps it as a plain field). */
function setConnected(el: HTMLElement, connected: boolean): void {
	(el as unknown as { isConnected: boolean }).isConnected = connected;
}

describe("RowRegistry", () => {
	it("finds the element showing a row while it is on the page, and forgets it after", () => {
		const registry = new RowRegistry();
		const el = onPage();
		const forget = registry.register("import", el);
		assert.equal(registry.get("import"), el);
		setConnected(el, false);
		assert.equal(registry.get("import"), undefined, "not on the page");
		setConnected(el, true);
		forget();
		assert.equal(registry.get("import"), undefined);
	});

	it("keeps a newer element when an older draw's cleanup runs late", () => {
		const registry = new RowRegistry();
		const forgetOlder = registry.register("row", onPage());
		const newer = onPage();
		registry.register("row", newer);
		forgetOlder();
		assert.equal(registry.get("row"), newer);
	});
});
