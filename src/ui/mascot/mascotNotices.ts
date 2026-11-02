/**
 * ui/mascot/mascotNotices.ts — every notice the plugin shows, with the mascot
 * beside its words.
 *
 * Who uses it. Every place that tells the user something in a notice calls
 * {@link showNotice} (or {@link workNotice} for work that takes a while), never
 * `new Notice` directly. A test (tests/repoSourceRules.test.ts) keeps it that
 * way, so a notice added later gets the mascot without anyone remembering to.
 * The one notice with a button, `showActionNotice` (ui/noticeAction.ts), is
 * built on {@link showNotice} too.
 *
 * The main idea. The mascot arrives as the plain icon and keeps still for a
 * moment, so the eye reads the words first; then it plays its mood until the
 * notice is gone. Nothing has to end it: the engine stops by itself once the
 * notice has left the page (see `BrushMascot.wake`).
 *
 * Which animation. A notice says what kind of news it brings, and every kind
 * has one animation of its own, always the same (`NOTICE_MOODS`): a user who
 * has seen the mascot nod at "nothing to do" knows it again next time, and a
 * blocked action is always the shaken head. The kinds are few and unlike each
 * other, so the faces tell the news apart before the words are read.
 *
 * Where the mascot cannot be drawn (most test suites, see `canDrawMascot`)
 * every helper here is the plain notice it always was.
 */
import { Notice } from "obsidian";
import { noticeDuration } from "../noticeDuration";
import { canDrawMascot, type MascotHold } from "./brushMascot";
import { ANIMATIONS, type MascotAnimationName, type Step } from "./mascotAnimations";
import { addMascot } from "./mascotPlaces";

/**
 * What a notice does with the mascot: its kinds of news, each with its animation.
 *
 * Choosing a kind. Ask what the notice tells the user, not how it ends:
 * - `success`: something worked, or good news arrived;
 * - `celebrate`: a bigger job is finished (an import, a scan that found
 *   something, a conversion, a full reset);
 * - `restored`: something is back (an undo, a restored version, saving on again);
 * - `upToDate`: there was nothing to do, or nothing to change: all is well;
 * - `notFound`: what was asked for is not there (nothing to wrap, a note that
 *   is gone, an empty clipboard);
 * - `blocked`: the user's request cannot be done as asked (a missing name, a
 *   conflicting ID, a read-only preview);
 * - `problem`: something failed and nothing was done;
 * - `warning`: something was done only in part, or needs a second look (some
 *   notes could not be updated, changes kept aside);
 * - `paused`: saving is paused; nothing is lost, nothing is kept either;
 * - `info`: something to know, nothing to be done.
 */
export const NOTICE_MOODS = {
	success: "happy",
	celebrate: "celebrate",
	restored: "relief",
	upToDate: "nod",
	notFound: "look",
	blocked: "no",
	problem: "sad",
	warning: "surprised",
	paused: "hold",
	info: "hello",
} as const satisfies Record<string, MascotAnimationName>;

/** What kind of news a notice brings; see {@link NOTICE_MOODS}. */
export type NoticeKind = keyof typeof NOTICE_MOODS;

/** What the mascot does in a notice that stays up while work runs. */
const WORKING: MascotAnimationName = "paint";

/** How long the mascot keeps still before it starts to move. */
const STILL_MS = 400;

/**
 * Put the mascot at the start of `notice`: still for `stillMs`, then `name`
 * for as long as the notice stays. With no stillness the mascot moves from the
 * first frame. Returns what ends it early, for a notice that is taken away by
 * hand.
 */
function addNoticeMascot(notice: Notice, name: MascotAnimationName, stillMs = STILL_MS): () => void {
	const mascot = addMascot(notice.containerEl, "notice", "start");
	if (!mascot) return () => {};
	notice.containerEl.addClass("cs-mascot-notice");
	// Nothing to wait for: the engine itself stops once the notice has left the page.
	if (stillMs <= 0) {
		const now = mascot.hold(name);
		return () => now.release();
	}
	let mood: MascotHold | null = null;
	const timer = window.setTimeout(() => {
		// A notice clicked away within the moment it keeps still is gone already.
		if (mascot.svg.isConnected) mood = mascot.hold(name);
	}, stillMs);
	return () => {
		window.clearTimeout(timer);
		mood?.release();
	};
}

