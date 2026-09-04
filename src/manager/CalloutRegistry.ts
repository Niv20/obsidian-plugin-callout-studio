/**
 * manager/CalloutRegistry.ts — Central in-memory store for all callout definitions.
 *
 * Holds the live Map of CalloutDefinitions (built-in defaults + user overrides +
 * auto-discovered fallbacks), exposes CRUD operations, handles data migration
 * from older saved formats, and fires onChange callbacks when the store mutates.
 * This is the single source of truth read by CSSInjector, AutoComplete,
 * SettingsTab, and the public API.
 */
import type {
	CalloutDefinition,
	IconPackId,
	IconSvgCacheEntry,
	PluginData,
	PluginSettings,
	UserImageIcon,
} from "../types";
import { CALLOUT_RENDER_ROLES } from "../types";
import { persistedIconSvgCache } from "./iconSvgCacheOrder";
import {
	collectForeignFields,
	NO_FOREIGN_FIELDS,
	withForeignSettings,
	type ForeignFields,
} from "./foreignFields";
import {
	CURRENT_DATA_VERSION,
	DEFAULT_CALLOUTS,
	DEFAULT_SETTINGS,
	FALLBACK_ICON,
	RESERVED_DEMO_IDS,
} from "../constants";
import { iconCacheKey, packFor } from "../icons/registry";
import { migrateSavedIcons } from "./iconMigrations";
import {
	isEphemeralDiscoveredRow,
	selectPersistedRows,
} from "./discoveredRowPersistence";
import { COLOUR_NEUTRAL_FIELDS, isCalloutModified } from "./calloutCompare";
import { migrateStyleModes } from "./styleModeMigration";
import { reconcileIdCollisions } from "./idCollisionMigration";
import {
	findAttrIdConflict,
	vaultIdFormsFor,
} from "./calloutIdForms";
import { ThemeFacts } from "./theme/ThemeFacts";
import type { ThemeAppearance } from "./theme/themeAppearance";
import { mirroredFallbackRow } from "./discoveredRow";
import type {
	CalloutManagerEntry,
	CalloutManagerPlanItem,
} from "../utils/calloutManagerImport";
import type { AdmonitionPlan } from "../utils/admonitionImport";
import {
	normalizeCalloutId,
	calloutIdentity,
	obsidianDefaultTitle,
} from "../utils/calloutId";
import {
	consolidatePalettesByColor,
	getAllColorPalettes,
	resolveCalloutManagerColor,
	resolveCalloutManagerColors,
} from "../utils/colorPalettes";
import { bgGradientsEqual, derivedBgAmount } from "../utils/colorUtils";
import { notifyListeners } from "./listenerList";
import { reconcileSavedRow } from "./savedCalloutRows";
import { mergeSavedSettings } from "../utils/settingsMerge";
import { setUserImages } from "../icons/packs/userImages";
import { sortCalloutsByDisplayName } from "../utils/sorting";

/**
 * Stamped into `data.json` for provenance. Migrations deliberately key on
 * whether a field is present rather than on this number — an imported or
 * hand-edited file can carry any version it likes, and a load that trusted the
 * stamp would skip work the data actually needs.
 *
 * 3: `materialSvgCache` → `iconSvgCache` (generic across icon packs).
 */
const SORTED_DEFAULT_CALLOUTS = sortCalloutsByDisplayName(DEFAULT_CALLOUTS);

/** Identifier stamped into v2 export files so the importer can recognize them. */
export const EXPORT_FORMAT_ID = "callout-studio";
export const EXPORT_FORMAT_VERSION = 2;

export type RegistryChangeCallback = () => void;

/**
 * Re-stamps a transient preview definition with the identity of the real
 * callout it shadows: *which* callout this entry is, as opposed to how it
 * currently looks.
 *
 * The settings editor builds its preview from form state alone
 * (`CalloutEditor.buildPreviewDefinition`), so it fabricates the ownership
 * fields — always `builtIn: false`, `source: "user"`, no aliases. Those values
 * are right for a brand-new draft (which shadows nothing) but wrong the moment
 * the preview stands in for an existing callout in the map: the settings lists
 * partition on `builtIn`, so a built-in row would re-home itself into "My
 * callout types" for as long as its editor is open, the row would drop its
 * alias badges and its fallback tag, and the CSS pipeline would stop emitting
 * rules for the aliases — un-styling open notes mid-edit.
 *
 * Everything the user is actively editing — display name, icon, colors,
 * gradient, fold and offset settings — still comes from the preview, so the
 * row and the rendered callout keep tracking the edit live.
 */
function withIdentityOf(
	real: CalloutDefinition,
	preview: CalloutDefinition,
): CalloutDefinition {
	return {
		...preview,
		builtIn: real.builtIn,
		source: real.source,
		customized: real.customized,
		aliases: real.aliases,
		metadata: real.metadata,
	};
}

export class CalloutRegistry {
	private callouts: Map<string, CalloutDefinition> = new Map();
	private builtInDefaults: Map<string, CalloutDefinition> = new Map();
	private changeCallbacks: RegistryChangeCallback[] = [];
	/** Nesting depth of {@link batch}; > 0 means notifications are held. */
	private batchDepth = 0;
	/** Whether anything mutated while the batch above was open. */
	private batchDirty = false;
	/**
	 * Listeners for transient live-preview changes — a separate list from
	 * {@link changeCallbacks} precisely because a preview is NOT a mutation:
	 * it must never reach `saveSettings()` or force open notes to re-render.
	 * See {@link onPreviewChange}.
	 */
	private previewChangeCallbacks: RegistryChangeCallback[] = [];
	settings: PluginSettings;
	iconSvgCache: IconSvgCacheEntry[] = [];

	/**
	 * The callout ID currently occupied by the transient settings-preview
	 * definition (see {@link setPreviewDefinition}), or null when no preview is
	 * active. The preview registers under the *real* ID being edited so the live
	 * preview renders `> [!<real-id>]` with the in-progress style.
	 */
	private previewActiveId: string | null = null;
	/**
	 * When the preview ID collides with an existing real callout (editing an
	 * existing type), the original definition we shadowed — restored when the
	 * preview clears so the real callout is never lost.
	 */
	private previewShadowedDef: CalloutDefinition | null = null;
	/**
	 * True when the active preview is a *demo* placeholder — the palette editor,
	 * the per-role global-style popups, or a brand-new unnamed callout draft —
	 * rather than the in-progress edit of a real, existing callout. A demo must
	 * never affect the settings lists: it neither adds a phantom row nor hides a
	 * real callout it happens to overlay. Every demo takes a reserved id for
	 * that reason — the flag is not enough on its own, since `getAll()` (and so
	 * the CSS the injector generates) never consults it, meaning a demo sharing
	 * an id with a real callout restyles it vault-wide while the modal is open.
	 * See {@link definitionsForLists}.
	 */
	private previewIsDemo = false;

	/**
	 * Set when a {@link load} migration rewrote the stored definitions, so the
	 * result gets written back once instead of riding on the next incidental
	 * save. Read (and cleared) through {@link needsSaveAfterLoad}.
	 */
	private pendingLoadMigrationSave = false;
	/** Palette merges from the last load, awaiting {@link takePaletteMerges}. */
	private pendingPaletteMerges: Array<{ from: string; to: string }> = [];
	/** What a newer build wrote and this one must hand back — see foreignFields. */
	private foreign: ForeignFields = NO_FOREIGN_FIELDS;

	constructor() {
		this.settings = structuredClone(DEFAULT_SETTINGS);
		this.syncUserImages();
		for (const def of SORTED_DEFAULT_CALLOUTS) {
			this.builtInDefaults.set(def.id, structuredClone(def));
		}
	}

	/**
	 * The only place `this.callouts` is written — a fresh default, merged/saved
	 * data, an import or a live edit all land here.
	 *
	 * It deliberately does **not** touch the icon on the way through. v2.7.0 had
	 * it rewrite every bare Lucide value to the `lucide-` spelling so the two
	 * things that compare icons by string equality (the picker's selection
	 * match, `isCalloutModified`) would stop seeing one icon as two — but that
	 * prefix is a lookup instruction to Obsidian, not a synonym, and forcing it
	 * onto ids that are not core Lucide unnamed them entirely. See
	 * `icons/lucideId.ts`. Those two comparisons normalize themselves now; the
	 * stored value stays exactly as `getIconIds()` spelled it.
	 */
	private setCallout(id: string, def: CalloutDefinition): void {
		this.callouts.set(id, def);
	}

