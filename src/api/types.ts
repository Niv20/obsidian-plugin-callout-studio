/**
 * api/types.ts — The shapes the public API hands to other plugins.
 *
 * Deliberately separate from `src/types.ts`. `CalloutDefinition` is the internal
 * data model: it changes whenever a feature lands, it carries fields that only
 * mean something to the renderer, and several of them are typed `true`-or-absent
 * in ways an outside caller would get wrong. These interfaces are a contract
 * instead — plain, frozen, additive-only — so the internal model stays free to
 * move. See API.md for the consumer-facing documentation.
 */

/**
 * Which drawing a callout uses.
 *
 * `pack` is left as a plain string rather than a union on purpose: new icon
 * packs are added over time, and a consumer that pinned an exhaustive union
 * would stop compiling the day one appears. Current values are `lucide`,
 * `tabler-outline`, `tabler-filled`, `material`, `emoji`, `octicons`,
 * `fa-solid`, `fa-regular`, `fa-brands`, `rpg-awesome` and `image`.
 *
 * Only `lucide` names are resolvable by an outside plugin (Obsidian's own
 * `setIcon` draws them). Everything else needs artwork Callout Studio keeps to
 * itself, so treat this as a label, not something you can always render.
 */
export interface CalloutIconInfo {
	/** Icon pack the drawing comes from. */
	readonly pack: string;
	/**
	 * Name of the drawing inside the pack. For `pack: "emoji"` this is the emoji
	 * itself; for `pack: "image"` it is an opaque id for a picture the user
	 * imported, which is not resolvable outside the plugin.
	 */
	readonly name: string;
	/** Material Symbols style — `outlined`, `filled`, `rounded` or `sharp`. */
	readonly style?: string;
	/** Material Symbols weight, 100–700. */
	readonly weight?: number;
}

/**
 * A callout type, reduced to what a consumer needs in order to offer it to the
 * user and write it into a note.
 */
export interface Callout {
	/**
	 * The id as written inside `[!…]`. May contain spaces — Obsidian renders
	 * `[!my callout]` and `[!my-callout]` to the same `data-callout="my-callout"`,
	 * and Callout Studio resolves both spellings.
	 */
	readonly id: string;
	/** Human-readable name, e.g. `Warning`. Never empty. */
	readonly title: string;
	/** Other ids that resolve to this same callout. Possibly empty. */
	readonly aliases: readonly string[];
}

/**
 * Everything Callout Studio knows about a callout, for consumers that draw it
 * themselves rather than only naming it.
 */
export interface CalloutDetails extends Callout {
	/** Accent colour for the theme mode currently on screen, as `#rrggbb`. */
	readonly color: string;
	/** Accent colour used in light mode, as `#rrggbb`. */
	readonly colorLight: string;
	/** Accent colour used in dark mode, as `#rrggbb`. */
	readonly colorDark: string;
	/**
	 * Authored background colour, when the user set one. Absent means the
	 * callout uses Obsidian's own translucent tint of the accent. Note that
	 * Callout Studio always paints backgrounds as translucent tints, so this is
	 * the colour that was authored, not the colour that lands on the page.
	 */
	readonly bgColorLight?: string;
	readonly bgColorDark?: string;
	/** Authored title/body text colour, when the user set one. */
	readonly textColorLight?: string;
	readonly textColorDark?: string;
	readonly icon: CalloutIconInfo;
	/**
	 * True when the user set this callout to render with no icon at all. Check
	 * it before drawing `icon`: that field still names the drawing the callout
	 * would use, deliberately, so the choice can be undone — but Callout Studio
	 * paints nothing for it, and a consumer that ignores this will not match.
	 */
	readonly hideIcon: boolean;
	/** Whether the callout renders with a fold arrow. */
	readonly foldable: boolean;
	/** Whether a foldable callout starts collapsed. Meaningless when not foldable. */
	readonly defaultFolded: boolean;
	/** True for one of Obsidian's own callout types. */
	readonly builtIn: boolean;
	/**
	 * Where the callout came from: `builtin` is one of Obsidian's defaults,
	 * `user` was created or customized by the user, `fallback` was added by a
	 * manual scan and follows the fallback style. `theme` is a legacy source;
	 * `plugin` identifies other plugin-provided definitions.
	 */
	readonly source: "builtin" | "user" | "fallback" | "theme" | "plugin";
	/**
	 * True when Callout Studio emits no styling for this callout, so the colours
	 * above are what was stored rather than what renders. The id is still
	 * perfectly valid to write into a note.
	 *
	 * Two different situations resolve to `true` and this member cannot tell
	 * them apart, which is why {@link themeStyled} exists: the active theme
	 * supplies the callout, or the user styles it in their own CSS. Kept with
	 * its original meaning because it shipped first — consumers written against
	 * it must keep working.
	 */
	readonly externalStyle: boolean;
	/**
	 * True when the **active theme** is what supplies and styles this callout.
	 * Derived from the theme's own stylesheet, so it changes when the user
	 * changes theme, and no field on the stored definition records it.
	 *
	 * The narrower half of {@link externalStyle}: `themeStyled` implies
	 * `externalStyle`, and the difference between them is a callout the user
	 * has handed to their own CSS snippet.
	 *
	 * Added after `externalStyle`, so feature-detect it before relying on it.
	 */
	readonly themeStyled: boolean;
}

/**
 * The object at `app.plugins.plugins["callout-studio"].api`.
 *
 * Read-only by design. Everything it returns is a frozen copy, so holding onto
 * a result is safe and mutating one cannot corrupt the plugin.
 */
export interface CalloutStudioApi {
	/**
	 * API contract version, currently `1`. Bumped only for a breaking change;
	 * new members are added without bumping it, so feature-detect those with
	 * `typeof api.thing === "function"`.
	 */
	readonly version: number;

	/** Every callout the user can currently write, sorted by title. */
	getCallouts(): readonly Callout[];

	/** {@link getCallouts} with colours, icon and fold behaviour attached. */
	getCalloutsDetailed(): readonly CalloutDetails[];

	/**
	 * Look up one callout by id or alias. Case-insensitive, and it accepts the
	 * dashed spelling Obsidian writes into `data-callout` as well as any
	 * `|metadata` suffix. Returns `undefined` when nothing matches.
	 */
	getCallout(id: string): Callout | undefined;

	/**
	 * Run `callback` whenever any callout is added, removed or edited. It
	 * receives no arguments — re-read the list.
	 *
	 * A hint, not a precise event: a colour tweak fires it just as a rename
	 * does, and one user action can fire it more than once (editing the callout
	 * that discovered rows mirror notifies for the edit and again for the rows
	 * it restyled). Diff against what you last saw if reacting is expensive.
	 *
	 * Returns a function that removes the listener. Subscriptions are not
	 * cleaned up automatically, so call it from your plugin's `onunload`.
	 */
	onChange(callback: () => void): () => void;
}
