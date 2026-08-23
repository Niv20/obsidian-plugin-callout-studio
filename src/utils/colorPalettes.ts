/**
 * utils/colorPalettes.ts — Preset color palettes for the callout editor.
 *
 * Defines color palette objects (id, name, light/dark accent and background
 * colors) grouped into Obsidian-derived palettes and extra preset palettes.
 * Background colors are auto-computed from the accent color using blendHex
 * from colorUtils when not explicitly supplied.
 * Used by CalloutEditor to populate the color preset dropdown.
 */
import {
	bgTintFor,
	bgGradientsEqual,
	DEFAULT_TEXT_COLOR_DARK,
	DEFAULT_TEXT_COLOR_LIGHT,
	derivePaletteFromColors,
} from "./colorUtils";
import { dedupeColorName, normalizeName, suggestColorName } from "./colorNames";
import type { BgGradient, CalloutDefinition, CustomPalette } from "../types";
import { t } from "../i18n";

export interface ColorPalette {
	id: string;
	name: string;
	/**
	 * Ids this preset was saved under before it was renamed (e.g. the old
	 * callout-name-based id "note" for what is now "blue"). Checked before
	 * hex-matching so a callout saved under the old id still resolves to
	 * this preset by name instead of falling through as an unmatched/
	 * "deleted" color — see CalloutEditor.ts's palette-dropdown lookup.
	 */
	legacyIds?: string[];
	/** Group label for the dropdown */
	group: "obsidian" | "preset" | "custom";
	/** Accent / icon color – light mode */
	colorLight: string;
	/** Accent / icon color – dark mode */
	colorDark: string;
	/** Background – light mode (optional) */
	bgColorLight?: string;
	/** Background – dark mode (optional) */
	bgColorDark?: string;
	/** Content text – light mode (only custom palettes carry text colors) */
	textColorLight?: string;
	/** Content text – dark mode (only custom palettes carry text colors) */
	textColorDark?: string;
	/** Background gradient (only custom palettes carry gradients) */
	bgGradient?: BgGradient;
	/**
	 * Paint no background at all — see `CalloutDefinition.transparentBg`. Only a
	 * *custom* palette can set it, from the palette editor's "None" background
	 * style: transparency is deliberately not offered as a preset, so the one
	 * route to it is a palette the user made and named themselves.
	 *
	 * The six colors stay valid hexes beside it (see `CustomPalette.transparentBg`);
	 * `bakePaletteColors` is what keeps the backgrounds among them from reaching
	 * a callout while this is set.
	 */
	transparentBg?: true;
}

function makePalette(
	id: string,
	name: string,
	group: "obsidian" | "preset",
	colorLight: string,
	colorDark: string,
	bgColorLight?: string,
	bgColorDark?: string,
	legacyIds?: string[],
): ColorPalette {
	return {
		id,
		name,
		group,
		colorLight,
		colorDark,
		bgColorLight: bgColorLight ?? bgTintFor(colorLight, false),
		bgColorDark: bgColorDark ?? bgTintFor(colorDark, true),
		...(legacyIds ? { legacyIds } : {}),
	};
}

/**
 * There is deliberately no "Transparent" preset here, and none should be added.
 * A preset is a *colour*, and every consumer of this list — the editor's
 * dropdown, its swatches, `resolveCalloutManagerColor`'s hex matching — reads it
 * as one. Transparency is the absence of a background instead, and it reaches a
 * callout the one way the user can name and re-find it: a custom palette saved
 * from the palette editor's "None" background style.
 */

