/**
 * tests/idsLineFit.test.ts — a callout row's ids line shows the ids that fit
 * whole, a `+N` for the rest, and follows the row as its window is resized
 * (src/settings/sections/idsLineFit.ts).
 *
 * What this pins:
 *
 * - **How many ids show.** `countShownIds`, plain numbers in and a number
 *   out: all of them when they fit with no chip; otherwise the most that fit
 *   *with the `+N` after them*, which can be none. An id is never cut in half:
 *   the first that does not fit goes into the count with everything after it.
 *   A single id is the exception, because it has no count to go into.
 * - **What the line looks like.** Cut ids get `cs-id-cut`. The `+N` chip is
 *   there from the start (hidden, so that the observer can tell how wide it
 *   is), shares the ids' class (so it is drawn like one), says how many, and
 *   carries the tooltip that lists them, each kept left to right. A lone id
 *   is shortened by the page when the row is too narrow for it (it is not
 *   measured, as shortened it is no longer as wide as it is); the fitter gives
 *   it a tooltip with the whole id while it is.
 * - **That it follows the row, both ways.** An id goes into the count the
 *   moment the row is too narrow for it, and comes out the moment there is
 *   room again. The line is fitted from the sizes the observer reports, so
 *   what it was before does not matter.
 * - **That it never measures the page.** A resize is one call of the observer
 *   for all the rows, and fitting from what it says touches no layout: a read
 *   of a box's width after a write makes the browser lay the page out again,
 *   for every row, on every frame of a window being dragged.
 * - **Which window it asks.** One observer per window, made by the window that
 *   shows the row. A row drawn by the main window and then moved into the
 *   settings window is watched by the settings window from then on: an
 *   observer of the main window hears nothing of the other window (found in
 *   Obsidian 1.14.5, where the line was fitted once and never again).
 * - **The wiring.** Drawing a row fits its ids line.
 *
 * The fake DOM has no layout, so each test says how wide things are, in the
 * observer's words. The same code was run against Obsidian 1.14.5's settings
 * window, resized for real, with 40 and with 600 callouts, and in headless
 * Chrome at many widths on a computer, a tablet and a phone, in both
 * directions of writing.
 */
import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { FakeElement, installFakeDom, type FakeWindow } from "./support/fakeDom";
import { installResizeObserver, migrateElement, newWindow, type ObserverLog, type Size } from "./support/fakeWindows";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { Setting } from "obsidian";
import { drawCalloutRow } from "../src/settings/sections/CalloutRowRenderer";
import { countShownIds, fitIdsLine } from "../src/settings/sections/idsLineFit";
import type { CalloutDefinition } from "../src/types";

const fake = installFakeDom();

/** Left-to-right isolate and pop, around each id in the tooltip. */
const LRI = "⁦";
const PDI = "⁩";

/** Four 36px ids side by side with 4px between them: 156px in all. */
const WIDTHS = [36, 36, 36, 36];
const GAP = 4;
/** A `+N` that is 20px wide, whatever N is. */
const CHIP = 20;