	load(data: Partial<PluginData> | null): void {
		this.callouts.clear();
		this.pendingLoadMigrationSave = false;
		this.pendingPaletteMerges = [];
		// Before the early return below, so a load of nothing clears it too.
		this.foreign = collectForeignFields(data);

		// Always start with built-in defaults
		for (const def of SORTED_DEFAULT_CALLOUTS) {
			this.setCallout(def.id, structuredClone(def));
		}

		if (!data) return;

		// Merge saved callouts (user overrides and custom callouts), each read
		// against the shipped defaults by `reconcileSavedRow` — which is where
		// the two flag repairs and their reasoning live.
		if (data.callouts) {
			for (const saved of data.callouts) {
				// Whether this id HAS a built-in is asked of the shipped
				// defaults, not of `this.callouts` — the map would also answer
				// yes for a user row added by an earlier turn of this loop.
				const seeded = this.builtInDefaults.has(saved.id)
					? this.callouts.get(saved.id)
					: undefined;
				const { def, repaired } = reconcileSavedRow(saved, seeded);
				this.setCallout(saved.id, def);
				// A repaired row is written back like the other load migrations:
				// through the built-in gate when it was reclaimed (so not at all
				// when it matches the default) or the user gate when it was
				// demoted, either way so the file stops carrying the broken shape.
				if (repaired) this.pendingLoadMigrationSave = true;
			}
		}

		// Merge settings (field-by-field against defaults; see mergeSavedSettings)
		if (data.settings) {
			this.settings = mergeSavedSettings(data.settings);
			this.syncUserImages();
		}

		// Retire the fields of the removed manual style-mode model. Ownership is
		// derived from the active theme now. See manager/styleModeMigration.
		if (migrateStyleModes(this.callouts, this.settings, data)) {
			this.pendingLoadMigrationSave = true;
		}

		// Restore cached artwork for the icons the vault actually uses.
		if (data.iconSvgCache) {
			this.iconSvgCache = data.iconSvgCache;
		}
		// Repair the icon fields of saved rows — see manager/iconMigrations.ts
		// for the four passes and why they ask for a flush.
		if (
			migrateSavedIcons(
				{
					callouts: this.callouts,
					userImages: this.settings.userImages,
					addIconSvg: (entry) => this.addIconSvg(entry),
				},
				data.materialSvgCache,
			)
		) {
			this.pendingLoadMigrationSave = true;
		}
		// Before the palette matching below: that test compares transparency
		// first, so it has to run against the repaired truth rather than against
		// a flag this pass is about to delete.
		this.dropStaleTransparencyFlags();
		// Migration: a vault may not hold two saved palettes with identical
		// colors. Runs BEFORE the adoption pass below so `isLivePaletteId` there
		// is asked about an already-consolidated list, and a callout that linked
		// to a merged-away duplicate arrives already re-pointed rather than
		// looking like an orphan to be re-matched.
		this.pendingPaletteMerges = this.consolidateDuplicatePalettes();
		if (this.pendingPaletteMerges.length > 0) {
			this.pendingLoadMigrationSave = true;
		}
		// Migration: link any callout saved before `paletteId` existed but whose
		// baked colors still exactly match a saved custom palette, so an edit to
		// that palette (applyPaletteColors) cascades onto it too. Stamping a
		// `paletteId` onto a row is a rewrite of the stored definitions like any
		// other, so it flushes; un-flushed the adoption was simply re-derived on
		// every launch. The flag is raised here rather than inside the pass
		// because the settings caller (CustomPalettesSection) saves for itself.
		if (this.adoptOrphansMatchingPalettes() > 0) {
			this.pendingLoadMigrationSave = true;
		}
		this.dropDerivedBackgrounds();
		this.dropSolidBackgroundFlags();
		// Before reconcileIdCollisions: a row this pass renames back to its
		// base ID has to go through the dash/space reconcile like any other.
		this.stripMetadataFromIds();
		// Last: every pass above can rename a row onto an id another row
		// already answers to, so the collision fold has to see the final map.
		this.reconcileIdCollisions();
	}

	/**
	 * Migration: drop backgrounds the plugin derived rather than the user chose.
	 *
	 * Obsidian gives nested callouts their stacked look purely by compositing —
	 * every `.callout` paints a ~10% tint of its own accent, so each level lays
	 * another translucent layer over the one beneath it. A callout carrying an
	 * OPAQUE `bgColorLight`/`bgColorDark` hides everything behind it, and under
	 * core's `mix-blend-mode: darken` a colour over itself is `min(x, x) = x` —
	 * so nesting two of them produces a step of exactly zero. Vaults filled up
	 * with such rows without anyone asking: opening the editor on a callout
	 * materialized `bgTintFor(accent, mode)` into the form, saving wrote it back
	 * whatever the user had actually come to change, and
	 * {@link restyleUncustomizedFallbackRows} then copied it onto every
	 * auto-discovered row. Both halves are fixed at the source; this retires
	 * what they already wrote.
	 *
	 * A background is dropped only when {@link derivedBgAmount} can show it IS
	 * the accent at some tint strength, in BOTH modes — such a value carries no
	 * information the accent doesn't already carry, so losing it changes only
	 * what shows through the callout. Anything else was picked by hand or by a
	 * palette and is kept; `CSSInjector` re-expresses those as a translucent
	 * tint of the same rendered colour, so they nest too without being altered.
	 *
	 * Keyed on the definitions' content rather than on `data.version`, like the
	 * other migrations here, which also makes it idempotent: a dropped
	 * background cannot be re-derived into existence on the next load.
	 */
	private dropDerivedBackgrounds(): void {
		let changed = 0;
		for (const def of this.callouts.values()) {
			const { bgColorLight, bgColorDark } = def;
			if (!bgColorLight || !bgColorDark) continue;
			// A gradient is authored, never derived, and its start colour is the
			// stop the sweep runs from — removing it would delete the gradient.
			if (def.bgGradient) continue;
			if (derivedBgAmount(def.colorLight, bgColorLight, false) === null) {
				continue;
			}
			if (derivedBgAmount(def.colorDark, bgColorDark, true) === null) {
				continue;
			}
			delete def.bgColorLight;
			delete def.bgColorDark;
			changed++;
		}
		if (changed > 0) this.pendingLoadMigrationSave = true;
	}

	/**
	 * Migration: retire a transparency flag left standing beside a background.
	 *
	 * The two cannot legitimately coexist. Every writer that turns a callout
	 * transparent drops its background in the same breath — `performCalloutEditorSave`
	 * gates the hexes behind `hasAuthoredBackground`, which is false under
	 * transparency, and `bakePaletteColors` returns the flag alone. So a row
	 * carrying both is not an odd preference; it is damage.
	 *
	 * Which half to believe follows from how the damage happened. Both writers
	 * reach the map through `update()`, which merges (`{ ...existing, ...partial }`),
	 * and the background fields are always spelled out — `undefined` included —
	 * while `transparentBg` used to be spread in conditionally and so was simply
	 * absent whenever it was off. An absent key overrides nothing. Transparency
	 * was therefore a one-way door: the backgrounds beside it went on updating
	 * while the flag itself could never be switched back off. A background
	 * sitting next to the flag is thus proof of a later, deliberate,
	 * non-transparent write — it is the newer intent, and the flag is the stale
	 * one. Hence the flag goes, not the colours.
	 *
	 * `CSSInjector` checks the flag before it looks at any background
	 * (`generateCalloutCSS`), so until this runs such a callout renders with no
	 * background at all while the settings swatch — which reads the hexes —
	 * draws them. One definition, two answers, depending on who is asking.
	 *
	 * The writers are fixed at the source (that conditional spread is gone, and
	 * {@link restyleUncustomizedFallbackRows} now mirrors the flag along with
	 * the colours it always copied). This retires what they already wrote.
	 *
	 * Keyed on content rather than on `data.version`, like the migrations around
	 * it, which also makes it idempotent: once the flag is gone there is nothing
	 * left to contradict.
	 */
	private dropStaleTransparencyFlags(): void {
		let changed = 0;
		for (const def of this.callouts.values()) {
			if (def.transparentBg !== true) continue;
			if (
				def.bgColorLight === undefined &&
				def.bgColorDark === undefined &&
				def.bgGradient === undefined
			) {
				continue;
			}
			delete def.transparentBg;
			changed++;
		}
		if (changed > 0) this.pendingLoadMigrationSave = true;
	}

	/**
	 * Migration: retire the `solidBackground` opt-out.
	 *
	 * It painted one callout's background as the authored hex rather than as the
	 * translucent tint that renders as that same hex (see `CSSInjector.bgProps`)
	 * — which is precisely what flattens nesting: an opaque layer hides what is
	 * behind it, and under core's `mix-blend-mode: darken` a colour over itself
	 * steps by exactly zero. Every background is a tint now, so nothing reads the
	 * flag; deleting it is only so a key no code understands stops being
	 * re-written by `toSaveData()` and copied into every new export (the same
	 * reason `mergeHeadingStyle` drops `paddingStart`).
	 *
	 * The cast is the point: the field is gone from `CalloutDefinition`, and this
	 * is the one place still allowed to name it.
	 */
	private dropSolidBackgroundFlags(): void {
		let changed = 0;
		for (const def of this.callouts.values()) {
			const legacy = def as { solidBackground?: boolean };
			if (legacy.solidBackground === undefined) continue;
			delete legacy.solidBackground;
			changed++;
		}
		if (changed > 0) this.pendingLoadMigrationSave = true;
	}

