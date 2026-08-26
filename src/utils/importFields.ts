/**
 * utils/importFields.ts — Which keys an imported `CalloutDefinition` may carry.
 *
 * Split out of `importValidator.ts`, which is one of the files CLAUDE.md's
 * ~300-line rule has already had to freeze. This is a self-contained question —
 * "is this key one we know?" — asked from two places in the validator and from
 * nowhere else, so it moves without a seam.
 *
 * The two maps are the point of the module. Both are total `Record`s, so a field
 * added to `CalloutDefinition` or `CalloutIcon` and forgotten here is a compile
 * error rather than a silent data loss (see each doc comment for why that
 * matters). The `Set`s below them are what the validator actually reads.
 */
import type { CalloutDefinition, CalloutIcon } from "../types";

/**
 * Top-level keys we recognize on a `CalloutDefinition`. Anything else is
 * reported as a warning.
 *
 * A total `Record` rather than a bare list, for the same reason the icon
 * registry uses one: the export writes whatever a definition happens to carry,
 * so a field added to `CalloutDefinition` and forgotten here makes the plugin
 * warn about its *own* export ("Unknown field(s) ignored: …") on every entry and
 * silently drop the value. Declaring the field without listing it is now a
 * compile error instead.
 */
const KNOWN_FIELD_MAP: Record<keyof CalloutDefinition, true> = {
	id: true,
	displayName: true,
	icon: true,
	hideIcon: true,
	colorLight: true,
	colorDark: true,
	foldable: true,
	defaultFolded: true,
	builtIn: true,
	source: true,
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
	metadata: true,
};

export const KNOWN_FIELDS = new Set<string>(Object.keys(KNOWN_FIELD_MAP));

/**
 * Fields this plugin used to write and no longer reads. Dropped in silence
 * rather than reported: the warning above exists to flag a file the plugin
 * does not understand, and an export made by an older build of the plugin
 * itself is not that. Entries here are never re-added to a definition, so the
 * value is gone after the first save.
 *
 * `solidBackground` painted a callout's background as a flat, opaque fill
 * instead of the translucent tint the injector emits. An opaque fill is
 * exactly what stops nested callouts from stepping (see `CSSInjector.bgProps`),
 * so the opt-out was retired and every background is a tint now.
 *
 * `styleMode` was the persisted half of a manual "who paints this callout"
 * setting. Ownership is derived from the active theme now
 * (`CalloutRegistry.themeOwns`), so the field describes a decision that is no
 * longer the user's to make. Its every value meant "this plugin paints it",
 * which is also what its absence means.
 */
export const RETIRED_FIELDS = new Set<string>(["solidBackground", "styleMode"]);

/** Recognized `CalloutIcon` keys. Total for the same reason as `KNOWN_FIELD_MAP`. */
const KNOWN_ICON_FIELD_MAP: Record<keyof CalloutIcon, true> = {
	type: true,
	value: true,
	style: true,
	weight: true,
	recolor: true,
};

export const KNOWN_ICON_FIELDS = new Set<string>(
	Object.keys(KNOWN_ICON_FIELD_MAP),
);
