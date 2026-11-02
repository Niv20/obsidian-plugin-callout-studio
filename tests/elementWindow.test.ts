/**
 * tests/elementWindow.test.ts — what is made for an element's window follows
 * the element to the window that shows it (src/utils/elementWindow.ts).
 *
 * In Obsidian 1.14 the settings are a window of their own, and their rows are
 * drawn by the main window and moved there afterwards. A `ResizeObserver`
 * hears only the elements of the window that made it, so what is made for an
 * element has to be made again, in the new window, when the element moves.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { installFakeDom, type FakeElement } from "./support/fakeDom";
import { migrateElement, newWindow } from "./support/fakeWindows";
import { followWindow, windowOf } from "../src/utils/elementWindow";

const fake = installFakeDom();

describe("followWindow", () => {
	/** What `start` was asked, in order: the window it was called for, and when its undo ran. */
	function recorder(): { log: string[]; start: (win: Window) => () => void } {
		const log: string[] = [];
		const names = new Map<unknown, string>([[fake.window, "main"]]);
		return {
			log,
			start: (win) => {
				// The windows are told apart by the order they first appear in.
				if (!names.has(win)) names.set(win, `window ${names.size}`);
				const name = names.get(win);
				log.push(`start ${name}`);
				return () => log.push(`undo ${name}`);
			},
		};
	}

	it("starts in the window that shows the element now", () => {
		const el = createDiv();
		const { log, start } = recorder();
		followWindow(el, start);
		assert.deepStrictEqual(log, ["start main"]);
	});

	it("takes it away and starts again in the new window when the element moves", () => {
		const el = createDiv();
		const settings = newWindow();
		const { log, start } = recorder();
		followWindow(el, start);
		migrateElement(el as unknown as FakeElement, settings);
		assert.deepStrictEqual(log, ["start main", "undo main", "start window 1"]);
		assert.strictEqual(windowOf(el), settings.defaultView);
	});

	it("follows the element through every move, undoing each in turn", () => {
		const el = createDiv();
		const first = newWindow();
		const second = newWindow();
		const { log, start } = recorder();
		followWindow(el, start);
		migrateElement(el as unknown as FakeElement, first);
		migrateElement(el as unknown as FakeElement, second);
		assert.deepStrictEqual(log, ["start main", "undo main", "start window 1", "undo window 1", "start window 2"]);
	});

	it("stops following, and undoes what was last made, once", () => {
		const el = createDiv();
		const settings = newWindow();
		const { log, start } = recorder();
		const stop = followWindow(el, start);
		migrateElement(el as unknown as FakeElement, settings);
		stop();
		assert.deepStrictEqual(log, ["start main", "undo main", "start window 1", "undo window 1"]);
		assert.strictEqual(
			(el as unknown as FakeElement).migrationListeners.length,
			0,
			"no longer listening for a move",
		);
		migrateElement(el as unknown as FakeElement, newWindow());
		assert.strictEqual(log.length, 4, "a move after that is not followed");
	});

	it("says the main window for an element that is shown nowhere", () => {
		const el = createDiv();
		(el as unknown as FakeElement).ownerDocument = { defaultView: null } as never;
		assert.strictEqual(windowOf(el), window);
	});
});
