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
import { MAX_TAGS_COUNT, RESERVED_DEMO_IDS } from "../../constants";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import type { CalloutDefinition } from "../../types";
import { calloutIdentity } from "../../utils/calloutId";
import { scanIdNoteStats, type IdNoteStats } from "../../utils/idNoteStats";
import { LEAVE_NOTES, pendingNoteChangesFor, type NoteChangeFormState } from "./noteChanges";
import { noteChangeQuestion } from "./noteChangeQuestion";
import { NoteChangesModal, type NoteChangesAnswer, type NoteChangesModalInput } from "./NoteChangesModal";
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
	open?: (input: NoteChangesModalInput) => Promise<NoteChangesAnswer | null>;
}

/** What Save should do to the notes, or null when the user went back to the editor. */
export async function askNoteChanges(input: AskNoteChangesInput): Promise<NoteChangesAnswer | null> {
	const { app, registry, existingId, state } = input;
	const pending = pendingNoteChangesFor(
		registry,
		existingId,
		state,
		new Set(input.moves.map((move) => calloutIdentity(move.id))),
	);
	const nothing: NoteChangesAnswer = { choices: LEAVE_NOTES, keep: [], give: [] };
	if (pending.leaving.length === 0 && !pending.name && pending.fold === null) return nothing;

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
	if (!question || !existing) return nothing;

	// "This callout" as Save will leave it: its new id and name, its current look.
	const saved: CalloutDefinition = {
		...existing,
		id: state.calloutId,
		displayName: state.displayName || state.calloutId,
		aliases: [...state.aliases],
	};
	const others = registry.getCommitted().filter((def) =>
		def.id !== existingId && def.id !== saved.id && !RESERVED_DEMO_IDS.has(def.id));
	// An id moves only to a callout that can hold it as one of its own — not a
	// theme's (the theme decides its ids), not a placeholder a scan made with no
	// style of its own (the id would look no different), and not one already
	// at the cap. An id moved in from one of these by this same Save has left
	// it already, so the count is the one Save will find.
	const movedOut = new Map<string, number>();
	for (const move of input.moves) movedOut.set(move.from, (movedOut.get(move.from) ?? 0) + 1);
	const canTakeAnId = (def: CalloutDefinition): boolean =>
		def.source !== "theme" &&
		!registry.themeOwns(def) &&
		!(def.source === "fallback" && def.customized !== true) &&
		1 + (def.aliases?.length ?? 0) - (movedOut.get(def.id) ?? 0) < MAX_TAGS_COUNT;
	const modalInput: NoteChangesModalInput = {
		question,
		pending,
		stats,
		saved,
		roomForIds: MAX_TAGS_COUNT - 1 - state.aliases.length,
		registry,
		targets: () => [saved, ...others],
		moveTargets: () => others.filter(canTakeAnId),
	};
	return input.open ? input.open(modalInput) : new NoteChangesModal(app, modalInput).ask();
}
