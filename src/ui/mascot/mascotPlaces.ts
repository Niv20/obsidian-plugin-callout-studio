/**
 * ui/mascot/mascotPlaces.ts — where the brush mascot appears, and what it does
 * there.
 *
 * Who uses it. Every screen that shows the mascot calls one helper from here,
 * so the screens themselves stay one line longer and no more:
 *
 * - empty lists in the settings (My callout types, Saved color palettes,
 *   Custom commands): {@link emptyListState} and {@link watchEmptyListMascots};
 * - empty states that are drawn again on every change (a search, a sidebar):
 *   {@link KeptMascot} and {@link SearchMascot};
 * - confirmations (beside the two-line heading): {@link addConfirmMascot}, through
 *   ConfirmModal's `withMascot`;
 * - notices: mascotNotices.ts, which builds on {@link addMascot};
 * - anywhere else: {@link addMascot}.
 *
 * The main idea. The mascot is decoration. Where it cannot be drawn (most test
 * suites, see `canDrawMascot`), every helper quietly leaves it out and the
 * screen works exactly as it did without it. Its colours come from the theme:
 * a grey brush (`--text-muted`) and paint in the accent colour (styles.css).
 *
 * Two kinds of place, two habits. In a window that closes again soon (a
 * confirmation), a mood is held, moving, for as long as the state lasts. In
 * a place that can stay open for hours (the settings lists, a sidebar), the
 * mascot reacts once and goes back to being the icon, with a peek now and
 * then at most, or keeps a face that rests still (`KeptMascot.setMood`): a
 * loop nobody asked for would only spend the battery.
 */
import { BrushMascot, canDrawMascot, type MascotHold } from "./brushMascot";
import { NO_RESULTS_MOOD, type MascotAnimationName } from "./mascotAnimations";

/** How big the mascot is drawn. Each size is a class on its box (styles.css). */
export type MascotSize = "notice" | "small" | "medium" | "large";

/** Where in its parent the mascot's box goes. */
type Where = "start" | "end";

/** How long an idle list waits between peeks. */
const IDLE_PEEK_MS = 9000;
/** How long after the last key press a search stops looking around. */
const LOOK_AFTER_TYPING_MS = 700;

/** The span the mascot is drawn in: its size, and any extra classes the place needs. */
function mascotBox(size: MascotSize, extraCls: string[] = []): HTMLElement {
	return createSpan({ cls: ["cs-mascot-box", `is-${size}`, ...extraCls] });
}

/** Put `box` at the start or the end of `parent` (moving it, if it was elsewhere). */
function place(parent: HTMLElement, box: HTMLElement, where: Where): void {
	if (where === "start") parent.insertBefore(box, parent.firstChild);
	else parent.appendChild(box);
}

/**
 * A mascot in a box of its own inside `parent`. Returns null where the
 * mascot cannot be drawn; the caller then simply goes on without it.
 */
export function addMascot(parent: HTMLElement, size: MascotSize, where: Where = "end", extraCls: string[] = []): BrushMascot | null {
	if (!canDrawMascot()) return null;
	const box = mascotBox(size, extraCls);
	place(parent, box, where);
	// A notice's mascot is not played with: the notice is gone in a few seconds.
	return new BrushMascot(box, { interactive: size !== "notice" });
}

/* ---- Empty states that are drawn again and again ---- */

/**
 * One mascot kept across redraws. A list that draws its empty state again on
 * every change (each key typed into a search, each refresh of a sidebar) puts
 * the same mascot back each time, so it carries on with whatever it was
 * doing instead of starting over.
 */
export class KeptMascot {
	private box: HTMLElement | null = null;
	private mascot: BrushMascot | null = null;
	/** The animation held while the mascot is shown, if any. */
	private mood: { name: MascotAnimationName; hold: MascotHold } | null = null;

	constructor(private readonly size: MascotSize) {}

	/** Whether the mascot is on the page now. */
	get shown(): boolean {
		return this.box?.isConnected ?? false;
	}

	/** Put the mascot into `parent`, moving it from wherever it was. Null where it cannot be drawn. */
	attach(parent: HTMLElement, where: Where = "start"): BrushMascot | null {
		if (!canDrawMascot()) return null;
		if (!this.box) {
			this.box = mascotBox(this.size);
			this.mascot = new BrushMascot(this.box);
		}
		place(parent, this.box, where);
		return this.mascot;
	}

	/**
	 * Keep `name` while the mascot is shown, or let go with null. Asking again
	 * for the mood already held changes nothing, so a redraw can ask on every
	 * draw without restarting it.
	 *
	 * The mood is held still: the face comes, plays its body once and rests,
	 * with no frames, for as long as the state lasts. These states can stay on
	 * screen for hours (a sidebar that found nothing, the saving banner), and a
	 * face that keeps breathing there would keep the window drawing all along.
	 */
	setMood(name: MascotAnimationName | null): void {
		// `active` turns false if the mascot was stopped (taken off the page) meanwhile.
		if (this.mood?.name === name && this.mood.hold.active) return;
		this.mood?.hold.release();
		this.mood = name && this.mascot ? { name, hold: this.mascot.hold(name, "still") } : null;
	}

