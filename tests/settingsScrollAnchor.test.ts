/**
 * tests/settingsScrollAnchor.test.ts — repainting the settings tab without
 * moving the page under whoever is reading it.
 *
 * The tab renders straight into Obsidian's own settings scroller, and four of
 * its fifteen sections are rebuilt asynchronously — a registry change, a theme
 * switch, an icon download landing, another device's `data.json` arriving. All
 * four of those live *above* the other eleven, so a reader parked anywhere below
 * them had the page shift by whatever the rebuild's height delta happened to be,
 * and where the transient page came out shorter than the offset they were at,
 * the browser clamped it and they lost their place outright. Two users reported
 * the same thing from opposite ends: one could not reach a toggle six sections
 * down, the other kept being thrown to the top mid-scroll.
 *
 * `keepScrollAnchored` is the answer and the direction is the whole of it — a
 * sign error here does not fail quietly, it doubles the jump instead of undoing
 * it. So the cases that matter most below are the two that say *by how much, and
 * which way*, and they are deliberately written as a mirrored pair.
 *
 * Nothing here measures a real layout, and it must not: the fake DOM has no
 * layout engine and its own header forbids asserting on one. Every number below
 * is one this file wrote onto a stub, which is exactly what makes the arithmetic
 * checkable in isolation from it.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { keepScrollAnchored } from "../src/settings/sections/foldAnchor";
import { installFakeDom } from "./support/fakeDom";

installFakeDom();

type Box = { top: number; bottom: number };

/**
 * `isConnected` is a plain, settable field on this DOM — suites build detached
 * trees and say for themselves what is on screen (`fakeDom.ts`) — but the type
 * it is cast to declares it read-only, so setting it needs saying out loud.
 */
const setConnected = (el: HTMLElement, value: boolean): void => {
	(el as unknown as { isConnected: boolean }).isConnected = value;
};

/**
 * A settings pane with three sections in it.
 *
 * The pane carries `vertical-tab-content`, the class Obsidian puts on the
 * settings pane and the one `scrollParentOf` looks for first — and, on a plugin
 * tab, the pane and the container the plugin renders into are the same element,
 * so this rig is shaped the way the real one is rather than merely similar.
 */
function pane(boxes: Box[], opts: { layout?: boolean } = {}) {
	const layout = opts.layout ?? true;
	const containerEl: HTMLElement = createDiv({ cls: "vertical-tab-content" });
	containerEl.scrollTop = 1000;
	// A plain field in this DOM, defaulting to false, which each suite sets for
	// itself (see `fakeDom.ts`). It has to be true here: the anchor refuses to
	// measure a box the repaint detached, because a detached one reports zeros
	// rather than failing and would hand the scroller the whole page as drift.
	setConnected(containerEl, true);
	if (layout) {
		containerEl.getBoundingClientRect = () =>
			({ top: 0, bottom: 800 }) as unknown as DOMRect;
	}

	const sections = boxes.map((box) => {
		const el = containerEl.createDiv();
		setConnected(el, true);
		const live = { ...box };
		if (layout) {
			el.getBoundingClientRect = () => live as unknown as DOMRect;
		}
		return { el, live };
	});
	/** Positional access that satisfies `noUncheckedIndexedAccess`. */
	const at = (index: number) => {
		const section = sections[index];
		if (!section) throw new Error(`no section ${index}`);
		return section;
	};
	return { containerEl, at };
}

describe("keepScrollAnchored", () => {
	it("follows the anchor down when content above it grew", () => {
		// The reader is looking at the third section. A rebuild above inserts
		// 250px, so everything they can see slides *down* by 250 — and the
		// scroller has to travel the same 250 to put it back under their eye.
		const { containerEl, at } = pane([
			{ top: -900, bottom: -400 },
			{ top: -400, bottom: -20 },
			{ top: -20, bottom: 600 },
		]);

		keepScrollAnchored(containerEl, () => {
			at(2).live.top += 250;
			at(2).live.bottom += 250;
		});

		assert.strictEqual(
			containerEl.scrollTop,
			1250,
			"content above grew by 250, so the scroller must advance by 250",
		);
	});

	it("follows it back up when content above it went away", () => {
		// The mirror, and the case both bug reports were actually hitting: the
		// three callout lists empty and refill shorter, everything below jumps
		// up, and without this the reader goes with it.
		const { containerEl, at } = pane([
			{ top: -900, bottom: -400 },
			{ top: -400, bottom: -20 },
			{ top: -20, bottom: 600 },
		]);

		keepScrollAnchored(containerEl, () => {
			at(2).live.top -= 300;
			at(2).live.bottom -= 300;
		});

		assert.strictEqual(
			containerEl.scrollTop,
			700,
			"content above shrank by 300, so the scroller must give back 300",
		);
	});

	it("anchors on the first section still on screen, not the first section", () => {
		// Sections one and two are entirely above the pane's top edge, so
		// neither can say anything about what the reader is looking at. If the
		// anchor were taken from either, a rebuild that moved *them* and not the
		// visible one would scroll the page for no reason.
		const { containerEl, at } = pane([
			{ top: -900, bottom: -400 },
			{ top: -400, bottom: 0 },
			{ top: 0, bottom: 600 },
		]);

		keepScrollAnchored(containerEl, () => {
			at(0).live.top -= 999;
			at(1).live.top -= 999;
		});

		assert.strictEqual(
			containerEl.scrollTop,
			1000,
			"the visible section did not move, so nothing should have scrolled",
		);
	});

	it("leaves the scroller alone when nothing moved", () => {
		const { containerEl } = pane([{ top: -20, bottom: 600 }]);
		keepScrollAnchored(containerEl, () => {});
		assert.strictEqual(containerEl.scrollTop, 1000);
	});

	it("still runs the repaint where there is no layout to measure", () => {
		// The correction is an improvement on the repaint, never a condition of
		// it. A DOM with no `getBoundingClientRect` — which is the one every
		// suite in this repo runs against — must get the repaint anyway.
		const { containerEl } = pane([{ top: 0, bottom: 0 }], { layout: false });
		let ran = 0;

		keepScrollAnchored(containerEl, () => {
			ran += 1;
		});

		assert.strictEqual(ran, 1, "the mutation must have run");
		assert.strictEqual(
			containerEl.scrollTop,
			1000,
			"and nothing may be guessed at in place of a measurement",
		);
	});

	it("bails rather than measuring an anchor the repaint destroyed", () => {
		// A detached box reports zeros instead of failing, so measuring one
		// would hand the scroller a drift the size of the whole page. This is
		// the guard that keeps a wider-than-expected repaint from becoming a
		// catastrophic scroll.
		const { containerEl, at } = pane([{ top: -20, bottom: 600 }]);

		keepScrollAnchored(containerEl, () => {
			at(0).el.detach();
			setConnected(at(0).el, false);
			at(0).live.top = 0;
			at(0).live.bottom = 0;
		});

		assert.strictEqual(
			containerEl.scrollTop,
			1000,
			"a destroyed anchor must be dropped, not measured",
		);
	});

	it("runs the repaint exactly once", () => {
		const { containerEl } = pane([{ top: -20, bottom: 600 }]);
		let ran = 0;
		keepScrollAnchored(containerEl, () => {
			ran += 1;
		});
		assert.strictEqual(ran, 1);
	});
});