describe("how many ids the line shows", () => {
	/** How many of the four ids show in `room` px. */
	const shownIn = (room: number, chip = CHIP, widths: readonly number[] = WIDTHS): number =>
		countShownIds(widths, GAP, room, chip);

	it("shows every id when they all fit, with no room kept for a chip", () => {
		assert.strictEqual(shownIn(200), 4);
		assert.strictEqual(shownIn(156), 4, "snug is still inside");
	});

	it("keeps the most whole ids that fit with the chip after them", () => {
		// Two ids end at 76, a 4px gap and the 20px chip make 100.
		assert.strictEqual(shownIn(100), 2);
		assert.strictEqual(shownIn(99), 1, "a pixel short of the chip");
		assert.strictEqual(shownIn(140), 3);
	});

	it("counts an id that fits alone but leaves no room for the chip", () => {
		// The third id ends at 116: it fits a 120px line, but it and a chip (140) do not.
		assert.strictEqual(shownIn(120), 2);
		assert.strictEqual(shownIn(150), 3);
	});

	it("gives up an id for a wider chip", () => {
		assert.strictEqual(shownIn(100), 2);
		assert.strictEqual(shownIn(100, 60), 1);
	});

	it("counts ids of different widths by where each one ends", () => {
		// 10 + 4 + 50 = 64, + 4 + 10 = 78, and the chip needs 24 more: 102.
		assert.strictEqual(shownIn(102, CHIP, [10, 50, 10, 60]), 3);
		assert.strictEqual(shownIn(101, CHIP, [10, 50, 10, 60]), 2);
	});

	it("never cuts an id: when the first does not fit beside the chip, the chip is the whole line", () => {
		// 36px of id and 24px of gap and chip: 60.
		assert.strictEqual(shownIn(60), 1);
		assert.strictEqual(shownIn(59), 0, "the first id goes into the count too");
		assert.strictEqual(shownIn(40), 0);
		assert.strictEqual(shownIn(0), 0);
	});

	it("always shows a single id, which has no count to go into", () => {
		assert.strictEqual(countShownIds([140], GAP, 100, CHIP), 1, "too long: the style sheet shortens it");
		assert.strictEqual(countShownIds([80], GAP, 100, CHIP), 1);
		assert.strictEqual(countShownIds([], GAP, 100, CHIP), 0);
	});
});

/* ------------------------------------------------------------------ */
/* The line on a page                                                  */
/* ------------------------------------------------------------------ */

/** How wide an id and the chip are, in the observer's words. */
const widths = { id: 36, chip: CHIP };

/** The window the fake page is in. */
const mainWindow = (): FakeWindow => fake.window;

/** A description line holding `ids` as the row draws them. */
function idsLine(ids: string[]): HTMLElement {
	const desc = createDiv({ cls: "setting-item-description" });
	ids.forEach((id, index) => {
		if (index > 0) desc.appendText(" ");
		desc.createEl("code", { cls: "callout-studio-row-syntax", text: `[!${id}]` });
	});
	return desc;
}

const IDS = ["a", "b", "c", "d"];

/** The ids of `desc` (not the `+N`), in order. */
function idBoxes(desc: HTMLElement): HTMLElement[] {
	return Array.from(desc.querySelectorAll<HTMLElement>(".callout-studio-row-syntax"))
		.filter((box) => !box.classList.contains("callout-studio-row-more"));
}

/** The `+N` chip of `desc`, if it has one. */
const chipOf = (desc: HTMLElement): HTMLElement | null => desc.querySelector(".callout-studio-row-more");

/**
 * What the observer says the first time it sees a line: how wide the line is,
 * and how wide every id and the chip are.
 */
function everything(desc: HTMLElement, room: number): Size[] {
	const chip = chipOf(desc);
	return [[desc, room], ...idBoxes(desc).map((id): Size => [id, widths.id]), ...(chip ? [[chip, widths.chip] as Size] : [])];
}

/** The ids of `desc` that are cut. */
function cutIds(desc: HTMLElement): string[] {
	return idBoxes(desc).filter((box) => box.classList.contains("cs-id-cut")).map((box) => box.textContent ?? "");
}

/** What the line says to the eye: the ids on show, then the count if it is on show. */
function shown(desc: HTMLElement): string {
	const chip = chipOf(desc);
	const ids = idBoxes(desc).filter((box) => !box.classList.contains("cs-id-cut")).map((box) => box.textContent);
	return [...ids, chip && !chip.classList.contains("cs-id-cut") ? chip.textContent : null].filter(Boolean).join(" ");
}

/** The ids of `desc` that carry a tooltip, with what it says. */
function tooltips(desc: HTMLElement): Record<string, string | null> {
	const found: Record<string, string | null> = {};
	for (const box of idBoxes(desc)) {
		const label = box.getAttribute("aria-label");
		if (label !== null) found[box.textContent ?? ""] = label;
	}
	return found;
}

/** Reading a box's width from the page, which the fitter must never do. */
const proto = FakeElement.prototype as unknown as Record<string, unknown>;
const originalRect = proto.getBoundingClientRect;
let measured = 0;

