/**
 * settings/paletteEntryResolution.ts — which palette a callout's colour reads
 * as in the editor's Color row, and which id it keeps.
 *
 * Pure, and outside `CalloutEditor.ts`, so the rules can be tested without
 * building the editor:
 *
 * - The stored `paletteId` wins: by the entry's own id, or by an id the preset
 *   was saved under before a rename (`legacyIds`). Hex matching is only for a
 *   callout saved before the link existed.
 * - A retired preset (`getRetiredPalettes`) is never listed in the menu, but it
 *   still names the callouts that wear it — they read "Amber", not "Deleted
 *   color".
 * - An id saved before a rename is kept as it is. An older synced build knows
 *   only that one and would call the colour deleted; picking a colour is what
 *   writes the current id.
 */
import { getRetiredPalettes, type ColorPalette } from "../utils/colorPalettes";
import type { PaletteEntry } from "./paletteCombobox";

export interface ResolvedPaletteEntry {
	/** The entry the Color row shows as selected. */
	entry: PaletteEntry;
	/** The id the callout should carry from here on. */
	paletteId: string;
}

/** Null when nothing matches: the "Deleted color" case. */
export function resolvePaletteEntry(
	entries: readonly PaletteEntry[],
	paletteId: string | undefined,
	matches: (palette: ColorPalette) => boolean,
): ResolvedPaletteEntry | null {
	const known: PaletteEntry[] = [
		...entries,
		...getRetiredPalettes().map((palette) => ({
			id: palette.id,
			name: palette.name,
			group: palette.group,
			palette,
		})),
	];
	const entry =
		(paletteId
			? known.find(
					(e) => e.id === paletteId || e.palette.legacyIds?.includes(paletteId) === true,
				)
			: undefined) ?? known.find((e) => matches(e.palette));
	if (!entry) return null;
	const keepsOldId =
		paletteId !== undefined && entry.palette.legacyIds?.includes(paletteId) === true;
	return { entry, paletteId: keepsOldId ? paletteId : entry.id };
}
