/**
 * ui/mascot/mascotPlay.ts — what the brush mascot does when the pointer plays
 * with it.
 *
 * Who uses it. The engine (brushMascot.ts) switches this on for every mascot
 * except the ones in notices, which stay as they were: a notice is gone in a few
 * seconds and has no time to be played with. Its `hover()` is {@link hoverMood}
 * here too: a mood held while the pointer is over a button the caller names.
 *
 * The main idea. The mascot reacts to the pointer in three ways, from gentle to
 * not at all gentle, and every mascot reacts to a press the same way, whatever
 * it was doing:
 *
 * - **Coming near.** On or just around the icon, a mascot that is only the icon
 *   pops its eyes out, blinks, and keeps its eyes on the pointer, until the
 *   pointer goes away again. (One that holds a mood keeps its face.)
 * - **A poke.** Pressing it dents it where it was pressed (the brush goes in on
 *   that side, stays in while the press lasts, and springs back), with a ring of
 *   paint spreading from the spot, and it screws its eyes shut for as long as it
 *   is pressed.
 * - **Too many pokes.** Four within a couple of seconds and it has had enough:
 *   it glares, goes red, stamps and blows steam, for as long as the poking goes
 *   on. The same everywhere, the welcome window's included.
 *
 * A mood somebody gave the mascot (sad above a search that found nothing,
 * scared in a confirmation) is not lost: the squint and the glare are held or
 * played on top of it, and when they are over the mascot goes back to it.
 */
import type { BrushMascot, MascotHold } from "./brushMascot";
import type { MascotAnimationName } from "./mascotAnimations";
import { toFace, type Vec } from "./mascotFace";

/** This many pokes within {@link ANGER_WINDOW_MS} and the mascot loses its temper. */
const ANGER_PRESSES = 4;
const ANGER_WINDOW_MS = 2200;
/** How far the eyes turn toward the pointer, in face units (an eye is about two across). */
const GAZE_REACH = 0.7;
/** The icon is drawn on a 24 × 24 grid. */
const ICON_SIZE = 24;

/**
 * Let the pointer play with `mascot`, through `zone` (the box the mascot is
 * drawn in, with a little room around it: styles.css `is-playful`).
 *
 * @returns What takes it all away again.
 */
export function playWith(mascot: BrushMascot, zone: HTMLElement): () => void {
	zone.addClass("is-playful");
	const undo: (() => void)[] = [() => zone.removeClass("is-playful")];
	const on = <
		K extends "pointerenter" | "pointerleave" | "pointermove" | "pointerdown" | "pointerup" | "pointercancel",
	>(
		type: K,
		listener: (event: HTMLElementEventMap[K]) => void,
	): void => {
		zone.addEventListener(type, listener);
		undo.push(() => zone.removeEventListener(type, listener));
	};

	/** The animation held while the pointer is near, and the one held while it is pressed. */
	let near: MascotHold | null = null;
	let sore: MascotHold | null = null;
	/** Lets go of the dent the current press made. */
	let letGoOfDent: (() => void) | null = null;
	/** When the last few presses happened. */
	const presses: number[] = [];

	/** Whether somebody else's mood is showing; the two holds above are this file's own. */
	const hasMood = (): boolean => mascot.holdCount - (near?.active ? 1 : 0) - (sore?.active ? 1 : 0) > 0;

	// A finger has no hover: its tap is a poke, and that is all.
	on("pointerenter", (event) => {
		if (event.pointerType === "touch" || hasMood() || near?.active) return;
		near = mascot.hold("notice");
	});
	on("pointermove", (event) => {
		if (event.pointerType !== "touch") mascot.lookToward(gazeToward(mascot.svg, event));
	});
	on("pointerdown", (event) => {
		// The main button, a finger or a pen; not a right click.
		if (event.button !== 0) return;
		const now = performance.now();
		presses.push(now);
		while (presses.length > 0 && now - presses[0]! > ANGER_WINDOW_MS) presses.shift();
		// Pokes that follow quickly on each other push harder.
		letGoOfDent = mascot.poke(iconPoint(mascot.svg, event), Math.min(1.5, 1 + 0.15 * (presses.length - 1)));
		// On top of whatever is held: letting go of it shows the mood underneath again.
		if (!sore?.active) sore = mascot.hold("ouch");
		if (presses.length >= ANGER_PRESSES) void mascot.play("angry");
	});

	/** The press is over, or the pointer left with the button still down. */
	const letGo = (): void => {
		letGoOfDent?.();
		letGoOfDent = null;
		sore?.release();
		sore = null;
	};
	on("pointerup", letGo);
	on("pointercancel", letGo);
	on("pointerleave", () => {
		letGo();
		near?.release();
		near = null;
		mascot.lookToward(null);
	});

	return () => {
		letGo();
		near?.release();
		mascot.lookToward(null);
		for (const step of undo) step();
	};
}

