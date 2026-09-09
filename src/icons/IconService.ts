/**
 * icons/IconService.ts — The plugin's single entry point to icon artwork.
 *
 * Two very different supply routes sit behind it:
 *
 * - `perIconRemote` (Material Symbols) fetches one drawing at a time from the
 *   vendor, because its 100,000-odd style/weight combinations rule out any bulk
 *   file. Handled by IconFetchManager.
 * - `bundledRemote` (Octicons, and the packs after it) downloads the whole
 *   pack once and then works offline. Handled by PackDataStore.
 *
 * Whichever route an icon takes, its artwork is also copied into `data.json`
 * once the user commits to it. That copy is what makes a callout render on a
 * second device that synced the settings but never downloaded the pack, and
 * what makes it survive someone deleting the pack file.
 */
import { Notice } from "obsidian";
import type { App, PluginManifest } from "obsidian";
import type { CalloutIcon, CalloutRenderRole, IconPackId } from "../types";
import { copyIconPackArtwork, isIconFullyCached } from "./iconArtworkCache";
import { t } from "../i18n";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { CSSInjector } from "../manager/CSSInjector";
import { IconFetchManager } from "./IconFetchManager";
import { PackDataStore } from "./PackDataStore";
import { createIconResolver } from "./resolver";
import { packFor } from "./registry";
import type { IconResolver } from "./types";

interface IconServiceHost {
	app: App;
	manifest: PluginManifest;
	registry: CalloutRegistry;
	cssInjector: CSSInjector;
	saveSettings(): Promise<void>;
}

export class IconService implements IconResolver {
	readonly packs: PackDataStore;
	private readonly fetch: IconFetchManager;
	private readonly resolver: IconResolver;
	private readonly listeners = new Set<() => void>();
	private destroyed = false;

	constructor(private readonly host: IconServiceHost) {
		this.packs = new PackDataStore(host.app, host.manifest);
		this.fetch = new IconFetchManager({
			registry: host.registry,
			cssInjector: host.cssInjector,
			saveSettings: () => host.saveSettings(),
		});
		this.resolver = createIconResolver(host.registry, (icon, role) =>
			this.fetch.hasFailed(icon, role),
		);
		// Either supply route finishing is the same event to the UI: artwork
		// that was a placeholder can now be painted.
		this.fetch.onChange(() => this.notify());
		this.packs.onChange(() => this.notify());
	}

	// ── IconResolver ────────────────────────────────────────────────────

	resolveSvg(icon: CalloutIcon, role: CalloutRenderRole): string | null {
		return this.destroyed ? null : this.resolver.resolveSvg(icon, role);
	}

	hasFailed(icon: CalloutIcon, role: CalloutRenderRole): boolean {
		if (this.destroyed) return false;
		if (this.resolver.hasFailed(icon, role)) return true;
		// A pack whose download gave up is just as permanently unavailable as a
		// per-icon fetch that did. Without this the settings list would spin
		// forever on an imported icon from a source that could not be fetched.
		return this.packs.state(icon.type) === "failed";
	}

	onChange(cb: () => void): () => void {
		if (this.destroyed) return () => {};
		this.listeners.add(cb);
		return () => {
			this.listeners.delete(cb);
		};
	}

	private notify(): void {
		for (const cb of this.listeners) {
			if (this.destroyed) break;
			try {
				cb();
			} catch (e) {
				console.warn("[CalloutStudio] icon listener error", e);
			}
		}
	}

