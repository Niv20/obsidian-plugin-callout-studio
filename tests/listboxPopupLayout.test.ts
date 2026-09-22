import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	clearListboxMenuHeightCap,
	syncListboxMenuHeightCap,
} from "../src/ui/listboxPopupLayout";
import { asEl, FakeDocument, FakeElement, FakeWindow, fakeDom } from "./support/fakeDom";

class LayoutWindow extends FakeWindow {
	readonly Node = FakeElement;
	readonly events = new Map<string, Array<(ev: unknown) => void>>();
	ResizeObserver?: typeof LayoutObserver;
	addEventListener(type: string, listener: (ev: unknown) => void): void {
		this.events.set(type, [...(this.events.get(type) ?? []), listener]);
	}
	removeEventListener(type: string, listener: (ev: unknown) => void): void {
		this.events.set(type, (this.events.get(type) ?? []).filter((fn) => fn !== listener));
	}
	fire(type: string): void {
		for (const listener of this.events.get(type) ?? []) listener({});
	}
}

class LayoutObserver {
	static instances: LayoutObserver[] = [];
	readonly observed: Element[] = [];
	disconnected = false;
	constructor(readonly callback: () => void) {
		LayoutObserver.instances.push(this);
	}
	observe(element: Element): void { this.observed.push(element); }
	disconnect(): void { this.disconnected = true; }
}

function mount(options: {
	height?: number;
	offsetTop?: number;
	clipBottom?: number;
	autoClip?: "modal-content" | "vertical-tab-content";
	observe?: boolean;
} = {}) {
	const view = new LayoutWindow();
	view.visualViewport.height = options.height ?? 720;
	Object.assign(view.visualViewport, { offsetTop: options.offsetTop ?? 0 });
	if (options.observe) view.ResizeObserver = LayoutObserver;
	const doc = new FakeDocument(view);
	doc.documentElement.clientHeight = 900;
	const control = doc.createElement("div");
	const menu = doc.createElement("div");
	const clip = options.clipBottom === undefined ? undefined : doc.createElement("div");
	if (clip && options.autoClip) {
		clip.addClass(options.autoClip);
		clip.appendChild(control);
		clip.appendChild(menu);
	}
	let controlBottom = 200;
	control.getBoundingClientRect = () => ({ bottom: controlBottom } as DOMRect);
	if (clip) clip.getBoundingClientRect = () => ({ bottom: options.clipBottom } as DOMRect);
	let teardown: (() => void) | undefined;
	let updates = 0;
	const refresh = (): void => {
		updates++;
		teardown = syncListboxMenuHeightCap(
			asEl(control),
			asEl(menu),
			teardown,
			refresh,
			options.autoClip ? undefined : clip && asEl(clip),
		);
	};
	refresh();
	return {
		view, doc, control, menu, clip, refresh,
		get updates() { return updates; },
		cap: () => menu.style.getPropertyValue("--cs-combobox-menu-max-height"),
		setControlBottom: (bottom: number) => { controlBottom = bottom; },
		dispose: () => teardown?.(),
	};
}

describe("listbox popup height — visible space", () => {
	it("caps a tall menu at 320px and can clear its inline cap", () => {
		const h = mount();
		try {
			assert.equal(h.cap(), "320px");
			clearListboxMenuHeightCap(asEl(h.menu));
			assert.equal(h.cap(), "");
		} finally { h.dispose(); }
	});

	it("uses the popout document's visible viewport, including its vertical offset", () => {
		const h = mount({ height: 300, offsetTop: 50 });
		try {
			assert.notEqual(h.view, fakeDom.document.defaultView);
			assert.equal(h.cap(), "138px");
			h.setControlBottom(400);
			h.refresh();
			assert.equal(h.cap(), "0px", "no negative height when the trigger is off-screen");
		} finally { h.dispose(); }
	});

	it("stops at the modal clipping edge when it ends before the viewport", () => {
		const h = mount({ clipBottom: 310.8 });
		try {
			assert.equal(h.cap(), "98px");
			h.setControlBottom(275);
			h.refresh();
			assert.equal(h.cap(), "23px");
		} finally { h.dispose(); }
	});

	for (const clipClass of ["modal-content", "vertical-tab-content"] as const) {
		it(`discovers its ${clipClass} boundary without caller-specific wiring`, () => {
			const h = mount({ clipBottom: 310.8, autoClip: clipClass });
			try {
				assert.equal(h.cap(), "98px");
				h.setControlBottom(275);
				h.refresh();
				assert.equal(h.cap(), "23px");
			} finally { h.dispose(); }
		});
	}

	it("recalculates on window and visual viewport changes without duplicating listeners", () => {
		const h = mount();
		try {
			h.view.visualViewport.height = 280;
			h.view.fire("resize");
			assert.equal(h.cap(), "68px");
			h.view.visualViewport.height = 260;
			h.view.fire("visualViewport:resize");
			assert.equal(h.cap(), "48px");
			Object.assign(h.view.visualViewport, { offsetTop: 20 });
			h.view.fire("visualViewport:scroll");
			assert.equal(h.cap(), "68px");
			for (const listeners of h.view.events.values()) assert.equal(listeners.length, 1);
			assert.equal(h.doc.listeners.get("scroll")?.length, 1);
		} finally { h.dispose(); }
	});

	it("repositions after surrounding content scrolls but leaves menu scrolling alone", () => {
		const h = mount({ height: 400 });
		try {
			const row = h.menu.createDiv();
			const before = h.updates;
			h.doc.fire("scroll", { target: row });
			h.doc.fire("scroll", { target: h.menu });
			assert.equal(h.updates, before);
			h.setControlBottom(250);
			h.doc.fire("scroll", { target: h.doc.body });
			assert.equal(h.cap(), "138px");
			assert.equal(h.updates, before + 1);
		} finally { h.dispose(); }
	});

	it("observes control and modal resize, then removes every listener and observer", () => {
		LayoutObserver.instances = [];
		const h = mount({ clipBottom: 400, observe: true });
		const observer = LayoutObserver.instances[0]!;
		try {
			assert.deepEqual(observer.observed, [h.control, h.clip]);
			h.setControlBottom(250);
			observer.callback();
			assert.equal(h.cap(), "138px");
			assert.equal(LayoutObserver.instances.length, 1);
		} finally { h.dispose(); }
		assert.ok(observer.disconnected);
		for (const listeners of h.view.events.values()) assert.equal(listeners.length, 0);
		assert.equal(h.doc.listeners.get("scroll")?.length, 0);
		const before = h.updates;
		for (const event of ["resize", "visualViewport:resize", "visualViewport:scroll"]) h.view.fire(event);
		h.doc.fire("scroll", { target: h.doc.body });
		assert.equal(h.updates, before);
	});
});
