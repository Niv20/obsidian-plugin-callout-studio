/**
 * icons/PackDataStore.ts — Downloads icon packs and caches them to disk.
 *
 * The contract this class exists to keep:
 *
 * - **Nothing is fetched until the user asks.** Opening the icon picker, or a
 *   note using an icon, never touches the network. Only pressing Download in
 *   the picker does.
 * - **A pack is fetched at most once.** It lands in the plugin's own folder and
 *   is read from there on every later launch, so the pack works offline
 *   afterwards and survives a restart.
 * - **Only the exact expected bytes are accepted**, on download and on every
 *   later read. The build knows each pack's SHA-256 (see packManifest.ts);
 *   anything else is discarded, whether it came from a compromised CDN, a
 *   captive portal, a truncated write or an edit made to the file afterwards.
 * - **Disk is a cache, never a dependency.** Every write failure is survivable:
 *   the pack stays in memory for the session, and the artwork of the icons
 *   actually in use is separately copied into `data.json`, which syncs.
 */
import { Notice, normalizePath, requestUrl } from "obsidian";
import type { App, PluginManifest } from "obsidian";
import type { IconPackId } from "../types";
import { t } from "../i18n";
import {
	PACK_MANIFEST,
	packUrls,
	type PackManifestEntry,
} from "./data/packManifest";
import { isPackLoaded, setPackData } from "./packData";
import { parseVerifiedPack, verifyPackText } from "./packValidation";
import { IconTaskScope } from "./IconTaskScope";

/**
 * `requestUrl` cannot be aborted and reports no progress, so a hung connection
 * would otherwise leave the picker spinning forever. This is the only stop.
 */
const DOWNLOAD_TIMEOUT_MS = 30_000;

export type PackLoadState =
	| "unavailable"
	| "loading"
	| "ready"
	| "failed";

/**
 * How a read from disk went. `"corrupt"` covers every way a file can be there
 * but unusable — wrong checksum, not JSON, or the wrong shape — because the
 * response to all of them is the same.
 */
export type PackDiskResult = "ready" | "missing" | "corrupt";

export class PackDataStore {
	private readonly work = new IconTaskScope();
	destroy(): void {
		this.work.destroy();
		this.listeners.clear();
		this.inFlight.clear();
		this.states.clear();
	}
	private readonly states = new Map<IconPackId, PackLoadState>();
	/** De-duplicates concurrent requests for the same pack. */
	private readonly inFlight = new Map<IconPackId, Promise<boolean>>();
	private readonly listeners = new Set<() => void>();
	/** Set once a write has failed, so the user is only told the once. */
	private diskWriteBroken = false;

