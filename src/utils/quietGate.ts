/**
 * utils/quietGate.ts - act at once, then once more when a burst has ended.
 *
 * Some events come in storms: dragging a slider or a colour picker fires one
 * `css-change` per step, a few dozen a second. Work that answers "what is the
 * state now?" has no use for every step, but it must not wait when the event
 * stands alone either - a theme switch is judged the moment it lands.
 *
 * The first request of a burst runs at once. The rest are folded into one more
 * run, made when requests have been quiet for `quietMs`, or `maxMs` after the
 * burst began, whichever is first, so a source that never stops is still
 * answered. That trailing run opens the next burst, so a storm costs about one
 * run per `maxMs`, not one per event.
 */
export type GateScheduler = (callback: () => void, delayMs: number) => () => void;

const windowTimer: GateScheduler = (callback, delayMs) => {
	const timer = window.setTimeout(callback, delayMs);
	return () => window.clearTimeout(timer);
};

export class QuietGate {
	private open = false;
	private owed = false;
	private destroyed = false;
	/** Which burst the armed timers belong to; a timer of an earlier one is ignored. */
	private epoch = 0;
	private cancelQuiet: (() => void) | null = null;
	private cancelCeiling: (() => void) | null = null;

	constructor(
		private readonly run: () => void,
		private readonly quietMs: number,
		private readonly maxMs: number,
		private readonly schedule: GateScheduler = windowTimer,
	) {}

	/**
	 * Ask for a run. With `urgent` it happens now even inside a burst, and
	 * nothing is left owed: what changed is not one more step of the same
	 * drag.
	 */
	request(urgent = false): void {
		if (this.destroyed) return;
		if (urgent) {
			this.close();
			this.owed = false;
		}
		if (!this.open) {
			this.begin();
			this.run();
			return;
		}
		this.owed = true;
		this.cancelQuiet?.();
		this.cancelQuiet = this.armQuiet();
	}

	destroy(): void {
		this.destroyed = true;
		this.owed = false;
		this.close();
	}

	private begin(): void {
		this.open = true;
		this.epoch++;
		this.cancelQuiet = this.armQuiet();
		const epoch = this.epoch;
		this.cancelCeiling = this.schedule(() => this.end(epoch), this.maxMs);
	}

	private armQuiet(): () => void {
		const epoch = this.epoch;
		return this.schedule(() => this.end(epoch), this.quietMs);
	}

	private close(): void {
		this.cancelQuiet?.();
		this.cancelCeiling?.();
		this.cancelQuiet = null;
		this.cancelCeiling = null;
		this.open = false;
	}

	private end(epoch: number): void {
		if (epoch !== this.epoch || !this.open) return;
		this.close();
		if (!this.owed || this.destroyed) return;
		this.owed = false;
		this.request();
	}
}
