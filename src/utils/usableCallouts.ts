import { RESERVED_DEMO_IDS } from "../constants";
import type { CalloutDefinition, CalloutRenderRole } from "../types";

interface CalloutLists {
	getBuiltIn(): CalloutDefinition[];
	getUserDefined(): CalloutDefinition[];
	getThemeProvided(): CalloutDefinition[];
}

export function committedDefinitions(
	registry: CalloutLists,
): CalloutDefinition[] {
	return [
		...registry.getBuiltIn(),
		...registry.getUserDefined(),
		...registry.getThemeProvided(),
	];
}

export interface SuggestionSource {
	getAll(): CalloutDefinition[];
	themeOwns(def: CalloutDefinition): boolean;
}

export function suggestableCallouts(
	registry: SuggestionSource,
	role: CalloutRenderRole,
): CalloutDefinition[] {
	const usable = registry.getAll().filter((def) => !RESERVED_DEMO_IDS.has(def.id));
	return role === "regular"
		? usable
		: usable.filter((def) => !registry.themeOwns(def));
}