	// ── Lifecycle ───────────────────────────────────────────────────────

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.listeners.clear();
		this.fetch.destroy();
		this.packs.destroy();
	}

	/**
	 * Startup: read from disk the packs this vault actually uses, replace any
	 * that have gone missing or bad, then fill in missing per-icon artwork. No
	 * pack a vault does not reference is ever read, so an unused 400 KB file
	 * costs nothing.
	 */
	async initialize(): Promise<void> {
		if (this.destroyed) return;
		// A callout drawing no icon still stores one, but nothing paints it, so
		// it must not pull a whole pack off disk (or, further down, off the
		// network). Its cached SVG is left alone by cleanupUnusedIconSvgs, so
		// turning the icon back on needs neither.
		const icons = this.host.registry
			.getAll()
			.filter((def) => def.source !== "theme" && def.hideIcon !== true)
			.map((def) => def.icon);
		const results = await this.packs.loadUsed(icons.map((icon) => icon.type));
		if (this.destroyed) return;
		// Repaint: pack artwork read from disk arrives after the first inject.
		this.host.cssInjector.inject();
		if (this.destroyed) return;

		for (const [id, result] of results) {
			if (result === "corrupt") {
				console.warn(
					`[CalloutStudio] pack "${id}" on disk is damaged; replacing it`,
				);
			}
		}

		// Material first, because its sweep is the one built for startup: a
		// single attempt per icon. Going the other way round would send every
		// missing Material icon through cacheOne's three attempts and its waits
		// between them, on a vault that may simply be offline.
		await this.fetch.ensureAll();
		if (this.destroyed) return;
		// Then repair whatever the packs would have drawn. Icons whose artwork
		// is already in `data.json` are skipped, so a deleted pack file whose
		// icons are all cached downloads nothing at all.
		await this.ensureArtworkFor(icons);
	}

	// ── Making an icon usable ───────────────────────────────────────────

	/**
	 * Make `icon` renderable and keep it that way, downloading if needed.
	 * Called when the user confirms a choice in the picker and again on save.
	 */
	async ensureArtwork(icon: CalloutIcon): Promise<void> {
		if (!this.destroyed && await this.fetchArtwork(icon)) await this.publish();
	}

	/**
	 * Fetch one icon's artwork into the cache, without announcing it. Returns
	 * whether anything new was stored.
	 *
	 * Split from `ensureArtwork` so a batch can repaint and write `data.json`
	 * once at the end rather than once per icon.
	 */
	private async fetchArtwork(icon: CalloutIcon): Promise<boolean> {
		if (this.destroyed) return false;
		const pack = packFor(icon);
		if (!pack) return false;

		if (pack.kind === "perIconRemote") {
			// cacheOne does its own repaint and save, one icon at a time.
			await this.fetch.cacheOne(icon);
			return false;
		}
		if (pack.kind !== "bundledRemote") return false;

		// Only the file this icon's own style lives in — picking one Font Awesome
		// Brands icon must not pull down Solid and Regular as well.
		if (this.packs.state(icon.type) !== "ready") {
			// A file that is there but damaged is no more usable than none at
			// all, so both outcomes fall through to the download.
			const result = await this.packs.loadFromDisk(icon.type);
			if (this.destroyed) return false;
			if (result !== "ready") await this.packs.download(icon.type);
		}
		return !this.destroyed && copyIconPackArtwork(this.host.registry, icon);
	}

	/** Repaint and persist newly cached artwork. */
	private async publish(): Promise<void> {
		if (this.destroyed) return;
		this.host.cssInjector.inject();
		if (this.destroyed) return;
		await this.host.saveSettings();
		this.notify();
	}

	/**
	 * Make a whole batch of icons renderable, downloading whatever is missing.
	 *
	 * Two situations need this, and they are the same situation: a callout has
	 * arrived from somewhere other than the picker — an import, or the vault
	 * itself on startup — carrying an icon whose artwork this device may not
	 * have. `ensureArtwork` handles one icon; this handles a set without
	 * downloading the same pack once per icon — failed downloads included,
	 * which is the case where asking twice actually costs something.
	 *
	 * Icons already drawable are skipped entirely, which is what keeps a second
	 * device that synced `data.json` from re-downloading packs it never needed.
	 */
	async ensureArtworkFor(icons: readonly CalloutIcon[]): Promise<void> {
		if (this.destroyed) return;
		const pending = icons.filter(
			(icon) =>
				!isIconFullyCached(this.host.registry, icon) &&
				// Already tried and given up on this session — retrying here
				// would just repeat the wait. Cleared on the next launch.
				!this.hasFailed(icon, "regular"),
		);
		if (pending.length === 0) return;

		// One entry per icon type, so Font Awesome Brands and Solid are two
		// downloads while twenty Brands icons are one.
		const byType = new Map<IconPackId, CalloutIcon[]>();
		for (const icon of pending) {
			const group = byType.get(icon.type);
			if (group) group.push(icon);
			else byType.set(icon.type, [icon]);
		}

		const restored = new Set<string>();
		let stored = false;
		for (const group of byType.values()) {
			// Sequential: parallel requests to one CDN gain nothing and make a
			// failure harder to attribute. The first icon pulls the pack down
			// and the rest only copy artwork out of it — or, if it could not be
			// got at all, read that off `hasFailed`, which the filter above ran
			// too early to know and which a failed pack never stops answering.
			for (const icon of group) {
				if (this.hasFailed(icon, "regular")) continue;
				if (await this.fetchArtwork(icon)) stored = true;
				if (this.destroyed) return;
			}
			const first = group[0];
			if (!first || !group.every((i) => isIconFullyCached(this.host.registry, i))) continue;
			const title = packFor(first)?.attribution.title;
			if (title) restored.add(title);
		}
		if (stored) await this.publish();
		if (this.destroyed) return;

		// Say what was fetched, once for the batch. Anything that failed has
		// already announced itself — a per-icon Notice from the fetch manager,
		// or an error icon on the row via `hasFailed`.
		if (restored.size > 0) {
			new Notice(
				t("iconPack.artworkRestored", {
					names: [...restored].join(", "),
				}),
			);
		}
	}


}
