import { calloutIdentity, normalizeCalloutId } from "../utils/calloutId";
import { RESERVED_DEMO_IDS } from "../constants";
import type { CalloutDefinition } from "../types";

export interface KnownIdSource {
	getAll(): CalloutDefinition[];
}

export function buildKnownCalloutIds(registry: KnownIdSource): Set<string> {
	const known = new Set<string>();
	const addBothForms = (id: string): void => {
		known.add(normalizeCalloutId(id));
		known.add(calloutIdentity(id));
	};
	for (const def of registry.getAll()) {
		addBothForms(def.id);
		for (const a of def.aliases ?? []) addBothForms(a);
	}

	for (const id of RESERVED_DEMO_IDS) addBothForms(id);
	return known;
}
