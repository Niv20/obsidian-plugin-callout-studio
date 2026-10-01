/**
 * utils/mergePalettes.ts — folding an imported palette list into the vault's.
 *
 * Palettes are the one list `mergeById` is not enough for. The editor refuses a
 * second palette under a name that is taken, and the name it suggests for any
 * blue is "Blue 2" (the preset owns "Blue"), so two vaults that each made a blue
 * palette end up with a "Blue 2" apiece, under different ids. Merging by id kept
 * both, and the tidy-up that follows an import compares *colours*, so two
 * palettes with one name and two looks stayed on as twins that no dropdown could
 * tell apart.
 *
 * A name is how a person tells palettes apart, so an import treats it as the
 * palette's identity. An incoming palette replaces the vault's palette of the
 * same name (case and surrounding spaces ignored, as the editor does), and the
 * vault's palette keeps its own id: every callout already linked to it stays
 * linked, and it keeps its place in the list. Only the file's callouts need
 * re-pointing, which {@link applyPaletteMerge} does.
 */
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { CustomPalette } from "../types";
import { normalizeName } from "./colorNames";
import {
	bakePaletteColors,
	customPaletteToColorPalette,
	palettesVisuallyEqual,
} from "./colorPalettes";

export interface PaletteMerge {
	/** The vault's palettes with the file's folded in; a fresh array. */
	palettes: CustomPalette[];
	/**
	 * File palette id → the vault palette that took its place. Only a palette
	 * that was matched by *name* appears here: one that arrived under its own id,
	 * new or already known, is still reachable by the id its callouts carry.
	 */
	remap: Map<string, string>;
	/** Ids (in `palettes`) of palettes whose colours the file changed. */
	restyled: string[];
}

/**
 * `existing` with `incoming` folded in. For each incoming palette:
 *
 * - **Same id, or the same name, as palettes the vault already had:** each of
 *   those is replaced in place by the incoming version, under its own id. More
 *   than one can match — a vault an earlier version left holding two palettes
 *   under one name — and all of them take the file's version, which makes them
 *   identical, so the consolidation that follows an import folds them into one.
 * - **Neither:** it is appended, in file order.
 *
 * A palette the file has itself written is never matched by *name* again, so a
 * file carrying two palettes under one name (exported from such a vault) brings
 * both across instead of letting the second eat the first. Re-importing the same
 * file rewrites its palettes in place and changes nothing else.
 *
 * Neither argument is touched.
 */
export function mergePalettes(
	existing: readonly CustomPalette[],
	incoming: readonly CustomPalette[],
): PaletteMerge {
	const before = new Map(existing.map((p) => [p.id, p]));
	const byId = new Map(before);
	const written = new Set<string>();
	const remap = new Map<string, string>();

	for (const next of incoming) {
		const name = normalizeName(next.name);
		const targets = [...byId.values()].filter(
			(p) =>
				p.id === next.id ||
				(name !== "" && !written.has(p.id) && normalizeName(p.name) === name),
		);
		if (targets.length === 0) {
			byId.set(next.id, next);
			written.add(next.id);
			continue;
		}
		for (const target of targets) {
			byId.set(target.id, target.id === next.id ? next : { ...next, id: target.id });
			written.add(target.id);
		}
		if (!targets.some((p) => p.id === next.id)) remap.set(next.id, targets[0]!.id);
	}

	const restyled: string[] = [];
	for (const [id, after] of byId) {
		const was = before.get(id);
		if (
			was &&
			was !== after &&
			!palettesVisuallyEqual(customPaletteToColorPalette(was), customPaletteToColorPalette(after))
		) {
			restyled.push(id);
		}
	}
	return { palettes: [...byId.values()], remap, restyled };
}

/**
 * Makes `merge` the vault's palette list and settles the callouts around it.
 *
 * The file's callouts that named a palette now answered by a vault one are
 * re-pointed first, and then every callout linked to a palette whose colours
 * changed is repainted — through the same call as editing the palette, so
 * "Blue 2" reads as one look everywhere rather than as the vault's callouts on
 * the old colours and the file's on the new.
 */
export function applyPaletteMerge(registry: CalloutRegistry, merge: PaletteMerge): void {
	registry.settings.customPalettes = merge.palettes;
	for (const [fromId, toId] of merge.remap) registry.relinkPalette(fromId, toId);
	for (const id of merge.restyled) {
		const palette = merge.palettes.find((p) => p.id === id);
		if (palette) registry.applyPaletteColors(id, bakePaletteColors(customPaletteToColorPalette(palette)));
	}
}