	/**
	 * Migration: retire definitions whose ID carries Obsidian callout metadata.
	 *
	 * Everything after the first `|` in `[!note|purple]` is metadata, not part
	 * of the type (see splitCalloutMetadata). Before that was understood here,
	 * discovery read the whole bracket body as an ID and auto-created a separate
	 * `fallback` row for every metadata value a vault used — `note|green`,
	 * `note|purple`, `note|yellow` alongside the real `note`. Those rows also
	 * styled nothing where it mattered: their selector is
	 * `.callout[data-callout="note|green"]`, and Obsidian writes `note`.
	 *
	 * A row is renamed to its base ID when that ID is free, so a genuinely
	 * customized one keeps its icon and colors and starts matching the callout
	 * it always named. When the base is taken — the common case, since the base
	 * is usually a built-in — the row is dropped: it can no longer be reached by
	 * any spelling, and merging it into the survivor would silently restyle a
	 * callout the user never asked to change. Renaming is safe precisely because
	 * the retired spelling was never a real callout ID: Obsidian split the pipe
	 * off long before this plugin saw the token, so no note can contain a
	 * `[!note|green]` that meant anything other than `note`.
	 *
	 * **Only the piped ID is retired.** Opening such a row in a pre-metadata
	 * editor could also leave the pipe-eaten spelling `notegreen` behind, and an
	 * earlier draft of this migration retired that too — by matching an ID that
	 * equalled the old sanitizer's reading of its own display name. That test
	 * has no false negatives and plenty of false positives: the old editor
	 * *pinned* the ID to the display name, so every user callout ever named with
	 * a pipe (`Pros|Cons` → `proscons`) matched it by construction and would
	 * have been renamed to `pros` — silently breaking every `[!proscons]`
	 * already written in the vault. Unlike the piped spelling, `notegreen` IS a
	 * reachable ID, so it is left alone; an uncustomized one is already swept up
	 * by {@link CalloutDiscovery.pruneUnused}, and a customized one is the
	 * user's to delete.
	 *
	 * Keyed on the definitions' content rather than on `data.version`, like the
	 * other migrations in {@link load}: an imported or hand-edited file can
	 * carry any version it likes, and this way the pass is idempotent.
	 */
	private stripMetadataFromIds(): void {
		const removed: string[] = [];
		const renamed: string[] = [];
		let aliasesChanged = false;

		for (const def of Array.from(this.callouts.values())) {
			// Aliases first, so a row that survives on its ID is clean too.
			if (def.aliases?.some((a) => a.includes("|"))) {
				const seen = new Set<string>();
				const before = def.aliases;
				def.aliases = def.aliases
					.map((a) => normalizeCalloutId(a))
					.filter((a) => {
						if (!a || a === def.id || seen.has(a)) return false;
						// A base an ALREADY-existing row owns is not ours to claim.
						if (this.callouts.has(a)) return false;
						seen.add(a);
						return true;
					});
				// Rewriting aliases is a rewrite of the stored definitions like
				// any other, so it has to flush too. Missing this left an
				// alias-only cleanup redone on every load and never written back
				// — the exact failure needsSaveAfterLoad exists to prevent.
				if (
					def.aliases.length !== before.length ||
					def.aliases.some((a, i) => a !== before[i])
				) {
					aliasesChanged = true;
				}
			}

			// Built-ins ship without metadata; never risk dropping one.
			if (def.builtIn) continue;
			if (!def.id.includes("|")) continue;
			// normalizeCalloutId truncates at the first pipe, so this can never
			// come back equal to an ID that contains one.
			const base = normalizeCalloutId(def.id);

			this.callouts.delete(def.id);
			// An empty base (`[!|purple]` named nothing at all) has nowhere to go.
			if (!base || this.callouts.has(base)) {
				removed.push(def.id);
				this.releaseFallbackTarget(def.id, null);
				continue;
			}
			renamed.push(`${def.id} → ${base}`);
			this.setCallout(base, {
				...def,
				id: base,
				// The display name carried the metadata too — a discovery row for
				// `[!custom|meta]` was named "Custom|meta". Left alone it would
				// still read that way in the settings list AND on screen, since
				// the heading callout and inline callout are painted from displayName.
				// Re-derive it the way discovery would have for the base id.
				displayName: def.displayName.includes("|")
					? obsidianDefaultTitle(base)
					: def.displayName,
			});
			this.releaseFallbackTarget(def.id, base);
		}

		if (removed.length === 0 && renamed.length === 0 && !aliasesChanged) {
			return;
		}
		this.pendingLoadMigrationSave = true;
		if (removed.length > 0 || renamed.length > 0) {
			console.debug("[CalloutStudio] callout metadata migration:", {
				removed,
				renamed,
			});
		}
	}

	/**
	 * Re-point `settings.fallbackCalloutId` when the migration retires the row
	 * it names — to `replacement` if the row was renamed, or to the default when
	 * it is gone for good.
	 *
	 * {@link remove} does this for every other deletion path; the migration
	 * deletes straight off the map, so it has to do the same by hand. A dangling
	 * value is not inert: `generateFallbackCSS` bails when the id resolves to
	 * nothing, and every unrecognized callout in the vault silently loses its
	 * colour, icon and background.
	 */
	private releaseFallbackTarget(
		retiredId: string,
		replacement: string | null,
	): void {
		if (this.settings.fallbackCalloutId !== retiredId) return;
		this.settings.fallbackCalloutId =
			replacement ?? DEFAULT_SETTINGS.fallbackCalloutId;
	}

	/**
	 * True when {@link load} rewrote the stored definitions and the result has
	 * not been written back yet. `main.ts` flushes it with a single save right
	 * after loading, so a cleaned-up list survives the next reload instead of
	 * waiting for whatever incidental save happens to come first.
	 */
	needsSaveAfterLoad(): boolean {
		const pending = this.pendingLoadMigrationSave;
		this.pendingLoadMigrationSave = false;
		return pending;
	}

	/**
	 * Migration: fold rows that are one callout in two spellings.
	 * `manager/idCollisionMigration.ts` owns the merge rule and the reasoning.
	 */
	private reconcileIdCollisions(): void {
		const { merged } = reconcileIdCollisions(
			this.callouts,
			this.settings,
			DEFAULT_SETTINGS.fallbackCalloutId,
		);
		if (merged.length === 0) return;
		this.pendingLoadMigrationSave = true;
		console.debug("[CalloutStudio] callout id collision migration:", {
			merged,
		});
	}

	toSaveData(): PluginData {
		return {
			// First, so nothing a foreign build wrote can shadow a field this
			// one owns. @see manager/foreignFields.ts
			...this.foreign.data,
			version: CURRENT_DATA_VERSION,
			// Which rows the file may hold, and why an unclaimed discovered one
			// may not — see manager/discoveredRowPersistence.ts.
			callouts: selectPersistedRows(this.callouts, {
				previewActiveId: this.previewActiveId,
				previewShadowedDef: this.previewShadowedDef,
				customCommands: this.settings.customCommands,
				builtInDefault: (id) => this.builtInDefaults.get(id),
			}),
			settings: withForeignSettings(this.settings, this.foreign),
			// `materialSvgCache` is deliberately not written back: the legacy
			// entries were folded into `iconSvgCache` on load, and writing both
			// would let them drift apart. Downgrading to a pre-2.4 build simply
			// re-downloads the Material SVGs.
			iconSvgCache: persistedIconSvgCache(this.iconSvgCache),
		};
	}

	add(def: CalloutDefinition): boolean {
		if (this.callouts.has(def.id)) {
			return false;
		}
		// Check if this ID is already an alias of another callout
		if (this.findByAlias(def.id)) {
			return false;
		}
		// The same question one spelling further out. Obsidian renders `a b` and
		// `a-b` as one callout, so a row for the second spelling could only ever
		// fight the first over a single CSS rule, split its usage count and show
		// up twice in every list.
		//
		// Asked HERE rather than only at the call sites, which is the whole fix:
		// the editor, discovery and the theme sweep each pre-checked and the JSON
		// backup importer did not, so a duplicate row reached `data.json` through
		// the one caller that forgot. A guard at the seam cannot be forgotten.
		// See manager/calloutIdForms.ts for the arithmetic.
		if (this.findAttrIdConflict(def.id, null)) return false;
		// Check if any of this callout's aliases conflict with existing IDs or aliases
		for (const alias of def.aliases ?? []) {
			if (this.callouts.has(alias)) return false;
			if (this.findByAlias(alias)) return false;
			// `def` is not on the map yet, so `excludeId` cannot match it; it is
			// passed to say which row the alias belongs to, not to skip a check.
			if (this.findAttrIdConflict(alias, def.id)) return false;
		}
		this.setCallout(def.id, def);
		this.notifyChange();
		return true;
	}

	update(id: string, partial: Partial<CalloutDefinition>): boolean {
		const existing = this.callouts.get(id);
		if (!existing) return false;

		const newId = partial.id && partial.id !== id ? partial.id : id;

		// If the id is being changed, remove old and re-add
		if (partial.id && partial.id !== id) {
			if (this.callouts.has(partial.id)) return false;
			// An id another definition already answers to is taken, whether it
			// owns it outright or as an alias — {@link add} refuses both, and a
			// rename that refused only the first left one raw id resolving
			// through two definitions (`[!summary]` reaching the new row here
			// and the built-in `abstract` through its alias). Skipping the row
			// being renamed is what still lets it take one of its own aliases.
			const aliasOwner = this.findByAlias(partial.id);
			if (aliasOwner && aliasOwner.id !== id) return false;
			// And the dash/space identity rule {@link add} enforces: a rename is
			// just as able to create the second spelling as a create is.
			// `excludeId` is what still lets a row rename onto one of its own
			// aliases.
			if (this.findAttrIdConflict(partial.id, id)) return false;
		}

		// Batched because the mirror pass below announces itself: see the note
		// on {@link mirrorFallbackRowsFor}.
		this.batch(() => {
			if (partial.id && partial.id !== id) {
				this.callouts.delete(id);
				this.setCallout(partial.id, { ...existing, ...partial });
			} else {
				this.setCallout(id, { ...existing, ...partial });
			}

			// If the user just edited the active fallback callout's appearance,
			// re-mirror it onto every uncustomized fallback-source row so the
			// change is visible immediately in settings and in the vault.
			this.mirrorFallbackRowsFor(newId);
			this.notifyChange();
		});
		return true;
	}