/**
 * Show `message` in a notice, the mascot beside it playing the animation of
 * `kind`.
 *
 * @param kind What the notice tells the user; see {@link NOTICE_MOODS}.
 * @param message The notice's sentence.
 * @param duration How long the notice stays, in milliseconds; 0 keeps it up
 *   until it is clicked or hidden. Left out, it follows the length of the
 *   sentence (ui/noticeDuration.ts).
 */
export function showNotice(kind: NoticeKind, message: string, duration?: number): Notice {
	const notice = new Notice(message, duration ?? noticeDuration(message));
	if (canDrawMascot()) addNoticeMascot(notice, NOTICE_MOODS[kind]);
	return notice;
}

/** How long the steps take one after the other, in milliseconds. */
const lasts = (steps: Step[]): number => steps.reduce((total, step) => total + step.ms, 0);

/**
 * How long a work notice has to stay up for the mascot to be seen painting
 * one whole stroke: getting ready, and one pass of the animation's body (a
 * work notice's mascot does not keep still first, see {@link workNotice}).
 * Worked out from the animation itself, so it stays right when the painting
 * is retimed.
 */
export const WORK_ONE_PASS_MS = lasts(ANIMATIONS[WORKING].intro) + lasts(ANIMATIONS[WORKING].body);

/**
 * The quiet between a work notice going away and the notice that tells its
 * result coming, in milliseconds, for a caller to pass as the `gapMs` of
 * {@link workNotice}. Without it the two notices follow each other with no
 * time to read the first one or to notice the second.
 */
export const BEFORE_RESULT_MS = 250;

/** What a {@link workNotice} does besides staying up while the work runs. */
export interface WorkNoticeOptions {
	/**
	 * The least time the notice stays up, in milliseconds, however quickly the
	 * work ends: work that takes a blink would otherwise take the notice away
	 * before the mascot has started to move.
	 */
	minMs?: number;
	/**
	 * How long to wait after the notice is gone before `done()` resolves, so
	 * the next notice does not land on its heels.
	 */
	gapMs?: number;
}

/** A notice that stays up while some work runs, from {@link workNotice}. */
export interface WorkNotice {
	/**
	 * Resolves once the notice has been painted and the mascot's first frames
	 * have run. A caller whose work would hog the page awaits it before
	 * starting, so the brush is already moving instead of waiting for the work.
	 */
	painted(): Promise<void>;
	/**
	 * The work is over: take the notice away, once it has been up for its
	 * `minMs`. Resolves when the notice is gone and its `gapMs` has passed,
	 * which is the moment to show the next notice; a caller that has nothing
	 * to show after it need not wait for it. Calling it again does nothing
	 * new and returns the same wait.
	 */
	done(): Promise<void>;
}

/** Wait `ms` milliseconds. */
function pause(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Wait for two animation frames, so a notice just added has been drawn and the
 * mascot has run its first frame. A hidden window gets no frames, so a short
 * timer ends the wait there.
 */
function nextPaint(): Promise<void> {
	return new Promise((resolve) => {
		const fallback = window.setTimeout(resolve, 120);
		window.requestAnimationFrame(() =>
			window.requestAnimationFrame(() => {
				window.clearTimeout(fallback);
				resolve();
			}),
		);
	});
}

/**
 * A notice that stays up while some work runs, the mascot painting away
 * beside its words, until `done()`. It is there to give the mascot a place
 * while the work runs, so where the mascot cannot be drawn there is no
 * notice at all, as before, and `done()` has nothing to wait for.
 */
export function workNotice(message: string, options: WorkNoticeOptions = {}): WorkNotice {
	if (!canDrawMascot()) return { painted: () => Promise.resolve(), done: () => Promise.resolve() };
	// 0: Obsidian leaves the notice up until it is hidden.
	const notice = new Notice(message, 0);
	// No moment of stillness: work notices are there to be seen at work, so the
	// brush starts to move the moment the notice does.
	const end = addNoticeMascot(notice, WORKING, 0);
	const shownAt = Date.now();
	// Everything before the first await runs at once: with no minimum left
	// to wait out, the notice is taken away the moment `done()` is called.
	const finish = async (): Promise<void> => {
		const left = (options.minMs ?? 0) - (Date.now() - shownAt);
		if (left > 0) await pause(left);
		end();
		notice.hide();
		if (options.gapMs) await pause(options.gapMs);
	};
	// The first `done()` starts the ending; later calls get the same promise.
	let ending: Promise<void> | null = null;
	return {
		painted: nextPaint,
		done: () => (ending ??= finish()),
	};
}
