/**
 * settings/editor/CalloutEditorSave.ts — Save logic for the callout editor modal.
 *
 * Handles the full save flow: writing the definition to the registry,
 * renaming callout IDs in vault files when the ID changes, updating fold
 * markers, and normalizing titles. Separated from CalloutEditor.ts to keep
 * the modal class focused on UI state.
 */
import { Notice } from "obsidian";
import { t } from "../../i18n";
import type { App } from "obsidian";
import type { CalloutDefinition } from "../../types";
import { packFor } from "../../icons/registry";
import {
	authoredCustomizedFlag,
	authoredStyleMode,
	hasAuthoredBackground,
	hasAuthoredIconAdjust,
	hasAuthoredTextColors,
} from "./authoredStyle";
import type { CalloutEditorPlugin } from "./types";
import {
	countCalloutUsages,
	normalizeFoldMarkersInVault,
	replaceCalloutIdsInVault,
	replaceCalloutTitlesInVault,
} from "../../utils/vaultCalloutScanner";

export type CalloutEditorSaveState = {
	displayName: string;
	calloutId: string;
	icon: CalloutDefinition["icon"];
	hideIcon: boolean;
	colorLight: string;
	colorDark: string;
	bgColorLight: string;
	bgColorDark: string;
	bgGradient?: CalloutDefinition["bgGradient"];
	/**
	 * Paint no background at all. A plain boolean here (the form needs an off
	 * position) but `?: true` on the saved definition, so the off case must drop
	 * the key rather than write `false` — see `CalloutDefinition.transparentBg`.
	 */
	transparentBg: boolean;
	textColorLight: string;
	textColorDark: string;
	foldable: boolean;
	defaultFolded: boolean;
	/** Per-role icon adjustment; see `CalloutDefinition.iconAdjust`. */
	iconAdjust?: CalloutDefinition["iconAdjust"];
	iconOffsetX: number;
	iconOffsetY: number;
	iconSize: number;
	aliases: string[];
	/** Id of the custom/preset palette these colors were applied from, if any. */
	paletteId?: string;
};

export type CalloutEditorSaveInput = {
	app: App;
	plugin: CalloutEditorPlugin;
	existingId: string | null;
	isBuiltIn: boolean;
	state: CalloutEditorSaveState;
	/**
	 * The definition the form opened on, or undefined for a blank new callout.
	 *
	 * Passed in rather than looked up here because the modal's own baseline is
	 * `existing ?? fallbackBase` (CalloutEditor's constructor) while the
	 * `fallbackBase` below is only resolved when the save is *mirroring* a
	 * fallback — so re-deriving it here would let the two paths disagree about
	 * what the user started from. They must not: the live preview and this save
	 * ask the same `hasAuthored…` questions of it, and a divergence there is
	 * exactly the class of bug `authoredStyle.ts` exists to prevent.
	 */
	baselineDef: CalloutDefinition | undefined;
	hasStyleChanges: boolean;
	saveAsFallback: boolean;
	overwriteAutoFallback: boolean;
	canUseCalloutId: (id: string, role: "primary" | "alias") => boolean;
	getFallbackBase: () => CalloutDefinition | undefined;
	onMaterialDownloadStart?: () => void;
};

