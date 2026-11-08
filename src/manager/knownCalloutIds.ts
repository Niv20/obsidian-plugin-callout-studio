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
		// A theme overlay row is not a definition: it lives only while the
		// theme declaring it is active. A note that uses a theme's type is how
		// a scan saves it, so counting the overlay row as known would make Scan
		// skip every theme type the notes actually use.
		if (def.source === "theme") continue;
		addBothForms(def.id);
		for (const a of def.aliases ?? []) addBothForms(a);
	}

	for (const id of RESERVED_DEMO_IDS) addBothForms(id);
	return known;
}
