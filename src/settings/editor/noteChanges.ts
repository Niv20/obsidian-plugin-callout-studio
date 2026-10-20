/**
 * settings/editor/noteChanges.ts — what pressing Save in the callout editor
 * would change in the user's notes, and what the user chose to do about it.
 *
 * ## The rule
 *
 * A note changes only after the user is asked. Three edits in the editor reach
 * into notes that are not open on screen:
 *
 * - **An id leaves the callout** — an alias is removed, or the name changes and
 *   with it the id (the id mirrors the name). Notes still write `[!old]`.
 * - **The name changes** — titles the plugin wrote read the old name.
 * - **The fold setting changes** — every block callout carries its own `+`/`-`.
 *
 * Each of these used to rewrite the vault silently on Save. Now Save first
 * counts what the notes hold (utils/idNoteStats.ts) and, when anything is in
 * use, asks in NoteChangesModal. What the user answers is a {@link NoteChoices},
 * and the save rewrites exactly that and nothing more. Delete already followed
 * the rule (it never touches a note); this is the editor catching up.
 *
 * The window opens on **Leave them as they are** (noteChangeQuestion.choicesFor
 * with no id picked), which is the fix: an alias someone takes
 * off a callout, or a new name, is not a request to rewrite every note that
 * used it. A note changes only when the user picks an answer that changes it.
 *
 * ## Ids are compared by identity
 *
 * `a b` and `a-b` are one callout to Obsidian (see calloutIdForms.ts), so an
 * alias re-spelled from one to the other has not left. Comparing the raw
 * strings, as the save once did, rewrote every `[!a-b]` to the main id whenever
 * a callout with a space in an id was saved at all.
 */
import type { CalloutDefinition } from "../../types";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import { calloutIdentity, obsidianDefaultTitle } from "../../utils/calloutId";
import { foldMarkFor } from "../../editor/calloutWriter";
import type { CalloutTitleSwap } from "../../utils/vaultCalloutScanner";

export type FoldMark = "" | "+" | "-";

/** An id the callout gives up on Save. */
export interface LeavingId {
	/** Spelled as the callout had it. */
	id: string;
	/** Every spelling notes may use for it — counted and rewritten together. */
	forms: string[];
	/** It was the callout's main id, left behind by a rename. */
	wasPrimary: boolean;
}

export interface PendingNoteChanges {
	leaving: LeavingId[];
	/** The callout's name before and after, when Save changes it. */
	name: { from: string; to: string } | null;
	/** The fold mark its block callouts get from now on, when Save changes it. */
	fold: FoldMark | null;
	/**
	 * Every spelling of the ids the callout keeps — where titles and fold marks
	 * are rewritten. Ids moved in from another callout are left out: those notes
	 * belonged to a different callout until this Save, and nobody was asked
	 * about them.
	 */
	keptForms: string[];
}

/** The parts of the editor form that decide what reaches the notes. */
export interface NoteChangeFormState {
	calloutId: string;
	aliases: readonly string[];
	displayName: string;
	foldable: boolean;
	defaultFolded: boolean;
}

export interface NoteChoices {
	/**
	 * Leaving ids whose notes are rewritten, by identity, to one of this
	 * callout's own ids as Save leaves them. Absent: left as written. Notes
	 * never go to another callout from here — giving an id away is that
	 * callout's **move it here** (./idMoves.ts).
	 */
	rewrite: ReadonlyMap<string, string>;
	/** Titles reading the old name take the new one, on the ids the callout keeps. */
	titles: boolean;
	/** Block callouts take the new fold mark. */
	fold: boolean;
}

/** Nothing in any note changes. */
export const LEAVE_NOTES: NoteChoices = Object.freeze({
	rewrite: new Map<string, string>(),
	titles: false,
	fold: false,
});

export interface PendingNoteChangesInput {
	/** The callout as committed (`registry.getReal`), or undefined for a new one. */
	existing: CalloutDefinition | undefined;
	state: NoteChangeFormState;
	/** `registry.vaultIdFormsFor` — every spelling an id may appear as in a note. */
	vaultIdFormsFor: (def: CalloutDefinition, forms?: string[]) => string[];
	/** Identities moved in from other callouts by this Save. */
	moved?: ReadonlySet<string>;
}

