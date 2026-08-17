/**
 * manager/calloutCompare.ts — "Has this callout been edited, and does that edit
 * claim its colour?"
 *
 * One question, asked from three places in `CalloutRegistry` (`toSaveData`,
 * `isBuiltInModified`, `isUnmodifiedBuiltIn`) and from nowhere else. Split out
 * of that file, which CLAUDE.md's ~300-line rule has long since had to freeze.
 *
 * The two tables are the point of the module, and both are load-bearing in
 * opposite directions — one decides what gets *persisted*, the other decides
 * what gets to keep *deferring to the theme*. Their doc comments say why.
 */
import type { CalloutDefinition } from "../types";
import { iconsEqual } from "../icons/lucideId";

/**
 * Whether a built-in still matches the default it shipped with.
 *
 * This is the gate on `CalloutRegistry.toSaveData` persisting a built-in at
 * all, so a field missing here is not a cosmetic gap: a built-in the user
 * customized *only* through that field reads as pristine and is never written
 * to `data.json` — the edit survives until the next reload and then vanishes.
 * Hence the total `Record`, which makes adding a field to `CalloutDefinition`
 * without deciding its place here a compile error.
 *
 * `id` identifies the pair rather than distinguishing it; `builtIn` and
 * `source` are what makes this a built-in in the first place. Everything else
 * is a difference the user can see.
 */
export const COMPARED_FIELDS: Record<
	Exclude<keyof CalloutDefinition, "id" | "builtIn" | "source">,
	true
> = {
	displayName: true,
	icon: true,
	hideIcon: true,
	colorLight: true,
	colorDark: true,
	foldable: true,
	defaultFolded: true,
	iconAdjust: true,
	iconOffsetX: true,
	iconOffsetY: true,
	iconSize: true,
	bgColorLight: true,
	bgColorDark: true,
	bgGradient: true,
	transparentBg: true,
	textColorLight: true,
	textColorDark: true,
	aliases: true,
	paletteId: true,
	customized: true,
	externalStyle: true,
	styleMode: true,
	metadata: true,
};

/**
 * Fields that are a difference the user can see but *not* a claim on the
 * callout's colour — so `CalloutRegistry.isUnmodifiedBuiltIn` skips them while
 * `toSaveData` still counts them.
 *
 * Dropping the icon from `[!note]` has to be persisted, or it vanishes on the
 * next reload; but it says nothing about what colour the callout should be,
 * and letting it count here would swap core's `--callout-note` for a
 * hard-coded hex — silently ending the built-in's deference to whatever the
 * theme says blue is.
 *
 * `styleMode` is here for the same reason, and the consequence is sharper.
 * Forcing an untouched `[!info]` means "give me Obsidian's own blue at a
 * weight this theme cannot reach" — the point is the *weight*, not a new
 * colour. Counting it as a modification would drop the built-in's deference
 * and bake a literal hex at high specificity, which is close to the opposite
 * of what the user asked for.
 */
export const COLOUR_NEUTRAL_FIELDS: ReadonlySet<keyof CalloutDefinition> =
	new Set(["hideIcon", "styleMode"]);

/**
 * Structural diff over {@link COMPARED_FIELDS}, optionally ignoring a set of
 * fields (which is how {@link COLOUR_NEUTRAL_FIELDS} gets its effect).
 */
export function isCalloutModified(
	current: CalloutDefinition,
	original: CalloutDefinition,
	ignore?: ReadonlySet<keyof CalloutDefinition>,
): boolean {
	// Structural compare, so nested values (`bgGradient`, `aliases`,
	// `metadata`) are covered without a per-field spelling of each one.
	// `?? null` keeps "absent" and "explicitly undefined" equal, which is
	// what a JSON round-trip through data.json produces anyway.
	//
	// `icon` is the one field a raw string diff gets wrong: `constants.ts`
	// spells a built-in's icon bare (`pencil`) and the picker spells the
	// same drawing `lucide-pencil`, so an untouched built-in would read as
	// customized the moment its owner opened the picker. `iconsEqual` knows
	// the two spellings are one icon.
	return Object.keys(COMPARED_FIELDS).some((field) => {
		const key = field as keyof CalloutDefinition;
		if (ignore?.has(key)) return false;
		if (key === "icon") return !iconsEqual(current.icon, original.icon);
		return (
			JSON.stringify(current[key] ?? null) !==
			JSON.stringify(original[key] ?? null)
		);
	});
}