/**
 * Palettes derived from Obsidian's built-in callout types, named for the hue
 * itself rather than the callout role it happens to match (so the same
 * dropdown entry reads sensibly for a `[!bug]` as for a `[!failure]`).
 *
 * The six that mirror a built-in carry Obsidian's own hexes, per theme —
 * picking "Blue" gives the blue Obsidian would have given. `teal` and `crimson`
 * keep their Material values on purpose: Obsidian collapses tip onto the same
 * cyan as abstract and danger onto the same red as failure, so following it
 * exactly would leave two pairs of identical entries in the dropdown. They stay
 * as the near-hues they always were, and the dropdown keeps its variety.
 * `legacyIds` carries the old callout-name-based id each preset used to be
 * saved under, so a callout picked before this rename still resolves to the
 * right preset (see the palette-dropdown lookup in CalloutEditor.ts) instead
 * of appearing as an unmatched/"deleted" color.
 *
 * Built as a function (not a top-level const) so preset names are resolved
 * through `t()` at call time — the dropdown is rebuilt on every open, so this
 * keeps names in sync if the user switches the plugin's display language.
 */
export function getObsidianPalettes(): ColorPalette[] {
	return [
		getDefaultNewCalloutPalette(),
		makePalette(
			"cyan",
			t("colorName.cyan"),
			"obsidian",
			"#00bfbc",
			"#53dfdd",
			undefined,
			undefined,
			["abstract"],
		),
		makePalette(
			"teal",
			t("colorName.teal"),
			"obsidian",
			"#00bfa5",
			"#00bfa5",
			undefined,
			undefined,
			["tip"],
		),
		makePalette(
			"green",
			t("colorName.green"),
			"obsidian",
			"#08b94e",
			"#44cf6e",
			undefined,
			undefined,
			["success"],
		),
		makePalette(
			"orange",
			t("colorName.orange"),
			"obsidian",
			"#ec7500",
			"#e9973f",
			undefined,
			undefined,
			["question"],
		),
		makePalette(
			"red",
			t("colorName.red"),
			"obsidian",
			"#e93147",
			"#fb464c",
			undefined,
			undefined,
			["failure"],
		),
		makePalette(
			"crimson",
			t("colorName.crimson"),
			"obsidian",
			"#ff1744",
			"#ff1744",
			undefined,
			undefined,
			["danger"],
		),
		makePalette(
			"violet",
			t("colorName.violet"),
			"obsidian",
			"#7852ee",
			"#a882ff",
			undefined,
			undefined,
			["example"],
		),
		makePalette(
			"gray",
			t("colorName.gray"),
			"obsidian",
			"#9e9e9e",
			"#9e9e9e",
			undefined,
			undefined,
			["quote"],
		),
	];
}

/**
 * Additional curated color presets. Deliberately kept to hues Obsidian's
 * built-in callouts don't already cover (chartreuse, brown, and the
 * warm/purple/pink family) so the presets add variety instead of duplicating
 * note-blue, tip-teal, success-green, failure-red or quote-gray.
 *
 * Same function-not-const shape as `getObsidianPalettes` and for the same
 * reason: names are localized, so they must be resolved at call time.
 */
export function getExtraPalettes(): ColorPalette[] {
	return [
		makePalette("coral", t("colorName.coral"), "preset", "#ff5722", "#ff8a65"),
		makePalette("amber", t("colorName.amber"), "preset", "#ff8f00", "#ffd54f"),
		makePalette("lime", t("colorName.lime"), "preset", "#afb42b", "#dce775"),
		makePalette("brown", t("colorName.brown"), "preset", "#795548", "#a1887f"),
		makePalette("grape", t("colorName.grape"), "preset", "#9c27b0", "#ce93d8"),
		makePalette("plum", t("colorName.plum"), "preset", "#6a1b9a", "#ab47bc"),
		makePalette(
			"bubblegum",
			t("colorName.bubblegum"),
			"preset",
			"#e91e63",
			"#f48fb1",
		),
	];
}

/** All available palettes */
export function getAllColorPalettes(): ColorPalette[] {
	return [...getObsidianPalettes(), ...getExtraPalettes()];
}

/**
 * The palette a brand-new callout falls back to when there is no definition to
 * seed it from at all — the last resort behind `CalloutEditor`'s fallback
 * callout. It has to be a *real* preset, which is why this builds the entry
 * `getObsidianPalettes()` leads with rather than inventing colours of its own:
 * the editor's dropdown labels the current colour by resolving it back to a
 * palette (by id, then legacyIds, then hex), so a default matching nothing
 * would open every new callout reading "Deleted color".
 */
