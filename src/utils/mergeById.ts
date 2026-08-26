/**
 * utils/mergeById.ts — folding an imported list into the one the vault holds.
 *
 * `customPalettes`, `userImages` and `customCommands` live in `PluginSettings`
 * precisely so `exportToJSONv2()` carries them, and all three come back out of
 * `sanitizeImportedSettings` as whatever the file said — **empty arrays when
 * the file said nothing**. The validator is right to do that: it reads a file
 * and has no idea what the vault already holds. Deciding that is the importer's
 * job, and there is one right answer — merge by id. Assigning the sanitized
 * settings wholesale would hand a user's own palettes, pictures and commands to
 * a file that never mentioned them, which is the failure
 * internals-docs/14-import-export.md warns about for every new list.
 *
 * Lifted out of `DataManagementSection.applyImport`, which needs a live
 * registry, a live plugin and a modal before a single line of it runs, so the
 * rule could be a test rather than a comment.
 */

/** One entry of a list the user builds up, keyed by an id it carries itself. */
interface Identified {
	id: string;
}

/**
 * `existing` with `incoming` folded in: a repeated id overwrites in place, a new
 * id is appended, and an empty `incoming` changes nothing at all.
 *
 * "In place" is the part worth stating. `Map.set` on a key it already holds
 * leaves that key where it was, so re-importing a file the user has imported
 * before rewrites those entries without reshuffling the list around them.
 *
 * Neither argument is touched; the result is a fresh array.
 */
export function mergeById<T extends Identified>(
	existing: readonly T[],
	incoming: readonly T[],
): T[] {
	const byId = new Map(existing.map((entry) => [entry.id, entry]));
	for (const entry of incoming) byId.set(entry.id, entry);
	return [...byId.values()];
}
