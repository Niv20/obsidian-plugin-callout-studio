import type { PluginData } from "../types";

/** Affected raw-load evidence keyed by the registry that adopted it. */
const affected = new WeakSet<object>();

/**
 * Record whether this load retired a real autocomplete opt-out. The persisted
 * setting's current type is the literal `true`, so the legacy shape stays
 * deliberately narrow and unknown here rather than weakening the live model.
 */
export function recordAutocompleteEnablement(
	owner: object,
	data: Partial<PluginData> | null,
): boolean {
	const legacy = (
		data?.settings as unknown as
			| { autocomplete?: { enabled?: unknown } }
			| undefined
	)?.autocomplete;
	const wasDisabled = legacy?.enabled === false;
	if (wasDisabled) affected.add(owner);
	else affected.delete(owner);
	return wasDisabled;
}

export function hasAutocompleteEnablement(owner: object): boolean {
	return affected.has(owner);
}

export function acknowledgeAutocompleteEnablement(owner: object): void {
	affected.delete(owner);
}
