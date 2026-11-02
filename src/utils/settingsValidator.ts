/**
 * utils/settingsValidator.ts — Sanitizes plugin settings from a v2 import.
 *
 * Never trusts imported settings: the raw value is passed through the same
 * field-by-field merge the registry uses on load (mergeSavedSettings), so
 * unknown fields are dropped and missing fields fall back to defaults.
 * Structural problems become warnings — a bad settings blob must not block
 * the callouts in the same file from importing.
 */
import type { PluginSettings } from "../types";
import { mergeSavedSettings } from "./settingsMerge";
import type { ValidationIssue } from "./importValidator";

export interface SettingsValidationResult {
	/** Fully-formed settings ready to apply, or null when none were present. */
	settings: PluginSettings | null;
	issues: ValidationIssue[];
}

export function sanitizeImportedSettings(raw: unknown): SettingsValidationResult {
	if (raw === undefined || raw === null) {
		return { settings: null, issues: [] };
	}
	if (typeof raw !== "object" || Array.isArray(raw)) {
		return {
			settings: null,
			issues: [
				{
					index: -1,
					entryLabel: "",
					level: "warning",
					messageKey: "import.warn.settingsIgnored",
				},
			],
		};
	}

	// mergeSavedSettings is defensive: it type-checks each field against
	// DEFAULT_SETTINGS and tolerates arbitrary junk, so passing the raw
	// object straight through is safe.
	return {
		settings: mergeSavedSettings(raw),
		issues: [],
	};
}
