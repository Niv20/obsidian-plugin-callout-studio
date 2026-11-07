/**
 * manager/StartupStyleCache.ts — shortens the "flash of unstyled callouts" at
 * app startup, most visible on mobile where Obsidian renders the restored note
 * BEFORE community plugins finish loading.
 *
 * One snapshot layer: localStorage, per device and vault-scoped, refreshed
 * from CSSInjector.inject() and always on (deliberately no settings toggle —
 * see README, "What is stored locally"). CSSInjector.injectFromCache() reads
 * it synchronously as the very first statement of plugin onload, before
 * `loadData()` is awaited, so styling lands without waiting on disk IO or CSS
 * generation.
 *
 * The snapshot holds the exact text the adopted stylesheet gets, so the
 * handoff to the live-generated CSS is invisible. A stale snapshot self-heals:
 * the next launch's inject() persists the fresh CSS again.
 *
 * Written once the stylesheet has been still for a moment
 * ({@link StartupStyleCache.persistSoon}), not inside the pass that made it.
 * `setItem` is synchronous and the snapshot is the whole stylesheet — three
 * quarters of a megabyte in a vault with 750 callouts — and it only matters at
 * the next launch, so it has no business holding up a save, an import step or
 * a theme switch. `CSSInjector.destroy` flushes a write still waiting; one
 * lost to the app quitting inside the wait costs only a snapshot one change
 * old, which the next launch's first pass replaces.
 *
 * What this deliberately does NOT cover is the window before the plugin is
 * loaded at all — nothing running inside a plugin can. Versions up to 2.5.0
 * covered it with a second copy of the CSS written into the vault as an
 * auto-enabled snippet, which cost a ~100KB file (and a sync event) per style
 * change and outlived the plugin on uninstall. That layer is gone; see
 * legacyStartupSnippet.ts, which cleans up what it left behind.
 */
import type { App } from "obsidian";
import { WriteMemo } from "../utils/writeMemo";
import { STARTUP_CSS_STORAGE_KEY } from "./startupStyleKeys";

/** How long the stylesheet has to be still before its snapshot is written. */
const PERSIST_QUIET_MS = 1000;

export class StartupStyleCache {
	private app: App;
	/** What the snapshot is believed to hold — dedupes the no-op injects that
	 * follow every external css-change event. See utils/writeMemo.ts, which
	 * also records why this must only move after a write lands. */
	private readonly memo = new WriteMemo();
	/** The text {@link persistSoon} is waiting to write, or null. */
	private pending: string | null = null;
	/** The wait under way, or null. */
	private timer: number | null = null;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Vault-scoped localStorage key: the same `${appId}-${key}` that
	 * `App.loadLocalStorage` builds. That API stores JSON and this snapshot is
	 * plain CSS text, so the key is built by hand. `appId` is undocumented but
	 * long-stable; the vault name is the fallback scope.
	 */
	private scopedKey(key: string): string {
		const appId = (this.app as App & { appId?: string }).appId;
		return `${appId ?? this.app.vault.getName()}-${key}`;
	}

	/** Synchronous read of the previous session's CSS. */
	loadCachedCss(): string | null {
		try {
			const cached = window.localStorage.getItem(this.scopedKey(STARTUP_CSS_STORAGE_KEY));
			return cached && cached.length > 0 ? cached : null;
		} catch {
			return null;
		}
	}

	/**
	 * Record freshly generated CSS for the next launch's fast path, once the
	 * stylesheet has been still for {@link PERSIST_QUIET_MS}: each new text
	 * restarts the wait, and only the last is written. Text the snapshot
	 * already holds drops any write still waiting. Where there is no timer to
	 * wait with, it is written at once.
	 */
	persistSoon(cssText: string): void {
		if (this.memo.matches(cssText)) {
			this.cancelPending();
			return;
		}
		this.pending = cssText;
		if (typeof window.setTimeout !== "function") {
			this.flush();
			return;
		}
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.timer = null;
			this.flush();
		}, PERSIST_QUIET_MS);
	}

	/** Write a snapshot {@link persistSoon} is still waiting on, now. */
	flush(): void {
		const text = this.pending;
		this.cancelPending();
		if (text !== null) this.persist(text);
	}

	private cancelPending(): void {
		this.pending = null;
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
	}

	/** Record freshly generated CSS for the next launch's fast path, now. */
	persist(cssText: string): void {
		if (this.memo.prepare(cssText) === null) return;
		try {
			// A v1 discovery blob is removed only after its recovery archive
			// includes this CSS. Failed migration must not erase the last visual
			// evidence of styles that an earlier broken settings write lost.
			const local = window.localStorage.getItem(this.scopedKey("callout-studio-local"));
			if (local) {
				const parsed = JSON.parse(local) as { v?: unknown } | null;
				if (parsed?.v !== 2 && parsed?.v !== 3) return;
			}
			window.localStorage.setItem(this.scopedKey(STARTUP_CSS_STORAGE_KEY), cssText);
			// Only once the write has actually landed — the rule, and the bug
			// that produced it, are in utils/writeMemo.ts.
			this.memo.commit(cssText);
		} catch {
			// Quota exceeded / storage unavailable — the normal inject path still
			// works, so styling is never lost; only the fast path is skipped.
		}
	}
}
