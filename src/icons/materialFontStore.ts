/**
 * icons/materialFontStore.ts — Keeps the Material Symbols webfont on disk.
 *
 * The picker draws Material's grid from a webfont rather than from artwork (see
 * `packs/materialFont.ts` for why), which used to mean the grid was only ever as
 * reliable as the connection at the moment it opened. One file per family, in
 * the plugin's own folder, turns that into a one-time cost: after a single
 * successful load the grid renders offline, on every later launch, forever.
 *
 * Deliberately modelled on `PackDataStore` but kept separate from it — that
 * class is about `IconPackId`-keyed JSON verified against a build-time SHA-256,
 * and a webfont has neither an id nor a checksum the build could know, since
 * Google reissues the file whenever the icon set changes.
 *
 * The same three rules still hold:
 *
 * - **Nothing is fetched for the cache's own sake.** It only ever stores bytes a
 *   load the user already triggered has just proven it needs.
 * - **Only plausible bytes are accepted**, on write and on every later read: a
 *   captive portal's login page is a 200 with a body, and handing that to
 *   `FontFace` would poison the cache for good.
 * - **Disk is a cache, never a dependency.** Every failure here is survivable —
 *   the caller falls back to the network path it would have used anyway.
 */
import { normalizePath } from "obsidian";
import type { App, PluginManifest } from "obsidian";

/**
 * woff2's magic number, "wOF2". Not a checksum — nothing here can know the
 * expected bytes — but it is the difference between a font and the HTML a
 * captive portal or an error page would otherwise leave cached in its place.
 */
const WOFF2_MAGIC = [0x77, 0x4f, 0x46, 0x32];

/**
 * A generous ceiling on one family's file. The three Material families run
 * 1.0–1.5 MB; anything past this is not the font, and writing it would cost
 * vault space for something that will fail to parse on the next read anyway.
 */
const MAX_FONT_BYTES = 8 * 1024 * 1024;

class MaterialFontStore {
	private destroyed = false;

	constructor(
		private readonly app: App,
		private readonly manifest: PluginManifest,
	) {}

	/** Captured references must stop as well as the module-level accessor. */
	destroy(): void {
		this.destroyed = true;
	}

	get isDestroyed(): boolean { return this.destroyed; }

	/**
	 * The plugin's own folder, so uninstalling takes the fonts with it.
	 * `manifest.dir` is typed optional, hence the reconstruction fallback —
	 * the same shape `PackDataStore.packDir()` uses.
	 */
	private dir(): string {
		const base =
			this.manifest.dir ??
			`${this.app.vault.configDir}/plugins/${this.manifest.id}`;
		return normalizePath(`${base}/icon-fonts`);
	}

	/** `"Material Symbols Outlined"` → `…/icon-fonts/material-symbols-outlined.woff2`. */
	private path(family: string): string {
		const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		return normalizePath(`${this.dir()}/${slug}.woff2`);
	}

	/** Whether this family is already cached, without reading it back. */
	async has(family: string): Promise<boolean> {
		if (this.destroyed) return false;
		try {
			const exists = await this.app.vault.adapter.exists(this.path(family));
			return !this.destroyed && exists;
		} catch {
			return false;
		}
	}

	/**
	 * The cached font, or null if there is nothing usable there.
	 *
	 * The magic number is re-checked on read rather than trusted from write
	 * time: the vault syncs, and a file truncated mid-sync is a live way to end
	 * up with a plausible path holding implausible bytes.
	 */
	async read(family: string): Promise<ArrayBuffer | null> {
		if (this.destroyed) return null;
		const path = this.path(family);
		try {
			if (!(await this.app.vault.adapter.exists(path)) || this.destroyed) return null;
			const bytes = await this.app.vault.adapter.readBinary(path);
			if (this.destroyed) return null;
			if (!isWoff2(bytes)) {
				console.warn(
					`[CalloutStudio] cached webfont at ${path} is not woff2; discarding`,
				);
				await this.remove(family);
				return null;
			}
			return bytes;
		} catch (e) {
			if (!this.destroyed) console.warn(`[CalloutStudio] could not read cached webfont ${path}`, e);
			return null;
		}
	}

	/**
	 * Persist a family. Best-effort by design: a read-only vault or a suspended
	 * mobile app must not cost the user the grid they are already looking at, so
	 * failure only downgrades this to session-only.
	 */
	async write(family: string, bytes: ArrayBuffer): Promise<void> {
		if (this.destroyed || !isWoff2(bytes) || bytes.byteLength > MAX_FONT_BYTES) return;
		const adapter = this.app.vault.adapter;
		try {
			const dir = this.dir();
			const exists = await adapter.exists(dir);
			if (this.destroyed) return;
			if (!exists) await adapter.mkdir(dir);
			if (this.destroyed) return;
			await adapter.writeBinary(this.path(family), bytes);
		} catch (e) {
			if (!this.destroyed) console.warn(`[CalloutStudio] could not cache the "${family}" webfont`, e);
		}
	}

	private async remove(family: string): Promise<void> {
		if (this.destroyed) return;
		try {
			await this.app.vault.adapter.remove(this.path(family));
		} catch {
			// Already gone, or not ours to delete. Either way the read failed,
			// which is all the caller needed to know.
		}
	}
}

/**
 * The one store, read by `ensureMaterialFontLoaded`.
 *
 * A module-level snapshot for the same reason `packs/userImages.ts` keeps one:
 * the font loader is a free function called from CSSInjector and from the
 * picker, neither of which has a route back to the plugin instance.
 */
let store: MaterialFontStore | null = null;

/** Called once from `main.ts`. Until then, every load takes the network path. */
export function setMaterialFontStore(app: App, manifest: PluginManifest): void {
	store?.destroy();
	store = new MaterialFontStore(app, manifest);
}

/** Dropped on unload so a disabled plugin holds no reference to the app. */
export function clearMaterialFontStore(): void {
	store?.destroy();
	store = null;
}

export function materialFontStore(): MaterialFontStore | null {
	return store;
}

function isWoff2(bytes: ArrayBuffer): boolean {
	if (bytes.byteLength < WOFF2_MAGIC.length) return false;
	const head = new Uint8Array(bytes, 0, WOFF2_MAGIC.length);
	return WOFF2_MAGIC.every((byte, i) => head[i] === byte);
}
