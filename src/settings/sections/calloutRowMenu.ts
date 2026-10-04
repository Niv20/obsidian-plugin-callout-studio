import { Component, Menu, type App } from "obsidian";
import { prepareUsageMenu } from "../../usage/prepareUsageMenu";
import { onMenuHide } from "../../ui/menuOnHide";
import type { SettingsSectionContext } from "./types";

const activeMenus = new WeakMap<App, () => void>();

/** One lifetime from the click through the count wait to the visible menu. */
export async function openCalloutRowMenu(
	ctx: Pick<SettingsSectionContext, "app" | "registerDisposer">,
	event: MouseEvent,
	build: (menu: Menu) => void,
): Promise<void> {
	activeMenus.get(ctx.app)?.();
	// currentTarget is cleared as soon as the original click handler returns.
	const anchor = event.currentTarget as HTMLElement | null;
	if (!anchor?.isConnected) return;
	const doc = anchor.ownerDocument;
	const view = doc.defaultView;
	if (!view) return;

	const lifetime = new Component();
	lifetime.load();
	let active = true;
	let menu: Menu | undefined;
	const close = (): void => {
		if (!active) return;
		active = false;
		dispose = undefined;
		if (activeMenus.get(ctx.app) === close) activeMenus.delete(ctx.app);
		const closingMenu = menu;
		menu = undefined;
		lifetime.unload();
		closingMenu?.hide();
	};
	// Settings retains its disposers until hide/redraw. Release this session's
	// DOM/menu references as soon as it closes, even during a long settings visit.
	let dispose: (() => void) | undefined = close;
	ctx.registerDisposer(() => dispose?.());
	activeMenus.set(ctx.app, close);

	const ancestors: HTMLElement[] = [];
	for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
		ancestors.push(parent);
	}
	const scrollPositions = new Map(ancestors.map((el) =>
		[el, { x: el.scrollLeft, y: el.scrollTop }] as const));
	const initialRect = anchor.getBoundingClientRect();
	const anchorChanged = (): boolean => {
		if (!anchor.isConnected || anchor.ownerDocument !== doc) return true;
		let parent = anchor.parentElement;
		for (const expected of ancestors) {
			if (parent !== expected) return true;
			parent = parent.parentElement;
		}
		if (parent) return true;
		const rect = anchor.getBoundingClientRect();
		return rect.left !== initialRect.left || rect.top !== initialRect.top ||
			rect.width !== initialRect.width || rect.height !== initialRect.height;
	};
	const onScroll = (scrollEvent: Event): void => {
		const target = scrollEvent.target === doc
			? doc.scrollingElement ?? doc.documentElement : scrollEvent.target;
		const position = scrollPositions.get(target as HTMLElement);
		if (!position) return;
		const el = target as HTMLElement;
		// A scroll queued before the click must not close a freshly opened menu.
		if (el.scrollLeft !== position.x || el.scrollTop !== position.y) close();
	};
	// Capture sees non-bubbling ancestor scrolls. Menu/submenu and sibling
	// scrollports are absent from the map, so their own scrolling stays usable.
	lifetime.registerDomEvent(doc, "scroll", onScroll, { capture: true, passive: true });
	lifetime.registerDomEvent(view, "resize", close);
	lifetime.registerDomEvent(view, "orientationchange", close);
	lifetime.registerDomEvent(view, "blur", close);
	lifetime.registerDomEvent(view, "pagehide", close);
	const viewport = view.visualViewport;
	if (viewport) {
		const geometry = (): number[] => [viewport.width, viewport.height,
			viewport.offsetLeft, viewport.offsetTop, viewport.scale];
		const initialViewport = geometry();
		const viewportChanged = (): void => {
			if (geometry().some((value, i) => value !== initialViewport[i])) close();
		};
		// registerDomEvent has no VisualViewport overload in the Obsidian types.
		viewport.addEventListener("resize", viewportChanged, { passive: true });
		viewport.addEventListener("scroll", viewportChanged, { passive: true });
		lifetime.register(() => {
			viewport.removeEventListener("resize", viewportChanged);
			viewport.removeEventListener("scroll", viewportChanged);
		});
	}
	if (typeof view.MutationObserver === "function") {
		const observer = new view.MutationObserver(() => {
			if (anchorChanged()) close();
		});
		// Incremental list refreshes can remove/reparent a row without disposing
		// the whole settings tab. Menu count updates leave the anchor unchanged.
		observer.observe(doc.body, { childList: true, subtree: true });
		lifetime.register(() => observer.disconnect());
	}

	try {
		const preparation = prepareUsageMenu(ctx.app, event, (cancel) => lifetime.register(cancel));
		if (preparation && !await preparation) { close(); return; }
		// Also cover a scroll/removal after scan readiness but before this await
		// resumes. The lifetime stays armed throughout that microtask boundary.
		if (!active || anchorChanged()) { close(); return; }
		menu = new Menu();
		const hidden = (): void => { menu = undefined; close(); };
		// Also covers a native dismissal before Menu's deferred component load.
		onMenuHide(menu, hidden);
		build(menu);
		menu.showAtMouseEvent(event);
		// Showing an Obsidian Menu unloads its previous component lifetime, so
		// register only AFTER show. hide() unloads immediately (also on phones),
		// preserving the usage item's single, possibly animated onHide callback.
		menu.register(hidden);
	} catch (error) {
		close();
		throw error;
	}
}