describe("the ids line", () => {
	let observers: ObserverLog;
	const stops: Array<() => void> = [];

	/** Fit `desc` as a row does, and keep what stops it for the end of the test. */
	function follow(desc: HTMLElement): () => void {
		const stop = fitIdsLine(desc);
		stops.push(stop);
		return stop;
	}

	/** The observer's first call for `desc`: the line is `room` wide. */
	function open(desc: HTMLElement, room: number): void {
		observers.deliver(...everything(desc, room));
	}

	/** The window is resized: only the line's width changes. */
	function resize(desc: HTMLElement, room: number): void {
		observers.deliver([desc, room]);
	}

	beforeEach(() => {
		Object.assign(widths, { id: 36, chip: CHIP });
		measured = 0;
		proto.getBoundingClientRect = () => {
			measured += 1;
			return { width: 0 };
		};
		observers = installResizeObserver(mainWindow());
	});

	afterEach(() => {
		for (const stop of stops.splice(0)) stop();
		observers.restore();
		proto.getBoundingClientRect = originalRect;
	});

	it("has the +N there from the start, out of sight, and every id on show", () => {
		const desc = idsLine(IDS);
		follow(desc);
		const chip = chipOf(desc);
		assert.ok(chip, "there to be measured");
		assert.ok(chip.classList.contains("callout-studio-row-syntax"), "the ids' look comes from this class");
		assert.ok(chip.classList.contains("cs-id-cut"), "out of the line until something is counted");
		assert.strictEqual(chip.nextSibling, null, "after the last id");
		assert.deepStrictEqual(cutIds(desc), []);
	});

	it("fits the line when the observer first calls, and the +N says how many and lists them", () => {
		const desc = idsLine(IDS);
		follow(desc);
		open(desc, 100);
		assert.deepStrictEqual(cutIds(desc), ["[!c]", "[!d]"]);
		assert.strictEqual(shown(desc), "[!a] [!b] +2");
		const chip = chipOf(desc);
		assert.strictEqual(chip?.getAttribute("aria-label"), `${LRI}[!c]${PDI} ${LRI}[!d]${PDI}`);
		assert.strictEqual(chip?.nextSibling, null, "after the last id");
	});

	it("gives the tooltip to the +N alone", () => {
		const desc = idsLine(IDS);
		follow(desc);
		open(desc, 100);
		assert.strictEqual(desc.getAttribute("aria-label"), null, "pointing at the line says nothing");
		assert.deepStrictEqual(tooltips(desc), {}, "nor does pointing at an id that is all there");
	});

	it("counts every id when not even the first fits beside the chip, and cuts none", () => {
		const desc = idsLine(IDS);
		follow(desc);
		open(desc, 30);
		assert.deepStrictEqual(cutIds(desc), ["[!a]", "[!b]", "[!c]", "[!d]"]);
		assert.strictEqual(shown(desc), "+4", "the chip is the whole line");
		assert.strictEqual(
			chipOf(desc)?.getAttribute("aria-label"),
			`${LRI}[!a]${PDI} ${LRI}[!b]${PDI} ${LRI}[!c]${PDI} ${LRI}[!d]${PDI}`,
		);
		assert.ok(!desc.querySelector(".cs-id-lone"), "an id with others beside it is never shortened");
	});

	it("counts a first id that is wider than the line rather than showing it cut", () => {
		// Two ids of 150px: one fits a 160px line alone, but not beside a chip.
		widths.id = 150;
		const desc = idsLine(["a", "b"]);
		follow(desc);
		open(desc, 160);
		assert.strictEqual(shown(desc), "+2");
	});

	it("leaves a lone id to the page, which shortens it, and gives it a tooltip with the whole id while it is", () => {
		const desc = idsLine(["a"]);
		follow(desc);
		const lone = idBoxes(desc)[0] as unknown as FakeElement;
		assert.strictEqual(chipOf(desc), null, "a lone id has nothing to count");
		assert.ok(lone.classList.contains("cs-id-lone"), "the style sheet shortens it, so it is never measured");
		assert.deepStrictEqual(observers.observers[0]?.targets.size, 1, "only the line is watched, not the id");

		// The row is too narrow: the id's text is wider than its box.
		lone.scrollWidth = 150;
		lone.clientWidth = 30;
		open(desc, 30);
		assert.deepStrictEqual(cutIds(desc), [], "never swapped for a count");
		assert.deepStrictEqual(tooltips(desc), { "[!a]": `${LRI}[!a]${PDI}` });
		// Room again: the id is whole and says nothing.
		lone.clientWidth = 150;
		resize(desc, 200);
		assert.deepStrictEqual(tooltips(desc), {});
	});

	it("says nothing of a lone id that fits", () => {
		const desc = idsLine(["a"]);
		follow(desc);
		open(desc, 200);
		assert.deepStrictEqual(tooltips(desc), {});
	});

	it("leaves a line that fits as it was drawn", () => {
		const desc = idsLine(IDS);
		follow(desc);
		open(desc, 300);
		assert.deepStrictEqual(cutIds(desc), []);
		assert.strictEqual(shown(desc), "[!a] [!b] [!c] [!d]");
		assert.ok(chipOf(desc)?.classList.contains("cs-id-cut"));
		assert.deepStrictEqual(tooltips(desc), {});
		assert.strictEqual(desc.getAttribute("aria-label"), null);
	});

	it("takes an id into the count the moment there is no room, and out of it the moment there is", () => {
		const desc = idsLine(IDS);
		follow(desc);
		open(desc, 300);
		assert.strictEqual(shown(desc), "[!a] [!b] [!c] [!d]");

		resize(desc, 140);
		assert.strictEqual(shown(desc), "[!a] [!b] [!c] +1");
		resize(desc, 100);
		assert.strictEqual(shown(desc), "[!a] [!b] +2");
		resize(desc, 30);
		assert.strictEqual(shown(desc), "+4", "nothing fits beside the chip");

		// Wider again, one step at a time: each id comes back as soon as it fits.
		resize(desc, 60);
		assert.strictEqual(shown(desc), "[!a] +3");
		resize(desc, 100);
		assert.strictEqual(shown(desc), "[!a] [!b] +2");
		resize(desc, 150);
		assert.strictEqual(shown(desc), "[!a] [!b] [!c] +1");
		resize(desc, 156);
		assert.strictEqual(shown(desc), "[!a] [!b] [!c] [!d]", "all of them out of the count, and the chip with it");
		assert.deepStrictEqual(tooltips(desc), {});
		assert.strictEqual(chipOf(desc)?.getAttribute("aria-label"), null, "a chip that counts nothing lists nothing");
	});

	it("does not depend on how it got there", () => {
		// The same width gives the same line, whatever the line was before.
		const wide = idsLine(IDS);
		follow(wide);
		open(wide, 300);
		resize(wide, 100);
		const narrow = idsLine(IDS);
		follow(narrow);
		open(narrow, 30);
		resize(narrow, 100);
		assert.strictEqual(shown(wide), shown(narrow));
	});

	it("does nothing until every box has said how wide it is", () => {
		const desc = idsLine(IDS);
		follow(desc);
		observers.deliver([desc, 100]);
		assert.strictEqual(shown(desc), "[!a] [!b] [!c] [!d]", "the ids' widths are not known yet");
		observers.deliver(...everything(desc, 100).slice(1));
		assert.strictEqual(shown(desc), "[!a] [!b] +2");
	});

	it("leaves a line alone while it is not on screen, and fits it when it is shown", () => {
		const desc = idsLine(IDS);
		follow(desc);
		open(desc, 100);
		assert.strictEqual(shown(desc), "[!a] [!b] +2");
		// A search hides the row: everything in it measures 0, and what it showed stays.
		observers.deliver(...everything(desc, 0).map(([target]): Size => [target, 0]));
		assert.strictEqual(shown(desc), "[!a] [!b] +2");
		// Shown again, wider: the line is fitted to that, from the widths it already knew.
		resize(desc, 300);
		assert.strictEqual(shown(desc), "[!a] [!b] [!c] [!d]");
	});

	it("fits the line again when the ids change width, as they do when the window becomes a phone's", () => {
		const desc = idsLine(IDS);
		follow(desc);
		open(desc, 100);
		assert.strictEqual(shown(desc), "[!a] [!b] +2");
		// A larger font: every id is 50px, and two no longer fit beside the chip.
		observers.deliver(...idBoxes(desc).map((id): Size => [id, 50]));
		assert.strictEqual(shown(desc), "[!a] +3");
	});

	it("fits only the lines the observer names", () => {
		const first = idsLine(IDS);
		const second = idsLine(IDS);
		follow(first);
		follow(second);
		open(first, 100);
		assert.strictEqual(shown(first), "[!a] [!b] +2");
		assert.strictEqual(shown(second), "[!a] [!b] [!c] [!d]", "not told, so as drawn");
	});

	it("uses one observer for all the rows of a window", () => {
		for (let count = 0; count < 25; count++) follow(idsLine(IDS));
		assert.strictEqual(observers.observers.length, 1);
		assert.strictEqual(observers.observers[0]?.targets.size, 25 * 6, "each line, its four ids and its chip");
	});

	it("fits all the rows of one resize without measuring the page", () => {
		const rows = [idsLine(IDS), idsLine(IDS), idsLine(IDS), idsLine(["a", "b"])];
		for (const row of rows) follow(row);
		observers.deliver(...rows.flatMap((row) => everything(row, 100)));
		for (const row of rows) assert.ok(chipOf(row)?.textContent, "every row was fitted");
		assert.strictEqual(shown(rows[0] as HTMLElement), "[!a] [!b] +2");
		// The window is resized: all the rows change width, in one call.
		observers.deliver(...rows.map((row): Size => [row, 60]));
		assert.strictEqual(shown(rows[0] as HTMLElement), "[!a] +3");
		observers.deliver(...rows.map((row): Size => [row, 300]));
		assert.strictEqual(shown(rows[0] as HTMLElement), "[!a] [!b] [!c] [!d]");
		assert.strictEqual(measured, 0, "reading a width after a write makes the browser lay the page out again, for every row");
	});

	it("stops watching when the row goes, and the last row out takes the observer down", () => {
		const desc = idsLine(IDS);
		const stop = fitIdsLine(desc);
		assert.strictEqual(observers.observers[0]?.targets.has(desc), true);
		stop();
		assert.strictEqual(observers.observers[0]?.targets.size, 0);
		assert.strictEqual(observers.observers[0]?.disconnected, true);
		observers.deliver(...everything(desc, 100));
		assert.strictEqual(shown(desc), "[!a] [!b] [!c] [!d]", "no longer followed");
		// Drawing the same row again starts afresh with a new observer.
		follow(idsLine(IDS));
		assert.strictEqual(observers.observers.length, 2);
	});

	it("keeps watching the others when one row goes", () => {
		const first = idsLine(IDS);
		const second = idsLine(IDS);
		const stopFirst = follow(first);
		follow(second);
		stopFirst();
		assert.strictEqual(observers.observers[0]?.disconnected, false);
		open(second, 100);
		assert.strictEqual(shown(second), "[!a] [!b] +2");
		assert.strictEqual(observers.observers[0]?.targets.has(first), false);
	});
});

