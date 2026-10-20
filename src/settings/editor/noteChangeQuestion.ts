/**
 * settings/editor/noteChangeQuestion.ts — what the "Update your notes?" window
 * asks, worked out from the notes' counts, and how its answer becomes the
 * {@link NoteChoices} Save runs. Pure, so all of it is tested without a DOM —
 * NoteChangesModal only draws it.
 *
 * One question covers everything Save would change in the notes, with two
 * answers: leave the notes as they are, or change them — every old id still in
 * use becomes one id of this callout that the user picks, and titles and fold
 * marks follow. The window lists only what notes actually hold:
 *
 * - **An id that leaves** and is still used — one the user removed, or the
 *   main id a rename left behind.
 * - **A new name** whose old titles are still in the notes, when no rename of
 *   the main id above already says so.
 * - **A new fold setting** some block callout does not have.
 *
 * When the notes could not all be read the counts are unknown, and everything
 * that might apply is listed rather than nothing: an unreadable note is not
 * proof that nothing uses an id.
 */
import { calloutIdentity } from "../../utils/calloutId";
import { sumTallies, type IdNoteStats, type NoteTally } from "../../utils/idNoteStats";
import { LEAVE_NOTES, type FoldMark, type LeavingId, type NoteChoices, type PendingNoteChanges } from "./noteChanges";

export interface NoteChangeQuestion {
	/** Leaving ids the notes use; `uses` null when they could not be counted. */
	ids: Array<{ leaving: LeavingId; uses: NoteTally | null }>;
	/** A new name whose old titles the notes may hold, when no leaving main id covers it. */
	name: { from: string; to: string } | null;
	/** The fold mark block callouts would get, when some do not have it. */
	fold: FoldMark | null;
	/**
	 * The callouts it all reaches, for the window's count; null when not every
	 * note could be read. Fold marks are counted only when nothing else is, so
	 * a callout is not counted twice.
	 */
	affected: NoteTally | null;
}

function statsFor(stats: ReadonlyMap<string, IdNoteStats>, forms: readonly string[]): IdNoteStats[] {
	const keys = new Set(forms.map(calloutIdentity));
	return [...keys].flatMap((key) => {
		const one = stats.get(key);
		return one ? [one] : [];
	});
}

/**
 * The question, or null when there is nothing to ask — no note uses anything
 * Save would change.
 */
export function noteChangeQuestion(
	pending: PendingNoteChanges,
	stats: ReadonlyMap<string, IdNoteStats> | null,
): NoteChangeQuestion | null {
	const ids = pending.leaving.flatMap((leaving) => {
		const uses = stats ? sumTallies(statsFor(stats, leaving.forms).map((one) => one.uses)) : null;
		return uses === null || uses.count > 0 ? [{ leaving, uses }] : [];
	});

	// Titles and fold marks matter when Change would reach them: over the ids
	// the callout keeps and every leaving id, since Change rewrites them all here.
	const everything = pending.leaving.map((leaving) => leaving.id);
	const could = (tally: NoteTally | null): boolean => tally === null || tally.count > 0;

	let name: NoteChangeQuestion["name"] = null;
	const renamed = ids.some((id) => id.leaving.wasPrimary);
	if (pending.name && !renamed && could(titleTally(pending, stats, everything))) name = { ...pending.name };

	let fold: FoldMark | null = null;
	if (pending.fold !== null && could(foldTally(pending, stats, everything))) fold = pending.fold;

	if (ids.length === 0 && !name && fold === null) return null;

	// The leaving ids' own notes are in their uses; the kept ids' are counted
	// here, by what would change on them.
	const parts: Array<NoteTally | null> = ids.map((id) => id.uses);
	if (pending.name) parts.push(titleTally(pending, stats, []));
	else if (fold !== null) parts.push(foldTally(pending, stats, []));
	const affected = parts.some((part) => part === null) ? null : sumTallies(parts as NoteTally[]);
	return { ids, name, fold, affected };
}

/**
 * One count over the notes that are this callout's once Save is done: its
 * kept ids, plus the leaving ids in `toSelf` — exactly what the title and fold
 * passes cover (noteChanges.formsEndingHere) when those are rewritten here.
 * Null when the notes could not be counted.
 */
function tallyEndingHere(
	pending: PendingNoteChanges,
	stats: ReadonlyMap<string, IdNoteStats> | null,
	toSelf: Iterable<string>,
	pick: (one: IdNoteStats) => NoteTally,
): NoteTally | null {
	if (!stats) return null;
	const sending = new Set([...toSelf].map(calloutIdentity));
	const forms = [
		...pending.keptForms,
		...pending.leaving.filter((leaving) => sending.has(calloutIdentity(leaving.id))).flatMap((leaving) => leaving.forms),
	];
	return sumTallies(statsFor(stats, forms).map(pick));
}

/** Block callouts whose fold mark differs from the new setting — see {@link tallyEndingHere}. */
export function foldTally(
	pending: PendingNoteChanges,
	stats: ReadonlyMap<string, IdNoteStats> | null,
	toSelf: Iterable<string>,
): NoteTally | null {
	return tallyEndingHere(pending, stats, toSelf, (one) => one.foldDiffers);
}

/** Titles reading the old name — see {@link tallyEndingHere}. */
export function titleTally(
	pending: PendingNoteChanges,
	stats: ReadonlyMap<string, IdNoteStats> | null,
	toSelf: Iterable<string>,
): NoteTally | null {
	return tallyEndingHere(pending, stats, toSelf, (one) => one.titled);
}

/**
 * What Save runs for the answer: `to` is the id of this callout the user chose
 * to change the notes to, or null for "Leave them as they are". Changing
 * rewrites every leaving id the window listed, and lets the titles and fold
 * marks follow — Save applies those only when the name or the setting changed.
 */
export function choicesFor(question: NoteChangeQuestion, to: string | null): NoteChoices {
	if (to === null) return LEAVE_NOTES;
	return {
		rewrite: new Map(question.ids.map(({ leaving }) => [calloutIdentity(leaving.id), to])),
		titles: true,
		fold: true,
	};
}
