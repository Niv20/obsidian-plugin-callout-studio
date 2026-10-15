/**
 * settings/editor/noteChangeQuestion.ts — what the "Update your notes?" window
 * asks, worked out from the notes' counts; and how its answers become the
 * {@link NoteChoices} Save runs. Pure, so all of it is tested without a DOM —
 * NoteChangesModal only draws it.
 *
 * The window asks only about what notes actually hold:
 *
 * - **An id that leaves** and is still used. A rename's old id asks "change
 *   them to the new id, or keep the old one as another id"; any other id asks
 *   "leave them, move the id to a callout you pick, or change them in your
 *   notes to a callout you pick". Moving touches no note: the id becomes the
 *   other callout's, and `[!id]` takes its style.
 * - **Titles** reading the old name, when the name changed and no rename
 *   question above already covers them.
 * - **Fold marks** that differ from the new setting, counted over this
 *   callout's ids plus every leaving id the user is sending here — so the count
 *   moves as the answers above it change.
 *
 * When the notes could not all be read the counts are unknown, and every
 * question that might apply is asked rather than none: an unreadable note is
 * not proof that nothing uses an id.
 */
import { calloutIdentity } from "../../utils/calloutId";
import { sumTallies, type IdNoteStats, type NoteTally } from "../../utils/idNoteStats";
import type { FoldMark, LeavingId, NoteChoices, PendingNoteChanges, RewriteTarget } from "./noteChanges";

export interface NoteChangeQuestion {
	/** Leaving ids the notes use; `uses` null when they could not be counted. */
	ids: Array<{ leaving: LeavingId; uses: NoteTally | null }>;
	/** Titles reading the old name; counted live by {@link titleTally}. */
	titles: { from: string; to: string } | null;
	/** The fold mark block callouts are offered; counted live by {@link foldTally}. */
	fold: FoldMark | null;
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

	// The title and fold parts are asked when they could matter at all — with
	// every leaving id ending here — and then shown or hidden by a live count,
	// since the answers above them decide which ids end here.
	const everything = pending.leaving.map((leaving) => leaving.id);
	const could = (tally: NoteTally | null): boolean => tally === null || tally.count > 0;

	let titles: NoteChangeQuestion["titles"] = null;
	const renameAsked = ids.some((id) => id.leaving.wasPrimary);
	if (pending.name && !renameAsked && could(titleTally(pending, stats, everything))) {
		titles = { ...pending.name };
	}

	let fold: FoldMark | null = null;
	if (pending.fold !== null && could(foldTally(pending, stats, everything))) fold = pending.fold;

	return ids.length > 0 || titles || fold !== null ? { ids, titles, fold } : null;
}

/**
 * One count over the notes that are this callout's once Save is done: its
 * kept ids, plus the leaving ids in `toSelf` (see {@link idsEndingHere}) —
 * exactly what the title and fold passes cover (noteChanges.formsEndingHere).
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

/** What the user picked for one leaving id. */
export type IdAnswer =
	| { kind: "leave" }
	| { kind: "keep" }
	/** The id becomes another callout's; no note changes. */
	| { kind: "move"; to: string }
	| { kind: "rewrite"; target: RewriteTarget };

/** A leaving id Save hands to another callout — see {@link IdAnswer}. */
export interface GivenId {
	/** As this callout had it. */
	id: string;
	/** The callout that takes it. */
	to: string;
}

export interface NoteChangeAnswers {
	/** By the leaving id's identity; an id with no answer is left in its notes. */
	ids: ReadonlyMap<string, IdAnswer>;
	titles: boolean;
	fold: boolean;
}

/** The answers the window opens on — see noteChanges.defaultNoteChoices. */
export function defaultAnswers(question: NoteChangeQuestion): NoteChangeAnswers {
	const ids = new Map<string, IdAnswer>();
	for (const { leaving } of question.ids) {
		ids.set(
			calloutIdentity(leaving.id),
			leaving.wasPrimary ? { kind: "rewrite", target: { kind: "self" } } : { kind: "leave" },
		);
	}
	return { ids, titles: question.titles !== null, fold: question.fold !== null };
}

/**
 * The leaving ids whose notes are still this callout's once Save is done:
 * rewritten to it, or kept on it as another id. The fold pass runs over every
 * id the callout ends up with, so the fold question has to count these too —
 * a kept id's notes left out of the count would still take the new mark.
 */
export function idsEndingHere(answers: NoteChangeAnswers): string[] {
	return [...answers.ids].flatMap(([key, answer]) =>
		answer.kind === "keep" || (answer.kind === "rewrite" && answer.target.kind === "self") ? [key] : [],
	);
}

/**
 * What Save runs for these answers; the old ids the user chose to keep on the
 * callout — the editor adds those back to its aliases, so they are not leaving
 * at all; and the ones it hands to other callouts.
 */
export function choicesFromAnswers(
	question: NoteChangeQuestion,
	answers: NoteChangeAnswers,
): { choices: NoteChoices; keep: string[]; give: GivenId[] } {
	const rewrite = new Map<string, RewriteTarget>();
	const keep: string[] = [];
	const give: GivenId[] = [];
	let renameFollowed = false;
	for (const { leaving } of question.ids) {
		const answer = answers.ids.get(calloutIdentity(leaving.id));
		if (answer?.kind === "rewrite") {
			rewrite.set(calloutIdentity(leaving.id), answer.target);
			if (leaving.wasPrimary) renameFollowed = true;
		} else if (answer?.kind === "keep") {
			keep.push(leaving.id);
		} else if (answer?.kind === "move") {
			give.push({ id: leaving.id, to: answer.to });
		}
	}
	// A rename asked about its old id answers for its titles too: followed,
	// the titles follow; kept, the notes stay as they are, titles and all.
	const renameAsked = question.ids.some(({ leaving }) => leaving.wasPrimary);
	const titles = renameAsked ? renameFollowed : question.titles !== null && answers.titles;
	return {
		choices: { rewrite, titles, fold: question.fold !== null && answers.fold },
		keep,
		give,
	};
}
