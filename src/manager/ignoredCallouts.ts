/**
 * manager/ignoredCallouts.ts — the callout ids automatic discovery must leave
 * alone.
 *
 * Discovery's whole premise is that an id written in a note and missing from
 * the settings is an oversight worth fixing. For most vaults it is. For a vault
 * that also uses a CSS-snippet callout — `[!mcc]` for a multi-column layout, a
 * theme's own helper, another plugin's marker — it is not: those ids belong to
 * something else, they will never be configured here, and a row for each one
 * arrives in the settings list every time the user opens a note that uses one.
 *
 * The reporter of issue #41 asked for exactly this, and the sentence that came
 * with the request is the reason it is worth building rather than routing
 * around: *"I accidentally deleted every instance of `>[!mcc]`, not fun."* A
 * row nobody wants is not merely clutter — it puts a delete button next to a
 * callout the plugin does not own, in a list where every other row is safe to
 * delete.
 *
 * ## Where the list is enforced
 *
 * In `manager/knownCalloutIds.ts`, alongside the reserved demo ids and for the
 * same reason. "Known" is what stops the scanner reporting an id at all, so a
 * single addition there covers every path that can mint a row — the incremental
 * per-file scan, the whole-vault scan, the settings tab's sweep of open
 * buffers, and the first-run modal, which is handed a list the scan produced.
 * A check inside `addUnknownCalloutsAsFallback` would cover the same paths and
 * do it later, after each scan had already found and reported the id.
 *
 * ## Why identities, not spellings
 *
 * Obsidian renders `[!multi column]` and `[!multi-column]` as one callout, so
 * ignoring one has to ignore the other — the same rule
 * `CalloutRegistry.findAttrIdConflict` and `DeviceLocalStore` already follow.
 * Entries are therefore stored in `calloutIdentity` form.
 *
 * ## Why it lives in `data.json`
 *
 * Unlike the discovery *index*, which is an observation this machine made and
 * belongs in `DeviceLocalStore`, this is a decision the user made about their
 * vault: the snippet defining `[!mcc]` syncs, so the reason to ignore it is
 * true on every device. It is configuration, and configuration syncs.
 */
import { calloutIdentity } from "../utils/calloutId";

/** How many ids the list may hold. */
const MAX_IGNORED = 200;

/**
 * A saved list, read back as identities with the junk removed.
 *
 * Saved data and import files are untrusted, so anything that is not a usable
 * string is dropped rather than allowed to reach a `Set`.
 */
export function sanitizeIgnoredCalloutIds(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const entry of value) {
		if (typeof entry !== "string") continue;
		const identity = calloutIdentity(entry);
		if (identity === "" || seen.has(identity)) continue;
		seen.add(identity);
		out.push(identity);
		if (out.length >= MAX_IGNORED) break;
	}
	return out;
}

/** Whether `id` — in any spelling that renders as it does — is on the list. */
export function isIgnoredCalloutId(
	ignored: readonly string[],
	id: string,
): boolean {
	const identity = calloutIdentity(id);
	return ignored.some((entry) => entry === identity);
}

/**
 * `ignored` with `id` added, or the list unchanged when it is already there.
 *
 * Returns a new array rather than mutating, so a caller that compares before
 * saving can tell whether anything happened.
 */
export function addIgnoredCalloutId(
	ignored: readonly string[],
	id: string,
): string[] {
	const identity = calloutIdentity(id);
	if (identity === "" || isIgnoredCalloutId(ignored, identity)) {
		return [...ignored];
	}
	return [...ignored, identity].slice(-MAX_IGNORED);
}

/** `ignored` without `id`, in any spelling. */
export function removeIgnoredCalloutId(
	ignored: readonly string[],
	id: string,
): string[] {
	const identity = calloutIdentity(id);
	return ignored.filter((entry) => entry !== identity);
}
