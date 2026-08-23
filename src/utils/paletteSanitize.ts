/**
 * utils/paletteSanitize.ts — the gate every saved or imported palette passes.
 *
 * Split out of `colorPalettes.ts`, which is otherwise about *building* palettes
 * (presets, derivation, baking onto a callout). This is the opposite job: it
 * trusts nothing, and it is the single place that decides which fields of a
 * `CustomPalette` survive a trip through `data.json`. That matters more than it
 * looks — the object below is rebuilt field by field rather than copied, so a
 * field added to the interface and not added here is silently dropped on the
 * next load, with no type error to catch it.
 */
import {
	clampBgIntensity,
	isValidHexColor,
	sanitizeBgGradient,
} from "./colorUtils";
import type { CustomPalette } from "../types";

/**
 * Validates untrusted saved/imported palette data: keeps only entries with a
 * non-empty string id + name and six valid `#rrggbb` colors, deduped by id
 * (first wins). Invalid entries are dropped silently, matching the tolerance
 * of the rest of the settings loader.
 */
export function sanitizeCustomPalettes(raw: unknown): CustomPalette[] {
	if (!Array.isArray(raw)) return [];
	const result: CustomPalette[] = [];
	const seenIds = new Set<string>();
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const p = entry as Partial<CustomPalette>;
		if (typeof p.id !== "string" || p.id.length === 0) continue;
		if (typeof p.name !== "string" || p.name.length === 0) continue;
		if (seenIds.has(p.id)) continue;
		if (
			!isValidHexColor(p.colorLight) ||
			!isValidHexColor(p.colorDark) ||
			!isValidHexColor(p.bgColorLight) ||
			!isValidHexColor(p.bgColorDark) ||
			!isValidHexColor(p.textColorLight) ||
			!isValidHexColor(p.textColorDark)
		) {
			continue;
		}
		seenIds.add(p.id);
		// A malformed gradient degrades the palette to solid instead of
		// dropping it — the six colors are still perfectly usable.
		const bgGradient = sanitizeBgGradient(p.bgGradient);
		// A bad intensity is dropped (undefined), not fatal: the baked bg colors
		// already carry the palette's look; the editor then shows the default.
		const bgIntensity = clampBgIntensity(p.bgIntensity);
		result.push({
			id: p.id,
			name: p.name,
			colorLight: p.colorLight,
			colorDark: p.colorDark,
			bgColorLight: p.bgColorLight,
			bgColorDark: p.bgColorDark,
			textColorLight: p.textColorLight,
			textColorDark: p.textColorDark,
			...(bgGradient ? { bgGradient } : {}),
			// Only `true` survives, the same normalization the import validator
			// applies to a definition's copy of this flag: the field is `?: true`,
			// where "off" is an absent key rather than `false`.
			...(p.transparentBg === true ? { transparentBg: true as const } : {}),
			...(bgIntensity !== undefined ? { bgIntensity } : {}),
			// A junk base color is dropped rather than fatal, exactly like the
			// intensity above: the six colors still describe the palette, and the
			// editor falls back to seeding its base from `colorLight` — the same
			// thing it does for every palette saved before this field existed.
			...(isValidHexColor(p.baseColor) ? { baseColor: p.baseColor } : {}),
			...(p.colorMode === "advanced" ? { colorMode: "advanced" as const } : {}),
		});
	}
	return result;
}
