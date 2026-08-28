/**
 * utils/saveGuard.ts — the question `saveSettings()` asks before touching disk.
 *
 * Every save serializes the whole registry over whatever `data.json` holds, and
 * most of them carry content identical to the last one: a prune that removed
 * nothing, a theme sweep that changed nothing, a settings section folded and
 * unfolded. On a synced vault each rewrite is a file event for the sync client,
 * and a file event on `data.json` is how issue #41's conflict copies started —
 * the same argument `cssSnippetExport` already makes for the CSS snippet and
 * `StartupStyleCache` makes for the startup snapshot.
 *
 * Two rules this guard exists to get right, both learned from those two:
 *
 * - **The baseline moves only after a write succeeds.** `prepare()` hands back
 *   the serialized payload and `commit()` records it, so a throwing write
 *   leaves the baseline where it was and the next attempt tries again rather
 *   than being suppressed as a duplicate forever.
 * - **The baseline is a claim about what WE last wrote**, and it stops being
 *   true the moment anyone else writes the file. `onExternalSettingsChange`
 *   calls {@link invalidate} for exactly that reason: without it the guard can
 *   suppress the one write that would have re-asserted local state over a
 *   version that arrived from another device.
 *
 * Its own module, holding its own baseline, so `main.ts` keeps only the call
 * and the rule can be tested without standing up a plugin harness.
 */

export class SaveGuard {
	/** Serialized form of the last write that actually landed, or null before the first. */
	private last: string | null = null;

	/**
	 * The payload to write, or `null` when it is byte-identical to the last
	 * write this guard committed.
	 *
	 * The session's first call always returns a payload (null baseline) — that
	 * is the one that flushes a load-time migration.
	 */
	prepare(data: unknown): string | null {
		const json = JSON.stringify(data);
		return json === this.last ? null : json;
	}

	/** Record a write that succeeded. Pass the string {@link prepare} returned. */
	commit(json: string): void {
		this.last = json;
	}

	/**
	 * Forget the baseline: the file on disk is no longer something we wrote.
	 *
	 * Called when settings are reloaded from disk after an external change. The
	 * next save then writes unconditionally, even if our in-memory state happens
	 * to serialize to what we last wrote ourselves.
	 */
	invalidate(): void {
		this.last = null;
	}
}
