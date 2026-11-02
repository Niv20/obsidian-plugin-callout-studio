/**
 * tests/support/fakeWindows.ts — a second window, a ResizeObserver for each
 * window, and an element moving from one window to the other.
 *
 * Why it exists. In Obsidian 1.14 the settings are a window of their own, and
 * the rows in them are drawn by the main window and moved there afterwards. A
 * `ResizeObserver` only hears the elements of the window that made it, so code
 * that watches a row has to ask the window that shows it (idsLineFit.ts). A
 * suite has to be able to say *which* window an observer came from, *when* it
 * is called and *what it was asked to watch*, and the fake DOM, which has no
 * layout, cannot do any of that by itself.
 *
 * What it gives:
 *
 * - {@link installResizeObserver}: a `ResizeObserver` on a fake window that
 *   remembers every observer made, what each one watches, and calls them when
 *   the suite says an element has changed size ({@link ObserverLog.deliver}).
 *   The window also answers `getComputedStyle` with a CSS `gap`, which is all
 *   the ids line reads from it besides what the observer says.
 * - {@link newWindow}: a second fake document, and so a second window.
 * - {@link migrateElement}: Obsidian's `onWindowMigrated`, as a suite sees it:
 *   the element's document changes and its listeners are told.
 */
import { FakeDocument, type FakeElement, type FakeWindow } from "./fakeDom";

/** One `ResizeObserver` made by a fake window. */
export class FakeResizeObserver {
	/** What it watches now. */
	readonly targets = new Set<unknown>();
	/** `disconnect()` was called. */
	disconnected = false;

	constructor(readonly callback: (entries: ResizeObserverEntry[], observer: FakeResizeObserver) => void) {}

	observe(target: unknown): void {
		this.targets.add(target);
	}

	unobserve(target: unknown): void {
		this.targets.delete(target);
	}

	disconnect(): void {
		this.targets.clear();
		this.disconnected = true;
	}
}

/** An element, and how wide the observer says it is now. */
export type Size = readonly [target: unknown, width: number];

/** What a fake window's observers have been asked, and a way to call them. */
export interface ObserverLog {
	/** Every observer the window has made, in order. */
	readonly observers: FakeResizeObserver[];
	/**
	 * Say that these elements have changed size: each observer that watches
	 * any of them is called once, with the entries for the ones it watches, as
	 * the browser does. An entry carries the width as the content box's
	 * (`contentRect`) and as the border box's (`borderBoxSize`), which are the
	 * same here.
	 */
	deliver(...sizes: Size[]): void;
	/** Take the fake observer off the window. */
	restore(): void;
}

/**
 * Give `win` a `ResizeObserver`, and a `getComputedStyle` that says the CSS
 * `gap` is `gapPx` (the only thing the ids line reads from it).
 */
export function installResizeObserver(win: FakeWindow, gapPx = 4): ObserverLog {
	const observers: FakeResizeObserver[] = [];
	class Observer extends FakeResizeObserver {
		constructor(callback: FakeResizeObserver["callback"]) {
			super(callback);
			observers.push(this);
		}
	}
	Object.assign(win, {
		ResizeObserver: Observer,
		getComputedStyle: () => ({ columnGap: `${gapPx}px` }),
	});
	return {
		observers,
		deliver(...sizes) {
			for (const observer of [...observers]) {
				const entries = sizes
					.filter(([target]) => observer.targets.has(target))
					.map(
						([target, width]) =>
							({
								target,
								contentRect: { width },
								borderBoxSize: [{ inlineSize: width, blockSize: 20 }],
							}) as unknown as ResizeObserverEntry,
					);
				if (entries.length > 0) observer.callback(entries, observer);
			}
		},
		restore() {
			Reflect.deleteProperty(win, "ResizeObserver");
			Reflect.deleteProperty(win, "getComputedStyle");
		},
	};
}

/** A second document, and with it a second window. */
export function newWindow(): FakeDocument {
	return new FakeDocument();
}

/**
 * Move `el` into `doc`, and tell the listeners it registered with
 * `onWindowMigrated`, as Obsidian does once the element is shown there.
 */
export function migrateElement(el: FakeElement, doc: FakeDocument): void {
	el.ownerDocument = doc;
	for (const listener of [...el.migrationListeners]) listener(doc.defaultView);
}
