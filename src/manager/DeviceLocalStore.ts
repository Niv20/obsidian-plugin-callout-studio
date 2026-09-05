/** Device-only UI preferences. Legacy discovery is archived, never restored. */
import type { App, PluginManifest } from "obsidian";
import type { CalloutListsFoldState } from "../types";
import { WriteMemo } from "../utils/writeMemo";
import { writeLegacyDiscoveryArchive } from "./legacyDiscoveryArchive";

export type LegacyDiscoveryMigration =
	| { kind: "none" }
	| { kind: "archived"; path: string }
	| { kind: "failed" };

interface DeviceLocalState {
	v: 2;
	/** Protect a previously used installation when data.json temporarily vanishes. */
	initialized: boolean;
	listsExpanded: CalloutListsFoldState;
}

export class DeviceLocalStore {
	private state: DeviceLocalState = {
		v: 2,
		initialized: false,
		listsExpanded: { theme: true, user: true, builtin: true, palettes: true },
	};
	private readonly memo = new WriteMemo();
	private legacyRaw: string | null = null;
	private writable = true;
	private migration: Promise<LegacyDiscoveryMigration> | null = null;

	constructor(private readonly app: App) {
		try {
			const raw = window.localStorage.getItem(this.scopedKey());
			if (!raw) return;
			// Any existing blob proves this is not a never-used installation.
			// Unknown/corrupt data must not be overwritten by UI preferences.
			this.writable = false;
			this.state.initialized = true;
			const parsed = JSON.parse(raw) as { v?: number; initialized?: boolean; listsExpanded?: Partial<CalloutListsFoldState> };
			if (!parsed || (parsed.v !== 1 && parsed.v !== 2)) return;
			this.state = {
				v: 2,
				initialized: parsed.v === 1 || parsed.initialized === true,
				listsExpanded: {
					theme: parsed.listsExpanded?.theme !== false,
					user: parsed.listsExpanded?.user !== false,
					builtin: parsed.listsExpanded?.builtin !== false,
					palettes: parsed.listsExpanded?.palettes !== false,
				},
			};
			this.memo.adopt(raw);
			if (parsed.v === 1) this.legacyRaw = raw;
			else {
				this.writable = true;
				this.persist();
			}
		} catch {
			// Without readable storage, absence of data.json is not proof of a
			// new install. UI preferences remain usable for this session.
			this.state.initialized = true;
			this.writable = false;
		}
	}

	/** Run once before settings load can replace the previous startup CSS. */
	archiveLegacyDiscovery(manifest: PluginManifest): Promise<LegacyDiscoveryMigration> {
		if (this.migration) return this.migration;
		this.migration = this.archiveLegacy(manifest).finally(() => { this.migration = null; });
		return this.migration;
	}

	private async archiveLegacy(manifest: PluginManifest): Promise<LegacyDiscoveryMigration> {
		const raw = this.legacyRaw;
		if (raw === null) return { kind: "none" };
		try {
			const cssKey = this.scopedKey().replace(/callout-studio-local$/, "callout-studio-css");
			const css = window.localStorage.getItem(cssKey);
			const path = await writeLegacyDiscoveryArchive(this.app, manifest, raw, css);
			if (path === null) return { kind: "failed" };
			// Another window/old plugin may have written while the archive was
			// saving. Leave both original keys intact unless this is still our copy.
			if (window.localStorage.getItem(this.scopedKey()) !== raw || window.localStorage.getItem(cssKey) !== css) {
				return { kind: "failed" };
			}
			this.legacyRaw = null;
			this.writable = true;
			this.persist();
			return { kind: "archived", path };
		} catch {
			return { kind: "failed" };
		}
	}

	get hasInitialized(): boolean {
		return this.state.initialized;
	}

	markInitialized(): void {
		this.state.initialized = true;
		this.persist();
	}

	isExpanded(kind: keyof CalloutListsFoldState): boolean {
		return this.state.listsExpanded[kind];
	}

	setExpanded(kind: keyof CalloutListsFoldState, expanded: boolean): void {
		this.state.listsExpanded[kind] = expanded;
		this.persist();
	}

	private scopedKey(): string {
		const appId = (this.app as App & { appId?: string }).appId;
		return `${appId ?? this.app.vault.getName()}-callout-studio-local`;
	}

	private persist(): void {
		if (!this.writable) return;
		const json = JSON.stringify(this.state);
		if (this.memo.prepare(json) === null) return;
		try {
			window.localStorage.setItem(this.scopedKey(), json);
			this.memo.commit(json);
		} catch {
			// A refused write must be retryable.
		}
	}
}
