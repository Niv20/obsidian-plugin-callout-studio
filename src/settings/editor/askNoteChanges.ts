/**
 * settings/editor/askNoteChanges.ts — the step between pressing Save and
 * saving: count what the notes hold, and ask about it when anything would
 * change (see ./noteChanges for the rule, ./NoteChangesModal for the window).
 *
 * Nothing is read when the edit cannot reach a note at all — a colour, an
 * icon, a new callout — so the common Save costs no vault pass. When it can,
 * every id involved is counted in one pass (utils/idNoteStats.ts), and the
 * window opens only if something the notes hold would actually change.
 */
import type { App } from "obsidian";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import type { CalloutDefinition } from "../../types";
import { calloutIdentity } from "../../utils/calloutId";
import { scanIdNoteStats, type IdNoteStats } from "../../utils/idNoteStats";
import { LEAVE_NOTES, pendingNoteChangesFor, type NoteChangeFormState, type NoteChoices } from "./noteChanges";
import { noteChangeQuestion } from "./noteChangeQuestion";
import { NoteChangesModal, type NoteChangesModalInput } from "./NoteChangesModal";
import type { IdMove } from "./idMoves";

export interface AskNoteChangesInput {
	app: App;
	registry: CalloutRegistry;
	existingId: string | null;
	state: NoteChangeFormState;
	moves: readonly IdMove[];
	/**
	 * Asked once the notes are counted, before the window opens: false when
	 * the editor has closed or its form changed while they were, and the
	 * question would be about a save nobody is waiting for any more.
	 */
	stillWanted: () => boolean;
	/** Opens the window; tests answer in its place. */
	open?: (input: NoteChangesModalInput) => Promise<NoteChoices | null>;
}

/** What Save should do to the notes, or null when the user went back to the editor. */
export async function askNoteChanges(input: AskNoteChangesInput): Promise<NoteChoices | null> {
	const { app, registry, existingId, state } = input;
	const pending = pendingNoteChangesFor(
		registry,
		existingId,
		state,
		new Set(input.moves.map((move) => calloutIdentity(move.id))),
	);
	if (pending.leaving.length === 0 && !pending.name && pending.fold === null) return LEAVE_NOTES;

	let stats: Map<string, IdNoteStats> | null;
	try {
		stats = await scanIdNoteStats(
			app,
			[...pending.leaving.flatMap((leaving) => leaving.forms), ...pending.keptForms],
			{ fold: pending.fold ?? undefined, title: pending.name?.from },
		);
	} catch (error) {
		// The scan has already said which notes it could not read. Ask anyway,
		// without numbers: an unreadable note is no proof an id is unused.
		console.warn("[callout-studio] counting what Save would change in notes was incomplete", error);
		stats = null;
	}
	if (!input.stillWanted()) return null;
	const question = noteChangeQuestion(pending, stats);
	// Only a callout that already exists has notes to ask about.
	const existing = existingId ? registry.getReal(existingId) : undefined;
	if (!question || !existing) return LEAVE_NOTES;

	// "This callout" as Save will leave it: its new id, name and ids.
	const saved: CalloutDefinition = {
		...existing,
		id: state.calloutId,
		displayName: state.displayName || state.calloutId,
		aliases: [...state.aliases],
	};
	const modalInput: NoteChangesModalInput = { question, pending, saved };
	return input.open ? input.open(modalInput) : new NoteChangesModal(app, modalInput).ask();
}