	/**
	 * Re-mirror the uncustomized fallback rows when `id` is the callout they
	 * copy — the shared half of the four writers that can move that target.
	 *
	 * Its callers all wrap this and their own `notifyChange` in a {@link batch},
	 * because {@link restyleUncustomizedFallbackRows} announces itself: one
	 * logical operation — one edit, one delete, one palette repaint — otherwise
	 * fired two full rounds, and a round is a whole stylesheet regenerated,
	 * every icon in the document repainted and `data.json` written. The batch is
	 * what makes the pair a single consistent event, exactly as it does for the
	 * rename's remove + add in `CalloutEditorSave`.
	 */
	private mirrorFallbackRowsFor(id: string): void {
		if (id !== this.settings.fallbackCalloutId) return;
		this.restyleUncustomizedFallbackRows();
	}

	remove(id: string): boolean {
		const def = this.callouts.get(id);
		if (!def || def.builtIn) return false;
		this.batch(() => {
			this.callouts.delete(id);
			// If the removed callout was the active fallback, reset to "note"
			// and re-mirror uncustomized fallback rows onto the new fallback.
			if (this.settings.fallbackCalloutId === id) {
				this.settings.fallbackCalloutId =
					DEFAULT_SETTINGS.fallbackCalloutId;
				this.restyleUncustomizedFallbackRows();
			}
			this.notifyChange();
		});
		return true;
	}

	/**
	 * Re-style every uncustomized `source: "fallback"` row to mirror the current
	 * fallback callout. Called whenever the fallback selection changes (the
	 * settings dropdown, or implicitly when the active fallback row is deleted)
	 * or when the fallback callout itself is edited. `mirroredFallbackRow`
	 * (`./discoveredRow`) owns what "mirror" means; the skip list is this
	 * function's own, and every entry in it is a row somebody else owns.
	 *
	 * Returns the number of rows that actually changed, and notifies only then.
	 */
	restyleUncustomizedFallbackRows(): number {
		const fallbackId =
			this.settings.fallbackCalloutId ||
			DEFAULT_SETTINGS.fallbackCalloutId;
		const fallback = this.callouts.get(fallbackId);
		if (!fallback) return 0;
		let updated = 0;
		for (const def of this.callouts.values()) {
			if (def.builtIn) continue;
			if (def.source !== "fallback") continue;
			if (def.customized === true) continue;
			// Nothing reads this row's colours while the theme owns it, so
			// mirroring onto it would only churn data.json on every fallback
			// change and make the row look edited in an export.
			if (this.standsDown(def)) continue;
			if (def.id === fallbackId) continue;
			const next = mirroredFallbackRow(def, fallback);
			if (!next) continue;
			this.setCallout(def.id, next);
			updated++;
		}
		if (updated > 0) {
			this.notifyChange();
		}
		return updated;
	}

	/**
	 * Cascades an edited custom palette's colors onto every callout still
	 * linked to it (`paletteId` match), so a palette edit updates every
	 * callout using it instead of leaving them with a stale baked-in copy.
	 * If the active fallback callout is among them, also re-mirrors the
	 * uncustomized fallback rows that copy its appearance. Returns the
	 * number of callouts updated.
	 */
	applyPaletteColors(
		paletteId: string,
		colors: Pick<
			CalloutDefinition,
			| "colorLight"
			| "colorDark"
			| "bgColorLight"
			| "bgColorDark"
			// Callers pass bgGradient explicitly (possibly undefined) so the
			// spread below clears a stale value when the palette switched
			// background style.
			| "bgGradient"
			// Same contract, and for the same reason: a palette edited from the
			// "None" background style back to Solid must actually un-transparent
			// its callouts, which only an explicit undefined can do.
			| "transparentBg"
			| "textColorLight"
			| "textColorDark"
		>,
	): number {
		let updated = 0;
		// Batched for the same reason as the writers above: the mirror pass
		// announces itself, so a repaint that reaches the fallback target would
		// otherwise cost two rounds. See {@link mirrorFallbackRowsFor}.
		this.batch(() => {
			let touchedFallback = false;
			for (const def of this.callouts.values()) {
				if (def.paletteId !== paletteId) continue;
				this.setCallout(def.id, { ...def, ...colors });
				updated++;
				if (def.id === this.settings.fallbackCalloutId) {
					touchedFallback = true;
				}
			}
			if (touchedFallback) {
				this.restyleUncustomizedFallbackRows();
			}
			if (updated > 0) {
				this.notifyChange();
			}
		});
		return updated;
	}

	/**
	 * How many callouts still carry `paletteId`, optionally ignoring one.
	 *
	 * Used to tell the user how many *other* callouts a revive will regroup, so
	 * it counts committed callouts and nothing else — {@link realDefinitions}
	 * rather than the raw map. A number shown to the user must not include the
	 * callout editor's in-progress draft: a brand-new one is not a callout yet,
	 * and one shadowing a real row would be counted twice over if it and the row
	 * it stands in for disagreed about the link.
	 *
	 * It used to walk the raw map and claim a preview could not skew it. That
	 * held only because `CalloutEditor.buildPreviewDefinition` happens to build
	 * without a `paletteId`: nothing enforced it, and {@link withIdentityOf} —
	 * which does re-stamp the ownership fields — leaves the field alone.
	 *
	 * {@link relinkPalette} still walks the raw map, which it must: the preview
	 * slot holds the draft, and the shadowed original is restored over anything
	 * written there. That makes this the *committed* count, which is the one the
	 * user is being told.
	 */
	countPaletteLinks(
		paletteId: string,
		exceptCalloutId?: string | null,
	): number {
		let count = 0;
		for (const def of this.realDefinitions()) {
			if (def.paletteId !== paletteId) continue;
			if (exceptCalloutId != null && def.id === exceptCalloutId) continue;
			count++;
		}
		return count;
	}

	/**
	 * Re-points every callout linked to a now-deleted palette at its
	 * replacement, so reviving the palette from one member of the group
	 * regroups the rest — a later edit of that palette then cascades to all of
	 * them again instead of only the one that was reopened.
	 *
	 * Colours are deliberately NOT touched here. The link and the paint are two
	 * separate steps: the caller follows this with
	 * `applyPaletteColors(toPaletteId, …)`, which repaints exactly the rows this
	 * just re-stamped (and fires the single `notifyChange` for both). Baking
	 * colours in here would also silently overwrite a group member whose hexes
	 * the user had since edited by hand.
	 *
	 * Returns how many callouts were re-pointed.
	 */
	relinkPalette(
		fromPaletteId: string,
		toPaletteId: string,
		exceptCalloutId?: string | null,
	): number {
		if (fromPaletteId === toPaletteId) return 0;
		let updated = 0;
		for (const def of this.callouts.values()) {
			if (def.paletteId !== fromPaletteId) continue;
			if (exceptCalloutId != null && def.id === exceptCalloutId) continue;
			this.setCallout(def.id, { ...def, paletteId: toPaletteId });
			updated++;
		}
		return updated;
	}

	/**
	 * Whether a `paletteId` still names something that exists — a saved custom
	 * palette, or a built-in preset under its current or a legacy id.
	 *
	 * The preset half is not decoration. Preset ids ("blue", …) never appear in
	 * `customPalettes`, so without it a callout sitting on a live preset would
	 * look orphaned and be eligible for adoption by any custom palette whose
	 * hexes happen to match.
	 */
	private isLivePaletteId(id: string): boolean {
		return (
			this.settings.customPalettes.some((p) => p.id === id) ||
			getAllColorPalettes().some(
				(p) => p.id === id || p.legacyIds?.includes(id),
			)
		);
	}

	/**
	 * Links every callout whose baked colors exactly match a saved custom
	 * palette but whose `paletteId` names nothing, so a later edit of that
	 * palette cascades onto it too. Returns how many were adopted.
	 *
	 * Two populations reach this. Callouts saved before `paletteId` existed
	 * carry no link at all; callouts orphaned by a palette deletion keep the
	 * dangling id as their group marker (the editor no longer wipes it, so
	 * reviving from one member can regroup the rest). The guard skips only ids
	 * that still RESOLVE, not merely ids that are present — a `continue` on any
	 * truthy id would cost the second group the passive route home, where
	 * recreating the same colors as a new palette re-adopts them.
	 *
	 * Called from {@link load} and again whenever the user adds or edits a
	 * palette, so a matching group is picked up immediately instead of waiting
	 * for the next launch.
	 */
	adoptOrphansMatchingPalettes(): number {
		if (this.settings.customPalettes.length === 0) return 0;
		let adopted = 0;
		for (const def of this.callouts.values()) {
			if (def.paletteId && this.isLivePaletteId(def.paletteId)) continue;
			const match = this.settings.customPalettes.find(
				(p) =>
					// Both background axes have to agree, not just the six
					// hexes — and they matter more now that an orphan with a
					// dangling id reaches this loop at all. A "None" palette
					// keeps real background hexes beside its flag (they are
					// what a switch back to Solid restores), and a gradient
					// palette keeps them too, so on hexes alone a plain solid
					// callout matches all three variants of the same colour
					// and can be adopted by the wrong one. Same test the
					// editor's dropdown uses (`matchesPalette`).
					(p.transparentBg === true) ===
						(def.transparentBg === true) &&
					bgGradientsEqual(p.bgGradient, def.bgGradient) &&
					p.colorLight.toLowerCase() ===
						def.colorLight.toLowerCase() &&
					p.colorDark.toLowerCase() === def.colorDark.toLowerCase() &&
					p.bgColorLight.toLowerCase() ===
						(def.bgColorLight ?? "").toLowerCase() &&
					p.bgColorDark.toLowerCase() ===
						(def.bgColorDark ?? "").toLowerCase() &&
					p.textColorLight.toLowerCase() ===
						(def.textColorLight ?? "").toLowerCase() &&
					p.textColorDark.toLowerCase() ===
						(def.textColorDark ?? "").toLowerCase(),
			);
			if (!match) continue;
			this.setCallout(def.id, { ...def, paletteId: match.id });
			adopted++;
		}
		return adopted;
	}

