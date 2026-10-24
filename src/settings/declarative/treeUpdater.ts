/**
 * settings/declarative/treeUpdater.ts — when the settings tree is rebuilt.
 *
 * Who calls it. The settings tab: every change that the settings pages show
 * (a callout saved, a theme switched, saving paused, …) asks for an update
 * through {@link TreeUpdater.request}.
 *
 * The main idea. Obsidian redraws the open settings page only when the tab
 * calls `update()`, and every `update()` rebuilds every row of that page
 * (docs/internals-docs/26-declarative-settings.md). So updates are kept rare,
 * and harmless:
 *
 * - **Coalesced.** Any number of requests before the next frame make one
 *   update, never one per change, and never in the middle of drawing a row
 *   (a request made while a row draws waits for the frame like any other).
 * - **Skipped when nothing shown changed.** The tab gives a signature, one
 *   string that says everything the pages show; an update whose signature is
 *   the one already drawn is skipped, unless the request forces it.
 * - **Held while the user is in the middle of something** a redraw would cut
 *   short: an open menu, an open picker list, a drag. The update waits, tick by
 *   tick, until that is over (or a safety limit passes).
 * - **Delivered even when the settings window is hidden or closed.** A frame
 *   only comes from a visible window, so a timer is the backup. The tree must
 *   be current when the settings open again: opening them draws the last tree
 *   stored, it does not ask for a new one.
 */
import { cancelFrame, requestFrameFor, type FrameHandle } from "../../utils/elementFrame";

/** Starts a wait; returns what cancels it. */
export type Scheduler = (run: () => void) => () => void;

/** How long the backup timer waits for a frame that may not come. */
const BACKUP_DELAY_MS = 250;

/**
 * How many ticks an update may be held before it runs anyway: about ten
 * seconds, so a menu element that never went away cannot stop updates for good.
 */
const MAX_HELD_TICKS = 40;

/** What the updater is told by the tab. */
export interface TreeUpdaterOptions {
	/** One string for everything the settings pages show now. */
	signature(): string;
	/** Rebuild the tree and redraw the open page: the tab's own `update()`. */
	update(): void;
	/** Whether the user is in the middle of something a redraw would cut short. */
	isBusy(): boolean;
	/** How to wait for the next chance to run (a frame, with a backup timer). */
	schedule: Scheduler;
}

export class TreeUpdater {
	/** The signature of the tree last drawn; null before the first update. */
	private drawnSignature: string | null = null;
	/** Cancels the wait in progress; null when none is. */
	private cancelWait: (() => void) | null = null;
	/** Whether a waiting request must run even if the signature has not moved. */
	private forced = false;
	/** How many ticks in a row the update has been held. */
	private heldTicks = 0;

	constructor(private readonly options: TreeUpdaterOptions) {}

	/**
	 * Ask for an update at the next chance.
	 *
	 * @param force Run it even if the signature has not changed: for a change
	 *   the signature cannot see (an icon finishing its download, say).
	 */
	request(force = false): void {
		this.forced ||= force;
		if (this.cancelWait) return;
		this.cancelWait = this.options.schedule(() => this.tick());
	}

	/**
	 * Note that the tree was just drawn by someone else (the tab opening, or
	 * an `update()` made directly), so the next request compares with it.
	 */
	markDrawn(): void {
		this.drawnSignature = this.options.signature();
	}

	/** Stop any wait in progress (the plugin unloading). */
	dispose(): void {
		this.cancelWait?.();
		this.cancelWait = null;
		this.forced = false;
		this.heldTicks = 0;
	}

	/** One chance to run: wait again if the user is busy, else update if needed. */
	private tick(): void {
		this.cancelWait = null;
		if (this.options.isBusy() && this.heldTicks < MAX_HELD_TICKS) {
			this.heldTicks++;
			this.request();
			return;
		}
		this.heldTicks = 0;
		const signature = this.options.signature();
		const changed = signature !== this.drawnSignature;
		if (!changed && !this.forced) return;
		this.forced = false;
		this.drawnSignature = signature;
		this.options.update();
	}
}

/**
 * The scheduler the tab uses: the next frame of the window showing `el`, or a
 * timer a moment later if that window is hidden or gone, whichever comes first.
 *
 * @param el Returns the element whose window should give the frame; read
 *   when the wait starts, because the settings can move between windows.
 */
export function nextFrameOrSoon(el: () => Element): Scheduler {
	return (run) => {
		let done = false;
		let frame: FrameHandle | null = null;
		let timer: number | null = null;
		// Stop whichever of the two waits is still pending.
		const stopWaiting = (): void => {
			frame = cancelFrame(frame);
			if (timer !== null) window.clearTimeout(timer);
			timer = null;
		};
		// Runs `run` once, whichever of the two fires first.
		const finish = (): void => {
			if (done) return;
			done = true;
			stopWaiting();
			run();
		};
		frame = requestFrameFor(el(), finish);
		if (!done) timer = window.setTimeout(finish, BACKUP_DELAY_MS);
		return () => {
			done = true;
			stopWaiting();
		};
	};
}

/**
 * The plugin's picker lists, each with the class it wears while closed. (An
 * Obsidian menu has no closed state: it is taken off the page when it closes.)
 */
const PICKER_LISTS = [
	{ list: "cs-combobox-menu", closed: "cs-combobox-menu-hidden" },
	{ list: "cs-palette-menu", closed: "cs-palette-menu-hidden" },
];

/**
 * Whether the user is in the middle of something in `doc` that a redraw would
 * cut short: a drag (Obsidian and the plugin both put `is-grabbing` on the
 * body while dragging), an open Obsidian menu, or an open picker list.
 */
export function interactionInProgress(doc: Document): boolean {
	if (doc.body.hasClass("is-grabbing")) return true;
	if (doc.querySelector(".menu")) return true;
	return PICKER_LISTS.some(({ list, closed }) =>
		Array.from(doc.querySelectorAll(`.${list}`)).some((el) => !el.hasClass(closed)));
}
