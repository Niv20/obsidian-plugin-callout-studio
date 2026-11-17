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
 *   afterwards and survives a restart — until the user deletes it in the Icon
 *   libraries window, after which only another Download brings it back.
 * - **Only the exact expected bytes are accepted**, on download and on every
 *   later read. The build knows each pack's SHA-256 (see packManifest.ts);
 *   anything else is discarded, whether it came from a compromised CDN, a
 *   captive portal, a truncated write or an edit made to the file afterwards.
 * - **Disk is a cache, never a dependency.** Every write failure is survivable:
 *   the pack stays in memory for the session, and the artwork of the icons
 *   actually in use is separately copied into `data.json`, which syncs.
 */
import { normalizePath, requestUrl } from "obsidian";
import type { App, PluginManifest } from "obsidian";
import type { IconPackId } from "../types";
import { t } from "../i18n";
import { PACK_MANIFEST, packUrls, type PackManifestEntry } from "./data/packManifest";
import { forgetPackData, isPackLoaded, setPackData } from "./packData";
import { parseVerifiedPack, verifyPackText } from "./packValidation";
import { IconTaskScope } from "./IconTaskScope";
import { showNotice } from "../ui/mascot/mascotNotices";

/**
 * `requestUrl` cannot be aborted and reports no progress, so a hung connection
 * would otherwise leave the picker spinning forever. This is the only stop.
 */
const DOWNLOAD_TIMEOUT_MS = 30_000;

export type PackLoadState = "unavailable" | "loading" | "ready" | "failed";

/**
 * How a read from disk went. `"corrupt"` covers every way a file can be there
 * but unusable — wrong checksum, not JSON, or the wrong shape — because the
 * response to all of them is the same.
 */
export type PackDiskResult = "ready" | "missing" | "corrupt";

/**
 * What the session knows of a pack file on disk without reading it: listed in
 * the folder or just written (`"present"`), not there (`"absent"`), or read and
 * refused (`"bad"`, which a later listing does not undo: the file is still
 * there, and still refused until something reads it again).
 */
type DiskPresence = "present" | "absent" | "bad";

