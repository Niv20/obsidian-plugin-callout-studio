import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, Menu, MenuItem } from "obsidian";
import { getCalloutOccurrenceIndex } from "../src/usage/occurrenceService";
import { prepareUsageMenu } from "../src/usage/prepareUsageMenu";
import { addUsageMenuItem } from "../src/usage/usageMenuItem";
import { FakeDocument, FakeWindow, fakeDom } from "./support/fakeDom";

/** A separate owner window proves that pop-out menus use their own clock/events. */
class MenuWindow extends FakeWindow {
	readonly events = new Map<string, Array<(event: unknown) => void>>();
	private readonly scheduled = new Map<number, { at: number; callback: () => void }>();
	private time = 0;
	private nextTimer = 0;

	setTimeout(callback: () => void, delay = 0): number {
		const id = ++this.nextTimer;
		this.scheduled.set(id, { at: this.time + delay, callback });
		return id;
	}
	clearTimeout(id: number): void { this.scheduled.delete(id); }
	pendingTimers(): number { return this.scheduled.size; }
	advance(milliseconds: number): void {
		this.time += milliseconds;
		for (const [id, timer] of [...this.scheduled]) {
			if (timer.at > this.time) continue;
			this.scheduled.delete(id);
			timer.callback();
		}
	}
	addEventListener(type: string, listener: (event: unknown) => void): void {
		this.events.set(type, [...(this.events.get(type) ?? []), listener]);
	}
	removeEventListener(type: string, listener: (event: unknown) => void): void {
		this.events.set(type, (this.events.get(type) ?? []).filter((item) => item !== listener));
	}
	fire(type: string): void {
		for (const listener of [...(this.events.get(type) ?? [])]) listener({ type });
	}
}

function harness() {
	const view = new MenuWindow();
	const document = new FakeDocument(view);
	const anchor = document.body.createEl("button");
	anchor.isConnected = true;
	const target = anchor.createSpan();
	const event = { currentTarget: anchor, target } as unknown as MouseEvent;
	const disposers: Array<() => void> = [];
	let reads = 0;
	let enumerations = 0;
	let release!: (content: string) => void;
	let reject!: (error: Error) => void;
	const content = new Promise<string>((resolve, fail) => { release = resolve; reject = fail; });
	const file = { path: "note.md", stat: { mtime: 1, size: 7 } };
	const app = { vault: {
		getMarkdownFiles: () => { enumerations++; return [file]; },
		getAbstractFileByPath: () => file,
		cachedRead: () => { reads++; return content; },
	} } as unknown as App;
	const index = getCalloutOccurrenceIndex(app);
	return {
		app, index, view, document, anchor, event, disposers,
		reads: () => reads, enumerations: () => enumerations,
		release: () => release("[!note]"), reject,
		prepare: () => prepareUsageMenu(app, event, (dispose) => disposers.push(dispose)),
		assertClean: () => {
			assert.equal(view.pendingTimers(), 0, "settlement clears the opening deadline");
			assert.equal([...view.events.values()].flat().length, 0, "owner-window listeners are removed");
			assert.equal([...document.listeners.values()].flat().length, 0, "document listeners are removed");
		},
	};
}

function fakeMenu() {
	const item = {
		setTitle() { return this; }, setIcon() { return this; }, onClick() { return this; },
	};
	let hide = (): void => {};
	return {
		menu: {
			setUseNativeMenu() { return this; },
			onHide(callback: () => void) { hide = callback; },
			addItem(callback: (value: MenuItem) => void) { callback(item as unknown as MenuItem); return this; },
		} as unknown as Menu,
		hide: () => hide(),
	};
}

async function settle(): Promise<void> {
	for (let i = 0; i < 8; i++) await Promise.resolve();
}