	/** Play `name` once (over the mood, which comes back after it). */
	play(name: MascotAnimationName): Promise<void> {
		return this.mascot?.play(name) ?? Promise.resolve();
	}

	/** Hold `name` on top of the mood until the returned hold is released. */
	hold(name: MascotAnimationName): MascotHold | null {
		return this.mascot?.hold(name) ?? null;
	}

	/** Take the mascot off the page, back to the plain icon, ready to be attached again. */
	detach(): void {
		this.mood = null;
		this.mascot?.stop();
		this.box?.remove();
	}
}

/**
 * The mascot of a search that found nothing. When the search turns up empty it
 * looks around (three glances), shakes its head "no" and is sad, and stays sad
 * for as long as nothing matches. While the query keeps changing it looks around
 * again, and once the typing pauses with nothing found it shakes its head "no"
 * once more and goes back to being sad.
 *
 * The owner calls {@link showEmpty} when it draws the empty state,
 * {@link hide} when it draws results, and {@link typed} after each change of
 * the query (after drawing, so the mascot is already where it should be). An
 * owner that does not call {@link typed} still gets the head shake: drawing the
 * empty state again counts as the query having changed.
 */
export class SearchMascot {
	private readonly kept = new KeptMascot("medium");
	private look: MascotHold | null = null;
	/** Ends the looking and gives the answer once the query has been still for a moment. */
	private settleTimer = 0;
	/** Whether the search has been empty since the last {@link hide}: the first round is for the moment it turns empty. */
	private empty = false;
	/** Whether that first round is still playing: it ends with the head shake itself, so nothing is added to it. */
	private searching = false;

	/** Nothing matches: show the mascot above the words in `host`, sad. */
	showEmpty(host: HTMLElement): void {
		if (!this.kept.attach(host, "start")) return;
		host.addClass("cs-mascot-line");
		// The sadness is held. The looking is played over it, and when it ends the
		// mascot goes on as sad from the face it has, never through the plain icon.
		this.kept.setMood(NO_RESULTS_MOOD);
		if (!this.empty) {
			this.searching = true;
			void this.kept.play("lookTwice").then(() => { this.searching = false; });
		} else {
			// A redraw of the same empty search (the next key): no new round of looking,
			// but when the typing pauses with nothing found it shakes its head again.
			this.settleLater();
		}
		this.empty = true;
	}

	/** Something matches: put the mascot away. */
	hide(): void {
		this.empty = false;
		this.endLook();
		this.kept.detach();
	}

	/** The query changed: look around for a moment, if the mascot is showing. */
	typed(): void {
		if (!this.kept.shown) return;
		// Held on top of "sad", so letting go of it goes back to sad.
		if (!this.look?.active) this.look = this.kept.hold("look");
		this.settleLater();
	}

	/** Wait for the typing to pause, then {@link settle}. Every key starts the wait again. */
	private settleLater(): void {
		window.clearTimeout(this.settleTimer);
		this.settleTimer = window.setTimeout(() => this.settle(), LOOK_AFTER_TYPING_MS);
	}

	/**
	 * The typing has paused: stop looking, and if there is still nothing to find
	 * answer with a shake of the head, which goes back to being sad when it ends.
	 * Not while the first round is playing (it has its own shake at the end), and
	 * not once something matched (`hide` has put the mascot away).
	 */
	private settle(): void {
		this.endLook();
		if (this.empty && !this.searching && this.kept.shown) void this.kept.play("no");
	}

	private endLook(): void {
		window.clearTimeout(this.settleTimer);
		this.look?.release();
		this.look = null;
	}
}

/* ---- Empty lists in the settings ---- */

/**
 * What an empty settings list shows (its `emptyState`): the text, with a
 * place above it for the mascot. Obsidian draws the list's empty row from a
 * copy of this, and a copy of an element carries nothing alive, so this holds
 * only an empty slot; {@link watchEmptyListMascots} puts a live mascot into
 * the copy once it is on the page.
 *
 * @param addLabel The list's add action's name (`addItem.name`): its + button
 *   carries it as its tooltip, which is how the mascot finds it.
 */
export function emptyListState(text: string, addLabel: string, size: MascotSize = "medium"): string | DocumentFragment {
	if (!canDrawMascot()) return text;
	const fragment = createFragment();
	const wrap = fragment.createDiv({ cls: "cs-mascot-empty" });
	wrap.createSpan({ cls: ["cs-mascot-slot", `is-${size}`], attr: { "data-add-label": addLabel } });
	wrap.createSpan({ text });
	return fragment;
}

/**
 * While the settings are open, bring to life every mascot slot that appears
 * under `root`, now or later (a sub-page sliding in, a list becoming empty).
 * Returns what stops watching and puts every mascot it woke back to sleep.
 */
