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
 * Everything it compares goes through one canonical spelling first — the
 * object with its keys sorted, deeply. Bytes carry one thing that means
 * nothing, which is the order the keys happen to be in, and two builds of this
 * plugin genuinely do order the same settings differently: a field the newer
 * one names in `DEFAULT_SETTINGS`' order is re-emitted by the older one, which
 * has never heard of it, from `collectUnknownSettings` and therefore from
 * somewhere else entirely. Left uncanonicalized those two files disagree
 * forever, each rewriting the other's — the same shape as the `iconSvgCache`
 * ordering bug, one level up. See `utils/stableJson.ts`.
 *
 * Its own module, holding its own baseline, so `main.ts` keeps only the call
 * and the rule can be tested without standing up a plugin harness.
 */
import { WriteMemo } from "./writeMemo";
import { stableKeyOrder } from "./stableJson";

/** One settings object, as the only spelling of it this class compares. */
function canonical(data: unknown): string {
	return JSON.stringify(stableKeyOrder(data));
}

/**
 * The same, for text somebody else produced.
 *
 * Every string that reaches {@link SaveGuard.adopt} or
 * {@link SaveGuard.matches} is a serialization of a settings object written by
 * some build of this plugin, in whatever key order that build emits — so it has
 * to be put back through the same normalizer as our own payload before the two
 * can be compared at all. Text that is not JSON is returned unchanged: it
 * cannot equal a canonical payload, which is the right answer for both callers.
 */
function canonicalText(json: string): string {
	try {
		return canonical(JSON.parse(json));
	} catch {
		return json;
	}
}

export class SaveGuard {
	private readonly memo = new WriteMemo();
	hasBaseline = false;

	/**
	 * The payload to write, or `null` when it is byte-identical to what the
	 * file is believed to hold already.
	 *
	 * The session's first call returns a payload unless a load has already
	 * adopted one (null baseline) — that is the one that flushes a load-time
	 * migration.
	 */
	prepare(data: unknown): string | null {
		return this.memo.prepare(canonical(data));
	}

	/** Record a write that succeeded. Pass the string {@link prepare} returned. */
	commit(json: string): void {
		this.memo.commit(json);
		this.hasBaseline = true;
	}

	/**
	 * Record the file someone else wrote, as we have just read it back.
	 *
	 * Pass what `manager/settingsFile.ts` produced — the *parsed* object put
	 * back through `stableKeyOrder` and re-serialized, never the raw file text.
	 * Obsidian writes with `JSON.stringify(data, undefined, 2)`, so the text on
	 * disk is pretty-printed while {@link prepare} compares compact output; the
	 * round-trip normalizes the whitespace, and the key sort normalizes the one
	 * other difference that carries no meaning — see `utils/stableJson.ts` for
	 * the version-skew loop that one costs.
	 */
	adopt(json: string): void {
		this.memo.adopt(canonicalText(json));
		this.hasBaseline = true;
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
		return this.memo.matches(canonicalText(json));
	}
}