describe("the ids line in a window of its own", () => {
	let main: ObserverLog;
	let settings: ObserverLog;
	let settingsDoc: ReturnType<typeof newWindow>;
	const stops: Array<() => void> = [];

	beforeEach(() => {
		Object.assign(widths, { id: 36, chip: CHIP });
		main = installResizeObserver(mainWindow());
		settingsDoc = newWindow();
		settings = installResizeObserver(settingsDoc.defaultView);
	});

	afterEach(() => {
		for (const stop of stops.splice(0)) stop();
		main.restore();
		settings.restore();
	});

	it("is watched by the window that shows the row once the row has moved there", () => {
		// The row is drawn by the main window…
		const desc = idsLine(IDS);
		stops.push(fitIdsLine(desc));
		assert.strictEqual(main.observers.length, 1);
		assert.strictEqual(main.observers[0]?.targets.has(desc), true);
		assert.strictEqual(settings.observers.length, 0);

		// …and shown in the settings window.
		migrateElement(desc as unknown as FakeElement, settingsDoc);
		assert.strictEqual(main.observers[0]?.targets.size, 0, "the main window's observer lets go of it");
		assert.strictEqual(settings.observers.length, 1, "the settings window makes its own");
		assert.strictEqual(settings.observers[0]?.targets.has(desc), true);

		// What the settings window says reaches the line; the main window's observer never would.
		settings.deliver(...everything(desc, 100));
		assert.strictEqual(chipOf(desc)?.textContent, "+2");
		assert.deepStrictEqual(cutIds(desc), ["[!c]", "[!d]"]);
		main.deliver(...everything(desc, 300));
		assert.strictEqual(shown(desc), "[!a] [!b] +2", "nothing from the main window is heard");
	});

	it("is fitted again at every resize of the window it moved to, both ways", () => {
		const desc = idsLine(IDS);
		stops.push(fitIdsLine(desc));
		migrateElement(desc as unknown as FakeElement, settingsDoc);
		settings.deliver(...everything(desc, 300));
		for (const [room, expected] of [
			[100, "[!a] [!b] +2"], [60, "[!a] +3"], [30, "+4"], [100, "[!a] [!b] +2"], [300, "[!a] [!b] [!c] [!d]"],
		] as const) {
			settings.deliver([desc, room]);
			assert.strictEqual(shown(desc), expected, `${room}px`);
		}
	});

	it("is fitted at once when it moves to a window, from what that window's observer says", () => {
		const desc = idsLine(IDS);
		stops.push(fitIdsLine(desc));
		main.deliver(...everything(desc, 100));
		migrateElement(desc as unknown as FakeElement, settingsDoc);
		// The new observer's first call says how wide everything is there.
		settings.deliver(...everything(desc, 60));
		assert.strictEqual(shown(desc), "[!a] +3");
	});

	it("stops watching in the window it is in when the row goes", () => {
		const desc = idsLine(IDS);
		const stop = fitIdsLine(desc);
		migrateElement(desc as unknown as FakeElement, settingsDoc);
		stop();
		assert.strictEqual(settings.observers[0]?.targets.size, 0);
		assert.strictEqual(settings.observers[0]?.disconnected, true);
		assert.strictEqual((desc as unknown as FakeElement).migrationListeners.length, 0, "and stops listening for a move");
	});

	it("is watched by its own window from the start when the row was drawn there", () => {
		const desc = settingsDoc.createElement("div");
		desc.addClass("setting-item-description");
		desc.createEl("code", { cls: "callout-studio-row-syntax", text: "[!a]" });
		desc.createEl("code", { cls: "callout-studio-row-syntax", text: "[!b]" });
		stops.push(fitIdsLine(desc as unknown as HTMLElement));
		assert.strictEqual(main.observers.length, 0);
		assert.strictEqual(settings.observers[0]?.targets.has(desc), true);
	});
});