export function watchEmptyListMascots(root: HTMLElement): () => void {
	if (!canDrawMascot()) return () => {};
	const awake: AwakeSlot[] = [];
	const wake = (): void => {
		for (const slot of Array.from(root.querySelectorAll<HTMLElement>(".cs-mascot-slot"))) {
			if (!slot.hasClass("is-awake")) awake.push(awakenSlot(slot));
		}
	};
	// Any change under the settings may have drawn a new empty row.
	const observer = new MutationObserver(wake);
	observer.observe(root, { childList: true, subtree: true });
	wake();
	return () => {
		observer.disconnect();
		for (const slot of awake.splice(0)) slot.sleep();
	};
}

/** A slot brought to life, and what puts it back to sleep. */
interface AwakeSlot {
	sleep(): void;
}

/**
 * One empty list's mascot: a peek now and then, and excited while the pointer
 * is on the list's +.
 */
function awakenSlot(slot: HTMLElement): AwakeSlot {
	slot.addClass("is-awake");
	// Obsidian clips a row's name, which would cut the ring of paint a press spreads (styles.css).
	const nameEl = slot.closest<HTMLElement>(".setting-item-name");
	nameEl?.addClass("cs-paint-room");
	const mascot = new BrushMascot(slot);
	const undo: (() => void)[] = [];
	const add = findAddControl(slot);
	if (add) {
		undo.push(mascot.hover(add, "excited"));
	}
	let asleep = false;
	let timer = 0;
	const sleep = (): void => {
		if (asleep) return;
		asleep = true;
		window.clearTimeout(timer);
		for (const step of undo) step();
		mascot.destroy();
		slot.removeClass("is-awake");
		nameEl?.removeClass("cs-paint-room");
	};
	// One timer at a time, each setting the next, rather than an interval: it
	// stops by itself once the row has gone, and `sleep` stops it at the end of
	// the visit (which the plugin's unload ends too).
	const peekLater = (): void => {
		timer = window.setTimeout(() => {
			// The row went away (the list has items now, or the page was left).
			if (!slot.isConnected) {
				sleep();
				return;
			}
			if (!mascot.current && !slot.ownerDocument.hidden) void mascot.play("peek");
			peekLater();
		}, IDLE_PEEK_MS);
	};
	peekLater();
	return { sleep };
}

/**
 * The list's +, found from inside its empty row: on a computer, the button in
 * the box's heading whose tooltip is the add action's name; on a phone, the
 * last "+ Name" row of the list.
 */
function findAddControl(slot: HTMLElement): HTMLElement | null {
	const label = slot.getAttribute("data-add-label");
	const box = slot.closest<HTMLElement>(".setting-group");
	if (!label || !box) return null;
	const phoneRow = box.querySelector<HTMLElement>(".mod-add-item");
	if (phoneRow) return phoneRow;
	for (const el of Array.from(box.querySelectorAll<HTMLElement>("[aria-label]"))) {
		if (el.getAttribute("aria-label") === label) return el;
	}
	return null;
}

/* ---- Confirmations ---- */

/**
 * The mascot at the start of a confirmation's heading, beside the title and the
 * subtitle under it (`ConfirmModal`), scared for as long as it is open.
 * Whatever the question, it is the same size and its two buttons
 * answer the same way: it cries while the pointer is on the confirm button,
 * and breathes out in relief while the pointer is on Cancel or on the window's
 * ✕ (both close the window at once, so that is the moment there is to show
 * it). Every confirmation looking and reacting alike is the point: one that
 * did not looked like one that had forgotten to.
 *
 * @param headerEl The window's heading row (the title's parent), which gets
 *   `cs-mascot-header`: the brush in a column of its own, the title and the
 *   subtitle in the other (styles.css).
 * @param findControls The window's confirm button, Cancel button and ✕ (the
 *   phone has no ✕); asked only once the mascot is known to be drawn.
 * @returns What takes it all down again, for the window's `onClose`.
 */
export function addConfirmMascot(
	headerEl: HTMLElement,
	findControls: () => { confirm: HTMLElement | null; cancel: HTMLElement | null; close: HTMLElement | null },
): () => void {
	const mascot = addMascot(headerEl, "medium", "start");
	if (!mascot) return () => {};
	headerEl.addClass("cs-mascot-header");
	const worry = mascot.hold("scared");
	const { confirm, cancel, close } = findControls();
	const undo: (() => void)[] = [];
	if (confirm) undo.push(mascot.hover(confirm, "cry"));
	if (cancel) undo.push(mascot.hover(cancel, "relief"));
	if (close) undo.push(mascot.hover(close, "relief"));
	return () => {
		for (const step of undo) step();
		worry.release();
		// The mascot's box, which `destroy()` leaves behind, goes with it.
		const box = mascot.svg.parentElement;
		mascot.destroy();
		box?.remove();
		headerEl.removeClass("cs-mascot-header");
	};
}

