/**
 * settings/sections/idsLineFit.ts — a callout row's ids line shows the ids that
 * fit whole, and a `+3` for the rest, and follows the row as its window is
 * resized.
 *
 * Who calls it. {@link drawCalloutRow} (CalloutRowRenderer.ts), once per row,
 * on the row's description.
 *
 * ## What the line shows
 *
 * The ids are the least important thing on a row, so they are what gives way
 * when the row is narrow, and they give way a whole id at a time. An id is
 * never shown cut in half:
 *
 *   1. Every id, when they all fit.
 *   2. Otherwise the first few that fit *beside a `+N` chip*. The chip counts
 *      the ids left out and carries the tooltip that lists them; the first id
 *      that does not fit goes into it, and so does every id after that one.
 *      When not even the first fits with the chip, the line is the chip alone.
 *   3. The one exception is a row with a single id. It has no count to go into,
 *      so it is shown, and shortened with "…" when it is longer than the row.
 *      The page does that by itself (the class `cs-id-lone`, in styles.css);
 *      this file only gives the shortened id a tooltip with the whole of it.
 *      It could not measure that id's natural width as it does the others':
 *      shortened, the box is no longer as wide as the id is.
 *
 * The line is worked out afresh from how wide things are *now*, so it does not
 * matter how it got to its last state: an id goes into the count the moment
 * it does not fit, and comes out of it the moment there is room.
 *
 * ## Which window watches the row
 *
 * A row is watched with a `ResizeObserver`, and the observer has to be made by
 * **the window that shows the row**. In Obsidian 1.14 the settings are a window
 * of their own, and the rows are drawn by the main window and moved into it
 * afterwards. An observer made by the main window hears nothing when that
 * other window is resized (measured in Obsidian 1.14.5: the line was fitted
 * once, when it opened, and never again). So a line is registered with its
 * window's {@link IdsFitter} and, when the row moves to another window, with
 * that window's (`followWindow`, utils/elementWindow.ts).
 *
 * ## Why a resize costs almost nothing
 *
 * Measuring is what makes a resize heavy: read a box's width after writing
 * anything and the browser lays the whole page out again, and doing that for
 * every row of a long list, on every frame of a window being dragged, is a lot.
 * So nothing is measured. The observer already says how wide each box is, and
 * says it again only when that changes, so a fitter:
 *
 *   - watches the line, each of its ids and its `+N` chip with one observer
 *     per window (not one per row), and keeps the sizes it is told;
 *   - fits a line from those sizes alone, which is arithmetic;
 *   - takes an id that does not fit out of the line's flow and makes it
 *     invisible (`cs-id-cut`) instead of removing it (`display: none` has no
 *     size), so the observer still tells how wide it is; the `+N` chip is
 *     always there for the same reason.
 *
 * When the window is resized only the lines change width, so a resize is one
 * call of the observer for all the rows, and nothing in it touches the layout.
 * When a font changes (the window becomes a phone's) the ids change width, the
 * observer says so, and the line is fitted to that.
 *
 * Two pieces: {@link countShownIds} is the arithmetic (plain numbers in, a
 * number out, so it reads and tests without a browser), and the fitter with
 * {@link fitIdsLine} is the part that keeps the sizes and applies the result.
 */

import { followWindow, windowOf } from "../../utils/elementWindow";

/** Layout is in fractions of a pixel; this much past the edge is still inside it. */
const EPSILON = 0.01;

/** Left-to-right isolate and pop: keeps `[!id]` from turning into `[id!]` in a right-to-left tooltip. */
const isolate = (text: string): string => `⁦${text}⁩`;

/**
 * How many ids the line shows, counting from the first. The rest are counted
 * by the `+N` chip.
 *
 * Direction does not matter: ids stand one after another from the line's
 * start edge, whichever side that is, so only how wide they are counts.
 *
 * @param widths Each id's natural width, in order.
 * @param gap The space between two neighbouring boxes, which the chip gets too.
 * @param room How wide the line is.
 * @param chipWidth How wide the `+N` chip is. (Ids per callout are capped at
 *   ten, so the count has one digit wherever an id is shown beside it.)
 */
