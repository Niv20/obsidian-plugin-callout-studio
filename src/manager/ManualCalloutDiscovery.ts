/** A user-requested, additive scan. Nothing is published before the save succeeds. */
import type { CalloutDefinition } from "../types";
import type { App } from "obsidian";
import { CalloutRegistry } from "./CalloutRegistry";
import type { SettingsWriter } from "./SettingsWriter";
import { buildKnownCalloutIds } from "./knownCalloutIds";
import { buildDiscoveredRow, fallbackSourceFor } from "./discoveredRow";
import { scanStringForUnknownCallouts } from "../utils/vaultCalloutScanner";
import { mergeDashSpaceVariants } from "../utils/calloutId";
import { usableThemeIds } from "../utils/usableCallouts";
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

export class ManualCalloutDiscovery {
	private inFlight: Promise<number> | null = null;
	private destroyed = false;

	constructor(private readonly host: ManualDiscoveryHost) {}

	/**
	 * Repeated clicks join one operation; no timers, listeners, or startup scan.
	 *
	 * @param beforeSave Awaited once the notes are read, before the new rows are
	 *   built, saved and shown. Building and drawing hundreds of new rows holds
	 *   the page for most of a second, so the caller clears its "Scanning…"
	 *   notice here first. Only the call that starts the scan is heard; a call
	 *   that joins it is not.
	 */
	run(beforeSave?: () => Promise<void>): Promise<number> {
		this.inFlight ??= this.scan(beforeSave).finally(() => {
			this.inFlight = null;
			if (!this.destroyed) this.host.onSettled();
		});
		return this.inFlight;
	}

	destroy(): void {
		this.destroyed = true;
	}

	private async scan(beforeSave?: () => Promise<void>): Promise<number> {
		const { app, registry, settingsWriter } = this.host;
		if (this.destroyed || !this.host.canApply() || settingsWriter.isFrozen || settingsWriter.busy) {
			throw new Error("Discovery cannot run while settings are unavailable or being edited");
		}
		const before = snapshot(registry);
		const known = buildKnownCalloutIds(registry);
		// Notes are the only source of new rows. A type the active theme declares
		// is saved like any other unknown type: when a note uses it. Seeding this
		// set with every declared id saved a theme's whole catalogue - dozens of
		// types no note used - and they all poured into My callout types and the
		// `[!` dropdown the moment the theme let go of them (another theme, or
		// "Use your theme's callout styles" off). The theme's ids are still read,
		// but only for the freshness check below.
		const themeIds = usableThemeIds(this.host.themeIds());
		const found = new Set<string>();
		// A scan reads saved notes only. Any failure or changing file cancels the
		// whole operation, leaving both the registry and data.json untouched.
		const files = app.vault.getMarkdownFiles().map((file) => ({
			file,
			path: file.path,
			mtime: file.stat.mtime,
			size: file.stat.size,
		}));
		const unchanged = (entry: (typeof files)[number]): boolean =>
			app.vault.getAbstractFileByPath(entry.path) === entry.file &&
			entry.file.path === entry.path &&
			entry.file.stat.mtime === entry.mtime &&
			entry.file.stat.size === entry.size;
		// What the new rows are built from and saved over: the settings. The theme
		// is checked as well: it no longer adds rows, but a theme switch during a
		// scan has always cancelled it, and still does - one more click, and the
		// scan stays all-or-nothing against the inputs it started with.
		const settingsCurrent = (): boolean => {
			if (this.destroyed || !this.host.canApply() || snapshot(registry) !== before) return false;
			const now = usableThemeIds(this.host.themeIds());
			return now.size === themeIds.size && [...now].every((id) => themeIds.has(id));
		};
		const current = (): boolean => {
			if (!settingsCurrent()) return false;
			// Check membership too: a new note arriving from sync means this scan
			// no longer describes the current vault, even if old files are intact.
			return app.vault.getMarkdownFiles().length === files.length && files.every(unchanged);
		};
		for (const entry of files) {
			if (this.destroyed || !this.host.canApply() || !unchanged(entry)) {
				throw new Error("Settings or notes changed during discovery");
			}
			const content = await app.vault.read(entry.file);
			for (const id of scanStringForUnknownCallouts(content, known)) found.add(id);
		}
		if (!current()) throw new Error("Settings or notes changed during discovery");
		// The caller's wait is its "Scanning…" notice staying up for a moment, not
		// reading: a note that a sync service or another plugin changes meanwhile
		// does not make what was read wrong, since a scan only adds types. So the
		// notes are checked once, above, and from here on only the settings and
		// the theme, which a change made during the wait still cancels the scan for.
		let stillCurrent = current;
		if (beforeSave) {
			await beforeSave();
			stillCurrent = settingsCurrent;
			if (!stillCurrent()) throw new Error("Settings changed during discovery");
		}

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
		const saved = await settingsWriter.commit(staged.toSaveData(), stillCurrent, () => {
			if (this.destroyed) return;
			const latestFallback = fallbackSourceFor(registry, registry.settings.fallbackCalloutId);
			registry.batch(() => {
				for (const row of added) {
					// The theme overlay may be holding this id — a note uses a type
					// the active theme declares. `add` would refuse, leaving
					// the row on disk but not in the live registry. Retiring the
					// ephemeral row first is what promotes it to real settings.
					if (registry.get(row.id)?.source === "theme") registry.remove(row.id);
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
