/**
 * utils/stableJson.ts — comparing two settings files by what they *say*.
 *
 * `SaveGuard` decides whether to rewrite `data.json` by comparing serialized
 * bytes, and bytes carry one thing that has no meaning: the order the keys
 * happen to be in. `manager/iconSvgCacheOrder.ts` already fixed one instance of
 * that — two devices holding identical artwork fetched in a different order
 * serialized differently, so each saw the other's file as a real change and
 * wrote its own back, forever.
 *
 * The general case is **version skew**, and it is the one that never settles on
 * its own. `mergeSavedSettings` names every field it understands and drops
 * everything else, so a device on an older build strips a setting a newer build
 * added and writes the file back without it; the newer device puts it back.
 * Neither is wrong and neither stops. `settingsMerge.collectUnknownSettings`
 * closes half of that by carrying an unrecognised field through untouched — but
 * a carried field is re-emitted in a *different position* from where the build
 * that owns it emits it, so byte comparison still calls the two files
 * different. Ordering the keys is what makes the two agree.
 *
 * Used only where a file is normalized **for comparison** — `SaveGuard.prepare`
 * and `manager/settingsFile.ts`'s `json`. Deliberately not applied to what is
 * written: sorting the file itself would make every device rewrite its
 * `data.json` on the first launch after this shipped, which is a sync event for
 * every user to pay for a difference none of them can see.
 */

/**
 * Code-unit comparison, deliberately **not** `localeCompare`.
 *
 * The whole point is that two devices agree, and `localeCompare` is
 * locale-dependent — a phone set to Turkish and a desktop set to English must
 * not disagree about where a key goes. @see manager/iconSvgCacheOrder.ts
 */
function compareKeys(a: string, b: string): number {
	if (a < b) return -1;
	return a > b ? 1 : 0;
}

/**
 * `value` with every plain object's keys in sorted order, deeply.
 *
 * Arrays keep their order — it is meaningful everywhere it appears here (the
 * callout list, the menu items the user arranged) — but the objects *inside*
 * them are ordered too, so a row written by a build that names its fields in a
 * different order still compares equal.
 *
 * Anything that is not a plain object or an array is returned as it is, which
 * covers every JSON scalar and leaves `undefined` where it was: `JSON.stringify`
 * drops those keys either way, so reproducing them changes nothing.
 */
export function stableKeyOrder<T>(value: T): T {
	return order(value) as T;
}

/**
 * The recursion, over `unknown` rather than over the public generic.
 *
 * `Array.isArray` narrows a generic parameter to `any[]`, and mapping that
 * hands back `any` — which is the one thing this codebase does not allow. One
 * cast at the boundary above is honest about where the type is being asserted;
 * a cast per branch in here would not be.
 */
function order(value: unknown): unknown {
	if (Array.isArray(value)) {
		return (value as unknown[]).map(order);
	}
	if (value === null || typeof value !== "object") return value;
	const source = value as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const key of Object.keys(source).sort(compareKeys)) {
		out[key] = order(source[key]);
	}
	return out;
}