	/**
	 * Enforces "no two saved palettes with identical colors" on the settings
	 * this registry holds, and re-points every callout that linked to a merged-
	 * away duplicate at the palette that absorbed it.
	 *
	 * The relink is the whole point. Dropping the duplicate alone would leave
	 * its callouts with a dangling `paletteId` and no route home, turning a
	 * tidy-up into silent data loss on any vault built before the rule existed.
	 * Colors are baked onto the callouts, so nothing changes appearance — what
	 * the user loses is the duplicate's *name*, which is why the returned pairs
	 * exist for the caller to say so out loud.
	 *
	 * Deliberately does not save or notify: {@link load} runs before either is
	 * meaningful, and the import path already does both once for the whole
	 * operation.
	 */
	consolidateDuplicatePalettes(): Array<{ from: string; to: string }> {
		const { palettes, remap, merged } = consolidatePalettesByColor(
			this.settings.customPalettes,
		);
		if (merged.length === 0) return [];
		this.settings.customPalettes = palettes;
		for (const [loserId, survivorId] of remap) {
			this.relinkPalette(loserId, survivorId);
		}
		return merged;
	}

	/**
	 * Palette merges performed by the last {@link load}, handed over exactly
	 * once so the caller can surface a notice and never repeat it on a later
	 * settings render.
	 */
	takePaletteMerges(): Array<{ from: string; to: string }> {
		const merges = this.pendingPaletteMerges;
		this.pendingPaletteMerges = [];
		return merges;
	}

	/**
	 * The groups of callouts left behind by deleted palettes: one entry per
	 * dangling `paletteId`, with a member to seed a replacement palette from.
	 *
	 * Every callout orphaned by one deletion carries the same dead id, so the
	 * id is what reconstitutes the group — the colors cannot, since a member the
	 * user has since restyled by hand would no longer match its siblings.
	 * `sample` is the first member in map order, which is stable across renders.
	 */
	listOrphanPaletteGroups(): Array<{
		paletteId: string;
		count: number;
		sample: CalloutDefinition;
	}> {
		const groups = new Map<
			string,
			{ paletteId: string; count: number; sample: CalloutDefinition }
		>();
		for (const def of this.callouts.values()) {
			const id = def.paletteId;
			if (!id || this.isLivePaletteId(id)) continue;
			const existing = groups.get(id);
			if (existing) {
				existing.count++;
				continue;
			}
			groups.set(id, { paletteId: id, count: 1, sample: def });
		}
		return [...groups.values()];
	}

	/**
	 * Re-attach a non-builtin callout to the global Default fallback so it
	 * mirrors the fallback's style going forward. Clears any sticky
	 * `customized` flag, flips `source` to `"fallback"`, then re-mirrors.
	 * Returns `true` when the row was converted.
	 */
	convertToFallback(id: string): boolean {
		const existing = this.callouts.get(id);
		if (!existing || existing.builtIn) return false;
		if (id === this.settings.fallbackCalloutId) return false;
		const next: CalloutDefinition = {
			...existing,
			source: "fallback",
		};
		delete next.customized;
		// Batched: the mirror pass announces itself, so the conversion and the
		// re-style are one round, not two. See {@link mirrorFallbackRowsFor}.
		this.batch(() => {
			this.setCallout(id, next);
			this.restyleUncustomizedFallbackRows();
			this.notifyChange();
		});
		return true;
	}

	/**
	 * Hand a callout to the user's own CSS, or take it back — the only writer of
	 * {@link CalloutDefinition.externalStyle}, and not a statement about the
	 * theme, which {@link themeOwns} derives and nobody sets.
	 *
	 * Writes `true` or **deletes** the key, never `false`: `isCalloutModified`
	 * compares `JSON.stringify(value ?? null)`, so an explicit falsy value would
	 * leave a built-in nobody edited reading as customized forever.
	 */
	setExternalStyle(id: string, external: boolean): boolean {
		const existing = this.callouts.get(id);
		if (!existing) return false;
		if ((existing.externalStyle === true) === external) return false;
		const next: CalloutDefinition = { ...existing };
		if (external) next.externalStyle = true;
		else delete next.externalStyle;
		this.setCallout(id, next);
		this.notifyChange();
		return true;
	}

	/** What the theme claims and draws. Derived, never stored: {@link ThemeFacts}. */
	private readonly themeFacts = new ThemeFacts();

	/**
	 * The two derived theme facts, published to {@link ThemeFacts}. Both
	 * announce a move like any other registry change — ownership decides who
	 * paints, and the probe's readings land *after* the settings tab drew its
	 * rows — and neither announces a no-op. Call the first inside `batch()`.
	 */
	setThemeOwnedIds(ids: ReadonlySet<string>): boolean {
		const moved = this.themeFacts.setOwnedIds(ids);
		if (moved) this.notifyChange();
		return moved;
	}

	setThemeAppearances(map: ReadonlyMap<string, ThemeAppearance>): boolean {
		const moved = this.themeFacts.setAppearances(map);
		if (moved) this.notifyChange();
		return moved;
	}

	/**
	 * Does the active theme supply or style this callout? The whole ownership
	 * model — **derived, never stored**; `ThemeFacts` argues why, and why a
	 * stored flip would quietly drop the row from the user's backups.
	 */
	themeOwns(def: CalloutDefinition): boolean {
		return this.themeFacts.owns(def, this.vaultIdFormsFor(def));
	}

	/** How the theme paints `def`. See {@link ThemeFacts.appearanceOf}. */
	themeAppearanceOf(def: CalloutDefinition): ThemeAppearance {
		return this.themeFacts.appearanceOf(this.vaultIdFormsFor(def));
	}

	/**
	 * True when this plugin emits no CSS at all for `def` — the one question
	 * every CSS path asks. Two quite different reasons land here, and emitters
	 * are right not to distinguish them: the theme owns the callout
	 * ({@link themeOwns}), or the user has handed this one to their own snippet
	 * ({@link setExternalStyle}). Callers deciding where a row is *listed*, or
	 * whether it is read-only, must ask `themeOwns` — an External CSS row is
	 * still the user's.
	 */
	standsDown(def: CalloutDefinition): boolean {
		return def.externalStyle === true || this.themeOwns(def);
	}

	isBuiltInModified(id: string): boolean {
		const current = this.callouts.get(id);
		const original = this.builtInDefaults.get(id);
		if (!current || !original) return false;
		return isCalloutModified(current, original);
	}

	/**
	 * True for a built-in still exactly as shipped — the one case where this
	 * plugin should not override Obsidian's `--callout-color` at all.
	 *
	 * `CSSInjector` reads this to decide whether to emit the accent as a hex or
	 * as a reference to core's own `--callout-*` variable. Leaving it alone is
	 * what makes an untouched `[!info]` render identically with the plugin on or
	 * off, and what lets a theme that redefines `--color-blue` reach it. The
	 * moment the user edits the callout it is theirs and the hex wins.
	 *
	 * Takes the definition rather than an ID so the caller cannot accidentally
	 * ask about a *different* row than the one it is emitting CSS for — the
	 * transient live-preview definition is registered under a real built-in's ID
	 * while holding unsaved colours, and answering for the stored row there
	 * would drop the very colours the preview exists to show.
	 *
	 * Deliberately a *narrower* question than {@link isBuiltInModified}: see
	 * `COLOUR_NEUTRAL_FIELDS` (`manager/calloutCompare.ts`) for the edits that
	 * are real edits without being a claim on the colour.
	 */
	isUnmodifiedBuiltIn(def: CalloutDefinition): boolean {
		if (!def.builtIn) return false;
		const original = this.builtInDefaults.get(def.id);
		if (!original) return false;
		return !isCalloutModified(def, original, COLOUR_NEUTRAL_FIELDS);
	}

	resetBuiltIn(id: string): boolean {
		const original = this.builtInDefaults.get(id);
		if (!original) return false;
		this.setCallout(id, structuredClone(original));
		this.notifyChange();
		return true;
	}

	get(id: string): CalloutDefinition | undefined {
		return this.callouts.get(id);
	}

	getAll(): CalloutDefinition[] {
		return Array.from(this.callouts.values());
	}

	/**
	 * The user's own callouts — neither a built-in nor a row minted from the
	 * active theme's stylesheet. Theme rows are excluded here rather than only
	 * in the settings list because this also feeds `getExportableDefinitions`,
	 * `exportToJSON()` and the *Reset everything* sweep. What may be *written*
	 * in a note is a different question — see
	 * `utils/usableCallouts.committedDefinitions`.
	 */
	getUserDefined(): CalloutDefinition[] {
		return this.definitionsForLists().filter(
			(d) =>
				!d.builtIn &&
				d.source !== "theme" &&
				!this.isUnshadowedPreview(d.id),
		);
	}

	/** Rows minted from the active theme's stylesheet — see `getUserDefined`. */
	getThemeProvided(): CalloutDefinition[] {
		return this.definitionsForLists().filter(
			(d) => d.source === "theme" && !this.isUnshadowedPreview(d.id),
		);
	}

