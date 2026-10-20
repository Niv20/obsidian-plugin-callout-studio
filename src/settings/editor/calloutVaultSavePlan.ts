import type { App } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import { calloutIdentity } from "../../utils/calloutId";
import { NoteRewriteJournal } from "../../utils/noteRewriteUndo";
import {
	normalizeFoldMarkersInVault,
	replaceCalloutIdsInVault, replaceCalloutTitlesInVault,
} from "../../utils/vaultCalloutScanner";
import { noticeWithUndo } from "../rewriteUndoNotice";
import type { FoldMark, NoteRewrite } from "./noteChanges";

export type CalloutVaultSavePlan = () => Promise<void>;

/**
 * Persist old spellings until every affected note has reached the new id.
 *
 * Only for ids whose notes are being rewritten: one the user chose to leave in
 * its notes goes at once, and staging it here would keep it on the callout for
 * good, since nothing would ever finish to release it.
 */
export function stageRenameAliases(def: CalloutDefinition, removedIds: string[]): {
	definition: CalloutDefinition;
	release(registry: CalloutRegistry): void;
} {
	const owned = new Set([def.id, ...(def.aliases ?? [])].map(calloutIdentity));
	const retained = removedIds.filter((id) => {
		const key = calloutIdentity(id);
		if (!key || owned.has(key)) return false;
		owned.add(key); return true;
	});
	const protectedIds = new Set(retained.map(calloutIdentity));
	return {
		definition: retained.length ? { ...def, aliases: [...(def.aliases ?? []), ...retained] } : def,
		release(registry) {
			if (retained.length === 0) return;
			const current = registry.getReal(def.id);
			if (!current) throw new Error("Renamed callout no longer exists");
			const aliases = current.aliases?.filter((id) => !protectedIds.has(calloutIdentity(id)));
			// A newer form preview may have arrived while file work awaited. Edit
			// the committed row beneath it without baking draft colors into disk.
			const preview = registry.getPreviewDefinition();
			const shadowed = preview?.id === def.id;
			const demo = registry.isPreviewDemo();
			registry.batch(() => {
				if (shadowed) registry.setPreviewDefinition(null, demo, false);
				try { registry.update(def.id, { aliases: aliases?.length ? aliases : undefined }); }
				finally { if (shadowed) registry.setPreviewDefinition(preview, demo, false); }
			});
		},
	};
}

interface VaultSavePlanInput {
	app: App;
	/** Ids rewritten in notes, each group to one callout. */
	rewrites: NoteRewrite[];
	/**
	 * Titles reading `from` take `to`, on these spellings — the ids the notes
	 * carry BEFORE the rewrites, since this pass runs first.
	 */
	titles: { forms: string[]; from: string; to: string } | null;
	/** Block callouts of these spellings take this fold mark; runs before the rewrites too. */
	fold: { forms: string[]; to: FoldMark } | null;
	/**
	 * How the finished work is announced: with Undo, by default. A test with no
	 * DOM, which an Undo link needs, passes a plain notice instead.
	 */
	announce?: (message: string, journal: NoteRewriteJournal) => void;
}

/**
 * Idempotent phases: retain unfinished work when a file fails, then retry it.
 *
 * Titles and fold marks go first, over the ids the notes carry before any
 * rewrite: this callout's own, and the leaving ids about to be rewritten into
 * it. After the rewrites those notes would carry the saved id — which can be
 * an id just moved here from another callout, whose own notes must not be
 * touched — so only beforehand can a pass tell the two apart. A rewrite keeps
 * whatever fold mark and title the passes left.
 *
 * Every phase records into one journal, created here so it outlives a failed
 * attempt: the retry that finishes the work offers Undo for all of it, and the
 * journal chains the passes over one note (see noteRewriteUndo.ts). The notice
 * comes once, when the last phase is done — never after a failed attempt.
 */
export function createCalloutVaultSavePlan(input: VaultSavePlanInput): CalloutVaultSavePlan | null {
	const { app, titles, fold } = input;
	const rewrites = input.rewrites.filter((rewrite) => rewrite.forms.length > 0);
	if (rewrites.length === 0 && !titles && !fold) return null;
	const announce = input.announce ?? ((message: string, journal: NoteRewriteJournal) =>
		noticeWithUndo(app, message, journal));
	const journal = new NoteRewriteJournal();
	let nextRewrite = 0;
	let titlesDone = titles === null;
	let foldDone = fold === null;
	let announced = false;
	const updates: string[] = [];
	return async () => {
		if (!titlesDone && titles) {
			const replaced = await replaceCalloutTitlesInVault(app, titles.forms, titles.from, titles.to, true, journal);
			if (replaced > 0) updates.push(t("vault.titlesUpdated", {
				count: String(replaced), oldTitle: titles.from, newTitle: titles.to,
			}));
			titlesDone = true;
		}
		if (!foldDone && fold) {
			const replaced = await normalizeFoldMarkersInVault(app, fold.forms, fold.to, true, journal);
			if (replaced > 0) updates.push(t("vault.foldUpdated", { count: String(replaced) }));
			foldDone = true;
		}
		for (; nextRewrite < rewrites.length; nextRewrite++) {
			const rewrite = rewrites[nextRewrite]!;
			const replaced = await replaceCalloutIdsInVault(app, rewrite.forms, rewrite.toId, rewrite.titleSwap, true, journal);
			if (replaced > 0) updates.push(t("vault.idsUpdated", {
				count: String(replaced), oldIds: rewrite.forms.join(", "), newId: rewrite.toId,
			}));
		}
		if (announced) return;
		announced = true;
		// A pass that failed part-way and finished on a retry reports only the
		// retry's share; the journal holds both, so Undo still covers both.
		if (updates.length === 0 && journal.notes.length > 0) {
			updates.push(t("vault.filesUpdated", { count: String(journal.notes.length) }));
		}
		if (updates.length > 0) announce(updates.join("\n"), journal);
	};
}
