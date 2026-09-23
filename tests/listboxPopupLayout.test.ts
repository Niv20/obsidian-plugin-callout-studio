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
	readonly styles = new Map<Element, Partial<CSSStyleDeclaration>>();
	ResizeObserver?: typeof LayoutObserver;
	getComputedStyle(element: Element): CSSStyleDeclaration {
		return { overflowX: "visible", overflowY: "visible", direction: "ltr",
			...this.styles.get(element) } as CSSStyleDeclaration;
	}
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

function rect(top: number, bottom: number, left = 100, right = 340): DOMRect {
	return { top, bottom, left, right, width: right - left, height: bottom - top } as DOMRect;
}

function mount(options: {
	height?: number;
	offsetTop?: number;
	clipTop?: number;
	clipBottom?: number;
	autoClip?: "modal-content" | "vertical-tab-content" | "icon-picker-content";
	observe?: boolean;
	menuHeight?: number;
	controlBottom?: number;
} = {}) {
	const view = new LayoutWindow();
	view.visualViewport.height = options.height ?? 720;
	Object.assign(view.visualViewport, { offsetTop: options.offsetTop ?? 0, width: 800, offsetLeft: 0 });
	if (options.observe) view.ResizeObserver = LayoutObserver;
	const doc = new FakeDocument(view);
	doc.documentElement.clientHeight = 900;
	doc.documentElement.clientWidth = 800;
	const control = doc.createElement("div");
	const menu = doc.createElement("div");
	Object.assign(menu, { scrollHeight: options.menuHeight ?? 600, offsetHeight: 36 });
	const clip = options.clipBottom === undefined ? undefined : doc.createElement("div");
	if (clip) {
		clip.appendChild(control);
		clip.appendChild(menu);
		if (options.autoClip) {
			clip.addClass(options.autoClip);
			view.styles.set(asEl(clip), { overflowX: "auto", overflowY: "auto" });
		}
	}
	let controlBottom = options.controlBottom ?? 200;
	control.getBoundingClientRect = () => rect(controlBottom - 36, controlBottom);
	if (clip) clip.getBoundingClientRect = () => rect(options.clipTop ?? 0, options.clipBottom!, 0, 800);
	let teardown: (() => void) | undefined;
	let updates = 0;
	const refresh = (): void => {
		updates++;
		teardown = syncListboxMenuHeightCap(
			asEl(control), asEl(menu), teardown, refresh,
			options.autoClip ? undefined : clip && asEl(clip),
		);
	};
	refresh();
	return {
		view, doc, control, menu, clip, refresh,
		get updates() { return updates; },
		cap: () => menu.style.getPropertyValue("--cs-combobox-menu-max-height"),
		above: () => menu.hasClass("cs-dropdown-menu-above"),
		setControlBottom: (bottom: number) => { controlBottom = bottom; },
		dispose: () => teardown?.(),
	};
}