	/**
	 * Everything an export has to carry: {@link getUserDefined} plus every
	 * built-in the user has changed from its shipped default.
	 *
	 * Separate from `getUserDefined` because that one also feeds the settings
	 * lists and the legacy `exportToJSON()`, which is public API surface. A
	 * modified built-in is real, user-authored work — recoloring `note` is no
	 * less an edit than creating a callout — and `toSaveData` already persists
	 * it, so leaving it out of the file made "export" quietly not mean "back up
	 * my callouts". The importer recognizes a built-in id and updates the
	 * built-in in place rather than adding a duplicate user row.
	 */
	getExportableDefinitions(): CalloutDefinition[] {
		const modifiedBuiltIns = this.definitionsForLists().filter(
			(d) =>
				d.builtIn &&
				!this.isUnshadowedPreview(d.id) &&
				this.isBuiltInModified(d.id),
		);
		// The same answer `isUnshadowedPreview` gives, minus its "for as long as
		// a modal is open": an export must not depend on which windows happen
		// to be open, nor carry a demo row an older data.json left behind.
		//
		// Unclaimed discovered rows ARE included, and the filtering happens in
		// the two JSON builders instead: this view also feeds the CSS snippet
		// export, which has to paint every callout the plugin paints — a
		// discovered one included. See `authoredDefinitions`.
		return [...this.getUserDefined(), ...modifiedBuiltIns].filter(
			(d) => !RESERVED_DEMO_IDS.has(d.id),
		);
	}

	/**
	 * {@link getAll} as the settings lists should see it. The transient
	 * live-preview stand-in is an implementation detail of the preview pane; for
	 * a *demo* preview ({@link previewIsDemo}) it must not surface as a row nor
	 * displace the real callout it overlays. So for a demo we present the reality
	 * it shadows — the shadowed built-in/user callout, or nothing when it shadows
	 * a fresh id — leaving `getAll()` (used by the CSS/render pipeline) untouched
	 * so the demo still renders live in the preview pane. Non-demo previews (an
	 * in-progress edit of an existing callout) pass through as-is: that row
	 * *should* reflect the live edit. Such a row can still never change sections,
	 * because a preview shadowing a real callout inherits that callout's identity
	 * on the way into the map — see {@link withIdentityOf}.
	 */
	private definitionsForLists(): CalloutDefinition[] {
		if (this.previewActiveId === null || !this.previewIsDemo) {
			return this.getAll();
		}
		const out: CalloutDefinition[] = [];
		for (const def of this.callouts.values()) {
			if (def.id !== this.previewActiveId) {
				out.push(def);
			} else if (this.previewShadowedDef) {
				// Show the real callout a demo was raised over, not the demo.
				out.push(this.previewShadowedDef);
			}
			// else: demo occupies a fresh id → omit it entirely.
		}
		return out;
	}

	/**
	 * True for the transient settings-preview definition when it does NOT
	 * stand in for a real callout (nothing shadowed): a brand-new callout
	 * being drafted in the editor, or the style popups' neutral demo callout.
	 * Such entries must render through the CSS/preview pipeline (getAll) but
	 * must not surface as rows in the settings lists.
	 */
	private isUnshadowedPreview(id: string): boolean {
		return id === this.previewActiveId && this.previewShadowedDef === null;
	}

	getBuiltIn(): CalloutDefinition[] {
		return this.definitionsForLists().filter((d) => d.builtIn);
	}

	has(id: string): boolean {
		return this.callouts.has(id);
	}

	getBuiltInDefault(id: string): CalloutDefinition | undefined {
		return this.builtInDefaults.get(id);
	}

	findByAlias(alias: string): CalloutDefinition | undefined {
		for (const def of this.callouts.values()) {
			if (def.aliases && def.aliases.includes(alias)) return def;
		}
		return undefined;
	}

	/**
	 * Resolve the ID Obsidian wrote into a block callout's `data-callout`
	 * back to a definition. That attribute is the DASH form of whatever the user
	 * typed (see obsidianCalloutAttrId), so a definition stored as
	 * `multi word callout` must be findable from `multi-word-callout`.
	 *
	 * Precedence runs most-literal-first, so an ID that IS literally
	 * `multi-word-callout` always beats a `multi word callout` that merely
	 * dasherizes to it:
	 *   1. exact ID   2. exact alias   3. attr-form ID   4. attr-form alias
	 * Steps 3 and 4 are separate passes so an attr-form ID beats an attr-form
	 * alias regardless of Map insertion order.
	 *
	 * This is the RENDERING lookup, so it deliberately sees the callout editor's
	 * live-preview draft. Validation wants the opposite and asks a different
	 * question — see {@link findAttrIdConflict} and {@link findByIdentity}.
	 *
	 * Compares through `calloutIdentity`, the plugin's one canonicalization, so
	 * this ladder cannot disagree with the guards in {@link add} about which
	 * spellings are the same callout. That it also folds a stray `|metadata` is
	 * the intended direction here: `obsidianCalloutAttrId` withholds that only so
	 * an emitted `.callout[data-callout=…]` rule can never hijack a real
	 * callout's selector, which is a question about writing CSS, not reading a
	 * lookup.
	 *
	 * Returns undefined when nothing matches — callers decide whether to fall
	 * back. A linear scan rather than a maintained index: `findByAlias` above
	 * already scans on every rendered token, and the Map is mutated from a dozen
	 * places (including setPreviewDefinition, which deliberately skips
	 * notifyChange), so an index would have no safe invalidation point.
	 */
	findByAttrId(rawAttr: string): CalloutDefinition | undefined {
		const key = calloutIdentity(rawAttr);
		const exact = this.callouts.get(key) ?? this.findByAlias(key);
		if (exact) return exact;
		for (const def of this.callouts.values()) {
			if (calloutIdentity(def.id) === key) return def;
		}
		for (const def of this.callouts.values()) {
			if (def.aliases?.some((a) => calloutIdentity(a) === key)) {
				return def;
			}
		}
		return undefined;
	}

	/** See `manager/calloutIdForms.ts`, which owns this arithmetic. */
	findAttrIdConflict(
		rawId: string,
		excludeId: string | null,
	): CalloutDefinition | undefined {
		return findAttrIdConflict(this.definitionSource, rawId, excludeId);
	}

	/**
	 * The definition that already IS this callout, whatever spelling `rawId`
	 * arrived in — the same question {@link findAttrIdConflict} answers, named
	 * for the ingestion side that asks it.
	 *
	 * An importer asking "do I already have this?" and a validator asking "would
	 * this collide?" are one question with two readings, and keeping them one
	 * function is what stops the two from drifting. Use this rather than
	 * {@link get} or {@link has} anywhere an id arrives from outside the plugin:
	 * those are exact-string and so cannot see `banner-icon` in a `banner icon`.
	 *
	 * Reads committed state ({@link realDefinitions}), never the callout
	 * editor's live-preview draft — the opposite of {@link findByAttrId}, which
	 * is the RENDERING lookup and deliberately does see it.
	 */
	findByIdentity(rawId: string): CalloutDefinition | undefined {
		return this.findAttrIdConflict(rawId, null);
	}

	/** See `manager/calloutIdForms.ts`, which owns this arithmetic. */
	vaultIdFormsFor(def: CalloutDefinition, forms?: string[]): string[] {
		return vaultIdFormsFor(this.definitionSource, def, forms);
	}

	/** Bound once so the two above are not re-closing over `this` per call. */
	private readonly definitionSource = (): Iterable<CalloutDefinition> =>
		this.realDefinitions();

	/**
	 * The committed definitions, with the transient live-preview entry replaced
	 * by the real callout it shadows (and dropped entirely when it shadows
	 * nothing). The iteration equivalent of {@link getReal} — for the callers
	 * that must only ever see reality, never the callout editor's draft.
	 */
	private *realDefinitions(): Generator<CalloutDefinition> {
		for (const [id, def] of this.callouts) {
			if (id === this.previewActiveId) {
				if (this.previewShadowedDef) yield this.previewShadowedDef;
				continue;
			}
			yield def;
		}
	}

