/**
 * manager/iconSvgCacheOrder.ts — the order `iconSvgCache` is written in.
 *
 * The cache is a plain array that `CalloutRegistry.addIconSvg` appends to, so
 * its order is the order this device happened to fetch artwork in. That is fine
 * in memory — nothing reads it positionally — and was quietly corrosive on disk.
 *
 * `data.json` is a synced file, and `SaveGuard` decides whether to rewrite it by
 * comparing serialized bytes. Two devices holding the *same* artwork, fetched in
 * a different order, serialize to different bytes; each then sees the other's
 * file as a genuine change and writes its own back. No amount of write
 * suppression can help, because the difference is real — it just does not mean
 * anything. It was the last thing keeping issue #41's conflict copies coming
 * after the reload loop itself was closed.
 *
 * Sorting on the way out makes the file a function of the *set* rather than of
 * the arrival order, so the two devices converge and stay converged.
 */
import type { IconSvgCacheEntry } from "../types";

/**
 * Code-unit comparison, deliberately **not** `localeCompare`.
 *
 * `localeCompare` is locale-dependent, and the whole point here is that two
 * devices produce identical bytes — a phone set to Turkish and a desktop set to
 * English must not disagree about where an entry goes, or this reintroduces
 * exactly the divergence it exists to remove.
 */
function compare(a: string, b: string): number {
	if (a < b) return -1;
	return a > b ? 1 : 0;
}

/**
 * The cache as `data.json` should hold it: sorted, or absent when empty.
 *
 * `(pack, name, variant)` is the same triple `addIconSvg` dedupes on, so no two
 * entries can tie and the order is total — the same set always yields the same
 * bytes, on every device.
 *
 * Returns `undefined` rather than `[]` so an empty cache stays out of the file
 * entirely, which is what it did before this function existed.
 */
export function persistedIconSvgCache(
	entries: readonly IconSvgCacheEntry[],
): IconSvgCacheEntry[] | undefined {
	if (entries.length === 0) return undefined;
	return [...entries].sort(
		(a, b) =>
			compare(a.pack, b.pack) ||
			compare(a.name, b.name) ||
			compare(a.variant, b.variant),
	);
}
