/**
 * utils/writeMemo.ts — "we already wrote exactly this, don't write it again."
 *
 * Three places in the plugin keep the same small piece of state: the text they
 * believe is currently in a store, so a write carrying identical content can be
 * skipped. `data.json` (via `utils/saveGuard.ts`), the device-local blob
 * (`manager/DeviceLocalStore.ts`) and the startup CSS snapshot
 * (`manager/StartupStyleCache.ts`). Each had its own field, its own compare and
 * its own copy of the comment below, which is how one of them ended up with the
 * rule backwards.
 *
 * Skipping matters for different reasons in each — a redundant `data.json`
 * write is a sync event for another device to reconcile, a redundant
 * `localStorage` write is main-thread work on a phone — but the rule is the
 * same one, so it is written down once.
 *
 * **The baseline moves only after a write succeeds.** {@link prepare} hands
 * back the text to write and {@link commit} records it, so a write that throws
 * — a quota, a private window, a failing adapter — leaves the baseline where it
 * was and the next attempt tries again. `StartupStyleCache` had this inverted
 * once: it recorded the value before offering it to storage, so a refused write
 * was remembered as a success and that text was never offered again for the
 * rest of the session.
 *
 * **A value someone else stored is {@link adopt}ed, not ignored.** The point of
 * the baseline is what the store holds, not what we last did to it. Reading a
 * store back and adopting what is there is as good a way to learn that as
 * writing it — and for `data.json`, where another device can write the same
 * file, it is the only correct one. See `utils/saveGuard.ts` for what clearing
 * the baseline instead cost (issue #41).
 */
export class WriteMemo {
	/**
	 * What the store is believed to hold, or null before anything has
	 * established that — nothing written and nothing read.
	 */
	private last: string | null = null;

	/**
	 * The text to write, or `null` when it is what the store already holds.
	 *
	 * Deliberately not a boolean: the caller passes the same string back to
	 * {@link commit}, so the value that was compared is the value that gets
	 * recorded, and the two cannot drift.
	 */
	prepare(text: string): string | null {
		return text === this.last ? null : text;
	}

	/** Record a write of ours that landed. Pass what {@link prepare} returned. */
	commit(text: string): void {
		this.last = text;
	}

	/** Record what someone else stored, as we have just read it back. */
	adopt(text: string): void {
		this.last = text;
	}

	/** Whether `text` is exactly what the store is believed to hold. */
	matches(text: string): boolean {
		return text === this.last;
	}
}
