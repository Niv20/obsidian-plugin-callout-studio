/**
 * manager/knownCalloutIds.ts — "what do we already have?", answered once.
 *
 * Every scan for unrecognized callout ids — the incremental per-file pass, the
 * whole-vault scan, the settings tab's sweep of open editor buffers — needs the
 * same set, and the settings tab used to build its own: bare
 * `def.id.toLowerCase()`, with neither the whitespace collapsing nor the
 * `data-callout` form. Two answers to one question is one more than can stay
 * correct, so there is one here and the callers import it.
 *
 * A free function rather than a method on `CalloutDiscovery` precisely so the
 * settings tab can ask without a forwarder threaded through the plugin.
 */
import { calloutIdentity, normalizeCalloutId } from "../utils/calloutId";
import type { CalloutDefinition } from "../types";

/** All this needs of a registry, so a caller can pass anything that lists rows. */
export interface KnownIdSource {
	getAll(): CalloutDefinition[];
}

/**
 * Every callout id and alias the registry knows, under both the spelling it is
 * stored with and its canonical identity.
 *
 * Both forms, because a note may write either: `[!a-b]` must not read as unknown
 * while `a b` is defined, since Obsidian renders the two identically and a
 * second row could only fight the first over a single CSS rule.
 *
 * The other direction is the scanner's half of the deal —
 * `scanStringForUnknownCallouts` tests a found id's identity against this set as
 * well as its literal spelling, so a stored `banner-icon` recognises a
 * hand-written `[!banner icon]` too. Both halves are needed: a set cannot
 * enumerate the spellings a note might use.
 */
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
	return known;
}