export function countShownIds(widths: readonly number[], gap: number, room: number, chipWidth: number): number {
	const total = widths.length;
	const limit = room + EPSILON;

	// How far the first `count` ids reach, standing side by side.
	const reaches: number[] = [];
	let reach = 0;
	for (const [index, width] of widths.entries()) {
		reach += (index > 0 ? gap : 0) + width;
		reaches.push(reach);
	}

	// Everything fits. Or there is one id, which never goes into a count: the
	// style sheet shortens it if it has to be.
	if (total <= 1 || (reaches[total - 1] ?? 0) <= limit) return total;

	// Some ids go into the chip, so it needs room after the last one on show.
	// Keep the most that fit beside it; that can be none.
	const reserved = gap + chipWidth;
	let shown = total - 1;
	while (shown > 0 && (reaches[shown - 1] ?? 0) + reserved > limit) shown--;
	return shown;
}

/** Which box of a line an observer entry is about: the line itself, its chip, or the id at an index. */
type Slot = "room" | "chip" | number;

/** One callout's ids line, with the sizes its fitter has been told. */
interface IdsLine {
	descEl: HTMLElement;
	/** The `[!id]` boxes, in order. */
	ids: HTMLElement[];
	/** The `+N` chip, there from the start; null when there is only one id to count. */
	chip: HTMLElement | null;
	/** How wide the line is. 0 until it is shown. */
	room: number;
	/** How wide each id is; 0 until it has been shown. */
	widths: number[];
	/** How wide the chip is; 0 until it has been shown. */
	chipWidth: number;
	/** The lone id, for a line that has only one; null otherwise. */
	lone: HTMLElement | null;
	/**
	 * What the line is showing now: how many ids for a line with a `+N`, and
	 * for a lone id 1 when it is shortened and 0 when it is whole. A line is
	 * drawn with everything on show, and a fit that comes to what is already
	 * there writes nothing, which is what most rows do on most resizes.
	 */
	showing: number;
}

/** The space the line puts between two boxes (its CSS `gap`), in pixels. */
function gapOf(descEl: HTMLElement): number {
	const gap = Number.parseFloat(windowOf(descEl).getComputedStyle(descEl).columnGap);
	return Number.isFinite(gap) ? gap : 0;
}

/** Set `el`'s text, unless it already says it: a write that changes nothing still costs a style pass. */
function say(el: HTMLElement, text: string): void {
	if (el.textContent !== text) el.setText(text);
}

/**
 * What `line` should show, from its sizes: how many ids stay out of the count,
 * or for a lone id 1 when it is shortened and 0 when it is whole. Null while
 * the line is not on screen, or until every box in it has been measured once.
 *
 * This reads (a lone id's box, which the page shortens by itself), so every
 * line is decided before any line is written: see {@link IdsFitter.update}.
 */
function decide(line: IdsLine, gap: number): number | null {
	const { chip, room, widths, lone } = line;
	if (room <= 0) return null;
	// The page shortens a lone id when the row is too narrow for it: it is
	// shortened when its text is wider than its box.
	if (lone) return Number(lone.scrollWidth > lone.clientWidth);
	if (widths.some((width) => width <= 0) || (chip && line.chipWidth <= 0)) return null;
	return countShownIds(widths, gap, room, line.chipWidth);
}

/** Make `line` show `showing`, unless it already does. */
function show(line: IdsLine, showing: number): void {
	if (showing === line.showing) return;
	line.showing = showing;
	const { ids, chip, lone } = line;

	// A lone id that is shortened has a tooltip that says what it is in full.
	if (lone) {
		if (showing > 0) lone.setAttribute("aria-label", isolate(lone.textContent ?? ""));
		else lone.removeAttribute("aria-label");
		return;
	}

	const hidden = ids.slice(showing);
	ids.forEach((id, index) => id.toggleClass("cs-id-cut", index >= showing));
	if (chip) {
		const counted = hidden.length > 0;
		chip.toggleClass("cs-id-cut", !counted);
		// While it counts nothing the chip keeps the widest count it can be asked
		// to show, so its width, which the next fit uses, does not depend on what
		// it said before.
		say(chip, `+${counted ? hidden.length : ids.length - 1}`);
		// The tooltip lists what the chip stands for. The ids on show have nothing
		// to say, and Obsidian shows the nearest `aria-label`.
		if (counted) chip.setAttribute("aria-label", hidden.map((id) => isolate(id.textContent ?? "")).join(" "));
		else chip.removeAttribute("aria-label");
	}
}

/** How wide the box an entry is about is, with its padding. */
function borderWidth(entry: ResizeObserverEntry): number {
	return entry.borderBoxSize[0]?.inlineSize ?? entry.contentRect.width;
}

