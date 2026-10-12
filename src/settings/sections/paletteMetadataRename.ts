/**
 * settings/sections/paletteMetadataRename.ts — carrying a renamed palette's
 * notes along with it.
 *
 * A saved palette is named in callout metadata by its name in kebab-case
 * (`[!mark|comic-red]`, see `utils/calloutMetadata.paletteMetadataKey`), so a
 * rename changes the word — and every callout still written with the old one
 * silently goes back to its own colour. Renaming a callout type offers to
 * rewrite the notes that use it; this is the same offer for a palette, with
 * the same Undo. Declining is a real choice, not a failure: the old word
 * simply stops naming anything (or names what it would without the palette —
 * a palette called "Pink" was holding Bubblegum's alias).
 *
 * Deleting a palette makes no such offer, by the rule every Delete here
 * follows: it removes a definition and never touches a note.
 */
import { Notice, type App } from "obsidian";
import { t } from "../../i18n";
import type { CustomPalette } from "../../types";
import { metadataColorEntries } from "../../utils/calloutMetadata";
import {
	countMetadataWordUsages,
	replaceMetadataWordInVault,
} from "../../utils/vaultCalloutScanner";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { NoteRewriteJournal } from "../../utils/noteRewriteUndo";
import { noticeWithUndo } from "../rewriteUndoNotice";

/**
 * The word a saved palette answers to in metadata right now — `""` when its
 * name yields none, or when another palette holds the same word (the later
 * one in the list wins it).
 */
export function ownedMetadataKey(
	palettes: readonly CustomPalette[],
	paletteId: string,
): string {
	return (
		metadataColorEntries(palettes).find(
			(e) => e.palette.group === "custom" && e.palette.id === paletteId,
		)?.key ?? ""
	);
}

/**
 * After a palette was saved under a new name: when notes still use the word it
 * answered to before (`oldKey`), ask whether to rewrite them to the new one.
 * Nothing is asked when the word did not change or nothing uses it.
 */
export async function offerMetadataRename(
	app: App,
	oldKey: string,
	palettes: readonly CustomPalette[],
	paletteId: string,
): Promise<void> {
	const newKey = ownedMetadataKey(palettes, paletteId);
	if (!oldKey || !newKey || oldKey === newKey) return;

	let usage: { fileCount: number; totalCount: number };
	try {
		usage = await countMetadataWordUsages(app, oldKey);
	} catch (error) {
		// The scan already told the user which files it could not read.
		console.warn("[callout-studio] counting a palette's metadata uses was incomplete", error);
		return;
	}
	if (usage.totalCount === 0) return;

	const confirmed = await new ConfirmModal(
		app,
		t("palette.renameNotesTitle"),
		t("palette.renameNotesBody", {
			count: String(usage.totalCount),
			files: String(usage.fileCount),
			old: oldKey,
			new: newKey,
		}),
		t("palette.renameNotesConfirm"),
		t("palette.renameNotesSkip"),
		"mod-cta",
	).confirm();
	if (!confirmed) return;

	const journal = new NoteRewriteJournal();
	try {
		const updated = await replaceMetadataWordInVault(app, oldKey, newKey, journal);
		noticeWithUndo(app, t("vault.filesUpdated", { count: String(updated) }), journal);
	} catch (error) {
		console.warn("[callout-studio] rewriting a palette's metadata uses was incomplete", error);
		new Notice(t("palette.renameNotesFailed"), 10000);
	}
}
