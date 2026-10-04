import assert from "node:assert/strict";
import type { App, Menu } from "obsidian";
import { openCalloutRowMenu } from "../../src/settings/sections/calloutRowMenu";
import { getCalloutOccurrenceIndex } from "../../src/usage/occurrenceService";
import { addUsageMenuItem } from "../../src/usage/usageMenuItem";
import { FakeDocument, FakeElement, FakeMutationObserver, FakeWindow, fakeDom } from "./fakeDom";
import { createdMenus } from "./obsidianStub";

/** Separate owner realm: neither main-window events nor its clock may affect a menu. */
class MenuWindow extends FakeWindow {
	readonly MutationObserver = FakeMutationObserver;
	readonly HTMLElement = FakeElement;
	readonly Element = FakeElement;
	readonly events = new Map<string, Array<(event: unknown) => void>>();
	scrollX = 0;
	scrollY = 0;
	addEventListener(type: string, listener: (event: unknown) => void): void {
		this.events.set(type, [...(this.events.get(type) ?? []), listener]);
	}
	removeEventListener(type: string, listener: (event: unknown) => void): void {
		this.events.set(type, (this.events.get(type) ?? []).filter((item) => item !== listener));
	}
	fire(type: string, event: unknown = { type }): void {
		for (const listener of [...(this.events.get(type) ?? [])]) listener(event);
	}
}

class MenuDocument extends FakeDocument {
	readonly observed = new Set<FakeMutationObserver>();
	addObserver(observer: FakeMutationObserver): void { super.addObserver(observer); this.observed.add(observer); }
	removeObserver(observer: FakeMutationObserver): void { super.removeObserver(observer); this.observed.delete(observer); }
}

export async function settleMenu(): Promise<void> {
	for (let i = 0; i < 12; i++) await Promise.resolve();
}

export function rowMenuHarness() {
	const view = new MenuWindow();
	Object.assign(view.visualViewport, { width: 1024, offsetLeft: 0, offsetTop: 0, scale: 1 });
	const document = new MenuDocument(view);
	const outer = document.body.createDiv();
	const scroller = outer.createDiv();
	const row = scroller.createDiv();
	const anchor = row.createEl("button");
	const target = anchor.createSpan();
	const elementListeners: Array<Set<(event: unknown) => void>> = [];
	anchor.isConnected = true;
	for (const element of [document.documentElement, document.body, outer, scroller, row, anchor]) {
		Object.assign(element, { scrollLeft: 0 });
		const listeners = new Set<(event: unknown) => void>();
		const add = element.addEventListener.bind(element);
		const remove = element.removeEventListener.bind(element);
		element.addEventListener = (type, callback) => { listeners.add(callback); add(type, callback); };
		element.removeEventListener = (type, callback) => { listeners.delete(callback); remove(type, callback); };
		elementListeners.push(listeners);
	}
	Object.assign(document, { scrollingElement: document.documentElement });
	const event = { currentTarget: anchor, target, view, clientX: 110, clientY: 75 } as unknown as MouseEvent;
	const disposers: Array<() => void> = [];
	let reads = 0;
	let release!: (text: string) => void;
	const content = new Promise<string>((resolve) => { release = resolve; });
	const file = { path: "note.md", stat: { mtime: 1, size: 7 } };
	const app = { vault: {
		getMarkdownFiles: () => [file], getAbstractFileByPath: () => file,
		cachedRead: () => { reads++; return content; },
	} } as unknown as App;
	const index = getCalloutOccurrenceIndex(app);
	let subscriptions = 0;
	const subscribe = index.subscribe.bind(index);
	index.subscribe = (callback) => {
		subscriptions++;
		const unsubscribe = subscribe(callback);
		let active = true;
		return () => { if (active) { active = false; subscriptions--; unsubscribe(); } };
	};
	const ctx = { app, registerDisposer: (dispose: () => void): void => { disposers.push(dispose); } };
	const initialMenus = createdMenus.length;
	let builds = 0;
	const open = (build: (menu: Menu) => void = (menu) => { addUsageMenuItem(menu, app, ["note"]); }): Promise<void> =>
		openCalloutRowMenu(ctx, event, (menu) => { builds++; build(menu); });
	const dispose = (): void => { disposers.forEach((callback) => callback()); };
	return {
		app, index, view, document, outer, scroller, row, anchor, event, ctx, open, dispose,
		reads: () => reads, builds: () => builds, subscriptions: () => subscriptions,
		menus: () => createdMenus.slice(initialMenus),
		menu: () => { const menu = createdMenus.at(-1); assert.ok(menu); return menu; },
		release: () => release("[!note]"),
		ready: async () => { release("[!note]"); await index.ensureFresh(); },
		/** Fire the original target plus document/window capture, matching non-bubbling scroll. */
		scroll: (element: FakeElement, y = element.scrollTop + 10, x = 0): void => {
			element.scrollTop = y;
			Object.assign(element, { scrollLeft: x });
			const scrollEvent = { type: "scroll", target: element };
			element.fire("scroll", scrollEvent);
			document.fire("scroll", scrollEvent);
			view.fire("scroll", scrollEvent);
		},
		assertClean: () => {
			assert.equal(view.pendingTimers(), 0, "the owner window has no opening timer");
			assert.equal([...view.events.values()].flat().length, 0, "owner-window and viewport hooks are removed");
			assert.equal([...document.listeners.values()].flat().length, 0, "document hooks are removed");
			for (const listeners of elementListeners) {
				assert.equal(listeners.size, 0, "ancestor hooks are removed");
			}
			assert.equal(document.observed.size, 0, "anchor observers are disconnected");
			assert.equal(fakeDom.window.pendingTimers(), 0, "the main window never owns the deadline");
		},
		cleanup: () => { dispose(); index.dispose(); release("[!note]"); },
	};
}