export async function performCalloutEditorSave(
	input: CalloutEditorSaveInput,
): Promise<CalloutDefinition | null> {
	const {
		app,
		plugin,
		existingId,
		isBuiltIn,
		state,
		baselineDef,
		hasStyleChanges,
		saveAsFallback,
		overwriteAutoFallback,
		canUseCalloutId,
		getFallbackBase,
		onMaterialDownloadStart,
	} = input;

	if (!state.calloutId) return null;

	const isIdChanged = existingId !== null && state.calloutId !== existingId;
	const isNew = existingId === null;

	if (
		(isNew || isIdChanged) &&
		!canUseCalloutId(state.calloutId, "primary")
	) {
		return null;
	}
	for (const alias of state.aliases) {
		if (!canUseCalloutId(alias, "alias")) return null;
	}

	let removedIds: string[] = [];
	let oldDisplayName: string | null = null;
	let oldAllIds: string[] = [];
	let oldFoldable = false;
	let oldDefaultFolded = false;
	if (existingId) {
		const existingDef = plugin.registry.get(existingId);
		if (existingDef) {
			oldDisplayName = existingDef.displayName;
			// Both spellings of an ID belong to this one callout, so renaming it
			// rewrites `[!a-b]` usages alongside `[!a b]` ones rather than
			// orphaning them. See CalloutRegistry.vaultIdFormsFor.
			oldAllIds = plugin.registry.vaultIdFormsFor(existingDef);
			oldFoldable = existingDef.foldable;
			oldDefaultFolded = existingDef.defaultFolded;
			const newIdSet = new Set(
				[state.calloutId, ...state.aliases].map((s) => s.toLowerCase()),
			);
			removedIds = oldAllIds.filter(
				(id) => !newIdSet.has(id.toLowerCase()),
			);
		}
	}

	const newDisplayName = state.displayName || state.calloutId;
	const existingDef = existingId
		? plugin.registry.get(existingId)
		: undefined;

	let nextSource: CalloutDefinition["source"] = "user";
	if (isBuiltIn) {
		nextSource = "builtin";
	} else if (existingDef) {
		if (
			existingDef.source === "fallback" &&
			existingDef.customized !== true &&
			!hasStyleChanges
		) {
			nextSource = "fallback";
		} else {
			nextSource = "user";
		}
	} else {
		nextSource = saveAsFallback ? "fallback" : "user";
	}

	const customized = authoredCustomizedFlag(
		isBuiltIn,
		existingId === null,
		existingDef?.customized === true,
		hasStyleChanges,
		saveAsFallback,
	);
	const fallbackBase = saveAsFallback ? getFallbackBase() : undefined;

	// Three of the style groups below — background, text colour, icon
	// adjustment — are held concretely by the form whether or not the user ever
	// chose them: a colour swatch has to show something, so the modal derives a
	// background from the accent, invents DEFAULT_TEXT_COLOR_* and starts the
	// sliders at DEFAULT_ICON_ADJUST. A definition is not like that. Leaving
	// those fields absent is what keeps Obsidian's own translucent fill in place
	// (and an opaque background is exactly what stops nested callouts from
	// stepping — see CalloutRegistry.dropDerivedBackgrounds), what leaves the
	// theme's `--text-normal` winning, and what keeps a built-in reading as
	// unmodified so `isUnmodifiedBuiltIn` lets it keep deferring to the theme's
	// `--callout-*` variables. Writing a default the user never picked is
	// therefore a real edit, not a harmless one: it used to mean opening a
	// built-in and saving anything at all pinned its accent to a hex forever.
	//
	// So each group is gated on its own predicate, and the live preview gates on
	// the same three — the two paths must agree on what the user authored or the
	// callout changes appearance on save. See ./authoredStyle.
	//
	// Transparency short-circuits the background: the flag IS the background, so
	// the hexes the form is still holding (and any gradient) are dropped
	// outright rather than left beside it as a second, contradicting source of
	// truth. It also means an older build reading this export degrades to "no
	// background" — Obsidian's own tint — instead of to a stale opaque colour.
	const transparent = fallbackBase
		? fallbackBase.transparentBg === true
		: state.transparentBg;
	const authoredBg = hasAuthoredBackground({
		...state,
		transparentBg: transparent,
	});
	const authoredText = hasAuthoredTextColors(
		baselineDef,
		state.textColorLight,
		state.textColorDark,
	);
	const authoredAdjust = hasAuthoredIconAdjust(baselineDef, {
		offsetX: state.iconOffsetX,
		offsetY: state.iconOffsetY,
		size: state.iconSize,
	});

	const def: CalloutDefinition = {
		id: state.calloutId,
		displayName: newDisplayName,
		icon: { ...(fallbackBase?.icon ?? state.icon) },
		// `true` or absent, never `false` — an explicit `false` would leave a
		// built-in nobody edited reading as customized forever (isModified
		// compares `value ?? null`), which is the same trap setExternalStyle
		// deletes its key to avoid.
		hideIcon:
			(fallbackBase ? fallbackBase.hideIcon === true : state.hideIcon) ||
			undefined,
		colorLight: fallbackBase?.colorLight ?? state.colorLight,
		colorDark: fallbackBase?.colorDark ?? state.colorDark,
		bgColorLight: fallbackBase
			? fallbackBase.bgColorLight
			: authoredBg
				? state.bgColorLight
				: undefined,
		bgColorDark: fallbackBase
			? fallbackBase.bgColorDark
			: authoredBg
				? state.bgColorDark
				: undefined,
		// Like paletteId below: when mirroring the fallback style, its (possibly
		// absent) gradient wins outright rather than falling through to state.
		// A sweep is a background, so transparency clears it either way; the
		// editor already does, and this covers a gradient reaching us from data
		// the editor never wrote.
		bgGradient: transparent
			? undefined
			: fallbackBase
				? fallbackBase.bgGradient
				: state.bgGradient,
		// Spelled out rather than omitted, for the same reason `bakePaletteColors`
		// spells it out: `registry.update()` merges this over the existing
		// definition, and a key that isn't there clears nothing. Omitting it made
		// transparency a one-way door — a callout switched to "None" once kept
		// `transparentBg: true` through every later save, while the background
		// hexes beside it (always written, `undefined` included) went on
		// updating. `CSSInjector` checks the flag first, so such a row rendered
		// with no background while the settings swatch drew the stale hexes.
		transparentBg: transparent ? true : undefined,
		textColorLight: fallbackBase
			? fallbackBase.textColorLight
			: authoredText
				? state.textColorLight
				: undefined,
		textColorDark: fallbackBase
			? fallbackBase.textColorDark
			: authoredText
				? state.textColorDark
				: undefined,
		foldable: fallbackBase?.foldable ?? state.foldable,
		defaultFolded: fallbackBase?.defaultFolded ?? state.defaultFolded,
		builtIn: isBuiltIn,
		source: nextSource,
		// Like paletteId and bgGradient: when mirroring the fallback style its
		// (possibly absent) per-role map wins outright rather than falling
		// through to the form, so the two adjustment layers stay from one row.
		//
		// Only the flat trio below needs the authored gate: `buildIconAdjust`
		// already returns undefined once every role agrees, so the map is never
		// a mere default. Dropping the trio is lossless — `resolveIconAdjust`
		// falls an absent one back to DEFAULT_ICON_ADJUST, which is exactly the
		// value being dropped.
		iconAdjust: fallbackBase ? fallbackBase.iconAdjust : state.iconAdjust,
		iconOffsetX: fallbackBase
			? fallbackBase.iconOffsetX
			: authoredAdjust
				? state.iconOffsetX
				: undefined,
		iconOffsetY: fallbackBase
			? fallbackBase.iconOffsetY
			: authoredAdjust
				? state.iconOffsetY
				: undefined,
		iconSize: fallbackBase
			? fallbackBase.iconSize
			: authoredAdjust
				? state.iconSize
				: undefined,
		aliases: state.aliases.length > 0 ? [...state.aliases] : undefined,
		paletteId: fallbackBase ? fallbackBase.paletteId : state.paletteId,
		...(customized === true ? { customized: true } : {}),
		...authoredStyleMode(hasStyleChanges),
	};

	let saved = false;
	if (existingId) {
		if (isIdChanged) {
			// Batched so the remove and the add announce themselves once,
			// together. Un-batched, the remove's change event would reach the
			// custom-command sweep while the commands still pointed at an id
			// that had just stopped existing, and they would be pruned as
			// broken. Inside the batch the migration lands first, so the single
			// event that follows sees a consistent world.
			saved = plugin.registry.batch(() => {
				plugin.registry.remove(existingId);
				const added = plugin.registry.add(def);
				if (added) {
					plugin.customCommands.migrateCalloutId(existingId, def.id);
				}
				return added;
			});
		} else {
			saved = plugin.registry.update(existingId, def);
		}
	} else if (overwriteAutoFallback) {
		saved = plugin.registry.update(state.calloutId, def);
	} else {
		saved = plugin.registry.add(def);
	}

	if (!saved) {
		new Notice(t("editor.idConflict"));
		return null;
	}

	// Packs served one icon at a time fetch on save, so the artwork is in the
	// cache before the definition is rendered anywhere. Packs that ship or
	// download their data whole already have it and return immediately.
	if (def.hideIcon !== true && packFor(def.icon)?.kind === "perIconRemote") {
		onMaterialDownloadStart?.();
		try {
			await plugin.ensureIconArtwork(def.icon);
		} catch (err) {
			console.warn("[CalloutStudio] save: icon fetch failed", err);
		}
	}

	plugin.registry.cleanupUnusedIconSvgs();

	if (removedIds.length > 0) {
		const { fileCount } = await countCalloutUsages(app, removedIds);
		if (fileCount > 0) {
			const replaced = await replaceCalloutIdsInVault(
				app,
				removedIds,
				state.calloutId,
			);
			if (replaced > 0) {
				new Notice(
					t("vault.idsUpdated", {
						count: String(replaced),
						oldIds: removedIds.join(", "),
						newId: state.calloutId,
					}),
				);
			}
		}
	}

	if (
		oldDisplayName &&
		oldDisplayName !== newDisplayName &&
		oldAllIds.length > 0
	) {
		const allCurrentIds = plugin.registry.vaultIdFormsFor(def, [
			state.calloutId,
			...state.aliases,
		]);
		const replaced = await replaceCalloutTitlesInVault(
			app,
			allCurrentIds,
			oldDisplayName,
			newDisplayName,
		);
		if (replaced > 0) {
			new Notice(
				t("vault.titlesUpdated", {
					count: String(replaced),
					oldTitle: oldDisplayName,
					newTitle: newDisplayName,
				}),
			);
		}
	}

	if (
		existingId &&
		(oldFoldable !== state.foldable ||
			oldDefaultFolded !== state.defaultFolded)
	) {
		const desiredMarker: "" | "+" | "-" = !state.foldable
			? ""
			: state.defaultFolded
				? "-"
				: "+";
		const allCurrentIds = plugin.registry.vaultIdFormsFor(def, [
			state.calloutId,
			...state.aliases,
		]);
		await normalizeFoldMarkersInVault(app, allCurrentIds, desiredMarker);
	}

	return def;
}