export class PackDataStore {
	private readonly work = new IconTaskScope();
	destroy(): void {
		this.work.destroy();
		this.listeners.clear();
		this.inFlight.clear();
		this.states.clear();
		this.onDisk.clear();
	}
	private readonly states = new Map<IconPackId, PackLoadState>();
	/** De-duplicates concurrent requests for the same pack. */
	private readonly inFlight = new Map<IconPackId, Promise<boolean>>();
	private readonly listeners = new Set<() => void>();
	/** Set once a write has failed, so the user is only told the once. */
	private diskWriteBroken = false;
	/** Each pack file's presence on disk, as far as the session knows (`isOnDevice`). */
	private readonly onDisk = new Map<IconPackId, DiskPresence>();
	/** Whether a look at the folder has finished this session; until then presence is unknown. */
	private diskLooked = false;
	/** The look under way, so a second request shares it. */
	private looking: Promise<void> | null = null;
	/**
	 * The packs whose presence a read, write or deletion learned while a look
	 * was under way: the look's listing may be older than that, so it leaves
	 * them alone.
	 */
	private readonly learnedDuringLook = new Set<IconPackId>();

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
		const base = this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
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
			if (!(await this.work.wait(adapter.exists(path))) || this.work.destroyed) {
				return this.learned(id, "absent", "missing");
			}
			const text = await this.work.wait(adapter.read(path));
			if (this.work.destroyed) return "missing";
			if (expected && !(await verifyPackText(text, expected, path, () => !this.work.destroyed))) {
				return this.learned(id, "bad", "corrupt");
			}
			return this.accept(id, text, `disk (${path})`)
				? this.learned(id, "present", "ready")
				: this.learned(id, "bad", "corrupt");
		} catch (e) {
			if (this.work.destroyed) return "missing";
			console.warn(`[CalloutStudio] could not read pack "${id}"`, e);
			return this.learned(id, "bad", "corrupt");
		}
	}

	/**
	 * Whether a pack file is on this device, as far as the session can tell
	 * without reading it: loaded, or seen in the folder and never refused. A
	 * guess is not an answer: undefined while it is not loaded and the folder has
	 * not been looked at yet (`lookOnDisk`).
	 *
	 * Only the settings row's count of libraries asks this (iconLibraries.ts,
	 * `availableCount`). What the picker offers goes by `state` alone, after it
	 * has read the files back (`loadAllFromDisk`).
	 */
	isOnDevice(id: IconPackId): boolean | undefined {
		if (this.state(id) === "ready") return true;
		if (!this.diskLooked) return undefined;
		return this.onDisk.get(id) === "present";
	}

	/**
	 * Look at which pack files are in the folder, without reading any: one
	 * listing (none at all when the folder is not there). Called in the
	 * background at startup and on every visit to the settings, so the count
	 * the settings show is known before they are drawn, and catches a file a
	 * sync brought or someone dropped in. Listeners hear only of a change; a
	 * listing that fails changes nothing, so no count is drawn from it.
	 */
	lookOnDisk(): Promise<void> {
		if (this.work.destroyed) return Promise.resolve();
		this.looking ??= this.runLook().finally(() => {
			this.looking = null;
			this.learnedDuringLook.clear();
		});
		return this.looking;
	}

	private async runLook(): Promise<void> {
		this.learnedDuringLook.clear();
		const adapter = this.app.vault.adapter;
		const dir = this.packDir();
		let listed: Set<string>;
		try {
			const exists = await this.work.wait(adapter.exists(dir));
			if (this.work.destroyed) return;
			const files = exists ? (await this.work.wait(adapter.list(dir))).files : [];
			if (this.work.destroyed) return;
			listed = new Set(files.map((file) => normalizePath(file)));
		} catch (e) {
			if (this.work.destroyed) return;
			console.warn("[CalloutStudio] could not list the icon packs folder", e);
			return;
		}
		let changed = !this.diskLooked;
		for (const id of Object.keys(PACK_MANIFEST) as IconPackId[]) {
			if (this.learnedDuringLook.has(id)) continue;
			const before = this.onDisk.get(id);
			const isListed = listed.has(this.packPath(id));
			const now: DiskPresence = !isListed ? "absent" : before === "bad" ? "bad" : "present";
			if (now !== before) changed = true;
			this.onDisk.set(id, now);
		}
		this.diskLooked = true;
		if (changed) this.notify();
	}

	/** Record what a read, write or deletion learned of a pack file; returns `result`. */
	private learned<T>(id: IconPackId, presence: DiskPresence, result: T): T {
		this.onDisk.set(id, presence);
		if (this.looking) this.learnedDuringLook.add(id);
		return result;
	}

	/**
	 * Load every pack that some callout actually uses. Called once on startup;
	 * packs nothing references stay unread, so an unused 400 KB file is never
	 * parsed.
	 */
	async loadUsed(usedPacks: Iterable<IconPackId>): Promise<Map<IconPackId, PackDiskResult>> {
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
			if (this.work.destroyed) return;
			this.learned(id, "present", undefined);
		} catch (e) {
			if (this.work.destroyed) return;
			console.warn(`[CalloutStudio] could not cache pack "${id}" to disk`, e);
			if (!this.diskWriteBroken) {
				this.diskWriteBroken = true;
				showNotice("problem", t("iconPack.diskWriteFailed"));
			}
		}
	}

	/**
	 * Delete a pack's file and forget its artwork for this session — the
	 * **Delete** button in the Icon libraries window. Resolves to whether the
	 * pack is gone.
	 *
	 * Refused while that pack is still downloading: the download would write
	 * the file straight back. The artwork of icons callouts already use is not
	 * this class's concern — IconService.deleteLibrary saves it into `data.json`
	 * before it calls this.
	 */
	async remove(id: IconPackId): Promise<boolean> {
		if (this.work.destroyed || this.inFlight.has(id)) return false;
		const path = this.packPath(id);
		try {
			const adapter = this.app.vault.adapter;
			const exists = await this.work.wait(adapter.exists(path));
			if (this.work.destroyed) return false;
			if (exists) await this.work.wait(adapter.remove(path));
			if (this.work.destroyed) return false;
		} catch (e) {
			if (this.work.destroyed) return false;
			console.warn(`[CalloutStudio] could not delete pack "${id}"`, e);
			return false;
		}
		forgetPackData(id);
		this.states.delete(id);
		this.learned(id, "absent", undefined);
		this.notify();
		return true;
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
