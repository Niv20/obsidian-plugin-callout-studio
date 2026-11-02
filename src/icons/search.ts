/**
 * icons/search.ts — The shared icon search.
 *
 * One matcher for every source, so "arrow right" behaves the same whether the
 * pack spells its ids `arrow_right` (Material) or `arrow-right` (Octicons,
 * Font Awesome). Words are ANDed, which is what makes progressive typing
 * narrow the grid instead of scattering it.
 *
 * Matching decides *which* icons come back; ranking decides the order they come
 * back in, and the second half is not optional. Typing `home` into a library
 * that also holds `home-storage`, `smart-home` and forty others has to put
 * `home` itself first — in the index's own alphabetical order an exact hit
 * lands wherever the alphabet left it, which for Material is most of a page
 * down. Four tiers, in the order anyone reading them aloud would expect: the
 * name *is* the query, the name *starts with* it, the name *contains* it, and
 * last the entries that only answered through a label or a keyword.
 *
 * Ranking happens *within* one source, never across them. The pooled "All
 * sources" list heads each run of entries from one library with that library's
 * name, and `PackPanel.groupLabelFor` finds those headings by watching for the
 * source to change from one entry to the next — so a single global sort would
 * shatter six headings into hundreds. Ordering inside each run leaves the
 * grouping exactly as it was and still floats each library's best hit to the
 * top of its own section.
 */
import type { IconEntry, IconIndex } from "./types";

/** Split a query into the words that must all match. */
function queryWords(query: string): string[] {
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 0);
}

/** How well a name answered the query. Lower sorts first. */
const RANK_EXACT = 0;
const RANK_PREFIX = 1;
const RANK_SUBSTRING = 2;
/** Matched only through a label or a keyword — related, but not named. */
const RANK_RELATED = 3;

/**
 * The two spellings of a name that are matched against: verbatim, and with its
 * separators turned into spaces. Neither library's own idiom is the one the
 * user has to know.
 */
function nameForms(entry: IconEntry): [string, string] {
	const name = entry.name.toLowerCase();
	return [name, name.replace(/[_-]/g, " ")];
}

/**
 * The searchable text of one icon: its name in both spellings, its label, and
 * its keywords.
 */
function haystack(entry: IconEntry): string[] {
	const parts: string[] = nameForms(entry);
	if (entry.label) parts.push(entry.label.toLowerCase());
	for (const keyword of entry.keywords) parts.push(keyword.toLowerCase());
	return parts;
}

/**
 * Rank one match by its name alone.
 *
 * `phrase` is the query's words rejoined with single spaces, so a two-word
 * query can still be an *exact* hit: "arrow right" is the whole of
 * `arrow_right`, not two separate word matches that happen to land on it.
 */
function rankOf(entry: IconEntry, phrase: string): number {
	const forms = nameForms(entry);
	if (forms.some((form) => form === phrase)) return RANK_EXACT;
	if (forms.some((form) => form.startsWith(phrase))) return RANK_PREFIX;
	if (forms.some((form) => form.includes(phrase))) return RANK_SUBSTRING;
	return RANK_RELATED;
}

/**
 * Filter an index by free text and, optionally, a category, best match first.
 *
 * Returns the index's own entry array untouched when nothing is being filtered,
 * so opening a source does no work at all beyond decoding it.
 */
export function filterIcons(index: IconIndex, query: string, category = ""): readonly IconEntry[] {
	const words = queryWords(query);
	if (words.length === 0 && !category) return index.entries;

	const matched = index.entries.filter((entry) => {
		if (category && !entry.categories.includes(category)) return false;
		if (words.length === 0) return true;
		const fields = haystack(entry);
		return words.every((word) => fields.some((f) => f.includes(word)));
	});
	// A category on its own is not something an entry can match more or less
	// well, so the library keeps its own order.
	if (words.length === 0) return matched;

	const phrase = words.join(" ");
	// `group` is the source's first-appearance ordinal. It is 0 for every entry
	// of an ordinary single-library index — only the pooled list sets `pack` —
	// so outside "All sources" the group key drops out of the comparison and
	// this is a plain relevance sort.
	const groups = new Map<string, number>();
	const ranked = matched.map((entry, at) => {
		const source = entry.pack ?? "";
		let group = groups.get(source);
		if (group === undefined) {
			group = groups.size;
			groups.set(source, group);
		}
		return { entry, group, rank: rankOf(entry, phrase), at };
	});
	// `at` last, so equally good matches stay in the index's own order rather
	// than in whatever order the engine's sort happens to leave them.
	ranked.sort((a, b) => a.group - b.group || a.rank - b.rank || a.at - b.at);
	return ranked.map((r) => r.entry);
}
