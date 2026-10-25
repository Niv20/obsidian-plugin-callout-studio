/**
 * tests/declarativeJumpToRow.test.ts — taking the reader to a row of the
 * settings (settings/declarative/jumpToRow.ts), and a callout row's part in it
 * (calloutPages.ts).
 *
 * What is checked: the page is opened through Obsidian's `openPagePath`, the
 * row flashes with Obsidian's `is-flashing` for 750 ms and takes the focus
 * only after a key press, a row drawn a moment later is still found (and a
 * jump gives up after a while), an Obsidian without `openPagePath` keeps the
 * reader where they are, and a callout row registers itself so a duplicate can
 * be revealed in My callout types.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { installFakeDom, fakeDom, type FakeWindow } from "./support/fakeDom";
import { DeclarativeHarness } from "./support/declarativeRenderer";
import { PluginSettingTab } from "./support/obsidianStub";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CALLOUT_PAGES, calloutRowId, myCalloutsPage, revealCalloutRow } from "../src/settings/declarative/calloutPages";
import { jumpToRow, type JumpHost } from "../src/settings/declarative/jumpToRow";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import type { Scheduler } from "../src/settings/declarative/treeUpdater";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import type { CalloutDefinition } from "../src/types";

installFakeDom();

/** A scheduler that waits until the test says to run, counting the waits. */
function manualSchedule() {
	const waiting: (() => void)[] = [];
	let waits = 0;
	const schedule: Scheduler = (run) => {
		waits++;
		waiting.push(run);
		return () => {};
	};
	return { schedule, flush: () => { for (const run of waiting.splice(0)) run(); }, waits: () => waits };
}

/** A jump host whose `openPagePath` is recorded (or missing). */
function jumpHost(options: { canOpenPages?: boolean } = {}) {
	const opened: [string, string[]][] = [];
	const setting = options.canOpenPages === false
		? { open: () => {}, openTabById: () => null }
		: { open: () => {}, openTabById: () => null, openPagePath: (tabId: string, path: string[]) => { opened.push([tabId, path]); } };
	const rows = new RowRegistry();
	const timing = manualSchedule();
	const host: JumpHost = { app: { setting } as unknown as App, tabId: "callout-studio", rows, schedule: timing.schedule };
	return { host, rows, opened, ...timing };
}

/** A row element on the page, registered under `id`. */
function drawnRow(rows: RowRegistry, id: string): HTMLElement {
	const el = fakeDom.document.body.createDiv({ cls: "setting-item" }) as unknown as HTMLElement;
	(el as unknown as { isConnected: boolean }).isConnected = true;
	rows.register(id, el);
	return el;
}

/** Run the timers of the window `el` lives in (the flash is timed on the row's own window). */
function flushTimersOf(el: HTMLElement): void {
	(el.ownerDocument.defaultView as unknown as FakeWindow).flushTimers();
}

describe("jumpToRow", () => {
	it("opens the row's page, flashes the row for 750 ms, and focuses it only after a key", () => {
		const { host, rows, opened } = jumpHost();
		const el = drawnRow(rows, "import-callouts");
		jumpToRow(host, "import-callouts", ["callouts-mine"], false);
		assert.deepEqual(opened, [["callout-studio", ["callouts-mine"]]]);
		assert.equal(el.hasClass("is-flashing"), true);
		assert.notEqual(fakeDom.document.activeElement, el, "no focus after a click");
		flushTimersOf(el);
		assert.equal(el.hasClass("is-flashing"), false);
		jumpToRow(host, "import-callouts", [], true);
		assert.equal(fakeDom.document.activeElement, el, "the focus follows a key press");
		flushTimersOf(el);
		el.remove();
	});

	it("finds a row drawn a moment later, and gives up after about half a second", () => {
		const { host, rows, flush, waits } = jumpHost();
		jumpToRow(host, "callout-new", [], false);
		assert.equal(waits(), 1, "not drawn yet: wait a frame");
		const el = drawnRow(rows, "callout-new");
		flush();
		assert.equal(el.hasClass("is-flashing"), true);
		flushTimersOf(el);
		el.remove();

		const never = jumpHost();
		jumpToRow(never.host, "missing", [], false);
		for (let i = 0; i < 100; i++) never.flush();
		assert.equal(never.waits(), 30);
	});

	it("keeps the reader on the open page when Obsidian cannot open one", () => {
		const { host, rows } = jumpHost({ canOpenPages: false });
		const el = drawnRow(rows, "earlier-versions");
		assert.doesNotThrow(() => jumpToRow(host, "earlier-versions", ["elsewhere"], false));
		assert.equal(el.hasClass("is-flashing"), true, "a row on the open page is still shown");
		flushTimersOf(el);
		el.remove();
	});
});

describe("a callout row", () => {
	/** One of the user's callouts. */
	const RECITE: CalloutDefinition = {
		id: "recite",
		displayName: "Recite",
		icon: { type: "emoji", value: "📌" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
	};

	it("registers itself while drawn, and a reveal jumps to it in My callout types", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(RECITE);
		const jumps: [string, readonly string[] | undefined][] = [];
		const rows = new RowRegistry();
		const ctx: TreeContext = {
			app: {} as never,
			plugin: { app: {}, registry, get settings() { return registry.settings; }, settingsWriter: { isFrozen: false } } as never,
			display: () => {},
			registerDisposer: () => {},
			rows,
			parts: new PersistentParts(() => {}),
			jumpTo: (rowId, _fromKeyboard, pagePath) => { jumps.push([rowId, pagePath]); },
		};
		const tab = new PluginSettingTab({}, {});
		tab.getSettingDefinitions = () => toObsidianItems([{ type: "group", id: "callouts", items: [myCalloutsPage(ctx)] }]);
		const harness = new DeclarativeHarness(tab);
		tab.update();
		harness.openPage([CALLOUT_PAGES.mine]);
		const rowEl = harness.rows().find((row) => row.def.id === calloutRowId(RECITE))!.settingEl;
		(rowEl as unknown as { isConnected: boolean }).isConnected = true;
		assert.equal(rows.get(calloutRowId(RECITE)), rowEl);
		revealCalloutRow(ctx, RECITE);
		assert.deepEqual(jumps, [[calloutRowId(RECITE), [CALLOUT_PAGES.mine]]]);
	});
});
