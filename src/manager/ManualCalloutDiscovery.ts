/** A user-requested, additive scan. Nothing is published before the save succeeds. */
import type { CalloutDefinition } from "../types";
import type { App } from "obsidian";
import { CalloutRegistry } from "./CalloutRegistry";
import type { SettingsWriter } from "./SettingsWriter";
import { buildKnownCalloutIds } from "./knownCalloutIds";
import { buildDiscoveredRow, fallbackSourceFor } from "./discoveredRow";
import { scanStringForUnknownCallouts } from "../utils/vaultCalloutScanner";
import { mergeDashSpaceVariants, normalizeCalloutId } from "../utils/calloutId";
import { stableKeyOrder } from "../utils/stableJson";

interface ManualDiscoveryHost {
	app: App;
	registry: CalloutRegistry;
	settingsWriter: SettingsWriter;
	themeIds(): ReadonlySet<string>;
	canApply(): boolean;
	onSettled(): void;
}

function snapshot(registry: CalloutRegistry): string {
	return JSON.stringify(stableKeyOrder(registry.toSaveData()));
}

/** CSS attribute values must still be expressible as an actual callout token. */
function usableThemeIds(ids: ReadonlySet<string>): Set<string> {
	return new Set([...ids]
		.filter((id) => !/[[\]|\\\r\n\0]/.test(id))
		.map(normalizeCalloutId).filter(Boolean));
}

export class ManualCalloutDiscovery {
	private inFlight: Promise<number> | null = null;
	private destroyed = false;

	constructor(private readonly host: ManualDiscoveryHost) {}

	/** Repeated clicks join one operation; no timers, listeners, or startup scan. */
	run(): Promise<number> {
		this.inFlight ??= this.scan().finally(() => {
			this.inFlight = null;
			if (!this.destroyed) this.host.onSettled();
		});
		return this.inFlight;
	}

	destroy(): void {
		this.destroyed = true;
	}

	private async scan(): Promise<number> {
		const { app, registry, settingsWriter } = this.host;
		if (this.destroyed || !this.host.canApply() || settingsWriter.isFrozen || settingsWriter.busy) {
			throw new Error("Discovery cannot run while settings are unavailable or being edited");
		}
		const before = snapshot(registry);
		const known = buildKnownCalloutIds(registry);
		const themeIds = usableThemeIds(this.host.themeIds());
		const found = new Set(themeIds);
		// A scan reads saved notes only. Any failure or changing file cancels the
		// whole operation, leaving both the registry and data.json untouched.
		const files = app.vault.getMarkdownFiles().map((file) => ({
			file, path: file.path, mtime: file.stat.mtime, size: file.stat.size,
		}));
		const unchanged = (entry: typeof files[number]): boolean =>
			app.vault.getAbstractFileByPath(entry.path) === entry.file &&
			entry.file.path === entry.path && entry.file.stat.mtime === entry.mtime &&
			entry.file.stat.size === entry.size;
		const current = (): boolean => {
			if (this.destroyed || !this.host.canApply() || snapshot(registry) !== before) return false;
			// Check membership too: a new note arriving from sync means this scan
			// no longer describes the current vault, even if old files are intact.
			if (app.vault.getMarkdownFiles().length !== files.length || !files.every(unchanged)) return false;
			const now = usableThemeIds(this.host.themeIds());
			return now.size === themeIds.size && [...now].every((id) => themeIds.has(id));
		};
		for (const entry of files) {
			if (this.destroyed || !this.host.canApply() || !unchanged(entry)) {
				throw new Error("Settings or notes changed during discovery");
			}
			const content = await app.vault.read(entry.file);
			for (const id of scanStringForUnknownCallouts(content, known)) found.add(id);
		}
		if (!current()) throw new Error("Settings or notes changed during discovery");

		// Stage in an isolated registry: no CSS, commands, save listeners or
		// partial results escape while the vault is still being read.
		const staged = new CalloutRegistry();
		staged.load(structuredClone(registry.toSaveData()));
		const fallback = fallbackSourceFor(staged, staged.settings.fallbackCalloutId);
		const added: CalloutDefinition[] = [];
		for (const id of mergeDashSpaceVariants([...found]).sort()) {
			if (known.has(id) || staged.get(id) || staged.findAttrIdConflict(id, null)) continue;
			const row = buildDiscoveredRow(id, fallback);
			if (staged.add(row)) added.push(row);
		}
		if (added.length === 0) return 0;
		let published = 0;
		const saved = await settingsWriter.commit(staged.toSaveData(), current, () => {
			if (this.destroyed) return;
			const latestFallback = fallbackSourceFor(registry, registry.settings.fallbackCalloutId);
			registry.batch(() => {
				for (const row of added) {
					// A local edit made while the file write was in flight wins.
					// Rebuild against its fallback too: that edit may have changed
					// the chosen fallback or its colors before these rows existed.
					if (registry.add(buildDiscoveredRow(row.id, latestFallback))) published++;
				}
			});
		});
		if (!saved) throw new Error("Settings changed or could not be saved; run discovery again");
		return published;
	}
}
