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
import { RESERVED_DEMO_IDS } from "../constants";
import type { CalloutDefinition, PluginSettings } from "../types";

/** All this needs of a registry, so a caller can pass anything that lists rows. */
export interface KnownIdSource {
	getAll(): CalloutDefinition[];
	/** Only `ignoredCalloutIds` is read. @see manager/ignoredCallouts.ts */
	settings: Pick<PluginSettings, "ignoredCalloutIds">;
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
	// The preview-only ids, always — not merely while a modal happens to hold
	// one in the registry's preview slot. "Known" is what stops discovery from
	// minting a row, and a note that writes `[!global-style-demo]` (pasted from
	// a screenshot, say) must never become a callout the user then has to
	// delete. Listing them here is also the cheaper half of the deal: the
	// scanner asks this set, so nothing downstream needs its own exception.
	for (const id of RESERVED_DEMO_IDS) addBothForms(id);
	// The ids the user has told discovery to leave alone — a snippet's callout,
	// a theme's helper, another plugin's marker. Here rather than in a check
	// further down for the same reason as the line above: "known" is what stops
	// the scanner reporting an id at all, so one addition covers the
	// incremental scan, the whole-vault scan, the open-buffer sweep and the
	// first-run modal alike. See manager/ignoredCallouts.ts.
	for (const id of registry.settings.ignoredCalloutIds) addBothForms(id);
	return known;
}
