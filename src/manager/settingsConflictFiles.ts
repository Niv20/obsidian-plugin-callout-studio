/** Read only explicitly named, intact settings conflict copies in this plugin. */
import { normalizePath } from "obsidian";
import type { SettingsFileHost } from "./settingsFile";
import type { PluginData } from "../types";
import { hasSafeSettingsFileShape } from "./settingsFileShape";
import { canonical, SYNC_KEY } from "./syncTree";

export function isSettingsConflictFile(name: string): boolean {
	return /^data\.sync-conflict-\d{8}-\d{6}-[a-z0-9-]+\.json$/i.test(name) ||
		/^data \(Conflicted copy .+ \d{12}\)\.json$/i.test(name);
}

export async function readSettingsConflictFiles(host: SettingsFileHost): Promise<Partial<PluginData>[]> {
	const dir = normalizePath(host.manifest.dir ?? `${host.app.vault.configDir}/plugins/${host.manifest.id}`);
	const adapter = host.app.vault.adapter;
	// Small test/embed hosts may not expose directory reads. Production
	// adapters do; operational errors propagate so adoption is deferred.
	if (!adapter.list || !adapter.read) return [];
	const listing = await adapter.list(dir);
	const result: Partial<PluginData>[] = [];
	for (const file of listing.files.sort()) {
		const path = normalizePath(file);
		if (!path.startsWith(`${dir}/`)) continue;
		const name = path.slice(dir.length + 1);
		if (name.includes("/") || !isSettingsConflictFile(name)) continue;
		try {
			const first = await adapter.read(path), second = await adapter.read(path);
			if (first !== second) continue;
			const data = JSON.parse(first) as Record<string, unknown>;
			// Unstamped backup-like copies cannot establish edit causality.
			// Leave those untouched for explicit recovery; never guess a winner.
			if (!data || typeof data !== "object" || Array.isArray(data) || !data[SYNC_KEY] ||
				!hasSafeSettingsFileShape(data)) continue;
			if (!result.some(previous => canonical(previous) === canonical(data))) result.push(data);
		} catch (error) {
			console.warn("[callout-studio] leaving an unavailable settings conflict copy untouched", path, error);
		}
	}
	return result;
}
