/**
 * icons/types.ts — Contracts shared by every icon source.
 *
 * The plugin draws the same icon onto eight different surfaces (reading-view
 * callouts, heading callouts, inline callouts, the settings list, the callout editor
 * preview, the `[!` autocomplete popup, the replace-callout modal and the vault
 * statistics modal). Each of those used to re-implement "look the SVG up in the
 * cache, parse it, colour it, put it in the DOM" itself, which meant a new icon
 * source had to be added in every one of them.
 *
 * Two seams fix that. IconPack describes what is different about a library —
 * how it is drawn, how it is searched, what varies its artwork, what its
 * licence requires. IconResolver hands renderers finished artwork so they never
 * touch a cache. Adding a library is then a new file under `packs/` plus a line
 * in `registry.ts`.
 */
import type {
	CalloutIcon,
	CalloutRenderRole,
	FontAwesomeStyle,
	IconPackId,
	IconSourceId,
	MaterialIconStyle,
	TablerIconStyle,
} from "../types";
import type { LocaleKey } from "../i18n";

/**
 * How a pack's artwork reaches the screen. Drives both the renderer's dispatch
 * and whether the picker has to offer a download before it can show a grid.
 */
export type IconPackKind =
	/** Obsidian ships the artwork; `setIcon` draws it. No data, no network. */
	| "builtin"
	/** A text glyph, drawn as a text node. No SVG involved. */
	| "glyph"
	/**
	 * One SVG per icon, fetched from the vendor when the icon is chosen.
	 * Material Symbols only: 3,870 icons × 4 styles × 7 weights is over 100,000
	 * variants, so there is no file that could be shipped or downloaded whole.
	 */
	| "perIconRemote"
	/** One file of path data for the whole pack, downloaded once, then offline. */
	| "bundledRemote"
	/**
	 * Artwork the user supplied, held in settings rather than fetched or
	 * bundled. Always available and never downloadable, so every "is this
	 * drawable yet" question answers yes without touching the network.
	 */
	| "local";

/** One searchable icon in a pack's bundled index. */
export interface IconEntry {
	/** Stored verbatim as `CalloutIcon.value`. */
	name: string;
	/**
	 * Which source this entry came from. Set only when entries from several
	 * sources are pooled into one list ("All sources" in the picker), where the
	 * list itself can no longer say where a given icon belongs.
	 */
	pack?: IconSourceId;
	/** Grid tooltip. Defaults to a prettified `name`. */
	label?: string;
	categories: readonly string[];
	/** Extra search terms beyond the name (upstream keywords/tags). */
	keywords: readonly string[];
	/**
	 * Alternate `value`s for the same entry, selected by a picker variant
	 * control rather than by searching — the five emoji skin tones, ordered
	 * light → dark. Absent when the entry has exactly one form.
	 */
	variants?: readonly string[];
}

export interface IconIndex {
	entries: readonly IconEntry[];
	/** Sorted, deduplicated category names; empty when the pack has none. */
	categories: readonly string[];
}

/** Picker toolbar state a pack's variant controls read and write. */
export interface IconVariantState {
	style?: MaterialIconStyle;
	weight?: number;
	/** Emoji skin tone: 0 = default, 1–5 = light → dark. */
	emojiSkinTone?: number;
	/** Font Awesome style. Unlike Material's, it also filters the grid. */
	faStyle?: FontAwesomeStyle;
	/** Tabler style. Filters the grid too — only some icons have a filled one. */
	tablerStyle?: TablerIconStyle;
}

/**
 * A control a pack needs in the picker toolbar, beyond search and category.
 *
 * `"select"` covers named variant lists; `"skin-tone"` supplies the six emoji
 * samples. Both render through the picker's shared selection-only listbox.
 */
export type IconVariantSpec =
	| {
			kind: "select";
			key: "style" | "weight" | "faStyle" | "tablerStyle";
			labelKey: LocaleKey;
			options: readonly (string | number)[];
			/**
			 * Display names for `options`, in the same order. Omitted when the
			 * raw value already reads as a label — Material's `outlined` and
			 * `400` do; Font Awesome's `solid` wants a capital S.
			 */
			optionLabelKeys?: readonly LocaleKey[];
	  }
	| { kind: "skin-tone" };

/** A licence the pack's artwork ships under. */
export interface IconLicense {
	name: string;
	spdx: string;
	url: string;
	holder: string;
	/** What this licence covers, when the pack splits across several. */
	scope?: string;
}

