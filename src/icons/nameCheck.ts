/**
 * icons/nameCheck.ts — Does this icon name actually name a drawing?
 *
 * Only imports need this. Everywhere else a `CalloutIcon` was produced by the
 * picker and so is real by construction; an imported one is whatever was in the
 * file, and a name nothing answers to renders as an empty square with no
 * explanation of why. Both importers check through here so the one subtle part —
 * Lucide's two spellings, below — is written once.
 *
 * The check is a *name* check and nothing more. Whether the artwork has been
 * downloaded yet is a different question with a different answer (it arrives
 * later and the renderer repaints), and packs whose value is not a name at all
 * are skipped rather than guessed at.
 */
import { getIconIds } from "obsidian";
import type { CalloutIcon, IconPackId } from "../types";
import { packFor } from "./registry";
import { bareLucideName } from "./lucideId";

/**
 * Packs whose `value` is not a name in an index, and so cannot be checked here.
 *
 * `emoji` stores the glyph itself (with skin-tone variants that are separate
 * values); `image` stores a `UserImageIcon.id`, which the JSON importer already
 * reports on separately when the picture did not travel with the file.
 */
const UNCHECKABLE: ReadonlySet<IconPackId> = new Set<IconPackId>(["emoji", "image"]);

/**
 * A membership test over Obsidian's icon set, built once for a whole batch.
 *
 * Read fresh on every call rather than memoized, for the reason `lucide.ts`
 * gives: other plugins register their own ids at runtime, so the set is not
 * fixed for the lifetime of the app.
 *
 * Both sides go through `bareLucideName` because Lucide names exist in two
 * legitimate spellings — `constants.ts` and the Callout Manager importer store
 * the bare name ("pencil"), the picker stores whatever `getIconIds()` returned
 * — and a test that did not normalize would declare one half of the vault's
 * icons imaginary. `lucideId.ts` has the rest of that story, including why the
 * prefix must never be *added* to reconcile the two.
 */
export function createLucideNameCheck(): (value: string) => boolean {
	const known = new Set(getIconIds().map(bareLucideName));
	return (value) => known.has(bareLucideName(value.trim()));
}

/**
 * A membership test covering every pack the given icons name.
 *
 * Async because each pack's search index is decoded on demand — bundled, so
 * this works offline, which matters: an import must not depend on the network.
 * Returns true for anything it cannot check, so the caller only ever acts on a
 * definite "no such name".
 */
export async function createIconNameCheck(icons: readonly CalloutIcon[]): Promise<(icon: CalloutIcon) => boolean> {
	const wanted = new Set<IconPackId>();
	for (const icon of icons) {
		if (!UNCHECKABLE.has(icon.type)) wanted.add(icon.type);
	}

	const namesByType = new Map<IconPackId, ReadonlySet<string>>();
	await Promise.all(
		[...wanted].map(async (type) => {
			// Keyed by icon type, not by source: Font Awesome's three styles and
			// Tabler's two share one source and therefore one index, so the test
			// is a superset for those. That is deliberate — this catches names
			// that exist nowhere, not names that exist in the other style.
			const pack = packFor({ type, value: "" });
			if (!pack) return;
			try {
				const index = await pack.loadIndex();
				// Both sides normalized for Lucide, so the comparison holds
				// whichever spelling `getIconIds()` happens to hand back.
				const normalize = type === "lucide" ? bareLucideName : (name: string) => name;
				namesByType.set(type, new Set(index.entries.map((entry) => normalize(entry.name))));
			} catch {
				// An index that will not decode is our problem, not the file's.
				// Leaving the pack unmapped means "cannot check", not "invalid".
			}
		}),
	);

	return (icon: CalloutIcon): boolean => {
		const names = namesByType.get(icon.type);
		if (!names) return true;
		const value = icon.value.trim();
		return names.has(icon.type === "lucide" ? bareLucideName(value) : value);
	};
}
