/** One-time recovery copy, never a source of live callout definitions. */
import { normalizePath } from "obsidian";
import type { App, PluginManifest } from "obsidian";

export async function writeLegacyDiscoveryArchive(
	app: App,
	manifest: PluginManifest,
	legacyDiscoveryRaw: string,
	startupCss: string | null,
): Promise<string | null> {
	try {
		const json = JSON.stringify({
			format: "callout-studio-upgrade-recovery",
			version: 1,
			legacyDiscoveryRaw,
			startupCss,
		}, undefined, 2);
		const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
		const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
		const base = manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`;
		const dir = normalizePath(`${base}/backups`);
		const { adapter } = app.vault;
		if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
		// Content-addressed names make retries/upgrades idempotent. Existing
		// copies are only verified, never overwritten or pruned as sync backups.
		// A previous partial write is retained, but must not block every retry.
		for (let copy = 0; copy < 16; copy++) {
			const suffix = copy === 0 ? "" : `-${copy}`;
			const path = normalizePath(`${dir}/legacy-discovery-v1-${hash}${suffix}.json`);
			if (await adapter.exists(path)) {
				if (await adapter.read(path) === json) return path;
				continue;
			}
			await adapter.write(path, json);
			if (await adapter.read(path) !== json) throw new Error("Legacy recovery copy verification failed");
			return path;
		}
		throw new Error("Too many unverifiable legacy recovery copies");
	} catch (error) {
		console.error("[callout-studio] could not archive legacy discovery state", error);
		return null;
	}
}
