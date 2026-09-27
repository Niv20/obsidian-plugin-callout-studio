/**
 * utils/withTimeout.ts — stop waiting on storage that will not answer.
 *
 * A read of a cloud placeholder (iCloud's dataless files, streamed Drive or
 * OneDrive files) can hang instead of failing. A hung settings read kept the
 * writer busy forever: every save queued behind it and nothing said why. This
 * bounds the wait. The work itself cannot be cancelled and may still finish;
 * callers treat a timeout as "unavailable", never as success or absence.
 */
export function withTimeout<T>(work: Promise<T>, ms: number, timedOut: () => Error): Promise<T> {
	// A host without real timers (some test harnesses) simply waits.
	if (typeof window === "undefined" || typeof window.setTimeout !== "function" ||
		typeof window.clearTimeout !== "function") return work;
	return new Promise<T>((resolve, reject) => {
		// A real timer never fires during setTimeout itself; a stub that runs
		// callbacks at once must not turn every read into a timeout.
		let armed = false;
		const timer = window.setTimeout(() => { if (armed) reject(timedOut()); }, ms);
		armed = true;
		work.then(
			value => { window.clearTimeout(timer); resolve(value); },
			(error: unknown) => { window.clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); },
		);
	});
}
