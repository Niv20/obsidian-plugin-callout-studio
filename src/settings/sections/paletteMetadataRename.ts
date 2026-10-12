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
 * simply stops naming anything.
 *
 * Not offered for a word that means something else as well — a built-in
 * colour's (a palette called "Pink", from before that preset) or one the
 * theme or a snippet styles. Notes using such a word may well mean that other
 * thing, and a rewrite cannot tell which callouts meant the palette. Left
 * alone, they take the other meaning.
 *
 * Deleting a palette makes no such offer, by the rule every Delete here
 * follows: it removes a definition and never touches a note.
 */
import { Notice, type App } from "obsidian";
import { t } from "../../i18n";
import type { CustomPalette } from "../../types";
import { entryWords, foldMetadataCase, metadataColorEntries } from "../../utils/calloutMetadata";
import {
	countMetadataWordUsages,
	replaceMetadataWordInVault,
} from "../../utils/vaultCalloutScanner";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { NoteRewriteJournal } from "../../utils/noteRewriteUndo";
import { noticeWithUndo } from "../rewriteUndoNotice";
import type { MetadataWordSource } from "../../manager/theme/ThemeMetadataCatalog";

/**
 * The word a saved palette answers to in metadata right now — `""` when its
 * name yields none, when another palette holds the same word (the later one in
 * the list wins it), or when the user's own snippet styles it (`reserved`).
 */
export function ownedMetadataKey(
	palettes: readonly CustomPalette[],
	paletteId: string,
	reserved?: ReadonlySet<string>,
): string {
	return (
		metadataColorEntries(palettes, reserved).find(
			(e) => e.palette.group === "custom" && e.palette.id === paletteId,
		)?.key ?? ""
	);
}

/** Whether a built-in colour also answers to `word` — its own id, or an alias. */
export function isBuiltInColorWord(word: string): boolean {
	return metadataColorEntries([]).some((e) => entryWords(e).includes(word));
}

/** Whether the theme or a snippet reacts to `word` (ASCII case folded, as matched). */
export function isStylingWord(word: string, sources: readonly MetadataWordSource[]): boolean {
	return sources.some((s) => s.words.some((w) => foldMetadataCase(w.word) === word));
}

/**
 * After a palette was saved under a new name: when notes still use the word it
 * answered to before (`oldKey`), ask whether to rewrite them to the new one.
 * Nothing is asked when the word did not change, nothing uses it, or the word
 * also means something else (`sharedWord`) — see the module note.
 */
export async function offerMetadataRename(
	app: App,
	oldKey: string,
	newKey: string,
	sharedWord: (word: string) => boolean,
): Promise<void> {
	if (!oldKey || !newKey || oldKey === newKey || sharedWord(oldKey)) return;

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
