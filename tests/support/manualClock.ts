/**
 * tests/support/manualClock.ts - a scheduler whose time only moves when a test
 * says so.
 *
 * `QuietGate` takes its timers as a `(callback, delayMs) => cancel` function,
 * so a suite can state exactly when a burst goes quiet instead of racing a real
 * timer. Timers fire in the order of their time, and one a callback arms
 * inside the window being advanced fires in that same advance.
 */
import type { GateScheduler } from "../../src/utils/quietGate";

export interface ManualClock {
	schedule: GateScheduler;
	/** Move time forward, firing what falls due on the way. */
	advance(ms: number): void;
	/** How many timers are armed and not yet fired or cancelled. */
	pending(): number;
}

/** `cancellable: false` models a timer that cannot be taken back once armed. */
export function manualClock(cancellable = true): ManualClock {
	let now = 0;
	let next = 0;
	const timers = new Map<number, { at: number; callback: () => void }>();
	const schedule: GateScheduler = (callback, delayMs) => {
		const id = next++;
		timers.set(id, { at: now + delayMs, callback });
		return () => {
			if (cancellable) timers.delete(id);
		};
	};
	const advance = (ms: number): void => {
		const target = now + ms;
		for (;;) {
			const due = [...timers.entries()]
				.filter(([, timer]) => timer.at <= target)
				.sort((a, b) => a[1].at - b[1].at)[0];
			if (!due) break;
			now = due[1].at;
			timers.delete(due[0]);
			due[1].callback();
		}
		now = target;
	};
	return { schedule, advance, pending: () => timers.size };
}
