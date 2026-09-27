import { CURRENT_DATA_VERSION, DEFAULT_SETTINGS } from "../constants";
import type { PluginData, PluginSettings } from "../types";
import { SYNC_KEY } from "./syncTree";

const KNOWN_SETTINGS_KEYS: ReadonlySet<string> = new Set(
	Object.keys(DEFAULT_SETTINGS),
);

const RETIRED_SETTINGS_KEYS: ReadonlySet<string> = new Set([
	// Retired discovery settings must never be carried back into data.json.
	"autoDiscoverCallouts",
	"ignoredCalloutIds",
	"firstRunCompleted",
	"retiredThemeIds",
	// The 1.x name for the context menu, folded into `contextMenu` by
	// `mergeSavedSettings`' legacy pass. Carrying it would keep a shape the
	// merge has already read and translated.
	"popup",
]);

const KNOWN_DATA_KEYS: ReadonlySet<string> = new Set([
	"version",
	"callouts",
	"settings",
	"iconSvgCache",
	// Read once on load and never written again — see PluginData. Dropping it
	// is the point, so it must not be quarantined back in.
	"materialSvgCache",
	"materialIconsCache",
	// Sync history belongs to the file it was read with. The writer builds a
	// fresh envelope for every write; carried here, the loaded one rode along
	// in every registry snapshot and certified a body it no longer described,
	// so backups and recovery copies failed their own integrity check.
	SYNC_KEY,
]);

export interface ForeignFields {

	data: Record<string, unknown>;

	settings: Record<string, unknown>;
}

export const NO_FOREIGN_FIELDS: ForeignFields = { data: {}, settings: {} };

function entriesOf(value: unknown): [string, unknown][] {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return [];
	}
	return Object.entries(value as Record<string, unknown>);
}

function unrecognised(
	value: unknown,
	known: ReadonlySet<string>,
	retired: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
	return Object.fromEntries(entriesOf(value).filter(([key, entry]) => {
		if (known.has(key) || retired.has(key)) return false;
		// An explicit `undefined` is not a value another build is keeping — it
		// does not survive `JSON.stringify` either way, and reproducing the key
		// would only make the two files look different.
		// fromEntries preserves every name as an own property, including
		// __proto__, without invoking the prototype setter on a plain object.
		return entry !== undefined;
	}));
}

export function collectForeignFields(
	saved: Partial<PluginData> | null,
): ForeignFields {
	if (!saved) return NO_FOREIGN_FIELDS;
	return {
		data: unrecognised(saved, KNOWN_DATA_KEYS),
		settings: unrecognised(
			saved.settings,
			KNOWN_SETTINGS_KEYS,
			RETIRED_SETTINGS_KEYS,
		),
	};
}

export function withForeignSettings(
	settings: PluginSettings,
	foreign: ForeignFields,
): PluginSettings {
	return { ...foreign.settings, ...settings };
}

export function isFromNewerBuild(saved: Partial<PluginData> | null): boolean {
	return isNewerSettingsFormat(saved);
}

/**
 * Written by a later build: a data format above this one's, or a sync envelope
 * version this build does not know. Asked before the shape gate, because a
 * later build may retype a field, and a file this build cannot read is then a
 * reason to update, not evidence of damage.
 */
export function isNewerSettingsFormat(saved: unknown): boolean {
	if (!saved || typeof saved !== "object") return false;
	const { version, [SYNC_KEY]: envelope } = saved as Record<string, unknown>;
	if (typeof version === "number" && version > CURRENT_DATA_VERSION) return true;
	const envelopeVersion = envelope && typeof envelope === "object" ? (envelope as { version?: unknown }).version : undefined;
	return typeof envelopeVersion === "number" && envelopeVersion > 2;
}