	/**
	 * Register (or clear, with `null`) the transient live-preview definition
	 * under its own `def.id` — the *real* callout ID being edited — so the
	 * settings live preview renders `> [!<real-id>]` with the in-progress style
	 * through the real pipeline (CSS + reading post-processors).
	 *
	 * Bookkeeping keeps this safe:
	 * - The previous transient entry is always undone first (restoring any
	 *   shadowed real callout), so rapid ID changes while typing a name leave no
	 *   orphan rows.
	 * - If the new ID collides with a real callout, the original is remembered in
	 *   {@link previewShadowedDef} and restored on clear.
	 * - A preview that collides that way also inherits the shadowed callout's
	 *   identity ({@link withIdentityOf}), so an in-progress edit can restyle a
	 *   row but never re-home it between the settings lists, strip its aliases,
	 *   or make a built-in look deletable.
	 * - {@link toSaveData} skips (or substitutes the shadowed original for) the
	 *   active preview ID, so the in-progress edit can never reach disk.
	 *
	 * `isDemo` marks a placeholder preview (palette editor, global-style popups,
	 * or an unnamed new-callout draft) whose id is not a real callout the user is
	 * editing. Such previews are hidden from the settings lists entirely, so a
	 * demo whose id collides with an existing callout — as it did back when the
	 * placeholder was the built-in `example` — can't leak a phantom "My callout
	 * types" row while the modal is open. See {@link definitionsForLists}.
	 *
	 * Deliberately does NOT call `notifyChange()`: that would trigger the
	 * `onChange` → `saveSettings` write and force every open note to re-render.
	 * The caller instead requests a targeted `cssInjector.inject(false)`.
	 *
	 * It DOES fire {@link onPreviewChange} whenever the settings lists could
	 * look different afterwards, so the open settings tab repaints its rows in
	 * the next frame. Without that signal the tab has no way to learn about a
	 * preview at all.
	 *
	 * `notifyLists: false` suppresses exactly that signal for a preview the
	 * user has not chosen — the callout editor's palette menu previewing a
	 * merely hovered colour. The rows then keep rendering the last committed
	 * state, which is what the modal's own swatches and labels still show. The
	 * map does hold the hovered colours meanwhile, so a list refresh from an
	 * unrelated source would surface them; that resolves itself on the next
	 * committed change or when the menu closes and re-notifies.
	 */
	setPreviewDefinition(
		def: CalloutDefinition | null,
		isDemo = false,
		notifyLists = true,
	): void {
		// A demo preview is hidden from the settings lists entirely (see
		// definitionsForLists), so only a NON-demo preview — the in-progress
		// edit of a real callout — can change what those lists render. Capture
		// the outgoing state before the bookkeeping below clears it.
		const wasListVisible =
			this.previewActiveId !== null && !this.previewIsDemo;

		// Undo the previous transient registration first, restoring any real
		// callout it shadowed.
		if (this.previewActiveId !== null) {
			if (this.previewShadowedDef) {
				this.setCallout(this.previewActiveId, this.previewShadowedDef);
			} else {
				this.callouts.delete(this.previewActiveId);
			}
			this.previewActiveId = null;
			this.previewShadowedDef = null;
			this.previewIsDemo = false;
		}

		if (def) {
			const existing = this.callouts.get(def.id);
			this.previewShadowedDef = existing ?? null;
			this.previewActiveId = def.id;
			this.previewIsDemo = isDemo;
			// A preview never owns the identity of the callout it shadows —
			// see withIdentityOf. Applied to demos too: they are already hidden
			// from the lists, but it keeps the map entry a faithful stand-in for
			// the CSS pipeline — a demo standing on a real id (the reserved ones
			// name none, but a discovered row can) keeps its aliases styled.
			this.setCallout(
				def.id,
				existing ? withIdentityOf(existing, def) : def,
			);
		}

		// Notify when either end of the transition was list-visible: taking a
		// non-demo preview down restores the real row just as surely as putting
		// one up replaces it. A demo → demo swap changes nothing on screen.
		if (notifyLists && (wasListVisible || (def !== null && !isDemo))) {
			this.notifyPreviewChange();
		}
	}

	/**
	 * True while a transient live-preview definition stands in for (or adds to)
	 * the real callouts. Callers use it to skip work that must only ever see
	 * committed state — persisting the startup CSS snapshot, above all.
	 */
	hasPreviewDefinition(): boolean {
		return this.previewActiveId !== null;
	}

	/**
	 * The transient preview definition currently registered, or null. Lets a
	 * nested modal (e.g. the palette editor opened over the callout editor)
	 * capture the outer preview on open and restore it on close, rather than
	 * clearing the single preview slot to null.
	 */
	getPreviewDefinition(): CalloutDefinition | null {
		return this.previewActiveId !== null
			? (this.callouts.get(this.previewActiveId) ?? null)
			: null;
	}

	/**
	 * Whether the currently registered preview is a demo placeholder. Lets a
	 * nested modal capture the outer preview's demo state alongside its
	 * definition (see {@link getPreviewDefinition}) so restoring it on close
	 * keeps it hidden from the settings lists.
	 */
	isPreviewDemo(): boolean {
		return this.previewIsDemo;
	}

	/**
	 * Like `get`, but sees through the transient live-preview shadow: if `id`
	 * is the one currently being drafted in the callout editor, returns the
	 * real callout it is shadowing (or undefined if nothing was there) instead
	 * of the in-progress preview stand-in. Used by ID-conflict validation so
	 * the editor's own draft never counts as a conflict with itself.
	 */
	getReal(id: string): CalloutDefinition | undefined {
		if (id === this.previewActiveId) {
			return this.previewShadowedDef ?? undefined;
		}
		return this.callouts.get(id);
	}

	// ── Icon SVG cache ───────────────────────────────────────

	findIconSvg(
		pack: IconPackId,
		name: string,
		variant: string,
	): IconSvgCacheEntry | undefined {
		return this.iconSvgCache.find(
			(e) => e.pack === pack && e.name === name && e.variant === variant,
		);
	}

	addIconSvg(entry: IconSvgCacheEntry): void {
		this.iconSvgCache = this.iconSvgCache.filter(
			(e) =>
				!(
					e.pack === entry.pack &&
					e.name === entry.name &&
					e.variant === entry.variant
				),
		);
		this.iconSvgCache.push(entry);
	}

	/**
	 * Drop cached artwork no callout references any more.
	 *
	 * A single icon can occupy several entries at once, because a pack may draw
	 * it differently per render role — so every role's variant has to be
	 * collected, not just the one the blockquote uses. Miss that and each save
	 * would evict the artwork the inline callouts are rendering from.
	 */
	cleanupUnusedIconSvgs(): void {
		const usedKeys = new Set<string>();
		for (const def of this.callouts.values()) {
			const pack = packFor(def.icon);
			if (!pack) continue;
			for (const role of CALLOUT_RENDER_ROLES) {
				usedKeys.add(
					iconCacheKey(
						def.icon.type,
						def.icon.value,
						pack.cacheVariant(def.icon, role),
					),
				);
			}
		}
		this.iconSvgCache = this.iconSvgCache.filter((entry) =>
			usedKeys.has(iconCacheKey(entry.pack, entry.name, entry.variant)),
		);
	}

	clearIconSvgCache(): void {
		this.iconSvgCache = [];
	}

	getIconSvgCacheSize(): number {
		return this.iconSvgCache.reduce(
			(acc, e) => acc + new Blob([e.svg]).size,
			0,
		);
	}

	resetAll(): void {
		// A reset is the user saying "none of this is mine" — which goes for
		// another build's fields as much as for their own callouts.
		this.foreign = NO_FOREIGN_FIELDS;
		this.callouts.clear();
		for (const def of DEFAULT_CALLOUTS) {
			this.setCallout(def.id, structuredClone(def));
		}
		// Reset global style to defaults
		this.settings.globalStyle = structuredClone(
			DEFAULT_SETTINGS.globalStyle,
		);
		this.settings.contextMenu = structuredClone(
			DEFAULT_SETTINGS.contextMenu,
		);
		this.settings.headingCallouts = structuredClone(
			DEFAULT_SETTINGS.headingCallouts,
		);
		this.settings.inlineCallouts = structuredClone(
			DEFAULT_SETTINGS.inlineCallouts,
		);
		// Reset fallback callout – the previously-selected callout may no
		// longer exist after the reset, which would leave the dropdown blank.
		this.settings.fallbackCalloutId = DEFAULT_SETTINGS.fallbackCalloutId;
		this.settings.customPalettes = [];
		// The user's own pictures go with everything else they made — leaving
		// them behind would keep the largest thing in `data.json` after a reset
		// that is meant to empty it.
		this.settings.userImages = [];
		// The commands the user built point at callouts this reset just wiped.
		// The manager's sync would drop them anyway; clearing here keeps the
		// reset atomic instead of leaving a list that empties a moment later.
		this.settings.customCommands = [];
		this.syncUserImages();
		// Clear SVG caches
		this.clearIconSvgCache();
		this.notifyChange();
	}

	/**
	 * Applies a plan already computed by `planCalloutManagerImport` (which
	 * decided update-vs-create per entry against this same registry). Kept as
	 * two steps — plan (read-only, in utils/calloutManagerImport.ts) then
	 * apply (here) — so the paste modal can show a report before anything
	 * changes, exactly like the JSON importer's ImportReportModal step.
	 */
	applyCalloutManagerImport(items: CalloutManagerPlanItem[]): {
		created: number;
		updated: number;
	} {
		let created = 0;
		let updated = 0;
		// Pushed onto settings.customPalettes as soon as created (not batched
		// to the end) so a later entry sharing the same new color sees it via
		// resolveCalloutManagerColor and reuses it instead of saving a
		// duplicate, and so it's already present by the time add()/update()
		// below fires the save.
		let paletteCreated = false;

		const resolveColor = (
			entry: CalloutManagerEntry,
		): ReturnType<typeof resolveCalloutManagerColor> => {
			const light = entry.color as string;
			// Two hexes only when the source really stated two. Anything else
			// goes through the single-color path, so it keeps matching the same
			// existing palettes it always did.
			const resolved = entry.colorDark
				? resolveCalloutManagerColors(
						light,
						entry.colorDark,
						this.settings.customPalettes,
					)
				: resolveCalloutManagerColor(
						light,
						this.settings.customPalettes,
					);
			if (resolved.createdPalette) {
				this.settings.customPalettes.push(resolved.createdPalette);
				paletteCreated = true;
			}
			return resolved;
		};

		// One onChange for the whole import instead of one per callout: a
		// vault's worth of callouts would otherwise regenerate the stylesheet,
		// repaint every icon and rewrite data.json once each.
		this.batch(() => {
			for (const item of items) {
				if (item.action === "update") {
					const partial: Partial<CalloutDefinition> = {};
					if (item.entry.icon) partial.icon = item.entry.icon;
					if (item.entry.color) {
						const resolved = resolveColor(item.entry);
						Object.assign(partial, resolved.colors);
						partial.paletteId = resolved.paletteId;
					}
					// Counted inside the guard, like applyAdmonitionImport does.
					// An entry that states nothing changes nothing, and reading
					// `data.json` makes those routine — an empty `{"changes": {}}`,
					// a customStyles-only entry, a condition we declined — so a
					// count outside here would claim work that never happened.
					if (Object.keys(partial).length > 0) {
						this.update(item.existingId as string, partial);
						updated++;
					}
					continue;
				}

				const id = normalizeCalloutId(item.entry.id);
				const resolved = resolveColor(item.entry);
				const def: CalloutDefinition = {
					id,
					displayName: obsidianDefaultTitle(item.entry.id),
					// No icon in the source, or one the planner rejected as naming
					// nothing — either way there is nothing to keep, so take the
					// shared import fallback.
					icon: item.entry.icon ?? { ...FALLBACK_ICON },
					...resolved.colors,
					paletteId: resolved.paletteId,
					foldable: true,
					defaultFolded: false,
					builtIn: false,
					source: "user",
				};
				if (this.add(def)) created++;
			}

			// Safety net: add()/update() above already save on every successful
			// mutation, but a created palette whose def failed to add (e.g. a
			// same-id race) would otherwise sit unsaved until an unrelated change.
			if (paletteCreated) {
				this.notifyChange();
			}
		});

		return { created, updated };
	}