/**
 * {@link BrushMascot.hover}: hold `name` on `mascot` while the pointer is over
 * `target` or it has keyboard focus, or with `"once"` play it once each time
 * the pointer comes onto `target`. Here beside the pointer's other play, so
 * the engine itself stays about frames and poses.
 */
export function hoverMood(
	mascot: BrushMascot,
	target: HTMLElement,
	name: MascotAnimationName,
	how: "hold" | "once",
): () => void {
	if (how === "once") {
		const arrive = (e: PointerEvent): void => {
			if (e.pointerType !== "touch") void mascot.play(name);
		};
		target.addEventListener("pointerenter", arrive);
		return () => target.removeEventListener("pointerenter", arrive);
	}
	let hovered = false;
	let focused = false;
	let held: MascotHold | null = null;
	const sync = (): void => {
		const want = hovered || focused;
		// `stop()` drops every hold, so ask the hold rather than trusting a flag.
		if (want && !held?.active) held = mascot.hold(name);
		if (!want && held) {
			held.release();
			held = null;
		}
	};
	const enter = (e: PointerEvent): void => {
		if (e.pointerType === "touch") return;
		hovered = true;
		sync();
	};
	const leave = (): void => {
		hovered = false;
		sync();
	};
	// Only keyboard focus counts: a click also focuses a button, and the
	// mascot should not stay excited after the pointer has moved away.
	const focusIn = (): void => {
		focused = target.matches(":focus-visible") || target.querySelector(":focus-visible") !== null;
		sync();
	};
	const focusOut = (): void => {
		focused = false;
		sync();
	};
	target.addEventListener("pointerenter", enter);
	target.addEventListener("pointerleave", leave);
	target.addEventListener("focusin", focusIn);
	target.addEventListener("focusout", focusOut);
	return () => {
		hovered = focused = false;
		sync();
		target.removeEventListener("pointerenter", enter);
		target.removeEventListener("pointerleave", leave);
		target.removeEventListener("focusin", focusIn);
		target.removeEventListener("focusout", focusOut);
	};
}

/** Where `event` landed, on the icon's own 24 × 24 grid; outside it when the pointer is just around it. */
function iconPoint(svg: SVGSVGElement, event: PointerEvent): Vec {
	const box = svg.getBoundingClientRect();
	return [
		((event.clientX - box.left) / (box.width || 1)) * ICON_SIZE,
		((event.clientY - box.top) / (box.height || 1)) * ICON_SIZE,
	];
}

/**
 * Where the eyes look to see the pointer: from the middle of the icon toward
 * it, in face units. Close to the icon they look right at it; far away they
 * settle on its direction, never turning further than {@link GAZE_REACH}.
 */
function gazeToward(svg: SVGSVGElement, event: PointerEvent): Vec {
	const box = svg.getBoundingClientRect();
	const dx = event.clientX - (box.left + box.width / 2);
	const dy = event.clientY - (box.top + box.height / 2);
	const length = Math.hypot(dx, dy) || 1;
	const [s, t] = toFace(dx / length, dy / length);
	const strength = Math.min(1, length / (box.width || 1)) * GAZE_REACH;
	return [s * strength, t * strength];
}
