/**
 * utils/sorting.ts — Locale-aware sorting helpers for callout lists.
 *
 * Exports comparators and sort functions (sortCalloutsByDisplayName,
 * sortCalloutsById, getSortedCalloutIds) that use Intl.Collator with a
 * locale chain fallback. Used by CalloutRegistry (initial sort on load),
 * CalloutListsSection (display order), and AutoComplete (suggestion order).
 */
import type { CalloutDefinition } from "../types";

const FALLBACK_LOCALE = "en";

/**
 * Will `Intl` accept this tag at all?
 *
 * It rejects anything not structurally BCP-47 — `"!!"`, `"e n"` — by throwing,
 * and it validates the whole list it is given, so one bad tag takes the valid
 * ones down with it. In a *comparator* that is not a misordered list, it is an
 * exception thrown out of `Array.sort` while the settings tab or the
 * autocomplete dropdown is being built.
 *
 * Nothing malformed reaches here today: every call site passes `getLocale()`,
 * which can only return a code the plugin itself registered. This is what keeps
 * that a precondition of the *caller* rather than a trap — the next call site to
 * pass free text gets English, not a broken list.
 */
const isWellFormed = (tag: string): boolean => {
	try {
		Intl.getCanonicalLocales(tag);
		return true;
	} catch {
		return false;
	}
};

const buildLocaleChain = (locale?: string): string[] => {
	const trimmed = typeof locale === "string" ? locale.trim() : "";
	if (!trimmed) return [FALLBACK_LOCALE];

	const base = trimmed.split("-")[0] ?? "";
	const chain = [trimmed, base, FALLBACK_LOCALE].filter(Boolean);
	// Dropped one by one rather than all together, so a malformed *region*
	// still sorts in its own language: `de-!!` keeps `de`.
	return Array.from(new Set(chain)).filter(isWellFormed);
};

const createBaseCollator = (locale?: string): Intl.Collator =>
	new Intl.Collator(buildLocaleChain(locale), {
		numeric: true,
		sensitivity: "base",
		usage: "sort",
	});

const createTieBreakerCollator = (locale?: string): Intl.Collator =>
	new Intl.Collator(buildLocaleChain(locale), {
		numeric: true,
		sensitivity: "variant",
		usage: "sort",
	});

/**
 * `compareText` with its collators built once, for a sort that compares many
 * times — a list rebuilt on every keystroke, say.
 */
export const textComparator = (locale?: string): ((a: string, b: string) => number) => {
	const base = createBaseCollator(locale);
	const tieBreaker = createTieBreakerCollator(locale);
	return (a, b) => base.compare(a, b) || tieBreaker.compare(a, b);
};

export const compareText = (a: string, b: string, locale?: string): number =>
	textComparator(locale)(a, b);

export const sortCalloutsByDisplayName = (
	callouts: CalloutDefinition[],
	locale?: string,
): CalloutDefinition[] => {
	return [...callouts].sort((a, b) => {
		const byName = compareText(a.displayName, b.displayName, locale);
		if (byName !== 0) return byName;
		return compareText(a.id, b.id, locale);
	});
};

export const sortCalloutsById = (
	callouts: CalloutDefinition[],
	locale?: string,
): CalloutDefinition[] => {
	return [...callouts].sort((a, b) => {
		const byId = compareText(a.id, b.id, locale);
		if (byId !== 0) return byId;
		return compareText(a.displayName, b.displayName, locale);
	});
};

export const sortIds = (ids: string[], locale?: string): string[] =>
	[...ids].sort((a, b) => compareText(a, b, locale));

export const getSortedCalloutIds = (
	def: CalloutDefinition,
	locale?: string,
): string[] => sortIds([def.id, ...(def.aliases ?? [])], locale);
