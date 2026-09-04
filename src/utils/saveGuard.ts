/**
 * utils/saveGuard.ts — the question `saveSettings()` asks before touching disk.
 *
 * Every save serializes the whole registry over whatever `data.json` holds, and
 * most of them carry content identical to what is already there: a prune that
 * removed nothing, a theme sweep that changed nothing, a settings section folded
 * and unfolded. On a synced vault each rewrite is a file event for the sync
 * client, and a file event on `data.json` is how issue #41's conflict copies
 * started — the same argument `cssSnippetExport` already makes for the CSS
 * snippet and `StartupStyleCache` makes for the startup snapshot.
 *
 * The shared discipline — a baseline that moves only after a write lands, and
 * that an external write re-seeds rather than clears — lives in
 * [`utils/writeMemo.ts`](./writeMemo.ts), because those same three stores all
 * need it. What is specific to `data.json`, and stays here, is that the thing
 * being compared is a **serialized object** rather than text the caller already
 * holds, and the reason the distinction between the two setters is worth its
 * own vocabulary:
 *
 * - {@link commit} — *we* wrote those bytes, and the write landed.
 * - {@link adopt} — *someone else* wrote them and we have just read them back,
 *   so they are the truth now whatever we last wrote ourselves.
 *
 * > [!IMPORTANT]
 * > **An external change re-seeds the baseline; it does not clear it.** This
 * > file used to expose `invalidate()`, which nulled the baseline so that the
 * > next save wrote unconditionally. That was the engine of issue #41's second
 * > failure: `onExternalSettingsChange` called it, the reload then re-added this
 * > device's discovered rows, the resulting `onChange` asked for a save, and the
 * > guard — having just been switched off — wrote the file straight back at the
 * > device that had sent it. Both devices did this to each other, forever.
 * >
 * > `adopt()` keeps the safety property `invalidate()` was reaching for while
 * > removing the loop: a save whose payload *reproduces* the adopted file is
 * > suppressed (it asserts nothing and is pure sync churn), and a save carrying
 * > genuinely different local state still writes, because its payload differs
 * > from the bytes on disk.
 *
 * Its own module, holding its own baseline, so `main.ts` keeps only the call
 * and the rule can be tested without standing up a plugin harness.
 */
import { WriteMemo } from "./writeMemo";

export class SaveGuard {
	private readonly memo = new WriteMemo();

	/**
	 * The payload to write, or `null` when it is byte-identical to what the
	 * file is believed to hold already.
	 *
	 * The session's first call returns a payload unless a load has already
	 * adopted one (null baseline) — that is the one that flushes a load-time
	 * migration.
	 */
	prepare(data: unknown): string | null {
		return this.memo.prepare(JSON.stringify(data));
	}

	/** Record a write that succeeded. Pass the string {@link prepare} returned. */
	commit(json: string): void {
		this.memo.commit(json);
	}

	/**
	 * Record the file someone else wrote, as we have just read it back.
	 *
	 * Pass `JSON.stringify(parsed)` — the *parsed* object re-serialized, never
	 * the raw file text. Obsidian writes with `JSON.stringify(data, undefined, 2)`,
	 * so the text on disk is pretty-printed while {@link prepare} compares
	 * compact output; a parse/stringify round-trip normalizes the whitespace and
	 * preserves key order, which is what makes the two comparable at all.
	 */
	adopt(json: string): void {
		this.memo.adopt(json);
	}

	/**
	 * Whether `json` is exactly what the file is believed to hold.
	 *
	 * Lets the reload path recognise its own write coming back — Obsidian's
	 * config watcher re-fires for every save we make (see
	 * `manager/settingsBoot.ts`) — and skip the whole rebuild rather than
	 * repeating it for a file that cannot have changed anything.
	 */
	matches(json: string): boolean {
		return this.memo.matches(json);
	}
}
