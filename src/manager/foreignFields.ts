import { CURRENT_DATA_VERSION, DEFAULT_SETTINGS } from "../constants";
import type { PluginData, PluginSettings } from "../types";

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
	const out: Record<string, unknown> = {};
	for (const [key, entry] of entriesOf(value)) {
		if (known.has(key) || retired.has(key)) continue;
		// An explicit `undefined` is not a value another build is keeping — it
		// does not survive `JSON.stringify` either way, and reproducing the key
		// would only make the two files look different.
		if (entry === undefined) continue;
		out[key] = entry;
	}
	return out;
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
	const version = saved?.version;
	return typeof version === "number" && version > CURRENT_DATA_VERSION;
}