/** What Save would change in the notes, before anything is counted. */
export function pendingNoteChanges(input: PendingNoteChangesInput): PendingNoteChanges {
	const { existing, state } = input;
	// A callout that did not exist before has no notes of its own to change.
	if (!existing) return { leaving: [], name: null, fold: null, keptForms: [] };

	const keptIds = [state.calloutId, ...state.aliases].filter(Boolean);
	const kept = new Set(keptIds.map(calloutIdentity));
	const leaving: LeavingId[] = [];
	const seen = new Set<string>();
	for (const id of [existing.id, ...(existing.aliases ?? [])]) {
		const key = calloutIdentity(id);
		if (!key || kept.has(key) || seen.has(key)) continue;
		seen.add(key);
		leaving.push({
			id,
			forms: input.vaultIdFormsFor(existing, [id]),
			wasPrimary: id === existing.id,
		});
	}

	const moved = input.moved ?? new Set<string>();
	const ownKept = keptIds.filter((id) => !moved.has(calloutIdentity(id)));
	// Asked of the row as it stands, which still owns every one of these
	// spellings: the saved row may not exist yet, and asking about a new id
	// would find the old row "owning" the dashed form of its own alias.
	const keptForms = ownKept.length > 0 ? input.vaultIdFormsFor(existing, ownKept) : [];

	const newName = state.displayName || state.calloutId;
	const nextFold = foldMarkFor(state);
	return {
		leaving,
		name: existing.displayName !== newName ? { from: existing.displayName, to: newName } : null,
		fold: foldMarkFor(existing) !== nextFold ? nextFold : null,
		keptForms,
	};
}

/**
 * {@link pendingNoteChanges} for the callout `existingId` as the registry holds
 * it — the committed row (`getReal`), never the live preview standing in for it.
 */
export function pendingNoteChangesFor(
	registry: Pick<CalloutRegistry, "getReal" | "vaultIdFormsFor">,
	existingId: string | null,
	state: NoteChangeFormState,
	moved?: ReadonlySet<string>,
): PendingNoteChanges {
	return pendingNoteChanges({
		existing: existingId ? registry.getReal(existingId) : undefined,
		state,
		vaultIdFormsFor: (def, forms) => registry.vaultIdFormsFor(def, forms),
		moved,
	});
}

/**
 * The spellings whose notes are this callout's once Save is done, as those
 * notes read BEFORE any rewrite: the ids it keeps, plus the leaving ids being
 * rewritten — every rewrite ends in this callout. The title and fold passes run over these, ahead of the
 * rewrites — afterwards a rewritten note carries the saved id, which may be one
 * just moved here whose own notes belong to nobody's question. See
 * calloutVaultSavePlan.
 */
export function formsEndingHere(
	keptForms: readonly string[],
	pending: PendingNoteChanges,
	choices: NoteChoices,
): string[] {
	const forms = new Set(keptForms);
	for (const leaving of pending.leaving) {
		if (!choices.rewrite.has(calloutIdentity(leaving.id))) continue;
		for (const form of leaving.forms) forms.add(form);
	}
	return [...forms];
}

/** One group of note rewrites: these spellings all become `toId`. */
export interface NoteRewrite {
	forms: string[];
	toId: string;
	titleSwap?: CalloutTitleSwap;
}

/**
 * The id rewrites `choices` asks for, grouped by the id they go to.
 *
 * A rewritten note takes the title the plugin would write for its new id when
 * its title was one the plugin would have written for the old id — the way
 * Replace in vault carries a name across. A title the user wrote stays. What
 * counts as written by the plugin follows calloutWriter.isGeneratedTitle: the
 * callout's name for its main id, and for an alias the alias's default title
 * or, from before that rule, the callout's name.
 *
 * The callout's old name going to its main id is the rename's title pass
 * (`choices.titles`), which runs first, over these notes too
 * (formsEndingHere). Going to an alias, the pass has already turned the old
 * name into the new one, so both are swapped for the alias's title.
 */
export function noteRewritesFor(
	pending: PendingNoteChanges,
	choices: NoteChoices,
	saved: { id: string; displayName: string },
	oldName: string,
): NoteRewrite[] {
	const groups = new Map<string, { forms: string[]; from: Set<string>; to: string }>();
	for (const leaving of pending.leaving) {
		const toId = choices.rewrite.get(calloutIdentity(leaving.id));
		if (!toId) continue;
		const main = calloutIdentity(toId) === calloutIdentity(saved.id);
		let group = groups.get(toId);
		if (!group) {
			group = { forms: [], from: new Set(), to: main ? saved.displayName : obsidianDefaultTitle(toId) };
			groups.set(toId, group);
		}
		group.forms.push(...leaving.forms);
		if (!main) {
			group.from.add(oldName);
			group.from.add(saved.displayName);
		}
		if (!leaving.wasPrimary) group.from.add(obsidianDefaultTitle(leaving.id));
	}
	return [...groups].map(([toId, group]) => {
		const from = [...group.from].filter((title) => title !== group.to);
		return from.length > 0
			? { forms: group.forms, toId, titleSwap: { from, to: group.to } }
			: { forms: group.forms, toId };
	});
}
