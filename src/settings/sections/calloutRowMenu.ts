/**
 * settings/sections/calloutRowMenu.ts — opening the menu of a callout row in
 * the settings (Find callouts, Replace, Duplicate, Delete, …).
 *
 * Who calls it. The row's ⋮ button, and a right-click anywhere on the row,
 * through the three row kinds' openers (`CalloutRowActions.ts`,
 * `themeRowActions.ts`).
 *
 * The main idea. The menu is Obsidian's own `Menu`, opened the way Obsidian
 * opens its "More options" menu in **Installed plugins**:
 *
 * - from the ⋮ button it drops down from under the button, lined up with the
 *   button's end, and a second press on the button closes it;
 * - from a right-click it opens at the pointer, as a right-click menu does
 *   everywhere in Obsidian (Community plugins' rows do the same).
 *
 * Opening may wait up to 200ms for the vault's callout counts, so the menu's
 * first line ("Find callouts 12") is right when it appears. Everything from the
 * press to the visible menu is one "lifetime": a scroll, a resize or the row
 * leaving the page in that time closes it, so a menu never appears for a row
 * that is gone or has moved.
 */
import { Component, Menu, Platform, type App } from "obsidian";
import { prepareUsageMenu } from "../../usage/prepareUsageMenu";
import { onMenuHide } from "../../ui/menuOnHide";
import type { SettingsSectionContext } from "./types";

/**
 * How a row's menu was asked for, which decides where it opens.
 *
 * (A TypeScript "union": a trigger is one shape or the other, and `kind` says
 * which, so code can check `trigger.kind` and then use that shape's fields.)
 */
export type RowMenuTrigger =
	/** The row's ⋮ button was pressed, with the mouse, Enter or Space. */
	| { kind: "button"; button: HTMLElement }
	/** The row was right-clicked at `x`, `y` (window coordinates). */
	| { kind: "pointer"; row: HTMLElement; x: number; y: number };

/** The close function of the one row menu each app has open, or is opening. */
const activeMenus = new WeakMap<App, () => void>();

/**
 * One lifetime from the press through the count wait to the visible menu.
 *
 * @param ctx The settings section's app and disposer registry.
 * @param trigger How the menu was asked for (see {@link RowMenuTrigger}).
 * @param build Adds the row's items to the new menu.
 */
export async function openCalloutRowMenu(
	ctx: Pick<SettingsSectionContext, "app" | "registerDisposer">,
	trigger: RowMenuTrigger,
	build: (menu: Menu) => void,
): Promise<void> {
	// A second press on the ⋮ button while its menu is open: Obsidian's menu
	// already treats it as "close" (the button is its parent element, see
	// below), so opening a new one here would close and reopen it.
	if (trigger.kind === "button" && trigger.button.hasClass("has-active-menu")) return;
	activeMenus.get(ctx.app)?.();
	// The element the menu belongs to: the button, or the right-clicked row.
	const anchor = trigger.kind === "button" ? trigger.button : trigger.row;
	if (!anchor.isConnected) return;
	const doc = anchor.ownerDocument;
	const view = doc.defaultView;
	if (!view) return;

	const lifetime = new Component();
	lifetime.load();
	let active = true;
	let menu: Menu | undefined;
	// Phone menus are bottom sheets that never use the tap position, so on a
	// phone nothing positional can make one stale, pending or shown. A real
	// scroll starts with a touch, which already cancels a pending opening.
	const phoneSheet = Platform.isPhone;
	let presented = false;
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
	const initialRect = anchor.getBoundingClientRect();
	const anchorChanged = (): boolean => {
		if (!anchor.isConnected || anchor.ownerDocument !== doc) return true;
		let parent = anchor.parentElement;
		for (const expected of ancestors) {
			if (parent !== expected) return true;
			parent = parent.parentElement;
		}
		if (parent) return true;
		if (phoneSheet) return false;
		const rect = anchor.getBoundingClientRect();
		return rect.left !== initialRect.left || rect.top !== initialRect.top ||
			rect.width !== initialRect.width || rect.height !== initialRect.height;
	};
	lifetime.registerDomEvent(view, "orientationchange", close);
	// Presenting a phone sheet hides the keyboard, and on iOS that takes focus
	// from the web view: the window blurs while the sheet is still on screen.
	lifetime.registerDomEvent(view, "blur", () => {
		if (!phoneSheet || !presented) close();
	});
	lifetime.registerDomEvent(view, "pagehide", close);
	if (!phoneSheet) {
		const scrollPositions = new Map(ancestors.map((el) =>
			[el, { x: el.scrollLeft, y: el.scrollTop }] as const));
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
		const preparation = prepareUsageMenu(ctx.app, anchor, (cancel) => lifetime.register(cancel));
		if (preparation && !await preparation) { close(); return; }
		// Also cover a scroll/removal after scan readiness but before this await
		// resumes. The lifetime stays armed throughout that microtask boundary.
		if (!active || anchorChanged()) { close(); return; }
		const openingMenu = new Menu();
		menu = openingMenu;
		const hidden = (): void => { menu = undefined; close(); };
		// Also covers a native dismissal before Menu's deferred component load.
		onMenuHide(openingMenu, hidden);
		build(openingMenu);
		if (!active) return;
		presented = true;
		showRowMenu(openingMenu, trigger, doc);
		// Showing an Obsidian Menu unloads its previous component lifetime, so
		// register only AFTER show. hide() unloads immediately (also on phones),
		// preserving the usage item's single, possibly animated onHide callback.
		if (active) openingMenu.register(hidden);
	} catch (error) {
		close();
		throw error;
	}
}

/**
 * Show `menu` where `trigger` asks for it.
 *
 * Under the button, it uses the position Obsidian itself gives a menu under a
 * button: `y` at the button's bottom edge, `width` the button's, `overlap` so
 * it can share the button's edge, and `left` to line the menu's end up with the
 * button's end. `setParentElement` makes the button the menu's own: Obsidian
 * marks it `has-active-menu` (the pressed look of a `clickable-icon`) while the
 * menu is open, and ignores a press on it as a "click outside", which is what
 * lets a second press close the menu instead of reopening it.
 *
 * At the pointer, the menu opens where the right-click happened.
 */
function showRowMenu(menu: Menu, trigger: RowMenuTrigger, doc: Document): void {
	if (trigger.kind === "pointer") {
		menu.showAtPosition({ x: trigger.x, y: trigger.y }, doc);
		return;
	}
	const rect = trigger.button.getBoundingClientRect();
	menu.setParentElement(trigger.button).showAtPosition(
		{ x: rect.x, y: rect.bottom, width: rect.width, overlap: true, left: true },
		doc,
	);
}
