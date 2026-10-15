/**
 * settings/editor/CalloutEditorSave.ts — Save logic for the callout editor modal.
 *
 * Handles the full save flow: writing the definition to the registry, taking
 * ids moved in from other callouts and handing removed ones to others, and
 * then the note changes the user agreed to — ids rewritten, titles renamed,
 * fold marks updated. Which of those run is
 * the caller's to say (`noteChoices`): this file never decides on its own to
 * touch a note. See ./noteChanges for the rule. Separated from CalloutEditor.ts
 * to keep the modal class focused on UI state.
 */
import { Notice } from "obsidian";
import { t } from "../../i18n";
import type { App } from "obsidian";
import type { CalloutDefinition } from "../../types";
import { packFor } from "../../icons/registry";
import { calloutIdentity } from "../../utils/calloutId";
import type { NoteRewriteJournal } from "../../utils/noteRewriteUndo";
import {
	authoredCustomizedFlag,
	hasAuthoredBackground,
	hasAuthoredTextColors,
} from "./authoredStyle";
import { definitionIconAdjustFields } from "./definitionIconAdjust";
import type { CalloutEditorPlugin } from "./types";
import { createCalloutVaultSavePlan, stageRenameAliases, type CalloutVaultSavePlan } from "./calloutVaultSavePlan";
import { formsEndingHere, noteRewritesFor, pendingNoteChangesFor, type NoteChoices } from "./noteChanges";
import { giveIds, takeMovedIds, type IdMove } from "./idMoves";
import type { GivenId } from "./noteChangeQuestion";

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
	/**
	 * What may change in the notes — the answers to the question the editor
	 * asks before saving (see ./noteChanges). Required, so no caller can reach
	 * the notes by leaving it out: `LEAVE_NOTES` changes none of them.
	 */
	noteChoices: NoteChoices;
	/** Ids this Save takes from other callouts — see ./idMoves. */
	moves?: readonly IdMove[];
	/** Removed ids this Save hands to other callouts — see ./idMoves. */
	gives?: readonly GivenId[];
	/** How finished note changes are announced; Undo by default. */
	announceNoteRewrite?: (message: string, journal: NoteRewriteJournal) => void;
	onMaterialDownloadStart?: () => void;
	/** Track the committed in-memory identity before fallible artwork/file work. */
	onDefinitionApplied?: (def: CalloutDefinition) => void;
	/** Own and durably save the definition before running resumable note work. */
	onVaultChangesReady?: (plan: CalloutVaultSavePlan, definition: CalloutDefinition) => Promise<void>;
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

	const moves = input.moves ?? [];
	const newDisplayName = state.displayName || state.calloutId;
	// The committed row, never the live preview standing in for it.
	const existingDef = existingId
		? plugin.registry.getReal(existingId)
		: undefined;
	// What this Save would change in the notes — the same question the editor
	// asked the user, asked of the same state. Both spellings of an id belong
	// to this one callout, so a rewrite carries `[!a-b]` along with `[!a b]`
	// rather than orphaning it; see CalloutRegistry.vaultIdFormsFor.
	const pending = pendingNoteChangesFor(
		plugin.registry,
		existingId,
		state,
		new Set(moves.map((move) => calloutIdentity(move.id))),
	);
	const rewrittenIds = pending.leaving
		.filter((leaving) => input.noteChoices.rewrite.has(calloutIdentity(leaving.id)))
		.map((leaving) => leaving.id);

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
	const builtInDefault =
		isBuiltIn && existingId
			? plugin.registry.getBuiltInDefault(existingId)
			: undefined;
	const storedAdjust = definitionIconAdjustFields(
		state,
		baselineDef,
		fallbackBase,
		builtInDefault,
	);

	const def: CalloutDefinition = {
		id: state.calloutId,
		displayName: newDisplayName,
		icon: { ...(fallbackBase?.icon ?? state.icon) },
		// `true` or absent, never `false` — an explicit `false` would leave a
		// built-in nobody edited reading as customized forever (isModified
		// compares `value ?? null`).
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
		// Preview and save share this serialization decision. In particular, a
		// built-in that renders exactly like its shipped definition gets that
		// definition's raw fields back, while a partial role reset remains an
		// explicit neutral override when another role still differs.
		...storedAdjust,
		aliases: state.aliases.length > 0 ? [...state.aliases] : undefined,
		paletteId: fallbackBase ? fallbackBase.paletteId : state.paletteId,
		...(existingDef?.metadata ? { metadata: structuredClone(existingDef.metadata) } : {}),
		...(customized === true ? { customized: true } : {}),
	};

	const protectedRename = stageRenameAliases(def, input.onVaultChangesReady ? rewrittenIds : []);
	const mutationDef = protectedRename.definition;
	const { registry } = plugin;
	// One batch for everything a Save does to the registry — the ids moved in
	// from other callouts, then this callout itself — so it all announces
	// itself once, together. Un-batched, a rename's remove would reach the
	// custom-command sweep while the commands still pointed at an id that had
	// just stopped existing, and they would be pruned as broken. Inside the
	// batch the migration lands first, so the single event that follows sees a
	// consistent world.
	//
	// A batch holds back events; it undoes nothing. So a refused save puts back
	// what it already changed — the moved ids, and for a rename the row it
	// removed — rather than leaving the user with less than they started with.
	let notGiven: GivenId[] = [];
	const saved = registry.batch(() => {
		const restoreMoves = takeMovedIds(registry, moves, existingId);
		if (!restoreMoves) return false;
		let applied: boolean;
		if (existingId && isIdChanged) {
			const before = registry.getReal(existingId);
			const wasFallback = registry.settings.fallbackCalloutId === existingId;
			registry.remove(existingId);
			applied = registry.add(mutationDef);
			if (applied) {
				plugin.customCommands.migrateCalloutId(existingId, def.id);
				if (wasFallback) {
					registry.settings.fallbackCalloutId = def.id;
					registry.restyleUncustomizedFallbackRows();
				}
			} else if (before) {
				registry.add(before);
				if (wasFallback) {
					registry.settings.fallbackCalloutId = existingId;
					registry.restyleUncustomizedFallbackRows();
				}
			}
		} else if (existingId) {
			applied = registry.update(existingId, mutationDef);
		} else if (overwriteAutoFallback) {
			applied = registry.update(state.calloutId, mutationDef);
		} else {
			applied = registry.add(mutationDef);
		}
		if (!applied) {
			restoreMoves();
			return false;
		}
		// A discovered row whose only id moved here is gone: whatever pointed
		// at it — a command inserting that callout — points here now.
		for (const move of moves) {
			if (move.removeRow && move.from !== def.id) plugin.customCommands.migrateCalloutId(move.from, def.id);
		}
		// Only now: the id is this callout's until it has been saved without it.
		notGiven = giveIds(registry, input.gives ?? []);
		return true;
	});

	if (!saved) {
		new Notice(t("editor.idConflict"));
		return null;
	}
	input.onDefinitionApplied?.(def);
	for (const gift of notGiven) {
		new Notice(t("editor.idGiveFailed", {
			id: gift.id,
			name: registry.getReal(gift.to)?.displayName ?? gift.to,
		}));
	}
	// Notes that still write an id that left, or one that moved here, look
	// different now without having changed — repaint them, as Delete does. A
	// rewrite below re-renders the notes it touches on its own.
	if (pending.leaving.length > 0 || moves.length > 0) plugin.refreshCallouts();

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

	const { noteChoices } = input;
	// The ids this callout keeps, asked again now the registry holds the saved
	// row — a renamed callout no longer "owns" its old id's dashed spelling, and
	// ids moved in from elsewhere are not this callout's notes to rewrite. With
	// the leaving ids being rewritten into it, they are what the title and fold
	// passes cover, before any id changes.
	const movedHere = new Set(moves.map((move) => calloutIdentity(move.id)));
	const ownIds = [state.calloutId, ...state.aliases].filter((id) => !movedHere.has(calloutIdentity(id)));
	const keptForms = ownIds.length > 0 ? registry.vaultIdFormsFor(def, ownIds) : [];
	const noteForms = formsEndingHere(keptForms, pending, noteChoices);
	const plan = createCalloutVaultSavePlan({
		app,
		rewrites: existingDef
			? noteRewritesFor(pending, noteChoices, { id: def.id, displayName: newDisplayName }, existingDef.displayName)
			: [],
		titles: noteChoices.titles && pending.name
			? { forms: noteForms, from: pending.name.from, to: pending.name.to }
			: null,
		fold: noteChoices.fold && pending.fold !== null
			? { forms: noteForms, to: pending.fold }
			: null,
		announce: input.announceNoteRewrite,
	});
	if (plan) {
		const complete = async () => { await plan(); protectedRename.release(plugin.registry); };
		await (input.onVaultChangesReady ? input.onVaultChangesReady(complete, mutationDef) : complete());
	}

	return def;
}
