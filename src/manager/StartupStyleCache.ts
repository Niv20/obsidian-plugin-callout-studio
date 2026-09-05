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
 * What this deliberately does NOT cover is the window before the plugin is
 * loaded at all — nothing running inside a plugin can. Versions up to 2.5.0
 * covered it with a second copy of the CSS written into the vault as an
 * auto-enabled snippet, which cost a ~100KB file (and a sync event) per style
 * change and outlived the plugin on uninstall. That layer is gone; see
 * legacyStartupSnippet.ts, which cleans up what it left behind.
 */
import type { App } from "obsidian";
import { WriteMemo } from "../utils/writeMemo";

const LOCAL_STORAGE_KEY = "callout-studio-css";

export class StartupStyleCache {
	private app: App;
	/** What the snapshot is believed to hold — dedupes the no-op injects that
	 * follow every external css-change event. See utils/writeMemo.ts, which
	 * also records why this must only move after a write lands. */
	private readonly memo = new WriteMemo();

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Vault-scoped localStorage key. Mirrors the `${appId}-${key}` convention
	 * of `App.loadLocalStorage`, which we can't call directly: it requires
	 * Obsidian 1.8.7 while our minAppVersion is 1.6.6. `appId` is undocumented
	 * but long-stable; the vault name is the fallback scope.
	 */
	private scopedKey(key: string): string {
		const appId = (this.app as App & { appId?: string }).appId;
		return `${appId ?? this.app.vault.getName()}-${key}`;
	}

	/** Synchronous read of the previous session's CSS. */
	loadCachedCss(): string | null {
		try {
			const cached = window.localStorage.getItem(
				this.scopedKey(LOCAL_STORAGE_KEY),
			);
			return cached && cached.length > 0 ? cached : null;
		} catch {
			return null;
		}
	}

	/** Record freshly generated CSS for the next launch's fast path. */
	persist(cssText: string): void {
		if (this.memo.prepare(cssText) === null) return;
		try {
			// A v1 discovery blob is removed only after its recovery archive
			// includes this CSS. Failed migration must not erase the last visual
			// evidence of styles that an earlier broken settings write lost.
			const local = window.localStorage.getItem(this.scopedKey("callout-studio-local"));
			if (local) {
				const parsed = JSON.parse(local) as { v?: unknown } | null;
				if (parsed?.v !== 2) return;
			}
			window.localStorage.setItem(
				this.scopedKey(LOCAL_STORAGE_KEY),
				cssText,
			);
			// Only once the write has actually landed — the rule, and the bug
			// that produced it, are in utils/writeMemo.ts.
			this.memo.commit(cssText);
		} catch {
			// Quota exceeded / storage unavailable — the normal inject path still
			// works, so styling is never lost; only the fast path is skipped.
		}
	}
}
