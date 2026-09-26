/** Rebuild picker preferences without trusting values carried by JSON. */
import { DEFAULT_SETTINGS } from "../constants";
import type { IconSourceSettings } from "../types";

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