export const DEFAULT_NEW_CALLOUT_PALETTE_ID = "blue";

export function getDefaultNewCalloutPalette(): ColorPalette {
	return makePalette(
		DEFAULT_NEW_CALLOUT_PALETTE_ID,
		t("colorName.blue"),
		"obsidian",
		"#086ddd",
		"#027aff",
		undefined,
		undefined,
		["note"],
	);
}

/** Adapts a user-saved palette to the dropdown's ColorPalette shape. */
export function customPaletteToColorPalette(p: CustomPalette): ColorPalette {
	return {
		id: p.id,
		name: p.name,
		group: "custom",
		colorLight: p.colorLight,
		colorDark: p.colorDark,
		bgColorLight: p.bgColorLight,
		bgColorDark: p.bgColorDark,
		textColorLight: p.textColorLight,
		textColorDark: p.textColorDark,
		bgGradient: p.bgGradient ? { ...p.bgGradient } : undefined,
		// The two background hexes above are copied even under the flag: they are
		// what a switch back to Solid restores (see `CustomPalette.transparentBg`),
		// and `bakePaletteColors` is what drops them on the way onto a callout.
		...(p.transparentBg === true ? { transparentBg: true as const } : {}),
	};
}

/**
 * Unique id for a new custom palette. The `cp-` prefix guarantees no
 * collision with the fixed preset ids ("blue", "coral", …).
 */