export interface IconAttribution {
	/** Human-readable pack name, used verbatim in credits (never translated). */
	title: string;
	homepage: string;
	/** Upstream release this plugin's data was generated from. */
	version: string;
	licenses: readonly IconLicense[];
	/**
	 * How the plugin altered the artwork, when a licence requires saying so
	 * (CC BY 4.0 §3(a)(1)(B) — "indicate if You modified the Licensed Material").
	 */
	modifications?: string;
	/**
	 * A standing notice the picker must keep on screen while this pack is
	 * selected — Font Awesome's request about brand marks, which is a trademark
	 * matter its icon licence does not cover.
	 */
	noticeKey?: LocaleKey;
}

/**
 * An icon library.
 *
 * Everything here is either metadata or a pure function of an icon; nothing on
 * this interface performs I/O. Downloading is the IconService's job, so a pack
 * stays trivially testable and cannot stall a render.
 */
export interface IconPack {
	readonly id: IconSourceId;
	readonly kind: IconPackKind;
	/** Source menu label. */
	readonly labelKey: LocaleKey;
	/** One line in the source menu saying what this library holds. */
	readonly descriptionKey: LocaleKey;
	/**
	 * The Lucide id standing in for this library in the source menu.
	 *
	 * Deliberately Lucide rather than one of the library's own icons: Lucide
	 * ships inside Obsidian, so the row draws before anything is downloaded —
	 * which is the state most sources are in when the menu is first opened.
	 */
	readonly emblemIcon: string;
	readonly searchPlaceholderKey: LocaleKey;
	/** False hides the picker's category dropdown (Octicons and RPG have none). */
	readonly hasCategories: boolean;
	/** Extra toolbar controls this pack needs. */
	readonly variants?: readonly IconVariantSpec[];
	/**
	 * The pack files this source draws from, for `bundledRemote` sources only.
	 * Almost always a single file named after the source; Font Awesome is three,
	 * one per style, which is why this is a list rather than an id.
	 */
	readonly dataPacks?: readonly IconPackId[];
	readonly attribution: IconAttribution;

	/** Decode the bundled search index. Memoized by the pack; safe to re-call. */
	loadIndex(): Promise<IconIndex>;

	/** Build the stored icon for a grid selection plus the picker's variant state. */
	makeIcon(entry: IconEntry, variants: IconVariantState): CalloutIcon;

	/**
	 * Whether an entry belongs in the grid under the current toolbar state.
	 *
	 * Only for variants that change *which icons exist* rather than how they are
	 * drawn: Font Awesome's Regular holds 169 of Solid's 1,422, so without this
	 * the other 1,253 cells would be empty. Absent means every entry always shows.
	 */
	entryMatches?(entry: IconEntry, variants: IconVariantState): boolean;

	/**
	 * A notice the picker must keep on screen for *some* toolbar states — Font
	 * Awesome's trademark note, which applies to Brands and to nothing else.
	 * When present it replaces `attribution.noticeKey` in the picker; the
	 * settings credits always show the attribution one.
	 */
	pickerNotice?(variants: IconVariantState): LocaleKey | undefined;

	/**
	 * Everything besides the name that changes this icon's artwork, as a cache
	 * key component. Must cover every axis, or two different drawings collide on
	 * one cache entry; must be stable, or cached artwork is orphaned on reload.
	 */
	cacheVariant(icon: CalloutIcon, role: CalloutRenderRole): string;

	/**
	 * Build artwork from data the pack holds itself (bundled, or downloaded to
	 * disk). Null when the pack has no local data for this icon yet — or always,
	 * for packs whose artwork only ever arrives through the SVG cache.
	 *
	 * Synchronous by contract: callers are DOM render paths that cannot wait.
	 */
	buildSvg?(icon: CalloutIcon, role: CalloutRenderRole): string | null;
}

/**
 * Read-only, synchronous view of whatever icon artwork is already available
 * locally (bundled, downloaded to disk, or cached in `data.json`).
 *
 * When artwork is missing the renderer paints a placeholder, and the download
 * that lands later triggers a repaint sweep (see CSSInjector.paintIcons).
 */
export interface IconResolver {
	/**
	 * Sanitized SVG markup for this icon, or null when it is not local yet.
	 *
	 * `role` is passed because some packs ship several drawings of the same icon
	 * and pick between them by surface — Octicons, whose 16px artwork is drawn
	 * for small sizes and 24px for large — so one CalloutIcon can legitimately
	 * resolve to different SVGs in a block callout and in an inline callout.
	 */
	resolveSvg(icon: CalloutIcon, role: CalloutRenderRole): string | null;

	/**
	 * True once fetching this icon has been attempted and failed, so the UI can
	 * show a permanent error instead of a spinner that never stops.
	 */
	hasFailed(icon: CalloutIcon, role: CalloutRenderRole): boolean;
}
