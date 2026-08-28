/**
 * manager/iconMigrations.ts — repairing the icon fields of saved rows.
 *
 * Four passes that all answer the same question — "what does this row's icon
 * mean under the current version" — and all run once, on load, before anything
 * reads an icon. They are keyed on **content**, never on `data.version`: an
 * imported or hand-edited file can carry any version it likes, and each pass is
 * a fixed point on its own output, so running them on already-repaired data
 * changes nothing.
 *
 * Lifted out of `CalloutRegistry.load()` beside the other migration modules
 * (`savedCalloutRows.ts`, `styleModeMigration.ts`, `idCollisionMigration.ts`)
 * for the reason the ratchet asks for, and for one it does not: all four used
 * to mutate the registry **without asking for a flush**, so the repaired icons
 * lived in memory and the broken ones stayed on disk until some unrelated
 * mutation happened to trigger a save. That is exactly the failure
 * `needsSaveAfterLoad` exists to prevent, and returning "did anything change"
 * from one function is what makes it hard to forget again.
 */
import type {
	CalloutDefinition,
	IconSvgCacheEntry,
	MaterialSvgCacheEntry,
	UserImageIcon,
} from "../types";
import { resolveLucideId } from "../icons/lucideId";
import { materialPack } from "../icons/packs/material";

/** The slice of the registry these passes read and write. */
export interface IconMigrationTarget {
	callouts: Map<string, CalloutDefinition>;
	userImages: readonly UserImageIcon[];
	addIconSvg(entry: IconSvgCacheEntry): void;
}

/**
 * Run every icon repair against `target`, returning whether anything changed —
 * which the caller turns into a single write-back, so the file stops carrying
 * the broken shape.
 */
export function migrateSavedIcons(
	target: IconMigrationTarget,
	legacyMaterialCache: MaterialSvgCacheEntry[] | undefined,
): boolean {
	let changed = false;

	// Fold the pre-2.4 Material-only cache into the generic one. Keyed on the
	// field being present rather than on `data.version`. This is the only place
	// that may read `materialSvgCache`; it exists precisely to retire it, and
	// `toSaveData` never writes it back, so one flush is all it takes.
	if (legacyMaterialCache && legacyMaterialCache.length > 0) {
		for (const entry of legacyMaterialCache) {
			target.addIconSvg({
				pack: "material",
				name: entry.name,
				variant: materialPack.cacheVariant(
					{
						type: "material",
						value: entry.name,
						style: entry.style,
						weight: entry.weight,
					},
					// Material draws the same artwork at every size, so any
					// role yields the same variant.
					"regular",
				),
				svg: entry.svg,
			});
		}
		changed = true;
	}

	// Any callout that still references the removed `svg` icon type falls back
	// to a generic lucide pencil so renders don't crash. `lucide-pencil` rather
	// than `pencil` only because that is the spelling `getIconIds()` hands back
	// for it, which is what the picker will match against when the user opens it
	// on this callout.
	for (const def of target.callouts.values()) {
		const type = (def.icon?.type as string | undefined) ?? "lucide";
		if (type === "svg") {
			def.icon = { type: "lucide", value: "lucide-pencil" };
			changed = true;
		}
	}

	// v2.7.0-2.7.1 prepended `lucide-` to every bare Lucide value on the way
	// into the registry and then persisted it. That prefix tells `getIcon` to
	// look in Obsidian's core Lucide table and nowhere else, so on an id that
	// came from another plugin's `addIcon()` (`remix-*`) or from Obsidian's own
	// internal set (`dice`, `discord`, `help`) it named nothing and the callout
	// lost its icon everywhere at once. Undo it for exactly those, leaving real
	// core ids alone — see `icons/lucideId.ts`.
	//
	// Safe this early in load: the test inside `resolveLucideId` is membership
	// in the *prefixed* half of `getIconIds()`, which Obsidian has fully
	// registered before any plugin runs. An id belonging to a plugin that has
	// not loaded yet is simply absent from that half, which is the answer we
	// want anyway.
	for (const def of target.callouts.values()) {
		if (def.icon?.type !== "lucide") continue;
		const repaired = resolveLucideId(def.icon.value);
		if (repaired !== def.icon.value) {
			def.icon = { ...def.icon, value: repaired };
			changed = true;
		}
	}

	// `recolor` used to live on the picture, shared by every callout pointing at
	// it. Give each callout its own copy, taken from the picture, so nothing
	// changes appearance on the way over.
	for (const def of target.callouts.values()) {
		if (def.icon.type !== "image" || def.icon.recolor !== undefined) {
			continue;
		}
		const picture = target.userImages.find(
			(image) => image.id === def.icon.value,
		);
		def.icon = { ...def.icon, recolor: picture?.monochrome === true };
		changed = true;
	}

	return changed;
}