export function generatePaletteId(): string {
	return `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Whether two palettes are the same *color* — the equality behind the rule that
 * a vault may not hold two palettes with identical colors, the color-side twin
 * of the duplicate-name block the palette editor already applies.
 *
 * Deliberately ignores `id`, `name`, `bgIntensity`, `baseColor` and
 * `colorMode`. The first two are identity rather than color; the rest are pure
 * editor state that is already baked into the six hexes, so a palette built
 * with the Simple base-color slider and one assembled channel-by-channel in
 * Advanced DO collide when they land on the same colors. `baseColor` in
 * particular must not count: two users picking `#ffff00` and `#f5f500` both get
 * the same corrected accent, and a pair of palettes that render identically are
 * duplicates however they were reached. That is the honest reading of "the same
 * color", and the palette editor's error text has to say so.
 *
 * Absent backgrounds and text colors fall back exactly the way
 * `bakePaletteColors` fills them in, so a preset leaving them implicit compares
 * equal to a custom palette spelling out the same derived values — the two
 * render identically, which is the only thing being asked here.
 *
 * This compares both background hexes even under `transparentBg`, and is
 * therefore deliberately stricter than `CalloutEditor.matchesPalette`, which
 * skips them. That test compares a *baked callout*, where transparency means
 * the backgrounds were never persisted at all; a transparent palette keeps them
 * (they are what a switch back to Solid restores), so two transparent palettes
 * differing only there really do diverge the moment the user flips that
 * control. Stricter also means fewer collisions, and so fewer of the
 * consolidations below — which is the safe direction to err in.
 */
export function palettesVisuallyEqual(
	a: ColorPalette,
	b: ColorPalette,
): boolean {
	if ((a.transparentBg === true) !== (b.transparentBg === true)) return false;
	if (!bgGradientsEqual(a.bgGradient, b.bgGradient)) return false;
	const eq = (x: string, y: string): boolean =>
		x.toLowerCase() === y.toLowerCase();
	return (
		eq(a.colorLight, b.colorLight) &&
		eq(a.colorDark, b.colorDark) &&
		eq(
			a.bgColorLight ?? bgTintFor(a.colorLight, false),
			b.bgColorLight ?? bgTintFor(b.colorLight, false),
		) &&
		eq(
			a.bgColorDark ?? bgTintFor(a.colorDark, true),
			b.bgColorDark ?? bgTintFor(b.colorDark, true),
		) &&
		eq(
			a.textColorLight ?? DEFAULT_TEXT_COLOR_LIGHT,
			b.textColorLight ?? DEFAULT_TEXT_COLOR_LIGHT,
		) &&
		eq(
			a.textColorDark ?? DEFAULT_TEXT_COLOR_DARK,
			b.textColorDark ?? DEFAULT_TEXT_COLOR_DARK,
		)
	);
}

/** Convenience wrapper: the first saved palette whose colors equal `candidate`. */
export function findPaletteWithSameColors(
	candidate: ColorPalette,
	palettes: CustomPalette[],
	exceptId?: string,
): CustomPalette | undefined {
	return palettes.find(
		(p) =>
			p.id !== exceptId &&
			palettesVisuallyEqual(customPaletteToColorPalette(p), candidate),
	);
}

/**
 * A saved callout's appearance as a palette seed — everything a `CustomPalette`
 * needs except the identity the user is about to give it. Used to rebuild a
 * palette that was deleted out from under a group of callouts, from any one
 * member of that group.
 *
 * The optional fields fall back exactly the way the renderer resolves them, so
 * the seed describes what the callout actually looks like rather than what it
 * happens to store. `transparentBg` is carried on its own axis, leaving all six
 * colors valid beside it — which is what `sanitizeCustomPalettes` requires, and
 * what a switch back to Solid inside the palette editor restores.
 *
 * `colorMode: "advanced"` is deliberate: nothing guarantees a real callout's six
 * colors are derivable from one base color, and the simple control's Intensity
 * slider would re-derive (and so discard) them on a single drag.
 */
export function paletteSeedFromDefinition(
	def: CalloutDefinition,
): Omit<CustomPalette, "id" | "name"> {
	return {
		colorLight: def.colorLight,
		colorDark: def.colorDark,
		bgColorLight: def.bgColorLight ?? bgTintFor(def.colorLight, false),
		bgColorDark: def.bgColorDark ?? bgTintFor(def.colorDark, true),
		textColorLight: def.textColorLight ?? DEFAULT_TEXT_COLOR_LIGHT,
		textColorDark: def.textColorDark ?? DEFAULT_TEXT_COLOR_DARK,
		bgGradient: def.bgGradient ? { ...def.bgGradient } : undefined,
		...(def.transparentBg === true ? { transparentBg: true as const } : {}),
		colorMode: "advanced",
	};
}

export interface PaletteConsolidation {
	/** The surviving palettes, in their original relative order. */
	palettes: CustomPalette[];
	/** Dropped palette id → the id that absorbed it. Empty when nothing merged. */
	remap: Map<string, string>;
	/** Names of what merged into what, for the user-facing notice. */
	merged: Array<{ from: string; to: string }>;
}

/**
 * Enforces "no two saved palettes with identical colors" on untrusted data
 * (`data.json` on load, a merged import) — the layer the palette editor's Save
 * block cannot reach.
 *
 * It MERGES rather than drops. A duplicate is removed from the list, but its id
 * is reported in `remap` so the caller can re-point every callout that linked to
 * it at the survivor (`CalloutRegistry.relinkPalette`). Dropping alone would
 * orphan those callouts — leaving them with a dangling `paletteId` and no route
 * home — which would turn a tidy-up into silent data loss on a vault the user
 * built before the rule existed. Colors are baked onto the callouts either way,
 * so nothing changes appearance; what the user loses is the duplicate's *name*,
 * and the caller is expected to say so out loud.
 *
 * The survivor is the earliest entry in the array — insertion order, so the
 * oldest palette keeps its name and id, and re-running this over its own output
 * is a no-op.
 *
 * Custom palettes are compared only against each other, never against the
 * built-in presets. Preset hexes may be retuned between plugin versions (which
 * is what `legacyIds` already exists to survive), and folding presets in here
 * would let a plugin update retroactively swallow a custom palette that was
 * perfectly valid when the user made it. The editor blocks that collision at
 * creation time instead, where the user is present to react.
 */
export function consolidatePalettesByColor(
	palettes: CustomPalette[],
): PaletteConsolidation {
	const survivors: CustomPalette[] = [];
	const remap = new Map<string, string>();
	const merged: Array<{ from: string; to: string }> = [];
	for (const palette of palettes) {
		const survivor = findPaletteWithSameColors(
			customPaletteToColorPalette(palette),
			survivors,
		);
		if (survivor) {
			remap.set(palette.id, survivor.id);
			merged.push({ from: palette.name, to: survivor.name });
			continue;
		}
		survivors.push(palette);
	}
	return { palettes: survivors, remap, merged };
}

/** The `CalloutDefinition` fields a resolved palette bakes onto a callout. */
export type CalloutManagerBakedColors = Pick<
	CalloutDefinition,
	| "colorLight"
	| "colorDark"
	| "bgColorLight"
	| "bgColorDark"
	| "textColorLight"
	| "textColorDark"
	| "bgGradient"
	| "transparentBg"
>;

export interface CalloutManagerColorResolution {
	/** The palette (existing or newly created) this color now links to. */
	paletteId: string;
	colors: CalloutManagerBakedColors;
	/**
	 * Set only when no existing palette matched the imported color — the
	 * caller (`CalloutRegistry.applyCalloutManagerImport`) is responsible for
	 * pushing this onto `settings.customPalettes`.
	 */
	createdPalette?: CustomPalette;
}

/**
 * The colors a palette bakes onto a callout that applies it — the one place
 * that decides what a `ColorPalette` means as a `CalloutDefinition`. Every
 * field is set explicitly, `undefined` included, so spreading the result over
 * an existing definition clears whatever the previous palette left behind
 * (`CalloutRegistry.applyPaletteColors` relies on exactly that).
 */
export function bakePaletteColors(
	palette: ColorPalette,
): CalloutManagerBakedColors {
	// A transparent palette bakes to the flag ALONE. The tint fallbacks below
	// fire on a missing background, which is precisely the state transparency
	// leaves the palette in — running them would hand the callout an opaque
	// colour the palette never had.
	if (palette.transparentBg) {
		return {
			colorLight: palette.colorLight,
			colorDark: palette.colorDark,
			bgColorLight: undefined,
			bgColorDark: undefined,
			textColorLight: palette.textColorLight ?? DEFAULT_TEXT_COLOR_LIGHT,
			textColorDark: palette.textColorDark ?? DEFAULT_TEXT_COLOR_DARK,
			bgGradient: undefined,
			transparentBg: true,
		};
	}
	return {
		colorLight: palette.colorLight,
		colorDark: palette.colorDark,
		bgColorLight: palette.bgColorLight ?? bgTintFor(palette.colorLight, false),
		bgColorDark: palette.bgColorDark ?? bgTintFor(palette.colorDark, true),
		textColorLight: palette.textColorLight ?? DEFAULT_TEXT_COLOR_LIGHT,
		textColorDark: palette.textColorDark ?? DEFAULT_TEXT_COLOR_DARK,
		bgGradient: palette.bgGradient ? { ...palette.bgGradient } : undefined,
		// Spelled out rather than omitted, like `bgGradient` beside it: a palette
		// edited from the "None" background style back to Solid has to actually
		// un-transparent the callouts linked to it, and a key that isn't there
		// clears nothing when this is spread over an existing definition.
		transparentBg: undefined,
	};
}

/**
 * Resolves one imported Callout Manager color against everything already
 * known: Obsidian/preset palettes and the user's saved custom palettes.
 * `customPalettes` should be the caller's live, growing array: the caller is
 * expected to push `createdPalette` onto it before resolving the next entry,
 * so two imported callouts sharing a brand-new color see each other and
 * share one saved palette instead of getting one each.
 *
 * A color that already matches a known palette (by the same 4-field
 * accent+background / gradient equality `CalloutEditor`'s dropdown and
 * `CalloutRegistry`'s paletteId migration already use) links to that palette
 * as-is. Otherwise the color is "unknown": a new named `CustomPalette` is
 * derived from it (same derivation as the editor's "New color…" flow) for
 * the caller to save, instead of the callout ending up with baked colors
 * that match nothing — which the editor would otherwise show as a
 * "Deleted color".
 *
 * Two hexes, because Callout Manager's own `data.json` really can hold a
 * different color per color scheme (its per-scheme editor writes one entry
 * conditioned on `{colorScheme: "light"}` and another on `"dark"`). The CSS
 * its Copy button emits is already resolved for whichever scheme was active,
 * so the paste importer only ever has one — that path calls
 * {@link resolveCalloutManagerColor} and both sides are the same hex.
 *
 * The palette is *named* after the light hex: `suggestColorName` maps a hex to
 * a human colour word, and running it twice would either produce a name that
 * describes only half the palette anyway or an unreadable "blue / teal".
 */
export function resolveCalloutManagerColors(
	hexLight: string,
	hexDark: string,
	customPalettes: CustomPalette[],
): CalloutManagerColorResolution {
	const derived = derivePaletteFromColors(hexLight, hexDark);
	const candidates: ColorPalette[] = [
		...getAllColorPalettes(),
		...customPalettes.map(customPaletteToColorPalette),
	];

	const eqHex = (a: string, b: string): boolean =>
		a.toLowerCase() === b.toLowerCase();

	const match = candidates.find(
		(p) =>
			// An imported colour is always an opaque background, so it can never
			// mean a transparent palette. The hex comparisons below cannot rule
			// one out on their own: a custom palette keeps its six colors beside
			// the flag, so a "None" palette can match every hex here and would
			// otherwise bake transparency onto a callout that asked for a fill.
			!p.transparentBg &&
			// Two spellings of the same colour, and a candidate may only ever be
			// written in one of them. A palette a previous import minted stores
			// the CONTRAST-CORRECTED accents `derivePaletteFromColors` produced,
			// so it can only match on the left; a built-in preset stores the raw
			// hex `makePalette` was given, with no correction, so it can only
			// match on the right.
			//
			// Comparing the derived pair alone — as this once did — therefore made
			// every preset whose own accent needs correcting unreachable: 10 of the
			// 16, `Gray` among them, so importing #9e9e9e (literally Gray's hex)
			// derived #868686, matched nothing and minted a near-duplicate "Gray 2".
			//
			// Matching on the right bakes the preset's raw accent, below the 3:1
			// the derivation enforces. That is deliberate: it is exactly what
			// choosing that preset in the editor's dropdown already gives, so this
			// makes import agree with the editor instead of quietly inventing a
			// palette the dropdown cannot name.
			((eqHex(p.colorLight, derived.colorLight) &&
				eqHex(p.colorDark, derived.colorDark)) ||
				(eqHex(p.colorLight, hexLight) && eqHex(p.colorDark, hexDark))) &&
			// Unchanged, and still correct on both branches: a preset's backgrounds
			// are `bgTintFor(accent, mode)` at the same DEFAULT_BG_COLOR_AMOUNT the
			// derivation uses, so equal accents give equal backgrounds either way.
			eqHex(p.bgColorLight ?? "", derived.bgColorLight) &&
			eqHex(p.bgColorDark ?? "", derived.bgColorDark) &&
			bgGradientsEqual(p.bgGradient, undefined),
	);
	if (match) {
		return { paletteId: match.id, colors: bakePaletteColors(match) };
	}

	const takenNames = new Set(
		[...getAllColorPalettes(), ...customPalettes].map((p) =>
			normalizeName(p.name),
		),
	);
	const createdPalette: CustomPalette = {
		id: generatePaletteId(),
		name: dedupeColorName(suggestColorName(hexLight), takenNames),
		...derived,
	};
	return {
		paletteId: createdPalette.id,
		colors: bakePaletteColors(customPaletteToColorPalette(createdPalette)),
		createdPalette,
	};
}

/** Resolves one imported color used for both color schemes. */
export function resolveCalloutManagerColor(
	hex: string,
	customPalettes: CustomPalette[],
): CalloutManagerColorResolution {
	return resolveCalloutManagerColors(hex, hex, customPalettes);
}
