import { RESERVED_DEMO_IDS } from "../constants";
import type { CalloutDefinition, CalloutRenderRole } from "../types";
import { normalizeCalloutId } from "./calloutId";

/**
 * The theme-declared ids a callout can actually be written as.
 *
 * A stylesheet may name anything — `[data-callout="a|b"]`, `[data-callout=""]`
 * — but only a value expressible as a real Markdown callout token can become a
 * row or be matched against one. Shared by the manual scan and the theme
 * overlay so the two never disagree about which ids exist.
 */
export function usableThemeIds(ids: ReadonlySet<string>): Set<string> {
	return new Set([...ids]
		.filter((id) => !/[[\]|\\\r\n\0]/.test(id))
		.map(normalizeCalloutId).filter(Boolean));
}

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
