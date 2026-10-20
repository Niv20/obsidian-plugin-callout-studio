/**
 * utils/idNoteStats.ts — what the notes hold for a handful of callout ids, in
 * one pass over the vault.
 *
 * The callout editor asks before its Save changes a note (see
 * settings/editor/noteChanges.ts), and the question has to say how much would
 * change: how often each leaving id is used, how many block callouts would take
 * a new fold mark, how many titles still read the old name. Those are three
 * different counts over the same ids, and reading every note three times to get
 * them would triple the wait between the click and the question.
 *
 * Each count keeps the notes it came from as well as the number. The window
 * adds counts up across ids as the user changes an answer — the fold line also
 * covers ids being rewritten into this callout — and a note holding two of the
 * ids must not be counted twice, which a bare per-id number cannot avoid.
 *
 * The grammar is the one every writer uses (editor/documentCallouts), so a
 * count here is exactly what the matching rewrite would touch: fenced code,
 * frontmatter and escaped tokens never count.
 */
import type { App } from "obsidian";
import { calloutIdentity } from "./calloutId";
import { scanVaultFiles } from "./vaultRewrite";
import { iterateDocumentCalloutLines } from "../editor/documentCallouts";
import { splitFoldMark } from "../editor/calloutWriter";

/** One count over the notes, with the notes it was found in. */
export interface NoteTally {
	count: number;
	/** Paths, so tallies from several ids can be added without double counting. */
	files: Set<string>;
}

/** What the notes hold for one id. */
export interface IdNoteStats {
	/** Every use, in all three roles. */
	uses: NoteTally;
	/** Block callouts whose fold mark is not the one asked about. */
	foldDiffers: NoteTally;
	/** Block and heading callouts whose whole title is the one asked about. */
	titled: NoteTally;
}

export interface IdNoteStatsQuery {
	/** The fold mark the block callouts are compared against; left out, not counted. */
	fold?: "" | "+" | "-";
	/** The title counted (trimmed, case-insensitive); left out or empty, not counted. */
	title?: string;
}

function tally(): NoteTally {
	return { count: 0, files: new Set() };
}

function add(target: NoteTally, path: string): void {
	target.count++;
	target.files.add(path);
}

/** Several ids' tallies as one, each note counted once. */
export function sumTallies(tallies: Iterable<NoteTally>): NoteTally {
	const out = tally();
	for (const one of tallies) {
		out.count += one.count;
		for (const path of one.files) out.files.add(path);
	}
	return out;
}

/**
 * The stats for each of `ids`, keyed by {@link calloutIdentity} — so `a b` and
 * `a-b` are one entry, as everywhere else. Every id is present, unused ones with
 * zero counts. Rejects when a note cannot be read, like every other count: a
 * partial zero must never pass for "nothing uses it".
 */
export async function scanIdNoteStats(
	app: App,
	ids: readonly string[],
	query: IdNoteStatsQuery = {},
): Promise<Map<string, IdNoteStats>> {
	const stats = new Map<string, IdNoteStats>();
	for (const id of ids) {
		const key = calloutIdentity(id);
		if (key && !stats.has(key)) stats.set(key, { uses: tally(), foldDiffers: tally(), titled: tally() });
	}
	if (stats.size === 0) return stats;
	const title = query.title?.trim().toLowerCase() ?? "";

	await scanVaultFiles(app, async (file) => {
		const content = await app.vault.cachedRead(file);
		if (content.indexOf("[!") === -1) return;
		for (const { lineText, tokens } of iterateDocumentCalloutLines(content)) {
			for (const token of tokens) {
				const entry = stats.get(calloutIdentity(token.rawId));
				if (!entry) continue;
				add(entry.uses, file.path);
				// A pill has neither a fold mark nor a title of its own.
				if (token.role === "inline") continue;
				const after = splitFoldMark(lineText.slice(token.to), token.role);
				// Only a block callout has fold syntax: after `## [!id]` a `-`
				// is the first character of the title.
				if (query.fold !== undefined && token.role === "regular" && after.foldMark !== query.fold) {
					add(entry.foldDiffers, file.path);
				}
				if (title && after.title.trim().toLowerCase() === title) add(entry.titled, file.path);
			}
		}
	});
	return stats;
}
