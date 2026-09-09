/**
 * icons/IconFetchManager.ts — Fetches artwork for packs served one icon at a time.
 *
 * Only `perIconRemote` packs need this. Material Symbols is the sole member and
 * is likely to stay that way: it is a variable font whose 3,870 icons across 4
 * styles and 7 weights make over 100,000 drawings, so there is no bulk file to
 * download the way the other packs have. Google serves each drawing on its own,
 * and only the ones a vault actually uses are ever fetched.
 *
 * Fetched SVGs land in the registry's `iconSvgCache` (persisted to data.json),
 * and listeners are notified so the UI can repaint what was a placeholder.
 */
import { Notice } from "obsidian";
import type { CalloutIcon, CalloutRenderRole } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { CSSInjector } from "../manager/CSSInjector";
import { downloadMaterialSvg, materialVariantOf } from "./packs/material";
import { iconCacheKey, packFor } from "./registry";
import { t } from "../i18n";
import { IconTaskScope } from "./IconTaskScope";

interface IconFetchHost {
	registry: CalloutRegistry;
	cssInjector: CSSInjector;
	saveSettings(): Promise<void>;
}

/** Attempts per icon before giving up, and the pause between them. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

export class IconFetchManager {
	private readonly work = new IconTaskScope();
	destroy(): void {
		this.work.destroy();
		this.listeners.clear();
		this.inFlight.clear();
	}
	/**
	 * Icons whose fetch has been given up on, keyed by pack/name/variant.
	 * In-memory only, so every launch is a fresh chance — which is what makes
	 * it safe for the startup sweep to record failures for a vault that simply
	 * happened to be offline.
	 */
	private readonly failed: Set<string> = new Set();
	/**
	 * De-duplicates concurrent requests for the same drawing, the way
	 * `PackDataStore.inFlight` does for a whole pack. Keyed the same way the
	 * cache is, so the picker's confirm and the editor's save asking for one
	 * icon at the same moment share one request instead of racing to store the
	 * same bytes twice — three attempts and two waits apiece.
	 */
	private readonly inFlight: Map<string, Promise<void>> = new Map();
	/** Notified when a fetch finishes, either way. */
	private readonly listeners: Set<() => void> = new Set();

	constructor(private readonly host: IconFetchHost) {}

	/** Subscribe to icon cache updates. Returns an unsubscribe function. */
	onChange(cb: () => void): () => void {
		if (this.work.destroyed) return () => {};
		this.listeners.add(cb);
		return () => {
			this.listeners.delete(cb);
		};
	}

	private notify(): void {
		for (const cb of this.listeners) {
			if (this.work.destroyed) break;
			try {
				cb();
			} catch (e) {
				console.warn("[CalloutStudio] icon cache listener error", e);
			}
		}
	}

	/** Key identifying one drawing, shared by the cache and the failure set. */
	private keyFor(icon: CalloutIcon, role: CalloutRenderRole): string | null {
		const pack = packFor(icon);
		if (!pack) return null;
		return iconCacheKey(icon.type, icon.value, pack.cacheVariant(icon, role));
	}

	/** True once fetching this icon has been attempted and permanently failed. */
	hasFailed(icon: CalloutIcon, role: CalloutRenderRole = "regular"): boolean {
		const key = this.keyFor(icon, role);
		return !this.work.destroyed && key !== null && this.failed.has(key);
	}

	/** True when this icon's artwork has to be fetched before it can render. */
	private needsFetch(icon: CalloutIcon): boolean {
		const pack = packFor(icon);
		if (!pack || pack.kind !== "perIconRemote") return false;
		return !this.host.registry.findIconSvg(
			icon.type,
			icon.value,
			pack.cacheVariant(icon, "regular"),
		);
	}

	/** Store a freshly fetched drawing. */
	private store(icon: CalloutIcon, svg: string): void {
		const pack = packFor(icon);
		if (!pack) return;
		this.host.registry.addIconSvg({
			pack: icon.type,
			name: icon.value,
			variant: pack.cacheVariant(icon, "regular"),
			svg,
		});
	}

	/**
	 * Fetch and cache one icon's artwork, retrying a few times before giving up
	 * and telling the user.
	 *
	 * Concurrent calls for the same drawing share one request. Not `async`, so
	 * the second caller gets the *same* promise back rather than a new one
	 * wrapping it — which is what makes the sharing observable and testable.
	 */
	cacheOne(icon: CalloutIcon): Promise<void> {
		if (this.work.destroyed || !this.needsFetch(icon)) return Promise.resolve();
		const key = this.keyFor(icon, "regular");
		if (key === null) return Promise.resolve();

		const existing = this.inFlight.get(key);
		if (existing) return existing;

		const run = this.runFetch(icon, key).finally(() => {
			this.inFlight.delete(key);
		});
		this.inFlight.set(key, run);
		return run;
	}

	/** The attempts behind one `cacheOne`. */
	private async runFetch(icon: CalloutIcon, key: string): Promise<void> {
		const { style, weight } = materialVariantOf(icon);
		let lastErr: unknown;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			if (this.work.destroyed) return;
			try {
				const svg = await downloadMaterialSvg(icon.value, style, weight, this.work);
				if (this.work.destroyed) return;
				this.store(icon, svg);
				this.failed.delete(key);
				// Deliberately no cleanupUnusedIconSvgs() here: the icon may
				// have just been chosen in the picker and not yet attached to a
				// callout, so a sweep would delete exactly what was fetched.
				// Cleanup runs at save points instead (CalloutEditor save,
				// row actions).
				this.host.cssInjector.inject();
				if (this.work.destroyed) return;
				await this.host.saveSettings();
				this.notify();
				return;
			} catch (err) {
				if (this.work.destroyed) return;
				lastErr = err;
				if (attempt < MAX_ATTEMPTS) {
					try { await this.work.pause(RETRY_DELAY_MS); }
					catch { return; }
				}
			}
		}
		this.failed.add(key);
		new Notice(t("notice.iconDownloadFailed", { name: icon.value }));
		this.notify();
		console.warn(
			"[CalloutStudio] failed to fetch icon after retries",
			lastErr,
		);
	}

	/**
	 * Background sweep on load: fetch artwork for every callout that is missing
	 * it. One attempt each — a vault that is simply offline retries on the next
	 * launch, since the failure set does not survive a reload.
	 */
	async ensureAll(): Promise<void> {
		if (this.work.destroyed) return;
		const missing = this.host.registry
			.getAll()
			.filter((def) => def.source !== "theme" && this.needsFetch(def.icon));
		if (missing.length === 0) return;

		let fetched = 0;
		for (const def of missing) {
			const key = this.keyFor(def.icon, "regular");
			const { style, weight } = materialVariantOf(def.icon);
			try {
				const svg = await downloadMaterialSvg(
					def.icon.value,
					style,
					weight,
					this.work,
				);
				if (this.work.destroyed) return;
				this.store(def.icon, svg);
				if (key !== null) this.failed.delete(key);
				fetched++;
			} catch {
				if (this.work.destroyed) return;
				// Record the failure so the settings list shows an error rather
				// than a spinner that never resolves. Cleared on next launch.
				if (key !== null) this.failed.add(key);
			}
		}

		if (fetched > 0) {
			this.host.cssInjector.inject();
			if (this.work.destroyed) return;
			await this.host.saveSettings();
		}
		// Notify either way: failures changed the UI state too.
		this.notify();
	}
}