/** The ids lines one window shows, watched by one observer. */
class IdsFitter {
	/** Every box that is watched, and the line and place it belongs to. */
	private readonly watched = new Map<Element, { line: IdsLine; slot: Slot }>();
	private readonly observer: ResizeObserver | undefined;

	constructor(private readonly win: Window) {
		// Each window has its own `ResizeObserver`; one that does not (a test's) has none.
		const Observer = (win as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
		this.observer = typeof Observer === "function" ? new Observer((entries) => this.update(entries)) : undefined;
	}

	/**
	 * Start fitting `line`. The observer's first call about it says how wide
	 * everything is, and that is its first fit, before it is painted.
	 */
	add(line: IdsLine): void {
		for (const [element, slot] of IdsFitter.boxesOf(line)) {
			this.watched.set(element, { line, slot });
			this.observer?.observe(element);
		}
	}

	/** Stop fitting `line`. The last one out takes the observer down with it. */
	remove(line: IdsLine): void {
		for (const [element] of IdsFitter.boxesOf(line)) {
			this.watched.delete(element);
			this.observer?.unobserve(element);
		}
		if (this.watched.size === 0) {
			this.observer?.disconnect();
			fitters.delete(this.win);
		}
	}

	private static boxesOf(line: IdsLine): Array<[HTMLElement, Slot]> {
		const boxes: Array<[HTMLElement, Slot]> = [[line.descEl, "room"]];
		// A lone id is shortened by the page, so its width says nothing: only the line is watched.
		if (!line.lone) line.ids.forEach((id, index) => boxes.push([id, index]));
		if (line.chip) boxes.push([line.chip, "chip"]);
		return boxes;
	}

	/** Take in what the observer says changed size, then fit the lines it touched. */
	private update(entries: readonly ResizeObserverEntry[]): void {
		const touched = new Set<IdsLine>();
		for (const entry of entries) {
			const watched = this.watched.get(entry.target);
			if (!watched) continue;
			const { line, slot } = watched;
			if (slot === "room") line.room = entry.contentRect.width;
			// A box that is not shown measures 0, which says nothing about how wide
			// it is: keep what it was.
			else if (borderWidth(entry) > 0) {
				if (slot === "chip") line.chipWidth = borderWidth(entry);
				else line.widths[slot] = borderWidth(entry);
			}
			touched.add(line);
		}
		const first = touched.values().next().value;
		if (!first) return;
		// Decide every line before writing any: a read after a write makes the
		// browser lay the page out again.
		const gap = gapOf(first.descEl);
		const decisions = [...touched].map((line): [IdsLine, number | null] => [line, decide(line, gap)]);
		for (const [line, showing] of decisions) if (showing !== null) show(line, showing);
	}
}

const fitters = new WeakMap<Window, IdsFitter>();

/** The fitter of `win`, made when a line first needs it. */
function fitterFor(win: Window): IdsFitter {
	let fitter = fitters.get(win);
	if (!fitter) {
		fitter = new IdsFitter(win);
		fitters.set(win, fitter);
	}
	return fitter;
}

/**
 * Fit `descEl`'s ids line, and keep it fitted as the row's width changes.
 * Everything fits → no `+N` chip is shown.
 *
 * Returns what stops following the row.
 */
export function fitIdsLine(descEl: HTMLElement): () => void {
	const ids = Array.from(descEl.querySelectorAll<HTMLElement>(".callout-studio-row-syntax"));
	// The chip is there from the start, out of the flow and invisible, so that
	// the observer can tell how wide it is without it being shown first.
	const chip =
		ids.length > 1
			? descEl.createEl("code", {
					cls: ["callout-studio-row-syntax", "callout-studio-row-more", "cs-id-cut"],
					text: `+${ids.length - 1}`,
				})
			: null;
	// A lone id is shortened by the page, with "…", when the row is too narrow.
	const lone = ids.length === 1 ? (ids[0] ?? null) : null;
	lone?.addClass("cs-id-lone");
	const line: IdsLine = {
		descEl,
		ids,
		chip,
		lone,
		room: 0,
		widths: ids.map(() => 0),
		chipWidth: 0,
		// As drawn: every id on show, and a lone id whole.
		showing: lone ? 0 : ids.length,
	};

	// The row is drawn by one window and shown in another (utils/elementWindow.ts),
	// and what watches it has to be the one that shows it.
	return followWindow(descEl, (win) => {
		const fitter = fitterFor(win);
		fitter.add(line);
		return () => fitter.remove(line);
	});
}
