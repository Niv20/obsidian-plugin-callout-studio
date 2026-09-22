/**
 * utils/calloutSearch.ts — matching and filtering a list of callouts by hand.
 *
 * Two surfaces let the user narrow a callout list by typing: the `[!` popover
 * in the editor and the quick-insert window. They must agree about what "warn
 * matches" means, so the predicate lives here rather than inline in either —
 * the same reason {@link filterUsableCallouts} lives next door.
 *
 * Deliberately free of `obsidian` imports, so it can be tested without a DOM.
 *
 * The match is plain case-insensitive substring across the three things a user
 * could plausibly type — display name, id, any alias — and nothing more. Not
 * fuzzy: a callout list is a dozen or two rows, where a fuzzy match mostly
 * manufactures wrong answers.
 *
 * It *is* ranked, in four tiers (see {@link matchRank}), and that is a change
 * from how this started. Pure alphabetical order is fine for an empty query and
 * wrong the moment there is one: typing `no` put `Annotation` above `Note`,
 * because A sorts before N. The tiers are exactness and then prefix, which is
 * the whole of it — no scoring, no distance, nothing that can surprise. Within
 * a tier the order is still alphabetical, so it stays predictable.
 */
import type { CalloutDefinition } from "../types";
import { sortCalloutsByDisplayName } from "./sorting";

/**
 * Does `def` match `lowerQuery`?
 *
 * **The query must already be lowercased** — normalising it here would mean
 * re-lowercasing the same string once per row on every keystroke. Whether to
 * trim it is the caller's call too, and the two callers genuinely differ: the
 * autocomplete's query is text between `[!` and the cursor, where a space is a
 * real character the user typed into the document, while a search box's leading
 * spaces are an accident. An empty query matches everything.
 */
export function calloutMatchesQuery(
	def: CalloutDefinition,
	lowerQuery: string,
): boolean {
	return (
		def.id.toLowerCase().includes(lowerQuery) ||
		def.displayName.toLowerCase().includes(lowerQuery) ||
		(def.aliases ?? []).some((a) => a.toLowerCase().includes(lowerQuery))
	);
}

/** The four states of the quick-insert window's source filter. */
export const CALLOUT_SOURCE_FILTERS = [
	"all",
	"builtin",
	"theme",
	"user",
] as const;

export type CalloutSourceFilter = (typeof CALLOUT_SOURCE_FILTERS)[number];

/**
 * Is this a filter the plugin still understands?
 *
	 * Besides validating the live dropdown, this sanitizes the remembered
	 * `quickInsertSource` setting. Anything else falls back to `"all"` rather than
	 * opening the window on a category this build cannot explain.
 */
export function isCalloutSourceFilter(
	value: unknown,
): value is CalloutSourceFilter {
	return (
		typeof value === "string" &&
		(CALLOUT_SOURCE_FILTERS as readonly string[]).includes(value)
	);
}

/**
 * Partition by who paints the callout **now**, then by whether Obsidian ships
 * it. Theme ownership has to win: a theme can restyle a built-in or temporarily
 * take over a saved user/discovery row without changing either one's stored
 * identity. `source` alone is provenance and cannot answer that question.
 *
 * The fallback recognizes a minted `source: "theme"` row for pure callers that
 * have no registry. Quick Insert always supplies `registry.themeOwns`, which is
 * what also catches theme-restyled built-ins and pre-existing user rows.
 */
export function matchesSourceFilter(
	def: CalloutDefinition,
	filter: CalloutSourceFilter,
	themeOwns: (def: CalloutDefinition) => boolean = (candidate) =>
		candidate.source === "theme",
): boolean {
	if (filter === "all") return true;
	const fromTheme = themeOwns(def);
	if (filter === "theme") return fromTheme;
	if (filter === "builtin") return !fromTheme && def.builtIn;
	return !fromTheme && !def.builtIn;
}

export interface CalloutListOptions {
	/** Raw text from the search box; trimmed and lowercased here. */
	query: string;
	filter: CalloutSourceFilter;
	/** Live ownership of a row by the active theme. Required for a full split. */
	themeOwns?: (def: CalloutDefinition) => boolean;
	locale?: string;
}

/**
 * How well `def` answers `lowerQuery` — lower is better, and 3 is "it matched
 * somewhere". **The query must already be lowercased and non-empty.**
 *
 * Four tiers and no more, because every extra rule is a way for the list to
 * reorder itself for a reason the user cannot see:
 *
 * 0. the query *is* the name, the id, or an alias — you typed the whole thing
 * 1. the name starts with it — `no` → `Note`
 * 2. an id or alias starts with it — `sum` → `Abstract`, via `summary`
 * 3. it appears somewhere — `arn` → `Warning`
 */
export function matchRank(def: CalloutDefinition, lowerQuery: string): number {
	const name = def.displayName.toLowerCase();
	const ids = [def.id.toLowerCase(), ...(def.aliases ?? []).map((a) => a.toLowerCase())];
	if (name === lowerQuery || ids.includes(lowerQuery)) return 0;
	if (name.startsWith(lowerQuery)) return 1;
	if (ids.some((id) => id.startsWith(lowerQuery))) return 2;
	return 3;
}

/**
 * Source filter, then text match, then order: by rank when there is a query, by
 * name alone when there is not.
 *
 * Sorting last and once is what keeps built-ins and the user's own callouts
 * *mixed* rather than grouped: they are only ever two halves of one list, and
 * the filter picks which rows are in it, never how they are ordered.
 */
export function filterCalloutList(
	defs: readonly CalloutDefinition[],
	options: CalloutListOptions,
): CalloutDefinition[] {
	const query = options.query.trim().toLowerCase();
	const matched = defs.filter(
		(def) =>
			matchesSourceFilter(def, options.filter, options.themeOwns) &&
			(query === "" || calloutMatchesQuery(def, query)),
	);
	const byName = sortCalloutsByDisplayName(matched, options.locale);
	if (query === "") return byName;
	// A stable sort over the already-alphabetical list, so each tier keeps that
	// order inside itself and only the tiers move.
	return byName.sort((a, b) => matchRank(a, query) - matchRank(b, query));
}
