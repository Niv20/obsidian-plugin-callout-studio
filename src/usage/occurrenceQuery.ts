import type { CalloutRenderRole } from "../types";
import { calloutIdentity } from "../utils/calloutId";
import type { CalloutOccurrence, CalloutOccurrenceQuery } from "./occurrenceTypes";

/** Alias sets are unions: neither spelling variants nor shared files count twice. */
export function queryOccurrences(
	byIdentity: ReadonlyMap<string, readonly CalloutOccurrence[]>,
	ids?: readonly string[],
	role?: CalloutRenderRole,
): CalloutOccurrenceQuery {
	const keys = ids === undefined ? byIdentity.keys() : new Set(ids.map(calloutIdentity));
	const occurrences: CalloutOccurrence[] = [];
	const files = new Set<string>();
	const roles = { regular: 0, heading: 0, inline: 0 };
	for (const key of keys) {
		for (const occurrence of byIdentity.get(key) ?? []) {
			if (role && occurrence.role !== role) continue;
			occurrences.push(occurrence);
			files.add(occurrence.path);
			roles[occurrence.role]++;
		}
	}
	occurrences.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.from - b.from);
	return { occurrences, totalCount: occurrences.length, fileCount: files.size, roles };
}