	/**
	 * Applies a plan already computed by `planAdmonitionImport`, the same
	 * two-step shape as the Callout Manager import above and for the same
	 * reason — the report is shown before anything here runs.
	 *
	 * Pictures go in first and by id, never by assignment: an Admonition icon
	 * that was an uploaded image arrives as artwork, and the callouts in the
	 * same plan point at it by id, so it has to exist before they land. Merging
	 * (rather than replacing) is the same rule the JSON importer follows — the
	 * user's own pictures are a list they built up, and an import is not
	 * entitled to empty it.
	 */
	applyAdmonitionImport(plan: AdmonitionPlan): {
		created: number;
		updated: number;
	} {
		let created = 0;
		let updated = 0;
		// Pushed onto settings.customPalettes as each is created rather than
		// batched, so a later entry sharing the same new colour finds it and
		// reuses it instead of saving a second copy — see
		// applyCalloutManagerImport, which resolves colours the same way.
		let paletteCreated = false;

		const resolveColor = (
			hex: string,
		): ReturnType<typeof resolveCalloutManagerColor> => {
			const resolved = resolveCalloutManagerColor(
				hex,
				this.settings.customPalettes,
			);
			if (resolved.createdPalette) {
				this.settings.customPalettes.push(resolved.createdPalette);
				paletteCreated = true;
			}
			return resolved;
		};

		// One onChange for the whole import, as in applyCalloutManagerImport.
		this.batch(() => {
			if (plan.newImages.length > 0) {
				const byId = new Map(
					this.settings.userImages.map((image) => [image.id, image]),
				);
				for (const image of plan.newImages) byId.set(image.id, image);
				this.setUserImages([...byId.values()]);
			}

			for (const item of plan.toApply) {
				if (item.action === "update") {
					const { entry } = item;
					const partial: Partial<CalloutDefinition> = {};
					// Only what the admonition actually stated. An entry with no
					// title must not rename the callout, and one whose icon named
					// nothing must not blank the icon it already has.
					if (entry.displayName)
						partial.displayName = entry.displayName;
					if (entry.icon) partial.icon = entry.icon;
					if (entry.color) {
						const resolved = resolveColor(entry.color);
						Object.assign(partial, resolved.colors);
						partial.paletteId = resolved.paletteId;
					}
					// Counted only when something actually changed: an admonition
					// that stated nothing but its type matches a callout that
					// already exists, and reporting that as an update would claim
					// work that never happened.
					if (Object.keys(partial).length > 0) {
						this.update(item.existingId, partial);
						updated++;
					}
					continue;
				}

				const { entry } = item;
				const resolved = resolveColor(entry.color);
				const def: CalloutDefinition = {
					id: entry.id,
					displayName:
						entry.displayName ?? obsidianDefaultTitle(entry.id),
					// No icon in the file, or one naming a drawing that exists in
					// no library — either way there is nothing to keep, so take
					// the shared import fallback.
					icon: entry.icon ?? { ...FALLBACK_ICON },
					...resolved.colors,
					paletteId: resolved.paletteId,
					foldable: true,
					defaultFolded: false,
					builtIn: false,
					source: "user",
				};
				if (this.add(def)) created++;
			}

			// Safety net, as in applyCalloutManagerImport: add()/update() save on
			// every successful mutation, but a palette created for a def that then
			// failed to add would otherwise sit unsaved until an unrelated change.
			if (paletteCreated) {
				this.notifyChange();
			}
		});

		return { created, updated };
	}

	/**
	 * {@link getExportableDefinitions} as a JSON **backup** should see it: the
	 * user's configuration, and nothing this device merely observed.
	 *
	 * A backup restored into another vault must not plant placeholder rows for
	 * callouts that vault may never mention — and an unclaimed discovered row
	 * is exactly that, an id someone's notes happened to contain. The CSS
	 * snippet export asks the unfiltered question, because it has to paint
	 * every callout the plugin paints. See discoveredRowPersistence.ts.
	 */
	private authoredDefinitions(): CalloutDefinition[] {
		return this.getExportableDefinitions().filter(
			(d) => !isEphemeralDiscoveredRow(d, this.settings.customCommands),
		);
	}

	exportToJSON(): string {
		// The legacy shape — `getUserDefined()` as it always was — asking the
		// same question about discovered rows. See authoredDefinitions.
		return JSON.stringify(
			this.getUserDefined().filter(
				(d) => !isEphemeralDiscoveredRow(d, this.settings.customCommands),
			),
			null,
			2,
		);
	}

	/**
	 * v2 export: callout definitions plus the full plugin settings, wrapped
	 * in a versioned envelope. The legacy `exportToJSON()` (flat definitions
	 * array) is kept because it is part of the public plugin API surface;
	 * the importer accepts both shapes.
	 */
	exportToJSONv2(): string {
		return JSON.stringify(
			{
				format: EXPORT_FORMAT_ID,
				formatVersion: EXPORT_FORMAT_VERSION,
				callouts: this.authoredDefinitions(),
				settings: this.settings,
			},
			null,
			2,
		);
	}

	onChange(callback: RegistryChangeCallback): void {
		this.changeCallbacks.push(callback);
	}

	offChange(callback: RegistryChangeCallback): void {
		const idx = this.changeCallbacks.indexOf(callback);
		if (idx >= 0) {
			this.changeCallbacks.splice(idx, 1);
		}
	}

	/** The user's own pictures, newest first. */
	getUserImages(): readonly UserImageIcon[] {
		return this.settings.userImages;
	}

	/**
	 * Replace the picture list and tell everything that draws to catch up.
	 *
	 * The single writer, so the pack's snapshot can never drift from settings.
	 * Callers still own persistence — `notifyChange` reaches the CSS injector,
	 * but `saveSettings()` is the plugin's to call, exactly as for callouts.
	 */
	setUserImages(images: readonly UserImageIcon[]): void {
		this.settings.userImages = [...images];
		this.syncUserImages();
		this.notifyChange();
	}

	/**
	 * Hand the pack the current pictures. It reads a module-level snapshot
	 * rather than settings, because `buildSvg` is synchronous and is called from
	 * render paths with no route back to the plugin.
	 */
	private syncUserImages(): void {
		setUserImages(this.settings.userImages);
	}

	/**
	 * Run `body` with change notifications coalesced: every mutation inside it
	 * fires at most ONE `onChange` round, at the end, and none at all if
	 * nothing actually mutated.
	 *
	 * A single `onChange` is expensive — it regenerates the whole stylesheet,
	 * repaints every callout icon in the document, refreshes every editor and
	 * writes data.json (see main.ts). Paying that per id turns "a template
	 * introduced six unknown callouts" into six full passes plus six
	 * `css-change` storms in one synchronous burst, which on mobile is what a
	 * jumping viewport looks like. Callers that mutate in a loop wrap it here.
	 *
	 * Re-entrant (depth-counted) and exception-safe, and it deliberately does
	 * NOT change what each individual mutation does — only when the listeners
	 * hear about it — so per-call guards that read live registry state from
	 * inside the loop keep behaving exactly as they did.
	 */
	batch<T>(body: () => T): T {
		this.batchDepth++;
		try {
			return body();
		} finally {
			this.batchDepth--;
			if (this.batchDepth === 0 && this.batchDirty) {
				this.batchDirty = false;
				this.notifyChange();
			}
		}
	}

	/** Through {@link notifyListeners} — the list can change mid-round. */
	private notifyChange(): void {
		if (this.batchDepth > 0) {
			this.batchDirty = true;
			return;
		}
		notifyListeners(this.changeCallbacks);
	}

	/**
	 * Subscribe to transient live-preview changes (see
	 * {@link setPreviewDefinition}). Deliberately separate from
	 * {@link onChange}: a preview is not a mutation, so these listeners must
	 * stay off the `saveSettings` / re-render-every-note path. The settings tab
	 * uses it to keep its row swatches in step with the editor modal's preview.
	 */
	onPreviewChange(callback: RegistryChangeCallback): void {
		this.previewChangeCallbacks.push(callback);
	}

	offPreviewChange(callback: RegistryChangeCallback): void {
		const idx = this.previewChangeCallbacks.indexOf(callback);
		if (idx >= 0) {
			this.previewChangeCallbacks.splice(idx, 1);
		}
	}

	/** Likewise. */
	private notifyPreviewChange(): void {
		notifyListeners(this.previewChangeCallbacks);
	}
}
