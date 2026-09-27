/** Device-only UI and onboarding state. Legacy discovery is archived, never restored. */
import type { App, PluginManifest } from "obsidian";
import { LEGACY_STARTUP_CSS_STORAGE_KEY } from "./startupStyleKeys";
import type { CalloutListsFoldState } from "../types";
import { WriteMemo } from "../utils/writeMemo";
import { writeLegacyDiscoveryArchive } from "./legacyDiscoveryArchive";
import { SHARED_DEVICE_ID } from "./settingsBackup";

export type LegacyDiscoveryMigration =
	| { kind: "none" }
	| { kind: "archived"; path: string }
	| { kind: "failed" };

interface DeviceLocalState {
	v: 3;
	/** Protect a previously used installation when data.json temporarily vanishes. */
	initialized: boolean;
	/** Prevent the automatic welcome from reopening before data.json exists. */
	welcomeSeen: boolean;
	/** Pending is affected-user evidence; display waits for a durable migration. */
	externalCssRetirement?: "pending" | "seen";
	/** Pending is an explicit saved autocomplete opt-out awaiting its notice. */
	autocompleteAlwaysEnabled?: "pending" | "seen";
	/** The import prompt was dismissed or used here, before any settings file existed. */
	importBannerHandled?: true;
	/** Names this device's settings backups; see manager/settingsBackup.ts. */
	deviceId?: string;
	/**
	 * Where the icon picker and Quick Insert were left. Remembered per device:
	 * in the synced file, every glance at another category was a settings write
	 * that every other device then had to adopt.
	 */
	iconCategories?: Record<string, string>;
	emojiSkinTone?: number;
	quickInsertSource?: string;
	listsExpanded: CalloutListsFoldState;
}

type ParsedState = Partial<Record<keyof DeviceLocalState, unknown>> & { v?: number; listsExpanded?: Partial<CalloutListsFoldState> };

/** Valid picker and Quick Insert memory, and a device id, from stored JSON. */
function memoryFrom(parsed: ParsedState): Partial<DeviceLocalState> {
	const out: Partial<DeviceLocalState> = {};
	if (typeof parsed.deviceId === "string" && /^[a-z0-9]{8}$/.test(parsed.deviceId)) out.deviceId = parsed.deviceId;
	const categories = parsed.iconCategories;
	if (categories && typeof categories === "object" && !Array.isArray(categories)) {
		out.iconCategories = Object.fromEntries(Object.entries(categories)
			.filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length <= 200));
	}
	const tone = parsed.emojiSkinTone;
	if (typeof tone === "number" && Number.isInteger(tone) && tone >= 0 && tone <= 5) out.emojiSkinTone = tone;
	if (typeof parsed.quickInsertSource === "string" && parsed.quickInsertSource.length <= 32) out.quickInsertSource = parsed.quickInsertSource;
	return out;
}

export class DeviceLocalStore {
	private state: DeviceLocalState = {
		v: 3,
		initialized: false,
		welcomeSeen: false,
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
			const parsed = JSON.parse(raw) as ParsedState;
			if (!parsed || (parsed.v !== 1 && parsed.v !== 2 && parsed.v !== 3)) return;
			this.state = {
				v: 3,
				initialized: parsed.v === 1 || parsed.initialized === true,
				welcomeSeen: parsed.v === 3 && parsed.welcomeSeen === true,
				...(parsed.externalCssRetirement === "pending" || parsed.externalCssRetirement === "seen"
					? { externalCssRetirement: parsed.externalCssRetirement } : {}),
				...(parsed.autocompleteAlwaysEnabled === "pending" || parsed.autocompleteAlwaysEnabled === "seen"
					? { autocompleteAlwaysEnabled: parsed.autocompleteAlwaysEnabled } : {}),
				...(parsed.importBannerHandled === true ? { importBannerHandled: true as const } : {}),
				...memoryFrom(parsed),
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
			const cssKey = this.scopedKey().replace(/callout-studio-local$/, LEGACY_STARTUP_CSS_STORAGE_KEY);
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

	get hasSeenWelcome(): boolean {
		return this.state.welcomeSeen;
	}

	markWelcomeSeen(): void {
		this.state.welcomeSeen = true;
		this.persist();
	}

	get hasPendingExternalCssNotice(): boolean {
		return this.state.externalCssRetirement === "pending";
	}

	queueExternalCssNotice(): void {
		if (this.state.externalCssRetirement === "seen") return;
		this.state.externalCssRetirement = "pending";
		this.persist();
	}

	markExternalCssNoticeSeen(): void {
		this.state.externalCssRetirement = "seen";
		this.persist();
	}

	get hasPendingAutocompleteNotice(): boolean {
		return this.state.autocompleteAlwaysEnabled === "pending";
	}

	queueAutocompleteNotice(): void {
		if (this.state.autocompleteAlwaysEnabled === "seen") return;
		this.state.autocompleteAlwaysEnabled = "pending";
		this.persist();
	}

	markAutocompleteNoticeSeen(): void {
		this.state.autocompleteAlwaysEnabled = "seen";
		this.persist();
	}

	/**
	 * The synced flag cannot hold this on a device without a settings file:
	 * dismissing a prompt is not a reason to create one, so the answer is
	 * remembered here as well.
	 */
	get hasHandledImportBanner(): boolean {
		return this.state.importBannerHandled === true;
	}

	markImportBannerHandled(): void {
		this.state.importBannerHandled = true;
		this.persist();
	}

	/**
	 * A random name for this device, kept for as long as its local storage is.
	 * Storage that cannot be written would give a new name every launch, and
	 * every launch's backups would then belong to nobody; such devices share
	 * one name instead, and tidy each other's copies as the old builds did.
	 */
	get deviceId(): string {
		if (!this.state.deviceId) {
			if (!this.writable) return SHARED_DEVICE_ID;
			this.state.deviceId = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
			this.persist();
		}
		return this.state.deviceId;
	}

	iconCategory(source: string): string | undefined {
		return this.state.iconCategories?.[source];
	}

	setIconCategory(source: string, category: string): void {
		this.state.iconCategories = { ...this.state.iconCategories, [source]: category };
		this.persist();
	}

	get emojiSkinTone(): number | undefined {
		return this.state.emojiSkinTone;
	}

	setEmojiSkinTone(tone: number): void {
		this.state.emojiSkinTone = tone;
		this.persist();
	}

	get quickInsertSource(): string | undefined {
		return this.state.quickInsertSource;
	}

	setQuickInsertSource(source: string): void {
		this.state.quickInsertSource = source;
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