	constructor(
		private readonly app: App,
		private readonly manifest: PluginManifest,
	) {}

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
				console.warn("[CalloutStudio] pack listener error", e);
			}
		}
	}

	state(id: IconPackId): PackLoadState {
		if (this.work.destroyed) return "unavailable";
		if (isPackLoaded(id)) return "ready";
		return this.states.get(id) ?? "unavailable";
	}

	/** What the picker shows before a pack is downloaded. */
	info(id: IconPackId): PackManifestEntry | undefined {
		return PACK_MANIFEST[id];
	}

	// ── Disk ────────────────────────────────────────────────────────────

	/**
	 * The plugin's own folder, so uninstalling takes the packs with it.
	 * `manifest.dir` is typed optional, hence the reconstruction fallback.
	 */
	private packDir(): string {
		const base =
			this.manifest.dir ??
			`${this.app.vault.configDir}/plugins/${this.manifest.id}`;
		return normalizePath(`${base}/icon-packs`);
	}

	/**
	 * Where a pack file lives once downloaded.
	 *
	 * Dropping a file here by hand also works — it is read on the next launch
	 * and verified like any other, so a locked-down machine can install a pack
	 * from the GitHub release without a network. The picker deliberately does
	 * not advertise that: it is a path for someone who already knows to look,
	 * not an option worth putting in front of everyone downloading an icon set.
	 */
	packPath(id: IconPackId): string {
		return normalizePath(`${this.packDir()}/${id}.json`);
	}

	/**
	 * Load a pack from disk if it is there. Never fetches — a missing or
	 * unreadable file simply means the pack is not available yet.
	 *
	 * The checksum is re-checked here, not just at download time. A file on disk
	 * can be edited, truncated by a failed sync, or replaced; without this, the
	 * damaged version would be accepted silently on every later launch. It also
	 * makes the documented hand-drop path a real check rather than a claim, and
	 * costs well under a millisecond per pack — far less than the parse below it.
	 *
	 * `"corrupt"` is distinguished from `"missing"` so the caller can say which
	 * happened; both mean the same thing to the picker.
	 */
	async loadFromDisk(id: IconPackId): Promise<PackDiskResult> {
		if (this.work.destroyed) return "missing";
		if (isPackLoaded(id)) return "ready";
		const path = this.packPath(id);
		const expected = PACK_MANIFEST[id];
		try {
			const adapter = this.app.vault.adapter;
			if (!(await this.work.wait(adapter.exists(path))) || this.work.destroyed) return "missing";
			const text = await this.work.wait(adapter.read(path));
			if (this.work.destroyed) return "missing";
			if (expected && !(await verifyPackText(text, expected, path, () => !this.work.destroyed))) {
				return "corrupt";
			}
			return this.accept(id, text, `disk (${path})`) ? "ready" : "corrupt";
		} catch (e) {
			if (this.work.destroyed) return "missing";
			console.warn(`[CalloutStudio] could not read pack "${id}"`, e);
			return "corrupt";
		}
	}

	/**
	 * Load every pack that some callout actually uses. Called once on startup;
	 * packs nothing references stay unread, so an unused 400 KB file is never
	 * parsed.
	 */
	async loadUsed(
		usedPacks: Iterable<IconPackId>,
	): Promise<Map<IconPackId, PackDiskResult>> {
		const results = new Map<IconPackId, PackDiskResult>();
		for (const id of new Set(usedPacks)) {
			if (this.work.destroyed) break;
			if (PACK_MANIFEST[id]) results.set(id, await this.loadFromDisk(id));
		}
		this.notify();
		return results;
	}

	/**
	 * Load every downloadable pack that is on disk but not yet in memory.
	 *
	 * `loadUsed` only warms packs a callout already references, so a pack
	 * downloaded in an earlier session but never assigned to one still reads
	 * as `"unavailable"` until something reads it back. The picker calls this
	 * once when it opens, so its download prompts reflect what is actually on
	 * disk rather than only what this session has touched.
	 */
	async loadAllFromDisk(): Promise<void> {
		for (const id of Object.keys(PACK_MANIFEST) as IconPackId[]) {
			if (this.work.destroyed) return;
			if (this.state(id) === "unavailable") await this.loadFromDisk(id);
		}
		this.notify();
	}

	/**
	 * Persist a pack so later launches skip the network. Best-effort by design:
	 * a read-only vault or a suspended mobile app must not cost the user the
	 * download they just did, so failure only downgrades this to session-only.
	 */
	private async persist(id: IconPackId, text: string): Promise<void> {
		if (this.work.destroyed) return;
		const adapter = this.app.vault.adapter;
		const dir = this.packDir();
		try {
			const exists = await this.work.wait(adapter.exists(dir));
			if (this.work.destroyed) return;
			if (!exists) await this.work.wait(adapter.mkdir(dir));
			if (this.work.destroyed) return;
			await this.work.wait(adapter.write(this.packPath(id), text));
		} catch (e) {
			if (this.work.destroyed) return;
			console.warn(`[CalloutStudio] could not cache pack "${id}" to disk`, e);
			if (!this.diskWriteBroken) {
				this.diskWriteBroken = true;
				new Notice(t("iconPack.diskWriteFailed"));
			}
		}
	}

	// ── Download ────────────────────────────────────────────────────────

	/**
	 * Fetch a pack, verify it, and make it usable. Resolves to whether the pack
	 * is now available. Concurrent calls share one request.
	 */
	download(id: IconPackId): Promise<boolean> {
		if (this.work.destroyed) return Promise.resolve(false);
		if (isPackLoaded(id)) return Promise.resolve(true);
		const existing = this.inFlight.get(id);
		if (existing) return existing;

		const run = this.runDownload(id).finally(() => {
			this.inFlight.delete(id);
		});
		this.inFlight.set(id, run);
		return run;
	}

	private async runDownload(id: IconPackId): Promise<boolean> {
		const expected = PACK_MANIFEST[id];
		if (!expected) return false;

		this.states.set(id, "loading");
		this.notify();

		let lastError: unknown;
		for (const url of packUrls(id)) {
			if (this.work.destroyed) return false;
			try {
				const text = await this.fetchWithTimeout(url);
				if (this.work.destroyed) return false;
				if (!(await verifyPackText(text, expected, url, () => !this.work.destroyed))) continue;
				if (!this.accept(id, text, url)) continue;
				await this.persist(id, text);
				if (this.work.destroyed) return false;
				this.notify();
				return true;
			} catch (e) {
				if (this.work.destroyed) return false;
				lastError = e;
			}
		}

		if (this.work.destroyed) return false;
		this.states.set(id, "failed");
		this.notify();
		console.warn(`[CalloutStudio] pack "${id}" download failed`, lastError);
		return false;
	}

	private async fetchWithTimeout(url: string): Promise<string> {
		let timer = 0;
		const timeout = new Promise<never>((_, reject) => {
			timer = window.setTimeout(
				() => reject(new Error(`timed out after ${DOWNLOAD_TIMEOUT_MS}ms`)),
				DOWNLOAD_TIMEOUT_MS,
			);
		});
		try {
			const response = await this.work.wait(Promise.race([requestUrl({ url }), timeout]));
			return response.text;
		} finally {
			window.clearTimeout(timer);
		}
	}

	private accept(id: IconPackId, text: string, source: string): boolean {
		if (this.work.destroyed) return false;
		const file = parseVerifiedPack(id, text, source);
		if (!file) return false;
		setPackData(id, file);
		this.states.set(id, "ready");
		return true;
	}

}
