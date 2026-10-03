/** Rebuild picker preferences without trusting values carried by JSON. */
import { DEFAULT_SETTINGS } from "../constants";
import type { IconLibrarySettings, IconSourceSettings } from "../types";

/** Longer than any library id, so a real one is never cut off. */
const MAX_LIBRARY_ID_LENGTH = 32;
/** Far above the nine libraries there are; only stops a hand-edited file growing a list without end. */
const MAX_LIBRARY_IDS = 64;

/**
 * A saved list of library ids: short strings only, each once, in saved order.
 *
 * Ids this build does not know are kept on purpose — a newer build that shares
 * the file wrote them, and dropping them here would undo its order on the next
 * save. `icons/iconLibraries.ts` ignores them when it reads the list.
 */
function libraryIds(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const ids = value.filter((id): id is string =>
		typeof id === "string" && id.length > 0 && id.length <= MAX_LIBRARY_ID_LENGTH);
	return [...new Set(ids)].slice(0, MAX_LIBRARY_IDS);
}

export function mergeIconLibraries(saved: Partial<IconLibrarySettings> | undefined): IconLibrarySettings {
	const source = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : undefined;
	return {
		order: libraryIds(source?.order),
		hidden: libraryIds(source?.hidden),
	};
}

const MATERIAL_STYLES = ["outlined", "filled", "rounded", "sharp"] as const;
const FA_STYLES = ["solid", "regular", "brands"] as const;
const TABLER_STYLES = ["outline", "filled"] as const;

function choice<T extends string>(value: unknown, choices: readonly T[]): T | undefined {
	return typeof value === "string" && (choices as readonly string[]).includes(value)
		? value as T : undefined;
}

export function mergeIconSources(saved: Partial<IconSourceSettings> | undefined): IconSourceSettings {
	const defaults = DEFAULT_SETTINGS.iconSources;
	const categories = saved?.lastCategory;
	const lastCategory = { ...defaults.lastCategory };
	if (categories && typeof categories === "object" && !Array.isArray(categories)) {
		// fromEntries preserves literal prototype-named keys as data. Old source
		// ids may stay, but objects must never reach category picker controls.
		Object.defineProperties(lastCategory, Object.getOwnPropertyDescriptors(
			Object.fromEntries(Object.entries(categories).filter(([, value]) => typeof value === "string")),
		));
	}
	if (typeof saved?.lastMaterialCategory === "string" && saved.lastMaterialCategory) {
		lastCategory.material = saved.lastMaterialCategory;
	}
	const weight = saved?.materialWeightDefault;
	const tone = saved?.lastEmojiSkinTone;
	const merged: IconSourceSettings = {
		materialStyleDefault: choice(saved?.materialStyleDefault, MATERIAL_STYLES) ?? defaults.materialStyleDefault,
		materialWeightDefault: typeof weight === "number" && Number.isInteger(weight) &&
			weight >= 100 && weight <= 700 && weight % 100 === 0 ? weight : defaults.materialWeightDefault,
		lastCategory,
		lastEmojiSkinTone: typeof tone === "number" && Number.isInteger(tone) && tone >= 0 && tone <= 5
			? tone : defaults.lastEmojiSkinTone,
	};
	const fa = choice(saved?.faStyleDefault, FA_STYLES);
	const tabler = choice(saved?.tablerStyleDefault, TABLER_STYLES);
	if (fa) merged.faStyleDefault = fa;
	if (tabler) merged.tablerStyleDefault = tabler;
	return merged;
}