describe("a callout row fits its ids line", () => {
	/** A user's callout whose four spellings sort a, b, c, d. */
	const callout: CalloutDefinition = {
		id: "a",
		displayName: "A",
		aliases: ["b", "c", "d"],
		icon: { type: "emoji", value: "📌" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
	};

	let observers: ObserverLog;
	beforeEach(() => {
		Object.assign(widths, { id: 36, chip: CHIP });
		observers = installResizeObserver(mainWindow());
	});
	afterEach(() => observers.restore());

	it("counts the cut ids in +N, and stops following when the row is undone", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(callout);
		const ctx = {
			app: {},
			redraw: () => {},
			registerDisposer: () => {},
			plugin: { app: {}, registry, settings: registry.settings },
		} as never;
		const host = createDiv();
		const undo = drawCalloutRow(ctx, new Setting(host), callout, "user", {
			onEdit: () => {},
			onOpenBuiltInMenu: () => {},
			onOpenUserMenu: () => {},
		});
		const desc = host.querySelector<HTMLElement>(".setting-item-description");
		assert.ok(desc);
		observers.deliver(...everything(desc, 100));
		const chip = chipOf(desc);
		assert.strictEqual(chip?.textContent, "+2");
		assert.strictEqual(chip?.getAttribute("aria-label"), `${LRI}[!c]${PDI} ${LRI}[!d]${PDI}`);
		undo();
		assert.strictEqual(observers.observers[0]?.targets.size, 0, "no longer followed");
	});
});