describe("bounded opening of callout usage menus", () => {
	it("opens a ready cache synchronously without another scan or deadline", async () => {
		const h = harness();
		h.release();
		await h.index.ensureFresh();
		const enumerations = h.enumerations();
		assert.equal(h.prepare(), undefined);
		await settle();
		assert.equal(h.enumerations(), enumerations, "a ready menu does not start another index pass");
		assert.equal(h.reads(), 1);
		h.assertClean();
		h.index.dispose();
	});

	it("waits for a fast first scan and supplies its exact count before the deadline", async () => {
		const h = harness();
		const opening = h.prepare();
		assert.ok(opening instanceof Promise);
		const running = h.index.ensureFresh();
		await settle();
		assert.equal(h.index.status, "loading");
		h.view.advance(150);
		h.release();
		assert.equal(await opening, true);
		await running;
		const menu = fakeMenu();
		assert.deepEqual(addUsageMenuItem(menu.menu, h.app, ["note"]), h.index.query(["note"]));
		assert.equal(h.reads(), 1);
		h.assertClean();
		menu.hide();
		h.index.dispose();
	});

	it("opens at 200 ms in the owner's window while the same slow scan continues", async () => {
		const h = harness();
		const opening = h.prepare();
		assert.ok(opening instanceof Promise);
		const running = h.index.ensureFresh();
		let finished = false;
		void opening.then(() => { finished = true; });
		await settle();
		assert.equal(fakeDom.window.pendingTimers(), 0, "the main window does not own a pop-out deadline");
		h.view.advance(199);
		await settle();
		assert.equal(finished, false);
		h.view.advance(1);
		assert.equal(await opening, true);
		assert.equal(h.index.status, "loading");
		const menu = fakeMenu();
		assert.equal(addUsageMenuItem(menu.menu, h.app, ["note"]), undefined);
		assert.equal(h.reads(), 1, "timeout joins the existing scan rather than starting another read");
		h.assertClean();
		h.release();
		await running;
		assert.equal(h.index.query(["note"]).totalCount, 1);
		assert.equal(h.reads(), 1);
		menu.hide();
		h.index.dispose();
	});

	it("opens on an incomplete scan without retrying the same failure while building the menu", async () => {
		const h = harness();
		const opening = h.prepare();
		const running = h.index.ensureFresh();
		h.reject(new Error("unreadable"));
		assert.equal(await opening, true);
		await running;
		assert.equal(h.index.status, "partial");
		const enumerations = h.enumerations();
		const menu = fakeMenu();
		assert.equal(addUsageMenuItem(menu.menu, h.app, ["note"]), undefined);
		await settle();
		assert.equal(h.enumerations(), enumerations);
		assert.equal(h.reads(), 1, "one opening makes only one scan attempt");
		h.assertClean();
		menu.hide();
		h.index.dispose();
	});

	const cancellations: Array<[string, (h: ReturnType<typeof harness>) => void]> = [
		["another pointer interaction", (h) => h.document.fire("pointerdown", { target: h.document.body })],
		["Escape", (h) => h.document.fire("keydown", { key: "Escape" })],
		["Tab", (h) => h.document.fire("keydown", { key: "Tab" })],
		["window blur", (h) => h.view.fire("blur")],
		["page hide", (h) => h.view.fire("pagehide")],
		["settings disposal", (h) => h.disposers.forEach((dispose) => dispose())],
		["index disposal", (h) => h.index.dispose()],
	];
	for (const [label, cancel] of cancellations) {
		it(`cancels a pending menu on ${label} and cleans up its opening hooks`, async () => {
			const h = harness();
			const opening = h.prepare();
			const running = h.index.ensureFresh();
			await settle();
			cancel(h);
			assert.equal(await opening, false);
			h.assertClean();
			h.view.advance(200);
			h.release();
			await running;
			assert.equal(h.reads(), 1);
			h.index.dispose();
		});
	}

	it("does not open when the captured button is detached before the scan finishes", async () => {
		const h = harness();
		const opening = h.prepare();
		const running = h.index.ensureFresh();
		await settle();
		h.anchor.isConnected = false;
		h.release();
		assert.equal(await opening, false);
		await running;
		h.assertClean();
		h.index.dispose();
	});

	it("does not open if the index is disposed as the scan reports readiness", async () => {
		const h = harness();
		const opening = h.prepare();
		const running = h.index.ensureFresh();
		h.index.subscribe(() => {
			if (h.index.status === "ready") h.index.dispose();
		});
		h.release();
		assert.equal(await opening, false, "recheck liveness before the awaiting menu builder resumes");
		await running;
		h.assertClean();
	});

	it("keeps only the newest requested menu while sharing the pending scan", async () => {
		const h = harness();
		const first = h.prepare();
		const running = h.index.ensureFresh();
		await settle();
		const second = h.prepare();
		assert.equal(await first, false);
		assert.equal(h.view.pendingTimers(), 1, "the older opening deadline is removed");
		h.release();
		assert.equal(await second, true);
		await running;
		assert.equal(h.reads(), 1);
		h.assertClean();
		h.index.dispose();
	});
});
