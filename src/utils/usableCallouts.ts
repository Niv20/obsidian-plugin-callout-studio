/**
 * utils/usableCallouts.ts — Which callouts a user may pick right now.
 *
 * Discovery creates a row for every `[!id]` it has ever seen, so an unfiltered
 * list is full of ids the user deleted from their notes hours ago. Anything
 * that offers callouts to choose from — the autocomplete dropdown, the public
 * API, the command builder — has to drop those, and has to drop them the same
 * way, or the three surfaces disagree about what exists.
 *
 * A discovered row survives only once it has been customized (the user adopted
 * it) or while it is still written somewhere in the vault. The zero-usage check
 * is asked of the caller because only the plugin knows what Discovery's last
 * prune scan concluded.
 */
import { RESERVED_DEMO_IDS } from "../constants";
import type { CalloutDefinition, CalloutRenderRole } from "../types";

/** The registry views {@link committedDefinitions} reads. */
interface CalloutLists {
	getBuiltIn(): CalloutDefinition[];
	getUserDefined(): CalloutDefinition[];
	getThemeProvided(): CalloutDefinition[];
}

/**
 * Every callout a user could write into a note, before the unused-row filter.
 *
 * Three views rather than two: `getUserDefined()` deliberately excludes the
 * rows minted from the active theme's stylesheet, so that backups, the reset
 * sweep and `exportToJSON()` do not treat the theme's callout types as the
 * user's work. Being able to *write* those types is a different question, and
 * the answer is yes — discovering that your theme ships `[!definition]` is most
 * of the point of listing it. Both surfaces that answer "what can I type here"
 * go through this, so they cannot drift.
 */
export function committedDefinitions(
	registry: CalloutLists,
): CalloutDefinition[] {
	return [
		...registry.getBuiltIn(),
		...registry.getUserDefined(),
		...registry.getThemeProvided(),
	];
}

/**
 * Keep the rows a user could actually write today.
 *
 * `isKnownZeroUsageFallback` must report only rows a completed scan confirmed
 * are unused: a row that is genuinely in use but was never adopted through the
 * editor has to stay offerable.
 */
export function filterUsableCallouts(
	defs: readonly CalloutDefinition[],
	isKnownZeroUsageFallback: (id: string) => boolean,
): CalloutDefinition[] {
	return defs.filter(
		(def) =>
			def.source !== "fallback" ||
			def.customized === true ||
			!isKnownZeroUsageFallback(def.id),
	);
}

/** The slice of the registry {@link suggestableCallouts} consults. */
export interface SuggestionSource {
	getAll(): CalloutDefinition[];
	themeOwns(def: CalloutDefinition): boolean;
}

/**
 * What the `[!` popover may offer at the position the user is typing in.
 *
 * `filterUsableCallouts` answers "does this row still mean anything"; the role
 * narrows it further, and only away from Block. A callout the theme supplies
 * renders as a Block callout and nothing else, so offering it where a heading
 * or an inline pill is being typed would insert syntax Callout Studio then
 * leaves as literal text. See `editor/renderShared.ts`.
 *
 * Unlike Quick Insert and the public API — which reach the registry through
 * `committedDefinitions()` and so see only the three list views — this reads
 * `getAll()`, deliberately, so a row is offerable the moment it exists. The one
 * exception is `RESERVED_DEMO_IDS`: those reach `getAll()` too (that is how
 * they get styled at all), and offering the splash screen's demo callout in a
 * note would insert an id that stops existing when the modal closes.
 */
export function suggestableCallouts(
	registry: SuggestionSource,
	role: CalloutRenderRole,
	isKnownZeroUsageFallback: (id: string) => boolean,
): CalloutDefinition[] {
	const usable = filterUsableCallouts(
		registry.getAll().filter((def) => !RESERVED_DEMO_IDS.has(def.id)),
		isKnownZeroUsageFallback,
	);
	return role === "regular"
		? usable
		: usable.filter((def) => !registry.themeOwns(def));
}