describe("listbox popup placement — visible space", () => {
	it("caps long menus at 320px and clears every transient layout property", () => {
		const h = mount({ controlBottom: 650 });
		try {
			assert.equal(h.cap(), "320px");
			assert.ok(h.above());
			clearListboxMenuHeightCap(asEl(h.menu));
			assert.equal(h.cap(), "");
			assert.equal(h.above(), false);
			assert.equal(h.menu.style.getPropertyValue("--cs-dropdown-menu-max-width"), "");
			assert.equal(h.menu.style.getPropertyValue("--cs-dropdown-menu-offset-x"), "");
		} finally { h.dispose(); }
	});

	it("keeps a short menu below when it fits, even with more space above", () => {
		const h = mount({ controlBottom: 600, menuHeight: 80 });
		try {
			assert.equal(h.above(), false);
			assert.equal(h.cap(), "108px");
		} finally { h.dispose(); }
	});

	it("opens above near the bottom without oscillating after a height cap", () => {
		const h = mount({ controlBottom: 600, menuHeight: 140 });
		try {
			for (let i = 0; i < 3; i++) {
				h.refresh();
				assert.equal(h.above(), true);
				assert.equal(h.cap(), "320px");
			}
			Object.assign(h.menu, { scrollHeight: 80 });
			h.refresh();
			assert.equal(h.above(), false, "filtering to a smaller list can fit below again");
		} finally { h.dispose(); }
	});

	it("uses the popout's visual viewport, including its top offset", () => {
		const h = mount({ height: 300, offsetTop: 50 });
		try {
			assert.notEqual(h.view, fakeDom.document.defaultView);
			assert.equal(h.cap(), "138px");
			h.setControlBottom(320);
			h.refresh();
			assert.ok(h.above());
			assert.equal(h.cap(), "222px");
			h.setControlBottom(400);
			h.refresh();
			assert.equal(h.cap(), "0px", "a fully off-screen trigger has no visible menu");
		} finally { h.dispose(); }
	});

	it("chooses the larger side inside an explicit clipping box", () => {
		const h = mount({ clipTop: 100, clipBottom: 310.8 });
		try {
			assert.equal(h.cap(), "98px");
			assert.equal(h.above(), false);
			h.setControlBottom(275);
			h.refresh();
			assert.equal(h.cap(), "127px");
			assert.ok(h.above());
		} finally { h.dispose(); }
	});

	for (const clipClass of ["modal-content", "vertical-tab-content", "icon-picker-content"] as const) {
		it(`discovers its ${clipClass} scroll boundary without caller wiring`, () => {
			const h = mount({ clipTop: 100, clipBottom: 310.8, autoClip: clipClass });
			try {
				assert.equal(h.cap(), "98px");
				h.setControlBottom(275);
				h.refresh();
				assert.equal(h.cap(), "127px");
			} finally { h.dispose(); }
		});
	}

	it("intersects nested clipping ancestors without treating visible overflow as clipping", () => {
		const h = mount({ clipBottom: 500, autoClip: "modal-content" });
		try {
			const outer = h.doc.createElement("div");
			outer.appendChild(h.clip!);
			outer.getBoundingClientRect = () => rect(100, 310, 0, 800);
			h.refresh();
			assert.equal(h.cap(), "288px");
			h.view.styles.set(asEl(outer), { overflowY: "hidden" });
			h.refresh();
			assert.equal(h.cap(), "98px");
		} finally { h.dispose(); }
	});

	it("bounds width and shifts from the trigger consistently, including RTL", () => {
		const h = mount();
		try {
			Object.assign(h.view.visualViewport, { width: 200, offsetLeft: 50 });
			for (const direction of ["ltr", "rtl"]) {
				h.view.styles.set(asEl(h.control), { direction });
				for (let i = 0; i < 2; i++) {
					h.refresh();
					assert.equal(h.menu.style.getPropertyValue("--cs-dropdown-menu-max-width"), "184px");
					assert.equal(h.menu.style.getPropertyValue("--cs-dropdown-menu-offset-x"), direction === "ltr" ? "-42px" : "-98px");
				}
			}
		} finally { h.dispose(); }
	});

	it("recalculates on viewport changes without duplicating listeners", () => {
		const h = mount({ menuHeight: 30 });
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

	it("repositions on surrounding scroll while leaving menu scrolling alone", () => {
		const h = mount({ height: 400, menuHeight: 30 });
		try {
			const before = h.updates;
			h.doc.fire("scroll", { target: h.menu.createDiv() });
			h.doc.fire("scroll", { target: h.menu });
			assert.equal(h.updates, before);
			h.setControlBottom(250);
			h.doc.fire("scroll", { target: h.doc.body });
			assert.equal(h.cap(), "138px");
			assert.equal(h.updates, before + 1);
		} finally { h.dispose(); }
	});

	it("observes control and clipping boxes and cleans listeners, observers and positioning", () => {
		LayoutObserver.instances = [];
		const h = mount({ clipBottom: 400, observe: true, menuHeight: 30 });
		const observer = LayoutObserver.instances[0]!;
		try {
			assert.deepEqual(observer.observed, [h.control, h.clip]);
			h.setControlBottom(250);
			observer.callback();
			assert.equal(h.cap(), "138px");
			assert.equal(LayoutObserver.instances.length, 1);
		} finally { h.dispose(); }
		assert.ok(observer.disconnected);
		assert.equal(h.cap(), "");
		assert.equal(h.above(), false);
		for (const listeners of h.view.events.values()) assert.equal(listeners.length, 0);
		assert.equal(h.doc.listeners.get("scroll")?.length, 0);
		const before = h.updates;
		for (const event of ["resize", "visualViewport:resize", "visualViewport:scroll"]) h.view.fire(event);
		h.doc.fire("scroll", { target: h.doc.body });
		assert.equal(h.updates, before);
	});
});
